import { generateObject, generateText, streamObject } from 'ai'

import { fetchUnsplashImage } from '../unsplash'

const articleSchema = z.object({
  title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
  perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
  content: z
    .string()
    .min(500)
    .max(20000)
    .describe(
      'Article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic, you can also add <br> tags at the end of each section/paragraph for v-html on frontend. Include image slots like [[IMAGE1]] and poll slots like [[POLL1]] where they should appear.',
    ),
  coverImage: z
    .object({
      type: z.enum(['unsplash', 'generate']),
      query: z.string().min(2).max(1000),
    })
    .describe('Cover image instruction'),
  images: z
    .array(
      z.object({
        type: z.enum(['unsplash', 'generate']),
        query: z.string().min(2).max(1000),
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
    .optional()
    .describe('Array of polls corresponding to slots in content'),
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

const researchTopic = async (prompt: string) => {
  try {
    const { text } = await generateText({
      model: aiModel('articleResearch'),
      instructions: `
        You are a research assistant preparing grounding material for another writer.
        Search the live web for the user's topic.
        Return a compact brief: 5-10 verified facts, each on its own line.
        Then a "Sources:" section listing the full URLs you actually retrieved, one per line.
        Only list URLs you actually retrieved. Never invent, guess, or reconstruct a URL.
        Do not write an article, an intro, or any prose beyond the facts.
      `.trim(),
      prompt,
      maxOutputTokens: 1200,
      tools: { web_search: aiWebSearchTool() },
    })

    return text.trim() || null
  } catch (e: any) {
    console.error('[ai/article] research step failed, continuing ungrounded:', e?.message || e)

    return null
  }
}

const buildArticleConfig = async (clientSiteId: string, prompt: string) => {
  const { tokenRemaining, plan, focus, keywords, audience, tags, aiToneOfVoice, aiControversyLevel, communityInsight } =
    await prisma.clientSite.findFirstOrThrow({
      select: {
        tokenRemaining: true,
        focus: true,
        keywords: true,
        audience: true,
        tags: { select: { id: true, name: true } },
        plan: true,
        aiToneOfVoice: true,
        aiControversyLevel: true,
        communityInsight: true,
      },
      where: { id: clientSiteId },
    })

  if (!tokenRemaining || tokenRemaining < 1500)
    throw createError({ statusCode: 403, statusMessage: 'Insufficient tokens (minimum 1500 required)' })

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

  const searchOn = plan === 'PREMIUM' || (plan === 'CUSTOM' && maxOutputTokens > 5000)
  const research = searchOn ? await researchTopic(prompt) : null

  const researchPrompt = research
    ? `\nResearch brief (gathered from live web search — this is your only factual grounding):\n${research}\nEvery entry in "sources" MUST be a URL that appears verbatim in this brief. If the brief lists no URLs, return an empty sources array. Never invent or reconstruct a source URL.`
    : `\nYou have no live search results for this article. Return an empty "sources" array rather than inventing URLs.`

  const communityPrompt = communityInsight
    ? `\nCommunity Insights to consider:\n- Audience mood summary: ${(communityInsight as any).summary}\n- Frequently discussed points: ${((communityInsight as any).topPoints || []).join(', ')}\nEnsure the article subtly addresses or acknowledges these current community feelings and discussion points where relevant.`
    : ''

  const instructions = `
      You are a professional content writer focusing on ${focus || 'common topics'}.
      Write a detailed, well-structured article based on the user prompt aiming on ${audience || 'wide audience'}.
      Use appropriate headings, subheadings, and formatting.
      ${aiToneOfVoice ? `Write in the following tone of voice: ${aiToneOfVoice}.` : ''}
      ${controversyPrompt}${communityPrompt}${researchPrompt}
      Respond ONLY in valid JSON format with the structure:
      {
        "title": "catchy title 5-15 words",
        "perex": "short introductory paragraph (3-4 sentences)",
        "content": "article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic for v-html on frontend. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear. If relevant, include poll slots like [[POLL1]], [[POLL2]] to engage the audience.",
        "coverImage": {"type": "unsplash", "query": "search keyword OR generation prompt"},
        "images": [{"type": "unsplash", "query": "keyword for IMAGE1"}, {"type": "generate", "query": "prompt for IMAGE2"}, ...],
        "polls": [{"question": "Poll question?", "options": ["Option 1", "Option 2"]}],
        "tags": ["ID's of relevant tags from the provided tags list, up to 5, that best fit the article topic"],
        "sources": ["source URL or reference 1", "source URL or reference 2", ...]
      }.
      The title must be engaging.
      Naturally incorporate keywords if provided.
      ${keywords && `Keywords: ${JSON.stringify(keywords)}`}.
      Write in the language of the prompt or the company's presentation language.
      
      Image Rules:
      For the coverImage and each image in the content, you MUST choose between two tools: 'unsplash' or 'generate'.
      - Use 'unsplash': For all common topics (food, lifestyle, nature, business, emotions, technology, people). Provide a short, precise English search keyword (e.g. "office meeting").
      - Use 'generate': ONLY as a last resort for highly specific, non-existent concepts, humor, or abstract ideas that cannot be found on Unsplash (e.g. "AI eating old code"). Provide a detailed generation prompt. Do NOT generate real people or politicians.
      
      If the article would benefit from visuals, include 1-4 image slots in appropriate places in the content using [[IMAGE1]], [[IMAGE2]], etc. Provide corresponding instructions in the images array. Use 0 images if not relevant.
      If the article would benefit from interactive audience engagement, include 0-2 poll slots in appropriate places in the content using [[POLL1]], [[POLL2]], etc. Provide corresponding questions and options (2-5 options per poll) in the polls array.
      
      Twitter/X Embeds:
      If you find a highly relevant post on the X network (Twitter) to illustrate the article, DO NOT just return the URL. Instead, return it wrapped in this exact HTML format:
      <blockquote class="twitter-tweet"><a href="[INSERT TWEET URL HERE]"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
      
      Include 0-5 credible sources (URLs or references) relevant to the article topic in the sources array, if necessary (ie. jokes, short skits, or others).
      Only select tags from this list: ${JSON.stringify(tags || [])}.
    `.trim()

  return {
    model: aiModel('articleWriter'),
    maxOutputTokens,
    instructions,
    prompt,
    schema: articleSchema,
  } as const;
}

type FinalizeImage = { slot: number; html: string }

export const finalizeArticle = async (object: ArticleObject, onImage?: (image: FinalizeImage) => void) => {
  const generateImageOptions = {
    outputDir: 'article-images',
    filenamePrefix: 'article',
  }

  let articleImageUrl = ''
  if (object.coverImage) {
    if (object.coverImage.type === 'unsplash') {
      const unsplashRes = await fetchUnsplashImage(object.coverImage.query)
      if (unsplashRes) {
        articleImageUrl = unsplashRes.url
      }
    }
    // Fallback or generate
    if (!articleImageUrl) {
      const { url } = await generateImage(object.coverImage.query, generateImageOptions)
      articleImageUrl = url
    }
  } else {
    // Legacy fallback just in case AI omits it
    const { url } = await generateImage(`${object.title} — ${object.perex}`.trim().slice(0, 1024), generateImageOptions)
    articleImageUrl = url
  }

  const buildImageHtml = (url: string, desc: string, attribution: string) =>
    `<p style="text-align: center;"><img src="${url}" alt="${desc}" />${attribution}</p>`

  const generatedImages = await Promise.all(
    object.images.map(async (img, idx) => {
      let html: string
      if (img.type === 'unsplash') {
        const unsplashRes = await fetchUnsplashImage(img.query)
        if (unsplashRes) {
          const attribution = `<br><small style="color: gray;">Zdroj: <a href="${unsplashRes.authorUrl}?utm_source=rasg&utm_medium=referral" target="_blank">${unsplashRes.authorName}</a> na Unsplash</small>`
          html = buildImageHtml(unsplashRes.url, img.query, attribution)
          const image = { slot: idx + 1, html }
          onImage?.(image)
          return image
        }
      }
      // fallback to AI generation
      const { url } = await generateImage(img.query, { ...generateImageOptions, filenameSuffix: idx.toString() })
      html = buildImageHtml(url, img.query, '')
      const image = { slot: idx + 1, html }
      onImage?.(image)
      return image
    }),
  )

  for (const { slot, html } of generatedImages) {
    object.content = object.content.replace(`[[IMAGE${slot}]]`, html)
  }

  if (object.polls) {
    for (const [idx, poll] of object.polls.entries()) {
      const pollId = crypto.randomUUID()
      const optionObjects = poll.options.map((label: string) => ({ label }))
      const escapedOptions = JSON.stringify(optionObjects).replace(/"/g, '&quot;')
      const pollHtml = `<div data-type="poll" data-id="${pollId}" data-question="${poll.question}" data-options="${escapedOptions}"></div>`
      object.content = object.content.replace(`[[POLL${idx + 1}]]`, pollHtml)
    }
  }

  return { ...object, articleImageUrl }
}

export const generateArticle = async (clientSiteId: string, prompt: string) => {
  const config = await buildArticleConfig(clientSiteId, prompt)
  const { object, usage } = await generateObject(config)
  const finalized = await finalizeArticle(object)

  return { ...finalized, usage }
}

export const streamArticle = async (clientSiteId: string, prompt: string, abortSignal?: AbortSignal) => {
  const config = await buildArticleConfig(clientSiteId, prompt)
  const result = streamObject({ ...config, abortSignal })

  return { result, finalize: finalizeArticle }
}
