import { aiAllowanceMessageKey } from '~~/shared/utils/aiAllowanceError'

export const throwAiAllowanceMessage = (error: unknown, t: (key: string) => string | undefined): never => {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { data?: { code?: unknown }; cause?: unknown; lastError?: unknown }
    if (value.data?.code === 'AI_ALLOWANCE_EXHAUSTED')
      throw createError({ statusCode: 402, message: t(aiAllowanceMessageKey(error)), data: value.data })
    current = value.lastError ?? value.cause
  }
  throw error
}
