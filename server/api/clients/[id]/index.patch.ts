export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = session?.user

  if (!user || user.role !== 'superadmin') {
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })
  }

  const clientSiteId = getRouterParam(event, 'id')
  const body = await readBody(event)

  const { name, subdomain, plan, generationFrequency, tokenLimit = 0 } = body

  if (!name || !subdomain) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Chybí povinná pole: jméno nebo subdoména.',
    })
  }

  const [clientSite, subdomainExists] = await Promise.all([
    prisma.clientSite.findUnique({
      where: { id: clientSiteId },
    }),
    prisma.clientSite.findUnique({
      where: { subdomain },
    }),
  ])

  if (!clientSite) {
    throw createError({ statusCode: 404, statusMessage: 'Klient nenalezen' })
  }

  if (subdomainExists && subdomainExists.id !== clientSiteId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Subdoména již existuje',
    })
  }

  const updated = await prisma.clientSite.update({
    where: { id: clientSiteId },
    data: {
      name,
      subdomain,
      plan,
      generationFrequency,
      tokenLimit,
      tokenRemaining: tokenLimit,
    },
  })

  return {
    clientSite: {
      id: updated.id,
      name: updated.name,
      subdomain: updated.subdomain,
      plan: updated.plan,
      generationFrequency: updated.generationFrequency,
      tokenLimit: updated.tokenLimit,
    },
    message: 'Klient úspěšně aktualizován',
  }
})
