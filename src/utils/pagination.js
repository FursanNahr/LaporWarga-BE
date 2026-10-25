/**
 * Cursor pagination untuk infinite scroll.
 * Pola pakai di service:
 *
 *   const rows = await prisma.xxx.findMany({ ..., orderBy: { id: 'desc' }, ...cursorArgs(cursor, limit) })
 *   const { items, hasMore, nextCursor } = sliceCursorPage(rows, limit)
 *
 * Kita ambil limit + 1 baris; baris ekstra hanya penanda "masih ada halaman berikutnya".
 */
export const cursorArgs = (cursor, limit) => ({
  take: limit + 1,
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
})

export const sliceCursorPage = (rows, limit) => {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].id : null
  return { items, hasMore, nextCursor }
}
