import type { Language } from '@prisma/client'

import { z } from 'zod'
import slugify from 'slugify'
import * as cheerio from 'cheerio'
import { generateObject } from 'ai'
import { readFaq } from '~~/shared/utils/articleFaq'
import { normalizePollOptions } from '~~/shared/utils/polls'

import { escapeHtml } from '../sanitize'

const LANGUAGE_NAMES: Record<Language, string> = {
  cs: 'Czech',
  en: 'English',
}

const verbatimToken = (i: number) => `[[BLK_${i}]]`
const pollToken = (i: number) => `[[POLLBLK_${i}]]`
const imgToken = (i: number) => `[[IMGBLK_${i}]]`
const attrToken = (i: number) => `[[ATTR_${i}]]`

const TRANSLATABLE_ATTRS = ['title', 'aria-label'] as const

interface TranslatableArticle {
  title: string
  excerpt?: string | null
  content: string
  answer?: string | null
  keyTakeaways?: string[]
  faq?: unknown
}

interface ExtractedPoll {
  pollId: string
  question: string
  options: { id: string; label: string }[]
}

interface ExtractedImage {
  html: string
  alt?: string
  title?: string
}

interface MaskResult {
  masked: string
  verbatim: string[]
  polls: ExtractedPoll[]
  images: ExtractedImage[]
  attrs: string[]
}

const safeParse = (raw: string | undefined): unknown => {
  try {
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}

/**
 * Strips id-bearing / untranslatable blocks (polls, X/Twitter embeds, images) out
 * of the article HTML and replaces them with opaque placeholder tokens, so the LLM
 * never sees a `data-poll-id`, `optionId`, embed markup, or image URL as free text.
 *
 * Poll text (question + labels), image `alt`/`title`, and human-readable attributes on
 * surviving elements (`title`, `aria-label` — e.g. link tooltips) are carried out
 * separately and translated as ordered structured fields; the ids, URLs and remaining
 * markup stay server-side and are re-stamped on rebuild. Twitter embeds are preserved
 * verbatim. Pure + deterministic — unit-testable.
 */
export const maskContentBlocks = (content: string): MaskResult => {
  const $ = cheerio.load(content)
  const verbatim: string[] = []
  const polls: ExtractedPoll[] = []
  const images: ExtractedImage[] = []
  const attrs: string[] = []

  $('div[data-type="poll"]').each((_, el) => {
    const $el = $(el)
    const pollId = $el.attr('data-poll-id') || $el.attr('data-id') || ''
    const question = ($el.attr('data-question') || '').trim()
    const options = normalizePollOptions(safeParse($el.attr('data-options'))).map((o) => ({
      id: o.id || '',
      label: o.label,
    }))
    $el.replaceWith(pollToken(polls.length))
    polls.push({ pollId, question, options })
  })

  $('blockquote.twitter-tweet').each((_, el) => {
    const $el = $(el)
    let html = $.html($el)
    const $script = $el.next('script')
    if ($script.length) {
      html += $.html($script)
      $script.remove()
    }
    $el.replaceWith(verbatimToken(verbatim.length))
    verbatim.push(html)
  })

  $('img').each((_, el) => {
    const $el = $(el)
    const alt = $el.attr('alt')
    const title = $el.attr('title')
    const html = $.html($el)
    $el.replaceWith(imgToken(images.length))
    images.push({ html, alt, title })
  })

  // Runs after blocks are replaced by text tokens, so masked-out img/poll/embed
  // attributes are already gone from the tree and never double-processed here.
  $('*').each((_, el) => {
    const $el = $(el)
    for (const name of TRANSLATABLE_ATTRS) {
      const val = $el.attr(name)
      if (val && val.trim()) {
        $el.attr(name, attrToken(attrs.length))
        attrs.push(val)
      }
    }
  })

  return { masked: $('body').html() ?? content, verbatim, polls, images, attrs }
}

const buildPollHtml = (poll: ExtractedPoll): string => {
  const $ = cheerio.load('<div></div>')
  const $div = $('div').first()
  $div.attr('data-type', 'poll')
  if (poll.pollId) $div.attr('data-poll-id', poll.pollId)
  $div.attr('data-question', poll.question)
  $div.attr('data-options', JSON.stringify(poll.options.map((o) => ({ id: o.id, label: o.label }))))
  return $.html($div)
}

const buildImgHtml = (img: ExtractedImage): string => {
  const $ = cheerio.load(img.html)
  const $img = $('img').first()
  if (img.alt !== undefined) $img.attr('alt', img.alt)
  if (img.title !== undefined) $img.attr('title', img.title)
  return $.html($img)
}

/**
 * Re-injects the masked blocks back into the translated HTML. Polls and images are
 * rebuilt deterministically from server-held markup + translated text (ids/URLs stay
 * untouched); verbatim blocks are restored as-is. `split/join` avoids `String.replace`
 * `$`-pattern pitfalls in HTML.
 */
export const rebuildContent = (
  translatedMasked: string,
  verbatim: string[],
  polls: ExtractedPoll[],
  images: ExtractedImage[] = [],
  attrs: string[] = [],
): string => {
  let out = translatedMasked
  polls.forEach((poll, i) => {
    out = out.split(pollToken(i)).join(buildPollHtml(poll))
  })
  images.forEach((img, i) => {
    out = out.split(imgToken(i)).join(buildImgHtml(img))
  })
  // The token lives inside a quoted attribute value in the serialized HTML, so the
  // replacement must be HTML-escaped — a stray `"`/`&` would break out of the attribute.
  attrs.forEach((val, i) => {
    out = out.split(attrToken(i)).join(escapeHtml(val))
  })
  verbatim.forEach((html, i) => {
    out = out.split(verbatimToken(i)).join(html)
  })
  return out
}

export const translationSchema = z.object({
  title: z.string().min(1).max(255).describe('Translated title'),
  excerpt: z.string().max(500).describe('Translated excerpt, empty string if the source excerpt was empty'),
  content: z.string().min(1).describe('Translated HTML with all placeholder tokens preserved'),
  polls: z
    .array(
      z.object({
        question: z.string().describe('Translated poll question'),
        options: z.array(z.string()).describe('Translated option labels, same order as input'),
      }),
    )
    .describe('Translated polls in the same order as provided'),
  images: z
    .array(
      z.object({
        alt: z.string().describe('Translated image alt text, empty if source was empty'),
        title: z.string().describe('Translated image title, empty if source was empty'),
      }),
    )
    .describe('Translated image alt/title in the same order as provided'),
  attrs: z
    .array(z.string())
    .describe('Translated human-readable attribute texts (title/aria-label), same order as input'),
  answer: z.string().describe('Translated direct answer, empty string if the source was empty'),
  keyTakeaways: z.array(z.string()).describe('Translated takeaways, same order and count as input'),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .describe('Translated FAQ, same order and count as input'),
})

/**
 * Translates an article into `targetLang` via `aiModel('translation')`, preserving structure and poll/
 * embed integrity (ids never reach the model). Pure of billing — the caller charges
 * tokens from the returned `usage` via `consumeClientTokens`.
 */
export const generateTranslation = async (article: TranslatableArticle, targetLang: Language) => {
  const targetName = LANGUAGE_NAMES[targetLang]
  const { masked, verbatim, polls, images, attrs } = maskContentBlocks(article.content)

  const instructions = `
    You are a professional translator. Translate the supplied article into ${targetName}.
    Rules:
    - Preserve ALL HTML tags, attributes, and overall structure exactly.
    - Preserve every placeholder token (e.g. [[BLK_0]], [[POLLBLK_0]], [[IMGBLK_0]], [[ATTR_0]]) verbatim and in its original position. Never translate, remove, reorder, or duplicate them.
    - Translate only human-readable text: headings, paragraphs, captions, list items, link text.
    - Keep URLs, code, and any embed markup unchanged.
    - For polls: return them in the SAME order, each with the SAME number of options in the SAME order; translate only the question and option labels.
    - For images: return them in the SAME order; translate only the alt and title text. Leave an entry empty if its source is empty.
    - For attrs: return them in the SAME order; these are human-readable attribute texts (link titles, aria-labels) — translate each into ${targetName}.
    - For keyTakeaways and faq: return the SAME number of entries in the SAME order. Never add an entry the source does not have — an empty array stays empty.
    - Produce natural, fluent ${targetName} while preserving the original tone and meaning.
  `.trim()

  const sourceFaq = readFaq(article.faq)
  const sourceTakeaways = article.keyTakeaways ?? []

  const { object, usage } = await generateObject({
    model: aiModel('translation'),
    maxOutputTokens: Math.min(20000, Math.ceil(masked.length / 3) + 1000),
    instructions,
    prompt: JSON.stringify({
      title: article.title,
      excerpt: article.excerpt ?? '',
      content: masked,
      polls: polls.map((p) => ({ question: p.question, options: p.options.map((o) => o.label) })),
      images: images.map((img) => ({ alt: img.alt ?? '', title: img.title ?? '' })),
      attrs,
      answer: article.answer ?? '',
      keyTakeaways: sourceTakeaways,
      faq: sourceFaq,
    }),
    schema: translationSchema,
  })

  const rebuiltPolls: ExtractedPoll[] = polls.map((poll, i) => {
    const translated = object.polls[i]
    return {
      pollId: poll.pollId,
      question: translated?.question?.trim() || poll.question,
      options: poll.options.map((o, oi) => ({
        id: o.id,
        label: translated?.options?.[oi]?.trim() || o.label,
      })),
    }
  })

  const rebuiltImages: ExtractedImage[] = images.map((img, i) => {
    const translated = object.images[i]
    return {
      html: img.html,
      alt: img.alt ? translated?.alt?.trim() || img.alt : img.alt,
      title: img.title ? translated?.title?.trim() || img.title : img.title,
    }
  })

  const rebuiltAttrs = attrs.map((original, i) => object.attrs[i]?.trim() || original)

  return {
    title: object.title,
    excerpt: object.excerpt?.trim() || null,
    content: rebuildContent(object.content, verbatim, rebuiltPolls, rebuiltImages, rebuiltAttrs),
    answer: object.answer?.trim() || null,
    // Indexed against the source, so a model that drops or invents an entry cannot change the count.
    keyTakeaways: sourceTakeaways.map((original, i) => object.keyTakeaways?.[i]?.trim() || original),
    faq: sourceFaq.map((entry, i) => ({
      question: object.faq?.[i]?.question?.trim() || entry.question,
      answer: object.faq?.[i]?.answer?.trim() || entry.answer,
    })),
    slug: slugify(object.title, { lower: true, strict: true, trim: true }),
    usage,
  }
}
