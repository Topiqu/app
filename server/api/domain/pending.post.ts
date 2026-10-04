import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { domainError, isManagedDomain, normalizeDomain } from '~~/shared/utils/domain'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireDomainAccess(event)
  const body = await readValidatedBody(event, z.object({ domain: z.string().trim().min(1).max(253) }).parse)
  const domain = normalizeDomain(body.domain)

  const site = await db.clientSite.findUnique({ where: { id: clientSiteId }, select: { domain: true, plan: true } })
  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })

  const reason = isManagedDomain(domain) ? 'reserved' : domainError(domain, { allowCustom: site.plan !== 'BASIC' })
  if (reason || domain === site.domain)
    throw createError({ statusCode: 400, message: 'Invalid domain', data: { code: reason ?? 'unchanged' } })
  if (await isDomainTaken(domain, clientSiteId))
    throw createError({ statusCode: 409, message: 'Domain already taken', data: { code: 'taken' } })

  // A new token per request, so DNS prepared for an abandoned attempt cannot verify a later one.
  const token = randomBytes(24).toString('base64url')
  await db.clientSite.update({
    where: { id: clientSiteId },
    data: { pendingDomain: domain, pendingDomainToken: token, pendingDomainRequestedAt: new Date() },
  })
  await logAction({
    action: 'DOMAIN_SWITCH_REQUESTED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { domain, currentDomain: site.domain },
  })
  return { pending: domainDnsRecords(domain, token) }
})
