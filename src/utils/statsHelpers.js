import { TIME } from '../config/constants.js'

// Helper bersama untuk stats.service.js (dan nanti transparency.service.js),
// supaya rumus rentang waktu, persen, dan rata-rata hanya ada satu.

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// '+07:00' -> 25200000 ms
const OFFSET_MS = (() => {
  const sign = TIME.UTC_OFFSET.startsWith('-') ? -1 : 1
  const [hours, minutes] = TIME.UTC_OFFSET.slice(1).split(':').map(Number)
  return sign * (hours * 60 + minutes) * 60 * 1000
})()

export const RANGES = ['bulan-ini', '30-hari', 'semua']

/**
 * Ubah query { range, dateFrom, dateTo } menjadi { key, from, to } (Date atau null).
 * dateFrom/dateTo (YYYY-MM-DD, zona waktu aplikasi) menang atas `range`.
 */
export function resolveRange({ range = 'semua', dateFrom, dateTo } = {}) {
  if (dateFrom || dateTo) {
    return {
      key: 'kustom',
      from: dateFrom ? new Date(`${dateFrom}T00:00:00.000${TIME.UTC_OFFSET}`) : null,
      to: dateTo ? new Date(`${dateTo}T23:59:59.999${TIME.UTC_OFFSET}`) : null,
    }
  }

  const now = Date.now()
  if (range === 'bulan-ini') {
    const local = new Date(now + OFFSET_MS)
    const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS
    return { key: range, from: new Date(start), to: null }
  }
  if (range === '30-hari') return { key: range, from: new Date(now - 30 * DAY_MS), to: null }
  return { key: 'semua', from: null, to: null }
}

/** Filter Prisma untuk kolom tanggal. Mengembalikan undefined bila tanpa batas (Prisma mengabaikannya). */
export const dateFilter = ({ from, to }) => {
  if (!from && !to) return undefined
  return { ...(from && { gte: from }), ...(to && { lte: to }) }
}

export const daysBetween = (start, end) => (end.getTime() - start.getTime()) / DAY_MS
export const hoursBetween = (start, end) => (end.getTime() - start.getTime()) / HOUR_MS

export const sum = (items, key) => items.reduce((total, item) => total + item[key], 0)
export const average = (values) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null
export const round = (value, digits = 1) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits
export const percent = (part, total) => (total ? Math.round((part / total) * 100) : null)

/** Streak dianggap masih berjalan jika kontribusi terakhir hari ini atau kemarin (zona waktu aplikasi). */
export function isStreakActive(lastContributionDate) {
  if (!lastContributionDate) return false
  const local = new Date(Date.now() + OFFSET_MS)
  const todayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return (todayStart - lastContributionDate.getTime()) / DAY_MS <= 1
}

// Cache memori sederhana: endpoint ini publik dan agregatnya berat, jadi cukup dihitung ulang tiap beberapa detik.
const store = new Map()
const MAX_CACHE_ENTRIES = 200

export async function cached(key, ttlMs, loader) {
  const hit = store.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const value = await loader()
  if (store.size >= MAX_CACHE_ENTRIES) store.clear()
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}