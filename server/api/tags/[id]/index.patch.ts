export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!['superadmin', 'admin'].includes(user.role))
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const body = await readBody(event)
  const { name, slug } = body
  const db = await getEnhancedPrisma(user)

  const tag = await db.tag.findUnique({ where: { id } })
  if (!tag) throw createError({ statusCode: 404, message: t('common.errors.tagNotFound')! })

  const data: any = {}
  if (name !== undefined) data.name = name
  if (slug !== undefined) data.slug = slug

  const updated = await db.tag.update({ where: { id }, data })

  return {
    tag: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
    },
  }
})
