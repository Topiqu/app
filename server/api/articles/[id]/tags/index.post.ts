export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const articleId = event.context.params!.id!
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const body = await readValidatedBody(event, z.object({ tagId: z.string() }).parse)

  await prisma.articleTag.create({ data: { articleId, tagId: body.tagId } })
  return { success: true }
})
