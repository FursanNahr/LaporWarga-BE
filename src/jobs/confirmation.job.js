import { CONFIRMATION } from '../config/constants.js'
import { runConfirmationCheck } from '../services/confirmation.service.js'

const runOnce = async () => {
  try {
    const result = await runConfirmationCheck()
    if (result.autoClosed > 0) {
      console.log(`[confirmation.job] ${result.autoClosed} laporan ditutup otomatis (pelapor tidak merespons)`)
    }
  } catch (error) {
    // Job gagal tidak boleh menjatuhkan server.
    console.error('[confirmation.job] gagal:', error.message)
  }
}

/** Jalan sekali saat server nyala, lalu berulang tiap CONFIRMATION.JOB_INTERVAL_MS. Mengembalikan fungsi berhenti. */
export const startConfirmationJob = () => {
  runOnce()
  const timer = setInterval(runOnce, CONFIRMATION.JOB_INTERVAL_MS)
  timer.unref()
  return () => clearInterval(timer)
}