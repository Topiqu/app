import { randomBytes } from 'node:crypto'

export async function chooseDomainFallback(
  clientSiteId: string,
  db: Pick<DatabaseTransaction, 'clientSite' | 'domainRedirect' | 'domainConnection'> = prisma,
) {
  const aliases = await db.domainRedirect.findMany({
    where: { clientSiteId },
    select: { host: true },
    take: 100,
  })
  for (const { host } of aliases) {
    if (
      isManagedDomain(host) &&
      !domainError(host, { allowCustom: false }) &&
      !(await isDomainTaken(host, clientSiteId, db))
    )
      return host
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const host = `blog-${randomBytes(12).toString('hex')}.${process.env.BASE_DOMAIN || 'topiqu.com'}`
    if (!domainError(host, { allowCustom: false }) && !(await isDomainTaken(host, clientSiteId, db))) return host
  }
  throw new Error('DOMAIN_FALLBACK_UNAVAILABLE')
}
