import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const session = (await getServerSession(event))?.user
  if (!session || session.role !== 'superadmin')
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(session)
  const body = await readBody(event)

  if (!body.name || !body.email || !body.domain)
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  if (body.tokenLimit > 0 && !body.aiUser?.name)
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const [existingUser, existingSubdomain] = await Promise.all([
    db.user.findUnique({ where: { email: body.email } }),
    db.clientSite.findUnique({ where: { domain: body.domain } }),
  ])

  if (existingUser) throw createError({ statusCode: 409, message: t('common.errors.alreadyExists')! })
  if (existingSubdomain) throw createError({ statusCode: 409, message: t('common.errors.subdomainExists')! })

  const generatedUsername = body.username || `user-${randomBytes(4).toString('hex')}`
  const generatedPassword = body.password || randomBytes(8).toString('hex')

  const clientSite = await prisma.$transaction(async (tx) => {
    const clientSite = await tx.clientSite.create({
      data: {
        name: body.name,
        domain: body.domain,
        plan: body.plan,
        generationFrequency: body.generationFrequency,
        tokenLimit: body.tokenLimit,
        tokenRemaining: body.tokenLimit,
        focus: body.focus || '',
        keywords:
          Array.isArray(body.keywords) && body.keywords.every((k: any) => typeof k === 'string') && body.keywords.length
            ? body.keywords
            : undefined,
        description: body.description || '',
        logoUrl: body.logoUrl || '',
        audience: body.audience || '',
      },
    })

    if (body.tokenLimit > 0 && body.aiUser?.name) {
      await tx.user.create({
        data: {
          username: body.aiUser.name,
          email: `ai-${randomBytes(8).toString('hex')}@generated.ai`,
          bio: body.aiUser.bio || '',
          avatarUrl: body.aiUser.avatarUrl || '',
          role: 'ai',
          clientSiteId: clientSite.id,
          emailVerified: true,
          allowNotifs: false,
          allowEmail: false,
        },
      })
    }

    return clientSite
  })

  const newUser = await saveUserWithLogging(event, {
    email: body.email,
    username: generatedUsername,
    password: generatedPassword,
    clientSiteId: clientSite.id,
    emailVerified: true,
    role: 'admin',
  })

  return {
    clientSite: {
      id: clientSite.id,
      name: clientSite.name,
      domain: clientSite.domain,
      plan: clientSite.plan,
      generationFrequency: clientSite.generationFrequency,
      tokenLimit: clientSite.tokenLimit,
      keywords: clientSite.keywords,
      focus: clientSite.focus,
      description: clientSite.description,
      logoUrl: clientSite.logoUrl,
      audience: clientSite.audience,
    },
    user: {
      ...newUser,
      password: body.password ? 'user submitted' : generatedPassword,
    },
  }
})
