import type { ArticleGenerationOptions, ResearchDepth } from '~~/shared/utils/articleGeneration'

interface PartialArticle {
  title?: string
  perex?: string
  content?: string
}

export type GenerationPhase = 'research' | 'writing' | 'images'

export interface GenerationResearchResult {
  status: 'completed' | 'fallback' | 'skipped'
  sourceCount: number
  depth: ResearchDepth
}

interface StreamHandlers {
  onPartial?: (partial: PartialArticle) => void
  onPhase?: (phase: GenerationPhase) => void
  onResearch?: (result: GenerationResearchResult) => void
  onAttempt?: (attemptId: string) => void
  onActivity?: () => void
  onImage?: (image: { slot: number; html: string }) => void
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
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const consume = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        const msg = JSON.parse(trimmed)

        if (msg.type === 'partial') {
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
        if (msg.type === 'phase') {
          handlers.onPhase?.(msg.phase)
          handlers.onActivity?.()
          if (msg.attemptId) handlers.onAttempt?.(msg.attemptId)
        } else if (msg.type === 'research') {
          handlers.onResearch?.(msg)
          handlers.onActivity?.()
        } else if (msg.type === 'image') handlers.onImage?.({ slot: msg.slot, html: msg.html })
        else if (msg.type === 'final') {
          receivedFinal = true
          handlers.onFinal(msg.article)
          handlers.onActivity?.()
        } else if (msg.type === 'error') throw new Error(msg.message)
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
