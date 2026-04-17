import { generateText } from 'ai'

import xai from '../ai/xai'

export async function generateContentForTask(topic: string, brandProfile: any) {
  const tone = brandProfile?.tone || 'professional'
  const audience = brandProfile?.audience || 'LinkedIn professionals'
  const doList = brandProfile?.doList?.join(', ') || 'None'
  const dontList = brandProfile?.dontList?.join(', ') || 'None'
  const examples = brandProfile?.examples?.join('\n\n') || 'None'

  const prompt = `
    You are a professional LinkedIn ghostwriter. Write a single text-only LinkedIn post about the following topic:
    Topic: ${topic}

    Brand Voice Guidelines:
    - Tone: ${tone}
    - Audience: ${audience}
    - Do include: ${doList}
    - Do NOT include: ${dontList}

    Example successful posts for reference:
    ${examples}

    Provide only the text of the post. Do not include quotes or surrounding metadata.
  `.trim()

  const { text } = await generateText({
    model: xai('grok-4-1-fast'),
    prompt,
  })

  return text
}
