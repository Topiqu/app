import { createOpenAI } from '@ai-sdk/openai'
import { generateText, generateImage } from 'ai'

import { AI_MODELS, AI_IMAGE_MODELS } from '../server/utils/ai/modelRegistry'

const apiKey = process.env.OPENAI_API_KEY || process.env.NUXT_OPEN_AI_API_KEY
if (!apiKey) {
  console.error('Chybi OPENAI_API_KEY (nebo NUXT_OPEN_AI_API_KEY) v env.')
  process.exit(1)
}

const openAi = createOpenAI({ apiKey })
const textId = AI_MODELS.articleWriter.id
const researchId = AI_MODELS.articleResearch.id
const imageId = AI_IMAGE_MODELS.articleImage.id

let failures = 0

const step = async (label: string, fn: () => Promise<string>) => {
  const started = Date.now()
  try {
    const detail = await fn()
    console.log(`  OK   ${label} (${Date.now() - started} ms) — ${detail}`)
  } catch (e: any) {
    failures++
    console.log(`  FAIL ${label} (${Date.now() - started} ms)`)
    console.log(`       ${e?.name ?? 'Error'}: ${e?.message ?? e}`)
    if (e?.statusCode) console.log(`       statusCode: ${e.statusCode}`)
  }
}

console.log(`Registry: text=${textId} research=${researchId} image=${imageId}\n`)

await step(`text generation (${textId})`, async () => {
  const { text, usage } = await generateText({
    model: openAi(textId),
    prompt: 'Reply with exactly one word: OK',
    maxOutputTokens: 20,
  })
  return `odpoved "${text.trim().slice(0, 40)}", tokeny ${usage.totalTokens}`
})

await step(`web search grounding (${researchId})`, async () => {
  const { text, usage } = await generateText({
    model: openAi(researchId),
    instructions: 'Search the live web. Return one verified fact and the full URL you retrieved it from.',
    prompt: 'What is the latest stable Nuxt major version?',
    maxOutputTokens: 600,
    tools: { web_search: openAi.tools.webSearch({ searchContextSize: 'high' }) },
  })
  const hasUrl = /https?:\/\//.test(text)
  if (!hasUrl)
    throw new Error(`odpoved neobsahuje zadnou URL — grounding pravdepodobne neprobehl:\n${text.slice(0, 300)}`)
  return `vratil URL, tokeny ${usage.totalTokens}`
})

await step(`image generation (${imageId}, quality medium)`, async () => {
  const out = await generateImage({
    model: openAi.image(imageId),
    prompt: 'A minimal flat illustration of a blue paper airplane on a light background',
    providerOptions: { openai: { quality: 'medium' } },
  })
  return `${out.image.mediaType}, ${(out.image.uint8Array.byteLength / 1024).toFixed(0)} kB`
})

console.log(failures === 0 ? '\nVsechny kroky prosly.' : `\n${failures} krok(u) selhalo.`)
process.exit(failures === 0 ? 0 : 1)
