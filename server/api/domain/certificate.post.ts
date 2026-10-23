import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { db, clientSiteId } = await requireDomainAccess(event)
  if (!(await consumeRateLimit(`domain-certificate:${clientSiteId}`, 5, 600))) throw createError({ statusCode: 429 })
  const body = await readDomainBody(
    event,
    z
      .object({
        connectionId: z.string().uuid(),
        certificate: z.string().min(1).max(65536),
        privateKey: z.string().min(1).max(16384),
      })
      .strict(),
  )
  const connection = await db.domainConnection.findUnique({
    where: { id: body.connectionId, clientSiteId },
    select: { id: true, host: true, state: true, cleanupRequestedAt: true },
  })
  if (!connection || connection.cleanupRequestedAt || connection.state === 'DISCONNECTED')
    throw createError({ statusCode: 404 })
  try {
    await verifyDomainCertificate(connection.host, body.certificate, body.privateKey)
    await withDomainLease(connection.id, async () => {
      const record = await loadDomainConnection(connection.id)
      if (record.clientSiteId !== clientSiteId || record.host !== connection.host || record.cleanupRequestedAt)
        throw new DomainProviderError('BUSY')
      const dns = await checkDomainDns(record.host, record.challenge)
      if (!dns.ownershipVerified) throw new DomainProviderError('TXT_MISMATCH')
      await prisma.domainConnection.update({
        where: { id: connection.id },
        data: {
          encryptedCertificate: encryptDomainCertificate(
            JSON.stringify({ certificate: body.certificate, privateKey: body.privateKey }),
            connection.id,
          ),
        },
      })
    })
    return await reconcileDomainConnection(connection.id, clientSiteId)
  } catch (error) {
    throw createError({
      statusCode: 409,
      message: 'Certificate operation failed',
      data: { code: error instanceof DomainProviderError ? error.code : 'CERTIFICATE_INVALID' },
    })
  }
})
