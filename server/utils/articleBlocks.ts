import * as cheerio from 'cheerio'
import { buildArticleBlocks, headingSlug, type ArticleNode } from '~~/shared/utils/articleBlocks'

/**
 * Stamps anchor ids on save. `buildArticleBlocks` also does this at render for bodies written
 * before this ran, but only a stored id is stable across edits — both use `headingSlug`.
 */
export const stampHeadingIds = (content: string | null | undefined) => {
  if (!content) return content ?? ''

  const $ = cheerio.load(content, null, false)
  const seen = new Set<string>()

  $('h1, h2, h3, h4, h5, h6').each((index, el) => {
    const base = headingSlug($(el).text().trim()) || `section-${index + 1}`
    let id = base
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`
    seen.add(id)
    $(el).attr('id', id)
  })

  return $.html()
}

/** Runs on every article read so the body is in the SSR HTML for crawlers without JavaScript. */
export const articleBlocks = (content: string | null | undefined) => {
  if (!content) return { blocks: [], headings: [] }

  // Fragment mode — a document wrapper would put html/body between us and the top-level nodes.
  const $ = cheerio.load(content, null, false)

  const nodes: ArticleNode[] = $.root()
    .contents()
    .toArray()
    .map((node): ArticleNode => {
      if (node.type === 'tag') {
        return {
          tag: node.tagName.toUpperCase(),
          outerHtml: $.html(node),
          text: $(node).text(),
          attr: (name) => node.attribs?.[name] ?? null,
        }
      }
      return {
        tag: '',
        outerHtml: '',
        text: node.type === 'text' ? ((node as { data?: string }).data ?? '') : '',
        attr: () => null,
      }
    })

  return buildArticleBlocks(nodes)
}
