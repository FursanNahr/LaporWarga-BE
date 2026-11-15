import * as confirmationService from '../services/confirmation.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

// Controller sengaja tipis: ambil input yang sudah divalidasi -> panggil service -> kirim response.

export const submit = asyncHandler(async (req, res) => {
  const { result } = req.validated.body
  const data = await confirmationService.submitConfirmation({
    reportId: req.validated.params.id,
    user: req.user,
    data: req.validated.body,
    files: req.files ?? [],
    ipAddress: req.ip,
  })
  sendSuccess(res, {
    statusCode: 201,
    message:
      result === 'SUDAH_BERES'
        ? 'Terima kasih, laporan telah ditutup'
        : 'Sanggahan terkirim, menunggu keputusan admin',
    data,
  })
})

export const list = asyncHandler(async (req, res) => {
  const data = await confirmationService.listConfirmations({
    reportId: req.validated.params.id,
    viewer: req.user ?? null,
  })
  sendSuccess(res, { data })
})

export const listDisputes = asyncHandler(async (req, res) => {
  const { items, meta } = await confirmationService.listDisputes({ query: req.validated.query })
  sendSuccess(res, { data: items, meta })
})

export const resolve = asyncHandler(async (req, res) => {
  const data = await confirmationService.resolveDispute({
    reportId: req.validated.params.id,
    admin: req.user,
    data: req.validated.body,
    ipAddress: req.ip,
  })
  sendSuccess(res, { message: 'Keputusan tersimpan', data })
})