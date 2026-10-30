import { Router } from 'express'
import * as districtController from '../controllers/district.controller.js'

const router = Router()

// Publik: daftar kecamatan untuk dropdown filter.
router.get('/', districtController.list)

export default router