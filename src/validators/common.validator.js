import { z } from 'zod'
import { PAGINATION } from '../config/constants.js'

// Potongan skema yang dipakai ulang di banyak modul.

/** Id numerik. Query string & form-data selalu string, jadi perlu coerce. */
export const idField = z.coerce.number().int().positive()

export const idParam = z.object({ id: idField })

/** ?cursor=...&limit=... untuk infinite scroll */
export const paginationQuery = z.object({
  cursor: idField.optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
})
