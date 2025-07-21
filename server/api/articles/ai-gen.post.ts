import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API,
})

export default defineEventHandler(async (event) => {
  const { prompt } = await readBody(event)
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt as string }],
  })
  return completion.choices[0].message.content
})
