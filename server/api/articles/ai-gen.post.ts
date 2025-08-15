import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const system = `You are a helpful assistant that generates articles based on user prompts.`

export default defineLazyEventHandler(async () => {
  const apiKey = useRuntimeConfig().openAI

  const OpenAI = createOpenAI({ apiKey })

  const schema = z.object({ prompt: z.string().nonempty('Prompt is required') })

  return defineEventHandler(async (event) => {
    const user = (await getServerSession(event))?.user
    if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

    const { prompt } = await readValidatedBody(event, schema.parse)

    const { text } = await generateText({ maxOutputTokens: 10000, model: OpenAI('gpt-3.5-turbo'), system, prompt })

    return text
  })
})
