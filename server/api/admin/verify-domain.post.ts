export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, clientSiteId: true },
  })

  if (!user || !user.clientSiteId || (user.role !== 'admin' && user.role !== 'superadmin')) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: { domain: true, domainVerified: true },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: 'Client site not found' })
  if (clientSite.domainVerified) return { verified: true } // Already verified

  try {
    const dnsRes = await $fetch<{ Status: number; Answer?: { data: string }[] }>(
      `https://cloudflare-dns.com/dns-query?name=${clientSite.domain}&type=CNAME`,
      { headers: { accept: 'application/dns-json' } },
    )

    // Look for our base domain in the CNAME targets
    const validCname = dnsRes.Answer?.some((a) => a.data.includes(process.env.BASE_DOMAIN || 'topiqu.com'))

    if (validCname) {
      await prisma.clientSite.update({
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
