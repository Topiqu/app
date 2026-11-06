export interface ArticleBackgroundTask {
  id: string
  kind: 'generation' | 'translation' | 'batch'
  status: 'running' | 'completed' | 'failed' | 'stopped'
  /** Articles written out of the batch. */
  progress?: { done: number; total: number }
  title: string | null
  slug: string | null
  language: Language | null
  createdAt: string
  updatedAt: string
}
