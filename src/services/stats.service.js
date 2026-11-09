import { ReportStatus, Role } from '@prisma/client'
import prisma from '../config/prisma.js'
import { AGENCY_SLA_STAGES, DASHBOARD, SLA } from '../config/constants.js'
import {
  average,
  cached,
  dateFilter,
  daysBetween,
  hoursBetween,
  isStreakActive,
  percent,
  resolveRange,
  round,
  sum,
} from '../utils/statsHelpers.js'

// Statistik performa untuk semua peran. Semua publik (prinsip transparansi), jadi:
//  - laporan anonim tidak pernah dihitung ke profil warga mana pun,
//  - laporan duplikat yang sudah digabung (mergedIntoId != null) tidak dihitung,
//  - hanya data agregat dan nama akun yang keluar, tidak ada email.

const CACHE_TTL_MS = 60 * 1000
const key = (name, query = {}) => `${name}:${JSON.stringify(query)}`
const countBy = (rows, field) => new Map(rows.map((row) => [row[field], row._count._all]))

const STAGE = ReportStatus

// ---------------------------------------------------------------------
// Penunjang
// ---------------------------------------------------------------------

/** Batas hari per tahap: dari tabel SlaSetting, cadangan SLA.DEFAULT_DAYS. */
async function loadSlaDays() {
  const rows = await prisma.slaSetting.findMany()
  const byStage = Object.fromEntries(rows.map((row) => [row.stage, row.maxDays]))
  return (stage) => byStage[stage] ?? SLA.DEFAULT_DAYS[stage]
}

/** Batas penanganan instansi = jumlah SLA tahap Diteruskan + Dalam penanganan. */
const agencyWindowDays = (slaDays) => AGENCY_SLA_STAGES.reduce((total, stage) => total + slaDays(stage), 0)

/**
 * Laporan SELESAI beserta lama penanganannya (hari), dihitung sejak pertama kali DITERUSKAN
 * ke instansi (cadangan: sejak laporan dibuat) sampai resolvedAt. Verifikasi admin tidak ikut dihitung
 * karena itu tanggung jawab admin, bukan instansi.
 */
async function loadHandled(where) {
  const rows = await prisma.report.findMany({
    where: { ...where, status: STAGE.SELESAI, resolvedAt: { not: null } },
    orderBy: { resolvedAt: 'desc' },
    take: DASHBOARD.RESOLVED_SAMPLE,
    select: {
      agencyId: true,
      createdAt: true,
      resolvedAt: true,
      progressUpdates: {
        where: { toStatus: STAGE.DITERUSKAN },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  })

  return rows.map((row) => ({
    agencyId: row.agencyId,
    days: Math.max(0, daysBetween(row.progressUpdates[0]?.createdAt ?? row.createdAt, row.resolvedAt)),
  }))
}

const summarizeHandled = (handled, windowDays) => ({
  avgDays: round(average(handled.map((item) => item.days))),
  onTimePercent: percent(handled.filter((item) => item.days <= windowDays).length, handled.length),
})

// ---------------------------------------------------------------------
// Ringkasan beranda (StatsBar)
// ---------------------------------------------------------------------

export const getOverview = () =>
  cached(key('overview'), CACHE_TTL_MS, async () => {
    const range = resolveRange({ range: 'bulan-ini' })
    const monthWhere = { mergedIntoId: null, createdAt: dateFilter(range) }

    const [totalThisMonth, handled, slaDays, topDistrictRow] = await Promise.all([
      prisma.report.count({ where: monthWhere }),
      loadHandled({ mergedIntoId: null }),
      loadSlaDays(),
      prisma.report.groupBy({
        by: ['districtId'],
        where: { ...monthWhere, districtId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { districtId: 'desc' } },
        take: 1,
      }),
    ])

    const district = topDistrictRow[0]
      ? await prisma.district.findUnique({
          where: { id: topDistrictRow[0].districtId },
          select: { id: true, name: true },
        })
      : null

    return {
      totalThisMonth,
      onTimePercent: summarizeHandled(handled, agencyWindowDays(slaDays)).onTimePercent,
      topDistrict: district ? { ...district, total: topDistrictRow[0]._count._all } : null,
    }
  })

// ---------------------------------------------------------------------
// Warga
// ---------------------------------------------------------------------

async function loadLeaders(range, limit) {
  const created = dateFilter(range)
  const ownReports = { isAnonymous: false, mergedIntoId: null, createdAt: created }

  const users = await prisma.user.findMany({
    where: { role: Role.WARGA, isActive: true },
    orderBy: [{ points: 'desc' }, { streakCount: 'desc' }, { id: 'asc' }],
    take: limit,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      points: true,
      streakCount: true,
      lastContributionDate: true,
      badges: {
        orderBy: { earnedAt: 'desc' },
        take: 3,
        select: { badge: { select: { code: true, name: true, iconUrl: true } } },
      },
      _count: {
        select: {
          reports: { where: ownReports },
          supports: { where: { createdAt: created } },
          // Komentar di laporan anonim tidak dihitung: pelapor bisa terbuka identitasnya lewat angka ini.
          comments: { where: { createdAt: created, isHidden: false, report: { isAnonymous: false } } },
        },
      },
    },
  })

  const ids = users.map((user) => user.id)
  const [resolvedRows, disputedRows] = ids.length
    ? await Promise.all([
        prisma.report.groupBy({
          by: ['reporterId'],
          where: { ...ownReports, reporterId: { in: ids }, status: STAGE.SELESAI },
          _count: { _all: true },
        }),
        prisma.report.groupBy({
          by: ['reporterId'],
          where: { ...ownReports, reporterId: { in: ids }, reopenCount: { gt: 0 } },
          _count: { _all: true },
        }),
      ])
    : [[], []]
  const resolved = countBy(resolvedRows, 'reporterId')
  const disputed = countBy(disputedRows, 'reporterId')

  return users.map((user, index) => ({
    rank: index + 1,
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    points: user.points,
    streak: isStreakActive(user.lastContributionDate) ? user.streakCount : 0,
    badges: user.badges.map((item) => item.badge),
    reports: user._count.reports,
    resolved: resolved.get(user.id) ?? 0,
    disputed: disputed.get(user.id) ?? 0,
    supports: user._count.supports,
    comments: user._count.comments,
  }))
}

export const getCitizenStats = (query) =>
  cached(key('citizens', query), CACHE_TTL_MS, async () => {
    const range = resolveRange(query)
    const created = dateFilter(range)
    const reportWhere = { mergedIntoId: null, createdAt: created }

    const [activeCitizens, reports, disputed, supports, comments, confirmations, leaders] = await Promise.all([
      prisma.user.count({ where: { role: Role.WARGA, isActive: true } }),
      prisma.report.count({ where: reportWhere }),
      prisma.report.count({ where: { ...reportWhere, reopenCount: { gt: 0 } } }),
      prisma.reportSupport.groupBy({ by: ['type'], where: { createdAt: created }, _count: { _all: true } }),
      prisma.comment.count({ where: { createdAt: created, isHidden: false } }),
      prisma.confirmation.groupBy({ by: ['result'], where: { createdAt: created }, _count: { _all: true } }),
      loadLeaders(range, query.limit),
    ])

    const supportMap = countBy(supports, 'type')
    const confirmationMap = countBy(confirmations, 'result')

    return {
      range,
      summary: {
        activeCitizens,
        reports,
        disputed,
        upvotes: supportMap.get('UPVOTE') ?? 0,
        verifications: supportMap.get('VERIFY') ?? 0,
        comments,
        confirmedDone: confirmationMap.get('SUDAH_BERES') ?? 0,
        confirmedNotDone: confirmationMap.get('BELUM_BERES') ?? 0,
      },
      leaders,
    }
  })

// ---------------------------------------------------------------------
// Instansi
// ---------------------------------------------------------------------

async function loadStaff(range, limit) {
  const where = { actor: { role: Role.INSTANSI }, createdAt: dateFilter(range) }
  const [updates, finished] = await Promise.all([
    prisma.progressUpdate.groupBy({ by: ['actorId'], where, _count: { _all: true } }),
    prisma.progressUpdate.groupBy({
      by: ['actorId'],
      where: { ...where, toStatus: STAGE.SELESAI },
      _count: { _all: true },
    }),
  ])

  const top = [...updates].sort((a, b) => b._count._all - a._count._all).slice(0, limit)
  if (!top.length) return []

  const users = await prisma.user.findMany({
    where: { id: { in: top.map((row) => row.actorId) } },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      isAgencyHead: true,
      agency: { select: { id: true, name: true } },
    },
  })
  const userMap = new Map(users.map((user) => [user.id, user]))
  const finishedMap = countBy(finished, 'actorId')

  return top.map((row) => ({
    ...userMap.get(row.actorId),
    updates: row._count._all,
    resolved: finishedMap.get(row.actorId) ?? 0,
  }))
}

export const getAgencyStats = (query) =>
  cached(key('agencies', query), CACHE_TTL_MS, async () => {
    const range = resolveRange(query)
    const where = { mergedIntoId: null, createdAt: dateFilter(range), agencyId: { not: null } }

    const [agencies, byStatus, overdueRows, disputedRows, handled, slaDays, staff] = await Promise.all([
      prisma.agency.findMany({ select: { id: true, name: true, isActive: true }, orderBy: { name: 'asc' } }),
      prisma.report.groupBy({ by: ['agencyId', 'status'], where, _count: { _all: true } }),
      prisma.report.groupBy({
        by: ['agencyId'],
        where: { ...where, isOverdue: true, status: { in: AGENCY_SLA_STAGES } }, // yang sudah selesai tidak dihitung
        _count: { _all: true },
      }),
      prisma.report.groupBy({
        by: ['agencyId'],
        where: { ...where, reopenCount: { gt: 0 } },
        _count: { _all: true },
      }),
      loadHandled(where),
      loadSlaDays(),
      loadStaff(range, query.limit),
    ])

    const windowDays = agencyWindowDays(slaDays)
    const overdue = countBy(overdueRows, 'agencyId')
    const disputed = countBy(disputedRows, 'agencyId')

    const totals = new Map()
    for (const row of byStatus) {
      const entry = totals.get(row.agencyId) ?? { total: 0, resolved: 0 }
      entry.total += row._count._all
      if (row.status === STAGE.SELESAI) entry.resolved += row._count._all
      totals.set(row.agencyId, entry)
    }

    const handledByAgency = new Map()
    for (const item of handled) {
      handledByAgency.set(item.agencyId, [...(handledByAgency.get(item.agencyId) ?? []), item])
    }

    const rows = agencies
      .map((agency) => {
        const { total, resolved } = totals.get(agency.id) ?? { total: 0, resolved: 0 }
        return {
          ...agency,
          total,
          resolved,
          resolvedPercent: percent(resolved, total),
          overdue: overdue.get(agency.id) ?? 0,
          disputed: disputed.get(agency.id) ?? 0,
          ...summarizeHandled(handledByAgency.get(agency.id) ?? [], windowDays),
        }
      })
      .filter((agency) => agency.isActive || agency.total > 0)
      .sort((a, b) => b.total - a.total)

    const totalReports = sum(rows, 'total')
    const resolvedReports = sum(rows, 'resolved')

    return {
      range,
      slaWindowDays: windowDays,
      summary: {
        totalReports,
        resolved: resolvedReports,
        resolvedPercent: percent(resolvedReports, totalReports),
        overdue: sum(rows, 'overdue'),
        disputed: sum(rows, 'disputed'),
        ...summarizeHandled(handled, windowDays),
      },
      agencies: rows,
      staff,
    }
  })

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------

// Aksi AuditLog yang dihitung per admin (daftar lengkap ada di /admin/audit-logs/actions).
const AUDIT = { MERGED: 'REPORT_MERGED', HIDDEN: 'COMMENT_HIDDEN', UNHIDDEN: 'COMMENT_UNHIDDEN' }

export const getAdminStats = (query) =>
  cached(key('admins', query), CACHE_TTL_MS, async () => {
    const range = resolveRange(query)
    const created = dateFilter(range)
    const actor = { role: Role.ADMIN }
    const waiting = { mergedIntoId: null, status: STAGE.MENUNGGU_VERIFIKASI }

    const [admins, decisions, auditRows, pending, pendingOverdue, verifications, slaDays] = await Promise.all([
      prisma.user.findMany({
        where: { role: Role.ADMIN },
        select: { id: true, name: true, avatarUrl: true, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.progressUpdate.groupBy({
        by: ['actorId', 'toStatus'],
        where: {
          actor,
          createdAt: created,
          toStatus: { in: [STAGE.TERVERIFIKASI, STAGE.DITOLAK, STAGE.DITERUSKAN] },
        },
        _count: { _all: true },
      }),
      prisma.auditLog.groupBy({ by: ['actorId', 'action'], where: { actor, createdAt: created }, _count: { _all: true } }),
      prisma.report.count({ where: waiting }),
      prisma.report.count({ where: { ...waiting, isOverdue: true } }),
      // Waktu verifikasi = dari laporan dibuat sampai keputusan pertama (valid atau ditolak).
      prisma.progressUpdate.findMany({
        where: {
          actor,
          createdAt: created,
          fromStatus: STAGE.MENUNGGU_VERIFIKASI,
          toStatus: { in: [STAGE.TERVERIFIKASI, STAGE.DITOLAK] },
        },
        orderBy: { createdAt: 'desc' },
        take: DASHBOARD.RESOLVED_SAMPLE,
        select: { actorId: true, createdAt: true, report: { select: { createdAt: true } } },
      }),
      loadSlaDays(),
    ])

    const perAdmin = new Map(
      admins.map((admin) => [
        admin.id,
        { ...admin, valid: 0, rejected: 0, forwarded: 0, merged: 0, hidden: 0, unhidden: 0, actions: 0, hours: [] },
      ]),
    )

    // TERUSKAN dari "Menunggu verifikasi" mencatat TERVERIFIKASI lalu DITERUSKAN,
    // jadi "valid" = laporan yang dinyatakan valid, termasuk yang langsung diteruskan.
    for (const row of decisions) {
      const entry = perAdmin.get(row.actorId)
      if (!entry) continue
      if (row.toStatus === STAGE.TERVERIFIKASI) entry.valid += row._count._all
      if (row.toStatus === STAGE.DITOLAK) entry.rejected += row._count._all
      if (row.toStatus === STAGE.DITERUSKAN) entry.forwarded += row._count._all
    }
    for (const row of auditRows) {
      const entry = perAdmin.get(row.actorId)
      if (!entry) continue
      entry.actions += row._count._all
      if (row.action === AUDIT.MERGED) entry.merged += row._count._all
      if (row.action === AUDIT.HIDDEN) entry.hidden += row._count._all
      if (row.action === AUDIT.UNHIDDEN) entry.unhidden += row._count._all
    }

    const allHours = []
    for (const row of verifications) {
      const hours = Math.max(0, hoursBetween(row.report.createdAt, row.createdAt))
      perAdmin.get(row.actorId)?.hours.push(hours)
      allHours.push(hours)
    }

    const rows = [...perAdmin.values()]
      .map(({ hours, ...admin }) => ({
        ...admin,
        decisions: admin.valid + admin.rejected,
        avgVerificationHours: round(average(hours)),
      }))
      .filter((admin) => admin.isActive || admin.actions > 0)
      .sort((a, b) => b.decisions - a.decisions || b.actions - a.actions)

    const verificationSlaDays = slaDays(STAGE.MENUNGGU_VERIFIKASI)

    return {
      range,
      summary: {
        pending,
        pendingOverdue,
        valid: sum(rows, 'valid'),
        rejected: sum(rows, 'rejected'),
        forwarded: sum(rows, 'forwarded'),
        merged: sum(rows, 'merged'),
        hidden: sum(rows, 'hidden'),
        avgVerificationHours: round(average(allHours)),
        withinSlaPercent: percent(allHours.filter((hours) => hours <= verificationSlaDays * 24).length, allHours.length),
        verificationSlaDays,
      },
      admins: rows,
    }
  })