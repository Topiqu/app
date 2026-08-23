/**
 * What shape the article takes, decided before it is written. The writer prompt used to offer
 * every element at once behind "if the article would benefit" — read as a checklist, so every
 * piece came back with a table, a poll, an FAQ and a verdict section. A format instead decides
 * up front what the piece may contain, and the sections it may not are never mentioned to the
 * model at all.
 */
export type ArticleFormat = 'news' | 'analysis' | 'guide' | 'comparison' | 'opinion' | 'story'

type FormatSpec = {
  /** Handed to the writer verbatim as what it is producing. */
  shape: string
  words: [number, number]
  answer: boolean
  takeaways: boolean
  faq: boolean
  table: boolean
  poll: boolean
}

export const ARTICLE_FORMATS: Record<ArticleFormat, FormatSpec> = {
  news: {
    shape: 'A report on something that just happened. Lead with what changed and who it hits.',
    words: [350, 550],
    answer: true,
    takeaways: true,
    faq: false,
    table: false,
    poll: true,
  },
  analysis: {
    shape: 'Takes one claim, number or decision apart and shows what holds up.',
    words: [700, 1100],
    answer: true,
    takeaways: true,
    faq: false,
    table: true,
    poll: false,
  },
  guide: {
    shape: 'Procedural. The reader came to do the thing, not to read about it.',
    words: [700, 1100],
    answer: true,
    takeaways: true,
    faq: true,
    table: false,
    poll: false,
  },
  comparison: {
    shape: 'Two or more options side by side, with the case for each and who it suits.',
    words: [600, 900],
    answer: true,
    takeaways: true,
    faq: true,
    table: true,
    poll: true,
  },
  opinion: {
    shape: "An argument in the author's own voice. It takes a position and defends it.",
    words: [500, 800],
    answer: false,
    takeaways: false,
    faq: false,
    table: false,
    poll: true,
  },
  story: {
    shape: 'A narrative — one case, one person, one sequence of events, told in order.',
    words: [600, 900],
    answer: false,
    takeaways: false,
    faq: false,
    table: false,
    poll: false,
  },
}

export const ARTICLE_FORMAT_NAMES = Object.keys(ARTICLE_FORMATS) as ArticleFormat[]

export const isArticleFormat = (value: unknown): value is ArticleFormat =>
  typeof value === 'string' && value in ARTICLE_FORMATS

/** The catalogue as the topic picker sees it: one line per format, no element rules. */
export const formatMenu = () =>
  ARTICLE_FORMAT_NAMES.map((name) => `- ${name}: ${ARTICLE_FORMATS[name].shape}`).join('\n')

/**
 * Sentence-level tells, not structural ones — these survive any format and are what makes a
 * piece read as machine-written even when its shape is right.
 */
export const ANTI_FORMULA = `
Never do these. They are what makes writing read as machine-made:
- No closing summary, verdict or takeaway section. The article ends on its last substantive point — no heading named Verdict, Conclusion, Summary, Verdikt, Závěr or Shrnutí, and no final paragraph that restates the piece.
- Never use the contrast pair "It is not X, it is Y" / "not X, but Y" / "X, not Y". Once is already a tell; the pattern is unusable.
- Do not open with throat-clearing: no "Imagine…", "Let's look at…", "In this article we will…", "First, let's set some assumptions".
- No rhetorical question as a heading.
- Do not close a section with an aphorism that restates what the section just said.
- Vary it: sentence length, paragraph length, and the number of paragraphs per section must differ across the article.
- Write the specific noun. No "it", "this" or "that" standing in for the subject of a paragraph.
`.trim()

const formatElements = (spec: FormatSpec) => {
  const allowed: string[] = []
  const banned: string[] = []

  ;(spec.table ? allowed : banned).push('an HTML table')
  ;(spec.poll ? allowed : banned).push('a reader poll')

  return [
    allowed.length
      ? `This format may use: ${allowed.join(', ')}. Use it only where it carries information prose would carry worse.`
      : null,
    banned.length ? `This format must NOT contain: ${banned.join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

/** The extraction fields this format carries. A `false` becomes an explicit empty, never silence. */
const formatExtraction = (spec: FormatSpec) =>
  [
    spec.answer
      ? '- "answer": lead with the answer itself and name the subject explicitly. 40-60 words.'
      : '- "answer": return an empty string. This format does not answer a question outright.',
    spec.takeaways
      ? '- "keyTakeaways": 3-5 standalone facts — "Prices rose 12% in 2025", not "We look at how prices moved".'
      : '- "keyTakeaways": return an empty array. This format does not summarise into facts.',
    spec.faq
      ? '- "faq": 2-5 questions a reader would actually type. Never invent one to fill the array — fewer is better, and [] is fine.'
      : '- "faq": return an empty array. This format raises no recurring reader questions.',
  ].join('\n')

/**
 * `undefined` is the manual editor flow, where the author's prompt is the brief and the writer
 * picks the shape — it still gets the anti-formula rules, just no element budget.
 */
export const formatRules = (format?: ArticleFormat) => {
  const spec = format ? ARTICLE_FORMATS[format] : null

  if (!spec)
    return `
Length: 500-1000 words.
Tables and polls are both optional and the default is neither. Add one only when it carries information prose would carry worse.

Extraction fields (quoted verbatim by search and answer engines, so each must stand without the article around it):
- "answer": 40-60 words answering the title outright, or an empty string for a piece that answers nothing.
- "keyTakeaways": 3-5 standalone facts, or [] for opinion and narrative.
- "faq": 2-5 real reader questions, or [] — which is the common case.
All three are in the article's language and every claim in them is also supported by the body.

${ANTI_FORMULA}
`.trim()

  return `
Format: ${format}. ${spec.shape}
Length: ${spec.words[0]}-${spec.words[1]} words. Structure the body the way this format wants, not the way a template does.
${formatElements(spec)}

Extraction fields (quoted verbatim by search and answer engines, so each must stand without the article around it):
${formatExtraction(spec)}
They are in the article's language and every claim in them is also supported by the body.

${ANTI_FORMULA}
`.trim()
}

type Formattable = {
  answer?: string
  keyTakeaways?: string[]
  faq?: { question: string; answer: string }[]
  polls?: unknown[]
}

/**
 * The prompt withholds a disallowed element, but withholding is not a guarantee — the schema
 * still carries every key, so a model that pattern-matches its way to an FAQ can fill one. This
 * is the part that actually holds. Dropped polls leave their `[[POLLn]]` markers behind;
 * `finalizeArticle` strips unmatched slots, so they never reach the body.
 */
export const applyFormat = <T extends Formattable>(object: T, format?: ArticleFormat): T => {
  const spec = format ? ARTICLE_FORMATS[format] : null
  if (!spec) return object

  return {
    ...object,
    answer: spec.answer ? object.answer : '',
    keyTakeaways: spec.takeaways ? object.keyTakeaways : [],
    faq: spec.faq ? object.faq : [],
    polls: spec.poll ? object.polls : [],
  } as T
}
