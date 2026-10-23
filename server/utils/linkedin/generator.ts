import { generateText } from 'ai'

import { aiModel } from '../ai/models'
import { aiReasoning } from '../ai/reasoning'
import { readCommunityInsight } from '../community'

export async function generateContentForTask(
  topic: string,
  voice: { tone: string | null; audience: string | null },
  communityInsight?: unknown,
) {
  const tone = voice.tone || 'professional'
  const audience = voice.audience || 'LinkedIn professionals'

  const insight = readCommunityInsight(communityInsight)
  const communityPrompt = insight
    ? `\n    Community Insights to consider:\n    - Audience mood summary: ${insight.summary}\n    - Frequently discussed points: ${insight.topPoints.join(', ')}\n    Ensure the post subtly addresses or acknowledges these current community feelings and discussion points where relevant.`
    : ''

  const prompt = `
    You are a professional LinkedIn ghostwriter. Write a single text-only LinkedIn post about the following topic:
    Topic: ${topic}

    Brand Voice Guidelines:
    - Tone: ${tone}
    - Audience: ${audience}${communityPrompt}

    Provide only the text of the post. Do not include quotes or surrounding metadata.
  `.trim()

  const { text } = await generateText({
    model: aiModel('linkedinPost'),
    providerOptions: aiReasoning('medium'),
    prompt,
  })

  return text
}
