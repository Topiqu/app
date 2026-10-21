import { z } from 'zod'

import { readDomainBody } from '../../utils/domains/request'
import { domainProbeSignature } from '../../utils/domains/probe'

// Public, nonce-bound routing proof; no tenant content, session or secret is returned.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const host = tenantHostname(event)
  if (!host || !(await consumeRateLimit(`domain-probe:${getIp(event)}`, 60, 60))) throw createError({ statusCode: 404 })
  const body = await readDomainBody(event, z.object({ nonce: z.string().regex(/^[a-f0-9]{48}$/) }).strict(), 512)
  const connection = await prisma.domainConnection.findUnique({
    where: { host },
    select: {
      probeSecret: true,
      deletedAt: true,
      cleanupRequestedAt: true,
      clientSite: { select: { deletedAt: true } },
    },
  })
  if (!connection || connection.deletedAt || connection.cleanupRequestedAt || connection.clientSite.deletedAt)
    throw createError({ statusCode: 404 })
  return { signature: domainProbeSignature(connection.probeSecret, host, body.nonce) }
})
