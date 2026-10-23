import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { db, user, clientSiteId } = await requireDomainAccess(event)
  if (user.role !== 'superadmin') throw createError({ statusCode: 403 })
  if (!(await consumeRateLimit(`domain-adopt:${clientSiteId}`, 5, 600))) throw createError({ statusCode: 429 })
  const body = await readValidatedBody(event, z.object({ connectionId: z.string().uuid() }).strict().parse)
  const scoped = await db.domainConnection.findUnique({
    where: { id: body.connectionId, clientSiteId },
    select: { id: true },
  })
  if (!scoped) throw createError({ statusCode: 404 })
  await withDomainLease(scoped.id, async () => {
    const connection = await loadDomainConnection(scoped.id)
    if (connection.clientSiteId !== clientSiteId || connection.cleanupRequestedAt)
      throw createError({ statusCode: 409 })
    if (!(await checkDomainDns(connection.host, connection.challenge)).ownershipVerified)
      throw createError({ statusCode: 409 })
    const cf = await cloudflareDomain('GET', undefined, connection.host)
    const origin = await findDokployDomain(connection.host)
    if (!cf || !origin || !origin.https) throw createError({ statusCode: 409 })
    await prisma.domainConnection.update({
      where: { id: scoped.id },
      data: {
        cloudflareId: cf.id,
        dokployId: origin.domainId,
        cloudflareManaged: false,
        dokployManaged: false,
        errorCode: null,
      },
    })
  })
  await logAction({
    action: 'DOMAIN_PROVIDERS_ADOPTED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { connectionId: scoped.id },
  })
  return { success: true }
})
