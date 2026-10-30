import prisma from '../config/prisma.js'
import { AppError } from '../utils/AppError.js'
import { pickChanges } from '../utils/diff.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'

// =====================================================================
// PUBLIK (dropdown di form laporan dan filter)
// =====================================================================

/** Kategori + subjenis + instansi penanganannya, untuk dropdown di form laporan. */
export const listCategories = () =>
  prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      subcategories: {
        where: { agency: { isActive: true } },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          agency: { select: { id: true, name: true } },
        },
      },
    },
  })

// =====================================================================
// ADMIN: kelola kategori, subjenis, dan pemetaannya ke instansi
// Skema belum punya isActive di Category/Subcategory, jadi data yang sudah dipakai
// tidak bisa dihapus (ditolak 409). Pindahkan subjenisnya ke instansi lain jika perlu.
// =====================================================================

const ADMIN_SUBCATEGORY_SELECT = {
  id: true,
  name: true,
  categoryId: true,
  agency: { select: { id: true, name: true, isActive: true } },
  _count: { select: { reports: true } },
}

const toSubcategoryDto = ({ _count, ...subcategory }) => ({
  ...subcategory,
  reportCount: _count.reports,
})

/** Semua kategori + subjenis, termasuk yang instansinya nonaktif, lengkap dengan jumlah laporan. */
export const listCategoriesAdmin = async () => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      subcategories: { orderBy: { name: 'asc' }, select: ADMIN_SUBCATEGORY_SELECT },
    },
  })
  return categories.map((category) => ({
    ...category,
    subcategories: category.subcategories.map(toSubcategoryDto),
  }))
}

const getCategoryAdmin = async (id) => {
  const category = (await listCategoriesAdmin()).find((item) => item.id === id)
  if (!category) throw AppError.notFound('Kategori tidak ditemukan')
  return category
}

const getSubcategoryAdmin = async (id) => {
  const subcategory = await prisma.subcategory.findUnique({
    where: { id },
    select: ADMIN_SUBCATEGORY_SELECT,
  })
  if (!subcategory) throw AppError.notFound('Subjenis tidak ditemukan')
  return toSubcategoryDto(subcategory)
}

const ensureCategoryNameFree = async (name, exceptId) => {
  const existing = await prisma.category.findFirst({
    where: { name, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true },
  })
  if (existing) throw AppError.conflict('Nama kategori sudah dipakai')
}

const ensureSubcategoryNameFree = async (categoryId, name, exceptId) => {
  const existing = await prisma.subcategory.findFirst({
    where: { categoryId, name, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true },
  })
  if (existing) throw AppError.conflict('Nama subjenis sudah dipakai di kategori ini')
}

const assertActiveAgency = async (agencyId) => {
  const agency = await prisma.agency.findFirst({
    where: { id: agencyId, isActive: true },
    select: { id: true },
  })
  if (!agency) throw AppError.badRequest('Instansi tidak ditemukan atau tidak aktif')
}

const assertCategoryExists = async (categoryId) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
  if (!category) throw AppError.notFound('Kategori tidak ditemukan')
}

// ---- Kategori ----

export const createCategory = async ({ data, admin, ipAddress }) => {
  await ensureCategoryNameFree(data.name)

  const id = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { name: data.name }, select: { id: true } })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.CATEGORY_CREATED,
        entityType: 'Category',
        entityId: category.id,
        newValue: { name: data.name },
        ipAddress,
      },
      tx,
    )
    return category.id
  })

  return getCategoryAdmin(id)
}

export const updateCategory = async ({ id, data, admin, ipAddress }) => {
  const current = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!current) throw AppError.notFound('Kategori tidak ditemukan')

  const { oldValue, newValue, changed } = pickChanges(current, data)
  if (!changed) return getCategoryAdmin(id)
  await ensureCategoryNameFree(newValue.name, id)

  await prisma.$transaction(async (tx) => {
    await tx.category.update({ where: { id }, data: newValue })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.CATEGORY_UPDATED,
        entityType: 'Category',
        entityId: id,
        oldValue,
        newValue,
        ipAddress,
      },
      tx,
    )
  })

  return getCategoryAdmin(id)
}

export const deleteCategory = async ({ id, admin, ipAddress }) => {
  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { subcategories: true } } },
  })
  if (!category) throw AppError.notFound('Kategori tidak ditemukan')
  if (category._count.subcategories > 0) {
    throw AppError.conflict(
      `Kategori masih punya ${category._count.subcategories} subjenis. Hapus atau pindahkan subjenisnya dulu.`,
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.CATEGORY_DELETED,
        entityType: 'Category',
        entityId: id,
        oldValue: { name: category.name },
        ipAddress,
      },
      tx,
    )
  })
}

// ---- Subjenis ----

export const createSubcategory = async ({ categoryId, data, admin, ipAddress }) => {
  await assertCategoryExists(categoryId)
  await assertActiveAgency(data.agencyId)
  await ensureSubcategoryNameFree(categoryId, data.name)

  const id = await prisma.$transaction(async (tx) => {
    const subcategory = await tx.subcategory.create({
      data: { name: data.name, categoryId, agencyId: data.agencyId },
      select: { id: true },
    })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.SUBCATEGORY_CREATED,
        entityType: 'Subcategory',
        entityId: subcategory.id,
        newValue: { name: data.name, categoryId, agencyId: data.agencyId },
        ipAddress,
      },
      tx,
    )
    return subcategory.id
  })

  return getSubcategoryAdmin(id)
}

/** Ubah nama, pindah kategori, atau ubah pemetaan instansi. Laporan lama tetap di instansinya semula. */
export const updateSubcategory = async ({ id, data, admin, ipAddress }) => {
  const current = await prisma.subcategory.findUnique({
    where: { id },
    select: { id: true, name: true, categoryId: true, agencyId: true },
  })
  if (!current) throw AppError.notFound('Subjenis tidak ditemukan')

  const { oldValue, newValue, changed } = pickChanges(current, data)
  if (!changed) return getSubcategoryAdmin(id)

  if (newValue.categoryId) await assertCategoryExists(newValue.categoryId)
  if (newValue.agencyId) await assertActiveAgency(newValue.agencyId)
  if (newValue.name || newValue.categoryId) {
    await ensureSubcategoryNameFree(
      newValue.categoryId ?? current.categoryId,
      newValue.name ?? current.name,
      id,
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.subcategory.update({ where: { id }, data: newValue })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.SUBCATEGORY_UPDATED,
        entityType: 'Subcategory',
        entityId: id,
        oldValue,
        newValue,
        ipAddress,
      },
      tx,
    )
  })

  return getSubcategoryAdmin(id)
}

export const deleteSubcategory = async ({ id, admin, ipAddress }) => {
  const subcategory = await prisma.subcategory.findUnique({
    where: { id },
    select: { id: true, name: true, categoryId: true, agencyId: true, _count: { select: { reports: true } } },
  })
  if (!subcategory) throw AppError.notFound('Subjenis tidak ditemukan')
  if (subcategory._count.reports > 0) {
    throw AppError.conflict(
      `Subjenis sudah dipakai ${subcategory._count.reports} laporan, jadi tidak bisa dihapus. Ubah pemetaan instansinya jika perlu.`,
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.subcategory.delete({ where: { id } })
    await recordAudit(
      {
        actorId: admin.id,
        action: AUDIT_ACTIONS.SUBCATEGORY_DELETED,
        entityType: 'Subcategory',
        entityId: id,
        oldValue: {
          name: subcategory.name,
          categoryId: subcategory.categoryId,
          agencyId: subcategory.agencyId,
        },
        ipAddress,
      },
      tx,
    )
  })
} 