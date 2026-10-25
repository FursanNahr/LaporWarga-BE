/**
 * Membungkus controller async agar error otomatis diteruskan ke errorHandler.
 * (Express 5 sudah melakukannya sendiri, tapi ini aman dipakai di Express 4 maupun 5.)
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
