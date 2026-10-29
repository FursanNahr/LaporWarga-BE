import { Router } from 'express'
import authRoutes from './auth.routes.js'
import categoryRoutes from './category.routes.js'
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
router.use('/reports', reportRoutes)
router.use('/reports', progressRoutes) // POST /api/reports/:id/progress
router.use('/notifications', notificationRoutes)

export default router
