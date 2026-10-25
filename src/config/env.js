import 'dotenv/config'

const requireEnv = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Variabel ${name} belum diisi di file .env`)
  }
  return value
}

const parseList = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3000,

  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Contoh: CORS_ORIGIN="http://localhost:5173,https://laporwarga.id"
  // Dikosongkan = semua origin diizinkan (hanya untuk development).
  corsOrigin: process.env.CORS_ORIGIN ? parseList(process.env.CORS_ORIGIN) : true,
})
