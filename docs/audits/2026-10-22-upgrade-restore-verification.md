# Isolated upgrade and restore verification — 2026-10-22

The representative synthetic **120 → 131 migration upgrade and fresh local
dump/restore passed**. All 33 historical fixture rows, their original column
values, and 995 historical index/constraint definitions were preserved. This
verifies the local rehearsal; **no production backup was restored or verified**.

## Verified targets and isolation

- Bun 1.4.4 and PostgreSQL 18 with pgvector in the existing local container
  `topiqu-pgvector-copy-20260926`.
- Upgrade source: newly created `topiqu_upgrade_test_20261022_4fa271b9`.
- Schema-only reconstruction: newly created
  `topiqu_upgrade_schema_test_20261022_4fa271b9`.
- Restored target: newly created
  `topiqu_restore_drill_20261022215104_25ed6b40`.

The private runner required exact database names, explicit confirmation and the
verified container's cluster identifier. Host connections were fixed to
`127.0.0.1:55432`; dump/restore used container loopback. Passwords arrived privately
on stdin or through the container's existing environment, never command arguments
or reports. Child environments excluded provider credentials and automatic `.env`
loading. No application server, scheduler, provider request, mail delivery or
production operation ran. The three test databases were retained.

## Baseline and upgrade provenance

1. The original 120 SQL migrations and schema came from the read-only `a11e5bc4`
   archive, including the user's navigation changes. Baseline/current schema
   preparation used their respective installed ZenStack 3.9.7/3.9.8 SDKs. Every
   original migration name and SHA-256 checksum matched the current history's
   first 120 entries; all 11 additions were separate forward migrations.
2. The archived migration CLI applied the original 120 migrations successfully.
   An initial private seed launch failed; a guarded resume verified the exact
   target, clean 120-entry ledger and absent snapshot before running the unchanged
   archived idempotent demo seed successfully. Synthetic historical records were
   then inserted once. The baseline snapshot covered **75 application tables and
   33 rows**, excluding `_prisma_migrations`.
3. Fixtures included signed and anonymous reactions/feedback/shares, a paid
   historical advertising ledger entry, an indexed catalog product with its
   vector chunk, a legacy verification code, a historical community insight and
   a tokenless LinkedIn company with an uncertain `PUBLISHING` draft. No retained
   advertising functionality or provider integration was activated.
4. The current locked CLI applied all 11 new migrations successfully. Verification
   compared counts and sorted row digests across every original column in every
   historical table; it did not replace the baseline with a post-upgrade snapshot.
   Digest equality is an integrity comparison, not an authenticity guarantee.

| Upgrade check                                   | Result                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Migration history                               | Original 120 checksums unchanged; all 131 applied                 |
| Historical rows                                 | All 75 historical tables and 33 fixture rows preserved            |
| Historical indexes/constraints                  | All 995 definitions preserved, including duplicate multiplicities |
| Reader identity indexes                         | Six unique indexes valid, ready and unique                        |
| Additive claim/publication defaults and staging | Zero violations; staging empty                                    |
| Uncertain publication and advertising history   | Original values preserved                                         |
| Repeat normal migration deploy                  | Exit 0; ledger and historical row digests unchanged               |

## Schema measurement correction

The first private schema comparison reported a mismatch after successful SQL
application. Its `UNION` inherited PostgreSQL's `name` type from
`pg_indexes.indexname`, truncating concatenated constraint identities. A dictionary
then silently collapsed colliding keys. Read-only inspection showed every captured
definition still present and historical row digests unchanged.

The helper now casts identities to `text` and compares full identity/definition-hash
multisets, retaining duplicate counts. Because the initial snapshot had already
lost some colliding entries, it was insufficient evidence for all constraints.
The preserved original 120 SQL files were therefore deployed into the separate
schema-only database using the current locked Prisma 6.19.3 CLI, without the demo
seed. Their checksums were reverified against the original snapshot and current
history before deployment. This independently reconstructed all **995 baseline
objects**, each present in the upgraded database's **1,011 objects**. The archived
source directory had been removed during host disk recovery; its prepared schema,
SQL copies and original data snapshot remained intact. No migration, source data or
original snapshot was rewritten to obtain a passing comparison.

## Fresh dump and restore

The existing [backup verifier](../../scripts/verify-backup-restore.ts) streamed a
custom-format fresh dump directly into `pg_restore --single-transaction` on a new
database. No dump archive or record values were written to the workspace/report.
The run began at `2026-10-22T21:51:04.396Z` and completed successfully in 8,110 ms;
that small-fixture duration is not a production recovery-time measurement.

All 13 verifier checks passed: loopback isolation, source stability, database
settings, table row counts, migration metadata/clean state, columns, constraints,
indexes, functions, triggers, views and extensions. Source and restored inventories
both contained **77 tables and 164 rows**, including 131 migration-ledger rows,
with 1,030 columns, 790 constraints, 221 indexes, 122 functions, four triggers and
three extensions. All 131 migrations were applied; none failed or rolled back.
An additional read-only comparison confirmed that the restored values of every
historical fixture column still matched the original 120-migration snapshot.

## Evidence and limits

Private aggregate reports:

- `/private/tmp/topiqu-upgrade-baseline-20261022.log`: original migration deploy
  succeeded; initial seed launch failed.
- `/private/tmp/topiqu-upgrade-baseline-resume-20261022.log`: successful baseline
  seed, historical fixtures and original data snapshot.
- `/private/tmp/topiqu-upgrade-migrations-20261022.log`: all 11 new migrations
  applied; the original schema-measurement assertion failed.
- `/private/tmp/topiqu-upgrade-inspect-20261022.log`: read-only collision diagnosis.
- `/private/tmp/topiqu-upgrade-schema-baseline-20261022.log`: complete independent
  120-migration schema reconstruction and preservation proof.
- `/private/tmp/topiqu-upgrade-final-20261022.log`: final upgrade/default/index and
  repeat-deploy verification passed.
- `/private/tmp/topiqu-upgrade-restore-20261022.log`: restore and original historical
  row-digest comparisons passed.

The private helper and aggregate snapshots are under
`/private/tmp/topiqu-upgrade-rehearsal-20261022-4fa271b9/`; these host-local paths are
execution evidence, not a durable backup service. No credentials or full records
are stored in those reports/snapshots.

This small synthetic rehearsal does not establish production data-volume timing,
recovery from an older retained/off-site backup, PITR, roles/ACLs, sequence behavior,
independent-host recovery, media-object recovery or restored application behavior.
The operator-controlled [backup/restore runbook](../operations/backup-restore.md),
exact production-target approval and release checks remain required. No production
database change, commit, push or deployment was performed.
