import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

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
export const assertPublicHttpsUrl = async (input: string | URL) => {
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
  return url
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

export const fetchPublicUrl = async (input: string | URL, timeoutMs = 8_000) => {
  let url = await assertPublicHttpsUrl(input)
  for (let hop = 0; hop <= 3; hop += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': `Topiqu/1.0 (https://${process.env.BASE_DOMAIN || 'topiqu.com'})` },
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location || hop === 3) throw new Error('Official media redirect chain is invalid or too long')
    url = await assertPublicHttpsUrl(new URL(location, url))
  }
  throw new Error('Official media redirect chain is too long')
}
