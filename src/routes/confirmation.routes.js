import { Router } from 'express'
import { Role } from '@prisma/client'
import * as confirmationController from '../controllers/confirmation.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { discardUploadsOnFailure } from '../middlewares/cleanupUploads.js'
import { optionalAuth } from '../middlewares/optionalAuth.js'
import { uploadConfirmationPhotos } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import {
  disputeListQuery,
  reportIdParams,
  resolveDisputeBody,
  submitConfirmationBody,
} from '../validators/confirmation.validator.js'

// ---- Dipasang di /api/reports ----
const router = Router()

// Publik: riwayat konfirmasi & sanggahan
router.get(
  '/:id/confirmations',
  optionalAuth,
  validate({ params: reportIdParams }),
  confirmationController.list,
)

// Pelapor: "Sudah beres" / "Belum beres" (multipart/form-data, field foto = photos)
router.post(
  '/:id/confirmation',
  authenticate,
  authorize(Role.WARGA),
  discardUploadsOnFailure, // sebelum upload
  uploadConfirmationPhotos,
  validate({ params: reportIdParams, body: submitConfirmationBody }),
  confirmationController.submit,
)

export default router

// ---- Dipasang di /api/admin/disputes ----
export const adminDisputeRoutes = Router()

adminDisputeRoutes.use(authenticate, authorize(Role.ADMIN))

adminDisputeRoutes.get('/', validate({ query: disputeListQuery }), confirmationController.listDisputes)
adminDisputeRoutes.patch(
  '/:id/resolve',
  validate({ params: reportIdParams, body: resolveDisputeBody }),
  confirmationController.resolve,
)