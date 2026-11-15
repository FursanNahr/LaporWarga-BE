import { z } from 'zod'
import { CONFIRMATION, PAGINATION } from '../config/constants.js'

export const reportIdParams = z.object({
  id: z.coerce.number().int().positive('ID laporan tidak valid'),
})

// Pelapor hanya boleh mengirim dua nilai ini. AUTO_CONFIRMED hanya dibuat oleh sistem.
export const submitConfirmationBody = z
  .object({
    result: z.enum(['SUDAH_BERES', 'BELUM_BERES'], {
      message: 'Hasil harus SUDAH_BERES atau BELUM_BERES',
    }),
    note: z
      .string()
      .trim()
      .max(CONFIRMATION.MAX_NOTE_LENGTH, `Catatan maksimal ${CONFIRMATION.MAX_NOTE_LENGTH} karakter`)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.result === 'BELUM_BERES' && (value.note?.length ?? 0) < CONFIRMATION.MIN_REASON_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: `Alasan minimal ${CONFIRMATION.MIN_REASON_LENGTH} karakter saat menyatakan belum beres`,
      })
    }
  })

export const resolveDisputeBody = z.object({
  decision: z.enum(['REOPEN', 'CLOSE'], { message: 'Keputusan harus REOPEN atau CLOSE' }),
  reason: z
    .string()
    .trim()
    .min(CONFIRMATION.MIN_REASON_LENGTH, `Alasan minimal ${CONFIRMATION.MIN_REASON_LENGTH} karakter`)
    .max(CONFIRMATION.MAX_NOTE_LENGTH, `Alasan maksimal ${CONFIRMATION.MAX_NOTE_LENGTH} karakter`),
})

// Jika common.validator.js sudah punya skema paginasi cursor, boleh diganti dengan itu.
export const disputeListQuery = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
})