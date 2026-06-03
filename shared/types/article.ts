export type ArticleCardData = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  status: string
  createdAt: string | Date
  views: number
  likes: number
  user: { username: string } | null
}
