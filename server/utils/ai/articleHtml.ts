import type { AnyNode, Element, ParentNode } from 'domhandler'

import { load } from 'cheerio'

const INLINE = new Set([
  'a',
  'abbr',
  'b',
  'br',
  'cite',
  'code',
  'em',
  'i',
  'mark',
  'q',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
])
const BLOCKS = ['p', 'li', 'ul', 'ol', 'h2', 'h3', 'h4', 'blockquote', 'table', 'figure']
// Slot markers sit bare between blocks by design; wrapped in a paragraph, the figure that fills one would nest in it.
const SLOTS_ONLY = /^(?:\s*\[\[\s*[A-Z]+\s*\d+\s*\]\])+\s*$/
const loose = (node: AnyNode) =>
  (node.type === 'text' && node.data.trim() !== '' && !SLOTS_ONLY.test(node.data)) ||
  (node.type === 'tag' && INLINE.has(node.name))
const blank = (node: AnyNode) => node.type === 'text' && node.data.trim() === ''
const words = (text: string) => text.replace(/\s+/g, ' ').trim()
/** Length of the longest whole-sentence lead of `lead` that `previous` already ends with; abbreviations cannot split it. */
const repeatedLead = (previous: string, lead: string) => {
  let cut = 0
  for (const match of lead.matchAll(/[.!?…](?=\s|$)/g)) {
    const end = match.index + 1
    if (end >= 20 && words(previous).endsWith(words(lead.slice(0, end)))) cut = end
  }
  return cut
}

/** Opening and closing tags of a block element differ in number: the parser closes them on serialization. */
const unbalanced = (html: string) =>
  BLOCKS.some(
    (tag) =>
      (html.match(new RegExp(`<${tag}[\\s>]`, 'gi'))?.length ?? 0) !==
      (html.match(new RegExp(`</${tag}>`, 'gi'))?.length ?? 0),
  )

/**
 * Repairs what an edit list leaves behind when it inserts outside a block: loose text at the top level or inside
 * a list, an unclosed tag, a paragraph repeated in full, or an insertion that starts by repeating the sentence it
 * follows. Content without these defects is returned unchanged, byte for byte.
 */
export const repairArticleHtml = (html: string) => {
  const $ = load(html, null, false)
  let changed = unbalanced(html)

  const wrap = (parent: ParentNode, tag: 'p' | 'li', inside: (node: AnyNode) => boolean = loose) => {
    let run: AnyNode[] = []
    const flush = () => {
      while (run.length && blank(run.at(-1)!)) run.pop()
      if (run.length) {
        // `before` skips text nodes; `replaceWith` does not.
        const inner = run.map((node) => $.html(node)).join('')
        const block = `<${tag}>${inner.trimEnd()}</${tag}>${inner.slice(inner.trimEnd().length)}`
        $(run.slice(1)).remove()
        $(run[0]!).replaceWith(block)
        changed = true
      }
      run = []
    }
    for (const node of [...parent.children]) {
      if (inside(node) || (run.length && blank(node))) run.push(node)
      else flush()
    }
    flush()
  }
  wrap($.root()[0]!, 'p')
  $('ul, ol').each((_, list) => wrap(list, 'li', (node) => loose(node) || (node.type === 'tag' && node.name === 'p')))

  // A revision that re-adds a paragraph means to replace it: its version takes the earlier place.
  const seen = new Map<string, Element>()
  $.root()
    .children('p, blockquote')
    .each((_, element) => {
      const key = words($(element).text()).toLowerCase()
      if (key.length < 40) return
      const first = seen.get(key)
      if (!first) return void seen.set(key, element)
      $(first).html($(element).html() ?? '')
      $(element).remove()
      changed = true
    })

  $.root()
    .children('p')
    .each((_, element) => {
      const previous = $(element).prev()
      if (!previous.is('p')) return
      const lead = ($(element).html() ?? '').trimStart()
      const cut = repeatedLead(previous.text(), lead)
      if (!cut) return
      const rest = lead.slice(cut).trimStart()
      if (rest) $(element).html(rest)
      else $(element).remove()
      changed = true
    })

  return changed ? $.html() : html
}
