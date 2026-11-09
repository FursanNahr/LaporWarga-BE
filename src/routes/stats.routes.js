import { Router } from 'express'
import * as statsController from '../controllers/stats.controller.js'
import { validate } from '../middlewares/validate.js'
import { statsQuery } from '../validators/stats.validator.js'

const router = Router()

// Dipasang di /api/stats. Semua publik: transparansi berlaku untuk semua peran, tanpa login.
router.get('/overview', statsController.overview) // StatsBar di beranda
router.get('/citizens', validate({ query: statsQuery }), statsController.citizens)
router.get('/agencies', validate({ query: statsQuery }), statsController.agencies)
router.get('/admins', validate({ query: statsQuery }), statsController.admins)

export default router