import { Router } from 'express'
import adminRoutes from './admin.routes.js'
import authRoutes from './auth.routes.js'
import categoryRoutes from './category.routes.js'
import districtRoutes from './district.routes.js'
import reportRoutes from './report.routes.js'
import notificationRoutes from './notification.routes.js'
import progressRoutes from './progress.routes.js'
import supportRoutes from './support.routes.js'
import statsRoutes from './stats.routes.js'
import commentRoutes, { commentItemRoutes } from './comment.routes.js'

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
router.use('/reports', supportRoutes) // PUT/DELETE /api/reports/:id/support/:type
router.use('/notifications', notificationRoutes)
router.use('/admin', adminRoutes)
router.use('/stats', statsRoutes)
router.use('/reports', commentRoutes) // GET/POST /api/reports/:id/comments
router.use('/comments', commentItemRoutes) // GET /api/comments/:id/replies, DELETE /api/comments/:id

export default router
