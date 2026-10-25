import { AppError } from '../utils/AppError.js'

const SOURCES = ['params', 'query', 'body']

const formatIssues = (source, issues) =>
  issues.map((issue) => ({
    location: source,
    field: issue.path.map(String).join('.'),
    message: issue.message,
  }))

/**
 * Validasi request dengan skema zod.
 * Contoh: validate({ params: idParam, body: createXxxBody })
 *
 * Hasil yang sudah bersih (tipe sudah dikonversi, spasi sudah di-trim, dst)
 * ada di req.validated.params / .query / .body. Controller sebaiknya memakai itu, bukan req.body mentah.
 */
export const validate = (schemas) => (req, res, next) => {
  const validated = {}
  const errors = []

  for (const source of SOURCES) {
    const schema = schemas[source]
    if (!schema) continue

    const result = schema.safeParse(req[source] ?? {})
    if (result.success) validated[source] = result.data
    else errors.push(...formatIssues(source, result.error.issues))
  }

  if (errors.length > 0) return next(AppError.validation(errors))

  req.validated = { ...req.validated, ...validated }
  next()
}
