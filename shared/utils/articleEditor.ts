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

/**
 * Mirrors `Article`'s ZenStack rule (`admin && clientSiteId == auth().clientSiteId`) — authorship
 * is deliberately not part of it, so a tenant's admins can edit each other's articles and the
 * AI author's articles, which no human owns. A stricter client gate only hides a button the
 * server would have accepted. Superadmin is excluded because the policy excludes it too.
 */
export const canManageArticle = (
  user: { role?: string | null; clientSiteId?: string | null } | null | undefined,
  article: { clientSiteId?: string | null } | null | undefined,
) => !!user && user.role === 'admin' && !!user.clientSiteId && user.clientSiteId === article?.clientSiteId

/**
 * Nothing written yet. TipTap normalises an emptied body to `<p></p>` rather than `''`, so both
 * spellings have to count as empty — which is why this lives in one place instead of being
 * re-typed wherever the editor asks the question.
 */
export const isBlankArticle = (article: { title?: string | null; content?: string | null }) =>
  !article.title && (!article.content || article.content === '<p></p>')

/**
 * Bounded summary of the selected tags. The strip has to state what is on the article without
 * being opened, but an unbounded list of names is what pushed the body around in the first place.
 * Empty in, empty out — the caller substitutes its own placeholder.
 */
export const tagTriggerLabel = (names: string[], namesShown = 2) => {
  if (names.length <= namesShown) return names.join(', ')

  return `${names.slice(0, namesShown).join(', ')} +${names.length - namesShown}`
}

/** Cyclic list movement. Double-modulo because JS `%` keeps the sign of the dividend. */
export const wrapIndex = (current: number, delta: number, count: number) => {
  if (count <= 0) return 0

  return (((current + delta) % count) + count) % count
}

export type PublishAction = 'saveChanges' | 'schedule' | 'createAndPublish' | 'publishNow'

/**
 * What the primary editor button actually does, as an `articles.*` key. A future `releaseAt`
 * makes it queue rather than publish, which the button used to hide behind "Publikovat".
 */
export const publishAction = (
  article: { status?: string | null; releaseAt?: string | Date | null },
  isNew: boolean,
  now: Date = new Date(),
): PublishAction => {
  if (article.status === 'published') return 'saveChanges'
  if (article.releaseAt && new Date(article.releaseAt).getTime() > now.getTime()) return 'schedule'

  return isNew ? 'createAndPublish' : 'publishNow'
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
