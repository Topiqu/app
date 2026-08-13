import type { AnyNode, Element } from 'domhandler'

import * as cheerio from 'cheerio'

/** Escapes only what would otherwise start markup mid-sentence. */
const esc = (text: string) => text.replace(/([\\`*_[\]])/g, '\\$1').replace(/\s+/g, ' ')

const inline = ($: cheerio.CheerioAPI, nodes: AnyNode[]): string =>
  nodes
    .map((node) => {
      if (node.type === 'text') return esc((node as { data?: string }).data ?? '')
      if (node.type !== 'tag') return ''

      const el = node as Element
      const children = () => inline($, el.children)

      switch (el.tagName) {
        case 'strong':
        case 'b':
          return `**${children()}**`
        case 'em':
        case 'i':
          return `*${children()}*`
        case 'code':
          return `\`${$(el).text()}\``
        case 'a':
          return el.attribs.href ? `[${children()}](${el.attribs.href})` : children()
        case 'img':
          return el.attribs.src ? `![${el.attribs.alt ?? ''}](${el.attribs.src})` : ''
        case 'br':
          return '\n'
        default:
          return children()
      }
    })
    .join('')

const listItems = ($: cheerio.CheerioAPI, el: Element, ordered: boolean, depth: number) =>
  $(el)
    .children('li')
    .toArray()
    .map((li, i) => {
      const marker = ordered ? `${i + 1}.` : '-'
      const nested = $(li).children('ul, ol').toArray()
      const own = inline(
        $,
        li.children.filter((child) => !(child.type === 'tag' && ['ul', 'ol'].includes((child as Element).tagName))),
      ).trim()
      const lines = [`${'  '.repeat(depth)}${marker} ${own}`]
      for (const child of nested)
        lines.push(listItems($, child as Element, (child as Element).tagName === 'ol', depth + 1))
      return lines.join('\n')
    })
    .join('\n')

const table = ($: cheerio.CheerioAPI, el: Element) => {
  const rows = $(el)
    .find('tr')
    .toArray()
    .map((tr) =>
      $(tr)
        .children('th, td')
        .toArray()
        .map((cell) => inline($, (cell as Element).children).trim()),
    )
  if (!rows.length) return ''

  const [head, ...body] = rows
  return [
    `| ${head!.join(' | ')} |`,
    `| ${head!.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

const block = ($: cheerio.CheerioAPI, node: AnyNode): string => {
  if (node.type === 'text') return esc((node as { data?: string }).data ?? '').trim()
  if (node.type !== 'tag') return ''

  const el = node as Element
  const heading = el.tagName.match(/^h([1-6])$/)
  if (heading) return `${'#'.repeat(Number(heading[1]))} ${inline($, el.children).trim()}`

  switch (el.tagName) {
    case 'p':
      return inline($, el.children).trim()
    case 'ul':
    case 'ol':
      return listItems($, el, el.tagName === 'ol', 0)
    case 'blockquote':
      return $(el)
        .text()
        .trim()
        .split('\n')
        .map((line) => `> ${line.trim()}`)
        .join('\n')
    case 'pre':
      return `\`\`\`\n${$(el).text().trim()}\n\`\`\``
    case 'table':
      return table($, el)
    case 'hr':
      return '---'
    case 'div':
      // Poll blocks carry their question and options in attributes, not in the markup.
      if (el.attribs['data-type'] === 'poll') {
        const question = el.attribs['data-question'] ?? ''
        let options: { label?: string }[] = []
        try {
          options = JSON.parse(el.attribs['data-options'] ?? '[]')
        } catch {
          options = []
        }
        return [`**${question}**`, ...options.map((option) => `- ${option?.label ?? ''}`)].filter(Boolean).join('\n')
      }
      return el.children
        .map((child) => block($, child))
        .filter(Boolean)
        .join('\n\n')
    default:
      return inline($, el.children).trim()
  }
}

/** Stored body as markdown, for the `.md` variants and `llms.txt`. */
export const contentToMarkdown = (content: string | null | undefined) => {
  if (!content) return ''
  const $ = cheerio.load(content, null, false)
  return $.root()
    .contents()
    .toArray()
    .map((node) => block($, node))
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
