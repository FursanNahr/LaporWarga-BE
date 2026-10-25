/**
 * Format response sukses yang seragam:
 * { success: true, message, data, meta? }
 * (format error ada di middlewares/errorHandler.js)
 */
export const sendSuccess = (res, { statusCode = 200, message = 'Berhasil', data = null, meta } = {}) => {
  const body = { success: true, message, data }
  if (meta) body.meta = meta
  return res.status(statusCode).json(body)
}
