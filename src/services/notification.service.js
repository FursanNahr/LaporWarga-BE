import prisma from '../config/prisma.js'
import { AppError } from '../utils/AppError.js'
import { cursorArgs, sliceCursorPage } from '../utils/pagination.js'

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
  report: { select: { id: true, trackingCode: true } },
}

// ---------------------------------------------------------------------
// Dipanggil dari service lain saat ada kejadian pada sebuah laporan
// ---------------------------------------------------------------------

/**
 * Kirim notifikasi ke semua orang yang mengikuti sebuah laporan (pelapor otomatis mengikuti).
 * `excludeUserId` = pelaku aksi, supaya tidak menerima notifikasi dari aksinya sendiri.
 * `db` boleh diisi `tx` agar ikut satu transaksi dengan perubahan datanya.
 */
export const notifyReportFollowers = async (
  { reportId, excludeUserId, type, title, message },
  db = prisma,
) => {
  const followers = await db.reportFollow.findMany({
    where: { reportId, ...(excludeUserId && { userId: { not: excludeUserId } }) },
    select: { userId: true },
  })
  if (followers.length === 0) return 0

  await db.notification.createMany({
    data: followers.map(({ userId }) => ({ userId, reportId, type, title, message })),
  })
  return followers.length
}

// ---------------------------------------------------------------------
// Dipanggil controller (untuk semua role yang sudah login)
// ---------------------------------------------------------------------

export const listNotifications = async ({ userId, query }) => {
  const { cursor, limit, unread } = query

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unread && { isRead: false }) },
      select: NOTIFICATION_SELECT,
      orderBy: { id: 'desc' },
      ...cursorArgs(cursor, limit),
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ])

  const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)
  return { items, meta: { limit, hasMore, nextCursor, unreadCount } }
}

export const markAsRead = async ({ id, userId }) => {
  // Filter userId memastikan user hanya bisa mengubah notifikasi miliknya sendiri.
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
    select: { id: true },
  })
  if (!notification) throw AppError.notFound('Notifikasi tidak ditemukan')

  await prisma.notification.update({ where: { id }, data: { isRead: true } })
  return { id, isRead: true }
}

export const markAllAsRead = async (userId) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
  return { updated: count }
}
