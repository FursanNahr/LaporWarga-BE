import { Router } from 'express'
import { Role } from '@prisma/client'
import * as commentController from '../controllers/comment.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { discardUploadsOnFailure } from '../middlewares/cleanupUploads.js'
import { optionalAuth } from '../middlewares/optionalAuth.js'
import { uploadCommentFiles } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { idParam } from '../validators/common.validator.js'
import {
  createCommentBody,
  listCommentsQuery,
  listRepliesQuery,
} from '../validators/comment.validator.js'

// ---------------------------------------------------------------------
// Dipasang di /api/reports  ->  /api/reports/:id/comments
// ---------------------------------------------------------------------
const router = Router()

router.get(
  '/:id/comments',
  optionalAuth,
  validate({ params: idParam, query: listCommentsQuery }),
  commentController.list,
)

// Semua role yang login boleh berkomentar (aturan per role ada di service).
// discardUploadsOnFailure dipasang sebelum upload supaya file dibersihkan kalau request gagal.
router.post(
  '/:id/comments',
  authenticate,
  discardUploadsOnFailure,
  uploadCommentFiles,
  validate({ params: idParam, body: createCommentBody }),
  commentController.create,
)

// ---------------------------------------------------------------------
// Dipasang di /api/comments  ->  /api/comments/:id/...
// ---------------------------------------------------------------------
export const commentItemRoutes = Router()

commentItemRoutes.get(
  '/:id/replies',
  optionalAuth,
  validate({ params: idParam, query: listRepliesQuery }),
  commentController.listReplies,
)

// Hanya admin yang boleh menghapus, demi transparansi (pemilik komentar tidak bisa menghapus).
commentItemRoutes.delete(
  '/:id',
  authenticate,
  authorize(Role.ADMIN),
  validate({ params: idParam }),
  commentController.remove,
)

export default router