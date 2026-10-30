import { ReportStatus } from '@prisma/client'
import prisma from '../config/prisma.js'
import { DASHBOARD } from '../config/constants.js'
import { DAY_MS, lastDays, startOfZoneDay, startOfZoneMonth, toZoneDate } from '../utils/date.js'

const average = (values) =>
  values.length > 0
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : null

const resolutionDays = ({ createdAt, resolvedAt }) => (resolvedAt - createdAt) / DAY_MS

/**
 * Ringkasan untuk dashboard admin. Laporan hasil gabungan (duplikat) tidak dihitung.
 * Rata-rata hari penanganan dihitung dari laporan selesai terbaru (batas DASHBOARD.RESOLVED_SAMPLE).
 */
export const getDashboard = async () => {
  const now = new Date()
  const live = { mergedIntoId: null }
  const trendDates = lastDays(DASHBOARD.TREND_DAYS, now)

  const [
    statusRows,
    overdue,
    thisMonth,
    disputed,
    agencyStatusRows,
    agencyOverdueRows,
    agencies,
    resolvedRows,
    districtRows,
    overdueReports,
    trendRows,
  ] = await Promise.all([
    prisma.report.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
    prisma.report.count({ where: { ...live, isOverdue: true } }),
    prisma.report.count({ where: { ...live, createdAt: { gte: startOfZoneMonth(now) } } }),
    prisma.report.count({ where: { ...live, reopenCount: { gt: 0 } } }),
    prisma.report.groupBy({
      by: ['agencyId', 'status'],
      where: { ...live, agencyId: { not: null } },
      _count: { _all: true },
    }),
    prisma.report.groupBy({
      by: ['agencyId'],
      where: { ...live, agencyId: { not: null }, isOverdue: true },
      _count: { _all: true },
    }),
    prisma.agency.findMany({ select: { id: true, name: true, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.report.findMany({
      where: { ...live, status: ReportStatus.SELESAI, resolvedAt: { not: null } },
      select: { agencyId: true, createdAt: true, resolvedAt: true },
      orderBy: { id: 'desc' },
      take: DASHBOARD.RESOLVED_SAMPLE,
    }),
    prisma.report.groupBy({
      by: ['districtId'],
      where: { ...live, districtId: { not: null } },
      _count: { _all: true },
    }),
    prisma.report.findMany({
      where: { ...live, isOverdue: true },
      orderBy: { slaDueAt: 'asc' }, // yang paling lama terlewat di atas
      take: DASHBOARD.OVERDUE_LIST,
      select: {
        id: true,
        trackingCode: true,
        status: true,
        slaDueAt: true,
        escalatedAt: true,
        agency: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
      },
    }),
    prisma.report.findMany({
      where: { ...live, createdAt: { gte: startOfZoneDay(trendDates[0]) } },
      select: { createdAt: true },
      take: 20000,
    }),
  ])

  // ---- Per status (semua status selalu ada, nilainya 0 jika kosong) ----
  const byStatus = Object.fromEntries(Object.values(ReportStatus).map((status) => [status, 0]))
  for (const row of statusRows) byStatus[row.status] = row._count._all
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)

  // ---- Per instansi ----
  const agencyStats = new Map(
    agencies.map((agency) => [
      agency.id,
      { ...agency, total: 0, resolved: 0, overdue: 0, avgResolutionDays: null },
    ]),
  )
  for (const row of agencyStatusRows) {
    const entry = agencyStats.get(row.agencyId)
    if (!entry) continue
    entry.total += row._count._all
    if (row.status === ReportStatus.SELESAI) entry.resolved += row._count._all
  }
  for (const row of agencyOverdueRows) {
    const entry = agencyStats.get(row.agencyId)
    if (entry) entry.overdue = row._count._all
  }
  for (const entry of agencyStats.values()) {
    entry.avgResolutionDays = average(
      resolvedRows.filter((row) => row.agencyId === entry.id).map(resolutionDays),
    )
  }

  // ---- Kecamatan terbanyak dilaporkan ----
  const topDistrictRows = districtRows
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, DASHBOARD.TOP_DISTRICTS)
  const districtNames = topDistrictRows.length
    ? new Map(
        (
          await prisma.district.findMany({
            where: { id: { in: topDistrictRows.map((row) => row.districtId) } },
            select: { id: true, name: true },
          })
        ).map((district) => [district.id, district.name]),
      )
    : new Map()

  // ---- Tren harian (per tanggal WIB) ----
  const perDay = new Map(trendDates.map((date) => [date, 0]))
  for (const { createdAt } of trendRows) {
    const key = toZoneDate(createdAt)
    if (perDay.has(key)) perDay.set(key, perDay.get(key) + 1)
  }

  return {
    totals: {
      reports: total,
      thisMonth,
      pendingVerification: byStatus[ReportStatus.MENUNGGU_VERIFIKASI],
      resolved: byStatus[ReportStatus.SELESAI],
      rejected: byStatus[ReportStatus.DITOLAK],
      overdue,
      disputed, // laporan yang pernah dibuka kembali setelah disanggah
      avgResolutionDays: average(resolvedRows.map(resolutionDays)),
    },
    byStatus,
    byAgency: [...agencyStats.values()],
    byDistrict: topDistrictRows.map((row) => ({
      id: row.districtId,
      name: districtNames.get(row.districtId) ?? '-',
      total: row._count._all,
    })),
    overdueReports: overdueReports.map((report) => ({
      ...report,
      overdueDays: report.slaDueAt
        ? Math.max(0, Math.floor((now - report.slaDueAt) / DAY_MS))
        : null,
    })),
    trend: [...perDay].map(([date, count]) => ({ date, count })),
  }
}