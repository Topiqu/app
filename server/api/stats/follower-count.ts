export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Uživatel není přiřazen k žádnému ClientSite' })

  const followerCount = await prisma.follow.count({
    where: { followed: { clientSiteId: user.clientSiteId } },
  })

  return { count: followerCount }
})
