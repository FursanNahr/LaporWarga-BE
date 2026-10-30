import { Role } from '@prisma/client'
import prisma from '../config/prisma.js'
import { AppError } from '../utils/AppError.js'
import { pickChanges } from '../utils/diff.js'
import { cursorArgs, sliceCursorPage } from '../utils/pagination.js'
import { hashPassword } from '../utils/password.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'

// Kelola instansi (Agency) dan akun petugasnya (User role INSTANSI).
// Tidak ada hapus permanen: akun punya riwayat (timeline, log audit), jadi cukup dinonaktifkan.

// =====================================================================
// INSTANSI
// =====================================================================

const AGENCY_SELECT = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { users: { where: { role: Role.INSTANSI } }, subcategories: true, reports: true },
  },
}

const toAgencyDto = ({ _count, ...agency }) => ({
  ...agency,
  counts: { staff: _count.users, subcategories: _count.subcategories, reports: _count.reports },
})

const getAgencyDto = async (id) => {
  const agency = await prisma.agency.findUnique({ where: { id }, select: AGENCY_SELECT })
  if (!agency) throw AppError.notFound('Instansi tidak ditemukan')
  return toAgencyDto(agency)
}

const ensureNameFree = async (name, exceptId) => {
  const existing = await prisma.agency.findFirst({
    where: { name, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true },
  })
  if (existing) throw AppError.conflict('Nama instansi sudah dipakai')
}

export const listAgencies = async ({ query }) => {
  const { isActive, q } = query
  const agencies = await prisma.agency.findMany({
    where: { ...(isActive !== undefined && { isActive }), ...(q && { name: { contains: q } }) },
    select: AGENCY_SELECT,
    orderBy: { name: 'asc' },
  })
  return agencies.map(toAgencyDto)
}

export const createAgency = async ({ data, admin, ipAddress }) => {
  await ensureNameFree(data.name)

  const id = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({
      data: { name: data.name, description: data.description || null },
      select: { id: true },
    })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.AGENCY_CREATED,
        entityType: 'Agency',
        entityId: agency.id,
        newValue: { name: data.name, description: data.description || null },
        ipAddress,
      },
      tx,
    )
    return agency.id
  })

  return getAgencyDto(id)
}

export const updateAgency = async ({ id, data, admin, ipAddress }) => {
  const current = await prisma.agency.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, isActive: true },
  })
  if (!current) throw AppError.notFound('Instansi tidak ditemukan')

  const { oldValue, newValue, changed } = pickChanges(current, data)
  if (!changed) return getAgencyDto(id)
  if (newValue.name) await ensureNameFree(newValue.name, id)

  await prisma.$transaction(async (tx) => {
    await tx.agency.update({ where: { id }, data: newValue })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.AGENCY_UPDATED,
        entityType: 'Agency',
        entityId: id,
        oldValue,
        newValue,
        ipAddress,
      },
      tx,
    )
  })

  return getAgencyDto(id)
}

// =====================================================================
// AKUN PETUGAS
// =====================================================================

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  isAgencyHead: true,
  agencyId: true,
  createdAt: true,
  agency: { select: { id: true, name: true, isActive: true } },
}

const assertActiveAgency = async (agencyId) => {
  const agency = await prisma.agency.findFirst({
    where: { id: agencyId, isActive: true },
    select: { id: true },
  })
  if (!agency) throw AppError.badRequest('Instansi tidak ditemukan atau tidak aktif')
}

const findStaff = async (id, select = STAFF_SELECT) => {
  const staff = await prisma.user.findFirst({ where: { id, role: Role.INSTANSI }, select })
  if (!staff) throw AppError.notFound('Akun petugas tidak ditemukan')
  return staff
}

export const listStaff = async ({ query }) => {
  const { cursor, limit, agencyId, isActive, q } = query

  const rows = await prisma.user.findMany({
    where: {
      role: Role.INSTANSI,
      ...(agencyId && { agencyId }),
      ...(isActive !== undefined && { isActive }),
      ...(q && { OR: [{ name: { contains: q } }, { email: { contains: q } }] }),
    },
    select: STAFF_SELECT,
    orderBy: { id: 'desc' },
    ...cursorArgs(cursor, limit),
  })
  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)

  return { items, meta: { limit, hasMore, nextCursor } }
}

export const createStaff = async ({ data, admin, ipAddress }) => {
  await assertActiveAgency(data.agencyId)

  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } })
  if (existing) throw AppError.conflict('Email sudah terdaftar')

  const passwordHash = await hashPassword(data.password) // di luar transaksi: hashing lambat

  const id = await prisma.$transaction(async (tx) => {
    const staff = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: Role.INSTANSI,
        agencyId: data.agencyId,
        isAgencyHead: data.isAgencyHead,
      },
      select: { id: true },
    })
    // Password tidak pernah dicatat di log audit.
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.STAFF_CREATED,
        entityType: 'User',
        entityId: staff.id,
        newValue: {
          name: data.name,
          email: data.email,
          agencyId: data.agencyId,
          isAgencyHead: data.isAgencyHead,
        },
        ipAddress,
      },
      tx,
    )
    return staff.id
  })

  return findStaff(id)
}

export const updateStaff = async ({ id, data, admin, ipAddress }) => {
  const current = await findStaff(id, {
    id: true,
    name: true,
    agencyId: true,
    isAgencyHead: true,
    isActive: true,
  })

  const { password, ...fields } = data
  const { oldValue, newValue, changed } = pickChanges(current, fields)
  if (!changed && !password) return findStaff(id)

  if (newValue.agencyId) await assertActiveAgency(newValue.agencyId)
  const passwordHash = password ? await hashPassword(password) : undefined

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { ...newValue, ...(passwordHash && { passwordHash }) } })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.STAFF_UPDATED,
        entityType: 'User',
        entityId: id,
        oldValue,
        newValue: { ...newValue, ...(password && { passwordReset: true }) },
        ipAddress,
      },
      tx,
    )
  })

  return findStaff(id)
}