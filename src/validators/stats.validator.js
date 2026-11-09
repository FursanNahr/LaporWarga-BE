import { z } from 'zod'
import { PAGINATION } from '../config/constants.js'
import { RANGES } from '../utils/statsHelpers.js'

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Tanggal tidak valid')

// Dipakai /stats/citizens, /stats/agencies, /stats/admins.
// dateFrom/dateTo (jika ada) menggantikan `range`.
export const statsQuery = z
  .object({
    range: z.enum(RANGES).default('30-hari'),
    dateFrom: dateOnly.optional(),
    dateTo: dateOnly.optional(),
    limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(10), // panjang papan peringkat
  })
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: 'dateFrom tidak boleh setelah dateTo',
    path: ['dateTo'],
  })