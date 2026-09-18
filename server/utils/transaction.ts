import type appPrisma from './prisma'

type Tx = Parameters<Parameters<typeof appPrisma.$transaction>[0]>[0]

const RETRY_DELAYS_MS = [20, 50] as const

export const isRetryableTransactionError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034'

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
 * deadlock victim can safely replay instead of leaking a transient P2034 to the user. */
export const serializableTransaction = <T>(work: (tx: Tx) => Promise<T>): Promise<T> =>
  withTransactionRetry(() => prisma.$transaction(work, { isolationLevel: 'Serializable' }))
