import * as districtService from '../services/district.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

export const list = asyncHandler(async (req, res) => {
  const data = await districtService.listDistricts()
  sendSuccess(res, { data })
})