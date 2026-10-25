import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { UPLOAD } from './config/constants.js'
import routes from './routes/index.js'
import { notFound } from './middlewares/notFound.js'
import { errorHandler } from './middlewares/errorHandler.js'

const app = express()

app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())

// Foto bisa dibuka lewat http://localhost:3000/uploads/reports/<nama-file>
app.use(UPLOAD.PUBLIC_PATH, express.static(UPLOAD.ROOT_DIR))

app.use('/api', routes)

// Dua middleware ini HARUS paling bawah, setelah semua route.
app.use(notFound)
app.use(errorHandler)

export default app
