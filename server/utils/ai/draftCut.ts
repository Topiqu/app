import * as cheerio from 'cheerio'
import { writtenHeadings } from '~~/shared/utils/articleGeneration'

const HEADING = /^h[2-4]$/i

/**
 * A stream stopped mid-body leaves its last block unfinished, so that block goes, and so does any
 * heading left with nothing under it.
 */
export const cutUnfinished = (html: string) => {
  const $ = cheerio.load(html, null, false)
  const nodes = $.root()
    .contents()
    .toArray()
    .filter((node) => node.type !== 'text' || $(node).text().trim())
  nodes.pop()
  for (let last = nodes.at(-1); last?.type === 'tag' && HEADING.test(last.name); last = nodes.at(-1)) nodes.pop()
  return nodes.map((node) => $.html(node)).join('')
}

/** The highest number of each slot kind the body uses, so the fields written after it can match them. */
export const slotCounts = (html: string) => {
  const counts = { IMAGE: 0, POLL: 0, VIDEO: 0, XPOST: 0 }
  for (const [, kind, number] of html.matchAll(/\[\[(IMAGE|POLL|VIDEO|XPOST)(\d+)\]\]/g))
    counts[kind as keyof typeof counts] = Math.max(counts[kind as keyof typeof counts], Number(number))
  return counts
}

const TAIL_KEYS = [
  'answer',
  'keyTakeaways',
  'faq',
  'coverImage',
  'images',
  'polls',
  'videos',
  'xPosts',
  'tags',
  'sources',
] as const

/** What a stopped writer left that is worth finishing: two sections and the schema's minimum, or `null`. */
export const salvageBody = (
  partial: { title?: unknown; perex?: unknown; content?: unknown } & Record<string, unknown>,
) => {
  if (typeof partial.title !== 'string' || typeof partial.content !== 'string') return null
  // Once a later field has started, the body string is complete and keeps its last block.
  const bodyDone = TAIL_KEYS.some((key) => partial[key] !== undefined)
  const content = bodyDone ? partial.content : cutUnfinished(partial.content)
  if (writtenHeadings(content).length < 2 || content.length < 500) return null
  return { title: partial.title, perex: typeof partial.perex === 'string' ? partial.perex : '', content }
}
