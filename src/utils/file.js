import { UPLOAD } from '../config/constants.js'
import { cloudinary } from '../config/upload.js'

/** URL publik yang disimpan di database. Dari Cloudinary, filename sudah berupa URL penuh. */
export const toPublicUrl = (folder, filename) =>
  filename.startsWith('http') ? filename : `${UPLOAD.PUBLIC_PATH}/${folder}/${filename}`

/** Kumpulkan semua file hasil multer (single / array / fields) dari satu request. */
export const collectUploadedFiles = (req) => {
  const files = []
  if (req.file) files.push(req.file)
  if (Array.isArray(req.files)) files.push(...req.files)
  else if (req.files) files.push(...Object.values(req.files).flat())
  return files
}

export const deleteFiles = async (files) => {
  await Promise.allSettled(
    files.map((file) =>
      cloudinary.uploader.destroy(file.path, { resource_type: file.resourceType }),
    ),
  )
}

/** Hapus file dari daftar URL Cloudinary. URL lain diabaikan. */
export const deleteByPublicUrls = async (urls) => {
  // https://res.cloudinary.com/<cloud>/<image|video|raw>/upload/v123/laporwarga/reports/abc.jpg
  const pattern = /res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/
  const targets = urls
    .map((url) => url.match(pattern))
    .filter(Boolean)
    .map(([, resourceType, rest]) => ({
      resourceType,
      // raw menyimpan ekstensi di public_id, image/video tidak
      publicId: resourceType === 'raw' ? rest : rest.replace(/\.[^/.]+$/, ''),
    }))
  await Promise.allSettled(
    targets.map((t) =>
      cloudinary.uploader.destroy(t.publicId, { resource_type: t.resourceType }),
    ),
  )
}