/** Application tasks use medium or high reasoning; each provider reads only its own key. */
export const aiReasoning = (effort: 'medium' | 'high') => ({
  openai: { reasoningEffort: effort },
  anthropic: { effort },
})
