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
    const conflict = await db.clientSite.findFirst({
      where: { subdomain: body.subdomain, id: { not: id } },
    })
    if (conflict) throw createError({ statusCode: 409, message: t('common.errors.subdomainExists')! })
  }

  const allowedFields = [
    'name',
    'subdomain',
    'plan',
    'generationFrequency',
    'tokenLimit',
    'keywords',
    'audience',
    'language',
    'theme',
    'focus',
    'logoUrl',
    'autoRelease',
    'gtagId',
    'gamNetworkCode',
    'allowAds',
    'allowGtag',
  ]

  const data: any = allowedFields.reduce(
    (acc, field) => {
      if (body[field] !== undefined) acc[field] = body[field]
      return acc
    },
    {} as Record<string, any>,
  )

  if (body.tokenLimit !== undefined) data.tokenRemaining = body.tokenLimit
  if (body.description !== undefined) data.description = body.description ? sanitizeHtml(body.description) : null
  if (body.deletedAt !== undefined) data.deletedAt = body.deletedAt === null ? null : new Date()

  const aiUserPayload = body.aiUser
  const currentAiUser = clientSite.users[0]
  const hasAiPayload = aiUserPayload && Object.values(aiUserPayload).some((v) => v !== '')
  const effectiveTokenLimit = body.tokenLimit ?? clientSite.tokenLimit ?? 0

  if (hasAiPayload && effectiveTokenLimit > 0) {
    const aiData = {
      username: aiUserPayload.username || `ai-${id}-${Date.now()}`,
      bio: aiUserPayload.bio || '',
      avatarUrl: aiUserPayload.optimizedAvatarUrl || '',
    }

    if (currentAiUser) {
      await db.user.update({ where: { id: currentAiUser.id }, data: aiData })
      await logAction({
        action: 'AI_USER_UPDATE',
        userId: user.id,
        clientSiteId: id,
        ip: getIp(event),
        metadata: { aiUserId: currentAiUser.id, updatedFields: aiUserPayload },
      })
    } else {
      const newAi = await db.user.create({
        data: {
          ...aiData,
          email: `ai-${randomBytes(8).toString('hex')}@generated.ai`,
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
  } else if (body.tokenLimit === 0 && currentAiUser) {
    await db.user.delete({ where: { id: currentAiUser.id } })
    await logAction({
      action: 'AI_USER_DELETE',
      userId: user.id,
      clientSiteId: id,
      ip: getIp(event),
      metadata: { aiUserId: currentAiUser.id },
    })
  }

  if (body.socials) {
    const incoming = body.socials as { platform: SocialPlatform; url: string }[]
    const existing = clientSite.socials
    const operations = []

    const toDelete = existing.filter((e) => !incoming.find((i) => i.platform === e.platform)).map((s) => s.platform)
    if (toDelete.length)
      operations.push(db.social.deleteMany({ where: { clientSiteId: id, platform: { in: toDelete } } }))

    for (const s of incoming) {
      const exists = existing.find((e) => e.platform === s.platform)
      if (exists) {
        if (exists.url !== s.url)
          operations.push(
            db.social.updateMany({ where: { clientSiteId: id, platform: s.platform }, data: { url: s.url } }),
          )
      } else {
        operations.push(db.social.create({ data: { clientSiteId: id, platform: s.platform, url: s.url } }))
      }
    }

    if (operations.length) await Promise.all(operations)
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
    metadata: { updatedFields: Object.keys(data) },
  })

  const ai = updatedSite.users[0]
  return {
    clientSite: {
      ...updatedSite,
      socials: updatedSite.socials.map((s) => ({ platform: s.platform, url: s.url })),
      aiUser: ai ? { username: ai.username, bio: ai.bio, avatarUrl: ai.avatarUrl } : null,
      users: undefined,
    },
  }
})
