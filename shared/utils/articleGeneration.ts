export const ARTICLE_GENERATION_FORMATS = ['news', 'analysis', 'guide', 'comparison', 'opinion', 'story'] as const
export type ArticleGenerationFormat = (typeof ARTICLE_GENERATION_FORMATS)[number]

export const ARTICLE_GENERATION_MODULES = ['answer', 'takeaways', 'faq', 'poll', 'table', 'youtube'] as const
export type ArticleGenerationModule = (typeof ARTICLE_GENERATION_MODULES)[number]

export const ARTICLE_GENERATION_ALLOWED_MODULES: Record<ArticleGenerationFormat, readonly ArticleGenerationModule[]> = {
  news: ['answer', 'takeaways', 'poll', 'youtube'],
  analysis: ['answer', 'takeaways', 'table', 'youtube'],
  guide: ['answer', 'takeaways', 'faq', 'youtube'],
  comparison: ['answer', 'takeaways', 'faq', 'poll', 'table', 'youtube'],
  opinion: ['poll', 'youtube'],
  story: ['youtube'],
}

export const RESEARCH_DEPTHS = ['quick', 'standard', 'deep'] as const
export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number]

export interface ArticleMediaProgress {
  stage: 'cover' | 'content' | 'complete'
  completed: number
  total: number
  found: number
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
