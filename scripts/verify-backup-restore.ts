import { randomUUID } from 'node:crypto'

type ObjectInventory = { count: number; md5: string }
type Inventory = {
  loopback: boolean
  serverMajor: number
  encoding: string
  collation: string
  ctype: string
  tables: ObjectInventory & { rows: string }
  columns: ObjectInventory
  constraints: ObjectInventory
  indexes: ObjectInventory
  functions: ObjectInventory
  triggers: ObjectInventory
  views: ObjectInventory
  extensions: ObjectInventory
  migrations: ObjectInventory & { applied: number; failed: number; rolledBack: number }
}

const usage = `Usage: bun --no-env-file scripts/verify-backup-restore.ts --container NAME --source-db TEST_DATABASE [--apply]

Without --apply, prints a plan and performs no Docker or database operations.
With --apply, streams a fresh dump into a new, uniquely named disposable database.
Only local Docker endpoints and PostgreSQL loopback inside the container are allowed.
The source must have a test, drill or scratch name segment. No target-name override.
No dump file is written; the disposable database is retained for operator review.`

const parseOptions = () => {
  const args = Bun.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage)
    return null
  }
  let container = ''
  let sourceDatabase = ''
  let apply = false
  const seen = new Set<string>()
  for (let index = 0; index < args.length; index++) {
    const option = args[index]!
    if (seen.has(option)) throw new Error('Duplicate option')
    seen.add(option)
    if (option === '--apply') apply = true
    else if (option === '--container' || option === '--source-db') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('Missing option value')
      if (option === '--container') container = value
      else sourceDatabase = value
    } else throw new Error('Unknown option')
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(container)) throw new Error('Invalid container name')
  if (
    !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(sourceDatabase) ||
    !/(?:^|_)(?:test|drill|scratch)(?:_|$)/i.test(sourceDatabase) ||
    /(?:^|_)(?:prod|production)(?:_|$)/i.test(sourceDatabase)
  )
    throw new Error('Source must be an explicitly named local test, drill or scratch database')
  return { container, sourceDatabase, apply }
}

// Only counts and metadata digests leave PostgreSQL. Identifiers in the count queries
// come from pg_catalog and are quoted with format(%I), never from row contents.
// A logical dump removes dropped-column slots; compare live column order rather
// than physical attnum gaps while retaining every column definition property.
const inventorySql = `
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL timezone = 'UTC';
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '10s';
WITH namespaces AS (
  SELECT oid, nspname FROM pg_namespace
  WHERE nspname NOT IN ('pg_catalog', 'information_schema')
    AND nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp_%'
), table_counts AS (
  SELECT format('%I.%I', n.nspname, c.relname) AS identity,
    ((xpath('/row/rows/text()', query_to_xml(
      format('SELECT count(*) AS rows FROM %I.%I', n.nspname, c.relname), false, true, ''
    )))[1]::text)::bigint AS rows
  FROM pg_class c JOIN namespaces n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'm') AND NOT c.relispartition
), schema_objects AS (
  SELECT 'columns' AS kind,
    jsonb_build_array(n.nspname, c.relname,
      row_number() OVER (PARTITION BY c.oid ORDER BY a.attnum), a.attname,
      format_type(a.atttypid, a.atttypmod), a.attnotnull, a.attidentity, a.attgenerated,
      pg_get_expr(d.adbin, d.adrelid), a.attcollation::regcollation::text)::text AS definition
  FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    JOIN namespaces n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p', 'v', 'm')
  UNION ALL
  SELECT 'constraints', jsonb_build_array(n.nspname, c.relname, k.conname,
    pg_get_constraintdef(k.oid, true), k.convalidated)::text
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
    JOIN namespaces n ON n.oid = c.relnamespace
  UNION ALL
  SELECT 'indexes', jsonb_build_array(n.nspname, c.relname,
    pg_get_indexdef(i.indexrelid), i.indisvalid, i.indisready)::text
  FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
    JOIN namespaces n ON n.oid = c.relnamespace
  UNION ALL
  SELECT 'functions', jsonb_build_array(n.nspname, p.proname,
    pg_get_function_identity_arguments(p.oid), pg_get_functiondef(p.oid))::text
  FROM pg_proc p JOIN namespaces n ON n.oid = p.pronamespace WHERE p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'triggers', jsonb_build_array(n.nspname, c.relname, t.tgname,
    pg_get_triggerdef(t.oid, true), t.tgenabled)::text
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN namespaces n ON n.oid = c.relnamespace WHERE NOT t.tgisinternal
  UNION ALL
  SELECT 'views', jsonb_build_array(n.nspname, c.relname, pg_get_viewdef(c.oid, true))::text
  FROM pg_class c JOIN namespaces n ON n.oid = c.relnamespace WHERE c.relkind IN ('v', 'm')
  UNION ALL
  SELECT 'extensions', jsonb_build_array(e.extname, e.extversion, n.nspname)::text
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
), object_inventory AS (
  SELECT kind, json_build_object('count', count(*),
    'md5', md5(coalesce(string_agg(definition, E'\\n' ORDER BY definition), ''))) AS summary
  FROM schema_objects GROUP BY kind
), migrations AS (
  SELECT count(*) AS total,
    count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied,
    count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS failed,
    count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back,
    md5(coalesce(string_agg((to_jsonb(m) - 'logs')::text, E'\\n' ORDER BY id), '')) AS digest
  FROM public._prisma_migrations m
)
SELECT json_build_object(
  'loopback', inet_server_addr() = '127.0.0.1'::inet AND inet_server_port() = 5432,
  'serverMajor', current_setting('server_version_num')::integer / 10000,
  'encoding', pg_encoding_to_char(db.encoding), 'collation', db.datcollate, 'ctype', db.datctype,
  'tables', (SELECT json_build_object('count', count(*), 'rows', coalesce(sum(rows), 0)::text,
    'md5', md5(coalesce(string_agg(jsonb_build_array(identity, rows)::text, E'\\n' ORDER BY identity), '')))
    FROM table_counts),
  'columns', coalesce((SELECT summary FROM object_inventory WHERE kind = 'columns'), '{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"}'::json),
  'constraints', coalesce((SELECT summary FROM object_inventory WHERE kind = 'constraints'), '{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"}'::json),
  'indexes', coalesce((SELECT summary FROM object_inventory WHERE kind = 'indexes'), '{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"}'::json),
  'functions', coalesce((SELECT summary FROM object_inventory WHERE kind = 'functions'), '{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"}'::json),
  'triggers', coalesce((SELECT summary FROM object_inventory WHERE kind = 'triggers'), '{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"}'::json),
  'views', coalesce((SELECT summary FROM object_inventory WHERE kind = 'views'), '{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"}'::json),
  'extensions', coalesce((SELECT summary FROM object_inventory WHERE kind = 'extensions'), '{"count":0,"md5":"d41d8cd98f00b204e9800998ecf8427e"}'::json),
  'migrations', (SELECT json_build_object('count', total, 'applied', applied, 'failed', failed,
    'rolledBack', rolled_back, 'md5', digest) FROM migrations)
)
FROM pg_database db WHERE db.datname = current_database();
COMMIT;
`

const containerScript = `
set -euo pipefail
umask 077
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=postgres PGSSLMODE=disable PGCONNECT_TIMEOUT=10
export PGCLIENTENCODING=UTF8 PGAPPNAME=topiqu-restore-drill
export PGUSER="\${POSTGRES_USER:-postgres}" PGPASSWORD="\${POSTGRES_PASSWORD:-}"
source_db="$1"
target_db="$2"
read -r -d '' inventory_sql <<'TOPIQU_INVENTORY_SQL' || true
${inventorySql}
TOPIQU_INVENTORY_SQL
inventory() {
  psql --no-psqlrc --quiet --tuples-only --no-align --no-password --set ON_ERROR_STOP=1 --dbname="$1" --command="$inventory_sql"
}
printf '%s\\n' '{"stage":"source-before"}'
inventory "$source_db"
printf '%s\\n' '{"stage":"create-target"}'
createdb --no-password --template=template0 -- "$target_db"
printf '%s\\n' '{"stage":"dump-restore"}'
pg_dump --no-password --format=custom --no-owner --no-privileges --lock-wait-timeout=10000 --dbname="$source_db" |
  pg_restore --no-password --no-owner --no-privileges --exit-on-error --single-transaction --dbname="$target_db"
printf '%s\\n' '{"stage":"source-after"}'
inventory "$source_db"
printf '%s\\n' '{"stage":"target-inventory"}'
inventory "$target_db"
printf '%s\\n' '{"stage":"complete"}'
`

const main = async () => {
  let options: ReturnType<typeof parseOptions>
  try {
    options = parseOptions()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid options')
    console.error(usage)
    process.exitCode = 1
    return
  }
  if (!options) return

  const startedAt = new Date()
  const targetDatabase = `topiqu_restore_drill_${startedAt.toISOString().replace(/\D/g, '').slice(0, 14)}_${randomUUID().slice(0, 8)}`
  const report = {
    schemaVersion: 1,
    mode: options.apply ? 'apply' : 'dry-run',
    status: options.apply ? 'failed' : 'planned',
    container: options.container,
    sourceDatabase: options.sourceDatabase,
    targetDatabase,
    targetCreated: false,
    targetRetained: false,
    startedAt: startedAt.toISOString(),
    durationMs: 0,
    backup: { format: 'custom', storage: 'stream', persisted: false },
    stage: options.apply ? 'local-docker-check' : 'plan',
    source: null as Inventory | null,
    restored: null as Inventory | null,
    verification: null as Record<string, boolean> | null,
    failure: null as string | null,
  }

  if (options.apply) {
    try {
      if (options.sourceDatabase === targetDatabase) throw new Error('Source and target must differ')
      const dockerHost = process.env.DOCKER_HOST
      if (dockerHost && !dockerHost.startsWith('unix://')) throw new Error('Only local Docker sockets are allowed')
      const context = Bun.spawn(['docker', 'context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], {
        stdout: 'pipe',
        stderr: 'ignore',
      })
      const [endpoint, contextExit] = await Promise.all([new Response(context.stdout).text(), context.exited])
      if (contextExit !== 0 || !/^"unix:\/\//.test(endpoint.trim()))
        throw new Error('A local Unix-socket Docker context is required')

      const child = Bun.spawn(
        [
          'docker',
          'exec',
          '-i',
          options.container,
          'bash',
          '--noprofile',
          '--norc',
          '-s',
          '--',
          options.sourceDatabase,
          targetDatabase,
        ],
        { stdin: new Blob([containerScript]), stdout: 'pipe', stderr: 'ignore' },
      )
      const [output, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited])
      const inventories = new Map<string, Inventory>()
      for (const line of output.split('\n').filter((line) => line.trim())) {
        const entry = JSON.parse(line) as Inventory | { stage: string }
        if ('stage' in entry) report.stage = entry.stage
        else inventories.set(report.stage, entry)
        if (report.stage === 'dump-restore') report.targetCreated = report.targetRetained = true
      }
      if (exitCode !== 0) throw new Error('Docker/PostgreSQL command failed; raw stderr withheld to protect data')
      const before = inventories.get('source-before')
      const after = inventories.get('source-after')
      const restored = inventories.get('target-inventory')
      if (!before || !after || !restored) throw new Error('Incomplete verification output')
      report.source = before
      report.restored = restored
      report.verification = {
        loopbackOnly: before.loopback && after.loopback && restored.loopback,
        sourceStable: JSON.stringify(before) === JSON.stringify(after),
        databaseSettingsMatch:
          before.serverMajor === restored.serverMajor &&
          before.encoding === restored.encoding &&
          before.collation === restored.collation &&
          before.ctype === restored.ctype,
        rowCountsMatch: JSON.stringify(before.tables) === JSON.stringify(restored.tables),
        migrationsMatch: JSON.stringify(before.migrations) === JSON.stringify(restored.migrations),
        migrationStateClean: restored.migrations.applied > 0 && restored.migrations.failed === 0,
        ...Object.fromEntries(
          (['columns', 'constraints', 'indexes', 'functions', 'triggers', 'views', 'extensions'] as const).map(
            (kind) => [`${kind}Match`, JSON.stringify(before[kind]) === JSON.stringify(restored[kind])],
          ),
        ),
      }
      if (!Object.values(report.verification).every(Boolean)) throw new Error('Aggregate verification failed')
      report.status = 'passed'
    } catch (error) {
      report.failure = error instanceof Error ? error.message : 'Restore drill failed'
      process.exitCode = 1
    }
  }
  report.durationMs = Date.now() - startedAt.getTime()
  console.log(JSON.stringify(report, null, 2))
}

await main()
