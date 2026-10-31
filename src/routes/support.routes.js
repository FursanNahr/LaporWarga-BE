import { Router } from 'express'
import { Role } from '@prisma/client'
import * as supportController from '../controllers/support.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { validate } from '../middlewares/validate.js'
import { supportParam } from '../validators/support.validator.js'

const router = Router()

// Dipasang di /api/reports (lihat routes/index.js), jadi alamat lengkapnya:
//   PUT    /api/reports/:id/support/:type   -> beri dukungan   (:type = upvote | verify)
//   DELETE /api/reports/:id/support/:type   -> cabut dukungan
// Hanya warga yang sudah login. Melihat jumlahnya tetap publik lewat GET /api/reports.
router.put(
  '/:id/support/:type',
  authenticate,
  authorize(Role.WARGA),
  validate({ params: supportParam }),
  supportController.add,
)

router.delete(
  '/:id/support/:type',
  authenticate,
  authorize(Role.WARGA),
  validate({ params: supportParam }),
  supportController.remove,
)

export default router
