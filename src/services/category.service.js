import prisma from '../config/prisma.js'

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
