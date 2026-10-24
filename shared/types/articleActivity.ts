export interface ArticleBackgroundTask {
  id: string
  kind: 'generation' | 'translation'
  status: 'running' | 'completed' | 'failed' | 'stopped'
  title: string | null
  slug: string | null
  language: Language | null
  createdAt: string
  updatedAt: string
}
