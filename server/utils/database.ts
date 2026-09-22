import { Pool } from 'pg'
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres'
import { ZenStackClient, type TransactionClientContract } from '@zenstackhq/orm'

import { schema } from '../../generated/zenstack/schema'

export const createDatabaseClient = (connectionString = process.env.DATABASE_URL) =>
  new ZenStackClient(schema, {
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
  })

export type DatabaseClient = ReturnType<typeof createDatabaseClient>
export type DatabaseTransaction = TransactionClientContract<
  typeof schema,
  DatabaseClient['$options'],
  Record<never, never>,
  Record<never, never>
>
