import * as supportService from '../services/support.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

// Response: { data: { stats: { upvotes, verifications }, viewer: { hasUpvoted, hasVerified } } }

export const add = asyncHandler(async (req, res) => {
  const { id, type } = req.validated.params
  const data = await supportService.addSupport({ reportId: id, type, viewer: req.user })
  sendSuccess(res, { message: 'Dukungan dicatat', data })
})

export const remove = asyncHandler(async (req, res) => {
  const { id, type } = req.validated.params
  const data = await supportService.removeSupport({ reportId: id, type, viewer: req.user })
  sendSuccess(res, { message: 'Dukungan dicabut', data })
})
