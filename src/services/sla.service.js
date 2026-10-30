import { NotificationType, ReportStatus, Role } from '@prisma/client'
import prisma from '../config/prisma.js'
import { AGENCY_SLA_STAGES, SLA, SLA_STAGES, STATUS_LABEL } from '../config/constants.js'
import { AppError } from '../utils/AppError.js'
import { DAY_MS } from '../utils/date.js'
import { clip } from '../utils/text.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'

// Status yang tidak punya SLA. Laporan di status ini (atau yang sudah digabung) tidak boleh punya penanda SLA.
const FINAL_STATUSES = [ReportStatus.DITOLAK, ReportStatus.SELESAI]

// ---------------------------------------------------------------------
// Dipakai service lain
// ---------------------------------------------------------------------

/** Peta tahap -> batas hari. Tahap yang belum ada di database memakai nilai bawaan. */
export const getSlaDays = async (db = prisma) => {
  const rows = await db.slaSetting.findMany({ select: { stage: true, maxDays: true } })
  const days = new Map(Object.entries(SLA.DEFAULT_DAYS))
  for (const row of rows) days.set(row.stage, row.maxDays)
  return days
}

/** Batas waktu tahap `stage` jika dimulai pada `from`. null untuk tahap akhir (tanpa SLA). */
export const slaDueAtFor = (stage, from, slaDays) => {
  if (!SLA_STAGES.includes(stage)) return null
  const days = slaDays.get(stage)
  return days ? new Date(from.getTime() + days * DAY_MS) : null
}

// ---------------------------------------------------------------------
// Pengaturan SLA (admin)
// ---------------------------------------------------------------------

export const listSlaSettings = async () => {
  const rows = await prisma.slaSetting.findMany({
    select: {
      stage: true,
      maxDays: true,
      updatedAt: true,
      updatedBy: { select: { id: true, name: true } },
    },
  })
  const byStage = new Map(rows.map((row) => [row.stage, row]))

  return SLA_STAGES.map((stage) => {
    const row = byStage.get(stage)
    return {
      stage,
      label: STATUS_LABEL[stage],
      maxDays: row?.maxDays ?? SLA.DEFAULT_DAYS[stage],
      isDefault: !row,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    }
  })
}

export const updateSlaSettings = async ({ settings, admin, ipAddress }) => {
  const current = await getSlaDays()

  const oldValue = {}
  const newValue = {}
  for (const { stage, maxDays } of settings) {
    if (current.get(stage) === maxDays) continue
    oldValue[stage] = current.get(stage) ?? null
    newValue[stage] = maxDays
  }

  if (Object.keys(newValue).length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const { stage, maxDays } of settings) {
        if (!(stage in newValue)) continue
        await tx.slaSetting.upsert({
          where: { stage },
          update: { maxDays, updatedById: admin.id },
          create: { stage, maxDays, updatedById: admin.id },
        })
      }
      await recordAudit(
        {
          actorId: admin.id,
          action: AUDIT_ACTIONS.SLA_SETTINGS_UPDATED,
          entityType: 'SlaSetting',
          oldValue,
          newValue,
          ipAddress,
        },
        tx,
      )
    })
  }

  return listSlaSettings()
}

// ---------------------------------------------------------------------
// Pemeriksaan SLA (dipanggil job terjadwal dan tombol manual di admin)
// ---------------------------------------------------------------------

let isRunning = false

/**
 * Hitung ulang batas waktu semua laporan yang masih berjalan, tandai yang terlewat,
 * dan kirim notifikasi eskalasi.
 *
 * Waktu masuk sebuah tahap = entri timeline TERAKHIR yang benar-benar pindah ke tahap itu
 * (fromStatus berbeda). Catatan tambahan di tahap yang sama (TAMBAH_CATATAN, penggabungan)
 * TIDAK mengulang hitungan, jadi SLA tidak bisa "diulur" dengan menulis catatan.
 *
 * Eskalasi (hanya saat laporan BARU melewati batas):
 *  - tahap milik admin (menunggu verifikasi, terverifikasi): notifikasi ke semua admin
 *  - tahap milik instansi (diteruskan, dalam penanganan): ke semua admin + atasan instansi (isAgencyHead)
 */
export const runSlaCheck = async () => {
  if (isRunning) throw AppError.conflict('Pengecekan SLA sedang berjalan')
  isRunning = true

  try {
    const now = new Date()
    const slaDays = await getSlaDays()
    const summary = { checked: 0, becameOverdue: 0, cleared: 0, cleaned: 0 }

    // Laporan yang sudah tidak butuh SLA (tahap akhir atau sudah digabung): bersihkan penandanya.
    const cleaned = await prisma.report.updateMany({
      where: {
        AND: [
          { OR: [{ status: { in: FINAL_STATUSES } }, { mergedIntoId: { not: null } }] },
          { OR: [{ isOverdue: true }, { slaDueAt: { not: null } }, { escalatedAt: { not: null } }] },
        ],
      },
      data: { isOverdue: false, slaDueAt: null, escalatedAt: null },
    })
    summary.cleaned = cleaned.count

    const [admins, heads] = await Promise.all([
      prisma.user.findMany({ where: { role: Role.ADMIN, isActive: true }, select: { id: true } }),
      prisma.user.findMany({
        where: { role: Role.INSTANSI, isAgencyHead: true, isActive: true, agencyId: { not: null } },
        select: { id: true, agencyId: true },
      }),
    ])
    const headsByAgency = new Map()
    for (const head of heads) {
      headsByAgency.set(head.agencyId, [...(headsByAgency.get(head.agencyId) ?? []), head.id])
    }

    for (const stage of SLA_STAGES) {
      const maxDays = slaDays.get(stage)
      if (!maxDays) continue

      let cursor
      for (;;) {
        const rows = await prisma.report.findMany({
          where: { status: stage, mergedIntoId: null },
          orderBy: { id: 'asc' },
          take: SLA.BATCH_SIZE,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
          select: {
            id: true,
            trackingCode: true,
            agencyId: true,
            createdAt: true,
            slaDueAt: true,
            isOverdue: true,
            progressUpdates: {
              where: { toStatus: stage, OR: [{ fromStatus: null }, { fromStatus: { not: stage } }] },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { createdAt: true },
            },
          },
        })
        if (rows.length === 0) break

        for (const row of rows) {
          summary.checked += 1

          const enteredAt = row.progressUpdates[0]?.createdAt ?? row.createdAt
          const dueAt = new Date(enteredAt.getTime() + maxDays * DAY_MS)
          const overdue = now > dueAt
          const dueChanged = !row.slaDueAt || row.slaDueAt.getTime() !== dueAt.getTime()

          if (overdue && !row.isOverdue) {
            const recipients = new Set(admins.map((admin) => admin.id))
            if (AGENCY_SLA_STAGES.includes(stage)) {
              for (const id of headsByAgency.get(row.agencyId) ?? []) recipients.add(id)
            }
            const message = clip(
              `Laporan ${row.trackingCode} melewati batas SLA tahap "${STATUS_LABEL[stage]}" (${maxDays} hari).`,
              500,
            )

            await prisma.$transaction([
              prisma.report.update({
                where: { id: row.id },
                data: { slaDueAt: dueAt, isOverdue: true, escalatedAt: now },
              }),
              prisma.notification.createMany({
                data: [...recipients].map((userId) => ({
                  userId,
                  reportId: row.id,
                  type: NotificationType.SLA_TERLEWAT,
                  title: 'SLA terlewat',
                  message,
                })),
              }),
            ])
            summary.becameOverdue += 1
          } else if (!overdue && row.isOverdue) {
            await prisma.report.update({
              where: { id: row.id },
              data: { slaDueAt: dueAt, isOverdue: false, escalatedAt: null },
            })
            summary.cleared += 1
          } else if (dueChanged) {
            await prisma.report.update({ where: { id: row.id }, data: { slaDueAt: dueAt } })
          }
        }

        cursor = rows[rows.length - 1].id
        if (rows.length < SLA.BATCH_SIZE) break
      }
    }

    return summary
  } finally {
    isRunning = false
  }
}