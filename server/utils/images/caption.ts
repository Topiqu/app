import type { ImageCredit } from '~~/shared/utils/imageCredit'

import { creditSegments, creditSeparator } from '~~/shared/utils/imageCredit'

import type { ArticleImage } from './types'

import { escapeHtml } from '../sanitize'

export interface CaptionLabels {
  /** Prefix for a real photo used illustratively. */
  illustration: string
  /** Prefix for a model-generated picture. */
  ai: string
  /** Carries an `{author}` placeholder. */
  photoBy: string
}

const link = (text: string, href?: string) => {
  const safe = escapeHtml(text)

  return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${safe}</a>` : safe
}

/** `foto: Jan Novák, CC BY-SA 4.0 / Wikimedia Commons` — every part optional except the source. */
export const renderCredit = (credit: ImageCredit, labels: CaptionLabels) => {
  const segments = creditSegments(credit, labels.photoBy)

  return segments
    .map((segment, i) => {
      const separator = creditSeparator(i, segments.length)
      const label = escapeHtml(segment.before ?? '')

      return `${separator}${label}${link(segment.text, segment.href)}${escapeHtml(segment.after ?? '')}`
    })
    .join('')
}

/**
 * The caption line the reader sees. Kept inside the `<p>` wrapper on purpose: TipTap has no
 * figure node (`useTiptapInstance`), so a `<figure>` would be dropped the first time the author
 * opened the article, and `Lightbox`'s `.prose p img` selector would stop matching. The `<br>`
 * is the deliberate mid-paragraph break `dropBlankLines` is written to preserve.
 */
export const buildImageHtml = (image: ArticleImage, caption: string, labels: CaptionLabels) => {
  const prefix = image.kind === 'ai' ? labels.ai : image.kind === 'illustration' ? labels.illustration : ''
  const trimmed = caption.trim()
  const text = [prefix, trimmed].filter(Boolean).join(': ')
  const credit = image.credit ? renderCredit(image.credit, labels) : ''
  const line = [text && escapeHtml(text), credit].filter(Boolean).join(' — ')

  // Falls back to the provider's description, then to a decorative empty alt — repeating a
  // search keyword there is worse for a screen reader than saying nothing.
  const alt = escapeHtml(trimmed || image.alt?.trim() || '')

  return (
    `<p style="text-align: center;"><img src="${escapeHtml(image.url)}" alt="${alt}" />` +
    (line ? `<br><small style="color: gray;">${line}</small>` : '') +
    `</p>`
  )
}
