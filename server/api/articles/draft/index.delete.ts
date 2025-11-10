export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { id: draftId } = await readBody(event)
  if (!draftId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const draft = await prisma.articleDraft.findUnique({
    where: { id: draftId },
  })
  if (!draft || draft.userId !== user.id || draft.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  await prisma.articleDraft.delete({
    where: { id: draftId },
  })

  return { success: true }
})
