/** Presets for the generation brief. `questions` asks the author instead of inventing their facts. */
export const PROMPT_EDIT_ACTIONS = ['questions', 'sharpen', 'shorten', 'grammar'] as const
export type PromptEditAction = (typeof PROMPT_EDIT_ACTIONS)[number]

/** Presets for a selected passage of the article body. None of them may add facts. */
export const TEXT_EDIT_ACTIONS = ['grammar', 'shorten', 'simplify', 'formal', 'friendly', 'expand'] as const
export type TextEditAction = (typeof TEXT_EDIT_ACTIONS)[number]

export const TEXT_EDIT_MAX_LENGTH = 8000
