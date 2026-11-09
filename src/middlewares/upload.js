import {
  createImageUploader,
  createUploader,
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  VIDEO_TYPES,
} from '../config/upload.js'
import { UPLOAD } from '../config/constants.js'

// Satu uploader per kebutuhan. Nama field di form-data harus sama dengan nama di sini.
// Tambah uploader baru (avatar, foto komentar) dengan pola yang sama.

// ---- Foto laporan (warga) ----
const reportPhotos = createImageUploader({
  folder: UPLOAD.REPORT_PHOTOS.FOLDER,
  maxSizeMB: UPLOAD.REPORT_PHOTOS.MAX_SIZE_MB,
})

export const uploadReportPhotos = reportPhotos.array('photos', UPLOAD.REPORT_PHOTOS.MAX_FILES)

// ---- Update progres (instansi) ----
// photos      : foto progres (gambar)
// afterPhotos : foto "sesudah" (gambar, hanya untuk aksi SELESAIKAN)
// documents   : berkas pendukung (PDF atau gambar)
const progressFiles = createUploader({
  folder: UPLOAD.PROGRESS_FILES.FOLDER,
  maxSizeMB: UPLOAD.PROGRESS_FILES.MAX_SIZE_MB,
  maxFiles: UPLOAD.PROGRESS_FILES.MAX_FILES,
  allowedTypes: IMAGE_TYPES,
  allowedTypesByField: { documents: { ...IMAGE_TYPES, ...DOCUMENT_TYPES } },
  message: 'Format file tidak didukung. Foto: JPG/PNG/WEBP, berkas: PDF/JPG/PNG/WEBP',
})

export const uploadProgressFiles = progressFiles.fields([
  { name: 'photos', maxCount: UPLOAD.PROGRESS_FILES.MAX_FILES },
  { name: 'afterPhotos', maxCount: UPLOAD.PROGRESS_FILES.MAX_FILES },
  { name: 'documents', maxCount: UPLOAD.PROGRESS_FILES.MAX_FILES },
])

// ---- Lampiran komentar (semua role) ----
// files : foto (JPG/PNG/WEBP) dan video (MP4/WEBM/MOV), field-nya sama.
// multer memakai batas video (terbesar); batas foto dicek ulang di comment.service.js.
const commentFiles = createUploader({
  folder: UPLOAD.COMMENT_FILES.FOLDER,
  maxSizeMB: UPLOAD.COMMENT_FILES.VIDEO_MAX_SIZE_MB,
  maxFiles: UPLOAD.COMMENT_FILES.MAX_FILES,
  allowedTypes: { ...IMAGE_TYPES, ...VIDEO_TYPES },
  message: 'Format file tidak didukung. Foto: JPG/PNG/WEBP, video: MP4/WEBM/MOV',
})

export const uploadCommentFiles = commentFiles.array('files', UPLOAD.COMMENT_FILES.MAX_FILES)