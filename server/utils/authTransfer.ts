import type { H3Event } from 'h3'

import { z } from 'zod'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const AUTH_TRANSFER_IDENTIFIER = 'custom-auth-transfer'
export const AUTH_TRANSFER_COOKIE = `${isSecureAuth ? '__Host-' : ''}topiqu.auth-transfer`
export const authTransferCookieOptions = { httpOnly: true, secure: isSecureAuth, sameSite: 'lax' as const, path: '/' }
export const authTransferHash = (value: string) => createHash('sha256').update(value).digest('hex')
export const authTransferSecret = () => randomBytes(32).toString('base64url')

const transferSchema = z.object({
  origin: z.url(),
  tenantId: z.string(),
  returnPath: z.string(),
  proofHash: z.string().length(64),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  codeHash: z.string().length(64).optional(),
})

export const authTransferOrigin = (event: H3Event) =>
  getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin

export const centralAuthOrigin = () => {
  const value = process.env.AUTH_ORIGIN || (isSecureAuth ? 'https://app.topiqu.com' : 'http://localhost:3000')
  return new URL(value).origin
}

export const requireCentralAuth = (event: H3Event) => {
  if (authTransferOrigin(event) !== centralAuthOrigin()) throw createError({ statusCode: 403 })
}

export const requireSameAuthOrigin = (event: H3Event) => {
  if (getRequestHeader(event, 'origin') !== authTransferOrigin(event)) throw createError({ statusCode: 403 })
}

export const authReturnPath = (value: string, origin: string) => {
  const url = new URL(value, origin)
  if (url.origin !== origin || url.username || url.password || url.pathname.startsWith('//'))
    throw createError({ statusCode: 400 })
  return `${url.pathname}${url.search}${url.hash}`
}

export const requireTransferTarget = async (origin: string, tenantId?: string) => {
  const url = new URL(origin)
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    isPlatformAuthHost(url.hostname) ||
    (isSecureAuth && url.protocol !== 'https:')
  )
    throw createError({ statusCode: 403 })
  const site = await prisma.clientSite.findFirst({
    where: { domain: url.hostname, domainVerified: true, deletedAt: null, ...(tenantId ? { id: tenantId } : {}) },
    select: { id: true },
  })
  if (!site) throw createError({ statusCode: 403 })
  return site
}

export const loadAuthTransfer = async (id: string) => {
  const row = await prisma.verification.findFirst({
    where: { id, identifier: AUTH_TRANSFER_IDENTIFIER, expiresAt: { gt: new Date() } },
    select: { id: true, value: true, expiresAt: true },
  })
  if (!row) throw createError({ statusCode: 400 })
  const data = transferSchema.parse(JSON.parse(row.value))
  await requireTransferTarget(data.origin, data.tenantId)
  return { row, data }
}

const matches = (value: string, hash: string) =>
  timingSafeEqual(Buffer.from(authTransferHash(value)), Buffer.from(hash))

/** Called only by the internal Better Auth endpoint after reading the target's HttpOnly cookie. */
export const consumeAuthTransfer = async (id: string, code: string, proof: string, origin: string) => {
  const { row, data } = await loadAuthTransfer(id)
  if (
    data.origin !== origin ||
    !data.userId ||
    !data.sessionId ||
    !data.codeHash ||
    !matches(proof, data.proofHash) ||
    !matches(code, data.codeHash)
  )
    throw createError({ statusCode: 403 })
  const source = await prisma.session.findFirst({
    where: { id: data.sessionId, userId: data.userId, expiresAt: { gt: new Date() }, user: { deletedAt: null } },
    select: { id: true },
  })
  if (!source) throw createError({ statusCode: 403 })
  const consumed = await prisma.verification.deleteMany({
    where: { id, identifier: AUTH_TRANSFER_IDENTIFIER, value: row.value, expiresAt: { gt: new Date() } },
  })
  if (consumed.count !== 1) throw createError({ statusCode: 403 })
  return data.userId
}
