# Backup and restore verification

The local drill is an operator tool for a quiet, disposable PostgreSQL test source. It
does not configure scheduled production backups or restore into an existing database.
Identify the source, obtain the applicable approval and keep the report with the
release or recovery record before changing any production state.

## Local rehearsal

Requirements: the repository's pinned Bun, a local Unix-socket Docker context and an
already running PostgreSQL container containing Bash, `psql`, `createdb`, `pg_dump`
and `pg_restore`. The container must hold the development/test source and the required
extensions, including pgvector. No host PostgreSQL client or dependency install is
needed. Stop application processes that write to the source for the duration.

Preview the plan; this makes no Docker or database calls:

```sh
bun --no-env-file scripts/verify-backup-restore.ts \
  --container topiqu-pgvector-copy-20260926 \
  --source-db topiqu_preferences_test
```

After reviewing that exact local source, perform the rehearsal explicitly:

```sh
bun --no-env-file scripts/verify-backup-restore.ts \
  --container topiqu-pgvector-copy-20260926 \
  --source-db topiqu_preferences_test \
  --apply
```

The CLI accepts only container/database names, not connection URLs or credentials.
The source must contain a `test`, `drill` or `scratch` underscore-delimited segment;
`prod`/`production` segments are rejected. Naming is an accident guard, not proof that
the database is safe: independently verify the named container and source. Remote
Docker contexts and TCP Docker endpoints are rejected. PostgreSQL connections are
forced to `127.0.0.1:5432` inside the container. Container `POSTGRES_USER` and
`POSTGRES_PASSWORD` supply authentication silently; the script does not load `.env`,
print credentials or put passwords into process arguments. `--no-env-file` also
disables Bun's automatic environment-file loading.

Apply mode performs these steps:

1. Reads aggregate row counts and schema/migration metadata from the source in a
   read-only transaction.
2. Generates a unique `topiqu_restore_drill_<UTC timestamp>_<random suffix>` database
   name and creates it from `template0`. There is no target-name option, `--clean`,
   overwrite, migration application or database deletion. An existing-name collision
   fails before restoration.
3. Pipes a custom-format `pg_dump` directly into `pg_restore` inside the container.
   The restore uses one transaction and fails on the first error; Bash `pipefail`
   also catches a failing dump. No archive or private row content is written to the
   workspace, terminal or report.
4. Reads the source again and compares it with the restored target. Checks include
   exact per-table row-count digests and total rows; migration metadata and absence
   of unresolved failed migrations; columns/defaults; constraints; indexes;
   functions/procedures; user triggers and their enabled state; views; extension
   versions; and database encoding/collation. Partition parents are counted once,
   including their partitions. Materialized-view row counts are included. Column
   checks preserve live column order and definitions; dropped physical column slots
   are ignored because a logical dump removes those storage-history gaps.

The disposable target is retained after success or failure. The tool never drops a
database. The JSON report identifies the exact target and whether creation succeeded;
inspect it before any separately authorized cleanup. Do not point a running app,
worker or migration process at the restored database during verification.

## Report and acceptance

The command exits `0` for a preview or a successful verification and `1` for invalid
options, command failures or mismatches. Normal output is one JSON object:

- `schemaVersion`, `mode`, `status`, `stage`, `startedAt`, `durationMs`;
- `container`, `sourceDatabase`, generated `targetDatabase`, `targetCreated`,
  `targetRetained`;
- `backup`: custom format, streamed storage, `persisted: false`;
- `source` and `restored`: aggregate counts/digests, PostgreSQL major version,
  loopback check, encoding/collation and migration-state counts;
- `verification`: one boolean per comparison, or `null` during a preview;
- `failure`: a safe diagnostic or `null`. Raw Docker/PostgreSQL stderr is withheld
  because constraint and restore errors can contain private row values.

Accept the rehearsal only when `status` is `passed` and every verification boolean
is true. A changed source invalidates the comparison; stop writers and rerun against
a new target. Investigate a failing stage using private operator tooling without
pasting raw database records or credentials into tickets or chat.

Counts and metadata digests do not compare every restored value, exercise sequence
allocation or prove application behavior. MD5 here is a metadata equality check,
not an authenticity or encryption mechanism. The drill streams a fresh local dump;
it does not verify an older retained backup, off-site retrieval, PITR, owners/ACLs,
global roles, tablespaces, server configuration, S3 objects or an independent-host
recovery. Ownership and grants are deliberately not restored. Foreign-table contents
are outside the check. Do not present a successful local drill as production recovery
readiness.

## Production recovery procedure

1. **Set the recovery contract.** Record the exact production instance, owners,
   recovery point objective (acceptable lost writes), recovery time objective,
   retention and escalation contacts. Inventory PostgreSQL/pgvector versions,
   application image, migration history and external storage. Do not claim an RPO
   or RTO that has not been measured.
2. **Maintain recoverable backups.** Configure provider-managed physical backups and
   continuous WAL archival/PITR where available, plus the logical backups needed by
   the recovery plan. Store encrypted backups in a separate access-controlled
   account/location with tested retention and deletion protection. Separate key
   access from backup access; monitor failures, backup age and WAL continuity.
   Back up required cluster roles/configuration separately. This repository does
   not provision any of these services.
3. **Rehearse the retained artifact.** With explicit approval, retrieve and decrypt
   a specific retained backup into a separate isolated restore environment. Verify
   artifact integrity and available keys, use a compatible PostgreSQL major version
   and required extensions, and restore only into a newly provisioned database or
   cluster. Perform the provider's documented point-in-time recovery procedure when
   testing PITR. Never experiment on the live target or overwrite a database merely
   because its name resembles a restore target.
4. **Keep the restored app isolated.** Restored data includes OAuth/session tokens,
   billing state, queued publications and scheduled work. Restrict network egress,
   withhold live AI/Stripe/email/OAuth/Shopify/LinkedIn/DNS provider credentials and
   disable cron, background workers, webhook consumers and automatic publication
   before any app starts. Reconcile session/token handling with the incident plan.
   Do not rely on a UI switch to prevent outbound work. The local drill starts no
   application or jobs; production isolation is an operator responsibility.
5. **Verify data and application health.** Compare aggregate table/migration counts,
   schema constraints/functions/triggers, extension versions, audit-chain continuity
   and the intended recovery timestamp. Review unresolved migrations and validate
   required ownership, grants and sequences. Run read-only health/login/tenant
   isolation/article rendering checks against the isolated app and verify media
   retrieval. Use synthetic identities rather than exposing customer records.
   Record actual elapsed restore time and the recovered point. Application startup
   applies migrations automatically in Docker, so choose the matching image and
   review schema compatibility before allowing startup.
6. **Approve cutover separately.** Plan maintenance or write quiescence, final backup,
   provider/queue reconciliation, runtime connection changes, health checks and a
   rollback/forward-fix decision. Restoring the database does not roll back Stripe,
   sent email, published social posts or other external effects. Switching live
   connections, applying migrations and re-enabling jobs require explicit production
   authorization. Retain the previous database and recovery evidence according to
   the approved retention policy.

PostgreSQL backups contain media references and rights metadata, not the S3 objects
themselves. Define separate object-storage versioning/backup and retention, preserve
encryption-key access and reconcile database references with the recovered object
versions. Restore testing must include both stores before declaring media recovered.

PostgreSQL documents the archive and transaction behavior in
[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) and
[pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html). Use the actual
database provider's current backup/PITR instructions for production recovery.
