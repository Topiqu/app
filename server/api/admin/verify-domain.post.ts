export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if (!user.clientSiteId || (user.role !== 'admin' && user.role !== 'superadmin')) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const db = await getEnhancedPrisma(user)

  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: { domain: true, domainVerified: true },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: 'Client site not found' })
  if (clientSite.domainVerified) return { verified: true }

  try {
    const dnsRes = await $fetch<{ Status: number; Answer?: { data: string }[] }>(
      `https://cloudflare-dns.com/dns-query?name=${clientSite.domain}&type=CNAME`,
      { headers: { accept: 'application/dns-json' } },
    )

    const validCname = dnsRes.Answer?.some((a) => a.data.includes(process.env.BASE_DOMAIN || 'topiqu.com'))

    if (validCname) {
      await db.clientSite.update({
        where: { id: user.clientSiteId },
        data: { domainVerified: true },
      })
      return { verified: true }
    }
  } catch (error) {
    console.error('DNS Verification API failed:', error)
  }

  return { verified: false }
})
