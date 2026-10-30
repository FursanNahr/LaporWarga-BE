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
  AFTER_PHOTO_RADIUS_M: 100, // foto "sesudah" petugas harus diambil sedekat ini dari titik laporan
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
  // Foto progres, foto "sesudah", dan berkas pendukung dari instansi (per request: maks 5 file total)
  PROGRESS_FILES: {
    FOLDER: 'progress',
    MAX_FILES: 5,
    MAX_SIZE_MB: 10,
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

// Laporan yang tampil di daftar kerja instansi (sudah diteruskan admin).
export const AGENCY_REPORT_STATUSES = [
  ReportStatus.DITERUSKAN,
  ReportStatus.DALAM_PENANGANAN,
  ReportStatus.SELESAI,
]

// Aksi yang boleh dilakukan petugas instansi, dan perpindahan status yang diizinkan.
// Alur selalu maju satu langkah. Instansi tidak bisa menolak / mengembalikan laporan (wewenang admin).
export const INSTANSI_ACTIONS = {
  MULAI_TANGANI: { from: ReportStatus.DITERUSKAN, to: ReportStatus.DALAM_PENANGANAN },
  TAMBAH_CATATAN: { from: ReportStatus.DALAM_PENANGANAN, to: ReportStatus.DALAM_PENANGANAN },
  SELESAIKAN: { from: ReportStatus.DALAM_PENANGANAN, to: ReportStatus.SELESAI },
}

// =====================================================================
// ADMIN
// =====================================================================

// Zona waktu aplikasi. Dipakai untuk filter tanggal, tren harian, dan ekspor,
// supaya hasilnya sama di mana pun server dijalankan (WIB tidak punya DST).
export const TIME = {
  ZONE: 'Asia/Jakarta',
  UTC_OFFSET: '+07:00',
}

export const STATUS_LABEL = {
  [ReportStatus.MENUNGGU_VERIFIKASI]: 'Menunggu verifikasi',
  [ReportStatus.TERVERIFIKASI]: 'Terverifikasi',
  [ReportStatus.DITOLAK]: 'Ditolak',
  [ReportStatus.DITERUSKAN]: 'Diteruskan',
  [ReportStatus.DALAM_PENANGANAN]: 'Dalam penanganan',
  [ReportStatus.SELESAI]: 'Selesai',
}

// Aksi verifikasi oleh admin. `from` = status asal yang diizinkan, `to` = status akhir.
// TERUSKAN dari MENUNGGU_VERIFIKASI otomatis melewati TERVERIFIKASI (dua entri timeline).
export const ADMIN_ACTIONS = {
  VERIFIKASI: { from: [ReportStatus.MENUNGGU_VERIFIKASI], to: ReportStatus.TERVERIFIKASI },
  TOLAK: {
    from: [ReportStatus.MENUNGGU_VERIFIKASI, ReportStatus.TERVERIFIKASI],
    to: ReportStatus.DITOLAK,
  },
  TERUSKAN: {
    from: [ReportStatus.MENUNGGU_VERIFIKASI, ReportStatus.TERVERIFIKASI],
    to: ReportStatus.DITERUSKAN,
  },
}

// Tahap yang punya batas waktu (SLA), urut sesuai alur. DITOLAK dan SELESAI = tahap akhir, tanpa SLA.
export const SLA_STAGES = [
  ReportStatus.MENUNGGU_VERIFIKASI,
  ReportStatus.TERVERIFIKASI,
  ReportStatus.DITERUSKAN,
  ReportStatus.DALAM_PENANGANAN,
]

// Tahap yang menjadi tanggung jawab instansi: eskalasi SLA-nya juga dikirim ke atasan instansi.
export const AGENCY_SLA_STAGES = [ReportStatus.DITERUSKAN, ReportStatus.DALAM_PENANGANAN]

export const SLA = {
  // Dipakai jika tahap belum ada di tabel SlaSetting (cermin prisma/seed.ts).
  DEFAULT_DAYS: {
    [ReportStatus.MENUNGGU_VERIFIKASI]: 2,
    [ReportStatus.TERVERIFIKASI]: 1,
    [ReportStatus.DITERUSKAN]: 3,
    [ReportStatus.DALAM_PENANGANAN]: 7,
  },
  MAX_DAYS: 365,
  JOB_INTERVAL_MS: 10 * 60 * 1000, // seberapa sering job memeriksa laporan yang melewati batas
  BATCH_SIZE: 500,
}

export const MERGE = {
  DUPLICATE_RADIUS_M: 200, // kandidat duplikat = laporan sejenis dalam radius ini
  MAX_CANDIDATES: 10,
}

export const EXPORT = {
  MAX_ROWS: 10000,
  DELIMITER: ',', // ganti ';' jika Excel (locale Indonesia) menampilkan semua kolom dalam satu sel
}

export const DASHBOARD = {
  TREND_DAYS: 30,
  TOP_DISTRICTS: 5,
  OVERDUE_LIST: 10,
  RESOLVED_SAMPLE: 5000, // rata-rata hari penanganan dihitung dari laporan selesai terbaru sebanyak ini
}