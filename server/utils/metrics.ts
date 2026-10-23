import { Parser } from 'htmlparser2'

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])
const HIDDEN_TAGS = new Set(['head', 'script', 'style', 'template', 'noscript'])

/** Stored bodies are HTML. Inline marks must not split a word; blocks must not join words. */
export const articleTextMetrics = (content: string) => {
  const text: string[] = []
  let hiddenDepth = 0
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (hiddenDepth || HIDDEN_TAGS.has(name)) {
          hiddenDepth++
          return
        }
        if (BLOCK_TAGS.has(name)) text.push(' ')
        if (attributes['data-type'] === 'poll' && attributes['data-poll-id']) {
          text.push(attributes['data-question'] ?? '', ' ')
          try {
            const options: unknown = JSON.parse(attributes['data-options'] ?? '[]')
            for (const option of normalizePollOptions(options)) text.push(option.label, ' ')
          } catch {
            /* Malformed poll metadata does not contribute readable options. */
          }
          hiddenDepth++
        }
      },
      ontext(value) {
        if (!hiddenDepth) text.push(value)
      },
      onclosetag(name) {
        if (hiddenDepth) hiddenDepth--
        else if (BLOCK_TAGS.has(name)) text.push(' ')
      },
    },
    { decodeEntities: true },
  )
  parser.end(content)
  const words = text.join('').trim().split(/\s+/).filter(Boolean).length
  return { totalWords: words, readingTime: Math.ceil(words / 200) }
}

export const calculateArticleMetrics = (content: string, hourlyRateUsd: number, wordsPerHour: number) => {
  const metrics = articleTextMetrics(content)
  const savings = writingSavings(metrics.totalWords, hourlyRateUsd, wordsPerHour)

  return {
    ...metrics,
    savedTimeMinutes: savings.minutes,
    savedAmount: savings.amountUsd,
  }
}
