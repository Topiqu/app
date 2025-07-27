export interface CommentWithReplies {
  id: string
  content: string
  createdAt: Date
  userId: string
  parentId: string | null
  deletedAt: Date | null
  user: {
    id: string
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
  replies: CommentWithReplies[]
  likes: number
  dislikes: number
  userReaction: { type: 'LIKE' | 'DISLIKE' } | null
}
