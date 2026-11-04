export const throwAiAllowanceMessage = (error: unknown, message: string): never => {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { data?: { code?: unknown }; cause?: unknown; lastError?: unknown }
    if (value.data?.code === 'AI_ALLOWANCE_EXHAUSTED') throw createError({ statusCode: 402, message, data: value.data })
    current = value.lastError ?? value.cause
  }
  throw error
}
