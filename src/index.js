import app from './app.js'
import { env } from './config/env.js'
import prisma from './config/prisma.js'
import { startJobs } from './jobs/index.js'

const server = app.listen(env.port, () => {
  startJobs()
  console.log(`Server jalan di http://localhost:${env.port}`)
})

// Matikan server dengan rapi (Ctrl+C / restart oleh --watch): selesaikan request, tutup koneksi database.
const shutdown = (signal) => {
  console.log(`${signal} diterima, menutup server...`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
