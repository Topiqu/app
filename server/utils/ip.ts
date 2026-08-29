import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'

import { createHmac } from 'node:crypto'

export const getIp = (event: H3Event): string => {
  const xForwardedFor = event.node.req.headers['x-forwarded-for']
  return Array.isArray(xForwardedFor) ? xForwardedFor[0]! : xForwardedFor || '127.0.0.1'
}

/** Peppered: an IPv4 is four bytes, so a bare hash in a cache key is enumerable back to the address. */
export const ipKey = (event: H3Event): string =>
  createHmac('sha256', process.env.AUTH_SECRET || 'missing-auth-secret')
    .update(getIp(event))
    .digest('hex')

export const defineWrappedResponseHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>,
): EventHandler<T, D> =>
  defineEventHandler<T>(async (event) => {
    try {
      const response = await handler(event)
      return { response }
    } catch (err) {
      return { err }
    }
  })
