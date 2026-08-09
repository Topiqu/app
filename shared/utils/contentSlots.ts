export type SlotKind = 'IMAGE' | 'POLL'

export type ContentSlot = { slot: number; html: string }

const slotPattern = (kind: SlotKind, slot?: number) =>
  new RegExp(`\\[\\[\\s*${kind}\\s*(${slot ?? '\\d+'})\\s*\\]\\]`, 'gi')

export const replaceSlot = (content: string, kind: SlotKind, slot: number, html: string) =>
  content.replace(slotPattern(kind, slot), html)

export const applyContentSlots = (content: string, kind: SlotKind, slots: ContentSlot[]) => {
  const bySlot = new Map(slots.map((entry) => [entry.slot, entry.html]))
  const used = new Set<number>()

  const replaced = content.replace(slotPattern(kind), (_marker, digits: string) => {
    const slot = Number(digits)
    const html = bySlot.get(slot)
    if (html === undefined) return ''
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
  applyContentSlots(applyContentSlots(content, 'IMAGE', []), 'POLL', [])
