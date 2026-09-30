import { load } from 'cheerio'
import { createHash } from 'node:crypto'

import { escapeHtml, sanitizeHtml } from '../sanitize'
import { readFaq } from '../../../shared/utils/articleFaq'
import { creditSegments, creditSeparator, type CoverCredit } from '../../../shared/utils/imageCredit'

export interface ShopifyArticleContent {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  imageUrl: string | null
  imageCredit: unknown
  answer: string | null
  keyTakeaways: string[]
  faq: unknown
  sources: string[]
  tags: { tag: { name: string } }[]
}

export interface ShopifyArticlePayload {
  blogId: string
  title: string
  author: { name: string }
  handle: string
  body: string
  summary: string
  tags: string[]
  isPublished: boolean
  image?: { url: string; altText: string } | null
}

const labels = {
  en: {
    photo: 'Photo: {author}',
    faq: 'Frequently asked questions',
    sources: 'Sources',
    takeaways: 'Key takeaways',
    ai: 'AI-generated illustration',
  },
  cs: {
    photo: 'Foto: {author}',
    faq: 'Časté otázky',
    sources: 'Zdroje',
    takeaways: 'Hlavní body',
    ai: 'Ilustrace vytvořená AI',
  },
  de: {
    photo: 'Foto: {author}',
    faq: 'Häufig gestellte Fragen',
    sources: 'Quellen',
    takeaways: 'Wichtigste Punkte',
    ai: 'KI-generierte Illustration',
  },
  fr: {
    photo: 'Photo : {author}',
    faq: 'Questions fréquentes',
    sources: 'Sources',
    takeaways: 'Points essentiels',
    ai: 'Illustration générée par IA',
  },
}

export const shopifyHandle = (slug: string, articleId: string) =>
  `${slug.replace(/[^a-z0-9-]/g, '').slice(0, 80) || 'article'}-${createHash('sha256').update(articleId).digest('hex').slice(0, 12)}`

export const exportShopifyContent = (article: ShopifyArticleContent, origin: string, language: string) => {
  const text = labels[language as keyof typeof labels] || labels.en
  const $ = load(sanitizeHtml(article.content), null, false)
  $('script, style, form, button, input, select, textarea, [data-type="poll"], poll').remove()
  $('a[href], img[src], iframe[src]').each((_, element) => {
    const node = $(element)
    const attribute = element.tagName === 'a' ? 'href' : 'src'
    const value = node.attr(attribute)
    try {
      const url = new URL(value || '', origin)
      if (url.protocol !== 'https:') node.removeAttr(attribute)
      else node.attr(attribute, url.href)
    } catch {
      node.removeAttr(attribute)
    }
  })
  $('*').each((_, element) => {
    if (!('attribs' in element)) return
    for (const attribute of Object.keys(element.attribs || {})) {
      if (attribute.startsWith('data-') || ['class', 'colwidth', 'contenteditable'].includes(attribute))
        $(element).removeAttr(attribute)
    }
  })
  const parts: string[] = []
  if (article.answer) parts.push(`<p><strong>${escapeHtml(article.answer)}</strong></p>`)
  if (article.keyTakeaways.length)
    parts.push(
      `<h2>${text.takeaways}</h2><ul>${article.keyTakeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    )
  parts.push($.html())
  const faq = readFaq(article.faq)
  if (faq.length)
    parts.push(
      `<h2>${text.faq}</h2>${faq.map((entry) => `<h3>${escapeHtml(entry.question)}</h3><p>${escapeHtml(entry.answer)}</p>`).join('')}`,
    )
  const sources = article.sources.filter((source) => {
    try {
      return new URL(source).protocol === 'https:'
    } catch {
      return false
    }
  })
  if (sources.length)
    parts.push(
      `<h2>${text.sources}</h2><ul>${sources.map((source) => `<li><a href="${escapeHtml(source)}" rel="noopener noreferrer">${escapeHtml(source)}</a></li>`).join('')}</ul>`,
    )
  const credit = article.imageCredit as CoverCredit | null
  if (credit?.kind === 'ai') parts.push(`<p><small>${text.ai}</small></p>`)
  if (credit?.credit && typeof credit.credit.source === 'string') {
    const segments = creditSegments(credit.credit, text.photo)
    parts.push(
      `<p><small>${segments
        .map((segment, index) => {
          const value = escapeHtml(`${segment.before || ''}${segment.text}${segment.after || ''}`)
          return (
            creditSeparator(index, segments.length) +
            (segment.href ? `<a href="${escapeHtml(segment.href)}">${value}</a>` : value)
          )
        })
        .join('')}</small></p>`,
    )
  }
  return sanitizeHtml(parts.join('\n'))
}
