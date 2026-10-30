import { Router } from 'express'
import adminRoutes from './admin.routes.js'
import authRoutes from './auth.routes.js'
import categoryRoutes from './category.routes.js'
import districtRoutes from './district.routes.js'
import reportRoutes from './report.routes.js'
import notificationRoutes from './notification.routes.js'
import progressRoutes from './progress.routes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'BE LaporWarga jalan' })
})

// Daftarkan modul baru di sini.
router.use('/auth', authRoutes)
router.use('/categories', categoryRoutes)
router.use('/districts', districtRoutes)
router.use('/reports', reportRoutes)
router.use('/reports', progressRoutes) // POST /api/reports/:id/progress
router.use('/notifications', notificationRoutes)
router.use('/admin', adminRoutes)

export default router