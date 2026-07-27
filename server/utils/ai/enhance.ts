import { generateText } from 'ai'

export const enhancePrompt = async (prompt: string) => {
  const output = await generateText({
    model: aiModel('promptEnhance'),
    instructions: `
      You are a helpful assistant that enhances user prompts.
      You improve the clarity, detail, and creativity of the prompts while keeping them concise.
    `,
    prompt: prompt.trim(),
  })

  return output
}
