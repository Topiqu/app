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
 * `Foto: Jan Novák (CC BY 4.0)` as ordered parts, so the server (HTML string, baked into the body)
 * and the cover component (VNodes) cannot drift. The name links to the work's own page, which
 * carries the full attribution; the licence stays visible because CC 2.0/3.0 require its URI with
 * every use. `by` carries an `{author}` placeholder, split on rather than substituted so the label
 * stays out of the link whichever side it sits on.
 */
export const creditSegments = (credit: ImageCredit, by: string): CreditSegment[] => {
  const [before = '', after = ''] = by.split('{author}')
  const name = {
    before,
    text: credit.author || credit.source,
    after,
    href: creditHref(credit.sourceUrl) ?? creditHref(credit.authorUrl),
  }

  return credit.license
    ? [name, { before: ' (', text: credit.license, after: ')', href: creditHref(credit.licenseUrl) }]
    : [name]
}
