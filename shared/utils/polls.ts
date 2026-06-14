/** A poll option as it travels through the editor, HTML and render layers. */
export type PollOptionData = { id?: string; label: string }

const DEFAULT_LABEL = 'A1'

/**
 * Coerces whatever sits in a poll block's `data-options` into a clean
 * `{ id?, label }[]`. Tolerates the legacy shape (array of plain string labels)
 * and drops empty/invalid entries. Never returns an empty array.
 */
export const normalizePollOptions = (raw: unknown): PollOptionData[] => {
  const arr = Array.isArray(raw) ? raw : []
  const opts = arr
    .map((o): PollOptionData | null => {
      if (typeof o === 'string') return { label: o }
      if (o && typeof (o as any).label === 'string') {
        const id = (o as any).id
        return { id: typeof id === 'string' && id ? id : undefined, label: (o as any).label }
      }
      return null
    })
    .filter((o): o is PollOptionData => !!o && o.label.trim().length > 0)
  return opts.length ? opts : [{ label: DEFAULT_LABEL }]
}
