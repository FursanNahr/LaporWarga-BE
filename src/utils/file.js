import fs from 'node:fs/promises'
import path from 'node:path'
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

/** Hapus file dari daftar URL publik (/uploads/...). URL di luar folder uploads diabaikan. */
export const deleteByPublicUrls = async (urls) => {
  const prefix = `${UPLOAD.PUBLIC_PATH}/`
  const targets = urls
    .filter((url) => url.startsWith(prefix))
    .map((url) => path.join(UPLOAD.ROOT_DIR, url.slice(prefix.length)))
    .filter((target) => target.startsWith(UPLOAD.ROOT_DIR + path.sep))
  await Promise.allSettled(targets.map((target) => fs.unlink(target)))
}