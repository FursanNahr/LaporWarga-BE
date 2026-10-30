import { Router } from 'express'
import { Role } from '@prisma/client'
import * as adminController from '../controllers/admin.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { validate } from '../middlewares/validate.js'
import { idParam } from '../validators/common.validator.js'
import {
  exportReportsQuery,
  listAdminReportsQuery,
  listAuditLogsQuery,
  listCommentsQuery,
  mergeReportBody,
  moderateCommentBody,
  updateSlaBody,
  verifyReportBody,
} from '../validators/admin.validator.js'
import {
  createAgencyBody,
  createStaffBody,
  listAgenciesQuery,
  listStaffQuery,
  updateAgencyBody,
  updateStaffBody,
} from '../validators/agency.validator.js'
import {
  categoryBody,
  createSubcategoryBody,
  updateSubcategoryBody,
} from '../validators/category.validator.js'

const router = Router()

// Dipasang di /api/admin. Semua endpoint di bawah ini hanya untuk ADMIN.
router.use(authenticate, authorize(Role.ADMIN))

// ---- Dashboard ----
router.get('/dashboard', adminController.dashboard)

// ---- Laporan: verifikasi, kelola, gabung duplikat, ekspor ----
router.get('/reports', validate({ query: listAdminReportsQuery }), adminController.listReports)
// "/export" HARUS di atas "/:id", kalau tidak dianggap sebagai id.
router.get('/reports/export', validate({ query: exportReportsQuery }), adminController.exportReports)
router.get('/reports/:id', validate({ params: idParam }), adminController.getReport)
router.post(
  '/reports/:id/verification',
  validate({ params: idParam, body: verifyReportBody }),
  adminController.verifyReport,
)
router.get('/reports/:id/duplicates', validate({ params: idParam }), adminController.listDuplicates)
router.post(
  '/reports/:id/merge',
  validate({ params: idParam, body: mergeReportBody }),
  adminController.mergeReport,
)

// ---- Instansi & akun petugas ----
router.get('/agencies', validate({ query: listAgenciesQuery }), adminController.listAgencies)
router.post('/agencies', validate({ body: createAgencyBody }), adminController.createAgency)
router.patch(
  '/agencies/:id',
  validate({ params: idParam, body: updateAgencyBody }),
  adminController.updateAgency,
)

router.get('/staff', validate({ query: listStaffQuery }), adminController.listStaff)
router.post('/staff', validate({ body: createStaffBody }), adminController.createStaff)
router.patch(
  '/staff/:id',
  validate({ params: idParam, body: updateStaffBody }),
  adminController.updateStaff,
)

// ---- Kategori, subjenis, dan pemetaan ke instansi ----
router.get('/categories', adminController.listCategories)
router.post('/categories', validate({ body: categoryBody }), adminController.createCategory)
router.patch(
  '/categories/:id',
  validate({ params: idParam, body: categoryBody }),
  adminController.updateCategory,
)
router.delete('/categories/:id', validate({ params: idParam }), adminController.deleteCategory)
router.post(
  '/categories/:id/subcategories',
  validate({ params: idParam, body: createSubcategoryBody }),
  adminController.createSubcategory,
)
router.patch(
  '/subcategories/:id',
  validate({ params: idParam, body: updateSubcategoryBody }),
  adminController.updateSubcategory,
)
router.delete('/subcategories/:id', validate({ params: idParam }), adminController.deleteSubcategory)

// ---- Moderasi komentar ----
router.get('/comments', validate({ query: listCommentsQuery }), adminController.listComments)
router.patch(
  '/comments/:id/moderation',
  validate({ params: idParam, body: moderateCommentBody }),
  adminController.moderateComment,
)

// ---- SLA ----
router.get('/sla', adminController.getSla)
router.put('/sla', validate({ body: updateSlaBody }), adminController.updateSla)
router.post('/sla/check', adminController.runSlaCheck)

// ---- Log audit: HANYA baca. Jangan tambah endpoint ubah/hapus untuk log. ----
router.get('/audit-logs', validate({ query: listAuditLogsQuery }), adminController.listAuditLogs)
router.get('/audit-logs/actions', adminController.listAuditActions)

export default router