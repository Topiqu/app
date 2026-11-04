import type Stripe from 'stripe'

import { z } from 'zod'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { CUSTOM_MIN_SEATS, CUSTOM_MAX_SEATS } from '~~/shared/utils/billingCatalog'

const quoteSchema = z.object({
  purpose: z.literal('custom-seats-v1'),
  userId: z.string(),
  clientSiteId: z.string(),
  subscriptionId: z.string(),
  fingerprint: z.string(),
  seats: z.number().int().min(CUSTOM_MIN_SEATS).max(CUSTOM_MAX_SEATS),
  interval: z.enum(['month', 'year']),
  prorationDate: z.number().int(),
  due: z.number().int(),
  exp: z.number().int(),
})
type Quote = z.infer<typeof quoteSchema>

const quoteSignature = (payload: string) => {
  const secret = process.env.AUTH_SECRET || useRuntimeConfig().auth.secret
  if (!secret) throw new Error('Billing quote signing key missing')
  return createHmac('sha256', secret).update(`billing-quote:${payload}`).digest('base64url')
}

export const billingFingerprint = (subscription: Stripe.Subscription) =>
  createHash('sha256')
    .update(JSON.stringify(subscription.items.data.map((item) => [item.id, item.price.id, item.quantity]).sort()))
    .digest('hex')

export const signSeatQuote = (value: Omit<Quote, 'purpose' | 'exp'>) => {
  const payload = Buffer.from(
    JSON.stringify({ ...value, purpose: 'custom-seats-v1', exp: Date.now() + 5 * 60_000 }),
  ).toString('base64url')
  return `${payload}.${quoteSignature(payload)}`
}

export const readSeatQuote = (token: string, userId: string, clientSiteId: string): Quote => {
  try {
    const [payload, signature, extra] = token.split('.')
    if (!payload || !signature || extra || token.length > 4096) throw new Error('Invalid quote')
    const expected = Buffer.from(quoteSignature(payload))
    const supplied = Buffer.from(signature)
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error('Invalid quote')
    const quote = quoteSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()))
    if (quote.exp <= Date.now() || quote.userId !== userId || quote.clientSiteId !== clientSiteId)
      throw new Error('Invalid quote')
    return quote
  } catch {
    throw createError({
      statusCode: 409,
      message: 'Billing quote expired or changed',
      data: { code: 'BILLING_QUOTE_STALE' },
    })
  }
}

/** A short database lease serializes remote billing changes and concurrent team invitations. */
export const withBillingLease = async <T>(clientSiteId: string, run: (leaseId: string) => Promise<T>): Promise<T> => {
  const id = randomUUID()
  const claim = await prisma.clientSite.updateMany({
    where: {
      id: clientSiteId,
      deletedAt: null,
      OR: [{ billingLeaseUntil: null }, { billingLeaseUntil: { lte: new Date() } }],
    },
    data: { billingLeaseId: id, billingLeaseUntil: new Date(Date.now() + 5 * 60_000) },
  })
  if (!claim.count)
    throw createError({
      statusCode: 409,
      message: 'Billing change in progress',
      data: { code: 'BILLING_CHANGE_PENDING' },
    })
  try {
    return await run(id)
  } finally {
    await prisma.clientSite
      .updateMany({
        where: { id: clientSiteId, billingLeaseId: id },
        data: { billingLeaseId: null, billingLeaseUntil: null },
      })
      .catch((error) => reportCaughtError('Billing lease release failed', error, { clientSiteId }))
  }
}

/** Fence a worker whose remote request outlived its lease before any local entitlement write. */
export const assertBillingLease = async (tx: DatabaseTransaction, clientSiteId: string, leaseId: string) => {
  const current = await tx.clientSite.updateMany({
    where: { id: clientSiteId, billingLeaseId: leaseId, billingLeaseUntil: { gt: new Date() } },
    data: { updatedAt: new Date() },
  })
  if (!current.count)
    throw createError({
      statusCode: 409,
      message: 'Billing change must be reconciled again',
      data: { code: 'BILLING_CHANGE_PENDING' },
    })
}

/** Renew immediately before a bounded external mutation, so an expired worker cannot charge. */
export const renewBillingLease = async (clientSiteId: string, leaseId: string) => {
  const current = await prisma.clientSite.updateMany({
    where: { id: clientSiteId, billingLeaseId: leaseId, billingLeaseUntil: { gt: new Date() } },
    data: { billingLeaseUntil: new Date(Date.now() + 5 * 60_000) },
  })
  if (!current.count)
    throw createError({
      statusCode: 409,
      message: 'Billing change must be retried',
      data: { code: 'BILLING_CHANGE_PENDING' },
    })
}
