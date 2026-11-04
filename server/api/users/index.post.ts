export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  const db = await getEnhancedPrisma(user)
  if (!user || user.role !== 'superadmin')
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const body = await readBody(event)
  const { username, email, password, role, clientSiteId } = body

  if (!username || !email || !password || !role || !clientSiteId)
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const [existingUser, existingClientSite] = await Promise.all([
    db.user.findFirst({ where: { OR: [{ email }, { username }], deletedAt: null } }),
    db.clientSite.findUnique({ where: { id: clientSiteId } }),
  ])

  if (existingUser) throw createError({ statusCode: 409, message: t('common.errors.alreadyExists')! })
  if (!existingClientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const newUser = await prisma.$transaction(async (tx) => {
    if (role === 'admin') await requireTeamSeatCapacity(tx, clientSiteId)
    const created = await saveUserWithLogging(event, { username, email, password, role, clientSiteId }, false, tx)
    if (role === 'admin')
      await tx.tenantMembership.create({
        data: { clientSiteId, userId: created.id, role: 'MEMBER', scopes: [...TENANT_SCOPES] },
      })
    return created
  })
  return newUser
})
