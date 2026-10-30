import { SLA } from '../config/constants.js'
import { runSlaCheck } from '../services/sla.service.js'

const runOnce = async () => {
  try {
    const result = await runSlaCheck()
    if (result.becameOverdue > 0) {
      console.log(`[sla.job] ${result.becameOverdue} laporan baru melewati batas SLA`)
    }
  } catch (error) {
    // Job gagal tidak boleh menjatuhkan server.
    console.error('[sla.job] gagal:', error.message)
  }
}

/** Jalan sekali saat server nyala, lalu berulang tiap SLA.JOB_INTERVAL_MS. Mengembalikan fungsi berhenti. */
export const startSlaJob = () => {
  runOnce()
  const timer = setInterval(runOnce, SLA.JOB_INTERVAL_MS)
  timer.unref() // timer ini saja tidak menahan proses agar tetap hidup
  return () => clearInterval(timer)
}