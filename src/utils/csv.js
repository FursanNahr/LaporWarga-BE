import { EXPORT } from '../config/constants.js'

const BOM = '\uFEFF' // supaya Excel membaca UTF-8 (huruf non-ASCII tidak rusak)
const FORMULA_START = /^[=+\-@\t\r]/

const escapeCell = (value) => {
  if (value === null || value === undefined) return ''
  let text = String(value)

  // Teks yang diawali = + - @ bisa dijalankan sebagai rumus oleh Excel. Angka tidak disentuh.
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`

  const needsQuotes = text.includes(EXPORT.DELIMITER) || /["\r\n]/.test(text)
  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text
}

/** columns: [{ header, value: (row) => ... }] */
export const toCsv = (columns, rows) => {
  const header = columns.map((column) => escapeCell(column.header)).join(EXPORT.DELIMITER)
  const lines = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(EXPORT.DELIMITER),
  )
  return `${BOM}${[header, ...lines].join('\r\n')}\r\n`
}