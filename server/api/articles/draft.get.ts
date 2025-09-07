export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const drafts = await prisma.articleDraft.findMany({
    where: { userId: user.id, clientSiteId: user.clientSiteId },
    orderBy: { updatedAt: 'desc' },
  })

  return { success: true, drafts }
})
