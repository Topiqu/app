import { describe, expect, it, vi } from 'vitest'

import { isRetryableTransactionError, withTransactionRetry } from '../../server/utils/transaction'

describe('transaction retry', () => {
  it('retries PostgreSQL serialization conflicts and returns the replayed result', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ dbErrorCode: '40001' })
      .mockResolvedValue('committed')

    await expect(withTransactionRetry(operation)).resolves.toBe('committed')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('stops after two retries', async () => {
    const conflict = { dbErrorCode: '40P01' }
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(conflict)

    await expect(withTransactionRetry(operation)).rejects.toBe(conflict)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('does not retry unrelated failures', async () => {
    const failure = { dbErrorCode: '23505' }
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(failure)

    expect(isRetryableTransactionError(failure)).toBe(false)
    await expect(withTransactionRetry(operation)).rejects.toBe(failure)
    expect(operation).toHaveBeenCalledOnce()
  })
})
