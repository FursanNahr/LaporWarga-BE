import { SupportType } from '@prisma/client'
import prisma from '../config/prisma.js'
import { PUBLIC_REPORT_STATUSES } from '../config/constants.js'
import { AppError } from '../utils/AppError.js'

// Slug di URL -> nilai enum di database.
const TYPE_BY_SLUG = {
  upvote: SupportType.UPVOTE,
  verify: SupportType.VERIFY,
}

const toSupportType = (slug) => {
  const type = TYPE_BY_SLUG[slug]
  if (!type) throw AppError.badRequest('Jenis dukungan tidak dikenal')
  return type
}

/**
 * Angka dukungan terbaru satu laporan + apa saja yang sudah diberikan user ini.
 * Dikirim balik ke client supaya kartu di feed bisa langsung menyesuaikan diri.
 */
const buildSupportState = async (reportId, userId) => {
  const [grouped, mine] = await Promise.all([
    prisma.reportSupport.groupBy({
      by: ['type'],
      where: { reportId },
      _count: { _all: true },
    }),
    prisma.reportSupport.findMany({
      where: { reportId, userId },
      select: { type: true },
    }),
  ])

  const countOf = (type) => grouped.find((row) => row.type === type)?._count._all ?? 0
  const mySupports = new Set(mine.map((row) => row.type))

  return {
    stats: {
      upvotes: countOf(SupportType.UPVOTE),
      verifications: countOf(SupportType.VERIFY),
    },
    viewer: {
      hasUpvoted: mySupports.has(SupportType.UPVOTE),
      hasVerified: mySupports.has(SupportType.VERIFY),
    },
  }
}

/**
 * Beri dukungan / verifikasi.
 * Idempoten: mengulang aksi yang sama tidak error (createMany + skipDuplicates memanfaatkan
 * unique [reportId, userId, type], dan aman kalau dua request datang bersamaan).
 */
export const addSupport = async ({ reportId, type, viewer }) => {
  const supportType = toSupportType(type)

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { status: true, reporterId: true, mergedIntoId: true },
  })

  // 404 (bukan 403) untuk laporan yang belum publik atau sudah digabung, sama seperti halaman detail.
  if (!report || report.mergedIntoId !== null || !PUBLIC_REPORT_STATUSES.includes(report.status)) {
    throw AppError.notFound('Laporan tidak ditemukan')
  }
  if (report.reporterId === viewer.id) {
    throw AppError.forbidden('Anda tidak dapat mendukung laporan sendiri')
  }

  await prisma.reportSupport.createMany({
    data: [{ reportId, userId: viewer.id, type: supportType }],
    skipDuplicates: true,
  })

  return buildSupportState(reportId, viewer.id)
}

/**
 * Cabut dukungan / verifikasi. Idempoten juga: kalau belum pernah mendukung, tidak error.
 * Status laporan tidak dicek, supaya user tetap bisa mencabut dukungan di laporan yang statusnya berubah.
 */
export const removeSupport = async ({ reportId, type, viewer }) => {
  const supportType = toSupportType(type)

  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true } })
  if (!report) throw AppError.notFound('Laporan tidak ditemukan')

  await prisma.reportSupport.deleteMany({
    where: { reportId, userId: viewer.id, type: supportType },
  })

  return buildSupportState(reportId, viewer.id)
}
