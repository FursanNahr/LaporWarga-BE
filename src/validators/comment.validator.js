import { z } from 'zod'
import { CommentKind } from '@prisma/client'
import { COMMENT } from '../config/constants.js'
import { idField, paginationQuery } from './common.validator.js'

// Form-data sering mengirim field kosong sebagai '' (misalnya parentId saat bukan balasan).
const blankToUndefined = (schema) =>
  z
    .union([z.literal(''), schema])
    .optional()
    .transform((value) => (value === '' ? undefined : value))

/**
 * POST /api/reports/:id/comments (multipart/form-data, jadi semua nilai datang sebagai string).
 * File (field "files") ditangani multer, bukan skema ini.
 */
export const createCommentBody = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Isi komentar wajib diisi')
    .max(COMMENT.MAX_BODY_LENGTH, `Komentar maksimal ${COMMENT.MAX_BODY_LENGTH} karakter`),
  kind: blankToUndefined(z.enum(Object.values(CommentKind))).transform(
    (value) => value ?? CommentKind.KOMENTAR,
  ),
  parentId: blankToUndefined(idField),
})

/** GET /api/reports/:id/comments */
export const listCommentsQuery = paginationQuery

/** GET /api/comments/:id/replies */
export const listRepliesQuery = paginationQuery