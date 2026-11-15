import { startSlaJob } from './sla.job.js'
import { startConfirmationJob } from './confirmation.job.js'

/** Daftarkan job baru di sini. Mengembalikan fungsi untuk menghentikan semuanya. */
export const startJobs = () => {
  const stoppers = [startSlaJob()]
  return () => stoppers.forEach((stop) => stop())
}

const stoppers = [startSlaJob(), startConfirmationJob()]