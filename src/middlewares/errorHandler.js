import multer from 'multer'
import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { collectUploadedFiles, deleteFiles } from '../utils/file.js'

const MULTER_ERRORS = {
  LIMIT_FILE_SIZE: [413, 'Ukuran file melebihi batas'],
  LIMIT_FILE_COUNT: [400, 'Jumlah file melebihi batas'],
  LIMIT_UNEXPECTED_FILE: [400, 'Nama field file tidak sesuai atau jumlah file melebihi batas'],
}

const PRISMA_ERRORS = {
  P2002: [409, 'Data sudah ada (duplikat)'],
  P2003: [400, 'Data terkait tidak valid'],
  P2025: [404, 'Data tidak ditemukan'],
}

/** Ubah error apa pun menjadi { statusCode, message, errors? } */
const normalizeError = (err) => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, errors: err.details }
  }

  if (err instanceof multer.MulterError) {
    const [statusCode, message] = MULTER_ERRORS[err.code] ?? [400, 'Upload file gagal']
    return { statusCode, message }
  }

  if (typeof err.code === 'string' && PRISMA_ERRORS[err.code]) {
    const [statusCode, message] = PRISMA_ERRORS[err.code]
    return { statusCode, message }
  }

  if (err.type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Format JSON tidak valid' }
  }

  if (err.type === 'entity.too.large') {
    return { statusCode: 413, message: 'Ukuran data terlalu besar' }
  }

  return { statusCode: 500, message: 'Terjadi kesalahan pada server' }
}

// Express mengenali error handler dari jumlah parameternya (harus 4).
// eslint-disable-next-line no-unused-vars
export const errorHandler = async (err, req, res, next) => {
  if (res.headersSent) return next(err)

  // Request gagal di tengah jalan: file yang sudah terlanjur tersimpan jangan dibiarkan jadi sampah.
  await deleteFiles(collectUploadedFiles(req))

  const { statusCode, message, errors } = normalizeError(err)

  if (statusCode >= 500) console.error(err)

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(!env.isProduction && statusCode >= 500 && { stack: err.stack }),
  })
}
