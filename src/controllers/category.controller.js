import * as categoryService from '../services/category.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

export const list = asyncHandler(async (req, res) => {
  const data = await categoryService.listCategories()
  sendSuccess(res, { data })
})
