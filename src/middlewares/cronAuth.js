import { createHash, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

// Hash dulu supaya panjang kedua sisi sama (timingSafeEqual mensyaratkan itu) dan
// perbandingannya tidak membocorkan isi rahasia lewat selisih waktu.
const digest = (value) => createHash('sha256').update(value).digest()

/**
 * Melindungi endpoint /api/cron/*. Hanya request dengan header
 * "Authorization: Bearer <CRON_SECRET>" yang lolos (Vercel Cron mengirimnya otomatis).
 */
export const cronAuth = (req, res, next) => {
  if (!env.cronSecret) {
    return next(AppError.forbidden('Endpoint cron belum aktif (CRON_SECRET belum diisi)'))
  }

  const header = req.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token || !timingSafeEqual(digest(token), digest(env.cronSecret))) {
    return next(AppError.forbidden('Tidak diizinkan'))
  }
  next()
}
