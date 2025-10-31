export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { id: draftId } = await readBody(event)
  if (!draftId) throw createError({ statusCode: 400, message: 'Chybí ID draftu' })

  const draft = await prisma.articleDraft.findUnique({
    where: { id: draftId },
  })
  if (!draft || draft.userId !== user.id || draft.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 403, message: 'Neoprávněný přístup k draftu' })

  await prisma.articleDraft.delete({
    where: { id: draftId },
  })

  return { success: true }
})
