export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const appType = (getQuery(event).type as string) || 'pages'
  const db = await getEnhancedPrisma(user)

  const company = await db.linkedinCompany.findFirst({
    where: { clientSiteId: user.clientSiteId, type: appType },
    select: {
      id: true,
      name: true,
      type: true,
      mode: true,
      timezone: true,
      cadence: true,
      linkedinOrgId: true,
      tokenExpiresAt: true,
      brandProfile: true,
    },
  })
  if (!company) return {}

  const { tokenExpiresAt, ...safe } = company
  return { ...safe, connected: !!tokenExpiresAt }
})
