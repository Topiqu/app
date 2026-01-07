import slugify from 'slugify'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)
  if (!user || user.role !== 'admin') {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  const clientSiteId = user.clientSiteId
  if (!clientSiteId) {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  const body = await readBody<{ name: string; slug?: string }>(event)

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  }

  const existing = await db.articleSeries.findFirst({
    where: {
      clientSiteId,
      name: { equals: body.name.trim(), mode: 'insensitive' },
    },
  })

  if (existing) {
    throw createError({ statusCode: 409, message: t('common.errors.alreadyExists')! })
  }

  const slug = body.slug?.trim() || slugify(body.name.trim(), { lower: true, strict: true })

  const newSeries = await db.articleSeries.create({
    data: {
      name: body.name.trim(),
      slug,
      clientSiteId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      articles: { select: { id: true } },
    },
  })

  return newSeries
})
