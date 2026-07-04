interface PartialArticle {
  title?: string
  perex?: string
  content?: string
}

interface StreamHandlers {
  onPartial?: (partial: PartialArticle) => void
  onFinal: (article: Record<string, any>) => void
}

export const useArticleGeneration = () => {
  const streamGenerate = async (prompt: string, handlers: StreamHandlers) => {
    const res = await fetch('/api/articles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    if (!res.ok || !res.body) {
      const message = await res.json().catch(() => null)
      throw new Error(message?.message || `Generation failed (${res.status})`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const consume = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      const msg = JSON.parse(trimmed)
      if (msg.type === 'partial') handlers.onPartial?.(msg.object ?? {})
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
  }

  return { streamGenerate }
}
