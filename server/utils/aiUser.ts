import type { H3Event } from 'h3'

import { randomBytes } from 'crypto'

// The AI author row is created lazily by the settings save, so anything that edits it before the
// first save has to be able to bring it into existence itself.
export async function resolveAiUser(event: H3Event, clientSiteId: string, create = false) {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || !['admin', 'superadmin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  // ZenStack lets any admin write any User row, so tenancy is pinned here rather than by policy.
  if (user.role !== 'superadmin' && user.clientSiteId !== clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const site = await db.clientSite.findUnique({ where: { id: clientSiteId }, select: { id: true, tokenLimit: true } })
  if (!site) throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })
  if (!site.tokenLimit) throw createError({ statusCode: 403, message: t('common.errors.unauthorized')! })

  const existing = await db.user.findFirst({
    where: { clientSiteId, role: 'ai' },
    select: { id: true, avatarUrl: true },
  })
  if (existing || !create) return { db, user, aiUser: existing }

  const aiUser = await db.user.create({
    data: {
      username: `ai-${clientSiteId}-${Date.now()}`,
      email: `ai-${randomBytes(8).toString('hex')}@generated.ai`,
      role: 'ai',
      clientSiteId,
      emailVerified: true,
      allowNotifs: false,
      allowEmail: false,
    },
    select: { id: true, avatarUrl: true },
  })

  await logAction({
    action: 'AI_USER_CREATE',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { aiUserId: aiUser.id },
  })

  return { db, user, aiUser }
}
