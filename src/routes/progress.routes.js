import { Router } from 'express'
import { Role } from '@prisma/client'
import * as progressController from '../controllers/progress.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { uploadProgressFiles } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { idParam } from '../validators/common.validator.js'
import { createProgressBody } from '../validators/progress.validator.js'

const router = Router()

// Dipasang di /api/reports, jadi URL lengkapnya: POST /api/reports/:id/progress
// (timeline-nya dibaca lewat GET /api/reports/:id, jadi tidak perlu endpoint terpisah)
router.post(
  '/:id/progress',
  authenticate,
  authorize(Role.INSTANSI),
  uploadProgressFiles,
  validate({ params: idParam, body: createProgressBody }),
  progressController.create,
)

export default router
