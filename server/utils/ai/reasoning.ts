export type ReasoningEffort = 'medium' | 'high' | 'xhigh' | 'max'

/** Each provider reads only its own key. */
export const aiReasoning = (effort: ReasoningEffort) => ({
  openai: { reasoningEffort: effort },
  anthropic: { effort },
})
