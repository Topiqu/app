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

  if (site.trialAcknowledgedAt) return { success: true }
  if (!trialExpired(site)) throw createError({ statusCode: 409, message: 'No expired trial to end' })

  // The cron normally gets here first; this is the "continue free" button, which also has to work
  // the moment the trial lapses. Plan and features go through the system-scoped downgrade because
  // a tenant may not grant itself features.
  if (site.plan !== 'BASIC') await downgradeExpiredTrial(site.id, site)

  // Acknowledgement is not a payment. Keeping it separate preserves billing history and prevents
  // a manually provisioned paid plan from being inferred as a trial merely because Stripe is absent.
  await prisma.clientSite.update({
    where: { id: site.id },
    data: { trialAcknowledgedAt: new Date() },
  })

  return { success: true }
})
