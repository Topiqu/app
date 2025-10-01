import { generateObject } from 'ai'
import { createXai } from '@ai-sdk/xai'

export default defineLazyEventHandler(() => {
  const apiKey = useRuntimeConfig().xai.apiKey

  const xAI = createXai({ apiKey })

  const schema = z.object({ prompt: z.string().nonempty('Prompt is required') })

  return defineEventHandler(async (event) => {
    const user = (await getServerSession(event))?.user
    if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

    const { prompt } = await readValidatedBody(event, schema.parse)

    const {
      tokenRemaining: maxOutputTokens,
      focus,
      keywords,
      audience,
    } = await prisma.clientSite.findFirstOrThrow({
      select: { tokenRemaining: true, focus: true, keywords: true, audience: true },
      where: { id: user.clientSiteId },
    })
    if (!maxOutputTokens || maxOutputTokens < 0)
      throw createError({ statusCode: 403, statusMessage: 'Insufficient tokens' })

    const system = `
      You are a professional content writer focusing on ${focus || 'common topics'}.
      Write a detailed, well-structured article based on the user prompt aiming on ${audience || 'wide audience'}.
      Use appropriate headings, subheadings, and formatting.
      Respond ONLY in valid JSON format with the structure:
      {
        "title": "catchy title 5-15 words",
        "perex": "short introductory paragraph (3-4 sentences)",
        "content": "article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic for v-html on frontend"
      }.
      The title must be engaging.
      Naturally incorporate keywords if provided.
      ${keywords && `Keywords: ${JSON.stringify(keywords)}`}.
      Write in the language of the prompt or the company's presentation language.
    `.trim()

    const { object, usage } = await generateObject({
      model: xAI('grok-4-fast'),
      maxOutputTokens,
      system,
      prompt,
      providerOptions: {
        xai: {
          searchParameters: {
            mode: user.plan === 'PREMIUM' || (user.plan === 'CUSTOM' && maxOutputTokens > 5000) ? 'on' : 'off',
            maxSearchResults: user.plan === 'PREMIUM' || (user.plan === 'CUSTOM' && maxOutputTokens > 5000) ? 10 : 5,
          },
        },
      },
      schema: z.object({
        title: z.string().min(5).max(100).describe('Catchy title 5-15 words'),
        perex: z.string().min(20).max(300).describe('Short introductory paragraph (3-4 sentences)'),
        content: z
          .string()
          .min(1000)
          .max(20000)
          .describe(
            'Article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic for v-html on frontend',
          ),
      }),
    })

    await prisma.clientSite.update({
      data: { tokenRemaining: { decrement: usage.totalTokens } },
      where: { id: user.clientSiteId },
    })

    await logAction({
      action: 'GENERATE_ARTICLE',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      metadata: { system, object },
      ip: getIp(event),
    })

    return object
  })
})
