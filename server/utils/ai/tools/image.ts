import type { Tool } from 'ai'

export const generateImageTool: Tool = {
  id: `internal.image` as `${string}.${string}`,
  name: 'Image',
  description: 'Generate an image based on a given prompt. Input should be a text prompt describing the desired image.',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ prompt: z.string(), url: z.string() }),
  execute: async ({ prompt }) => {
    const url = await generateImage(prompt)
    return { prompt, url }
  },
}
