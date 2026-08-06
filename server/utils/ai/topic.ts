import { generateObject } from 'ai'

export const topicSchema = z.object({
  topic: z
    .string()
    .min(10)
    .max(300)
    .describe("The concrete subject to write about, phrased as one sentence in the client's language."),
  angle: z
    .string()
    .min(10)
    .max(300)
    .describe('What makes this different from the past articles listed — the new question, contrast or perspective.'),
  needsResearch: z
    .boolean()
    .describe(
      'true ONLY when the article depends on facts that change over time: news, prices, releases, statistics, regulation, market data, anything dated or contested. false for evergreen how-tos, opinion, humour, personal essays and general explainers the model already knows well.',
    ),
  searchQuery: z
    .string()
    .max(200)
    .describe('A short English web-search query for this topic. Empty string when needsResearch is false.'),
})

export type ArticleTopic = (typeof topicSchema)['_output']

export type TopicInput = {
  focus?: string | null
  audience?: string | null
  keywords?: string[] | null
  language: string
  recentExcerpts: string[]
  suggestion?: string | null
}

export const buildTopicPrompt = (input: TopicInput) =>
  `
Pick the next article topic for this blog.

Audience: ${input.audience || 'general'}
Focus: ${input.focus || 'general topics'}
Keywords: ${input.keywords?.length ? input.keywords.join(', ') : 'none'}
Language: ${input.language.toUpperCase()}

## ALREADY COVERED — pick something else
${input.recentExcerpts.length ? input.recentExcerpts.map((excerpt) => `- ${excerpt}`).join('\n') : '- nothing yet'}

Similarity means the same topic, argument or thesis — not the same wording. A rephrasing of
anything above is a failure. Your topic must open a question the list leaves unanswered.

## COMMUNITY SIGNAL
${input.suggestion || 'none'}
If present, relevant and not a duplicate of the list above, prefer it.
`.trim()

/**
 * The research step costs a web-search call and ~1200 tokens, so it is opt-in per topic:
 * the picker judges whether the article actually depends on facts that move.
 */
export const researchRequest = (topic: Pick<ArticleTopic, 'needsResearch' | 'searchQuery'>) => {
  const query = topic.searchQuery.trim()
  return topic.needsResearch && query ? { query } : (false as const)
}

export const pickArticleTopic = async (input: TopicInput) => {
  const { object, usage } = await generateObject({
    model: aiModel('topicSelection'),
    maxOutputTokens: 600,
    instructions: `
      You are an editor choosing what a blog should publish next.
      Return the topic and angle in the client's language, but keep searchQuery in English.
      Do not write the article. Return ONLY valid JSON.
    `.trim(),
    prompt: buildTopicPrompt(input),
    schema: topicSchema,
  })

  return { topic: object, usage }
}
