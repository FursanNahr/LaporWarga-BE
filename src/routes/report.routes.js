import { Router } from 'express'
import { Role } from '@prisma/client'
import * as reportController from '../controllers/report.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { optionalAuth } from '../middlewares/optionalAuth.js'
import { uploadReportPhotos } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { idParam } from '../validators/common.validator.js'
import {
  createReportBody,
  listAgencyReportsQuery,
  listMyReportsQuery,
  listReportsQuery,
} from '../validators/report.validator.js'

const router = Router()

// Urutan middleware = urutan eksekusi.
// Untuk upload: cek login & role DULU, baru terima file, baru validasi field teks.
router.post(
  '/',
  authenticate,
  authorize(Role.WARGA),
  uploadReportPhotos,
  validate({ body: createReportBody }),
  reportController.create,
)

router.get('/', optionalAuth, validate({ query: listReportsQuery }), reportController.list)

// "/me" dan "/agency" HARUS di atas "/:id", kalau tidak dianggap sebagai id.
router.get('/me', authenticate, validate({ query: listMyReportsQuery }), reportController.listMine)

router.get(
  '/agency',
  authenticate,
  authorize(Role.INSTANSI),
  validate({ query: listAgencyReportsQuery }),
  reportController.listAgency,
)

router.get('/:id', optionalAuth, validate({ params: idParam }), reportController.detail)

export default router
