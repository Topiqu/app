import type { SocialPlatform } from '@prisma/client'

import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || !['superadmin', 'admin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const db = await getEnhancedPrisma(user)
  const body = await readBody(event)

  const clientSite = await db.clientSite.findUnique({
    where: { id },
    include: { socials: true, users: { where: { role: 'ai' }, take: 1 } },
  })
  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })

  if (clientSite.deletedAt && body.deletedAt !== null)
    throw createError({ statusCode: 400, message: t('common.errors.clientDeactivated')! })

  if (body.subdomain) {
    const conflict = await db.clientSite.findUnique({ where: { subdomain: body.subdomain } })
    if (conflict && conflict.id !== id)
      throw createError({ statusCode: 409, message: t('common.errors.subdomainExists')! })
  }

  const data: any = {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.subdomain !== undefined && { subdomain: body.subdomain }),
    ...(body.plan !== undefined && { plan: body.plan }),
    ...(body.generationFrequency !== undefined && { generationFrequency: body.generationFrequency }),
    ...(body.tokenLimit !== undefined && { tokenLimit: body.tokenLimit, tokenRemaining: body.tokenLimit }),
    ...(body.keywords !== undefined && { keywords: body.keywords }),
    ...(body.audience !== undefined && { audience: body.audience }),
    ...(body.language !== undefined && { language: body.language }),
    ...(body.theme !== undefined && { theme: body.theme }),
    ...(body.focus !== undefined && { focus: body.focus }),
    ...(body.description !== undefined && { description: body.description ? sanitizeHtml(body.description) : null }),
    ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
    ...(body.deletedAt !== undefined && { deletedAt: body.deletedAt === null ? null : new Date() }),
  }

  const aiUserPayload = body.aiUser
  const hasAiUserData = aiUserPayload && !Object.values(aiUserPayload).every((v) => v === '')
  const aiUser = clientSite.users[0]

  if (hasAiUserData && clientSite.tokenLimit && clientSite.tokenLimit > 0) {
    const aiData = {
      username: aiUserPayload.username || `ai-${id}-${Date.now()}`,
      bio: aiUserPayload.bio || '',
      avatarUrl: aiUserPayload.avatarUrl || '',
    }

    if (aiUser) {
      await db.user.update({ where: { id: aiUser.id }, data: aiData })
      await logAction({
        action: 'AI_USER_UPDATE',
        userId: user.id,
        clientSiteId: id,
        ip: getIp(event),
        metadata: { aiUserId: aiUser.id, updatedFields: aiUserPayload },
      })
    } else {
      const newAi = await db.user.create({
        data: {
          ...aiData,
          email: `ai-${randomBytes(8).toString('hex')}@generated.ai`,
          password: null,
          role: 'ai',
          clientSiteId: id,
        },
      })
      await logAction({
        action: 'AI_USER_CREATE',
        userId: user.id,
        clientSiteId: id,
        ip: getIp(event),
        metadata: { aiUserId: newAi.id },
      })
    }
  } else if (body.tokenLimit === 0 && aiUser) {
    await db.user.delete({ where: { id: aiUser.id } })
    await logAction({
      action: 'AI_USER_DELETE',
      userId: user.id,
      clientSiteId: id,
      ip: getIp(event),
      metadata: { aiUserId: aiUser.id },
    })
  }

  if (body.socials) {
    const incoming = body.socials as { platform: SocialPlatform; url: string }[]
    const existing = clientSite.socials

    const toDelete = existing.filter((e) => !incoming.some((i) => i.platform === e.platform))
    const toUpdate = incoming.filter((i) => existing.some((e) => e.platform === i.platform))
    const toCreate = incoming.filter((i) => !existing.some((e) => e.platform === i.platform))

    if (toDelete.length)
      await db.social.deleteMany({ where: { clientSiteId: id, platform: { in: toDelete.map((s) => s.platform) } } })
    for (const s of toUpdate)
      await db.social.updateMany({ where: { clientSiteId: id, platform: s.platform }, data: { url: s.url } })
    if (toCreate.length)
      await db.social.createMany({
        data: toCreate.map((s) => ({ clientSiteId: id, platform: s.platform, url: s.url })),
      })
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
    ip: getIp(event),
    metadata: { updatedFields: Object.keys(body) },
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
      socials: updatedSite.socials.map((s) => ({ platform: s.platform, url: s.url })),
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
