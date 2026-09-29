import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'

import { createHmac } from 'node:crypto'
import { BlockList, isIP } from 'node:net'

// https://www.cloudflare.com/ips/
const cloudflare = new BlockList()
for (const range of [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]) {
  const [network, prefix] = range.split('/') as [string, string]
  cloudflare.addSubnet(network, Number(prefix), isIP(network) === 6 ? 'ipv6' : 'ipv4')
}

const valid = (ip: string | undefined) => (ip && isIP(ip) ? ip : null)
const isCloudflare = (ip: string) => cloudflare.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4')

type RequestHeaders = Record<string, string | string[] | undefined>
const header = (headers: RequestHeaders, name: string) => {
  const value = headers[name]
  return Array.isArray(value) ? value.join(',') : value
}

/**
 * Traefik drops a client-sent X-Forwarded-For and appends its own peer, so only the last entry is
 * trustworthy: a Cloudflare edge on proxied hosts, the visitor on DNS-only tenant domains.
 * `cf-connecting-ip` counts only behind that edge — anyone reaching the origin directly can send it.
 */
export const clientIp = (headers: RequestHeaders) => {
  const peer = valid(header(headers, 'x-forwarded-for')?.split(',').at(-1)?.trim())
  if (peer && isCloudflare(peer)) return valid(header(headers, 'cf-connecting-ip')?.trim()) ?? peer
  return peer
}

export const getIp = (event: H3Event): string =>
  clientIp(event.node.req.headers) ?? event.node.req.socket?.remoteAddress ?? '127.0.0.1'

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
