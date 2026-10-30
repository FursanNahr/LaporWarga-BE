import { z } from 'zod'
import { idField } from './common.validator.js'

const categoryName = z.string().trim().min(3, 'Nama kategori minimal 3 karakter').max(100)
const subcategoryName = z.string().trim().min(3, 'Nama subjenis minimal 3 karakter').max(100)

export const categoryBody = z.object({ name: categoryName })

/** POST /api/admin/categories/:id/subcategories */
export const createSubcategoryBody = z.object({
  name: subcategoryName,
  agencyId: idField, // instansi yang menangani subjenis ini
})

/** PATCH /api/admin/subcategories/:id. categoryId = pindah ke kategori lain. */
export const updateSubcategoryBody = z
  .object({
    name: subcategoryName.optional(),
    agencyId: idField.optional(),
    categoryId: idField.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Tidak ada data yang diubah',
  })