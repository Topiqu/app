import type { Language } from '@prisma/client'
import type { CoverCredit } from '~~/shared/utils/imageCredit'
import type { ArticleMediaProgress, ResearchDepth } from '~~/shared/utils/articleGeneration'

import { z } from 'zod'
import { generateObject, generateText, streamObject } from 'ai'
import { stripUntrustedIframes, youtubeEmbedUrl, youtubeVideoId } from '~~/shared/utils/youtube'

import type { ArticleImage } from '../images/types'

import { escapeHtml } from '../sanitize'
import { buildImageHtml, type CaptionLabels } from '../images/caption'
import { allowsGeneratedFallback, findCoverImage, findStockImage } from '../images/chain'
import {
  applyFormat,
  formatRules,
  selectedModulesFor,
  type ArticleFormat,
  type ArticleModule,
  type ArticleStructureVariant,
} from './formats'

const imageInstruction = z.object({
  type: z
    .enum(['photo', 'stock', 'generate'])
    .describe("'photo' for a real subject, 'stock' for mood, 'generate' only for what cannot be photographed"),
  query: z.string().min(2).max(1000).describe('English search keyword, or a generation prompt for type=generate'),
})

export const articleSchema = z.object({
  title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
  perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
  content: z
    .string()
    .min(500)
    .max(20000)
    .describe(
      'The article body at the length the format asks for, with h2, h3, strong, blockquote, underline, italic and ul/ol/li. Never pad between blocks with <br> or empty paragraphs — the stylesheet owns the spacing. Include numbered image, poll or video slots where selected.',
    ),
  answer: z
    .string()
    .max(600)
    .describe(
      '40-60 word direct answer to the question the title poses, in the article language. Empty string when the format carries no answer.',
    ),
  keyTakeaways: z
    .array(z.string().min(10).max(200))
    .max(5)
    .describe('3-5 standalone factual takeaways, or empty when the format does not summarise'),
  faq: z
    .array(
      z.object({
        question: z.string().min(5).max(200).describe('Question a reader would actually type'),
        answer: z.string().min(20).max(600).describe('Self-contained answer, 1-3 sentences'),
      }),
    )
    .max(5)
    .describe('2-5 FAQ entries, or empty when the format raises no recurring questions'),
  coverImage: imageInstruction.describe('Cover image instruction'),
  images: z
    .array(
      imageInstruction.extend({
        caption: z
          .string()
          .min(3)
          .max(200)
          .describe(
            'One factual sentence in the article language saying what the picture shows. No "Illustrative", "AI" or "Source:" — those are added automatically.',
          ),
      }),
    )
    .describe('Array of image instructions corresponding to slots in content'),
  polls: z
    .array(
      z.object({
        question: z.string().min(5).max(255).describe('Poll question'),
        options: z.array(z.string().min(1).max(255)).min(2).max(5).describe('Poll options (2-5)'),
      }),
    )
    .describe('Array of polls corresponding to slots in content, empty array if none'),
  videos: z
    .array(
      z.object({
        // Responses structured output rejects JSON Schema's `format: uri`. This stays a bounded
        // string in the model contract; `youtubeEmbedUrl()` performs the authoritative allowlist
        // validation before anything reaches article HTML.
        url: z.string().max(1000).describe('A real youtube.com or youtu.be URL found in the research brief'),
        caption: z.string().min(3).max(200).describe('A factual caption in the article language'),
      }),
    )
    .max(1)
    .describe('One verified YouTube video corresponding to [[VIDEO1]], or an empty array'),
  tags: z
    .array(z.string())
    .max(5)
    .describe("ID's of relevant tags from the provided tags list that best fit the article topic"),
  sources: z
    .array(z.string().min(1).max(1000).describe('Source URL or reference'))
    .max(5)
    .describe('Array of credible sources relevant to the article topic'),
})

type ArticleObject = (typeof articleSchema)['_output']

/** The brief's own output ceiling. Web search bills input and search context on top of it, so this
 *  is a headroom guard for the balance check, never the real cost — that comes back as `usage`. */
const RESEARCH_CONFIG = {
  quick: { maxOutputTokens: 700, timeoutMs: 25_000, searchContextSize: 'low' },
  standard: { maxOutputTokens: 1200, timeoutMs: 45_000, searchContextSize: 'medium' },
  deep: { maxOutputTokens: 1800, timeoutMs: 65_000, searchContextSize: 'high' },
} as const satisfies Record<
  ResearchDepth,
  { maxOutputTokens: number; timeoutMs: number; searchContextSize: 'low' | 'medium' | 'high' }
>

/** Minimum balance to start an article at all, before research is considered. */
const ARTICLE_TOKEN_FLOOR = 1500

const researchYoutube = async (prompt: string, abortSignal?: AbortSignal) => {
  const signal = abortSignal ? AbortSignal.any([abortSignal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000)

  try {
    const { text, usage } = await generateText({
      model: aiModel('articleResearch'),
      instructions: `Search specifically for one existing, directly relevant YouTube video about the topic. Prefer the official developer, publisher, manufacturer, institution or named subject's channel. Use web search and return only the full youtube.com/watch or youtu.be URL you actually opened; return NONE if no suitable video was retrieved. Never guess a video id or transform a channel/search URL into a watch URL.`,
      prompt,
      maxOutputTokens: 250,
      tools: { web_search: aiWebSearchTool('low') as never },
      abortSignal: signal,
    })
    const candidates = text.match(/https?:\/\/[^\s)\]}>,]+/g) ?? []
    const url = candidates.find((candidate) => youtubeVideoId(candidate)) ?? null
    if (!url) return { url: null, tokens: usage?.totalTokens ?? 0 }

    // Shape validation prevents an invented host/id from reaching the request. oEmbed then proves
    // that YouTube currently recognizes the exact video before the writer is allowed to embed it.
    const verification = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: AbortSignal.timeout(5_000),
    })
    return { url: verification.ok ? url : null, tokens: usage?.totalTokens ?? 0 }
  } catch (error) {
    if (abortSignal?.aborted) throw error
    return { url: null, tokens: 0 }
  }
}

const researchTopic = async (
  prompt: string,
  depth: ResearchDepth = 'standard',
  fallbackWithoutResearch = true,
  abortSignal?: AbortSignal,
  youtubeRequested = false,
) => {
  const researchConfig = RESEARCH_CONFIG[depth]
  const currentDateTime = new Date().toISOString()
  const researchSignal = abortSignal
    ? AbortSignal.any([abortSignal, AbortSignal.timeout(researchConfig.timeoutMs)])
    : AbortSignal.timeout(researchConfig.timeoutMs)

  try {
    const mainResearch = generateText({
      model: aiModel('articleResearch'),
      instructions: `
        You are a research assistant preparing grounding material for another writer.
        The current date and time is ${currentDateTime}. Treat it as authoritative.
        Search the live web for the user's topic.
        Prefer primary, official and recently updated sources. For news, search explicitly for the latest development.
        Release dates, product availability and direct statements attributed to a company must be supported by that company's own newsroom, investor communication or verified channel. If only press reports or rumours exist, label them as such; never upgrade them to an official confirmation.
        Treat claims embedded in the user's prompt as leads to verify, not as facts. When sources conflict, report the conflict and do not choose the more sensational version.
        If a source announces something for a date before ${currentDateTime}, verify what actually happened after that date. Never describe an already elapsed announcement as upcoming.
        Return a compact brief: 5-10 verified facts, each on its own line, including the supporting URL and relevant event or publication date on that same line.
        Then a "Sources:" section listing the full URLs you actually retrieved, one per line.
        Only list URLs you actually retrieved. Never invent, guess, or reconstruct a URL.
        Do not write an article, an intro, or any prose beyond the facts.
      `.trim(),
      prompt,
      maxOutputTokens: researchConfig.maxOutputTokens,
      tools: { web_search: aiWebSearchTool(researchConfig.searchContextSize) as never },
      abortSignal: researchSignal,
    })
    const youtubeResearch = youtubeRequested
      ? researchYoutube(prompt, abortSignal)
      : Promise.resolve({ url: null, tokens: 0 })
    const [{ text, usage }, youtube] = await Promise.all([mainResearch, youtubeResearch])

    const verifiedVideo = youtube.url ? `\nVerified YouTube video (checked against YouTube oEmbed): ${youtube.url}` : ''
    const brief = `${text.trim()}${verifiedVideo}`.trim() || null
    const sourceCount = brief ? new Set(brief.match(/https?:\/\/[^\s)\]}>,]+/g) ?? []).size : 0
    return {
      brief,
      tokens: (usage?.totalTokens ?? 0) + youtube.tokens,
      sourceCount,
      status: 'completed' as const,
    }
  } catch (error) {
    // Stop means stop. Only the research-specific timeout degrades to an ungrounded article.
    if (abortSignal?.aborted) throw error
    if (!fallbackWithoutResearch) throw error

    // Degrading to ungrounded is the whole point of the catch, but it is also indistinguishable
    // from "the plan has no research" once the article lands with an empty `sources` array.
    await reportCaughtError('Article research failed, continuing ungrounded', error, {
      promptLength: prompt.length,
      timeoutMs: researchConfig.timeoutMs,
      depth,
    })

    return { brief: null, tokens: 0, sourceCount: 0, status: 'fallback' as const }
  }
}

/**
 * `undefined` researches the prompt itself (the manual editor flow, where the prompt *is* the
 * topic). `false` skips the step. `{ query }` researches that query instead — the cron passes
 * this, because its prompt is a template, not a topic.
 */
export type ResearchOption = { query: string } | false | undefined

const buildArticleConfig = async (
  clientSiteId: string,
  prompt: string,
  {
    research: researchOption,
    format,
    variant,
    modules,
    researchDepth = 'standard',
    fallbackWithoutResearch = true,
    abortSignal,
  }: {
    research?: ResearchOption
    format?: ArticleFormat
    variant?: ArticleStructureVariant | null
    modules?: readonly ArticleModule[]
    researchDepth?: ResearchDepth
    fallbackWithoutResearch?: boolean
    abortSignal?: AbortSignal
  } = {},
) => {
  const {
    tokenRemaining,
    focus,
    keywords,
    audience,
    tags,
    aiToneOfVoice,
    aiControversyLevel,
    communityInsight,
    language,
  } = await prisma.clientSite.findFirstOrThrow({
    select: {
      tokenRemaining: true,
      language: true,
      focus: true,
      keywords: true,
      audience: true,
      tags: { select: { id: true, name: true } },
      aiToneOfVoice: true,
      aiControversyLevel: true,
      communityInsight: true,
    },
    where: { id: clientSiteId },
  })

  if (!tokenRemaining || tokenRemaining < ARTICLE_TOKEN_FLOOR)
    throw createError({
      statusCode: 403,
      statusMessage: `Insufficient tokens (minimum ${ARTICLE_TOKEN_FLOOR} required)`,
    })

  const maxOutputTokens = Math.min(tokenRemaining, 6000)

  const getControversyPrompt = (level: string | null) => {
    switch (level) {
      case 'NONE':
        return 'Avoid any controversial or polarizing topics completely. Keep the tone completely objective, safe, and universally acceptable.'
      case 'LOW':
        return 'You can lightly touch on thought-provoking topics, but maintain a balanced and highly neutral stance. Do not provoke or take extreme sides.'
      case 'MEDIUM':
        return 'Engage in healthy debate. Feel free to present strong arguments for different sides of a topic and do not shy away from expressing a well-reasoned, potentially polarizing viewpoint.'
      case 'HIGH':
        return "You are a highly controversial author, who isn't afraid of indulging in socially forbidden topics, argumenting for them meticulously in a passively-aggressive, yet believable manner. Challenge mainstream narratives aggressively."
      default:
        return ''
    }
  }

  const controversyPrompt = getControversyPrompt(aiControversyLevel)

  // Research used to be a PREMIUM / large-CUSTOM perk, which made an empty `sources` array the
  // guaranteed outcome everywhere else — with no brief the model is told to return one. Open to
  // every plan now; the only gate left is the balance, because the brief bills on top of the
  // article and must not eat the floor the article itself needs.
  const researchBudget = RESEARCH_CONFIG[researchDepth].maxOutputTokens
  const searchOn = tokenRemaining >= ARTICLE_TOKEN_FLOOR + researchBudget
  const researchQuery = researchOption === undefined ? prompt : researchOption ? researchOption.query : null
  const youtubeRequested = format ? selectedModulesFor(format, modules).includes('youtube') : false
  const researchResult =
    searchOn && researchQuery
      ? await researchTopic(researchQuery, researchDepth, fallbackWithoutResearch, abortSignal, youtubeRequested)
      : { brief: null, tokens: 0, sourceCount: 0, status: 'skipped' as const }
  const { brief, tokens: researchTokens } = researchResult

  const researchPrompt = brief
    ? `\nResearch brief (gathered from live web search — this is your only factual grounding):\n${brief}\nEvery entry in "sources" MUST be a URL that appears verbatim in this brief. If the brief lists no URLs, return an empty sources array. Never invent or reconstruct a source URL.`
    : `\nYou have no live search results for this article. Return an empty "sources" array rather than inventing URLs. Do not state specific statistics, percentages, study results or named-organisation findings you cannot ground — write about the topic without inventing figures.`

  const communityPrompt = communityInsight
    ? `\nCommunity Insights to consider:\n- Audience mood summary: ${(communityInsight as any).summary}\n- Frequently discussed points: ${((communityInsight as any).topPoints || []).join(', ')}\nEnsure the article subtly addresses or acknowledges these current community feelings and discussion points where relevant.`
    : ''

  // No format is the manual editor flow, where the author's prompt is the brief — it keeps the
  // full menu, and only the cron's topic picker spends a format.
  const selectedModules = format ? selectedModulesFor(format, modules) : null
  const imagesSelected = selectedModules ? selectedModules.includes('images') : null
  const pollsAllowed = selectedModules ? selectedModules.includes('poll') : true
  const tablesAllowed = selectedModules ? selectedModules.includes('table') : true
  const videosAllowed = selectedModules ? selectedModules.includes('youtube') : true
  const currentDateTime = new Date().toISOString()

  const instructions = `
      You are a professional content writer focusing on ${focus || 'common topics'}.
      The current date and time is ${currentDateTime}. This is authoritative and more important than dates implied by the user prompt or older sources.
      Write a detailed, well-structured article based on the user prompt aiming on ${audience || 'wide audience'}.
      Use appropriate headings, subheadings, and formatting.
      ${aiToneOfVoice ? `Write in the following tone of voice: ${aiToneOfVoice}.` : ''}
      ${controversyPrompt}${communityPrompt}${researchPrompt}
      Respond ONLY in valid JSON format with the structure:
      {
        "title": "catchy title 5-15 words",
        "perex": "short introductory paragraph (3-4 sentences)",
        "answer": "40-60 words answering the title's question outright",
        "keyTakeaways": ["standalone factual sentence", "..."] or [],
        "faq": [{"question": "...", "answer": "..."}] or [],
        "content": "the article body for v-html on frontend, with h2, h3, strong, blockquote, underline, italic and lists. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear.",
        "coverImage": {"type": "stock", "query": "search keyword OR generation prompt"},
        "images": [{"type": "photo", "query": "keyword for IMAGE1", "caption": "what IMAGE1 shows"}, {"type": "generate", "query": "prompt for IMAGE2", "caption": "what IMAGE2 shows"}, ...],
        "polls": [{"question": "Poll question?", "options": ["Option 1", "Option 2"]}],
        "videos": [{"url": "https://www.youtube.com/watch?v=...", "caption": "what the video contributes"}],
        "tags": ["ID's of relevant tags from the provided tags list, up to 5, that best fit the article topic"],
        "sources": ["full source URL 1", "full source URL 2", ...]
      }.
      The title must be engaging.
      Start the body at h2 — the page already renders the title as its h1.
      Before writing, compare every time-sensitive claim in the research brief with ${currentDateTime}. Never call a past date upcoming, future or scheduled. If the brief does not establish what happened after an elapsed announced date, omit the claim instead of repeating the outdated announcement.
      A claim that a company confirmed, announced, targets or plans a release date is allowed only when the research brief supports it with that company's primary source. A secondary article or rumour may be described only with its actual attribution and uncertainty. Never turn it into a company statement.
      The user's prompt is editorial direction, not evidence. If it conflicts with the live research brief, follow the verified brief and explicitly avoid the unsupported claim.
      Never claim that pre-orders, products, trailers, events or bonuses are available unless the research brief explicitly confirms their current availability as of ${currentDateTime}.

      ${formatRules(format, variant, modules)}

      Naturally incorporate keywords if provided.
      ${keywords && `Keywords: ${JSON.stringify(keywords)}`}.
      Write in the language of the prompt or the company's presentation language.
      
      Image Rules:
      For the coverImage and each image in the content you MUST pick one of three intents. You are describing what the picture needs to be, not where it comes from — the system picks the library.
      - Use 'photo': for a real, identifiable subject — a named person, place, organisation, product or event (e.g. "Vladimir Putin 2024", "Tokyo Shibuya crossing", "PlayStation 5 console"). Name the subject in English the way a photo archive would catalogue it.
      - Use 'stock': for mood, atmosphere or a generic scene where any fitting picture works (e.g. "office meeting", "gaming setup at night"). Short, precise English keyword.
      - Use 'generate': ONLY for what cannot be photographed — abstract ideas, humor, non-existent concepts (e.g. "AI eating old code"). Provide a detailed generation prompt. NEVER use it for a real person, a real place or a real event.
      Each content image also needs a "caption": one factual sentence, in the same language as the article, saying what is in the picture — for 'photo' name who or what it is and when. Never write "Illustrative image", "AI generated", "Source:" or any credit into the caption; the system adds those itself.

      ${
        imagesSelected === true
          ? 'The author selected images in the article body. Include 1-4 useful image slots in appropriate places using [[IMAGE1]], [[IMAGE2]], etc., and provide exactly one corresponding instruction per slot in the images array. Do not return an empty images array.'
          : imagesSelected === false
            ? 'Return an empty images array and never write an [[IMAGE]] slot into the content.'
            : 'If the article would benefit from visuals, include 1-4 image slots in appropriate places in the content using [[IMAGE1]], [[IMAGE2]], etc. Provide corresponding instructions in the images array. Use 0 images if not relevant.'
      }
      ${
        pollsAllowed
          ? 'A poll is optional and the default is none. Add one only where it opens a question the article deliberately leaves open — at most 2 slots as [[POLL1]], [[POLL2]], with the question and 2-5 options per poll in the polls array. Otherwise return an empty polls array and write no slot.'
          : 'Return an empty polls array and never write a [[POLL]] slot into the content.'
      }

      ${
        tablesAllowed
          ? `Tables:
      When the article compares options or presents figures (prices, budgets, specs, timelines), render them as a real HTML table, never as tab- or pipe-separated text.
      Use proper markup: <table><thead><tr><th>…</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table>.
      Keep tables to a maximum of 4 columns so they stay readable on mobile, and never put an image, a poll slot or a nested table inside a cell.
      A table earns its place by holding figures the reader compares across rows. Never build one out of prose.`
          : 'Never render a <table>. Whatever figures this format needs belong in the prose.'
      }

      YouTube video:
      ${
        videosAllowed
          ? 'The author selected a YouTube video. Use one [[VIDEO1]] slot when the research brief contains a suitable YouTube URL that materially demonstrates, documents or explains the subject, and return that URL and its caption in videos. If the brief contains no suitable YouTube URL, return [] and write no slot. Never invent or reconstruct a video URL.'
          : 'Return an empty videos array and never write a [[VIDEO]] slot into the content.'
      }

      Twitter/X Embeds:
      If you find a highly relevant post on the X network (Twitter) to illustrate the article, DO NOT just return the URL. Instead, return it wrapped in this exact HTML format:
      <blockquote class="twitter-tweet"><a href="[INSERT TWEET URL HERE]"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
      
      The research rule above is the only authority on "sources" — never add an entry it does not permit.
      Only select tags from this list: ${JSON.stringify(tags || [])}.
    `.trim()

  return {
    language,
    // Billed on top of `usage` by every caller: the brief is a separate model call, so it is
    // invisible to the writer's own token count. It went unbilled entirely while research was a
    // PREMIUM perk, and opening the gate would have multiplied that leak across every tenant.
    researchTokens,
    research: { status: researchResult.status, sourceCount: researchResult.sourceCount, depth: researchDepth },
    config: {
      model: aiModel('articleWriter'),
      maxOutputTokens,
      instructions,
      prompt,
      schema: articleSchema,
    } as const,
  }
}

type FinalizeImage = { slot: number; html: string }
type FinalizeCallbacks = {
  onImage?: (image: FinalizeImage) => void
  onMedia?: (progress: ArticleMediaProgress) => void
  abortSignal?: AbortSignal
}

/** Falls back to English wording rather than dropping the disclosure when a key is missing. */
const captionLabels = async (language: Language): Promise<CaptionLabels> => {
  const t = await getServerTranslator(language)

  return {
    illustration: t('articles.image.illustration') || 'Illustrative image',
    ai: t('articles.image.ai') || 'Illustrative image (AI)',
    photoBy: t('articles.image.photoBy') || 'photo: {author}',
  }
}

export const finalizeArticle = async (
  object: ArticleObject,
  language: Language = 'en',
  callbacks: FinalizeCallbacks = {},
) => {
  const { onImage, onMedia, abortSignal } = callbacks
  const generateImageOptions = {
    outputDir: 'article-images',
    filenamePrefix: 'article',
  }

  // A failed image must never cost the author the whole article, so every generation is
  // best-effort: report and carry on with one image fewer. Reported rather than logged because
  // swallowing it here is exactly what makes "the images did not appear" undiagnosable — nothing
  // downstream throws, so this is the only place the cause exists.
  const tryGenerateImage = async (prompt: string, opts?: { filenameSuffix?: string }) => {
    try {
      const { url, width, height } = await generateImage(prompt, { ...generateImageOptions, ...opts, abortSignal })
      return { url, width, height }
    } catch (error) {
      await reportCaughtError('Article image generation failed', error, { prompt })
      return null
    }
  }

  let articleImageUrl = ''
  let articleImageCredit: CoverCredit | null = null
  const mediaTotal = 1 + object.images.length
  let mediaCompleted = 0
  let mediaFound = 0
  onMedia?.({ stage: 'cover', completed: mediaCompleted, total: mediaTotal, found: mediaFound })
  if (object.coverImage) {
    const hit = object.coverImage.type === 'generate' ? null : await findCoverImage(object.coverImage.query)
    const generated = hit ? null : await tryGenerateImage(object.coverImage.query)
    articleImageUrl = hit?.url ?? generated?.url ?? ''

    // Whatever it turned out to be, not what was asked for: a stock lookup that came back empty
    // silently became a generated picture, and that is the case the reader most needs told.
    if (articleImageUrl) articleImageCredit = hit ? { kind: 'illustration', credit: hit.credit } : { kind: 'ai' }
  } else {
    // Legacy fallback just in case AI omits it
    articleImageUrl = (await tryGenerateImage(`${object.title} — ${object.perex}`.trim().slice(0, 1024)))?.url ?? ''
    if (articleImageUrl) articleImageCredit = { kind: 'ai' }
  }
  if (!articleImageUrl && object.coverImage) {
    // A catalogue miss followed by a failed generation still deserves one simpler attempt. The
    // title and perex are usually a more portable image prompt than the writer's detailed query.
    articleImageUrl = (await tryGenerateImage(`${object.title} — ${object.perex}`.trim().slice(0, 1024)))?.url ?? ''
    if (articleImageUrl) articleImageCredit = { kind: 'ai' }
  }
  mediaCompleted += 1
  if (articleImageUrl) mediaFound += 1
  onMedia?.({
    stage: object.images.length ? 'content' : 'complete',
    completed: mediaCompleted,
    total: mediaTotal,
    found: mediaFound,
  })

  const labels = await captionLabels(language)

  /** `photo` deliberately has no generated fallback — see `findStockImage`. */
  const resolveImage = async (
    instruction: ArticleObject['images'][number],
    idx: number,
  ): Promise<ArticleImage | null> => {
    const hit = await findStockImage(instruction.type, instruction.query)
    if (hit) return { url: hit.image.url, kind: hit.kind, alt: hit.image.alt, credit: hit.image.credit }

    if (!allowsGeneratedFallback(instruction.type)) return null

    const generated = await tryGenerateImage(instruction.query, { filenameSuffix: idx.toString() })

    return generated ? { ...generated, kind: 'ai' } : null
  }

  const settledImages = await Promise.all(
    object.images.map(async (img, idx) => {
      const resolved = await resolveImage(img, idx).finally(() => {
        mediaCompleted += 1
      })
      if (!resolved) {
        onMedia?.({ stage: 'content', completed: mediaCompleted, total: mediaTotal, found: mediaFound })
        return null
      }

      const image = { slot: idx + 1, html: buildImageHtml(resolved, img.caption, labels) }
      mediaFound += 1
      onImage?.(image)
      onMedia?.({ stage: 'content', completed: mediaCompleted, total: mediaTotal, found: mediaFound })

      return image
    }),
  )

  const generatedImages = settledImages.filter((image) => image !== null)
  onMedia?.({ stage: 'complete', completed: mediaTotal, total: mediaTotal, found: mediaFound })

  // Before the slots are filled: the image attribution carries a deliberate mid-paragraph `<br>`
  // that this pass must not see as padding.
  object.content = dropBlankLines(stripUntrustedIframes(object.content))
  object.content = applyContentSlots(object.content, 'IMAGE', generatedImages)

  const polls = (object.polls ?? []).map((poll, idx) => {
    const pollId = crypto.randomUUID()
    const optionObjects = poll.options.map((label: string) => ({ label }))
    const escapedOptions = JSON.stringify(optionObjects).replace(/"/g, '&quot;')
    return {
      slot: idx + 1,
      html: `<div data-type="poll" data-id="${pollId}" data-question="${poll.question}" data-options="${escapedOptions}"></div>`,
    }
  })
  object.content = applyContentSlots(object.content, 'POLL', polls)

  const videos = (object.videos ?? []).flatMap((video, idx) => {
    const src = youtubeEmbedUrl(video.url)
    if (!src) return []
    const caption = escapeHtml(video.caption)
    return [
      {
        slot: idx + 1,
        html: `<figure class="article-video"><div data-youtube-video><iframe class="youtube-video" src="${src}" title="${caption}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><figcaption>${caption}</figcaption></figure>`,
      },
    ]
  })
  object.content = applyContentSlots(object.content, 'VIDEO', videos)

  return { ...object, articleImageUrl, articleImageCredit }
}

export const generateArticle = async (
  clientSiteId: string,
  prompt: string,
  opts?: {
    research?: ResearchOption
    format?: ArticleFormat
    variant?: ArticleStructureVariant | null
    modules?: readonly ArticleModule[]
    researchDepth?: ResearchDepth
    fallbackWithoutResearch?: boolean
  },
) => {
  const { config, language, researchTokens } = await buildArticleConfig(clientSiteId, prompt, opts)
  const { object, usage } = await generateObject(config)
  const finalized = await finalizeArticle(applyFormat(object, opts?.format, opts?.modules), language)

  return { ...finalized, usage, researchTokens }
}

export const streamArticle = async (
  clientSiteId: string,
  prompt: string,
  opts: {
    abortSignal?: AbortSignal
    research?: ResearchOption
    researchDepth?: ResearchDepth
    fallbackWithoutResearch?: boolean
    format?: ArticleFormat
    modules?: readonly ArticleModule[]
  } = {},
) => {
  const { config, language, researchTokens, research } = await buildArticleConfig(clientSiteId, prompt, opts)
  const result = streamObject({ ...config, abortSignal: opts.abortSignal })

  // The caption labels follow the site's language, which only this side knows — so the endpoint
  // keeps handing over just the object and its image callback.
  const finalize = (object: ArticleObject, callbacks?: FinalizeCallbacks) =>
    finalizeArticle(applyFormat(object, opts.format, opts.modules), language, callbacks)

  return { result, finalize, researchTokens, research }
}
