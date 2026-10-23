import type { H3Event } from 'h3'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { EMAIL_VERIFICATION_CODE_LENGTH, EMAIL_VERIFICATION_COOLDOWN_MS } from '~~/shared/utils/auth'

export const RESEND_THROTTLE_MS = EMAIL_VERIFICATION_COOLDOWN_MS

export const VERIFICATION_CODE_TTL_MS = 24 * 60 * 60 * 1000

interface VerificationCandidate {
  emailVerified: boolean
  verification?: { createdAt: Date } | null
}

export const shouldIssueVerificationCode = (user: VerificationCandidate | null, now: number = Date.now()): boolean => {
  if (!user || user.emailVerified) return false

  const issuedAt = user.verification?.createdAt
  if (!issuedAt) return true

  return now - issuedAt.getTime() >= RESEND_THROTTLE_MS
}

const digest = (value: string) => {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required')
  return createHmac('sha256', secret).update(value).digest('hex')
}

/** A pepper prevents offline enumeration of the eight-character code after a database disclosure. */
export const emailVerificationHash = (userId: string, email: string, code: string) =>
  `h1:${digest(JSON.stringify(['email-verification', 1, userId, email.trim().toLowerCase(), code.toLowerCase()]))}`

export const allowEmailVerificationRequest = async (event: H3Event, email: string, purpose: 'issue' | 'verify') => {
  const identity = digest(JSON.stringify(['email-verification-budget', email.trim().toLowerCase()]))
  const allowed = await Promise.all([
    consumeRateLimit(`email-verification:${purpose}:account:${identity}`, 8, 900),
    consumeRateLimit(`email-verification:${purpose}:ip:${ipKey(event)}`, purpose === 'issue' ? 20 : 30, 900),
  ])
  return allowed.every(Boolean)
}

export const emailVerificationMatches = (
  verification: { code: string; createdAt: Date; expiresAt: Date },
  userId: string,
  email: string,
  code: string,
  now = Date.now(),
) => {
  const issuedAt = verification.createdAt.getTime()
  const expiresAt = verification.expiresAt.getTime()
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt > now ||
    now - issuedAt >= VERIFICATION_CODE_TTL_MS ||
    expiresAt <= now
  )
    return false
  const legacy = verification.code.length === EMAIL_VERIFICATION_CODE_LENGTH && /^[a-f0-9]+$/i.test(verification.code)
  if (!legacy && !/^h1:[a-f0-9]{64}$/.test(verification.code)) return false
  const expected = legacy ? code.toLowerCase() : emailVerificationHash(userId, email, code)
  const actual = legacy ? verification.code.toLowerCase() : verification.code
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Callers reserve their shared request budget before account creation/lookup. Mail never holds a DB lock. */
export const issueEmailVerification = async (event: H3Event, email: string, userId?: string) => {
  const candidate = await prisma.user.findFirst({
    where: { id: userId, email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true },
  })
  if (!candidate) return 'ineligible'
  const issued = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${candidate.id} FOR UPDATE`
    const user = await tx.user.findFirst({
      where: { id: candidate.id, email: { equals: email, mode: 'insensitive' }, deletedAt: null },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        verification: { select: { createdAt: true, deletedAt: true } },
      },
    })
    const now = new Date()
    if (
      !user ||
      !shouldIssueVerificationCode(
        { ...user, verification: user.verification?.deletedAt ? null : user.verification },
        now.getTime(),
      )
    )
      return null
    const code = randomBytes(EMAIL_VERIFICATION_CODE_LENGTH / 2).toString('hex')
    const stored = emailVerificationHash(user.id, user.email, code)
    const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS)
    await tx.verificationCode.upsert({
      where: { userId: user.id },
      create: { userId: user.id, code: stored, expiresAt, createdAt: now },
      update: { code: stored, expiresAt, createdAt: now, deletedAt: null },
    })
    return { code, email: user.email, username: user.username }
  })
  if (!issued) return 'cooldown'
  try {
    await sendEmail({
      event,
      to: issued.email,
      template: 'verificationCode',
      abortSignal: AbortSignal.timeout(20_000),
      data: {
        verificationCode: issued.code,
        userName: issued.username,
        actionType: '{t:verificationCode.actions.emailVerification}',
      },
    })
    return 'sent'
  } catch (error) {
    // A timed-out transport may still deliver. Keep that code valid and retain the abuse cooldown;
    // a later explicit resend can rotate it without an uncertain delivery invalidating newer work.
    await reportCaughtError('Email verification delivery failed', error, { userId: candidate.id })
    return 'failed'
  }
}

export const consumeEmailVerification = async (email: string, code: string) => {
  const candidate = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null, emailVerified: false },
    select: { id: true },
  })
  if (!candidate) return false
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${candidate.id} FOR UPDATE`
    const user = await tx.user.findFirst({
      where: { id: candidate.id, email: { equals: email, mode: 'insensitive' }, deletedAt: null, emailVerified: false },
      select: { email: true },
    })
    if (!user) return false
    const verification = await tx.verificationCode.findUnique({
      where: { userId: candidate.id },
      select: { id: true, code: true, createdAt: true, expiresAt: true, deletedAt: true },
    })
    if (
      !verification ||
      verification.deletedAt ||
      !emailVerificationMatches(verification, candidate.id, user.email, code)
    )
      return false
    const consumed = await tx.verificationCode.deleteMany({
      where: { id: verification.id, userId: candidate.id, code: verification.code, expiresAt: { gt: new Date() } },
    })
    if (consumed.count !== 1) return false
    await tx.user.update({ where: { id: candidate.id }, data: { emailVerified: true } })
    return true
  })
}
