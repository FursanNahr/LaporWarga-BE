import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

// Token hanya berisi id user (di field "sub"). Role & status akun selalu dibaca dari database,
// jadi kalau admin menonaktifkan akun atau mengubah role, efeknya langsung berlaku.
export const signToken = (userId) =>
  jwt.sign({}, env.jwtSecret, { subject: String(userId), expiresIn: env.jwtExpiresIn })

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret)

export const extractBearerToken = (req) => {
  const header = req.headers.authorization
  if (!header) return null
  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}
