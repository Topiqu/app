export type SlotKind = 'IMAGE' | 'POLL' | 'VIDEO'

export type ContentSlot = { slot: number; html: string }

const slotPattern = (kind: SlotKind, slot?: number) =>
  new RegExp(`\\[\\[\\s*${kind}\\s*(${slot ?? '\\d+'})\\s*\\]\\]`, 'gi')

const anySlot = String.raw`\[\[\s*(?:IMAGE|POLL|VIDEO)\s*\d+\s*\]\]`
const slotInImg = new RegExp(String.raw`<img\b[^>]*?(${anySlot})[^>]*>`, 'gi')
const slotInFigure = new RegExp(
  String.raw`<figure\b[^>]*>(?:(?!</figure>)[\s\S])*?(${anySlot})(?:(?!</figure>)[\s\S])*?</figure>`,
  'gi',
)

/**
 * The writer sometimes wraps a marker in its own markup (`<img src="[[IMAGE1]]">`, a `<figure>` with
 * its caption). A filled slot brings its own figure, so the wrapper would nest it inside an attribute.
 */
export const unwrapContentSlots = (content: string) => content.replace(slotInImg, '$1').replace(slotInFigure, '$1')

/** Only slots carry real assets; an `<img>` the writer wrote itself points at a guessed or third-party URL. */
export const dropAuthoredImages = (content: string) =>
  unwrapContentSlots(content)
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<figure\b[^>]*>(?:(?!<\/figure>|<iframe|<table|\[\[)[\s\S])*<\/figure>/gi, '')

export const replaceSlot = (content: string, kind: SlotKind, slot: number, html: string) =>
  content.replace(slotPattern(kind, slot), html)

export const applyContentSlots = (content: string, kind: SlotKind, slots: ContentSlot[]) => {
  const bySlot = new Map(slots.map((entry) => [entry.slot, entry.html]))
  const used = new Set<number>()

  const replaced = unwrapContentSlots(content).replace(slotPattern(kind), (_marker, digits: string) => {
    const slot = Number(digits)
    const html = bySlot.get(slot)
    if (html === undefined || used.has(slot)) return ''
    used.add(slot)
    return html
  })

  const orphans = slots.filter((entry) => !used.has(entry.slot)).map((entry) => entry.html)

  return orphans.length ? `${replaced.trimEnd()}\n${orphans.join('\n')}` : replaced
}

/**
 * Every marker, with nothing left to fill it. Finalization is the only step that fills them, so
 * wherever it is skipped or fails the raw `[[IMAGE1]]` has to come out here rather than reach the
 * author's body as literal text.
 */
export const stripContentSlots = (content: string) =>
  applyContentSlots(applyContentSlots(applyContentSlots(content, 'IMAGE', []), 'POLL', []), 'VIDEO', [])
