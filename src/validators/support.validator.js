import { z } from 'zod'
import { idField } from './common.validator.js'

// Nilai :type di URL. "upvote" = dukungan, "verify" = verifikasi bahwa masalahnya benar ada.
export const SUPPORT_SLUGS = ['upvote', 'verify']

/** PUT / DELETE /api/reports/:id/support/:type */
export const supportParam = z.object({
  id: idField,
  type: z.enum(SUPPORT_SLUGS),
})
