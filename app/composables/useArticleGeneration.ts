import type {
  ArticleGenerationOptions,
  ArticleGenerationBilling,
  ArticleMediaProgress,
  ResearchDepth,
} from '~~/shared/utils/articleGeneration'

interface PartialArticle {
  title?: string
  perex?: string
  content?: string
  sources?: string[]
}

export type GenerationPhase = 'research' | 'writing' | 'images'
export type GenerationWritingStage = 'starting' | 'title' | 'intro' | 'body' | 'review'

export interface GenerationResearchResult {
  status: 'completed' | 'fallback' | 'skipped'
  sourceCount: number
  depth: ResearchDepth
  knowledgeSourceCount?: number
  knowledgeSources?: { id: string; title: string }[]
  sources: string[]
}

interface StreamHandlers {
  onSession?: (id: string) => void
  onPartial?: (partial: PartialArticle) => void
  onPhase?: (phase: GenerationPhase) => void
  onResearch?: (result: GenerationResearchResult) => void
  onWritingStage?: (stage: GenerationWritingStage) => void
  onAttempt?: (attemptId: string) => void
  onReservation?: (articles: number) => void
  onActivity?: () => void
  onImage?: (image: { slot: number; html: string }) => void
  onMedia?: (progress: ArticleMediaProgress) => void
  onReview?: (review: { approved: boolean; revised: boolean }) => void
  onBilling?: (billing: ArticleGenerationBilling) => void
  onFinal: (article: Record<string, any>) => void
}

const PARTIAL_THROTTLE_MS = 60

export const useArticleGeneration = () => {
  const generating = shallowRef(false)
  let controller: AbortController | null = null

  const stop = () => controller?.abort()

  const streamGenerate = async (
    prompt: string,
    options: ArticleGenerationOptions,
    handlers: StreamHandlers,
  ): Promise<'completed' | 'aborted'> => {
    controller = new AbortController()
    generating.value = true

    try {
      const requestKey = crypto.randomUUID()
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
        body: JSON.stringify({ prompt, options }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const message = await res.json().catch(() => null)
        throw new Error(message?.message || `Generation failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      let lastPartialAt = 0
      let receivedFinal = false
      let pendingPartial: PartialArticle | null = null
      const flushPartial = () => {
        if (!pendingPartial) return
        handlers.onPartial?.(pendingPartial)
        pendingPartial = null
        lastPartialAt = Date.now()
      }

      const dispatch = {
        reservation: (msg: any) => handlers.onReservation?.(msg.articles),
        phase: (msg: any) => {
          handlers.onPhase?.(msg.phase)
          if (msg.attemptId) handlers.onAttempt?.(msg.attemptId)
        },
        research: (msg: any) => handlers.onResearch?.(msg),
        activity: (msg: any) => msg.writingStage && handlers.onWritingStage?.(msg.writingStage),
        image: (msg: any) => handlers.onImage?.({ slot: msg.slot, html: msg.html }),
        media: (msg: any) => handlers.onMedia?.(msg),
        review: (msg: any) => handlers.onReview?.(msg.review),
        billing: (msg: any) => handlers.onBilling?.(msg),
        final: (msg: any) => handlers.onFinal(msg.article),
      }

      const consume = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        const msg = JSON.parse(trimmed)

        if (msg.type === 'partial') {
          if (msg.writingStage) handlers.onWritingStage?.(msg.writingStage)
          const now = Date.now()
          if (now - lastPartialAt >= PARTIAL_THROTTLE_MS) {
            handlers.onPartial?.(msg.object ?? {})
            handlers.onActivity?.()
            lastPartialAt = now
            pendingPartial = null
          } else {
            pendingPartial = msg.object ?? {}
          }
          return
        }

        flushPartial()
        if (msg.type === 'error') throw new Error(msg.message)
        if (msg.type === 'session') return handlers.onSession?.(msg.id)
        const handle = dispatch[msg.type as keyof typeof dispatch]
        if (!handle) return
        if (msg.type === 'final') receivedFinal = true
        handle(msg)
        handlers.onActivity?.()
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) consume(line)
      }
      if (buffer.trim()) consume(buffer)
      flushPartial()

      if (!receivedFinal) throw new Error('Generation stream ended before the article was completed.')

      return 'completed'
    } catch (error) {
      if (controller?.signal.aborted) return 'aborted'
      throw error
    } finally {
      generating.value = false
      controller = null
    }
  }

  return { streamGenerate, stop, generating }
}
