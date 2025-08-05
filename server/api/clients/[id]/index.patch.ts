export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    throw createError({ statusCode: 401, message: 'Neautorizováno' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID nenalezeno' })
  }

  const body = await readBody(event)
  const { name, subdomain, plan, generationFrequency, tokenLimit, deletedAt, keywords, audience, focus } = body

  const clientSite = await db.clientSite.findUnique({ where: { id } })
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
    const existing = await db.clientSite.findUnique({ where: { subdomain } })
    if (existing && existing.id !== id) {
      throw createError({
        statusCode: 409,
        message: 'Subdoména již existuje',
      })
    }
  }

  const data: any = {}
  if (name !== undefined) data.name = name
  if (subdomain !== undefined) data.subdomain = subdomain
  if (plan !== undefined) data.plan = plan
  if (generationFrequency !== undefined) data.generationFrequency = generationFrequency
  if (tokenLimit !== undefined) {
    data.tokenLimit = tokenLimit
    data.tokenRemaining = tokenLimit
  }
  if (keywords !== undefined) data.keywords = keywords
  if (audience !== undefined) data.audience = audience
  if (focus !== undefined) data.focus = focus
  if (deletedAt !== undefined) {
    data.deletedAt = deletedAt === null ? null : new Date()
  }

  const updatedSite = await db.clientSite.update({
    where: { id },
    data,
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
      keywords: updatedSite.keywords,
      audience: updatedSite.audience,
      focus: updatedSite.focus,
    },
  }
})
