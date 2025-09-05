import type { SocialPlatform } from '@prisma/client'

import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    throw createError({ statusCode: 401, message: 'Neautorizováno' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID nenalezeno' })
  }

  const body = await readBody(event)

  const clientSite = await db.clientSite.findUnique({
    where: { id },
    include: { socials: true, users: { where: { role: 'ai' }, take: 1 } },
  })
  if (!clientSite) {
    throw createError({ statusCode: 404, message: 'Klient nenalezen' })
  }

  if (clientSite.deletedAt && body.deletedAt !== null) {
    throw createError({ statusCode: 400, message: 'Nelze aktualizovat deaktivovaného klienta' })
  }

  if (body.subdomain) {
    const existing = await db.clientSite.findUnique({ where: { subdomain: body.subdomain } })
    if (existing && existing.id !== id) {
      throw createError({ statusCode: 409, message: 'Subdoména již existuje' })
    }
  }

  const data: any = {}
  if (body.name !== undefined) data.name = body.name
  if (body.subdomain !== undefined) data.subdomain = body.subdomain
  if (body.plan !== undefined) data.plan = body.plan
  if (body.generationFrequency !== undefined) data.generationFrequency = body.generationFrequency
  if (body.tokenLimit !== undefined) {
    data.tokenLimit = body.tokenLimit
    data.tokenRemaining = body.tokenLimit
  }
  if (body.keywords !== undefined) data.keywords = body.keywords
  if (body.audience !== undefined) data.audience = body.audience
  if (body.focus !== undefined) data.focus = body.focus
  if (body.description !== undefined) data.description = body.description ? sanitizeHtml(body.description) : null
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl
  if (body.deletedAt !== undefined) {
    data.deletedAt = body.deletedAt === null ? null : new Date()
  }

  const ip = getIp(event)

  if (body.aiUser !== undefined && clientSite.tokenLimit && clientSite.tokenLimit > 0) {
    const existingAiUser = clientSite.users[0]
    if (existingAiUser) {
      await db.user.update({
        where: { id: existingAiUser.id },
        data: {
          username: body.aiUser.username || `ai-${id}-${Date.now()}`,
          bio: body.aiUser.bio || '',
          avatarUrl: body.aiUser.avatarUrl || '',
        },
      })
      await logAction({
        action: 'AI_USER_UPDATE',
        userId: user.id,
        clientSiteId: id,
        ip,
        metadata: { aiUserId: existingAiUser.id, updatedFields: body.aiUser },
      })
    } else {
      const aiUserData = {
        username: body.aiUser.username || `ai-${id}-${Date.now()}`,
        email: `ai-${randomBytes(8).toString('hex')}@generated.ai`,
        password: null,
        role: 'ai' as const,
        bio: body.aiUser.bio || '',
        avatarUrl: body.aiUser.avatarUrl || '',
        clientSiteId: id,
      }
      const newAiUser = await db.user.create({
        data: aiUserData,
      })
      await logAction({
        action: 'AI_USER_CREATE',
        userId: user.id,
        clientSiteId: id,
        ip,
        metadata: { aiUser: aiUserData, aiUserId: newAiUser.id },
      })
    }
  } else if (body.tokenLimit === 0 && clientSite.users[0]) {
    await db.user.delete({
      where: { id: clientSite.users[0].id },
    })
    await logAction({
      action: 'AI_USER_DELETE',
      userId: user.id,
      clientSiteId: id,
      ip,
      metadata: { aiUserId: clientSite.users[0].id },
    })
  }

  if (body.socials !== undefined) {
    const existingSocials = clientSite.socials
    const newSocials = body.socials as { platform: SocialPlatform; url: string }[]

    const toDelete = existingSocials.filter((es) => !newSocials.some((ns) => ns.platform === es.platform))
    const toUpdate = newSocials.filter((ns) => existingSocials.some((es) => es.platform === ns.platform))
    const toCreate = newSocials.filter((ns) => !existingSocials.some((es) => es.platform === ns.platform))

    if (toDelete.length > 0) {
      await db.social.deleteMany({
        where: {
          clientSiteId: id,
          platform: { in: toDelete.map((s) => s.platform) },
        },
      })
    }

    for (const social of toUpdate) {
      await db.social.updateMany({
        where: { clientSiteId: id, platform: social.platform },
        data: { url: social.url },
      })
    }

    if (toCreate.length > 0) {
      await db.social.createMany({
        data: toCreate.map((social) => ({
          clientSiteId: id,
          platform: social.platform,
          url: social.url,
        })),
      })
    }
  }

  const updatedSite = await db.clientSite.update({
    where: { id },
    data,
    include: { socials: true, users: { where: { role: 'ai' }, take: 1 } },
  })

  await logAction({
    action: 'CLIENT_SITE_UPDATE',
    userId: user.id,
    clientSiteId: id,
    ip,
    metadata: { updatedFields: body },
  })

  return {
    clientSite: {
      id: updatedSite.id,
      name: updatedSite.name,
      subdomain: updatedSite.subdomain,
      plan: updatedSite.plan,
      generationFrequency: updatedSite.generationFrequency,
      tokenLimit: updatedSite.tokenLimit,
      deletedAt: updatedSite.deletedAt,
      keywords: updatedSite.keywords,
      audience: updatedSite.audience,
      focus: updatedSite.focus,
      description: updatedSite.description,
      logoUrl: updatedSite.logoUrl,
      socials: updatedSite.socials.map((s) => ({
        platform: s.platform,
        url: s.url,
      })),
      aiUser: updatedSite.users[0]
        ? {
            username: updatedSite.users[0].username,
            bio: updatedSite.users[0].bio,
            avatarUrl: updatedSite.users[0].avatarUrl,
          }
        : null,
    },
  }
})
