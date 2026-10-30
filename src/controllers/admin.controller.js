import * as adminReportService from '../services/adminReport.service.js'
import * as agencyService from '../services/agency.service.js'
import * as auditService from '../services/audit.service.js'
import * as categoryService from '../services/category.service.js'
import * as commentModerationService from '../services/commentModeration.service.js'
import * as dashboardService from '../services/dashboard.service.js'
import * as duplicateService from '../services/duplicate.service.js'
import * as exportService from '../services/export.service.js'
import * as slaService from '../services/sla.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

// Semua handler di sini hanya bisa dicapai role ADMIN (lihat admin.routes.js).
// req.user = admin yang login, req.validated = input yang sudah divalidasi.

// ---- Dashboard ----

export const dashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboard()
  sendSuccess(res, { message: 'Ringkasan dashboard', data })
})

// ---- Laporan ----

export const listReports = asyncHandler(async (req, res) => {
  const { items, meta } = await adminReportService.listAdminReports({ query: req.validated.query })
  sendSuccess(res, { data: items, meta })
})

export const getReport = asyncHandler(async (req, res) => {
  const data = await adminReportService.getAdminReportDetail({
    id: req.validated.params.id,
    admin: req.user,
  })
  sendSuccess(res, { data })
})

export const verifyReport = asyncHandler(async (req, res) => {
  const data = await adminReportService.verifyReport({
    reportId: req.validated.params.id,
    admin: req.user,
    data: req.validated.body,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Status laporan berhasil diperbarui', data })
})

export const listDuplicates = asyncHandler(async (req, res) => {
  const data = await duplicateService.findDuplicateCandidates({ reportId: req.validated.params.id })
  sendSuccess(res, { data })
})

export const mergeReport = asyncHandler(async (req, res) => {
  const data = await duplicateService.mergeReports({
    sourceId: req.validated.params.id,
    targetId: req.validated.body.targetId,
    note: req.validated.body.note,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Laporan berhasil digabung', data })
})

/** CSV, bukan JSON: ditulis langsung ke response. */
export const exportReports = asyncHandler(async (req, res) => {
  const { filename, csv, truncated } = await exportService.buildReportsCsv({
    query: req.validated.query,
    admin: req.user,
    ipAddress: req.ip,
  })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  if (truncated) res.setHeader('X-Export-Truncated', 'true') // baris terpotong di batas maksimum
  res.send(csv)
})

// ---- Instansi & akun petugas ----

export const listAgencies = asyncHandler(async (req, res) => {
  const data = await agencyService.listAgencies({ query: req.validated.query })
  sendSuccess(res, { data })
})

export const createAgency = asyncHandler(async (req, res) => {
  const data = await agencyService.createAgency({
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { statusCode: 201, message: 'Instansi berhasil dibuat', data })
})

export const updateAgency = asyncHandler(async (req, res) => {
  const data = await agencyService.updateAgency({
    id: req.validated.params.id,
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Instansi berhasil diperbarui', data })
})

export const listStaff = asyncHandler(async (req, res) => {
  const { items, meta } = await agencyService.listStaff({ query: req.validated.query })
  sendSuccess(res, { data: items, meta })
})

export const createStaff = asyncHandler(async (req, res) => {
  const data = await agencyService.createStaff({
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { statusCode: 201, message: 'Akun petugas berhasil dibuat', data })
})

export const updateStaff = asyncHandler(async (req, res) => {
  const data = await agencyService.updateStaff({
    id: req.validated.params.id,
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Akun petugas berhasil diperbarui', data })
})

// ---- Kategori & subjenis ----

export const listCategories = asyncHandler(async (req, res) => {
  const data = await categoryService.listCategoriesAdmin()
  sendSuccess(res, { data })
})

export const createCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.createCategory({
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { statusCode: 201, message: 'Kategori berhasil dibuat', data })
})

export const updateCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.updateCategory({
    id: req.validated.params.id,
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Kategori berhasil diperbarui', data })
})

export const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory({
    id: req.validated.params.id,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Kategori berhasil dihapus' })
})

export const createSubcategory = asyncHandler(async (req, res) => {
  const data = await categoryService.createSubcategory({
    categoryId: req.validated.params.id,
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { statusCode: 201, message: 'Subjenis berhasil dibuat', data })
})

export const updateSubcategory = asyncHandler(async (req, res) => {
  const data = await categoryService.updateSubcategory({
    id: req.validated.params.id,
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Subjenis berhasil diperbarui', data })
})

export const deleteSubcategory = asyncHandler(async (req, res) => {
  await categoryService.deleteSubcategory({
    id: req.validated.params.id,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Subjenis berhasil dihapus' })
})

// ---- Moderasi komentar ----

export const listComments = asyncHandler(async (req, res) => {
  const { items, meta } = await commentModerationService.listCommentsForModeration({
    query: req.validated.query,
  })
  sendSuccess(res, { data: items, meta })
})

export const moderateComment = asyncHandler(async (req, res) => {
  const data = await commentModerationService.moderateComment({
    id: req.validated.params.id,
    data: req.validated.body,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, {
    message: req.validated.body.hidden ? 'Komentar disembunyikan' : 'Komentar ditampilkan kembali',
    data,
  })
})

// ---- SLA ----

export const getSla = asyncHandler(async (req, res) => {
  const data = await slaService.listSlaSettings()
  sendSuccess(res, { data })
})

export const updateSla = asyncHandler(async (req, res) => {
  const data = await slaService.updateSlaSettings({
    settings: req.validated.body.settings,
    admin: req.user,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Pengaturan SLA berhasil disimpan', data })
})

/** Jalankan pengecekan SLA sekarang (job yang sama dengan yang terjadwal). Berguna saat demo. */
export const runSlaCheck = asyncHandler(async (req, res) => {
  const data = await slaService.runSlaCheck()
  sendSuccess(res, { message: 'Pengecekan SLA selesai', data })
})

// ---- Log audit (hanya baca) ----

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { items, meta } = await auditService.listAuditLogs({ query: req.validated.query })
  sendSuccess(res, { data: items, meta })
})

export const listAuditActions = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: auditService.listAuditActions() })
})