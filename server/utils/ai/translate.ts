import type { Language } from '@prisma/client'

import slugify from 'slugify'
import * as cheerio from 'cheerio'
import { generateObject } from 'ai'
import { normalizePollOptions } from '~~/shared/utils/polls'

const LANGUAGE_NAMES: Record<Language, string> = {
  cs: 'Czech',
  en: 'English',
}

const verbatimToken = (i: number) => `[[BLK_${i}]]`
const pollToken = (i: number) => `[[POLLBLK_${i}]]`

interface TranslatableArticle {
  title: string
  excerpt?: string | null
  content: string
}

interface ExtractedPoll {
  pollId: string
  question: string
  options: { id: string; label: string }[]
}

interface MaskResult {
  masked: string
  verbatim: string[]
  polls: ExtractedPoll[]
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
 * Poll text (question + labels) is carried out separately and translated as ordered
 * structured fields; the ids stay server-side and are re-stamped on rebuild. Twitter
 * embeds and images are preserved verbatim. Pure + deterministic — unit-testable.
 */
export const maskContentBlocks = (content: string): MaskResult => {
  const $ = cheerio.load(content)
  const verbatim: string[] = []
  const polls: ExtractedPoll[] = []

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
    $el.replaceWith(verbatimToken(verbatim.length))
    verbatim.push($.html($el))
  })

  return { masked: $('body').html() ?? content, verbatim, polls }
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

/**
 * Re-injects the masked blocks back into the translated HTML. Polls are rebuilt
 * deterministically from server-held ids + translated text; verbatim blocks are
 * restored as-is. `split/join` avoids `String.replace` `$`-pattern pitfalls in HTML.
 */
export const rebuildContent = (translatedMasked: string, verbatim: string[], polls: ExtractedPoll[]): string => {
  let out = translatedMasked
  polls.forEach((poll, i) => {
    out = out.split(pollToken(i)).join(buildPollHtml(poll))
  })
  verbatim.forEach((html, i) => {
    out = out.split(verbatimToken(i)).join(html)
  })
  return out
}

/**
 * Translates an article into `targetLang` via xAI, preserving structure and poll/
 * embed integrity (ids never reach the model). Pure of billing — the caller charges
 * tokens from the returned `usage` via `consumeClientTokens`.
 */
export const generateTranslation = async (article: TranslatableArticle, targetLang: Language) => {
  const targetName = LANGUAGE_NAMES[targetLang]
  const { masked, verbatim, polls } = maskContentBlocks(article.content)

  const system = `
    You are a professional translator. Translate the supplied article into ${targetName}.
    Rules:
    - Preserve ALL HTML tags, attributes, and overall structure exactly.
    - Preserve every placeholder token (e.g. [[BLK_0]], [[POLLBLK_0]]) verbatim and in its original position. Never translate, remove, reorder, or duplicate them.
    - Translate only human-readable text: headings, paragraphs, captions, list items, link text.
    - Keep URLs, code, and any embed markup unchanged.
    - For polls: return them in the SAME order, each with the SAME number of options in the SAME order; translate only the question and option labels.
    - Produce natural, fluent ${targetName} while preserving the original tone and meaning.
  `.trim()

  const { object, usage } = await generateObject({
    model: xai('grok-4-1-fast'),
    maxOutputTokens: Math.min(20000, Math.ceil(masked.length / 3) + 1000),
    system,
    prompt: JSON.stringify({
      title: article.title,
      excerpt: article.excerpt ?? '',
      content: masked,
      polls: polls.map((p) => ({ question: p.question, options: p.options.map((o) => o.label) })),
    }),
    schema: z.object({
      title: z.string().min(1).max(255).describe('Translated title'),
      excerpt: z.string().max(500).optional().describe('Translated excerpt'),
      content: z.string().min(1).describe('Translated HTML with all placeholder tokens preserved'),
      polls: z
        .array(
          z.object({
            question: z.string().describe('Translated poll question'),
            options: z.array(z.string()).describe('Translated option labels, same order as input'),
          }),
        )
        .describe('Translated polls in the same order as provided'),
    }),
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

  return {
    title: object.title,
    excerpt: object.excerpt?.trim() || null,
    content: rebuildContent(object.content, verbatim, rebuiltPolls),
    slug: slugify(object.title, { lower: true, strict: true, trim: true }),
    usage,
  }
}
