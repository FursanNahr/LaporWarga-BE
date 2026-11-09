import { collectUploadedFiles, deleteFiles } from '../utils/file.js'

/**
 * Hapus file hasil upload kalau request akhirnya gagal (status >= 400) atau koneksi klien putus,
 * misalnya validasi zod gagal, laporan tidak ditemukan, atau transaksi database gagal.
 *
 * Pasang SEBELUM middleware upload. Pengecekan dilakukan saat response selesai, jadi
 * req.files sudah terisi dan berlaku untuk error dari middleware mana pun sesudahnya.
 */
export const discardUploadsOnFailure = (req, res, next) => {
  res.on('close', () => {
    if (res.statusCode >= 400 || !res.writableFinished) {
      deleteFiles(collectUploadedFiles(req))
    }
  })
  next()
}