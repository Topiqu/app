export interface CommentWithReplies {
  id: string
  content: string
  createdAt: Date
  userId: string
  parentId: string | null
  deletedAt: Date | null
  articleId?: string
  user: {
    username: string
    email?: string
    avatarUrl?: string
    lastLogin?: string
    bio?: string
    createdAt: string
    commentsCount: number
    likesCount: number
    dislikesCount: number
  } | null
  article: {
    clientSiteId: string
    userId: string
  }
  replies: CommentWithReplies[]
  likes: number
  dislikes: number
  depth?: number
  userReaction: { type: 'LIKE' | 'DISLIKE' } | null
  emojiReactions?: { emojiId: string; count: number; emoji: { imageUrl: string; shortcode: string } }[]
}
