interface PartialArticle {
  title?: string
  perex?: string
  content?: string
}

type GenerationPhase = 'writing' | 'images'

interface StreamHandlers {
  onPartial?: (partial: PartialArticle) => void
  onPhase?: (phase: GenerationPhase) => void
  onImage?: (image: { slot: number; html: string }) => void
  onFinal: (article: Record<string, any>) => void
}

const PARTIAL_THROTTLE_MS = 60

export const useArticleGeneration = () => {
  const generating = shallowRef(false)
  let controller: AbortController | null = null

  const stop = () => controller?.abort()

  const streamGenerate = async (prompt: string, handlers: StreamHandlers): Promise<'completed' | 'aborted'> => {
    controller = new AbortController()
    generating.value = true

    try {
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
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
            lastPartialAt = now
            pendingPartial = null
          } else {
            pendingPartial = msg.object ?? {}
          }
          return
        }

        flushPartial()
        if (msg.type === 'phase') handlers.onPhase?.(msg.phase)
        else if (msg.type === 'image') handlers.onImage?.({ slot: msg.slot, html: msg.html })
        else if (msg.type === 'final') handlers.onFinal(msg.article)
        else if (msg.type === 'error') throw new Error(msg.message)
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
