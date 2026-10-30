import { NotificationType } from '@prisma/client'
import prisma from '../config/prisma.js'
import { AppError } from '../utils/AppError.js'
import { cursorArgs, sliceCursorPage } from '../utils/pagination.js'
import { clip } from '../utils/text.js'
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js'

// Moderasi komentar (admin). Komentar disembunyikan, bukan dihapus, supaya jejaknya tetap ada.
// Fungsi buat/baca komentar untuk warga nanti boleh digabung ke comment.service.js.

const COMMENT_SELECT = {
  id: true,
  kind: true,
  body: true,
  isHidden: true,
  hiddenReason: true,
  hiddenAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
  hiddenBy: { select: { id: true, name: true } },
  report: { select: { id: true, trackingCode: true } },
  photos: { select: { id: true, url: true } },
}

export const listCommentsForModeration = async ({ query }) => {
  const { cursor, limit, hidden, reportId, kind, q } = query

  const rows = await prisma.comment.findMany({
    where: {
      ...(hidden !== undefined && { isHidden: hidden }),
      ...(reportId && { reportId }),
      ...(kind && { kind }),
      ...(q && { body: { contains: q } }),
    },
    select: COMMENT_SELECT,
    orderBy: { id: 'desc' },
    ...cursorArgs(cursor, limit),
  })
  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)

  return { items, meta: { limit, hasMore, nextCursor } }
}

export const moderateComment = async ({ id, admin, data, ipAddress }) => {
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      body: true,
      isHidden: true,
      hiddenReason: true,
      report: { select: { id: true, trackingCode: true } },
    },
  })
  if (!comment) throw AppError.notFound('Komentar tidak ditemukan')
  if (comment.isHidden === data.hidden) {
    throw AppError.conflict(
      data.hidden ? 'Komentar sudah disembunyikan' : 'Komentar sedang tidak disembunyikan',
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id },
      data: data.hidden
        ? { isHidden: true, hiddenReason: data.reason, hiddenById: admin.id, hiddenAt: new Date() }
        : { isHidden: false, hiddenReason: null, hiddenById: null, hiddenAt: null },
    })

    await recordAudit(
      {
        actorId: admin.id,
        action: data.hidden ? AUDIT_ACTIONS.COMMENT_HIDDEN : AUDIT_ACTIONS.COMMENT_UNHIDDEN,
        entityType: 'Comment',
        entityId: id,
        oldValue: { isHidden: comment.isHidden, hiddenReason: comment.hiddenReason },
        newValue: {
          isHidden: data.hidden,
          hiddenReason: data.hidden ? data.reason : null,
          reportId: comment.report.id,
          commentExcerpt: clip(comment.body, 200),
        },
        ipAddress,
      },
      tx,
    )

    if (data.hidden && comment.userId !== admin.id) {
      await tx.notification.create({
        data: {
          userId: comment.userId,
          reportId: comment.report.id,
          type: NotificationType.KOMENTAR,
          title: 'Komentar disembunyikan',
          message: clip(
            `Komentar Anda pada laporan ${comment.report.trackingCode} disembunyikan moderator. Alasan: ${data.reason}`,
            500,
          ),
        },
      })
    }
  })

  return prisma.comment.findUnique({ where: { id }, select: COMMENT_SELECT })
}