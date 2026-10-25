import * as authService from '../services/auth.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

// Controller sengaja tipis: ambil input yang sudah divalidasi -> panggil service -> kirim response.
// Semua logika bisnis ada di service.

export const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.validated.body)
  sendSuccess(res, { statusCode: 201, message: 'Registrasi berhasil', data })
})

export const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.validated.body)
  sendSuccess(res, { message: 'Login berhasil', data })
})

export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: req.user })
})
