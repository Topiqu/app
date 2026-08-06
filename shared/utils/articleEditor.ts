export const AI_FORMATS = ['howto', 'news', 'listicle', 'opinion', 'deepDive'] as const

export type AiFormat = (typeof AI_FORMATS)[number]

export const composeAiPrompt = (topic: string, formatTemplate?: string | null) => {
  const trimmedTopic = topic.trim()
  const trimmedTemplate = formatTemplate?.trim()

  if (!trimmedTemplate) return trimmedTopic
  if (!trimmedTopic) return trimmedTemplate

  return `${trimmedTemplate} ${trimmedTopic}`
}

export const countHtmlWords = (html?: string | null) => {
  if (!html) return 0

  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#?[a-z0-9]+;/gi, ' ')

  return text.split(/\s+/).filter(Boolean).length
}

export const formatElapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export const toDateTimeLocal = (value?: string | Date | null) => {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 16)

  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export type ReleaseQuick = 'now' | 'inHour' | 'tomorrow' | 'clear'

export const releaseQuickValue = (kind: ReleaseQuick, from: Date = new Date()) => {
  if (kind === 'clear') return null

  const date = new Date(from)
  if (kind === 'inHour') date.setHours(date.getHours() + 1)
  if (kind === 'tomorrow') {
    date.setDate(date.getDate() + 1)
    date.setHours(8, 0, 0, 0)
  }
  date.setSeconds(0, 0)

  return toDateTimeLocal(date)
}
