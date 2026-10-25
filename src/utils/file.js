import fs from 'node:fs/promises'
import { UPLOAD } from '../config/constants.js'

/** URL publik yang disimpan di database, contoh: /uploads/reports/abc.jpg */
export const toPublicUrl = (folder, filename) => `${UPLOAD.PUBLIC_PATH}/${folder}/${filename}`

/** Kumpulkan semua file hasil multer (single / array / fields) dari satu request. */
export const collectUploadedFiles = (req) => {
  const files = []
  if (req.file) files.push(req.file)
  if (Array.isArray(req.files)) files.push(...req.files)
  else if (req.files) files.push(...Object.values(req.files).flat())
  return files
}

export const deleteFiles = async (files) => {
  await Promise.allSettled(files.map((file) => fs.unlink(file.path)))
}
