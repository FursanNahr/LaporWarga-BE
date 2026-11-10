import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  connectionLimit: 5,
  connectTimeout: 10000,
})

const prisma = new PrismaClient({ adapter })

export default prisma