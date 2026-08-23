import { ARTICLE_TABLE_CLASS } from './articleProse'
import { normalizePollOptions, type PollOptionData } from './polls'

export type ArticleBlock =
  { type: 'html'; html: string } | { type: 'poll'; pollId: string; question: string; options: PollOptionData[] }

export type ArticleHeading = { id: string; text: string; level: number }

/** Adapter shape: cheerio on the server, DOMParser in the editor, one set of shaping rules. */
export type ArticleNode = {
  /** Uppercase tag name, empty for text and comment nodes. */
  tag: string
  outerHtml: string
  text: string
  attr: (name: string) => string | null
}

const HEADING_TAG = /^H([1-6])$/
const HEADING_OPEN = /^<(h[1-6])([^>]*)>/i
const DIACRITICS = /[\u0300-\u036f]/g

/** NFKD first: stripping straight to `[a-z0-9]` turns "Přehled trhu" into `p-ehled-trhu`. */
export const headingSlug = (text: string) =>
  text
    .slice(0, 50)
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const uniqueHeadingId = (text: string, index: number, seen: Set<string>) => {
  const base = headingSlug(text) || `section-${index + 1}`
  let id = base
  for (let n = 2; seen.has(id); n++) id = `${base}-${n}`
  seen.add(id)
  return id
}

/** Only ever called with a slug, so the value needs no escaping. An author-set id is left alone. */
const withId = (outerHtml: string, id: string) => {
  const open = outerHtml.match(HEADING_OPEN)
  if (!open) return outerHtml
  if (/\sid\s*=/i.test(open[2] ?? '')) return outerHtml
  return `<${open[1]}${open[2]} id="${id}">${outerHtml.slice(open[0].length)}`
}

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const readPoll = (node: ArticleNode): ArticleBlock | null => {
  // No server-assigned id means the vote endpoint has no FK target; caller falls back to raw HTML.
  const pollId = node.attr('data-poll-id')
  if (!pollId) return null

  let options: PollOptionData[]
  try {
    options = normalizePollOptions(JSON.parse(node.attr('data-options') || '[]'))
  } catch {
    options = []
  }

  return { type: 'poll', pollId, question: node.attr('data-question') || '', options }
}

/**
 * Body into `v-html` runs plus poll blocks, with anchor ids stamped on headings. Adjacent HTML
 * nodes merge into one run — a wrapper per node breaks the adjacent-sibling rules `prose` uses.
 */
export const buildArticleBlocks = (nodes: ArticleNode[]) => {
  const blocks: ArticleBlock[] = []
  const headings: ArticleHeading[] = []
  const seenIds = new Set<string>()
  let run = ''

  const flush = () => {
    if (run) blocks.push({ type: 'html', html: run })
    run = ''
  }

  for (const node of nodes) {
    if (!node.tag) {
      const text = node.text.trim()
      if (text) run += escapeText(text)
      continue
    }

    if (node.tag === 'DIV' && node.attr('data-type') === 'poll') {
      const poll = readPoll(node)
      if (poll) {
        flush()
        blocks.push(poll)
        continue
      }
      run += node.outerHtml
      continue
    }

    if (node.tag === 'TABLE') {
      run += `<div class="${ARTICLE_TABLE_CLASS}">${node.outerHtml}</div>`
      continue
    }

    const heading = node.tag.match(HEADING_TAG)
    if (heading) {
      const text = node.text.trim()
      const id = node.attr('id') || uniqueHeadingId(text, headings.length, seenIds)
      seenIds.add(id)
      headings.push({ id, text, level: Number(heading[1]) })
      run += withId(node.outerHtml, id)
      continue
    }

    run += node.outerHtml
  }

  flush()
  return { blocks, headings }
}

/** Plain text of the body, for descriptions and the markdown/LLM surfaces. */
export const articleText = (blocks: ArticleBlock[]) =>
  blocks
    .map((block) => (block.type === 'html' ? block.html : block.question))
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
