import { AppError } from '../utils/AppError.js'

export const notFound = (req, res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} tidak ditemukan`))
}
