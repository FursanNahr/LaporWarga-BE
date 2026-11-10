import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { UPLOAD } from './constants.js'
import { AppError } from '../utils/AppError.js'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export { cloudinary }

// Ekstensi ditentukan dari mimetype, BUKAN dari nama file asli (nama asli bisa dipalsukan).
export const IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export const DOCUMENT_TYPES = {
  'application/pdf': '.pdf',
}

export const VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
}

/**
 * Storage multer yang mengirim file langsung ke Cloudinary (tanpa menyentuh disk,
 * karena filesystem Vercel read-only).
 * Hasilnya di objek file:
 *   file.filename     = URL https Cloudinary (dipakai toPublicUrl & disimpan ke database)
 *   file.path         = public_id (dipakai untuk menghapus)
 *   file.resourceType = image | video | raw
 */
class CloudinaryStorage {
  constructor(folder) {
    this.folder = `laporwarga/${folder}`
  }

  _handleFile(req, file, cb) {
    const stream = cloudinary.uploader.upload_stream(
      { folder: this.folder, public_id: randomUUID(), resource_type: 'auto' },
      (err, result) => {
        if (err) return cb(err)
        cb(null, {
          filename: result.secure_url,
          path: result.public_id,
          resourceType: result.resource_type,
          size: result.bytes,
        })
      },
    )
    file.stream.pipe(stream)
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader
      .destroy(file.path, { resource_type: file.resourceType })
      .then(() => cb(null))
      .catch(cb)
  }
}

/**
 * Membuat instance multer yang menyimpan file ke Cloudinary (folder laporwarga/<folder>).
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
  const typesFor = (file) => allowedTypesByField[file.fieldname] ?? allowedTypes

  return multer({
    storage: new CloudinaryStorage(folder),
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