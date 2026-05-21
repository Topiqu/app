export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const db = await getEnhancedPrisma(session.user)

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 403, message: 'No client site associated' })
  }

  // Označíme, že zkušební doba byla ukončena (trial -> free verze)
  // v reálném systému by se mohl zapsat firstPaidAt pro bypass trial modalu a omezit tokenLimit
  await db.clientSite.update({
    where: { id: user.clientSiteId },
    data: {
      plan: 'BASIC',
      firstPaidAt: new Date(),
      tokenLimit: 100,
    },
  })

  return { success: true }
})
