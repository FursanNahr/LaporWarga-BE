import { CommentKind, CommentMediaType, NotificationType, Role } from '@prisma/client'
import prisma from '../config/prisma.js'
import { COMMENT, PUBLIC_REPORT_STATUSES, UPLOAD } from '../config/constants.js'
import { AppError } from '../utils/AppError.js'
import { deleteByPublicUrls, toPublicUrl } from '../utils/file.js'
import { cursorArgs, sliceCursorPage } from '../utils/pagination.js'
import { notifyReportFollowers, notifyUser } from './notification.service.js'

// ---------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------

const COMMENT_BASE_SELECT = {
  id: true,
  reportId: true,
  parentId: true,
  kind: true,
  body: true,
  isHidden: true,
  hiddenReason: true,
  hiddenAt: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      agency: { select: { id: true, name: true } },
    },
  },
  photos: { select: { id: true, url: true, type: true }, orderBy: { id: 'asc' } },
}

// Komentar utama: ikut membawa jumlah balasan dan beberapa balasan terbaru.
const TOP_LEVEL_SELECT = {
  ...COMMENT_BASE_SELECT,
  _count: { select: { replies: true } },
  replies: { select: COMMENT_BASE_SELECT, orderBy: { id: 'desc' }, take: COMMENT.PREVIEW_REPLIES },
}

const REPORT_ACCESS_SELECT = {
  id: true,
  trackingCode: true,
  status: true,
  reporterId: true,
  agencyId: true,
  isAnonymous: true,
}

// ---------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------

const isAdmin = (user) => user?.role === Role.ADMIN

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/**
 * Ambil laporan sekaligus memastikan viewer boleh melihatnya.
 * Laporan yang belum publik hanya terlihat oleh pemilik dan admin; selain itu dijawab 404
 * supaya keberadaan laporan tidak bocor.
 */
const loadReportForAccess = async (reportId, viewer) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: REPORT_ACCESS_SELECT,
  })
  if (!report) throw AppError.notFound('Laporan tidak ditemukan')

  const isOwner = viewer?.id === report.reporterId
  if (!PUBLIC_REPORT_STATUSES.includes(report.status) && !isOwner && !isAdmin(viewer)) {
    throw AppError.notFound('Laporan tidak ditemukan')
  }
  return report
}

/** Petugas instansi hanya boleh berkomentar di laporan milik instansinya. */
const assertCanComment = (report, user) => {
  if (user.role === Role.INSTANSI && (!user.agencyId || report.agencyId !== user.agencyId)) {
    throw AppError.forbidden('Petugas hanya dapat berkomentar di laporan milik instansinya')
  }
}

/** multer memakai batas video (terbesar) untuk semua file, jadi batas foto dicek di sini. */
const assertFileSizes = (files) => {
  const maxImageBytes = UPLOAD.COMMENT_FILES.IMAGE_MAX_SIZE_MB * 1024 * 1024
  const tooBig = files.find((file) => file.mimetype.startsWith('image/') && file.size > maxImageBytes)
  if (tooBig) {
    throw AppError.badRequest(`Ukuran foto maksimal ${UPLOAD.COMMENT_FILES.IMAGE_MAX_SIZE_MB} MB`)
  }
}

// ---------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------

/**
 * Bentuk response komentar.
 * - Pelapor di laporan anonim disamarkan untuk semua orang kecuali admin dan dirinya sendiri.
 * - Komentar yang disembunyikan moderator hanya tampil placeholder, kecuali untuk admin.
 */
const toCommentDto = (comment, { viewer, report }) => {
  const viewerIsAdmin = isAdmin(viewer)
  const author = comment.user
  const isReporter = author.id === report.reporterId
  const isMine = viewer?.id === author.id
  const maskAuthor = report.isAnonymous && isReporter && !viewerIsAdmin && !isMine
  const concealed = comment.isHidden && !viewerIsAdmin

  const dto = {
    id: comment.id,
    reportId: comment.reportId,
    parentId: comment.parentId,
    kind: comment.kind,
    body: concealed ? null : comment.body,
    media: concealed ? [] : comment.photos,
    isHidden: comment.isHidden,
    hiddenMessage: concealed ? COMMENT.HIDDEN_PLACEHOLDER : null,
    author: maskAuthor
      ? {
          id: null,
          name: COMMENT.ANONYMOUS_NAME,
          avatarUrl: null,
          role: author.role,
          agencyName: null,
          isReporter: true,
          isAnonymous: true,
        }
      : {
          id: author.id,
          name: author.name,
          avatarUrl: author.avatarUrl,
          role: author.role,
          agencyName: author.agency?.name ?? null,
          isReporter,
          isAnonymous: report.isAnonymous && isReporter,
        },
    isMine,
    createdAt: comment.createdAt,
  }

  if (viewerIsAdmin && comment.isHidden) {
    dto.hiddenReason = comment.hiddenReason
    dto.hiddenAt = comment.hiddenAt
  }
  if (comment._count) dto.replyCount = comment._count.replies
  if (comment.replies) {
    // Diambil terbaru dulu supaya take=N dapat yang terbaru; ditampilkan dari yang lama ke baru.
    dto.replies = [...comment.replies].reverse().map((reply) => toCommentDto(reply, { viewer, report }))
  }
  return dto
}

// ---------------------------------------------------------------------
// Baca
// ---------------------------------------------------------------------

export const listComments = async ({ reportId, viewer, query }) => {
  const { cursor, limit } = query
  const report = await loadReportForAccess(reportId, viewer)

  const [rows, total] = await Promise.all([
    prisma.comment.findMany({
      where: { reportId, parentId: null },
      select: TOP_LEVEL_SELECT,
      orderBy: { id: 'desc' },
      ...cursorArgs(cursor, limit),
    }),
    // Semua komentar di laporan ini, termasuk balasan (untuk label "N komentar").
    prisma.comment.count({ where: { reportId } }),
  ])

  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)
  return {
    items: items.map((comment) => toCommentDto(comment, { viewer, report })),
    meta: { limit, hasMore, nextCursor, total },
  }
}

export const listReplies = async ({ commentId, viewer, query }) => {
  const { cursor, limit } = query

  const parent = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, reportId: true, parentId: true },
  })
  // Balasan tidak punya balasan lagi (hanya satu tingkat).
  if (!parent || parent.parentId) throw AppError.notFound('Komentar tidak ditemukan')

  const report = await loadReportForAccess(parent.reportId, viewer)

  const rows = await prisma.comment.findMany({
    where: { parentId: parent.id },
    select: COMMENT_BASE_SELECT,
    orderBy: { id: 'asc' },
    ...cursorArgs(cursor, limit),
  })

  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)
  return {
    items: items.map((comment) => toCommentDto(comment, { viewer, report })),
    meta: { limit, hasMore, nextCursor },
  }
}

// ---------------------------------------------------------------------
// Tulis
// ---------------------------------------------------------------------

export const createComment = async ({ author, reportId, data, files = [] }) => {
  assertFileSizes(files)

  const report = await loadReportForAccess(reportId, author)
  assertCanComment(report, author)

  // Reply hanya satu tingkat: membalas sebuah balasan dialihkan ke komentar induknya.
  let parent = null
  if (data.parentId) {
    parent = await prisma.comment.findUnique({
      where: { id: data.parentId },
      select: { id: true, reportId: true, parentId: true, userId: true },
    })
    if (!parent || parent.reportId !== report.id) {
      throw AppError.badRequest('Komentar yang dibalas tidak ditemukan pada laporan ini')
    }
    if (parent.parentId) {
      parent = await prisma.comment.findUnique({
        where: { id: parent.parentId },
        select: { id: true, reportId: true, parentId: true, userId: true },
      })
      if (!parent) throw AppError.badRequest('Komentar yang dibalas tidak ditemukan pada laporan ini')
    }
  }

  const isAnonymousAuthor = report.isAnonymous && author.id === report.reporterId
  const actorName = isAnonymousAuthor ? COMMENT.ANONYMOUS_NAME : author.name
  const isSanggahan = data.kind === CommentKind.SANGGAHAN
  const notificationType = isSanggahan ? NotificationType.SANGGAHAN : NotificationType.KOMENTAR
  const preview = truncate(data.body, COMMENT.NOTIFICATION_PREVIEW_LENGTH)
  const replyTargetId = parent && parent.userId !== author.id ? parent.userId : null

  // Komentar, lampiran, dan notifikasi berhasil semua atau gagal semua.
  const created = await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        reportId: report.id,
        userId: author.id,
        parentId: parent?.id,
        kind: data.kind,
        body: data.body,
        photos: {
          create: files.map((file) => ({
            url: toPublicUrl(UPLOAD.COMMENT_FILES.FOLDER, file.filename),
            type: file.mimetype.startsWith('video/') ? CommentMediaType.VIDEO : CommentMediaType.IMAGE,
          })),
        },
      },
      select: COMMENT_BASE_SELECT,
    })

    // Penulis komentar induk mendapat notifikasi khusus; ia dikeluarkan dari siaran
    // ke pengikut supaya tidak menerima dua notifikasi untuk satu komentar.
    if (replyTargetId) {
      await notifyUser(
        {
          userId: replyTargetId,
          reportId: report.id,
          type: notificationType,
          title: 'Balasan untuk komentar Anda',
          message: `${actorName} membalas komentar Anda di laporan ${report.trackingCode}: "${preview}"`,
        },
        tx,
      )
    }

    await notifyReportFollowers(
      {
        reportId: report.id,
        excludeUserId: author.id,
        excludeUserIds: replyTargetId ? [replyTargetId] : [],
        type: notificationType,
        title: isSanggahan ? 'Sanggahan baru' : 'Komentar baru',
        message: `${actorName} ${isSanggahan ? 'mengirim sanggahan' : 'berkomentar'} di laporan ${report.trackingCode}: "${preview}"`,
      },
      tx,
    )

    return comment
  })

  const dto = toCommentDto(created, { viewer: author, report })
  if (!parent) {
    dto.replyCount = 0
    dto.replies = []
  }
  return dto
}

export const deleteComment = async ({ id }) => {
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      photos: { select: { url: true } },
      replies: { select: { photos: { select: { url: true } } } },
    },
  })
  if (!comment) throw AppError.notFound('Komentar tidak ditemukan')

  const urls = [
    ...comment.photos.map((photo) => photo.url),
    ...comment.replies.flatMap((reply) => reply.photos.map((photo) => photo.url)),
  ]

  // onDelete: Cascade menghapus balasan dan baris lampirannya; file fisik dihapus sesudahnya.
  await prisma.comment.delete({ where: { id } })
  await deleteByPublicUrls(urls)

  return { id, deletedReplies: comment.replies.length }
}