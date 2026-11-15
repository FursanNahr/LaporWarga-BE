import {
  ConfirmationResult,
  DisputeDecision,
  NotificationType,
  ReportStatus,
  Role,
} from '@prisma/client'
import prisma from '../config/prisma.js'
import { COMMENT, CONFIRMATION, PUBLIC_REPORT_STATUSES, SLA, UPLOAD } from '../config/constants.js'
import { AppError } from '../utils/AppError.js'
import { toPublicUrl } from '../utils/file.js'
import { cursorArgs, sliceCursorPage } from '../utils/pagination.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'
import { notifyReportFollowers } from './notification.service.js'
import { getReportById } from './report.service.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NOTIFICATION_TITLE = 'Konfirmasi hasil laporan'
const PREVIEW_LENGTH = 150

// DB hosting bisa jauh dari server, jadi beri waktu lebih longgar daripada default 5 detik.
const TX_OPTIONS = { maxWait: 10000, timeout: 15000 }

const REPORT_SELECT = {
  id: true,
  trackingCode: true,
  status: true,
  reporterId: true,
  agencyId: true,
  reopenCount: true,
  escalatedAt: true,
  mergedIntoId: true,
}

// ---------------------------------------------------------------------
// Helper internal
// ---------------------------------------------------------------------

const preview = (text) => (text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}...` : text)

const findReportOrThrow = async (reportId) => {
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: REPORT_SELECT })
  if (!report) throw AppError.notFound('Laporan tidak ditemukan')
  return report
}

/**
 * Ubah status dengan kunci optimis: hanya berhasil jika status masih `from`.
 * Mencegah dua aksi bersamaan (misal pelapor menjawab tepat saat job menutup otomatis).
 */
const transition = async (tx, { reportId, from, data }) => {
  const { count } = await tx.report.updateMany({ where: { id: reportId, status: from }, data })
  if (count === 0) {
    throw AppError.conflict('Status laporan baru saja berubah. Muat ulang halaman lalu coba lagi.')
  }
}

const agencyStaffIds = async (agencyId, db) => {
  if (!agencyId) return []
  const staff = await db.user.findMany({
    where: { agencyId, role: Role.INSTANSI, isActive: true },
    select: { id: true },
  })
  return staff.map((user) => user.id)
}

const adminIds = async (db) => {
  const admins = await db.user.findMany({
    where: { role: Role.ADMIN, isActive: true },
    select: { id: true },
  })
  return admins.map((user) => user.id)
}

const notifyMany = async (userIds, { reportId, type, title, message }, db) => {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return 0
  await db.notification.createMany({
    data: ids.map((userId) => ({ userId, reportId, type, title, message })),
  })
  return ids.length
}

/** Kirim ke pengikut laporan + penerima tambahan (petugas/admin), tanpa dobel dan tanpa si pelaku. */
const notifyAudience = (tx, { reportId, actorId, extraUserIds = [], type, message }) =>
  Promise.all([
    notifyReportFollowers(
      { reportId, excludeUserId: actorId, excludeUserIds: extraUserIds, type, title: NOTIFICATION_TITLE, message },
      tx,
    ),
    notifyMany(
      extraUserIds.filter((id) => id !== actorId),
      { reportId, type, title: NOTIFICATION_TITLE, message },
      tx,
    ),
  ])

/** Batas waktu tahap = sekarang + jumlah hari dari SlaSetting (atau default di constants). */
const getStageDueAt = async (stage, from, db) => {
  const setting = await db.slaSetting.findUnique({ where: { stage }, select: { maxDays: true } })
  const days = setting?.maxDays ?? SLA.DEFAULT_DAYS[stage]
  return new Date(from.getTime() + days * DAY_MS)
}

// ---------------------------------------------------------------------
// PELAPOR: konfirmasi hasil ("Sudah beres" / "Belum beres")
// ---------------------------------------------------------------------

export const submitConfirmation = async ({ reportId, user, data, files = [], ipAddress }) => {
  const report = await findReportOrThrow(reportId)

  if (report.reporterId !== user.id) {
    throw AppError.forbidden('Hanya pelapor yang dapat mengonfirmasi hasil laporan ini')
  }
  if (report.mergedIntoId) {
    throw AppError.conflict('Laporan ini sudah digabung ke laporan lain')
  }
  if (report.status !== ReportStatus.MENUNGGU_KONFIRMASI) {
    throw AppError.conflict(
      `Laporan tidak sedang menunggu konfirmasi (status saat ini: ${report.status})`,
    )
  }

  const isDispute = data.result === ConfirmationResult.BELUM_BERES
  if (isDispute && files.length === 0) {
    throw AppError.badRequest('Foto bukti wajib diunggah saat menyatakan laporan belum beres')
  }

  const now = new Date()
  const toStatus = isDispute ? ReportStatus.DISANGGAH : ReportStatus.SELESAI
  const note = data.note || null
  const photoUrls = files.map((file) => toPublicUrl(UPLOAD.CONFIRMATION_PHOTOS.FOLDER, file.filename))

  const timelineNote = isDispute
    ? `Pelapor menyatakan hasil belum beres: ${note}`
    : note
      ? `Pelapor mengonfirmasi hasil sudah beres: ${note}`
      : 'Pelapor mengonfirmasi hasil sudah beres'

  await prisma.$transaction(async (tx) => {
    await transition(tx, {
      reportId: report.id,
      from: report.status,
      data: { status: toStatus, confirmDueAt: null, ...(!isDispute && { resolvedAt: now }) },
    })

    await tx.confirmation.create({
      data: {
        reportId: report.id,
        userId: user.id,
        result: data.result,
        note,
        photos: { create: photoUrls.map((url) => ({ url })) },
      },
    })

    await tx.progressUpdate.create({
      data: {
        reportId: report.id,
        actorId: user.id,
        fromStatus: report.status,
        toStatus,
        note: timelineNote,
      },
    })

    await recordAudit(
      {
        actorId: user.id,
        action: isDispute ? AUDIT_ACTIONS.REPORT_DISPUTED : AUDIT_ACTIONS.REPORT_CONFIRMED,
        entityType: 'Report',
        entityId: report.id,
        oldValue: { status: report.status },
        newValue: { status: toStatus, result: data.result, note, photoCount: photoUrls.length },
        ipAddress,
      },
      tx,
    )

    const staffIds = await agencyStaffIds(report.agencyId, tx)
    if (isDispute) {
      await notifyAudience(tx, {
        reportId: report.id,
        actorId: user.id,
        extraUserIds: [...staffIds, ...(await adminIds(tx))],
        type: NotificationType.SANGGAHAN,
        message: `Pelapor menyanggah hasil laporan ${report.trackingCode}. Menunggu keputusan admin.`,
      })
    } else {
      await notifyAudience(tx, {
        reportId: report.id,
        actorId: user.id,
        extraUserIds: staffIds,
        type: NotificationType.STATUS_UPDATE,
        message: `Pelapor mengonfirmasi laporan ${report.trackingCode} sudah beres. Laporan ditutup.`,
      })
    }
  }, TX_OPTIONS)

  return getReportById({ id: report.id, viewer: user })
}

// ---------------------------------------------------------------------
// PUBLIK: riwayat konfirmasi & sanggahan sebuah laporan
// ---------------------------------------------------------------------

export const listConfirmations = async ({ reportId, viewer }) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, reporterId: true, isAnonymous: true },
  })
  const isAdmin = viewer?.role === Role.ADMIN
  const isOwner = viewer?.id === report?.reporterId

  // Laporan yang belum publik hanya terlihat oleh pemilik dan admin.
  if (!report || (!PUBLIC_REPORT_STATUSES.includes(report.status) && !isOwner && !isAdmin)) {
    throw AppError.notFound('Laporan tidak ditemukan')
  }

  const rows = await prisma.confirmation.findMany({
    where: { reportId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      result: true,
      note: true,
      createdAt: true,
      adminDecision: true,
      adminNote: true,
      resolvedAt: true,
      photos: { select: { url: true } },
      user: { select: { id: true, name: true, avatarUrl: true } },
      resolvedBy: { select: { name: true } },
    },
  })

  const hideIdentity = report.isAnonymous && !isAdmin
  return rows.map((row) => ({
    id: row.id,
    result: row.result,
    isAutomatic: row.result === ConfirmationResult.AUTO_CONFIRMED,
    note: row.note,
    createdAt: row.createdAt,
    photos: row.photos.map((photo) => photo.url),
    author: hideIdentity ? { name: COMMENT.ANONYMOUS_NAME } : row.user,
    adminDecision: row.adminDecision
      ? {
          decision: row.adminDecision,
          note: row.adminNote,
          decidedAt: row.resolvedAt,
          decidedBy: row.resolvedBy?.name ?? null,
        }
      : null,
  }))
}

// ---------------------------------------------------------------------
// ADMIN: daftar sanggahan & keputusan
// ---------------------------------------------------------------------

export const listDisputes = async ({ query }) => {
  const { cursor, limit } = query

  const rows = await prisma.report.findMany({
    where: { status: ReportStatus.DISANGGAH },
    select: {
      id: true,
      trackingCode: true,
      description: true,
      address: true,
      reopenCount: true,
      isOverdue: true,
      escalatedAt: true,
      updatedAt: true,
      agency: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      reporter: { select: { id: true, name: true } }, // admin boleh melihat identitas
      confirmations: {
        where: { result: ConfirmationResult.BELUM_BERES, adminDecision: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, note: true, createdAt: true, photos: { select: { url: true } } },
      },
    },
    orderBy: { id: 'desc' },
    ...cursorArgs(cursor, limit),
  })

  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)
  return {
    items: items.map(({ confirmations, ...report }) => ({
      ...report,
      dispute: confirmations[0]
        ? { ...confirmations[0], photos: confirmations[0].photos.map((photo) => photo.url) }
        : null,
    })),
    meta: { limit, hasMore, nextCursor },
  }
}

/**
 * Admin memutuskan sanggahan.
 *  - REOPEN : DISANGGAH -> DALAM_PENANGANAN (instansi menangani ulang, SLA dihitung ulang)
 *  - CLOSE  : DISANGGAH -> SELESAI (ditutup sesuai keputusan admin)
 * Setelah dibuka kembali MAX_REOPEN_BEFORE_ESCALATION kali, laporan ditandai eskalasi.
 */
export const resolveDispute = async ({ reportId, admin, data, ipAddress }) => {
  const report = await findReportOrThrow(reportId)
  if (report.mergedIntoId) {
    throw AppError.conflict('Laporan ini sudah digabung ke laporan lain')
  }
  if (report.status !== ReportStatus.DISANGGAH) {
    throw AppError.conflict(`Laporan tidak sedang disanggah (status saat ini: ${report.status})`)
  }

  const confirmation = await prisma.confirmation.findFirst({
    where: { reportId, result: ConfirmationResult.BELUM_BERES, adminDecision: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (!confirmation) throw AppError.conflict('Tidak ada sanggahan yang menunggu keputusan')

  const isReopen = data.decision === DisputeDecision.REOPEN
  const toStatus = isReopen ? ReportStatus.DALAM_PENANGANAN : ReportStatus.SELESAI
  const nextReopenCount = report.reopenCount + (isReopen ? 1 : 0)
  const flagRed = isReopen && nextReopenCount >= CONFIRMATION.MAX_REOPEN_BEFORE_ESCALATION
  const newlyEscalated = flagRed && !report.escalatedAt
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    const reportData = isReopen
      ? {
          status: toStatus,
          reopenCount: { increment: 1 },
          resolvedAt: null,
          confirmDueAt: null,
          slaDueAt: await getStageDueAt(ReportStatus.DALAM_PENANGANAN, now, tx),
          isOverdue: flagRed,
          ...(newlyEscalated && { escalatedAt: now }),
        }
      : { status: toStatus, resolvedAt: now, confirmDueAt: null }

    await transition(tx, { reportId: report.id, from: ReportStatus.DISANGGAH, data: reportData })

    await tx.confirmation.update({
      where: { id: confirmation.id },
      data: {
        adminDecision: data.decision,
        adminNote: data.reason,
        resolvedById: admin.id,
        resolvedAt: now,
      },
    })

    await tx.progressUpdate.create({
      data: {
        reportId: report.id,
        actorId: admin.id,
        fromStatus: ReportStatus.DISANGGAH,
        toStatus,
        note: `Keputusan admin, ${isReopen ? 'laporan dibuka kembali' : 'laporan ditutup'}: ${data.reason}`,
      },
    })

    await recordAudit(
      {
        actorId: admin.id,
        action: isReopen ? AUDIT_ACTIONS.DISPUTE_REOPENED : AUDIT_ACTIONS.DISPUTE_CLOSED,
        entityType: 'Report',
        entityId: report.id,
        oldValue: { status: report.status, reopenCount: report.reopenCount },
        newValue: {
          status: toStatus,
          reopenCount: nextReopenCount,
          decision: data.decision,
          reason: data.reason,
          escalated: newlyEscalated,
        },
        ipAddress,
      },
      tx,
    )

    const staffIds = await agencyStaffIds(report.agencyId, tx)
    await notifyAudience(tx, {
      reportId: report.id,
      actorId: admin.id,
      extraUserIds: staffIds,
      type: NotificationType.STATUS_UPDATE,
      message: isReopen
        ? `Admin memutuskan laporan ${report.trackingCode} dibuka kembali: ${preview(data.reason)}`
        : `Admin memutuskan laporan ${report.trackingCode} ditutup: ${preview(data.reason)}`,
    })

    if (newlyEscalated) {
      const otherAdmins = (await adminIds(tx)).filter((id) => id !== admin.id)
      await notifyMany(
        otherAdmins,
        {
          reportId: report.id,
          type: NotificationType.SLA_TERLEWAT,
          title: 'Laporan perlu perhatian',
          message: `Laporan ${report.trackingCode} sudah dibuka kembali ${nextReopenCount} kali dan ditandai eskalasi.`,
        },
        tx,
      )
    }
  }, TX_OPTIONS)

  return getReportById({ id: report.id, viewer: admin })
}

// ---------------------------------------------------------------------
// SISTEM (dipanggil jobs/confirmation.job.js): tutup otomatis jika pelapor diam
// ---------------------------------------------------------------------

const autoCloseReport = async (report, now) => {
  const note = `Ditutup otomatis oleh sistem: pelapor tidak memberi konfirmasi dalam ${CONFIRMATION.DUE_DAYS} hari.`

  await prisma.$transaction(async (tx) => {
    await transition(tx, {
      reportId: report.id,
      from: ReportStatus.MENUNGGU_KONFIRMASI,
      data: { status: ReportStatus.SELESAI, resolvedAt: now, confirmDueAt: null },
    })

    // Kolom userId wajib terisi, jadi dicatat atas nama pelapor. Penanda AUTO_CONFIRMED membedakannya.
    await tx.confirmation.create({
      data: { reportId: report.id, userId: report.reporterId, result: ConfirmationResult.AUTO_CONFIRMED, note },
    })

    await tx.progressUpdate.create({
      data: {
        reportId: report.id,
        actorId: report.reporterId,
        fromStatus: ReportStatus.MENUNGGU_KONFIRMASI,
        toStatus: ReportStatus.SELESAI,
        note,
      },
    })

    await recordAudit(
      {
        actorId: report.reporterId,
        action: AUDIT_ACTIONS.REPORT_AUTO_CONFIRMED,
        entityType: 'Report',
        entityId: report.id,
        oldValue: { status: ReportStatus.MENUNGGU_KONFIRMASI },
        newValue: { status: ReportStatus.SELESAI, auto: true },
      },
      tx,
    )

    await notifyAudience(tx, {
      reportId: report.id,
      extraUserIds: await agencyStaffIds(report.agencyId, tx),
      type: NotificationType.STATUS_UPDATE,
      message: `Laporan ${report.trackingCode} ditutup otomatis karena pelapor tidak memberi konfirmasi dalam ${CONFIRMATION.DUE_DAYS} hari.`,
    })
  }, TX_OPTIONS)
}

export const runConfirmationCheck = async () => {
  const now = new Date()
  const due = await prisma.report.findMany({
    where: { status: ReportStatus.MENUNGGU_KONFIRMASI, confirmDueAt: { lte: now } },
    select: REPORT_SELECT,
    orderBy: { confirmDueAt: 'asc' },
    take: CONFIRMATION.BATCH_SIZE,
  })

  let autoClosed = 0
  for (const report of due) {
    try {
      await autoCloseReport(report, now)
      autoClosed += 1
    } catch (error) {
      // 409 = pelapor baru saja menjawab, wajar dan diabaikan. Error lain dicatat tanpa menghentikan yang lain.
      if (!(error instanceof AppError && error.statusCode === 409)) {
        console.error(`[confirmation] gagal menutup laporan ${report.trackingCode}:`, error.message)
      }
    }
  }
  return { autoClosed }
}