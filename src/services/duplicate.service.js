import { NotificationType, ReportStatus, SupportType } from '@prisma/client'
import prisma from '../config/prisma.js'
import { MERGE } from '../config/constants.js'
import { AppError } from '../utils/AppError.js'
import { boundingBox, distanceInMeters } from '../utils/geo.js'
import { clip } from '../utils/text.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'
import { getAdminReportDetail } from './adminReport.service.js'

/**
 * Kandidat duplikat untuk sebuah laporan: laporan sejenis (subjenis sama) yang masih aktif
 * dalam radius MERGE.DUPLICATE_RADIUS_M. Admin memilih sendiri mana yang digabung.
 */
export const findDuplicateCandidates = async ({ reportId }) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, latitude: true, longitude: true, subcategoryId: true },
  })
  if (!report) throw AppError.notFound('Laporan tidak ditemukan')

  const box = boundingBox(report, MERGE.DUPLICATE_RADIUS_M)

  const rows = await prisma.report.findMany({
    where: {
      id: { not: report.id },
      mergedIntoId: null,
      status: { not: ReportStatus.DITOLAK },
      ...(report.subcategoryId && { subcategoryId: report.subcategoryId }),
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
    },
    orderBy: { id: 'desc' },
    take: 50,
    select: {
      id: true,
      trackingCode: true,
      description: true,
      address: true,
      status: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      agency: { select: { id: true, name: true } },
      photos: { select: { id: true, url: true }, orderBy: { id: 'asc' }, take: 1 },
      _count: { select: { supports: true } },
    },
  })

  return rows
    .map(({ _count, latitude, longitude, ...row }) => ({
      ...row,
      supportCount: _count.supports,
      distanceMeters: Math.round(distanceInMeters(report, { latitude, longitude })),
    }))
    .filter((row) => row.distanceMeters <= MERGE.DUPLICATE_RADIUS_M)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MERGE.MAX_CANDIDATES)
}

const MERGE_SELECT = { id: true, trackingCode: true, status: true, reporterId: true, mergedIntoId: true }

/**
 * Gabungkan laporan duplikat (source) ke laporan utama (target).
 *  - source ditandai mergedIntoId dan hilang dari feed/daftar kerja
 *  - dukungan, pengikut, dan komentar source dipindah ke target; pelapor source ikut mendukung target
 *  - semua pengikut source diberi notifikasi yang mengarah ke target
 * Semua langkah berhasil atau gagal bersama (satu transaksi).
 */
export const mergeReports = async ({ sourceId, targetId, admin, note, ipAddress }) => {
  if (sourceId === targetId) {
    throw AppError.badRequest('Laporan tidak bisa digabung dengan dirinya sendiri')
  }

  const [source, target] = await Promise.all([
    prisma.report.findUnique({ where: { id: sourceId }, select: MERGE_SELECT }),
    prisma.report.findUnique({ where: { id: targetId }, select: MERGE_SELECT }),
  ])
  if (!source) throw AppError.notFound('Laporan duplikat tidak ditemukan')
  if (!target) throw AppError.notFound('Laporan utama tidak ditemukan')
  if (source.mergedIntoId) throw AppError.conflict('Laporan ini sudah digabung ke laporan lain')
  if (target.mergedIntoId) {
    throw AppError.conflict('Laporan utama sudah digabung ke laporan lain. Pilih laporan utama yang aktif.')
  }
  if (target.status === ReportStatus.DITOLAK) {
    throw AppError.conflict('Laporan utama berstatus Ditolak. Pilih laporan utama yang valid.')
  }

  await prisma.$transaction(async (tx) => {
    const marked = await tx.report.updateMany({
      where: { id: source.id, mergedIntoId: null },
      data: { mergedIntoId: target.id, isOverdue: false, slaDueAt: null, escalatedAt: null },
    })
    if (marked.count === 0) throw AppError.conflict('Laporan ini baru saja digabung. Muat ulang halaman.')

    // Laporan lain yang sebelumnya digabung ke source ikut dialihkan, supaya rantainya tetap satu tingkat.
    const repointed = await tx.report.updateMany({
      where: { mergedIntoId: source.id },
      data: { mergedIntoId: target.id },
    })

    const [supports, followers] = await Promise.all([
      tx.reportSupport.findMany({ where: { reportId: source.id }, select: { userId: true, type: true } }),
      tx.reportFollow.findMany({ where: { reportId: source.id }, select: { userId: true } }),
    ])

    const supportRows = supports.map(({ userId, type }) => ({ reportId: target.id, userId, type }))
    if (source.reporterId !== target.reporterId) {
      supportRows.push({ reportId: target.id, userId: source.reporterId, type: SupportType.UPVOTE })
    }
    // skipDuplicates: pengguna yang sudah mendukung target tidak diganda (unique reportId+userId+type).
    if (supportRows.length > 0) {
      await tx.reportSupport.createMany({ data: supportRows, skipDuplicates: true })
    }
    if (followers.length > 0) {
      await tx.reportFollow.createMany({
        data: followers.map(({ userId }) => ({ userId, reportId: target.id })),
        skipDuplicates: true,
      })
    }

    const movedComments = await tx.comment.updateMany({
      where: { reportId: source.id },
      data: { reportId: target.id },
    })

    const extra = note ? ` ${note}` : ''
    await tx.progressUpdate.create({
      data: {
        reportId: source.id,
        actorId: admin.id,
        fromStatus: source.status,
        toStatus: source.status,
        note: `Digabung ke laporan ${target.trackingCode} karena duplikat.${extra}`,
      },
    })
    await tx.progressUpdate.create({
      data: {
        reportId: target.id,
        actorId: admin.id,
        fromStatus: target.status,
        toStatus: target.status,
        note: `Laporan ${source.trackingCode} digabung ke laporan ini karena duplikat.`,
      },
    })

    const recipients = followers.map(({ userId }) => userId).filter((id) => id !== admin.id)
    if (recipients.length > 0) {
      const message = clip(
        `Laporan ${source.trackingCode} digabung dengan laporan ${target.trackingCode} karena duplikat. Pantau perkembangannya di ${target.trackingCode}.`,
        500,
      )
      await tx.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          reportId: target.id,
          type: NotificationType.STATUS_UPDATE,
          title: 'Laporan digabung',
          message,
        })),
      })
    }

    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.REPORT_MERGED,
        entityType: 'Report',
        entityId: source.id,
        oldValue: { mergedIntoId: null },
        newValue: {
          mergedIntoId: target.id,
          targetTrackingCode: target.trackingCode,
          movedComments: movedComments.count,
          repointedReports: repointed.count,
          ...(note && { note }),
        },
        ipAddress,
      },
      tx,
    )
  })

  return getAdminReportDetail({ id: target.id, admin })
}