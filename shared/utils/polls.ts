/** A poll option as it travels through the editor, HTML and render layers. */
export type PollOptionData = { id?: string; label: string }

/** A quiz option: a poll option, of which exactly one carries `correct: true`. */
export type QuizOptionData = PollOptionData & { correct?: boolean }

export const QUIZ_MIN_OPTIONS = 2
export const QUIZ_MAX_OPTIONS = 5

const DEFAULT_LABEL = 'A1'

const readOption = (o: unknown): PollOptionData | null => {
  if (typeof o === 'string') return { label: o }
  if (o && typeof (o as any).label === 'string') {
    const id = (o as any).id
    return { id: typeof id === 'string' && id ? id : undefined, label: (o as any).label }
  }
  return null
}

const hasLabel = (o: PollOptionData | null): o is PollOptionData => !!o && o.label.trim().length > 0

/**
 * Coerces whatever sits in a poll block's `data-options` into a clean
 * `{ id?, label }[]`. Tolerates the legacy shape (array of plain string labels)
 * and drops empty/invalid entries. Never returns an empty array.
 */
export const normalizePollOptions = (raw: unknown): PollOptionData[] => {
  const opts = (Array.isArray(raw) ? raw : []).map(readOption).filter(hasLabel)
  return opts.length ? opts : [{ label: DEFAULT_LABEL }]
}

/**
 * `normalizePollOptions` plus the `correct` flag, kept on the first flagged option only. Read per entry
 * before dropping invalid ones, so the flag stays on the option it was written on.
 */
export const normalizeQuizOptions = (raw: unknown): QuizOptionData[] => {
  let flagged = false
  const opts = (Array.isArray(raw) ? raw : []).flatMap((o): QuizOptionData[] => {
    const opt = readOption(o)
    if (!hasLabel(opt)) return []
    if (flagged || (o as any)?.correct !== true) return [opt]
    flagged = true
    return [{ ...opt, correct: true }]
  })
  return opts.length ? opts : [{ label: DEFAULT_LABEL }]
}

/**
 * Serializes parsed `data-options` back into the attribute. The editor rewrites it on every
 * keystroke, so this has to carry the server-assigned ids through untouched — a vote keys off
 * them — and be idempotent, or each pass would dirty the document again.
 */
export const pollOptionsAttr = (raw: unknown, fallbackLabel: string): string =>
  JSON.stringify(Array.isArray(raw) && raw.length ? normalizePollOptions(raw) : [{ label: fallbackLabel }])

/** `pollOptionsAttr` for a quiz: the same contract, and the `correct` flag survives too. */
export const quizOptionsAttr = (raw: unknown, fallbackLabel: string): string =>
  JSON.stringify(Array.isArray(raw) && raw.length ? normalizeQuizOptions(raw) : [{ label: fallbackLabel }])
