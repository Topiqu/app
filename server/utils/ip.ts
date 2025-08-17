import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'

export const getIp = (event: H3Event): string => {
  const xForwardedFor = event.node.req.headers['x-forwarded-for']
  return Array.isArray(xForwardedFor) ? xForwardedFor[0]! : xForwardedFor || '127.0.0.1'
}

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
