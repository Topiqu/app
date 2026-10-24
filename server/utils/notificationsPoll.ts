import type { NotificationCountArgs, NotificationFindManyArgs } from '~~/generated/zenstack/input'

import type { NotificationCursor } from '../../shared/types/notification'

/** Max notifications returned per poll tick. */
export const POLL_MAX_BATCH = 25

/** A stable time/id cursor drains oldest-first, including notifications sharing a timestamp. */
export const buildPollFindArgs = (
  userId: string,
  since: Date | undefined,
  sinceId?: string,
): NotificationFindManyArgs => {
  const orderedCursor = since && sinceId !== undefined
  return {
    where: {
      userId,
      deletedAt: null,
      ...(orderedCursor
        ? { OR: [{ createdAt: { gt: since } }, { createdAt: since, id: { gt: sinceId } }] }
        : since
          ? { createdAt: { gt: since } }
          : {}),
    },
    include: { article: { select: { title: true, slug: true, language: true, imageUrl: true } } },
    // Retain newest-first responses for older clients that send only `since`.
    orderBy: orderedCursor ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
    take: POLL_MAX_BATCH,
  }
}

export const notificationCursor = (
  row: { createdAt: Date; id: string } | undefined,
  startedAt: Date,
): NotificationCursor => ({
  createdAt: (row?.createdAt ?? startedAt).toISOString(),
  id: row?.id ?? '',
})

export const buildUnreadCountArgs = (userId: string): NotificationCountArgs => ({
  where: { userId, isRead: false, deletedAt: null },
})
