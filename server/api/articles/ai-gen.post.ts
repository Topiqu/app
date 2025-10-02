import { join } from 'path'
import { createXai } from '@ai-sdk/xai'
import { mkdir, writeFile } from 'fs/promises'
import { generateObject, experimental_generateImage as generateImage } from 'ai'

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
        "content": "article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic for v-html on frontend. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear.",
        "images": ["detailed description for IMAGE1", "detailed description for IMAGE2", ...]
      }.
      The title must be engaging.
      Naturally incorporate keywords if provided.
      ${keywords && `Keywords: ${JSON.stringify(keywords)}`}.
      Write in the language of the prompt or the company's presentation language.
      If the article would benefit from visuals, include 1-4 image slots in appropriate places in the content using [[IMAGE1]], [[IMAGE2]], etc. Provide corresponding detailed, vivid descriptions in the images array for AI image generation. Use 0 images if not relevant.
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
        title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
        perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
        content: z
          .string()
          .min(500)
          .max(20000)
          .describe(
            'Article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic for v-html on frontend. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear.',
          ),
        images: z
          .array(z.string().min(10).max(1000).describe('Detailed description for image generation'))
          .describe('Array of image descriptions corresponding to slots in content'),
      }),
    })

    for await (const [idx, img] of object.images.entries()) {
      const { image } = await generateImage({
        model: xAI.image('grok-2-image'),
        prompt: img,
        n: 1,
      })

      const outputDir = 'article-images'
      const filenamePrefix = 'article'
      const filename = `${filenamePrefix}-${Date.now()}.webp`

      const uploadDir = join(process.cwd(), `public/${outputDir}`)
      await mkdir(uploadDir, { recursive: true })
      const filePath = join(uploadDir, filename)
      await writeFile(filePath, image.uint8Array)

      const url = `/${outputDir}/${filename}`

      object.content = object.content.replace(`[[IMAGE${idx + 1}]]`, image ? `<img src="${url}" alt="${img}" />` : '')
    }

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
