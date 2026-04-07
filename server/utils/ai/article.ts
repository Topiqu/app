import { generateObject } from 'ai'

export const generateArticle = async (clientSiteId: string, prompt: string) => {
  const { tokenRemaining, plan, focus, keywords, audience, tags, aiToneOfVoice, aiControversyLevel } =
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

  const system = `
      You are a professional content writer focusing on ${focus || 'common topics'}.
      Write a detailed, well-structured article based on the user prompt aiming on ${audience || 'wide audience'}.
      Use appropriate headings, subheadings, and formatting.
      ${aiToneOfVoice ? `Write in the following tone of voice: ${aiToneOfVoice}.` : ''}
      ${controversyPrompt}
      Respond ONLY in valid JSON format with the structure:
      {
        "title": "catchy title 5-15 words",
        "perex": "short introductory paragraph (3-4 sentences)",
        "content": "article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic for v-html on frontend. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear.",
        "images": ["detailed description for IMAGE1", "detailed description for IMAGE2", ...],
        "tags": ["ID's of relevant tags from the provided tags list, up to 5, that best fit the article topic"],
        "sources": ["source URL or reference 1", "source URL or reference 2", ...]
      }.
      The title must be engaging.
      Naturally incorporate keywords if provided.
      ${keywords && `Keywords: ${JSON.stringify(keywords)}`}.
      Write in the language of the prompt or the company's presentation language.
      If the article would benefit from visuals, include 1-4 image slots in appropriate places in the content using [[IMAGE1]], [[IMAGE2]], etc. Provide corresponding detailed, vivid descriptions in the images array for AI image generation. Use 0 images if not relevant.
      Include 0-5 credible sources (URLs or references) relevant to the article topic in the sources array, if necessary (ie. jokes, short skits, or others).
      Only select tags from this list: ${JSON.stringify(tags || [])}.
    `.trim()

  const { object, usage } = await generateObject({
    model: xai('grok-4-1-fast'),
    maxOutputTokens,
    system,
    prompt,
    providerOptions: {
      xai: {
        searchParameters: {
          mode: plan === 'PREMIUM' || (plan === 'CUSTOM' && maxOutputTokens > 5000) ? 'on' : 'off',
          maxSearchResults: plan === 'PREMIUM' || (plan === 'CUSTOM' && maxOutputTokens > 5000) ? 10 : 5,
        },
      },
    },
    schema: z.object({
      title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
      perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
      content: z
        .string()
        .min(500)
        .max(20000)
        .describe(
          'Article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic, you can also add <br> tags at the end of each section/paragraph for v-html on frontend. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear.',
        ),
      images: z
        .array(z.string().min(10).max(1000).describe('Detailed description for image generation'))
        .describe('Array of image descriptions corresponding to slots in content'),
      tags: z
        .array(z.string())
        .max(5)
        .describe("ID's of relevant tags from the provided tags list that best fit the article topic"),
      sources: z
        .array(z.string().min(1).max(1000).describe('Source URL or reference'))
        .max(5)
        .describe('Array of credible sources relevant to the article topic'),
    }),
  })

  const generateImageOptions = {
    outputDir: 'article-images',
    filenamePrefix: 'article',
  }

  const { url: articleImageUrl } = await generateImage(
    `${object.title} — ${object.perex}`.trim().slice(0, 1024),
    generateImageOptions,
  )

  const generatedImages = await Promise.all(
    object.images.map(async (img, idx) => {
      const { url } = await generateImage(img, { ...generateImageOptions, filenameSuffix: idx.toString() })
      return { url, desc: img }
    }),
  )

  for (const [idx, { url, desc }] of generatedImages.entries()) {
    object.content = object.content.replace(
      `[[IMAGE${idx + 1}]]`,
      `<p style="text-align: center;"><img src="${url}" alt="${desc}" /></p>`,
    )
  }

  return { ...object, articleImageUrl, usage }
}
