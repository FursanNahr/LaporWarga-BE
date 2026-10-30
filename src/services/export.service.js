import prisma from '../config/prisma.js'
import { EXPORT, STATUS_LABEL } from '../config/constants.js'
import { toCsv } from '../utils/csv.js'
import { DAY_MS, toZoneDate, toZoneDateTime } from '../utils/date.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'
import { buildAdminWhere } from './adminReport.service.js'

const EXPORT_SELECT = {
  id: true,
  trackingCode: true,
  description: true,
  latitude: true,
  longitude: true,
  address: true,
  isAnonymous: true,
  status: true,
  rejectionReason: true,
  reopenCount: true,
  slaDueAt: true,
  isOverdue: true,
  resolvedAt: true,
  createdAt: true,
  reporter: { select: { name: true, email: true } },
  subcategory: { select: { name: true, category: { select: { name: true } } } },
  agency: { select: { name: true } },
  district: { select: { name: true } },
  mergedInto: { select: { trackingCode: true } },
}

const resolutionDays = (report) =>
  report.resolvedAt
    ? Math.round(((report.resolvedAt - report.createdAt) / DAY_MS) * 10) / 10
    : ''

// Admin boleh melihat identitas pelapor, termasuk laporan anonim (lihat aturan di report.service).
const COLUMNS = [
  { header: 'Kode laporan', value: (r) => r.trackingCode },
  { header: 'Tanggal lapor', value: (r) => toZoneDateTime(r.createdAt) },
  { header: 'Status', value: (r) => STATUS_LABEL[r.status] },
  { header: 'Kategori', value: (r) => r.subcategory?.category?.name },
  { header: 'Subjenis', value: (r) => r.subcategory?.name },
  { header: 'Instansi', value: (r) => r.agency?.name },
  { header: 'Kecamatan', value: (r) => r.district?.name },
  { header: 'Alamat', value: (r) => r.address },
  { header: 'Latitude', value: (r) => r.latitude },
  { header: 'Longitude', value: (r) => r.longitude },
  { header: 'Nama pelapor', value: (r) => r.reporter.name },
  { header: 'Email pelapor', value: (r) => r.reporter.email },
  { header: 'Lapor anonim', value: (r) => (r.isAnonymous ? 'Ya' : 'Tidak') },
  { header: 'Deskripsi', value: (r) => r.description },
  { header: 'Alasan penolakan', value: (r) => r.rejectionReason },
  { header: 'Dibuka kembali (kali)', value: (r) => r.reopenCount },
  { header: 'Batas SLA', value: (r) => toZoneDateTime(r.slaDueAt) },
  { header: 'Melewati SLA', value: (r) => (r.isOverdue ? 'Ya' : 'Tidak') },
  { header: 'Tanggal selesai', value: (r) => toZoneDateTime(r.resolvedAt) },
  { header: 'Lama penanganan (hari)', value: resolutionDays },
  { header: 'Digabung ke', value: (r) => r.mergedInto?.trackingCode },
]

/** CSV laporan dengan filter yang sama seperti daftar admin. Maksimal EXPORT.MAX_ROWS baris. */
export const buildReportsCsv = async ({ query, admin, ipAddress }) => {
  const rows = await prisma.report.findMany({
    where: buildAdminWhere(query),
    select: EXPORT_SELECT,
    orderBy: { id: 'desc' },
    take: EXPORT.MAX_ROWS,
  })

  await recordAudit({
    actorId: admin.id,
    action: AUDIT_ACTIONS.REPORTS_EXPORTED,
    entityType: 'Report',
    newValue: { rows: rows.length, filters: JSON.parse(JSON.stringify(query)) },
    ipAddress,
  })

  return {
    filename: `laporan-${toZoneDate(new Date()).replaceAll('-', '')}.csv`,
    csv: toCsv(COLUMNS, rows),
    truncated: rows.length === EXPORT.MAX_ROWS,
  }
}