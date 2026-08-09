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

  const site = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: TRIAL_SELECT,
  })

  if (!site) throw createError({ statusCode: 404, message: 'Client site not found' })

  // The cron normally gets here first; this is the "continue free" button, which also has to work
  // the moment the trial lapses. Plan and features go through the system-scoped downgrade because
  // a tenant may not grant itself features.
  if (site.plan !== 'BASIC') await downgradeExpiredTrial(site.id, site)

  // Doubles as the dismissal marker for the trial-expired modal. It is the paid marker everywhere
  // else, so a tenant that continues free is indistinguishable from one that paid — see MAP.md.
  await prisma.clientSite.update({
    where: { id: site.id },
    data: { firstPaidAt: new Date() },
  })

  return { success: true }
})
