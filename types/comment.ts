export interface CommentWithReplies {
  id: string
  content: string
  createdAt: Date
  userId: string
  parentId: string | null
  user: { id: string; username: string } | null
  replies: CommentWithReplies[]
  likes: number
  dislikes: number
  userReaction: { type: 'LIKE' | 'DISLIKE' } | null
}
