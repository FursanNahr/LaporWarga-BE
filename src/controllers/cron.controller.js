import * as confirmationService from '../services/confirmation.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'
import * as slaService from '../services/sla.service.js'

export const runSlaCheck = asyncHandler(async (req, res) => {
  const data = await slaService.runSlaCheck()
  sendSuccess(res, { message: 'Pengecekan SLA selesai', data })
})

// Dipanggil oleh Vercel Cron (lihat vercel.json). Di Vercel, setInterval di src/jobs/ tidak jalan
// karena fungsi serverless tidak hidup terus, jadi tugas terjadwal dipicu lewat endpoint ini.

/** Tutup otomatis laporan MENUNGGU_KONFIRMASI yang melewati batas waktu konfirmasi. */
export const runConfirmationCheck = asyncHandler(async (req, res) => {
  const data = await confirmationService.runConfirmationCheck()
  sendSuccess(res, { message: 'Pengecekan konfirmasi selesai', data })
})
