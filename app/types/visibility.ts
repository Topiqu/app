import type { InternalApi } from 'nitropack/types'
export type VisibilityOverview = InternalApi['/api/ai-visibility/overview']['get']
export type VisibilityPrompt = VisibilityOverview['prompts'][number]
export type VisibilityDomain = VisibilityOverview['domains']['competitors'][number]
