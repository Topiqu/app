/**
 * How a picture may be presented. `photo` is the only kind allowed to carry a documentary
 * caption; everything else is labelled illustrative, so a stock or generated image can never
 * read as a record of the event the article describes.
 */
export type ImageKind = 'photo' | 'illustration' | 'ai'

export interface ImageCredit {
  author?: string
  authorUrl?: string
  /** Short license name (`CC BY-SA 4.0`). Absent where the library licenses under its own terms. */
  license?: string
  licenseUrl?: string
  source: string
  sourceUrl?: string
}

/** `Article.imageCredit`. Body images carry their own credit inside the content HTML instead. */
export interface CoverCredit {
  kind: ImageKind
  credit?: ImageCredit
}

/**
 * Only http(s) may reach an `href`. The column round-trips through the admin editor form and
 * `POST /api/articles` spreads the body straight into `create`, so these URLs are editable input,
 * not server-controlled data — a `javascript:` href here would be stored XSS on a public page.
 */
export const creditHref = (url?: string) => {
  if (!url) return undefined

  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : undefined
  } catch {
    return undefined
  }
}

export interface CreditSegment {
  /** Label text kept outside the anchor — only the name itself should be the link. */
  before?: string
  text: string
  after?: string
  href?: string
}

/**
 * The credit as ordered parts, so the server (HTML string, baked into the body) and the cover
 * component (VNodes) cannot drift. `photoBy` carries an `{author}` placeholder; splitting on it
 * rather than substituting keeps the label out of the link and works whichever side it sits on.
 */
export const creditSegments = (credit: ImageCredit, photoBy: string): CreditSegment[] => {
  const segments: CreditSegment[] = []

  if (credit.author) {
    const [before = '', after = ''] = photoBy.split('{author}')
    segments.push({ before, text: credit.author, after, href: creditHref(credit.authorUrl) })
  }

  if (credit.license) segments.push({ text: credit.license, href: creditHref(credit.licenseUrl) })

  segments.push({ text: credit.source, href: creditHref(credit.sourceUrl) })

  return segments
}

/** Everything but the library, then the library: `foto: Jan Novák, CC BY 4.0 / Wikimedia Commons`. */
export const creditSeparator = (index: number, total: number) => (index === 0 ? '' : index === total - 1 ? ' / ' : ', ')
