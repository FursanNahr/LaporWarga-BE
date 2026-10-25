import { AppError } from '../utils/AppError.js'

/**
 * Batasi akses berdasarkan role. Harus dipasang SETELAH authenticate.
 * Contoh: router.post('/', authenticate, authorize(Role.ADMIN), handler)
 */
export const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized())
    if (!allowedRoles.includes(req.user.role)) return next(AppError.forbidden())
    next()
  }
