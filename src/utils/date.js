import { TIME } from '../config/constants.js'

export const DAY_MS = 24 * 60 * 60 * 1000

/** 'YYYY-MM-DD' menurut zona waktu aplikasi (bukan zona server). */
export const toZoneDate = (date) => date.toLocaleDateString('sv-SE', { timeZone: TIME.ZONE })

/** 'YYYY-MM-DD HH:mm:ss' menurut zona waktu aplikasi, dipakai di ekspor. */
export const toZoneDateTime = (date) =>
  date ? date.toLocaleString('sv-SE', { timeZone: TIME.ZONE }) : ''

/** Cek tanggal 'YYYY-MM-DD' benar-benar ada (menolak 2026-02-31). */
export const isRealDate = (value) => {
  const [year, month, day] = value.split('-').map(Number)
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  )
}

export const startOfZoneDay = (value) => new Date(`${value}T00:00:00.000${TIME.UTC_OFFSET}`)
export const endOfZoneDay = (value) => new Date(`${value}T23:59:59.999${TIME.UTC_OFFSET}`)
export const startOfZoneMonth = (date) => startOfZoneDay(`${toZoneDate(date).slice(0, 7)}-01`)

/** Daftar tanggal 'YYYY-MM-DD' untuk N hari terakhir (termasuk hari ini), urut dari yang terlama. */
export const lastDays = (count, now = new Date()) =>
  Array.from({ length: count }, (_, i) =>
    toZoneDate(new Date(now.getTime() - (count - 1 - i) * DAY_MS)),
  )