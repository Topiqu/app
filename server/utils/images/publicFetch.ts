import type { LookupAddress } from 'node:dns'
import type { IncomingMessage } from 'node:http'

import https from 'node:https'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { pipeline, Readable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

const blockedIpv4 = (address: string) => {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    a! >= 224
  )
}

const blockedIpv6 = (address: string) => {
  const normalized = address.toLowerCase().split('%')[0]!
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)) return true
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  return mapped ? blockedIpv4(mapped) : false
}

/** Dynamic first-party media cannot use a static hostname allowlist. Resolve every target and
 * reject all non-public addresses before each no-redirect fetch. */
export const assertPublicHttpsUrl = async (input: string | URL) => (await resolvePublicHttpsUrl(input)).url

const resolvePublicHttpsUrl = async (input: string | URL) => {
  const url = input instanceof URL ? input : new URL(input)
  if (url.protocol !== 'https:' || url.port || url.username || url.password)
    throw new Error('Official media URL must use public HTTPS')
  if (!url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.localhost'))
    throw new Error('Official media host is not public')

  if (isIP(url.hostname) || /\.(?:local|internal|home|test|invalid|example)$/i.test(url.hostname))
    throw new Error('Official media host must be a public domain')

  const addresses = await lookup(url.hostname, { all: true })
  if (
    !addresses.length ||
    addresses.some(({ address, family }) => (family === 4 ? blockedIpv4(address) : blockedIpv6(address)))
  )
    throw new Error('Official media host resolved to a non-public address')
  return { url, addresses }
}

export const readLimitedBody = async (response: Response, maxBytes: number) => {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error('Official media response is too large')
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maxBytes) {
      await reader.cancel()
      throw new Error('Official media response is too large')
    }
    chunks.push(value)
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

const DECODERS = { gzip: createGunzip, 'x-gzip': createGunzip, deflate: createInflate, br: createBrotliDecompress }

const toResponse = (message: IncomingMessage) => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(message.headers))
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  const status = message.statusCode ?? 502
  if ([204, 205, 304].includes(status)) {
    message.resume()
    return new Response(null, { status, headers })
  }
  const encoding = headers.get('content-encoding')?.trim().toLowerCase() as keyof typeof DECODERS | undefined
  const decoder = encoding ? DECODERS[encoding] : undefined
  if (decoder) {
    // The declared length is of the compressed bytes; readLimitedBody must count what it actually reads.
    headers.delete('content-encoding')
    headers.delete('content-length')
  }
  // pipeline, not pipe: a socket error or timeout must reach the reader instead of hanging it.
  const body = decoder ? pipeline(message, decoder(), () => {}) : message
  return new Response(Readable.toWeb(body) as ReadableStream<Uint8Array>, { status, headers })
}

/**
 * Connects to exactly the addresses that passed the public-network check. A plain fetch would
 * resolve the host a second time, and a rebinding DNS answer could point that second lookup at
 * 169.254.169.254 or the local network.
 */
const requestPinned = (url: URL, addresses: LookupAddress[], timeoutMs: number) =>
  new Promise<Response>((resolve, reject) => {
    const request = https.request(
      url,
      {
        headers: {
          'User-Agent': `Topiqu/1.0 (https://${process.env.BASE_DOMAIN || 'topiqu.com'})`,
          'Accept-Encoding': 'gzip, deflate, br',
        },
        lookup: (_hostname, options, callback) =>
          options.all ? callback(null, addresses) : callback(null, addresses[0]!.address, addresses[0]!.family),
      },
      (message) => {
        message.on('close', () => clearTimeout(timer))
        resolve(toResponse(message))
      },
    )
    // Covers the body too, like AbortSignal.timeout on fetch did.
    const timer = setTimeout(() => request.destroy(new Error('Official media request timeout')), timeoutMs)
    request.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    request.end()
  })

export const fetchPublicUrl = async (input: string | URL, timeoutMs = 8_000) => {
  let target = await resolvePublicHttpsUrl(input)
  for (let hop = 0; hop <= 3; hop += 1) {
    const response = await requestPinned(target.url, target.addresses, timeoutMs)
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location || hop === 3) throw new Error('Official media redirect chain is invalid or too long')
    target = await resolvePublicHttpsUrl(new URL(location, target.url))
  }
  throw new Error('Official media redirect chain is too long')
}
