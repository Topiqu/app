/** SDK retries may wrap the original HTTP error; entitlement failures must never degrade quality. */
export const aiAllowanceErrorCode = (error: unknown): string | null => {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { data?: { code?: unknown }; cause?: unknown; lastError?: unknown }
    if (
      typeof value.data?.code === 'string' &&
      /^AI_(ALLOWANCE_EXHAUSTED|PLAN_REQUIRED|CONTEXT_REQUIRED|PRICE_REQUIRED)$/.test(value.data.code)
    )
      return value.data.code
    current = value.lastError ?? value.cause
  }
  return null
}

export const isAiAllowanceError = (error: unknown): boolean => aiAllowanceErrorCode(error) !== null
