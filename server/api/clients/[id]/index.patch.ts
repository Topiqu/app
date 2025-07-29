export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user

  if (!user || user.role !== 'superadmin') {
    throw createError({ statusCode: 401, message: 'Neautorizováno' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID nenalezeno' })
  }

  const { name, subdomain, plan, generationFrequency, tokenLimit = 0, deletedAt } = await readBody(event)

  const clientSite = await prisma.clientSite.findUnique({ where: { id } })
  if (!clientSite) {
    throw createError({ statusCode: 404, message: 'Klient nenalezen' })
  }

  if (clientSite.deletedAt && deletedAt !== null) {
    throw createError({
      statusCode: 400,
      message: 'Nelze aktualizovat deaktivovaného klienta',
    })
  }

  if (subdomain) {
    const existing = await prisma.clientSite.findUnique({ where: { subdomain } })
    if (existing && existing.id !== id) {
      throw createError({
        statusCode: 409,
        message: 'Subdoména již existuje',
      })
    }
  }

  const updatedSite = await prisma.clientSite.update({
    where: { id },
    data: {
      name,
      subdomain,
      plan,
      generationFrequency,
      tokenLimit,
      tokenRemaining: tokenLimit,
      deletedAt: deletedAt === undefined ? clientSite.deletedAt : deletedAt === null ? null : new Date(),
    },
  })

  return {
    clientSite: {
      id: updatedSite.id,
      name: updatedSite.name,
      subdomain: updatedSite.subdomain,
      plan: updatedSite.plan,
      generationFrequency: updatedSite.generationFrequency,
      tokenLimit: updatedSite.tokenLimit,
      deletedAt: updatedSite.deletedAt,
    },
  }
})
