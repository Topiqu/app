// Read-only preflight: bun --no-env-file scripts/audit-reader-identities.ts
// The target must be supplied explicitly through TEST_DATABASE_URL or --database-env NAME.
import { Pool } from 'pg'

const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--database-env' || !/^[A-Z_][A-Z0-9_]*$/.test(args[1]!)))
  throw new Error('Usage: bun --no-env-file scripts/audit-reader-identities.ts [--database-env NAME]')
const variable = args[1] ?? 'TEST_DATABASE_URL'
const connectionString = process.env[variable]
if (!connectionString) throw new Error(`Set ${variable} explicitly before running this read-only audit`)

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 30_000 })
try {
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    const result = await client.query<{
      relation: string
      identity: string
      duplicateGroups: number
      excessRows: number
    }>(`
      WITH identities(relation, identity) AS (VALUES
        ('ArticleReaction', 'userId'), ('ArticleReaction', 'sessionId'),
        ('ArticleFeedback', 'userId'), ('ArticleFeedback', 'sessionId'),
        ('ArticleShare', 'userId'), ('ArticleShare', 'sessionId')
      ), groups AS (
        SELECT 'ArticleReaction' AS relation, 'userId' AS identity, count(*) AS rows
        FROM "ArticleReaction" WHERE "userId" IS NOT NULL GROUP BY "articleId", "userId"
        UNION ALL SELECT 'ArticleReaction', 'sessionId', count(*)
        FROM "ArticleReaction" WHERE "sessionId" IS NOT NULL GROUP BY "articleId", "sessionId"
        UNION ALL SELECT 'ArticleFeedback', 'userId', count(*)
        FROM "ArticleFeedback" WHERE "userId" IS NOT NULL GROUP BY "articleId", "userId"
        UNION ALL SELECT 'ArticleFeedback', 'sessionId', count(*)
        FROM "ArticleFeedback" WHERE "sessionId" IS NOT NULL GROUP BY "articleId", "sessionId"
        UNION ALL SELECT 'ArticleShare', 'userId', count(*)
        FROM "ArticleShare" WHERE "userId" IS NOT NULL GROUP BY "articleId", "platform", "userId"
        UNION ALL SELECT 'ArticleShare', 'sessionId', count(*)
        FROM "ArticleShare" WHERE "sessionId" IS NOT NULL GROUP BY "articleId", "platform", "sessionId"
      )
      SELECT identities.relation, identities.identity, count(*) FILTER (WHERE rows > 1)::int AS "duplicateGroups",
             COALESCE(sum(rows - 1) FILTER (WHERE rows > 1), 0)::int AS "excessRows"
      FROM identities LEFT JOIN groups USING (relation, identity)
      GROUP BY identities.relation, identities.identity ORDER BY identities.relation, identities.identity
    `)
    await client.query('COMMIT')
    console.log(JSON.stringify({ mode: 'read-only', groups: result.rows }, null, 2))
    if (result.rows.some((row) => row.duplicateGroups > 0)) process.exitCode = 1
  } finally {
    client.release()
  }
} catch {
  console.error('Reader identity audit failed; no data was changed. Check database access and schema.')
  process.exitCode = 1
} finally {
  await pool.end()
}
