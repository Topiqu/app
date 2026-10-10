/**
 * Reasoning depth for whichever provider the task runs on; each provider reads only its own key.
 * `none` turns Haiku's thinking off, which it accepts only at `high` effort or below.
 */
export const aiReasoning = (effort: 'none' | 'low' | 'medium' | 'high') => ({
  openai: { reasoningEffort: effort },
  anthropic: effort === 'none' ? { thinking: { type: 'disabled' as const }, effort: 'low' as const } : { effort },
})
