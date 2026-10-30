/**
 * Bandingkan data sekarang dengan perubahan yang diminta.
 * Hanya kolom yang benar-benar berubah yang dikembalikan, untuk update dan log audit.
 */
export const pickChanges = (current, updates) => {
  const oldValue = {}
  const newValue = {}

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === current[key]) continue
    oldValue[key] = current[key] ?? null
    newValue[key] = value
  }

  return { oldValue, newValue, changed: Object.keys(newValue).length > 0 }
}