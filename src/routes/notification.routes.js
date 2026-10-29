import { Router } from 'express'
import * as notificationController from '../controllers/notification.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { validate } from '../middlewares/validate.js'
import { idParam } from '../validators/common.validator.js'
import { listNotificationsQuery } from '../validators/notification.validator.js'

const router = Router()

// Semua role yang sudah login punya notifikasinya sendiri (warga, instansi, admin).
router.use(authenticate)

router.get('/', validate({ query: listNotificationsQuery }), notificationController.list)

// "/read-all" HARUS di atas "/:id/read".
router.patch('/read-all', notificationController.markAllRead)
router.patch('/:id/read', validate({ params: idParam }), notificationController.markRead)

export default router
