import { describe, expect, it, vi } from 'vitest'

import { isRetryableTransactionError, withTransactionRetry } from '../../server/utils/transaction'

describe('transaction retry', () => {
  it('retries P2034 conflicts and returns the replayed result', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValue('committed')

    await expect(withTransactionRetry(operation)).resolves.toBe('committed')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('stops after two retries', async () => {
    const conflict = { code: 'P2034' }
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(conflict)

    await expect(withTransactionRetry(operation)).rejects.toBe(conflict)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('does not retry unrelated failures', async () => {
    const failure = { code: 'P2002' }
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(failure)

    expect(isRetryableTransactionError(failure)).toBe(false)
    await expect(withTransactionRetry(operation)).rejects.toBe(failure)
    expect(operation).toHaveBeenCalledOnce()
  })
})
