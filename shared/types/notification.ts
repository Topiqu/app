export type NotificationCursor = { createdAt: string; id: string }

export type NotificationPollResponse<T> = {
  notifications: T[]
  unreadCount: number
  cursor: NotificationCursor
  hasMore: boolean
}
