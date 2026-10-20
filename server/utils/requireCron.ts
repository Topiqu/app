import type { H3Event } from 'h3'

import { timingSafeEqual } from 'node:crypto'

export const requireCron = (event: H3Event) => {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = getHeader(event, 'authorization')
  const expected = secret ? `Bearer ${secret}` : ''
  if (
    !secret ||
    !supplied ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw createError({ statusCode: 401, message: 'Unauthorized' })
}
