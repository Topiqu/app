import type { Article as _Article, ArticleStatus, AIInvolvement } from '@zenstackhq/runtime/models'
//
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
  sourceSlug?: string
  language?: string
  title: string
  content: string | null
  imageUrl: string | null
  /** Prisma `Json`, so it arrives as `JsonValue`. `CoverCredit` is the shape; Hero casts and
   *  `creditHref` is what actually guards it, since the column is admin-editable. */
  imageCredit?: unknown
  createdAt: string
  excerpt: string | null
  answer?: string | null
  keyTakeaways?: string[]
  faq?: unknown
  readingTime: number | null
  views: number
  releaseAt: Date | string | null
  status: ArticleStatus
  aiInvolvement: AIInvolvement
  savedAmount: number | null
  savedTimeMinutes: number | null
  userId?: string | null
  sources?: string[]
  user: { id: string; username: string; email: string; avatarUrl: string | null } | null
  tags: { tag: { id: string; name: string; slug: string } }[]
  articleSeries?: { id: string; name: string; slug?: string; articles?: unknown[] } | null
  translations?: { language: string; status: string; slug: string | null }[]
  _count: { comments: number; reactions: number } | null
}
