export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ status: 400, message: 'ID článku je povinné' })

  const body = await readBody(event)

  const article = await prisma.article.findUnique({
    where: { id, status: 'published' },
    select: { id: true, clientSiteId: true },
  })
  if (!article) throw createError({ status: 404, message: 'Článek nenalezen' })

  await prisma.$transaction(async (tx) => {
    await tx.article.update({
      where: { id },
      data: { shared: { increment: 1 } },
    })

    await tx.articleShare.create({
      data: { articleId: id, platform: body.platform },
    })
  })

  return { success: true }
})
