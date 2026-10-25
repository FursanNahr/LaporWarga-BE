import { createImageUploader } from '../config/upload.js'
import { UPLOAD } from '../config/constants.js'

// Satu uploader per kebutuhan. Nama field di form-data harus sama dengan nama di sini.
// Tambah uploader baru (avatar, foto progress, foto komentar) dengan pola yang sama.

const reportPhotos = createImageUploader({
  folder: UPLOAD.REPORT_PHOTOS.FOLDER,
  maxSizeMB: UPLOAD.REPORT_PHOTOS.MAX_SIZE_MB,
})

export const uploadReportPhotos = reportPhotos.array('photos', UPLOAD.REPORT_PHOTOS.MAX_FILES)
