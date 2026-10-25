import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { extractBearerToken } from '../utils/jwt.js'
import { getUserFromToken } from '../services/auth.service.js'

/**
 * Untuk endpoint publik yang hasilnya sedikit berbeda jika user login
 * (contoh: penanda "sudah saya upvote"). Tanpa header Authorization = tamu.
 * Header yang ada tapi salah/kedaluwarsa tetap ditolak, supaya tidak membingungkan frontend.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  if (!req.headers.authorization) return next()

  const token = extractBearerToken(req)
  if (!token) throw AppError.unauthorized('Format header Authorization tidak valid')

  req.user = await getUserFromToken(token)
  next()
})
