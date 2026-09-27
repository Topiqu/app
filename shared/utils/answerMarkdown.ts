export type AnswerInline = { text: string; bold?: boolean; href?: string }
export type AnswerBlock =
  | { type: 'heading'; inline: AnswerInline[] }
  | { type: 'paragraph'; inline: AnswerInline[] }
  | { type: 'list'; ordered: boolean; items: AnswerInline[][] }
  | { type: 'rule' }

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g
const BOLD_RE = /\*\*([^*]+)\*\*/g
const LIST_RE = /^\s*(?:([-*+])|\d+[.)])\s+(.*)$/

// Only http(s) survives: the answer is third-party model output rendered in the dashboard.
const safeHref = (value: string) => {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return undefined
    for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key)
    return url.href
  } catch {
    return undefined
  }
}

const bold = (text: string): AnswerInline[] => {
  const out: AnswerInline[] = []
  let last = 0
  for (const match of text.matchAll(BOLD_RE)) {
    if (match.index > last) out.push({ text: text.slice(last, match.index) })
    out.push({ text: match[1]!, bold: true })
    last = match.index + match[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export const answerInline = (text: string): AnswerInline[] => {
  const out: AnswerInline[] = []
  let last = 0
  for (const match of text.matchAll(LINK_RE)) {
    out.push(...bold(text.slice(last, match.index)))
    const href = safeHref(match[2]!)
    out.push(href ? { text: match[1]!.replaceAll('**', ''), href } : { text: match[1]! })
    last = match.index + match[0].length
  }
  out.push(...bold(text.slice(last)))
  return out.filter((part) => part.text)
}

/** The subset AI search answers actually use: headings, lists, bold, links, rules. */
export const parseAnswerMarkdown = (source: string): AnswerBlock[] => {
  const blocks: AnswerBlock[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', inline: answerInline(paragraph.join(' ')) })
    paragraph = []
  }

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    const item = line.match(LIST_RE)
    if (!line) flush()
    else if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush()
      blocks.push({ type: 'rule' })
    } else if (heading) {
      flush()
      blocks.push({ type: 'heading', inline: answerInline(heading[1]!) })
    } else if (item) {
      flush()
      const ordered = !item[1]
      const previous = blocks.at(-1)
      if (previous?.type === 'list' && previous.ordered === ordered) previous.items.push(answerInline(item[2]!))
      else blocks.push({ type: 'list', ordered, items: [answerInline(item[2]!)] })
    } else paragraph.push(line)
  }
  flush()
  return blocks
}
