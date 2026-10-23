/** The durable partial/final result used by generation recovery and the editor. */
export type GenerationSnapshot = {
  title?: string
  perex?: string
  content?: string
  sources?: string[]
  articleImageUrl?: string | null
  articleImageCredit?: unknown
  articleCoverMediaId?: string | null
  answer?: string | null
  keyTakeaways?: string[]
  faq?: unknown
  tags?: string[]
  format?: string
  metrics?: { totalWords?: number; savedAmount?: number; savedTimeMinutes?: number }
}
