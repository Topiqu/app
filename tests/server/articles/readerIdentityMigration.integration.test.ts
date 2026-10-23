// @vitest-environment node
import { Pool } from 'pg'
import { readFile } from 'node:fs/promises'
import { afterAll, describe, expect, it } from 'vitest'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const pool = enabled ? new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 3000 }) : null
const preflight = readFile(
  new URL('../../../prisma/migrations/20261022120000_reader_identity_uniqueness/migration.sql', import.meta.url),
  'utf8',
)

afterAll(async () => pool?.end())

describe.skipIf(!enabled)('reader identity migration preflight on PostgreSQL', () => {
  for (const table of ['ArticleReaction', 'ArticleFeedback', 'ArticleShare']) {
    for (const identity of ['userId', 'sessionId']) {
      it(`preserves existing duplicate ${table} ${identity} history and refuses an unsafe upgrade`, async () => {
        const client = await pool!.connect()
        try {
          await client.query('BEGIN')
          // Session-local baseline tables shadow the migrated ones without touching application rows.
          for (const name of ['ArticleReaction', 'ArticleFeedback', 'ArticleShare'])
            await client.query(
              `CREATE TEMP TABLE "${name}" ("articleId" text, "userId" text, "sessionId" text, "platform" text) ON COMMIT DROP`,
            )
          await client.query(
            `INSERT INTO "${table}" ("articleId", "${identity}", "platform") VALUES ('article', 'reader', 'OTHER'), ('article', 'reader', 'OTHER')`,
          )
          await client.query('SAVEPOINT preflight')
          await expect(client.query(await preflight)).rejects.toThrow(/Reader identity preflight failed/)
          await client.query('ROLLBACK TO SAVEPOINT preflight')
          const rows = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM "${table}"`)
          expect(rows.rows[0]!.count).toBe(2)
        } finally {
          await client.query('ROLLBACK')
          client.release()
        }
      })
    }
  }

  it('accepts a baseline with distinct authenticated and anonymous identities', async () => {
    const client = await pool!.connect()
    try {
      await client.query('BEGIN')
      for (const name of ['ArticleReaction', 'ArticleFeedback', 'ArticleShare']) {
        await client.query(
          `CREATE TEMP TABLE "${name}" ("articleId" text, "userId" text, "sessionId" text, "platform" text) ON COMMIT DROP`,
        )
        await client.query(
          `INSERT INTO "${name}" ("articleId", "userId", "sessionId", "platform") VALUES ('article', 'user', null, 'OTHER'), ('article', null, 'session', 'OTHER')`,
        )
      }
      await expect(client.query(await preflight)).resolves.toBeDefined()
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
