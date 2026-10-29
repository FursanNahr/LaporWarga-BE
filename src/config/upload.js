// import fs from 'node:fs'
// import path from 'node:path'
// import { randomUUID } from 'node:crypto'
// import multer from 'multer'
// import { UPLOAD } from './constants.js'
// import { AppError } from '../utils/AppError.js'

// // Ekstensi ditentukan dari mimetype, BUKAN dari nama file asli (nama asli bisa dipalsukan).
// const ALLOWED_TYPES = {
//   'image/jpeg': '.jpg',
//   'image/png': '.png',
//   'image/webp': '.webp',
// }

// /**
//  * Membuat instance multer untuk upload gambar ke uploads/<folder>.
//  * Pasang per-route lewat src/middlewares/upload.js.
//  */
// export const createImageUploader = ({ folder, maxSizeMB }) => {
//   const destination = path.join(UPLOAD.ROOT_DIR, folder)
//   fs.mkdirSync(destination, { recursive: true })

//   return multer({
//     storage: multer.diskStorage({
//       destination: (req, file, cb) => cb(null, destination),
//       filename: (req, file, cb) => {
//         cb(null, `${Date.now()}-${randomUUID()}${ALLOWED_TYPES[file.mimetype]}`)
//       },
//     }),
//     fileFilter: (req, file, cb) => {
//       if (ALLOWED_TYPES[file.mimetype]) return cb(null, true)
//       cb(AppError.badRequest('Format foto harus JPG, PNG, atau WEBP'))
//     },
//     limits: { fileSize: maxSizeMB * 1024 * 1024 },
//   })
// }

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { UPLOAD } from './constants.js'
import { AppError } from '../utils/AppError.js'

// Ekstensi ditentukan dari mimetype, BUKAN dari nama file asli (nama asli bisa dipalsukan).
export const IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export const DOCUMENT_TYPES = {
  'application/pdf': '.pdf',
}

/**
 * Membuat instance multer yang menyimpan file ke uploads/<folder>.
 * Pasang per-route lewat src/middlewares/upload.js.
 *
 * - allowedTypes        : tipe yang diizinkan (default untuk semua field)
 * - allowedTypesByField : pengecualian per nama field, misalnya field "documents" boleh PDF
 * - maxFiles            : batas total file dalam satu request (opsional)
 */
export const createUploader = ({
  folder,
  maxSizeMB,
  maxFiles,
  allowedTypes,
  allowedTypesByField = {},
  message = 'Format file tidak didukung',
}) => {
  const destination = path.join(UPLOAD.ROOT_DIR, folder)
  fs.mkdirSync(destination, { recursive: true })

  const typesFor = (file) => allowedTypesByField[file.fieldname] ?? allowedTypes

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, destination),
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${randomUUID()}${typesFor(file)[file.mimetype]}`)
      },
    }),
    fileFilter: (req, file, cb) => {
      if (typesFor(file)[file.mimetype]) return cb(null, true)
      cb(AppError.badRequest(message))
    },
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
      ...(maxFiles && { files: maxFiles }),
    },
  })
}

/** Uploader khusus gambar (foto laporan, avatar, dst). */
export const createImageUploader = ({ folder, maxSizeMB }) =>
  createUploader({
    folder,
    maxSizeMB,
    allowedTypes: IMAGE_TYPES,
    message: 'Format foto harus JPG, PNG, atau WEBP',
  })
