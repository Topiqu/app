export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const body = await readBody(event)
  const appType = body.type || 'pages'
  const db = await getEnhancedPrisma(user)

  const existing = await db.linkedinCompany.findFirst({
    where: { clientSiteId: user.clientSiteId, type: appType },
    select: { id: true },
  })
  if (!existing) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const company = await db.linkedinCompany
    .update({ where: { id: existing.id }, data: { mode: body.mode } })
    .catch(() => null)
  if (!company) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  if (body.brandProfile) {
    const data = {
      tone: body.brandProfile.tone,
      audience: body.brandProfile.audience,
      doList: body.brandProfile.doList,
      dontList: body.brandProfile.dontList,
    }
    await db.brandProfile.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, ...data },
      update: data,
    })
  }

  return { success: true }
})
