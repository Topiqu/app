import type { Prisma } from '@prisma/client'

/** Max notifications returned per poll tick. */
export const POLL_MAX_BATCH = 25

/**
 * Cursor semantics for the notifications poll endpoint.
 *
 * `since` is the createdAt of the newest notification the client already holds.
 * We return strictly newer ones (`gt`, not `gte`) to avoid re-sending the
 * boundary item the client used as its cursor. Without a cursor we return
 * nothing — the client already has the full list from its initial fetch and
 * only needs the unread count.
 */
export const buildPollFindArgs = (
  userId: string,
  since: Date | undefined,
): Prisma.NotificationFindManyArgs | null => {
  if (!since) return null
  return {
    where: { userId, deletedAt: null, createdAt: { gt: since } },
    include: { article: { select: { title: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: POLL_MAX_BATCH,
  }
}

export const buildUnreadCountArgs = (userId: string): Prisma.NotificationCountArgs => ({
  where: { userId, isRead: false, deletedAt: null },
})
