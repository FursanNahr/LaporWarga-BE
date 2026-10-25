import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { extractBearerToken } from '../utils/jwt.js'
import { getUserFromToken } from '../services/auth.service.js'

/** Wajib login. Hasilnya: req.user = { id, name, email, role, agencyId, ... } */
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req)
  if (!token) throw AppError.unauthorized()

  req.user = await getUserFromToken(token)
  next()
})
