import { z } from 'zod'
import { paginationQuery } from './common.validator.js'

/** GET /api/notifications?unread=true&cursor=...&limit=... */
export const listNotificationsQuery = paginationQuery.extend({
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})
