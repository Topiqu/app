// import OpenAI from 'openai'
// const { openAI } = useRuntimeConfig()

// const openai = new OpenAI({
//   apiKey: openAI,
// })

// export default defineEventHandler(async (event) => {
//   const { prompt } = await readBody(event)
//   const completion = await openai.chat.completions.create({
//     model: 'gpt-3.5-turbo',
//     messages: [{ role: 'user', content: prompt as string }],
//   })
//   return completion.choices[0].message.content
// })
