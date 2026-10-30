import prisma from '../config/prisma.js'
import { cursorArgs, sliceCursorPage } from '../utils/pagination.js'

// Nama aksi disimpan sebagai teks di AuditLog.action. Tambah di sini, jangan menulis string manual.
export const AUDIT_ACTIONS = {
  REPORT_STATUS_CHANGED: 'REPORT_STATUS_CHANGED', // verifikasi/tolak/teruskan (admin) dan alur instansi
  REPORT_PROGRESS_ADDED: 'REPORT_PROGRESS_ADDED',
  REPORT_MERGED: 'REPORT_MERGED',
  REPORTS_EXPORTED: 'REPORTS_EXPORTED',
  COMMENT_HIDDEN: 'COMMENT_HIDDEN',
  COMMENT_UNHIDDEN: 'COMMENT_UNHIDDEN',
  SLA_SETTINGS_UPDATED: 'SLA_SETTINGS_UPDATED',
  AGENCY_CREATED: 'AGENCY_CREATED',
  AGENCY_UPDATED: 'AGENCY_UPDATED',
  STAFF_CREATED: 'STAFF_CREATED',
  STAFF_UPDATED: 'STAFF_UPDATED',
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
  CATEGORY_DELETED: 'CATEGORY_DELETED',
  SUBCATEGORY_CREATED: 'SUBCATEGORY_CREATED',
  SUBCATEGORY_UPDATED: 'SUBCATEGORY_UPDATED',
  SUBCATEGORY_DELETED: 'SUBCATEGORY_DELETED',
}

/**
 * Catat satu kejadian. `db` boleh diisi `tx` supaya ikut satu transaksi dengan perubahan datanya.
 * Kolom Json tidak menerima null, jadi nilai kosong dikirim sebagai undefined.
 */
export const recordAudit = (
  { actorId, action, entityType, entityId, oldValue, newValue, ipAddress },
  db = prisma,
) =>
  db.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ?? undefined,
      newValue: newValue ?? undefined,
      ipAddress: ipAddress?.slice(0, 45),
    },
  })

// ---------------------------------------------------------------------
// Baca log (HANYA baca. Tabel ini tidak boleh punya update/delete.)
// ---------------------------------------------------------------------

export const listAuditActions = () => Object.values(AUDIT_ACTIONS)

export const listAuditLogs = async ({ query }) => {
  const { cursor, limit, actorId, action, entityType, entityId, dateFrom, dateTo } = query

  const rows = await prisma.auditLog.findMany({
    where: {
      ...(actorId && { actorId }),
      ...(action && { action }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...((dateFrom || dateTo) && {
        createdAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) },
      }),
    },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      oldValue: true,
      newValue: true,
      ipAddress: true,
      createdAt: true,
      actor: { select: { id: true, name: true, role: true } },
    },
    orderBy: { id: 'desc' },
    ...cursorArgs(cursor, limit),
  })
  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)

  // Untuk entri laporan, tampilkan kode tracking supaya mudah dibaca (bukan hanya id).
  const reportIds = [
    ...new Set(items.filter((i) => i.entityType === 'Report' && i.entityId).map((i) => i.entityId)),
  ]
  const reports = reportIds.length
    ? await prisma.report.findMany({
        where: { id: { in: reportIds } },
        select: { id: true, trackingCode: true },
      })
    : []
  const codeById = new Map(reports.map((report) => [report.id, report.trackingCode]))

  return {
    items: items.map((item) => ({
      ...item,
      entityLabel: item.entityType === 'Report' ? (codeById.get(item.entityId) ?? null) : null,
    })),
    meta: { limit, hasMore, nextCursor },
  }
}