import type { Language } from '~~/generated/zenstack/models'

export const ARTICLE_GENERATION_FORMATS = ['news', 'analysis', 'guide', 'comparison', 'opinion', 'story'] as const
export type ArticleGenerationFormat = (typeof ARTICLE_GENERATION_FORMATS)[number]

export const ARTICLE_GENERATION_MODULES = ['answer', 'takeaways', 'faq', 'poll', 'table', 'images', 'youtube'] as const
export type ArticleGenerationModule = (typeof ARTICLE_GENERATION_MODULES)[number]

/** What a format proposes when chosen in the editor; the author can still pick any module.
 * Mirrors `defaultModules` in `server/utils/ai/formats.ts`. */
export const ARTICLE_GENERATION_DEFAULT_MODULES: Record<ArticleGenerationFormat, readonly ArticleGenerationModule[]> = {
  news: ['answer', 'takeaways'],
  analysis: ['answer', 'takeaways'],
  guide: ['answer', 'takeaways', 'faq'],
  comparison: ['answer', 'takeaways', 'faq', 'table'],
  opinion: ['poll'],
  story: [],
}

export const RESEARCH_DEPTHS = ['quick', 'standard', 'deep'] as const
export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number]

/** Where an inserted picture came from; `null` in a slot means nothing usable was found. */
export type ArticleMediaSource = 'official' | 'screenshot' | 'library' | 'ai'

export interface ArticleMediaProgress {
  stage: 'cover' | 'content' | 'complete' | 'failed'
  completed: number
  total: number
  found: number
  cover?: ArticleMediaSource | null
  /** Indexed by slot - 1; `undefined` while that slot is still being resolved. */
  slots?: (ArticleMediaSource | null | undefined)[]
}

export type YoutubeOutcome =
  | { status: 'found'; url: string; title: string | null }
  | { status: 'noCandidates' | 'rejected' | 'failed' | 'researchOff' }

export interface GenerationResearchResult {
  status: 'completed' | 'fallback' | 'skipped'
  fallbackReason?: 'timeout' | 'empty' | 'error'
  sourceCount: number
  depth: ResearchDepth
  knowledgeSourceCount?: number
  knowledgeSources?: { id: string; title: string }[]
  sources: string[]
  /** Present only when the YouTube module was selected. */
  youtube?: YoutubeOutcome
}

export interface GenerationReview {
  approved: boolean
  revised: boolean
  issues?: { code: string; note: string }[]
  resolvedIssues?: { code: string; note: string }[]
}

export interface ArticleGenerationBilling {
  articlesCharged: number
  articlesRemaining: number
}

export type GenerationPhase = 'research' | 'writing' | 'images'
export type GenerationWritingStage = 'starting' | 'title' | 'intro' | 'body' | 'review'
export type GenerationFailureStage = 'research' | 'writing' | 'finalization' | 'writer_idle' | 'writer_deadline'

export type GenerationEvent =
  | { type: 'reservation'; articles: number }
  | { type: 'phase'; phase: GenerationPhase }
  | ({ type: 'research' } & GenerationResearchResult)
  | { type: 'activity'; writingStage?: GenerationWritingStage }
  | ({ type: 'media' } & ArticleMediaProgress)
  | { type: 'review'; review: GenerationReview }
  | { type: 'final'; missingModules?: ArticleGenerationModule[] }
  | ({ type: 'billing' } & ArticleGenerationBilling)

export interface GenerationRun {
  status: 'running' | 'completed' | 'partial' | 'stopped' | 'failed'
  modules: ArticleGenerationModule[]
  research: boolean
  useKnowledge: boolean
  phase: GenerationPhase
  writingStage: GenerationWritingStage
  startedAt: number
  finishedAt: number | null
  lastActivityAt: number
  reserved: number | null
  researchResult: GenerationResearchResult | null
  review: GenerationReview | null
  media: ArticleMediaProgress | null
  /** `null` until the final article arrived. */
  missingModules: ArticleGenerationModule[] | null
  charged: boolean
  error: { message: string; stage: GenerationFailureStage | null; creditReturned: boolean } | null
}

export const startGenerationRun = (options: ArticleGenerationOptions, now: number): GenerationRun => ({
  status: 'running',
  modules: [...options.modules],
  research: options.research.enabled,
  useKnowledge: options.useKnowledge !== false,
  phase: options.research.enabled ? 'research' : 'writing',
  writingStage: 'starting',
  startedAt: now,
  finishedAt: null,
  lastActivityAt: now,
  reserved: null,
  researchResult: null,
  review: null,
  media: null,
  missingModules: null,
  charged: false,
  error: null,
})

export const reduceGenerationRun = (run: GenerationRun, event: GenerationEvent, now: number): GenerationRun => {
  const next = { ...run, lastActivityAt: now }
  switch (event.type) {
    case 'reservation':
      return { ...next, reserved: event.articles }
    case 'phase':
      return { ...next, phase: event.phase }
    case 'research': {
      const { type: _, ...researchResult } = event
      return { ...next, researchResult }
    }
    case 'activity':
      return event.writingStage ? { ...next, writingStage: event.writingStage } : next
    case 'media': {
      const { type: _, ...media } = event
      return { ...next, media }
    }
    case 'review':
      return { ...next, review: event.review }
    case 'final':
      return { ...next, missingModules: event.missingModules ?? [] }
    case 'billing':
      return { ...next, charged: event.articlesCharged > 0 }
  }
}

const hasWarnings = (run: GenerationRun) =>
  Boolean(run.missingModules?.length) ||
  run.review?.approved === false ||
  run.media?.stage === 'failed' ||
  (run.researchResult?.status === 'fallback' && run.research)

export const finishGenerationRun = (
  run: GenerationRun,
  outcome: 'completed' | 'aborted' | { message: string; stage?: GenerationFailureStage; creditReturned?: boolean },
  now: number,
): GenerationRun => {
  const finished = { ...run, finishedAt: now }
  if (outcome === 'aborted') return { ...finished, status: 'stopped' }
  if (outcome === 'completed') return { ...finished, status: hasWarnings(run) ? 'partial' : 'completed' }
  return {
    ...finished,
    // An error after the final article (billing, recovery) leaves a usable article behind.
    status: run.missingModules ? 'partial' : 'failed',
    error: { message: outcome.message, stage: outcome.stage ?? null, creditReturned: outcome.creditReturned ?? false },
  }
}

export type GenerationStepId = 'research' | 'knowledge' | 'youtube' | 'writing' | 'review' | 'media' | 'modules'
export type GenerationStepState = 'pending' | 'running' | 'done' | 'warning' | 'failed' | 'skipped'
export interface GenerationStep {
  id: GenerationStepId
  state: GenerationStepState
  /** i18n key under `articles.editor.ai.run`. */
  detail: string | null
  params?: Record<string, string | number>
}

const FAILURE_STEP: Record<GenerationFailureStage, GenerationStepId> = {
  research: 'research',
  writing: 'writing',
  writer_idle: 'writing',
  writer_deadline: 'writing',
  finalization: 'review',
}
const PHASE_ORDER: GenerationPhase[] = ['research', 'writing', 'images']

/** The run as an ordered checklist. Steps the author did not ask for are left out. */
export const generationSteps = (run: GenerationRun, words: number): GenerationStep[] => {
  const phaseIndex = PHASE_ORDER.indexOf(run.phase)
  const reviewing = run.phase === 'writing' && run.writingStage === 'review'
  const research = run.researchResult
  const steps: GenerationStep[] = []
  const researchPending = (): GenerationStep['state'] => (run.phase === 'research' ? 'running' : 'pending')

  if (!run.research) steps.push({ id: 'research', state: 'skipped', detail: 'research.off' })
  else if (!research) steps.push({ id: 'research', state: researchPending(), detail: 'research.running' })
  else if (research.status === 'completed')
    steps.push({ id: 'research', state: 'done', detail: 'research.sources', params: { count: research.sourceCount } })
  else steps.push({ id: 'research', state: 'warning', detail: `research.fallback.${research.fallbackReason ?? 'empty'}` })

  if (run.useKnowledge) {
    const count = research?.knowledgeSourceCount ?? 0
    steps.push(
      !research
        ? { id: 'knowledge', state: researchPending(), detail: 'knowledge.running' }
        : count
          ? { id: 'knowledge', state: 'done', detail: 'knowledge.used', params: { count } }
          : { id: 'knowledge', state: 'skipped', detail: 'knowledge.none' },
    )
  }

  if (run.modules.includes('youtube')) {
    const youtube = research?.youtube
    if (!research) steps.push({ id: 'youtube', state: researchPending(), detail: 'youtube.running' })
    else if (youtube?.status === 'found') {
      const unused = run.missingModules?.includes('youtube')
      steps.push({
        id: 'youtube',
        state: unused ? 'warning' : 'done',
        detail: unused ? 'youtube.notUsed' : 'youtube.found',
        params: { title: youtube.title ?? youtube.url },
      })
    } else if (youtube?.status === 'researchOff')
      steps.push({ id: 'youtube', state: 'skipped', detail: 'youtube.researchOff' })
    else steps.push({ id: 'youtube', state: 'warning', detail: `youtube.${youtube?.status ?? 'failed'}` })
  }

  if (phaseIndex < 1) steps.push({ id: 'writing', state: 'pending', detail: null })
  else if (run.phase === 'writing' && !reviewing)
    steps.push(
      words
        ? { id: 'writing', state: 'running', detail: 'writing.words', params: { count: words } }
        : { id: 'writing', state: 'running', detail: `writing.${run.writingStage}` },
    )
  else steps.push({ id: 'writing', state: 'done', detail: 'writing.words', params: { count: words } })

  const review = run.review
  if (review?.approved && review.revised)
    steps.push({
      id: 'review',
      state: 'done',
      detail: 'review.revised',
      params: { count: review.resolvedIssues?.length ?? 0 },
    })
  else if (review?.approved) steps.push({ id: 'review', state: 'done', detail: 'review.approved' })
  else if (review)
    steps.push({
      id: 'review',
      state: 'warning',
      detail: review.revised ? 'review.revisedIssues' : 'review.issues',
      params: { count: review.issues?.length ?? 0 },
    })
  else
    steps.push({ id: 'review', state: reviewing ? 'running' : 'pending', detail: reviewing ? 'review.running' : null })

  const media = run.media
  if (!media)
    steps.push({ id: 'media', state: run.phase === 'images' ? 'running' : 'pending', detail: run.phase === 'images' ? 'media.cover' : null })
  else if (media.stage === 'failed') steps.push({ id: 'media', state: 'failed', detail: 'media.failed' })
  else if (media.stage === 'cover') steps.push({ id: 'media', state: 'running', detail: 'media.cover' })
  else if (media.stage === 'content')
    steps.push({ id: 'media', state: 'running', detail: 'media.progress', params: { completed: media.completed, total: media.total } })
  else
    steps.push({
      id: 'media',
      state: media.found < media.total ? 'warning' : 'done',
      detail: 'media.complete',
      params: { found: media.found, total: media.total },
    })

  const missing = run.missingModules?.filter((module) => module !== 'youtube' && module !== 'images') ?? []
  if (missing.length) steps.push({ id: 'modules', state: 'warning', detail: 'modules.missing' })

  if (run.status === 'running' || run.status === 'completed' || run.status === 'partial') return steps
  if (run.status === 'stopped')
    return steps.map((step) => (step.state === 'running' ? { ...step, state: 'skipped', detail: 'stopped' } : step))
  const failedId = run.error?.stage ? FAILURE_STEP[run.error.stage] : steps.find((step) => step.state === 'running')?.id
  return steps.map((step) =>
    step.id === failedId
      ? { ...step, state: 'failed', detail: null }
      : step.state === 'running'
        ? { ...step, state: 'pending', detail: null }
        : step,
  )
}

/** What the author asked for but the finished article does not contain. */
export const missingArticleModules = (
  article: { answer?: string | null; keyTakeaways?: unknown[] | null; faq?: unknown[] | null; content?: string | null },
  modules: readonly ArticleGenerationModule[],
) => {
  const content = article.content ?? ''
  const delivered: Record<ArticleGenerationModule, boolean> = {
    answer: Boolean(article.answer),
    takeaways: Boolean(article.keyTakeaways?.length),
    faq: Boolean(article.faq?.length),
    poll: /data-type=["']poll["']/i.test(content),
    table: /<table\b/i.test(content),
    images: /<img\b/i.test(content),
    youtube: /data-youtube-video/i.test(content),
  }
  return modules.filter((module) => !delivered[module])
}

export interface ArticleGenerationOptions {
  language?: Language
  format: ArticleGenerationFormat
  allowGeneratedImages?: boolean
  useKnowledge?: boolean
  modules: ArticleGenerationModule[]
  research: {
    enabled: boolean
    depth: ResearchDepth
    fallbackWithoutResearch: boolean
  }
}

export const defaultArticleGenerationOptions = (): ArticleGenerationOptions => ({
  format: 'news',
  allowGeneratedImages: true,
  useKnowledge: true,
  modules: ['answer', 'takeaways'],
  research: {
    enabled: true,
    depth: 'standard',
    fallbackWithoutResearch: true,
  },
})
