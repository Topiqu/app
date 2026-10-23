import { randomBytes } from 'node:crypto'

export async function chooseDomainFallback(clientSiteId: string) {
  const aliases = await prisma.domainRedirect.findMany({
    where: { clientSiteId },
    select: { host: true },
    take: 100,
  })
  for (const { host } of aliases) {
    if (
      isManagedDomain(host) &&
      !domainError(host, { allowCustom: false }) &&
      !(await isDomainTaken(host, clientSiteId))
    )
      return host
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const host = `blog-${randomBytes(12).toString('hex')}.${process.env.BASE_DOMAIN || 'topiqu.com'}`
    if (!domainError(host, { allowCustom: false }) && !(await isDomainTaken(host, clientSiteId))) return host
  }
  throw new Error('DOMAIN_FALLBACK_UNAVAILABLE')
}
