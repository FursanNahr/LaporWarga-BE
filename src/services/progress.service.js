import { AttachmentKind, NotificationType, ReportStatus } from '@prisma/client'
import prisma from '../config/prisma.js'
import { GEO, INSTANSI_ACTIONS, UPLOAD } from '../config/constants.js'
import { AppError } from '../utils/AppError.js'
import { distanceInMeters } from '../utils/geo.js'
import { toPublicUrl } from '../utils/file.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'
import { notifyReportFollowers } from './notification.service.js'
import { getReportById } from './report.service.js'

const MAX_FILE_NAME_LENGTH = 255

const NOTIFICATION_TITLE = 'Pembaruan laporan'

const buildNotificationMessage = (action, trackingCode, agencyName) => {
  switch (action) {
    case 'MULAI_TANGANI':
      return `Laporan ${trackingCode} mulai ditangani oleh ${agencyName}.`
    case 'SELESAIKAN':
      return `Laporan ${trackingCode} telah diselesaikan oleh ${agencyName}. Silakan periksa hasilnya.`
    default:
      return `Ada pembaruan progres pada laporan ${trackingCode}.`
  }
}

/** Susun daftar lampiran dari file yang diunggah. */
const buildAttachments = ({ files, officerLocation, distance, capturedAt }) => {
  const { photos = [], afterPhotos = [], documents = [] } = files
  const urlOf = (file) => toPublicUrl(UPLOAD.PROGRESS_FILES.FOLDER, file.filename)

  return [
    ...photos.map((file) => ({ kind: AttachmentKind.FOTO_PROGRESS, url: urlOf(file) })),
    ...afterPhotos.map((file) => ({
      kind: AttachmentKind.FOTO_SESUDAH,
      url: urlOf(file),
      // Bukti foto diambil di lokasi: koordinat petugas, waktu dari server (bukan dari client), dan jarak.
      capturedLatitude: officerLocation.latitude,
      capturedLongitude: officerLocation.longitude,
      capturedAt,
      distanceFromReportM: distance,
    })),
    ...documents.map((file) => ({
      kind: AttachmentKind.DOKUMEN,
      url: urlOf(file),
      fileName: file.originalname.slice(0, MAX_FILE_NAME_LENGTH),
    })),
  ]
}

/**
 * Petugas instansi memperbarui progres laporan.
 *
 * Aksi (lihat INSTANSI_ACTIONS di config/constants.js):
 *  - MULAI_TANGANI  : DITERUSKAN       -> DALAM_PENANGANAN
 *  - TAMBAH_CATATAN : DALAM_PENANGANAN -> DALAM_PENANGANAN (status tetap, hanya catatan/lampiran)
 *  - SELESAIKAN     : DALAM_PENANGANAN -> SELESAI (wajib foto "sesudah" dalam radius 100 m)
 */
export const createProgressUpdate = async ({ reportId, officer, data, files, ipAddress }) => {
  if (!officer.agencyId) {
    throw AppError.forbidden('Akun instansi Anda belum terhubung ke instansi mana pun')
  }

  const rule = INSTANSI_ACTIONS[data.action]
  const isFinishing = rule.to === ReportStatus.SELESAI
  const { afterPhotos = [] } = files

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      trackingCode: true,
      status: true,
      latitude: true,
      longitude: true,
      agencyId: true,
      mergedIntoId: true,
    },
  })

  // 404 (bukan 403) untuk laporan instansi lain, supaya keberadaannya tidak bocor.
  if (!report || report.agencyId !== officer.agencyId) {
    throw AppError.notFound('Laporan tidak ditemukan')
  }
  if (report.mergedIntoId) {
    throw AppError.conflict('Laporan ini sudah digabung ke laporan lain')
  }
  if (report.status !== rule.from) {
    throw AppError.conflict(
      `Aksi ${data.action} hanya bisa dilakukan saat status ${rule.from} (status saat ini: ${report.status})`,
    )
  }

  // ---- Aturan foto "sesudah" ----
  let distance = null
  if (!isFinishing && afterPhotos.length > 0) {
    throw AppError.badRequest('Foto sesudah hanya boleh dikirim saat menyelesaikan laporan')
  }
  if (isFinishing) {
    if (afterPhotos.length === 0) {
      throw AppError.badRequest('Foto sesudah wajib diunggah untuk menyelesaikan laporan')
    }
    distance = distanceInMeters(
      { latitude: data.latitude, longitude: data.longitude },
      report,
    )
    if (distance > GEO.AFTER_PHOTO_RADIUS_M) {
      throw AppError.badRequest(
        `Foto sesudah harus diambil dalam radius ${GEO.AFTER_PHOTO_RADIUS_M} m dari titik laporan (jarak Anda ${distance} m)`,
        { distanceMeters: distance, maxDistanceMeters: GEO.AFTER_PHOTO_RADIUS_M },
      )
    }
  }

  const now = new Date()
  const attachments = buildAttachments({
    files,
    officerLocation: { latitude: data.latitude, longitude: data.longitude },
    distance,
    capturedAt: now,
  })
  const statusChanged = rule.from !== rule.to

  // Perubahan status, timeline, log audit, dan notifikasi: berhasil semua atau gagal semua.
  await prisma.$transaction(async (tx) => {
    // Kunci optimis: hanya berhasil jika status belum berubah sejak dibaca di atas.
    // Mencegah dua petugas menekan tombol yang sama bersamaan lalu timeline-nya ganda.
    const updated = await tx.report.updateMany({
      where: { id: report.id, status: report.status },
      data: { status: rule.to, ...(isFinishing && { resolvedAt: now }) },
    })
    if (updated.count === 0) {
      throw AppError.conflict('Status laporan baru saja berubah. Muat ulang halaman lalu coba lagi.')
    }

    await tx.progressUpdate.create({
      data: {
        reportId: report.id,
        actorId: officer.id,
        fromStatus: report.status,
        toStatus: rule.to,
        note: data.note || null,
        latitude: data.latitude,
        longitude: data.longitude,
        attachments: { create: attachments },
      },
    })

    await recordAudit(
      {
        actorId: officer.id,
        action: statusChanged
          ? AUDIT_ACTIONS.REPORT_STATUS_CHANGED
          : AUDIT_ACTIONS.REPORT_PROGRESS_ADDED,
        entityType: 'Report',
        entityId: report.id,
        oldValue: { status: report.status },
        newValue: { status: rule.to, note: data.note || null },
        ipAddress,
      },
      tx,
    )

    await notifyReportFollowers(
      {
        reportId: report.id,
        excludeUserId: officer.id,
        type: NotificationType.STATUS_UPDATE,
        title: NOTIFICATION_TITLE,
        message: buildNotificationMessage(data.action, report.trackingCode, officer.agency.name),
      },
      tx,
    )
  })

  return getReportById({ id: report.id, viewer: officer })
}
