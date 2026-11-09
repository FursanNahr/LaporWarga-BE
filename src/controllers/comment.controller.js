import { asyncHandler } from '../utils/asyncHandler.js'
import { collectUploadedFiles } from '../utils/file.js'
import { sendSuccess } from '../utils/response.js'
import * as commentService from '../services/comment.service.js'

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await commentService.listComments({
    reportId: req.validated.params.id,
    viewer: req.user,
    query: req.validated.query,
  })
  sendSuccess(res, { data: items, meta })
})

export const listReplies = asyncHandler(async (req, res) => {
  const { items, meta } = await commentService.listReplies({
    commentId: req.validated.params.id,
    viewer: req.user,
    query: req.validated.query,
  })
  sendSuccess(res, { data: items, meta })
})

export const create = asyncHandler(async (req, res) => {
  const data = await commentService.createComment({
    author: req.user,
    reportId: req.validated.params.id,
    data: req.validated.body,
    files: collectUploadedFiles(req),
  })
  sendSuccess(res, { statusCode: 201, message: 'Komentar berhasil dikirim', data })
})

export const remove = asyncHandler(async (req, res) => {
  const data = await commentService.deleteComment({ id: req.validated.params.id })
  sendSuccess(res, { message: 'Komentar berhasil dihapus', data })
})