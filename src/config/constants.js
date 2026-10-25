import path from 'node:path'
import { ReportStatus } from '@prisma/client'

// Semua angka "kebijakan" dikumpulkan di sini supaya mudah diubah.

export const PAGINATION = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50,
}

export const GEO = {
  DEFAULT_RADIUS_M: 1000, // radius feed jika user mengirim lat/lng tanpa radius
  MAX_RADIUS_M: 10000,
}

export const TRACKING_CODE = {
  REGION_PREFIX: 'BDG', // ganti/tambah saat ekspansi ke luar Bandung
  SEQUENCE_LENGTH: 4,
}

export const UPLOAD = {
  ROOT_DIR: path.resolve('uploads'), // relatif terhadap folder tempat server dijalankan
  PUBLIC_PATH: '/uploads', // URL publik, lihat app.use('/uploads', ...) di app.js
  REPORT_PHOTOS: {
    FOLDER: 'reports',
    MAX_FILES: 5,
    MAX_SIZE_MB: 5,
  },
}

// Status yang boleh tampil di feed/detail publik.
// MENUNGGU_VERIFIKASI & DITOLAK hanya terlihat oleh pemilik laporan dan admin.
export const PUBLIC_REPORT_STATUSES = [
  ReportStatus.TERVERIFIKASI,
  ReportStatus.DITERUSKAN,
  ReportStatus.DALAM_PENANGANAN,
  ReportStatus.SELESAI,
]
