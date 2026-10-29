import * as notificationService from '../services/notification.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await notificationService.listNotifications({
    userId: req.user.id,
    query: req.validated.query,
  })
  sendSuccess(res, { data: items, meta })
})

export const markRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAsRead({
    id: req.validated.params.id,
    userId: req.user.id,
  })
  sendSuccess(res, { message: 'Notifikasi ditandai sudah dibaca', data })
})

export const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllAsRead(req.user.id)
  sendSuccess(res, { message: 'Semua notifikasi ditandai sudah dibaca', data })
})
