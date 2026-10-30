import prisma from '../config/prisma.js'

/** Daftar kecamatan untuk dropdown filter. */
export const listDistricts = () =>
  prisma.district.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })