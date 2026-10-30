import { NotificationType, ReportStatus, Role } from '@prisma/client'
import prisma from '../config/prisma.js'
import { ADMIN_ACTIONS } from '../config/constants.js'
import { AppError } from '../utils/AppError.js'
import { cursorArgs, sliceCursorPage } from '../utils/pagination.js'
import { clip } from '../utils/text.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'
import { notifyReportFollowers } from './notification.service.js'
import { getReportById } from './report.service.js'
import { getSlaDays, slaDueAtFor } from './sla.service.js'

const NOTIFICATION_TITLE = 'Pembaruan laporan'

// =====================================================================
// DAFTAR & DETAIL (admin melihat semua laporan, termasuk identitas pelapor anonim)
// =====================================================================

const ADMIN_REPORT_SELECT = {
  id: true,
  trackingCode: true,
  description: true,
  address: true,
  status: true,
  rejectionReason: true,
  isAnonymous: true,
  reopenCount: true,
  slaDueAt: true,
  isOverdue: true,
  escalatedAt: true,
  mergedIntoId: true,
  createdAt: true,
  updatedAt: true,
  reporter: { select: { id: true, name: true, email: true } },
  subcategory: {
    select: { id: true, name: true, category: { select: { id: true, name: true } } },
  },
  agency: { select: { id: true, name: true } },
  district: { select: { id: true, name: true } },
  photos: { select: { id: true, url: true }, orderBy: { id: 'asc' }, take: 1 },
  _count: { select: { photos: true, comments: { where: { isHidden: false } } } },
}

const toAdminReportItem = ({ _count, slaDueAt, isOverdue, escalatedAt, ...report }) => ({
  ...report,
  photoCount: _count.photos,
  commentCount: _count.comments,
  sla: { dueAt: slaDueAt, isOverdue, escalatedAt },
})

/** Filter bersama untuk daftar dan ekspor. Laporan hasil gabungan disembunyikan kecuali merged=true. */
export const buildAdminWhere = (query) => {
  const { status, agencyId, subcategoryId, districtId, isOverdue, merged, dateFrom, dateTo, q } = query

  return {
    mergedIntoId: merged ? { not: null } : null,
    ...(status && { status }),
    ...(agencyId && { agencyId }),
    ...(subcategoryId && { subcategoryId }),
    ...(districtId && { districtId }),
    ...(isOverdue !== undefined && { isOverdue }),
    ...((dateFrom || dateTo) && {
      createdAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) },
    }),
    ...(q && {
      OR: [
        { trackingCode: { contains: q } },
        { description: { contains: q } },
        { address: { contains: q } },
        { reporter: { name: { contains: q } } },
        { reporter: { email: { contains: q } } },
      ],
    }),
  }
}

/** order=asc untuk antrean verifikasi (yang paling lama menunggu dulu). */
export const listAdminReports = async ({ query }) => {
  const { cursor, limit, order } = query

  const rows = await prisma.report.findMany({
    where: buildAdminWhere(query),
    select: ADMIN_REPORT_SELECT,
    orderBy: { id: order },
    ...cursorArgs(cursor, limit),
  })
  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)

  return { items: items.map(toAdminReportItem), meta: { limit, hasMore, nextCursor } }
}

/** Detail yang sama dengan halaman publik (termasuk timeline), ditambah data khusus admin. */
export const getAdminReportDetail = async ({ id, admin }) => {
  const detail = await getReportById({ id, viewer: admin })

  const extra = await prisma.report.findUnique({
    where: { id },
    select: {
      slaDueAt: true,
      isOverdue: true,
      escalatedAt: true,
      resolvedAt: true,
      reporter: { select: { id: true, name: true, email: true } },
      mergedInto: { select: { id: true, trackingCode: true } },
      _count: { select: { mergedReports: true } },
    },
  })

  return {
    ...detail,
    admin: {
      reporter: extra.reporter, // identitas asli, juga untuk laporan anonim
      sla: { dueAt: extra.slaDueAt, isOverdue: extra.isOverdue, escalatedAt: extra.escalatedAt },
      resolvedAt: extra.resolvedAt,
      mergedInto: extra.mergedInto,
      mergedReportCount: extra._count.mergedReports,
    },
  }
}

// =====================================================================
// VERIFIKASI: VERIFIKASI | TOLAK | TERUSKAN
// =====================================================================

const resolveTargetAgency = async ({ requestedId, currentId }) => {
  const id = requestedId ?? currentId
  if (!id) throw AppError.badRequest('Pilih instansi tujuan')

  const agency = await prisma.agency.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true },
  })
  if (!agency) throw AppError.badRequest('Instansi tujuan tidak ditemukan atau tidak aktif')
  return agency
}

/** Langkah timeline yang akan dicatat. TERUSKAN dari MENUNGGU_VERIFIKASI = verifikasi + teruskan. */
const buildSteps = ({ action, fromStatus, data, agency }) => {
  if (action === 'VERIFIKASI') {
    return [
      {
        from: fromStatus,
        to: ReportStatus.TERVERIFIKASI,
        note: data.note || 'Laporan diverifikasi admin.',
      },
    ]
  }

  if (action === 'TOLAK') {
    return [{ from: fromStatus, to: ReportStatus.DITOLAK, note: data.reason }]
  }

  const forward = {
    from: ReportStatus.TERVERIFIKASI,
    to: ReportStatus.DITERUSKAN,
    note: `Laporan diteruskan ke ${agency.name}.${data.note ? ` ${data.note}` : ''}`,
  }
  return fromStatus === ReportStatus.MENUNGGU_VERIFIKASI
    ? [
        { from: fromStatus, to: ReportStatus.TERVERIFIKASI, note: 'Laporan diverifikasi admin.' },
        forward,
      ]
    : [forward]
}

const buildFollowerMessage = ({ action, trackingCode, reason, agency }) => {
  switch (action) {
    case 'VERIFIKASI':
      return `Laporan ${trackingCode} telah diverifikasi oleh admin.`
    case 'TOLAK':
      return clip(`Laporan ${trackingCode} ditolak. Alasan: ${reason}`, 500)
    default:
      return `Laporan ${trackingCode} telah diverifikasi dan diteruskan ke ${agency.name}.`
  }
}

export const verifyReport = async ({ reportId, admin, data, ipAddress }) => {
  const rule = ADMIN_ACTIONS[data.action]

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      trackingCode: true,
      status: true,
      agencyId: true,
      mergedIntoId: true,
      subcategory: { select: { agencyId: true } },
    },
  })
  if (!report) throw AppError.notFound('Laporan tidak ditemukan')
  if (report.mergedIntoId) throw AppError.conflict('Laporan ini sudah digabung ke laporan lain')
  if (!rule.from.includes(report.status)) {
    throw AppError.conflict(
      `Aksi ${data.action} hanya bisa dilakukan saat status ${rule.from.join(' atau ')} (status saat ini: ${report.status})`,
    )
  }

  const isForwarding = rule.to === ReportStatus.DITERUSKAN
  const isRejecting = rule.to === ReportStatus.DITOLAK
  const agency = isForwarding
    ? await resolveTargetAgency({
        requestedId: data.agencyId,
        currentId: report.agencyId ?? report.subcategory?.agencyId,
      })
    : null

  const now = new Date()
  const slaDays = await getSlaDays()
  const steps = buildSteps({ action: data.action, fromStatus: report.status, data, agency })

  await prisma.$transaction(async (tx) => {
    // Kunci optimis: gagal jika ada yang mengubah status laporan ini sejak dibaca di atas.
    const updated = await tx.report.updateMany({
      where: { id: report.id, status: report.status, mergedIntoId: null },
      data: {
        status: rule.to,
        ...(isRejecting && { rejectionReason: data.reason }),
        ...(isForwarding && { agencyId: agency.id }),
        // Tahap baru = hitungan SLA baru.
        slaDueAt: slaDueAtFor(rule.to, now, slaDays),
        isOverdue: false,
        escalatedAt: null,
      },
    })
    if (updated.count === 0) {
      throw AppError.conflict('Status laporan baru saja berubah. Muat ulang halaman lalu coba lagi.')
    }

    for (const step of steps) {
      await tx.progressUpdate.create({
        data: {
          reportId: report.id,
          actorId: admin.id,
          fromStatus: step.from,
          toStatus: step.to,
          note: step.note,
        },
      })
    }

    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.REPORT_STATUS_CHANGED,
        entityType: 'Report',
        entityId: report.id,
        oldValue: { status: report.status, agencyId: report.agencyId },
        newValue: {
          status: rule.to,
          action: data.action,
          agencyId: isForwarding ? agency.id : report.agencyId,
          ...(isRejecting && { rejectionReason: data.reason }),
          ...(data.note && { note: data.note }),
        },
        ipAddress,
      },
      tx,
    )

    await notifyReportFollowers(
      {
        reportId: report.id,
        excludeUserId: admin.id,
        type: NotificationType.STATUS_UPDATE,
        title: NOTIFICATION_TITLE,
        message: buildFollowerMessage({
          action: data.action,
          trackingCode: report.trackingCode,
          reason: data.reason,
          agency,
        }),
      },
      tx,
    )

    // Petugas instansi tujuan diberi tahu ada laporan baru.
    if (isForwarding) {
      const staff = await tx.user.findMany({
        where: { role: Role.INSTANSI, isActive: true, agencyId: agency.id },
        select: { id: true },
      })
      if (staff.length > 0) {
        await tx.notification.createMany({
          data: staff.map(({ id }) => ({
            userId: id,
            reportId: report.id,
            type: NotificationType.STATUS_UPDATE,
            title: 'Laporan baru diteruskan',
            message: `Laporan ${report.trackingCode} diteruskan ke instansi Anda.`,
          })),
        })
      }
    }
  })

  return getAdminReportDetail({ id: report.id, admin })
}