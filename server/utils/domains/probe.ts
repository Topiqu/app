import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { postPublicUrl, readLimitedBody } from '../images/publicFetch'

export const domainProbeSignature = (secret: string, host: string, nonce: string) =>
  createHmac('sha256', secret).update(`${host}\n${nonce}`).digest('hex')

export const probeDomainRouting = async (host: string, secret: string) => {
  const nonce = randomBytes(24).toString('hex')
  try {
    const response = await postPublicUrl(
      `https://${host}/api/domain/probe`,
      JSON.stringify({ nonce }),
      { 'content-type': 'application/json' },
      5000,
    )
    if (!response.ok) {
      await response.body?.cancel()
      return false
    }
    const data = JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 2048))) as { signature?: unknown }
    if (typeof data.signature !== 'string' || !/^[a-f0-9]{64}$/.test(data.signature)) return false
    return timingSafeEqual(
      Buffer.from(data.signature, 'hex'),
      Buffer.from(domainProbeSignature(secret, host, nonce), 'hex'),
    )
  } catch {
    return false
  }
}
