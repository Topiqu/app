export type ArticleCardData = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  excerpt?: string | null
  content?: string | null
  status?: string
  createdAt: string | Date
  publishedAt?: string | Date | null
  readingTime?: number | null
  views?: number
  likes?: number
  likedByUser?: boolean
  shares?: number
  user?: { id?: string; username: string; avatarUrl?: string | null } | null
  author?: { id?: string; name: string; avatarUrl?: string | null } | null
  tags?: Array<{ id?: string; name?: string; slug?: string; tag?: { id: string; name: string; slug?: string } }>
  _count?: { comments?: number; reactions?: number; shares?: number } | null
}

export type ArticleCardVariant = 'standard' | 'featured' | 'compact'
export type ArticleCardLayout = 'column' | 'responsive-row'
