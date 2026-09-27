export interface CommentWithReplies {
  id: string
  content: string
  gifUrl: string | null
  createdAt: Date
  userId: string
  parentId: string | null
  deletedAt: Date | null
  articleId: string
  user: {
    username: string
    avatarUrl?: string
    bio?: string
    isBanned: boolean
    /** Only sent to the site's moderators. */
    banDetails?: {
      reason?: string
      expiresAt?: string
    }
  } | null
  article: {
    clientSiteId: string
  }
  likes: number
  dislikes: number
  replies: CommentWithReplies[]
  userReaction: { type: string } | null
  emojiReactions: { emojiId: string; count: number; emoji: { imageUrl: string; shortcode: string } }[]
  depth: number
  /** Likes from members of the publication's team. */
  publicationLikes: number
}
