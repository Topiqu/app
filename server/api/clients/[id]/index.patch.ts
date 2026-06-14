import type { SocialPlatform } from '@prisma/client'

import { randomBytes } from 'crypto'
import { models } from '~~/shared/zod'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || !['superadmin', 'admin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const db = await getEnhancedPrisma(user)
  const body = await readBody(event)

  delete body.id
  delete body.optimizedUrl

  const {
    socials,
    aiUser,
    apiKey: _apiKey,
    linkedinMode,
    linkedinBrandProfile,
    linkedinCompanyType: _linkedinCompanyType,
    ...scalarBody
  } = body

  const clientSite = await db.clientSite.findUnique({
    where: { id },
    include: { socials: true, users: { where: { role: 'ai' }, take: 1 } },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })

  if (clientSite.deletedAt && body.deletedAt !== null)
    throw createError({ statusCode: 400, message: t('common.errors.clientDeactivated')! })

  if (body.domain) {
    const conflict = await db.clientSite.findFirst({
      where: { domain: body.domain, id: { not: id } },
    })
    if (conflict) throw createError({ statusCode: 409, message: t('common.errors.subdomainExists')! })
  }

  const UpdateSchema = models.ClientSiteScalarSchema.pick({
    name: true,
    domain: true,
    plan: true,
    generationFrequency: true,
    tokenLimit: true,
    keywords: true,
    audience: true,
    language: true,
    theme: true,
    focus: true,
    description: true,
    logoUrl: true,
    autoRelease: true,
    gtagId: true,
    gamNetworkCode: true,
    allowAds: true,
    allowGtag: true,
    aiToneOfVoice: true,
    aiControversyLevel: true,
    translationMode: true,
    translationLanguages: true,
  }).partial()

  const parsed = UpdateSchema.safeParse(scalarBody)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }
  const data: any = { ...parsed.data }

  if (scalarBody.tokenLimit !== undefined) data.tokenRemaining = scalarBody.tokenLimit
  if (scalarBody.description !== undefined)
    data.description = scalarBody.description ? sanitizeHtml(scalarBody.description) : null
  if (scalarBody.deletedAt !== undefined) data.deletedAt = scalarBody.deletedAt === null ? null : new Date()

  const aiUserPayload = aiUser
  const currentAiUser = clientSite.users[0]
  const hasAiPayload = aiUserPayload && Object.values(aiUserPayload).some((v) => v !== '')
  const effectiveTokenLimit = scalarBody.tokenLimit ?? clientSite.tokenLimit ?? 0

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
  } else if (scalarBody.tokenLimit === 0 && currentAiUser) {
    await db.user.delete({ where: { id: currentAiUser.id } })
    await logAction({
      action: 'AI_USER_DELETE',
      userId: user.id,
      clientSiteId: id,
      ip: getIp(event),
      metadata: { aiUserId: currentAiUser.id },
    })
  }

  if (socials) {
    const incoming = socials as { platform: SocialPlatform; url: string }[]
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

  if (linkedinMode !== undefined) {
    // Note: This endpoint currently updates the FIRST linkedin company it finds.
    // If you need to specify which one (pages vs personal), you would need to pass the type in the body.
    // For now, we'll try to find the 'pages' one first, then fallback to finding any.
    let company = await db.linkedinCompany.findFirst({
      where: { clientSiteId: id, type: 'pages' },
    })

    if (!company) {
      company = await db.linkedinCompany.findFirst({
        where: { clientSiteId: id },
      })
    }

    if (!company) {
      company = await db.linkedinCompany.create({
        data: {
          name: 'My Company',
          linkedinOrgId: 'placeholder', // actual sync comes later with oauth
          type: 'pages', // Defaulting to pages if none exists
          mode: linkedinMode,
          clientSiteId: id,
        },
      })
    } else {
      company = await db.linkedinCompany.update({
        where: { id: company.id },
        data: { mode: linkedinMode },
      })
    }

    if (linkedinBrandProfile) {
      await db.brandProfile.upsert({
        where: { companyId: company.id },
        create: {
          companyId: company.id,
          tone: linkedinBrandProfile.tone,
          audience: linkedinBrandProfile.audience,
          doList: linkedinBrandProfile.doList,
          dontList: linkedinBrandProfile.dontList,
        },
        update: {
          tone: linkedinBrandProfile.tone,
          audience: linkedinBrandProfile.audience,
          doList: linkedinBrandProfile.doList,
          dontList: linkedinBrandProfile.dontList,
        },
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
