import type {
  ArticleGenerationOptions,
  ArticleGenerationBilling,
  GenerationEvent,
  GenerationFailureStage,
  GenerationResearchResult,
} from '~~/shared/utils/articleGeneration'

interface PartialArticle {
  title?: string
  perex?: string
  content?: string
  sources?: string[]
}

/** Carries the server's failure stage and whether the held article went back to the wallet. */
export class GenerationStreamError extends Error {
  constructor(
    message: string,
    readonly stage?: GenerationFailureStage,
    readonly creditReturned?: boolean,
  ) {
    super(message)
  }
}

interface StreamHandlers {
  /** Every progress event, in order; feed it to `reduceGenerationRun`. */
  onEvent?: (event: GenerationEvent) => void
  onSession?: (id: string) => void
  onPartial?: (partial: PartialArticle) => void
  onResearch?: (result: GenerationResearchResult) => void
  onReservation?: (articles: number) => void
  onImage?: (image: { slot: number; html: string }) => void
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
    articleId?: string,
  ): Promise<'completed' | 'aborted'> => {
    controller = new AbortController()
    generating.value = true

    try {
      const requestKey = crypto.randomUUID()
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
        body: JSON.stringify({ prompt, options, articleId }),
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

      const dispatch: Record<string, (msg: any) => void> = {
        reservation: (msg) => handlers.onReservation?.(msg.articles),
        research: (msg) => handlers.onResearch?.(msg),
        image: (msg) => handlers.onImage?.({ slot: msg.slot, html: msg.html }),
        billing: (msg) => handlers.onBilling?.(msg),
        final: (msg) => handlers.onFinal(msg.article),
      }
      const progress = new Set(['reservation', 'phase', 'research', 'activity', 'media', 'review', 'final', 'billing'])

      const consume = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        const msg = JSON.parse(trimmed)

        if (msg.type === 'partial') {
          const now = Date.now()
          if (now - lastPartialAt >= PARTIAL_THROTTLE_MS) {
            handlers.onEvent?.({ type: 'activity', writingStage: msg.writingStage })
            handlers.onPartial?.(msg.object ?? {})
            lastPartialAt = now
            pendingPartial = null
          } else {
            pendingPartial = msg.object ?? {}
          }
          return
        }

        flushPartial()
        if (msg.type === 'error') throw new GenerationStreamError(msg.message, msg.stage, msg.creditReturned)
        if (msg.type === 'session') return handlers.onSession?.(msg.id)
        if (msg.type === 'final') receivedFinal = true
        dispatch[msg.type]?.(msg)
        if (progress.has(msg.type)) handlers.onEvent?.(msg)
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
