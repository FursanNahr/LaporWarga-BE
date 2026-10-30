import { z } from 'zod'
import { CommentKind, ReportStatus } from '@prisma/client'
import { ADMIN_ACTIONS, SLA, SLA_STAGES } from '../config/constants.js'
import { endOfZoneDay, isRealDate, startOfZoneDay } from '../utils/date.js'
import { idField, paginationQuery } from './common.validator.js'

// ---- Helper bersama (juga dipakai agency.validator.js) ----

/** Query string 'true' | 'false' -> boolean. Pakai .optional() jika boleh tidak dikirim. */
export const boolQuery = z.enum(['true', 'false']).transform((value) => value === 'true')

/** 'YYYY-MM-DD' (WIB) -> Date. edge 'end' = akhir hari, supaya dateTo ikut menghitung harinya. */
const dateField = (edge) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .refine(isRealDate, { message: 'Tanggal tidak valid' })
    .transform((value) => (edge === 'end' ? endOfZoneDay(value) : startOfZoneDay(value)))

const keyword = z.string().trim().min(2, 'Kata kunci minimal 2 karakter').max(100)

// refine dipasang paling akhir (setelah extend), karena .extend() tidak boleh dipanggil setelah .refine().
const dateRangeRule = [
  (data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo,
  { message: 'dateFrom tidak boleh setelah dateTo', path: ['dateTo'] },
]

// ---- Laporan ----

const reportFilterShape = {
  status: z.enum(Object.values(ReportStatus)).optional(),
  agencyId: idField.optional(),
  subcategoryId: idField.optional(),
  districtId: idField.optional(),
  isOverdue: boolQuery.optional(),
  merged: boolQuery.optional(), // true = hanya laporan hasil gabungan
  dateFrom: dateField('start').optional(),
  dateTo: dateField('end').optional(),
  q: keyword.optional(),
}

/** GET /api/admin/reports. order=asc untuk antrean verifikasi (terlama dulu). */
export const listAdminReportsQuery = paginationQuery
  .extend({ ...reportFilterShape, order: z.enum(['asc', 'desc']).default('desc') })
  .refine(...dateRangeRule)

/** GET /api/admin/reports/export (filter sama, tanpa pagination) */
export const exportReportsQuery = z.object(reportFilterShape).refine(...dateRangeRule)

/** POST /api/admin/reports/:id/verification */
export const verifyReportBody = z
  .object({
    action: z.enum(Object.keys(ADMIN_ACTIONS), {
      message: `action harus salah satu dari: ${Object.keys(ADMIN_ACTIONS).join(', ')}`,
    }),
    reason: z.string().trim().min(5, 'Alasan minimal 5 karakter').max(1000).optional(),
    agencyId: idField.optional(),
    note: z.string().trim().max(2000, 'Catatan maksimal 2000 karakter').optional(),
  })
  .refine((data) => data.action !== 'TOLAK' || Boolean(data.reason), {
    message: 'Alasan penolakan wajib diisi',
    path: ['reason'],
  })
  .refine((data) => data.action === 'TERUSKAN' || data.agencyId === undefined, {
    message: 'agencyId hanya untuk aksi TERUSKAN',
    path: ['agencyId'],
  })

/** POST /api/admin/reports/:id/merge. :id = laporan duplikat, targetId = laporan utama. */
export const mergeReportBody = z.object({
  targetId: idField,
  note: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional(),
})

// ---- Moderasi komentar ----

export const listCommentsQuery = paginationQuery.extend({
  hidden: boolQuery.optional(),
  reportId: idField.optional(),
  kind: z.enum(Object.values(CommentKind)).optional(),
  q: keyword.optional(),
})

/** PATCH /api/admin/comments/:id/moderation. Menyembunyikan wajib beralasan. */
export const moderateCommentBody = z
  .object({
    hidden: z.boolean({ message: 'hidden harus true atau false' }),
    reason: z.string().trim().min(3, 'Alasan minimal 3 karakter').max(255).optional(),
  })
  .refine((data) => !data.hidden || Boolean(data.reason), {
    message: 'Alasan wajib diisi saat menyembunyikan komentar',
    path: ['reason'],
  })

// ---- SLA ----

/** PUT /api/admin/sla. Boleh mengirim sebagian tahap. */
export const updateSlaBody = z
  .object({
    settings: z
      .array(
        z.object({
          stage: z.enum(SLA_STAGES, {
            message: `stage harus salah satu dari: ${SLA_STAGES.join(', ')}`,
          }),
          maxDays: z.coerce
            .number()
            .int('Batas hari harus bilangan bulat')
            .min(1, 'Batas hari minimal 1')
            .max(SLA.MAX_DAYS, `Batas hari maksimal ${SLA.MAX_DAYS}`),
        }),
      )
      .min(1, 'Minimal satu tahap')
      .max(SLA_STAGES.length),
  })
  .refine((data) => new Set(data.settings.map((item) => item.stage)).size === data.settings.length, {
    message: 'Setiap tahap hanya boleh muncul sekali',
    path: ['settings'],
  })

// ---- Log audit ----

export const listAuditLogsQuery = paginationQuery
  .extend({
    actorId: idField.optional(),
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(50).optional(),
    entityId: idField.optional(),
    dateFrom: dateField('start').optional(),
    dateTo: dateField('end').optional(),
  })
  .refine(...dateRangeRule)