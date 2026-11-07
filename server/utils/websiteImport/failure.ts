import { APICallError } from 'ai'

/**
 * `retry` marks failures that did no paid provider work: funding waits for the blog's budget,
 * an overloaded provider is tried again within the attempt cap. Everything else ends the import.
 */
export const websiteFailure = (error: unknown): { code: string; retry: 'funding' | 'overloaded' | null } => {
  const code = (error as { data?: { code?: unknown } } | null)?.data?.code
  if (code === 'AI_PLAN_REQUIRED' || code === 'AI_ALLOWANCE_EXHAUSTED') return { code, retry: 'funding' }
  const name = (error as { name?: unknown } | null)?.name
  if (name === 'TimeoutError' || name === 'AbortError') return { code: 'PROVIDER_TIMEOUT', retry: null }
  if (!APICallError.isInstance(error)) return { code: 'PROCESSING_FAILED', retry: null }
  const status = error.statusCode ?? 0
  if (status === 429 || status === 529) return { code: 'PROVIDER_OVERLOADED', retry: 'overloaded' }
  if (status >= 400 && status < 500) return { code: 'PROVIDER_REJECTED', retry: null }
  return { code: 'PROVIDER_FAILED', retry: null }
}
