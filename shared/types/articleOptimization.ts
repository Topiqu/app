export type OptimizationCategory = 'seo' | 'ai-visibility' | 'readability' | 'trust'
export type OptimizationStatus = 'error' | 'warning' | 'passed' | 'not-applicable'
export type OptimizationSource = 'local' | 'remote'
export type ContentEvaluationState = 'empty' | 'insufficient' | 'substantial'
export type OptimizationCategoryStatus = 'evaluated' | 'insufficient-data'
export type OptimizationTargetKind = 'title' | 'excerpt' | 'content' | 'featured-image' | 'sources'

export interface OptimizationTarget {
  kind: OptimizationTargetKind
  blockIndex?: number
}

export interface OptimizationCheck {
  id: string
  category: OptimizationCategory
  status: OptimizationStatus
  source: OptimizationSource
  weight: number
  target: OptimizationTarget
  meta?: Record<string, string | number>
}

export interface OptimizationCategoryScore {
  category: OptimizationCategory
  status: OptimizationCategoryStatus
  score: number | null
}

export interface ArticleOptimizationResult {
  overallScore: number
  contentState: ContentEvaluationState
  categories: OptimizationCategoryScore[]
  checks: OptimizationCheck[]
  counts: { issues: number; recommendations: number; passed: number }
}

export interface ArticleOptimizationInput {
  title: string
  excerpt: string | null
  content: string
  imageUrl: string | null
  sources: string[]
  tenantDomain?: string | null
}
