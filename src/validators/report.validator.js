import { z } from 'zod'
import { ReportStatus } from '@prisma/client'
import { GEO, PUBLIC_REPORT_STATUSES } from '../config/constants.js'
import { idField, paginationQuery } from './common.validator.js'

const latitude = z.coerce.number().min(-90, 'Latitude tidak valid').max(90, 'Latitude tidak valid')
const longitude = z.coerce.number().min(-180, 'Longitude tidak valid').max(180, 'Longitude tidak valid')

/**
 * POST /api/reports (multipart/form-data, jadi semua nilai datang sebagai string).
 * File foto ditangani multer, bukan skema ini.
 */
export const createReportBody = z
  .object({
    description: z
      .string()
      .trim()
      .min(10, 'Deskripsi minimal 10 karakter')
      .max(2000, 'Deskripsi maksimal 2000 karakter'),
    latitude,
    longitude,
    address: z.string().trim().max(255, 'Alamat maksimal 255 karakter').optional(),
    subcategoryId: idField.optional(),
    agencyId: idField.optional(),
    districtId: idField.optional(),
    isAnonymous: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })
  .refine((data) => data.subcategoryId || data.agencyId, {
    message: 'Pilih subjenis atau instansi',
    path: ['subcategoryId'],
  })

const coordinateRefine = [
  (data) => (data.lat === undefined) === (data.lng === undefined),
  { message: 'lat dan lng harus dikirim bersamaan', path: ['lat'] },
]

/** GET /api/reports (feed publik) */
export const listReportsQuery = paginationQuery
  .extend({
    status: z.enum(PUBLIC_REPORT_STATUSES).optional(),
    subcategoryId: idField.optional(),
    agencyId: idField.optional(),
    districtId: idField.optional(),
    q: z.string().trim().min(2, 'Kata kunci minimal 2 karakter').max(100).optional(),
    lat: latitude.optional(),
    lng: longitude.optional(),
    radius: z.coerce.number().min(50).max(GEO.MAX_RADIUS_M).optional(), // meter
  })
  .refine(...coordinateRefine)

/** GET /api/reports/me (semua status boleh difilter, karena ini laporan milik sendiri) */
export const listMyReportsQuery = paginationQuery.extend({
  status: z.enum(Object.values(ReportStatus)).optional(),
})
