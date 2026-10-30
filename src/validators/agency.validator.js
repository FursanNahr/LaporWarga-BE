import { z } from 'zod'
import { idField, paginationQuery } from './common.validator.js'
import { boolQuery } from './admin.validator.js'

const agencyName = z.string().trim().min(3, 'Nama instansi minimal 3 karakter').max(150)
const description = z.string().trim().max(2000, 'Deskripsi maksimal 2000 karakter')
const personName = z.string().trim().min(2, 'Nama minimal 2 karakter').max(100)
// Batas 72 karena bcrypt hanya membaca 72 byte pertama.
const password = z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password maksimal 72 karakter')

const hasAnyField = [
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: 'Tidak ada data yang diubah' },
]

// ---- Instansi ----

/** GET /api/admin/agencies (jumlah instansi kecil, jadi tanpa pagination) */
export const listAgenciesQuery = z.object({
  isActive: boolQuery.optional(),
  q: z.string().trim().min(1).max(100).optional(),
})

export const createAgencyBody = z.object({
  name: agencyName,
  description: description.optional(),
})

export const updateAgencyBody = z
  .object({
    name: agencyName.optional(),
    description: description.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(...hasAnyField)

// ---- Akun petugas ----

export const listStaffQuery = paginationQuery.extend({
  agencyId: idField.optional(),
  isActive: boolQuery.optional(),
  q: z.string().trim().min(2, 'Kata kunci minimal 2 karakter').max(100).optional(),
})

export const createStaffBody = z.object({
  name: personName,
  email: z.string().trim().toLowerCase().email('Email tidak valid').max(191),
  password,
  agencyId: idField,
  isAgencyHead: z.boolean().default(false), // atasan: penerima eskalasi SLA
})

/** PATCH: password di sini = reset password oleh admin. Email tidak bisa diubah. */
export const updateStaffBody = z
  .object({
    name: personName.optional(),
    agencyId: idField.optional(),
    isAgencyHead: z.boolean().optional(),
    isActive: z.boolean().optional(),
    password: password.optional(),
  })
  .refine(...hasAnyField)