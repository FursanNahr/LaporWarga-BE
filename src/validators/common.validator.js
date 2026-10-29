import { z } from 'zod'
import { PAGINATION } from '../config/constants.js'

// Potongan skema yang dipakai ulang di banyak modul.

/** Id numerik. Query string & form-data selalu string, jadi perlu coerce. */
export const idField = z.coerce.number().int().positive()

export const idParam = z.object({ id: idField })

/** Koordinat. Dipakai di laporan (titik laporan) dan progres (lokasi petugas). */
export const latitude = z.coerce.number().min(-90, 'Latitude tidak valid').max(90, 'Latitude tidak valid')
export const longitude = z.coerce.number().min(-180, 'Longitude tidak valid').max(180, 'Longitude tidak valid')

/** ?cursor=...&limit=... untuk infinite scroll */
export const paginationQuery = z.object({
  cursor: idField.optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
})
