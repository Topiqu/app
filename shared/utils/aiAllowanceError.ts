import { isInternalAiAllowance } from './billingCatalog'

type AllowanceData = { code: string; kind?: unknown }

/** SDK retries may wrap the original HTTP error; entitlement failures must never degrade quality. */
const allowanceData = (error: unknown): AllowanceData | null => {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { data?: { code?: unknown; kind?: unknown }; cause?: unknown; lastError?: unknown }
    if (
      typeof value.data?.code === 'string' &&
      /^AI_(ALLOWANCE_EXHAUSTED|PLAN_REQUIRED|CONTEXT_REQUIRED|PRICE_REQUIRED)$/.test(value.data.code)
    )
      return value.data as AllowanceData
    current = value.lastError ?? value.cause
  }
  return null
}

export const aiAllowanceErrorCode = (error: unknown): string | null => allowanceData(error)?.code ?? null

export const isAiAllowanceError = (error: unknown): boolean => allowanceData(error) !== null

// The cost guards are never sold or shown, so reaching one reads as a pause, not as a used-up allowance.
export const aiAllowanceMessageKey = (error: unknown) =>
  isInternalAiAllowance(String(allowanceData(error)?.kind))
    ? 'common.aiAllowance.paused'
    : 'common.aiAllowance.exhausted'
