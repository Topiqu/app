import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const session = (await getServerSession(event))?.user
  if (!session || session.role !== 'superadmin') {
    throw createError({ statusCode: 401, message: 'Neautorizováno' })
  }
  const db = await getEnhancedPrisma(session)

  const body = await readBody(event)

  if (!body.name || !body.email || !body.subdomain) {
    throw createError({ statusCode: 400, message: 'Chybí povinná pole: jméno, email nebo subdoména.' })
  }
  if (body.tokenLimit > 0 && !body.aiUser?.name) {
    throw createError({ statusCode: 400, message: 'Jméno AI uživatele je povinné při tokenLimit > 0.' })
  }

  const [existingUser, existingSubdomain] = await Promise.all([
    db.user.findUnique({ where: { email: body.email } }),
    db.clientSite.findUnique({ where: { subdomain: body.subdomain } }),
  ])

  if (existingUser) {
    throw createError({ statusCode: 409, message: 'Email již existuje.' })
  }
  if (existingSubdomain) {
    throw createError({ statusCode: 409, message: 'Subdoména již existuje.' })
  }

  const generatedUsername = body.username || `user-${randomBytes(4).toString('hex')}`
  const generatedPassword = body.password || randomBytes(8).toString('hex')

  const clientSite = await prisma.$transaction(async (tx) => {
    const clientSite = await tx.clientSite.create({
      data: {
        name: body.name,
        subdomain: body.subdomain,
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
      subdomain: clientSite.subdomain,
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
