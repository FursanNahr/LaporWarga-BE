-- =====================================================================
-- Verifikasi 2 arah: perubahan skema (hanya MENAMBAH, tidak menghapus data)
-- Jalankan di MySQL hosting-mu (phpMyAdmin / DBeaver / SQL console provider).
-- BACKUP DULU sebelum menjalankan.
-- =====================================================================

-- 1. Status laporan baru (ditaruh di AKHIR daftar enum, ini cara paling aman di MySQL).
--    Enum yang sama dipakai di 4 kolom, jadi keempatnya harus diubah.
ALTER TABLE `Report` MODIFY `status`
  ENUM('MENUNGGU_VERIFIKASI','TERVERIFIKASI','DITOLAK','DITERUSKAN','DALAM_PENANGANAN','SELESAI','MENUNGGU_KONFIRMASI','DISANGGAH')
  NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI';

ALTER TABLE `ProgressUpdate` MODIFY `fromStatus`
  ENUM('MENUNGGU_VERIFIKASI','TERVERIFIKASI','DITOLAK','DITERUSKAN','DALAM_PENANGANAN','SELESAI','MENUNGGU_KONFIRMASI','DISANGGAH')
  NULL;

ALTER TABLE `ProgressUpdate` MODIFY `toStatus`
  ENUM('MENUNGGU_VERIFIKASI','TERVERIFIKASI','DITOLAK','DITERUSKAN','DALAM_PENANGANAN','SELESAI','MENUNGGU_KONFIRMASI','DISANGGAH')
  NOT NULL;

ALTER TABLE `SlaSetting` MODIFY `stage`
  ENUM('MENUNGGU_VERIFIKASI','TERVERIFIKASI','DITOLAK','DITERUSKAN','DALAM_PENANGANAN','SELESAI','MENUNGGU_KONFIRMASI','DISANGGAH')
  NOT NULL;

-- 2. Hasil konfirmasi: tambah AUTO_CONFIRMED (ditutup otomatis oleh sistem)
ALTER TABLE `Confirmation` MODIFY `result`
  ENUM('SUDAH_BERES','BELUM_BERES','AUTO_CONFIRMED')
  NOT NULL;

-- 3. Kolom keputusan admin di tabel Confirmation
ALTER TABLE `Confirmation`
  ADD COLUMN `adminDecision` ENUM('REOPEN','CLOSE') NULL,
  ADD COLUMN `adminNote` TEXT NULL,
  ADD COLUMN `resolvedById` INT NULL,
  ADD COLUMN `resolvedAt` DATETIME(3) NULL,
  ADD INDEX `Confirmation_resolvedById_idx` (`resolvedById`),
  ADD CONSTRAINT `Confirmation_resolvedById_fkey`
    FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Batas waktu konfirmasi pelapor
ALTER TABLE `Report`
  ADD COLUMN `confirmDueAt` DATETIME(3) NULL,
  ADD INDEX `Report_status_confirmDueAt_idx` (`status`, `confirmDueAt`);

-- 5. Pengecekan (opsional): hasilnya harus menampilkan nilai enum baru
-- SHOW COLUMNS FROM `Report` LIKE 'status';
-- SHOW COLUMNS FROM `Confirmation`;