import type { SocialPlatform } from '@prisma/client'

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

  const {
    name,
    subdomain,
    plan,
    generationFrequency,
    tokenLimit,
    deletedAt,
    keywords,
    audience,
    focus,
    description,
    logoUrl,
    socials,
  } = await readBody(event)

  const clientSite = await db.clientSite.findUnique({ where: { id }, include: { socials: true } })
  if (!clientSite) {
    throw createError({ statusCode: 404, message: 'Klient nenalezen' })
  }

  if (clientSite.deletedAt && deletedAt !== null) {
    throw createError({ statusCode: 400, message: 'Nelze aktualizovat deaktivovaného klienta' })
  }

  if (subdomain) {
    const existing = await db.clientSite.findUnique({ where: { subdomain } })
    if (existing && existing.id !== id) {
      throw createError({ statusCode: 409, message: 'Subdoména již existuje' })
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
  if (description !== undefined) data.description = description ? sanitizeHtml(description) : null
  if (logoUrl !== undefined) data.logoUrl = logoUrl
  if (deletedAt !== undefined) {
    data.deletedAt = deletedAt === null ? null : new Date()
  }

  if (socials !== undefined) {
    const existingSocials = clientSite.socials
    const newSocials = socials as { platform: SocialPlatform; url: string }[]

    const toDelete = existingSocials.filter((es) => !newSocials.some((ns) => ns.platform === es.platform))
    const toUpdate = newSocials.filter((ns) => existingSocials.some((es) => es.platform === ns.platform))
    const toCreate = newSocials.filter((ns) => !existingSocials.some((es) => es.platform === ns.platform))

    if (toDelete.length > 0) {
      await db.social.deleteMany({
        where: {
          clientSiteId: id,
          platform: { in: toDelete.map((s) => s.platform) },
        },
      })
    }

    for (const social of toUpdate) {
      await db.social.updateMany({
        where: { clientSiteId: id, platform: social.platform },
        data: { url: social.url },
      })
    }

    if (toCreate.length > 0) {
      await db.social.createMany({
        data: toCreate.map((social) => ({
          clientSiteId: id,
          platform: social.platform,
          url: social.url,
        })),
      })
    }
  }

  const updatedSite = await db.clientSite.update({
    where: { id },
    data,
    include: { socials: true },
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
      description: updatedSite.description,
      logoUrl: updatedSite.logoUrl,
      socials: updatedSite.socials.map((s) => ({
        platform: s.platform,
        url: s.url,
      })),
    },
  }
})
