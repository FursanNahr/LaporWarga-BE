import * as reportService from '../services/report.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

export const create = asyncHandler(async (req, res) => {
  const data = await reportService.createReport({
    reporter: req.user,
    data: req.validated.body,
    files: req.files,
  })
  sendSuccess(res, { statusCode: 201, message: 'Laporan berhasil dibuat', data })
})

export const list = asyncHandler(async (req, res) => {
  // req.user kosong jika pengunjung belum login (lihat optionalAuth)
  const { items, meta } = await reportService.listPublicReports({
    query: req.validated.query,
    viewer: req.user,
  })
  sendSuccess(res, { data: items, meta })
})

export const listMine = asyncHandler(async (req, res) => {
  const { items, meta } = await reportService.listMyReports({
    query: req.validated.query,
    viewer: req.user,
  })
  sendSuccess(res, { data: items, meta })
})

export const detail = asyncHandler(async (req, res) => {
  const data = await reportService.getReportById({
    id: req.validated.params.id,
    viewer: req.user,
  })
  sendSuccess(res, { data })
})
