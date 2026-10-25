import { Role } from '@prisma/client'
import prisma from '../config/prisma.js'
import { AppError } from '../utils/AppError.js'
import { comparePassword, hashPassword } from '../utils/password.js'
import { signToken, verifyToken } from '../utils/jwt.js'

// Data user yang aman dikirim ke client (tanpa passwordHash).
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  agencyId: true,
  isAgencyHead: true,
  createdAt: true,
  agency: { select: { id: true, name: true } },
}

export const register = async ({ name, email, password }) => {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) throw AppError.conflict('Email sudah terdaftar')

  // Kalau dua request dengan email sama masuk bersamaan, constraint unique di database
  // yang menang dan errorHandler membalas 409 (P2002), jadi tetap aman.
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: Role.WARGA },
    select: PUBLIC_USER_SELECT,
  })

  return { user, token: signToken(user.id) }
}

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...PUBLIC_USER_SELECT, passwordHash: true, isActive: true },
  })

  // Pesan sengaja sama untuk "email tidak ada" dan "password salah" agar email tidak bisa ditebak.
  const isValid = user && (await comparePassword(password, user.passwordHash))
  if (!isValid) throw AppError.unauthorized('Email atau password salah')
  if (!user.isActive) throw AppError.forbidden('Akun Anda dinonaktifkan')

  const { passwordHash, isActive, ...publicUser } = user
  return { user: publicUser, token: signToken(user.id) }
}

/** Dipakai middleware authenticate & optionalAuth. */
export const getUserFromToken = async (token) => {
  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw AppError.unauthorized('Token tidak valid atau sudah kedaluwarsa')
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { ...PUBLIC_USER_SELECT, isActive: true },
  })
  if (!user || !user.isActive) throw AppError.unauthorized('Akun tidak ditemukan atau dinonaktifkan')

  return user
}
