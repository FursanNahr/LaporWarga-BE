/**
 * Error yang "diharapkan" (salah input, tidak login, data tidak ada, dst).
 * Ditangkap oleh errorHandler dan diubah jadi response JSON yang rapi.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
    Error.captureStackTrace?.(this, this.constructor)
  }

  static badRequest(message = 'Permintaan tidak valid', details = null) {
    return new AppError(message, 400, details)
  }

  static unauthorized(message = 'Silakan login terlebih dahulu') {
    return new AppError(message, 401)
  }

  static forbidden(message = 'Anda tidak punya akses ke fitur ini') {
    return new AppError(message, 403)
  }

  static notFound(message = 'Data tidak ditemukan') {
    return new AppError(message, 404)
  }

  static conflict(message = 'Data sudah ada') {
    return new AppError(message, 409)
  }

  static validation(errors) {
    return new AppError('Data yang dikirim tidak valid', 422, errors)
  }
}
