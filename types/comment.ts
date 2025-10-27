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
    email?: string
    avatarUrl?: string
    bio?: string
    createdAt: string
    lastLogin?: string
    commentsCount: number
    likesCount: number
    dislikesCount: number
    followers: number
    following: number
    role: string
    isBanned: boolean
    banDetails?: {
      reason?: string
      expiresAt?: string
    }
  } | null
  article: {
    clientSiteId: string
    userId: string
  }
  likes: number
  dislikes: number
  replies: CommentWithReplies[]
  userReaction: { type: string } | null
  emojiReactions: { emojiId: string; count: number; emoji: { imageUrl: string; shortcode: string } }[]
  depth: number
  isLikedByAuthor: boolean
}
