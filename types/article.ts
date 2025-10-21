import type { Article as _Article, ArticleStatus } from '@zenstackhq/runtime/models'

export type ArticleBase = _Article & {
  user: { id: string; username: string; email: string; avatarUrl: string | null }
  tags?: { tag: { id: string; name: string; slug: string } }[]
  commentCount?: number
  likes: number
  views: number
  likedByUser: boolean
  allowedComments: boolean
  createdAt: string
  readingTime: number
  followerCount: number
}

export type ArticleWithDetails = {
  id: string
  slug: string
  title: string
  content: string | null
  imageUrl: string | null
  createdAt: string
  excerpt: string | null
  readingTime: number | null
  views: number
  releaseAt: Date | string | null
  status: ArticleStatus
  userId?: string | null
  user: { id: string; username: string; email: string; avatarUrl: string | null } | null
  tags: { tag: { id: string; name: string; slug: string } }[]
  _count: { comments: number; reactions: number } | null
}
