import * as statsService from '../services/stats.service.js'
import { sendSuccess } from '../utils/response.js'

// Pembungkus kecil agar error async selalu sampai ke errorHandler (aman di Express 4 maupun 5).
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (error) {
    next(error)
  }
}

const query = (req) => req.validated?.query ?? {}

export const overview = handle(async (req, res) => {
  sendSuccess(res, { data: await statsService.getOverview() })
})

export const citizens = handle(async (req, res) => {
  sendSuccess(res, { data: await statsService.getCitizenStats(query(req)) })
})

export const agencies = handle(async (req, res) => {
  sendSuccess(res, { data: await statsService.getAgencyStats(query(req)) })
})

export const admins = handle(async (req, res) => {
  sendSuccess(res, { data: await statsService.getAdminStats(query(req)) })
})