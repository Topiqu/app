import { randomBytes } from 'crypto'
import argon from 'argon2'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = session?.user

  if (!user || user.role !== 'superadmin') {
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })
  }

  const body = await readBody(event)
  const {
    name,
    email,
    username,
    password,
    subdomain,
    plan,
    generationFrequency,
    tokenLimit,
  } = body

  if (!name || !email || !subdomain) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Chybí povinná pole: jméno, email nebo subdoména.',
    })
  }

  const [existingUser, existingSubdomain] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.clientSite.findUnique({ where: { subdomain } }),
  ])

  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: 'Email již existuje.' })
  }

  if (existingSubdomain) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Subdoména již existuje.',
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
        tokenRemaining: tokenLimit,
      },
    })

    const newUser = await tx.user.create({
      data: {
        email,
        username: generatedUsername,
        password: hashedPassword,
        clientSiteId: clientSite.id,
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
    },
    user: {
      ...result.newUser,
      password: password ? 'user submitted' : generatedPassword,
    },
  }
})
