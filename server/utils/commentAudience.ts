// A generated article's author is the AI persona, which reads nothing — so comment activity goes to
// the site's moderators, plus the author when the author is a person.
export const commentAudience = (article: { clientSiteId: string; userId: string }, excludeUserId?: string) =>
  prisma.user.findMany({
    where: {
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      role: { not: 'ai' },
      deletedAt: null,
      OR: [
        { id: article.userId },
        {
          tenantMemberships: {
            some: {
              clientSiteId: article.clientSiteId,
              deletedAt: null,
              OR: [{ role: 'OWNER' }, { scopes: { has: 'CONTENT_MODERATE' } }],
            },
          },
        },
      ],
    },
    select: { id: true, email: true, language: true, allowEmail: true, allowNotifs: true },
  })
