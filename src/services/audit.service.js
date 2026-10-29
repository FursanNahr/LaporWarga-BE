import prisma from '../config/prisma.js'

export const AUDIT_ACTIONS = {
  REPORT_STATUS_CHANGED: 'REPORT_STATUS_CHANGED',
  REPORT_PROGRESS_ADDED: 'REPORT_PROGRESS_ADDED',
}

/**
 * Catat log audit. SENGAJA hanya ada fungsi "tambah": tidak ada update/delete untuk tabel AuditLog.
 *
 * `db` boleh diisi `tx` dari prisma.$transaction supaya log tersimpan atomik bersama perubahan datanya
 * (perubahan gagal = log tidak tercatat, perubahan berhasil = log pasti tercatat).
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
      oldValue,
      newValue,
      ipAddress: ipAddress?.slice(0, 45),
    },
  })
