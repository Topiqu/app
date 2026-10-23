import type { JSONContent } from '@tiptap/vue-3'

export function announcementDocument(text: string, runs?: AnnouncementTextRun[] | null): JSONContent {
  const content: JSONContent[] = []
  for (const run of runs ?? [{ text, bold: false, italic: false, url: null }]) {
    const marks = [
      ...(run.bold ? [{ type: 'bold' }] : []),
      ...(run.italic ? [{ type: 'italic' }] : []),
      ...(run.url ? [{ type: 'link', attrs: { href: run.url } }] : []),
    ]
    run.text.split('\n').forEach((part, index) => {
      if (index) content.push({ type: 'hardBreak' })
      if (part) content.push({ type: 'text', text: part, marks })
    })
  }
  return { type: 'doc', content: [{ type: 'paragraph', content }] }
}

export function announcementRuns(doc: JSONContent): AnnouncementTextRun[] {
  const runs: AnnouncementTextRun[] = []
  const append = (text: string, marks: JSONContent['marks'] = []) => {
    if (!text) return
    const href = marks.find((mark) => mark.type === 'link')?.attrs?.href
    const run = {
      text,
      bold: marks.some((mark) => mark.type === 'bold'),
      italic: marks.some((mark) => mark.type === 'italic'),
      url: typeof href === 'string' && isSafeWidgetLink(href) ? href : null,
    }
    const previous = runs.at(-1)
    if (previous && previous.bold === run.bold && previous.italic === run.italic && previous.url === run.url)
      previous.text += text
    else runs.push(run)
  }
  for (const [index, paragraph] of (doc.content ?? []).entries()) {
    if (index) append('\n')
    for (const node of paragraph.content ?? []) {
      if (node.type === 'hardBreak') append('\n')
      if (node.type === 'text') append(node.text ?? '', node.marks)
    }
  }
  return runs
}
