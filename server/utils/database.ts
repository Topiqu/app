import { Pool } from 'pg'
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres'
import { ZenStackClient, type TransactionClientContract } from '@zenstackhq/orm'

import { schema } from '../../generated/zenstack/schema'

const poolMax = () => {
  const value = Number(process.env.PGPOOL_MAX || 10)
  if (!Number.isSafeInteger(value) || value < 1 || value > 100)
    throw new Error('PGPOOL_MAX must be an integer from 1 to 100')
  return value
}

export const createDatabaseClient = (connectionString = process.env.DATABASE_URL) =>
  new ZenStackClient(schema, {
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: poolMax(),
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 30_000,
      }),
    }),
  })

export type DatabaseClient = ReturnType<typeof createDatabaseClient>
export type DatabaseTransaction = TransactionClientContract<
  typeof schema,
  DatabaseClient['$options'],
  Record<never, never>,
  Record<never, never>
>
