export const ARTICLE_GENERATION_FORMATS = ['news', 'analysis', 'guide', 'comparison', 'opinion', 'story'] as const
export type ArticleGenerationFormat = (typeof ARTICLE_GENERATION_FORMATS)[number]

export const ARTICLE_GENERATION_MODULES = ['answer', 'takeaways', 'faq', 'poll', 'table', 'images', 'youtube'] as const
export type ArticleGenerationModule = (typeof ARTICLE_GENERATION_MODULES)[number]

export const ARTICLE_GENERATION_ALLOWED_MODULES: Record<ArticleGenerationFormat, readonly ArticleGenerationModule[]> = {
  news: ['answer', 'takeaways', 'poll', 'images', 'youtube'],
  analysis: ['answer', 'takeaways', 'table', 'images', 'youtube'],
  guide: ['answer', 'takeaways', 'faq', 'images', 'youtube'],
  comparison: ['answer', 'takeaways', 'faq', 'poll', 'table', 'images', 'youtube'],
  opinion: ['poll', 'images', 'youtube'],
  story: ['images', 'youtube'],
}

export const RESEARCH_DEPTHS = ['quick', 'standard', 'deep'] as const
export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number]

export interface ArticleMediaProgress {
  stage: 'cover' | 'content' | 'complete'
  completed: number
  total: number
  found: number
}

export interface ArticleGenerationBilling {
  clientTokensCharged: number
  clientTokensUsed: number
  fullyCovered: boolean
  apiTokens: number
  tokenRemaining: number
}

export interface ArticleGenerationResult {
  status: 'completed' | 'partial' | 'stopped' | 'failed'
  durationSeconds: number
  sourceCount: number
  wordCount: number
  mediaFound: number
  mediaTotal: number
  tokenUsage: number | null
  tokenRemaining: number | null
  missingModules: ArticleGenerationModule[]
}

export interface ArticleGenerationOptions {
  format: ArticleGenerationFormat
  modules: ArticleGenerationModule[]
  research: {
    enabled: boolean
    depth: ResearchDepth
    fallbackWithoutResearch: boolean
  }
}

export const defaultArticleGenerationOptions = (): ArticleGenerationOptions => ({
  format: 'news',
  modules: ['answer', 'takeaways'],
  research: {
    enabled: true,
    depth: 'standard',
    fallbackWithoutResearch: true,
  },
})
