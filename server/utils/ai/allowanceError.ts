import { aiAllowanceMessageKey } from '~~/shared/utils/aiAllowanceError'

type Translate = (key: string) => string | undefined

const allowanceData = (error: unknown) => {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { data?: { code?: unknown }; cause?: unknown; lastError?: unknown }
    if (value.data?.code === 'AI_ALLOWANCE_EXHAUSTED') return value.data
    current = value.lastError ?? value.cause
  }
}

export const throwAiAllowanceMessage = (error: unknown, t: Translate): never => {
  const data = allowanceData(error)
  if (data) throw createError({ statusCode: 402, message: t(aiAllowanceMessageKey(error)), data })
  throw error
}

/** The message for an exhausted AI allowance; undefined for any other error. */
export const aiAllowanceMessage = (error: unknown, t: Translate) =>
  allowanceData(error) ? t(aiAllowanceMessageKey(error)) : undefined
