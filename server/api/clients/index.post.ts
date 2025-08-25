import argon from 'argon2'
import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const session = (await getServerSession(event))?.user

  if (!session || session.role !== 'superadmin') {
    throw createError({ statusCode: 401, message: 'Neautorizováno' })
  }
  const db = await getEnhancedPrisma(session)

  const body = await readBody(event)
  const { name, email, username, password, subdomain, plan, generationFrequency, tokenLimit, focus, keywords } = body

  if (!name || !email || !subdomain) {
    throw createError({
      statusCode: 400,
      message: 'Chybí povinná pole: jméno, email nebo subdoména.',
    })
  }

  const [existingUser, existingSubdomain] = await Promise.all([
    db.user.findUnique({ where: { email } }),
    db.clientSite.findUnique({ where: { subdomain } }),
  ])

  if (existingUser) {
    throw createError({ statusCode: 409, message: 'Email již existuje.' })
  }

  if (existingSubdomain) {
    throw createError({
      statusCode: 409,
      message: 'Subdoména již existuje.',
    })
  }

  const generatedUsername = username || `user-${randomBytes(4).toString('hex')}`
  const generatedPassword = password || randomBytes(8).toString('hex')
  const hashedPassword = await argon.hash(generatedPassword)

  const result = await prisma.$transaction(async (tx) => {
    const clientSite = await tx.clientSite.create({
      data: {
        name,
        subdomain,
        plan,
        generationFrequency,
        tokenLimit,
        keywords:
          Array.isArray(keywords) && keywords.every((k: any) => typeof k === 'string') && keywords.length
            ? keywords
            : undefined,
        focus: focus || '',
        tokenRemaining: tokenLimit,
      },
    })

    const newUser = await tx.user.create({
      data: {
        email,
        username: generatedUsername,
        password: hashedPassword,
        clientSiteId: clientSite.id,
        emailVerified: true,
        role: 'admin',
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    })

    return {
      clientSite,
      newUser,
    }
  })

  return {
    clientSite: {
      id: result.clientSite.id,
      name: result.clientSite.name,
      subdomain: result.clientSite.subdomain,
      plan: result.clientSite.plan,
      generationFrequency: result.clientSite.generationFrequency,
      tokenLimit: result.clientSite.tokenLimit,
      keywords: result.clientSite.keywords,
      focus: result.clientSite.focus,
    },
    user: {
      ...result.newUser,
      password: password ? 'user submitted' : generatedPassword,
    },
  }
})
