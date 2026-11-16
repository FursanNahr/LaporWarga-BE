import { Router } from 'express'
import * as cronController from '../controllers/cron.controller.js'
import { cronAuth } from '../middlewares/cronAuth.js'

// Dipasang di /api/cron. Vercel Cron memanggil dengan metode GET.
const router = Router()

router.use(cronAuth)

router.get('/confirmation', cronController.runConfirmationCheck)
router.get('/sla', cronController.runSlaCheck)

export default router
