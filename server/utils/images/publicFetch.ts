import type { LookupAddress } from 'node:dns'
import type { IncomingMessage } from 'node:http'

import https from 'node:https'
import { BlockList, isIP } from 'node:net'
import { Resolver } from 'node:dns/promises'
import { pipeline, Readable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

// BlockList normalizes dotted, hexadecimal and expanded IPv4-mapped IPv6 alike.
const nonPublicAddresses = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  nonPublicAddresses.addSubnet(network, prefix, 'ipv4')
for (const [network, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  nonPublicAddresses.addSubnet(network, prefix, 'ipv6')

// Only global unicast (and mapped public IPv4) may leave the server. This excludes
// local, multicast, NAT64, deprecated compatible and otherwise reserved IPv6 space.
const publicNetworks = new BlockList()
publicNetworks.addSubnet('0.0.0.0', 0, 'ipv4')
publicNetworks.addSubnet('2000::', 3, 'ipv6')

// Globally reachable exceptions within IANA's special-purpose allocations.
const publicSpecialAddresses = new BlockList()
for (const address of ['192.0.0.9', '192.0.0.10', '192.88.99.2']) publicSpecialAddresses.addAddress(address, 'ipv4')
for (const address of ['2001:1::1', '2001:1::2', '2001:1::3']) publicSpecialAddresses.addAddress(address, 'ipv6')
for (const [network, prefix] of [
  ['2001:3::', 32],
  ['2001:4:112::', 48],
  ['2001:20::', 28],
  ['2001:30::', 28],
] as const)
  publicSpecialAddresses.addSubnet(network, prefix, 'ipv6')

const blockedAddress = ({ address, family }: LookupAddress) => {
  if (![4, 6].includes(family) || isIP(address) !== family || address.includes('%')) return true
  const type = family === 4 ? 'ipv4' : 'ipv6'
  return (
    !publicNetworks.check(address, type) ||
    (nonPublicAddresses.check(address, type) && !publicSpecialAddresses.check(address, type))
  )
}

/** Dynamic first-party media cannot use a static hostname allowlist. Resolve every target and
 * reject all non-public addresses before each no-redirect fetch. */
const publicRequestDeadline = (timeoutMs: number, parent?: AbortSignal) => {
  const controller = new AbortController()
  const dispose = () => {
    clearTimeout(timer)
    parent?.removeEventListener('abort', abort)
  }
  const abort = () => {
    controller.abort(parent?.reason)
    dispose()
  }
  const timer = setTimeout(() => {
    controller.abort(new Error('Official media request timeout'))
    dispose()
  }, timeoutMs)
  if (parent?.aborted) abort()
  else parent?.addEventListener('abort', abort, { once: true })
  return { signal: controller.signal, dispose }
}

const resolveHostname = (hostname: string, signal: AbortSignal): Promise<LookupAddress[]> => {
  signal.throwIfAborted()
  const resolver = new Resolver({ timeout: 5000, tries: 1 })
  return new Promise((resolve, reject) => {
    const abort = () => {
      resolver.cancel()
      signal.removeEventListener('abort', abort)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
    Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]).then((answers) => {
      signal.removeEventListener('abort', abort)
      resolver.cancel()
      if (signal.aborted) return
      const addresses: LookupAddress[] = []
      for (const [index, answer] of answers.entries()) {
        if (answer.status === 'fulfilled') {
          addresses.push(...answer.value.map((address) => ({ address, family: index === 0 ? 4 : 6 })))
        } else if (!['ENODATA', 'ENOTFOUND'].includes((answer.reason as NodeJS.ErrnoException)?.code ?? '')) {
          reject(answer.reason)
          return
        }
      }
      resolve(addresses)
    }, reject)
  })
}

export const assertPublicHttpsUrl = async (input: string | URL, timeoutMs = 8000) => {
  const deadline = publicRequestDeadline(timeoutMs)
  try {
    return (await resolvePublicHttpsUrl(input, deadline.signal)).url
  } finally {
    deadline.dispose()
  }
}

const resolvePublicHttpsUrl = async (input: string | URL, signal: AbortSignal) => {
  const url = new URL(input)
  const hostname = url.hostname.replace(/\.$/, '')
  if (url.protocol !== 'https:' || url.port || url.username || url.password)
    throw new Error('Official media URL must use public HTTPS')
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost'))
    throw new Error('Official media host is not public')

  if (
    isIP(hostname.startsWith('[') ? hostname.slice(1, -1) : hostname) ||
    /(?:^|\.)(?:local|internal|home|test|invalid|example)$/i.test(hostname)
  )
    throw new Error('Official media host must be a public domain')

  url.hostname = hostname
  const addresses = await resolveHostname(hostname, signal)
  if (!addresses.length || addresses.some(blockedAddress))
    throw new Error('Official media host resolved to a non-public address')
  return { url, addresses }
}

export const readLimitedBody = async (response: Response, maxBytes: number) => {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) {
    await response.body?.cancel().catch(() => {})
    throw new Error('Official media response is too large')
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new Error('Official media response is too large')
      chunks.push(value)
    }
  } catch (error) {
    // A failed/closed upstream may reject cancellation too; keep the original failure.
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
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
    return { response: new Response(null, { status, headers }), stream: message }
  }
  const encoding = headers.get('content-encoding')?.trim().toLowerCase() as keyof typeof DECODERS | undefined
  const decoder = encoding && Object.hasOwn(DECODERS, encoding) ? DECODERS[encoding] : undefined
  if (decoder) {
    // The declared length is of the compressed bytes; readLimitedBody must count what it actually reads.
    headers.delete('content-encoding')
    headers.delete('content-length')
  }
  // pipeline, not pipe: a socket error or timeout must reach the reader instead of hanging it.
  const body = decoder ? pipeline(message, decoder(), () => {}) : message
  return {
    response: new Response(Readable.toWeb(body) as ReadableStream<Uint8Array>, { status, headers }),
    stream: body,
  }
}

/**
 * Connects to exactly the addresses that passed the public-network check. A plain fetch would
 * resolve the host a second time, and a rebinding DNS answer could point that second lookup at
 * 169.254.169.254 or the local network.
 */
const requestPinned = (
  url: URL,
  addresses: LookupAddress[],
  signal: AbortSignal,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
) =>
  new Promise<ReturnType<typeof toResponse>>((resolve, reject) => {
    signal.throwIfAborted()
    let stream: Readable | undefined
    const cleanup = () => signal.removeEventListener('abort', abort)
    const abort = () => {
      const error = signal.reason instanceof Error ? signal.reason : new Error('Official media request aborted')
      request.destroy(error)
      stream?.destroy(error)
      cleanup()
      reject(error)
    }
    const request = https.request(
      url,
      {
        method: init.method ?? 'GET',
        headers: {
          'User-Agent': `Topiqu/1.0 (https://${process.env.BASE_DOMAIN || 'topiqu.com'})`,
          'Accept-Encoding': 'gzip, deflate, br',
          ...init.headers,
        },
        lookup: (_hostname, options, callback) =>
          options.all ? callback(null, addresses) : callback(null, addresses[0]!.address, addresses[0]!.family),
      },
      (message) => {
        try {
          const result = toResponse(message)
          stream = result.stream
          stream.once('close', cleanup)
          resolve(result)
        } catch (error) {
          cleanup()
          message.destroy()
          reject(error)
        }
      },
    )
    signal.addEventListener('abort', abort, { once: true })
    request.on('error', (error) => {
      cleanup()
      stream?.destroy(error)
      reject(error)
    })
    request.end(init.body)
  })

/** A redirect is returned, not followed: its target would bypass the address check. */
export const postPublicUrl = async (
  input: string | URL,
  body: string,
  headers: Record<string, string>,
  timeoutMs = 10_000,
  signal?: AbortSignal,
) => {
  const deadline = publicRequestDeadline(timeoutMs, signal)
  try {
    const target = await resolvePublicHttpsUrl(input, deadline.signal)
    const { response, stream } = await requestPinned(target.url, target.addresses, deadline.signal, {
      method: 'POST',
      headers,
      body,
    })
    if (stream.closed) deadline.dispose()
    else stream.once('close', deadline.dispose)
    return response
  } catch (error) {
    deadline.dispose()
    throw error
  }
}

export const fetchPublicUrl = async (
  input: string | URL,
  timeoutMs = 8_000,
  signal?: AbortSignal,
  options: { redirect?: 'follow' | 'error' } = {},
) => {
  const deadline = publicRequestDeadline(timeoutMs, signal)
  try {
    let target = await resolvePublicHttpsUrl(input, deadline.signal)
    for (let hop = 0; hop <= 3; hop += 1) {
      const { response, stream } = await requestPinned(target.url, target.addresses, deadline.signal)
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        if (stream.closed) deadline.dispose()
        else stream.once('close', deadline.dispose)
        return response
      }
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (options.redirect === 'error') throw new Error('Official media redirects are not allowed')
      if (!location || hop === 3) throw new Error('Official media redirect chain is invalid or too long')
      target = await resolvePublicHttpsUrl(new URL(location, target.url), deadline.signal)
    }
    throw new Error('Official media redirect chain is too long')
  } catch (error) {
    deadline.dispose()
    throw error
  }
}
