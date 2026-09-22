import { TransactionIsolationLevel } from '@zenstackhq/orm'

import type { DatabaseTransaction } from './database'

import { databaseErrorCode } from './databaseError'

type Tx = DatabaseTransaction

const RETRY_DELAYS_MS = [20, 50] as const

export const isRetryableTransactionError = (error: unknown): boolean =>
  ['40001', '40P01'].includes(databaseErrorCode(error) ?? '')

export const withTransactionRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const baseDelay = RETRY_DELAYS_MS[attempt]
      if (!isRetryableTransactionError(error) || baseDelay === undefined) throw error
      const delayWithJitter = baseDelay + Math.floor(Math.random() * baseDelay)
      await new Promise((resolve) => setTimeout(resolve, delayWithJitter))
    }
  }
}

/** Serializable plan/feature writes are short and idempotent, so a database-selected
 * conflict victim can safely replay instead of leaking a transient PostgreSQL error. */
export const serializableTransaction = <T>(work: (tx: Tx) => Promise<T>): Promise<T> =>
  withTransactionRetry(() => prisma.$transaction(work, { isolationLevel: TransactionIsolationLevel.Serializable }))
