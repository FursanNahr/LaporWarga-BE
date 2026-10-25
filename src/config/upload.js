import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { UPLOAD } from './constants.js'
import { AppError } from '../utils/AppError.js'

// Ekstensi ditentukan dari mimetype, BUKAN dari nama file asli (nama asli bisa dipalsukan).
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

/**
 * Membuat instance multer untuk upload gambar ke uploads/<folder>.
 * Pasang per-route lewat src/middlewares/upload.js.
 */
export const createImageUploader = ({ folder, maxSizeMB }) => {
  const destination = path.join(UPLOAD.ROOT_DIR, folder)
  fs.mkdirSync(destination, { recursive: true })

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, destination),
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${randomUUID()}${ALLOWED_TYPES[file.mimetype]}`)
      },
    }),
    fileFilter: (req, file, cb) => {
      if (ALLOWED_TYPES[file.mimetype]) return cb(null, true)
      cb(AppError.badRequest('Format foto harus JPG, PNG, atau WEBP'))
    },
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  })
}
