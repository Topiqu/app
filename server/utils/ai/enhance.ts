import { generateText } from 'ai'

export const enhancePrompt = async (prompt: string) => {
  const output = await generateText({
    model: xai('grok-4-1-fast'),
    system: `
      You are a helpful assistant that enhances user prompts.
      You improve the clarity, detail, and creativity of the prompts while keeping them concise.
    `,
    prompt: prompt.trim(),
  })

  return output
}
