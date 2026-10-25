import { ReportStatus, Role, SupportType } from '@prisma/client'
import prisma from '../config/prisma.js'
import { GEO, PUBLIC_REPORT_STATUSES, UPLOAD } from '../config/constants.js'
import { AppError } from '../utils/AppError.js'
import { boundingBox, distanceInMeters } from '../utils/geo.js'
import { cursorArgs, sliceCursorPage } from '../utils/pagination.js'
import { toPublicUrl } from '../utils/file.js'
import {
  buildTrackingPrefix,
  formatTrackingCode,
  parseTrackingSequence,
} from '../utils/trackingCode.js'

// =====================================================================
// SELECT: kolom apa saja yang diambil dari database
// =====================================================================

// reporterId dipakai untuk logika di server, tapi TIDAK ikut dikirim ke client (lihat toReportDto).
const REPORT_SELECT = {
  id: true,
  trackingCode: true,
  description: true,
  latitude: true,
  longitude: true,
  address: true,
  isAnonymous: true,
  status: true,
  rejectionReason: true,
  reopenCount: true,
  createdAt: true,
  updatedAt: true,
  reporterId: true,
  reporter: { select: { id: true, name: true, avatarUrl: true } },
  subcategory: {
    select: { id: true, name: true, category: { select: { id: true, name: true } } },
  },
  agency: { select: { id: true, name: true } },
  district: { select: { id: true, name: true } },
  photos: { select: { id: true, url: true }, orderBy: { id: 'asc' } },
  _count: { select: { comments: { where: { isHidden: false } } } },
}

// Halaman detail = data feed + timeline progress.
const REPORT_DETAIL_SELECT = {
  ...REPORT_SELECT,
  progressUpdates: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true, role: true } },
      attachments: {
        select: {
          id: true,
          kind: true,
          url: true,
          fileName: true,
          capturedAt: true,
          distanceFromReportM: true,
        },
      },
    },
  },
}

// =====================================================================
// MAPPER: bentuk data database -> bentuk response (DTO)
// Semua aturan "siapa boleh lihat apa" dikumpulkan di sini.
// =====================================================================

const toTimelineItem = (update) => ({
  id: update.id,
  fromStatus: update.fromStatus,
  toStatus: update.toStatus,
  note: update.note,
  createdAt: update.createdAt,
  // Identitas warga tidak dibuka di timeline (menjaga laporan anonim). Petugas/admin tampil dengan nama.
  actor:
    update.actor.role === Role.WARGA
      ? { name: 'Pelapor', role: update.actor.role }
      : { name: update.actor.name, role: update.actor.role },
  attachments: update.attachments,
})

const toReportDto = (report, { viewer, stats, mine, distanceMeters = null }) => {
  const isOwner = viewer?.id === report.reporterId
  // Laporan anonim: identitas hanya terlihat oleh pemilik dan admin.
  const canSeeReporter = !report.isAnonymous || isOwner || viewer?.role === Role.ADMIN

  const supportStats = stats?.get(report.id) ?? { upvotes: 0, verifications: 0 }
  const mySupports = mine?.get(report.id)

  return {
    id: report.id,
    trackingCode: report.trackingCode,
    description: report.description,
    latitude: report.latitude,
    longitude: report.longitude,
    address: report.address,
    status: report.status,
    rejectionReason: report.rejectionReason,
    reopenCount: report.reopenCount,
    isAnonymous: report.isAnonymous,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    reporter: canSeeReporter ? report.reporter : null,
    subcategory: report.subcategory,
    agency: report.agency,
    district: report.district,
    photos: report.photos,
    stats: {
      upvotes: supportStats.upvotes,
      verifications: supportStats.verifications,
      comments: report._count.comments,
    },
    // null untuk tamu (belum login)
    viewer: viewer
      ? {
          isOwner,
          hasUpvoted: mySupports?.has(SupportType.UPVOTE) ?? false,
          hasVerified: mySupports?.has(SupportType.VERIFY) ?? false,
        }
      : null,
    distanceMeters,
    ...(report.progressUpdates && { timeline: report.progressUpdates.map(toTimelineItem) }),
  }
}

const canViewReport = (report, viewer) =>
  PUBLIC_REPORT_STATUSES.includes(report.status) ||
  viewer?.role === Role.ADMIN ||
  viewer?.id === report.reporterId

// =====================================================================
// HELPER INTERNAL
// =====================================================================

/**
 * Hitung upvote/verifikasi untuk banyak laporan sekaligus (2 query untuk satu halaman,
 * bukan 2 query per laporan), plus apa saja yang sudah di-support oleh viewer.
 */
const loadSupportInfo = async (reportIds, viewerId) => {
  const stats = new Map()
  const mine = new Map()
  if (reportIds.length === 0) return { stats, mine }

  const [grouped, mySupports] = await Promise.all([
    prisma.reportSupport.groupBy({
      by: ['reportId', 'type'],
      where: { reportId: { in: reportIds } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.reportSupport.findMany({
          where: { reportId: { in: reportIds }, userId: viewerId },
          select: { reportId: true, type: true },
        })
      : [],
  ])

  for (const row of grouped) {
    const entry = stats.get(row.reportId) ?? { upvotes: 0, verifications: 0 }
    if (row.type === SupportType.UPVOTE) entry.upvotes = row._count._all
    else entry.verifications = row._count._all
    stats.set(row.reportId, entry)
  }

  for (const row of mySupports) {
    const types = mine.get(row.reportId) ?? new Set()
    types.add(row.type)
    mine.set(row.reportId, types)
  }

  return { stats, mine }
}

/**
 * Satu halaman laporan (dipakai feed publik & laporan saya).
 * Jika center diisi, hasil disaring pasti berdasarkan jarak (kotak kasar sudah ada di `where`).
 */
const findReportPage = async ({ where, cursor, limit, viewer, center = null, radiusM = null }) => {
  const rows = await prisma.report.findMany({
    where,
    select: REPORT_SELECT,
    orderBy: { id: 'desc' }, // id selalu naik, jadi id desc = terbaru dulu dan cursor stabil
    ...cursorArgs(cursor, limit),
  })
  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)

  // nextCursor dihitung dari baris yang DIAMBIL, sebelum disaring jarak.
  // Akibatnya halaman bisa sedikit kurang dari `limit`, tapi tidak ada laporan yang terlewat.
  const visible = items
    .map((report) => ({
      report,
      distanceMeters: center ? distanceInMeters(center, report) : null,
    }))
    .filter(({ distanceMeters }) => distanceMeters === null || distanceMeters <= radiusM)

  const { stats, mine } = await loadSupportInfo(
    visible.map(({ report }) => report.id),
    viewer?.id,
  )

  return {
    items: visible.map(({ report, distanceMeters }) =>
      toReportDto(report, { viewer, stats, mine, distanceMeters }),
    ),
    meta: { limit, hasMore, nextCursor },
  }
}

// ---- Kode tracking -------------------------------------------------------

const MAX_CODE_ATTEMPTS = 3

const generateTrackingCode = async () => {
  const prefix = buildTrackingPrefix()
  const last = await prisma.report.findFirst({
    where: { trackingCode: { startsWith: `${prefix}-` } },
    orderBy: { id: 'desc' },
    select: { trackingCode: true },
  })
  return formatTrackingCode(prefix, last ? parseTrackingSequence(last.trackingCode) + 1 : 1)
}

/**
 * Jalankan `create(trackingCode)`. Jika dua laporan dibuat bersamaan dan mendapat nomor yang sama,
 * constraint unique di database menolak salah satunya (P2002) dan kita coba lagi dengan nomor baru.
 */
const createWithTrackingCode = async (create) => {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    const trackingCode = await generateTrackingCode()
    try {
      return await create(trackingCode)
    } catch (error) {
      const isLastAttempt = attempt === MAX_CODE_ATTEMPTS
      if (error.code !== 'P2002' || isLastAttempt) throw error
    }
  }
}

// ---- Validasi relasi saat membuat laporan ---------------------------------

/** Menentukan instansi tujuan dari pilihan user (subjenis dan/atau instansi). */
const resolveAgencyId = async ({ subcategoryId, agencyId }) => {
  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, agency: { isActive: true } },
      select: { agencyId: true },
    })
    if (!subcategory) throw AppError.badRequest('Subjenis tidak ditemukan')
    if (agencyId && agencyId !== subcategory.agencyId) {
      throw AppError.badRequest('Subjenis tidak termasuk dalam instansi yang dipilih')
    }
    return subcategory.agencyId
  }

  const agency = await prisma.agency.findFirst({
    where: { id: agencyId, isActive: true },
    select: { id: true },
  })
  if (!agency) throw AppError.badRequest('Instansi tidak ditemukan')
  return agency.id
}

const assertDistrictExists = async (districtId) => {
  const district = await prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
  if (!district) throw AppError.badRequest('Kecamatan tidak ditemukan')
}

// =====================================================================
// FUNGSI PUBLIK (dipanggil controller)
// =====================================================================

export const createReport = async ({ reporter, data, files }) => {
  if (!files?.length) throw AppError.badRequest('Minimal unggah 1 foto laporan')

  const agencyId = await resolveAgencyId(data)
  if (data.districtId) await assertDistrictExists(data.districtId)

  const photoUrls = files.map((file) => toPublicUrl(UPLOAD.REPORT_PHOTOS.FOLDER, file.filename))

  // Satu create bersarang = satu transaksi: laporan, foto, follower, dan timeline awal
  // berhasil semua atau gagal semua.
  const report = await createWithTrackingCode((trackingCode) =>
    prisma.report.create({
      data: {
        trackingCode,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        isAnonymous: data.isAnonymous,
        reporterId: reporter.id,
        subcategoryId: data.subcategoryId,
        districtId: data.districtId,
        agencyId,
        photos: { create: photoUrls.map((url) => ({ url })) },
        // Pelapor otomatis mengikuti laporannya sendiri (dasar notifikasi per laporan).
        followers: { create: { userId: reporter.id } },
        progressUpdates: {
          create: {
            actorId: reporter.id,
            toStatus: ReportStatus.MENUNGGU_VERIFIKASI,
            note: 'Laporan diterima dan menunggu verifikasi admin.',
          },
        },
      },
      select: REPORT_DETAIL_SELECT,
    }),
  )

  return toReportDto(report, { viewer: reporter })
}

/** Feed publik: terbaru dulu, bisa disaring, dan bisa dibatasi radius dari lokasi user. */
export const listPublicReports = ({ query, viewer }) => {
  const { cursor, limit, status, subcategoryId, agencyId, districtId, q, lat, lng, radius } = query

  const center = lat !== undefined ? { latitude: lat, longitude: lng } : null
  const radiusM = radius ?? GEO.DEFAULT_RADIUS_M
  const box = center && boundingBox(center, radiusM)

  const where = {
    mergedIntoId: null, // laporan duplikat yang sudah digabung tidak ditampilkan lagi
    status: status ?? { in: PUBLIC_REPORT_STATUSES },
    ...(subcategoryId && { subcategoryId }),
    ...(agencyId && { agencyId }),
    ...(districtId && { districtId }),
    ...(box && {
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
    }),
    // Cari kode tracking atau kata kunci. (MySQL: pencarian "contains" tidak peka huruf besar/kecil.)
    ...(q && {
      OR: [
        { trackingCode: { contains: q } },
        { description: { contains: q } },
        { address: { contains: q } },
      ],
    }),
  }

  return findReportPage({ where, cursor, limit, viewer, center, radiusM })
}

/** Laporan milik user yang sedang login (semua status, termasuk yang anonim). */
export const listMyReports = ({ query, viewer }) => {
  const { cursor, limit, status } = query

  return findReportPage({
    where: { reporterId: viewer.id, ...(status && { status }) },
    cursor,
    limit,
    viewer,
  })
}

export const getReportById = async ({ id, viewer }) => {
  const report = await prisma.report.findUnique({ where: { id }, select: REPORT_DETAIL_SELECT })

  // 404 (bukan 403) untuk laporan yang belum boleh dilihat, supaya keberadaannya tidak bocor.
  if (!report || !canViewReport(report, viewer)) throw AppError.notFound('Laporan tidak ditemukan')

  const { stats, mine } = await loadSupportInfo([id], viewer?.id)
  return toReportDto(report, { viewer, stats, mine })
}
