import { z } from 'zod'
import { INSTANSI_ACTIONS } from '../config/constants.js'
import { latitude, longitude } from './common.validator.js'

/**
 * POST /api/reports/:id/progress (multipart/form-data atau JSON jika tanpa file).
 * File (photos, afterPhotos, documents) ditangani multer, bukan skema ini.
 *
 * latitude/longitude = lokasi petugas saat update.
 * Untuk SELESAIKAN, lokasi ini dipakai memeriksa radius foto "sesudah" dari titik laporan.
 */
export const createProgressBody = z
  .object({
    action: z.enum(Object.keys(INSTANSI_ACTIONS), {
      message: `action harus salah satu dari: ${Object.keys(INSTANSI_ACTIONS).join(', ')}`,
    }),
    note: z.string().trim().max(2000, 'Catatan maksimal 2000 karakter').optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
  })
  .refine((data) => (data.latitude === undefined) === (data.longitude === undefined), {
    message: 'latitude dan longitude harus dikirim bersamaan',
    path: ['latitude'],
  })
  .refine(
    (data) =>
      data.action !== 'SELESAIKAN' || (data.latitude !== undefined && data.longitude !== undefined),
    { message: 'Lokasi petugas wajib dikirim saat menyelesaikan laporan', path: ['latitude'] },
  )
  .refine((data) => data.action !== 'TAMBAH_CATATAN' || Boolean(data.note), {
    message: 'Catatan wajib diisi',
    path: ['note'],
  })
