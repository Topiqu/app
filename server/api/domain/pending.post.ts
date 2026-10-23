import { z } from 'zod'
import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireDomainAccess(event)
  if (!(await consumeRateLimit(`domain-request:${clientSiteId}`, 10, 600)))
    throw createError({ statusCode: 429, message: 'Too many domain requests' })
  const body = await readValidatedBody(event, z.object({ domain: z.string().trim().min(1).max(253) }).parse)
  const domain = normalizeDomain(body.domain)

  const site = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { domain: true, plan: true, pendingDomain: true },
  })
  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })
  if (site.pendingDomain)
    throw createError({ statusCode: 409, message: 'A domain change is already pending', data: { code: 'pending' } })

  const reason = domainError(domain, { allowCustom: site.plan !== 'BASIC' })
  if (reason || domain === site.domain)
    throw createError({ statusCode: 400, message: 'Invalid domain', data: { code: reason ?? 'unchanged' } })
  if (await isDomainTaken(domain, clientSiteId))
    throw createError({ statusCode: 409, message: 'Domain already taken', data: { code: 'taken' } })

  // A new token per request, so DNS prepared for an abandoned attempt cannot verify a later one.
  const token = randomBytes(24).toString('base64url')
  // Reservation and pending pointer must commit together; no provider requests inside this transaction.
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.clientSite.updateMany({
        where: { id: clientSiteId, pendingDomain: null, domain: site.domain },
        data: { pendingDomain: domain, pendingDomainToken: token, pendingDomainRequestedAt: new Date() },
      })
      if (!updated.count) throw new DomainProviderError('BUSY')
      if (!isManagedDomain(domain)) await reserveDomainConnection(clientSiteId, domain, token, tx)
    })
  } catch (error) {
    throw createError({
      statusCode: 409,
      message: 'Domain request unavailable',
      data: { code: error instanceof DomainProviderError ? error.code : 'taken' },
    })
  }
  await logAction({
    action: 'DOMAIN_SWITCH_REQUESTED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { domain, currentDomain: site.domain },
  })
  return { pending: domainDnsRecords(domain, token) }
})
