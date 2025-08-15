import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const system = `You are a helpful assistant that generates articles based on user prompts.`

export default defineLazyEventHandler(async () => {
  const { apiKey } = useRuntimeConfig().openai

  const OpenAI = createOpenAI({ apiKey })

  const schema = z.object({ prompt: z.string().nonempty('Prompt is required') })

  return defineEventHandler(async (event) => {
    const user = (await getServerSession(event))?.user
    if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

    const { prompt } = await readValidatedBody(event, schema.parse)

    const { tokenRemaining: maxOutputTokens } = await prisma.clientSite.findFirstOrThrow({
      select: { tokenRemaining: true },
      where: { id: user.clientSiteId },
    })
    if (!maxOutputTokens || maxOutputTokens < 0)
      throw createError({ statusCode: 403, statusMessage: 'Insufficient tokens' })

    const { text, usage } = await generateText({ model: OpenAI('gpt-3.5-turbo'), maxOutputTokens, system, prompt })

    await prisma.clientSite.update({
      data: { tokenRemaining: { decrement: usage.totalTokens } },
      where: { id: user.clientSiteId },
    })

    return text
  })
})
