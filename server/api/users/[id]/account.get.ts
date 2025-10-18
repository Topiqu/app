import { authenticator } from 'otplib'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

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
      followers: {
        select: { followerId: true },
      },
      following: {
        select: { followedId: true },
      },
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

  if (!userData) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  const likesCount = userData.comments.reduce(
    (sum, comment) => sum + comment.reactions.filter((r) => r.type === 'LIKE').length,
    0,
  )
  const dislikesCount = userData.comments.reduce(
    (sum, comment) => sum + comment.reactions.filter((r) => r.type === 'DISLIKE').length,
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
    lastLogin: userData.lastLogin ? userData.lastLogin.toISOString() : null,
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
    likedArticles: userData.articleReactions.map((reaction) => ({
      id: reaction.article.id,
    })),
    sessions: userData.sessions.map((session) => ({
      id: session.id,
      ip: session.ip,
      userAgent: session.userAgent,
      device: session.device,
      os: session.os,
      browser: session.browser,
      city: session.city,
      region: session.region,
      country: session.country,
      lastUsedAt: session.lastUsedAt.toISOString(),
      revoked: session.revoked,
      userId: session.userId,
    })),
  }
})
