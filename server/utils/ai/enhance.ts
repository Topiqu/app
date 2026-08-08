import { generateText } from 'ai'

/**
 * Expands a terse article topic into a fuller brief. Returns `usage` because every other AI
 * call on this platform is billed through `consumeClientTokens` and this one must be too.
 */
export const enhancePrompt = async (prompt: string) => {
  const { text, usage } = await generateText({
    model: aiModel('promptEnhance'),
    instructions: `
      You sharpen an article topic into a brief the writer can act on.
      Add the angle, the audience and two or three concrete points worth covering.
      Keep it under 60 words, keep it a brief — never write the article itself.
      Answer in the same language as the input, and return the brief alone, with no preamble.
    `,
    prompt: prompt.trim(),
  })

  return { text: text.trim(), usage }
}
