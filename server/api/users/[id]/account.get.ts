import { authenticator } from 'otplib'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { id } = getRouterParams(event)
  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const userData = await prisma.user.findUnique({
    where: { id },
    include: {
      comments: {
        where: { deletedAt: null, parentId: null },
        include: {
          reactions: { select: { type: true } },
          article: {
            select: {
              slug: true,
              title: true,
              user: { select: { username: true, avatarUrl: true } },
              views: true,
              tags: { select: { tag: { select: { name: true } } } },
            },
          },
        },
      },
      followers: { select: { followerId: true } },
      following: { select: { followedId: true } },
      articleReactions: {
        where: { userId: id },
        include: {
          article: {
            select: {
              id: true,
              slug: true,
              title: true,
              imageUrl: true,
              createdAt: true,
              user: { select: { username: true, avatarUrl: true } },
              views: true,
              tags: { select: { tag: { select: { name: true } } } },
              reactions: { select: { id: true } },
            },
          },
        },
      },
      sessions: {
        where: { revoked: false },
        select: {
          id: true,
          ip: true,
          userAgent: true,
          device: true,
          os: true,
          browser: true,
          city: true,
          region: true,
          country: true,
          lastUsedAt: true,
          revoked: true,
          userId: true,
        },
      },
    },
  })

  if (!userData) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  const likesCount = userData.comments.reduce((sum, c) => sum + c.reactions.filter((r) => r.type === 'LIKE').length, 0)
  const dislikesCount = userData.comments.reduce(
    (sum, c) => sum + c.reactions.filter((r) => r.type === 'DISLIKE').length,
    0,
  )

  let otpauthUrl = ''
  if (userData.totpSecret) {
    otpauthUrl = authenticator.keyuri(userData.username, 'Topiqu', userData.totpSecret)
  }

  return {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    bio: userData.bio,
    avatarUrl: userData.avatarUrl,
    createdAt: userData.createdAt.toISOString(),
    lastLogin: userData.lastLogin?.toISOString() ?? null,
    allowNotifs: userData.allowNotifs,
    allowEmail: userData.allowEmail,
    role: userData.role,
    emailVerified: userData.emailVerified,
    clientSiteId: userData.clientSiteId,
    language: userData.language,
    commentsCount: userData.comments.length,
    likesCount,
    dislikesCount,
    followers: userData.followers.length,
    following: userData.following.length,
    theme: userData.theme,
    hasPassword: !!userData.password,
    totpSecret: userData.totpSecret,
    otpauthUrl,
    likedArticles: userData.articleReactions.map((r) => ({ id: r.article.id })),
    sessions: userData.sessions.map((s) => ({
      id: s.id,
      ip: s.ip,
      userAgent: s.userAgent,
      device: s.device,
      os: s.os,
      browser: s.browser,
      city: s.city,
      region: s.region,
      country: s.country,
      lastUsedAt: s.lastUsedAt.toISOString(),
      revoked: s.revoked,
      userId: s.userId,
    })),
  }
})
