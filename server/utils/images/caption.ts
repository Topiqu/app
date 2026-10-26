export interface CaptionLabels {
  /** Prefix for a real photo used illustratively, when no credit says so. */
  illustration: string
  /** Prefix for a model-generated picture. */
  ai: string
  /** Credit labels; each carries an `{author}` placeholder. */
  photoBy: string
  illustrationBy: string
}

const link = (text: string, href?: string) => {
  const safe = escapeHtml(text)

  return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${safe}</a>` : safe
}

/** `foto: Jan Novák (CC BY-SA 4.0)` — the licence only when there is one. */
export const renderCredit = (credit: ImageCredit, by: string) =>
  creditSegments(credit, by)
    .map(({ before = '', text, after = '', href }) => `${escapeHtml(before)}${link(text, href)}${escapeHtml(after)}`)
    .join('')

/** The same `<figure>` shape the editor's `Figure` node writes (`extensions/figure.ts`). */
export const buildImageHtml = (image: ArticleImage, caption: string, labels: CaptionLabels) => {
  const trimmed = caption.trim()
  // A generated picture documents nothing: its description only makes alt text, and under the
  // image it would just repeat it. The figure keeps the disclosure label alone.
  const shown = image.kind === 'ai' ? '' : trimmed
  const credit = image.credit
    ? renderCredit(image.credit, image.kind === 'illustration' ? labels.illustrationBy : labels.photoBy)
    : ''
  const prefix =
    image.kind === 'ai'
      ? `<span data-ai-disclosure>${escapeHtml(labels.ai)}</span>`
      : image.kind === 'illustration' && !credit
        ? `${escapeHtml(labels.illustration)}${shown ? ': ' : ''}`
        : ''
  const text = `${prefix}${shown ? escapeHtml(shown) : ''}`
  const line = [text, credit].filter(Boolean).join(' — ')

  // Falls back to the provider's description, then to a decorative empty alt — repeating a
  // search keyword there is worse for a screen reader than saying nothing.
  const alt = escapeHtml(trimmed || image.alt?.trim() || '')
  const dimensions = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ''
  const mediaId = image.mediaId ? ` data-media-id="${escapeHtml(image.mediaId)}"` : ''

  return (
    `<figure class="article-image"><img src="${escapeHtml(image.url)}" alt="${alt}" data-article-lightbox="true"${mediaId}${dimensions} />` +
    (line ? `<figcaption>${line}</figcaption>` : '') +
    `</figure>`
  )
}
