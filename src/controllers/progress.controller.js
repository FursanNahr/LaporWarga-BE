import * as progressService from '../services/progress.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

export const create = asyncHandler(async (req, res) => {
  const data = await progressService.createProgressUpdate({
    reportId: req.validated.params.id,
    officer: req.user,
    data: req.validated.body,
    files: req.files ?? {}, // kosong jika request tanpa file
    ipAddress: req.ip,
  })
  sendSuccess(res, { statusCode: 201, message: 'Progres laporan berhasil diperbarui', data })
})
