# WordPress/MySQL runtime verification — 2026-10-22

CQ-32/33/34 passed on an actual, disposable WordPress/MySQL runtime: **32 native
behavior assertions plus one aggregate PASS (33 PASS lines), all three suites
successful, runner exit 0**. This complements the existing standalone PHP/SQLite
fixtures; it does not claim coverage of every supported WordPress/PHP combination.

## Verified target

| Component | Actual version | Official image tag              |
| --------- | -------------- | ------------------------------- |
| WordPress | 7.1.3          | `wordpress:7.1.3-php8.3-apache` |
| WP-CLI    | 2.12.0         | `wordpress:cli-2.12.0-php8.3`   |
| PHP       | 8.3.36         | CLI image above                 |
| MySQL     | 8.4.13         | `mysql:8.4.13`                  |

The [official WordPress](https://hub.docker.com/_/wordpress) and
[MySQL](https://hub.docker.com/_/mysql) tags were verified before execution. The
pulled image digests, in table order excluding PHP, were:

- WordPress: `sha256:d42f63cb89ad0eab272c4b393164e63830d0df270009907919f7dcce52b1a20b`
- WP-CLI: `sha256:661db880e953da051abcac6c0a769767b995a82cd52101c003ca7438dd427d7d`
- MySQL: `sha256:76f0358884cb92d9a086d24e5671c38048d3fef40f2588703d73eb55392d6b69`

## Native checks

- Existing `tests/server/wordpress-runtime.php`: 11 assertions covering source
  confirmation, native post import, sanitization, unchanged-revision idempotency,
  safe-mode local edits, malformed-response preservation, mutual exclusion,
  complete-scan reconciliation and source-switch isolation.
- Extended native MySQL suite: 14 assertions covering 251-row keyset
  reconciliation; 200 imported articles across two pages with exactly two batched
  identity queries; unchanged repeat scans; custom excluded post statuses;
  resumable legacy adoption of 650 rows as 500 then 150 while preserving rights
  metadata and blocking imports during incomplete adoption; same-second heartbeat
  CAS; explicit stale-owner recovery; and fencing old-owner cleanup/resumed work.
- Actual process crash/recovery: seven assertions after `docker kill --signal KILL`
  terminated a worker holding the native durable lock. Owner evidence survived;
  fresh recovery and automatic takeover were refused; a wrong-owner recovery was
  refused; verified stale-owner recovery admitted a new worker, which heartbeated
  and released its own lock. Only the isolated fixture heartbeat was aged to avoid
  waiting the full stale interval.

## Isolation and cleanup

The private runner created a random, uniquely labeled Docker `--internal` network,
two new volumes, one MySQL container and ephemeral WP-CLI containers. It rejected
pre-existing target names and required a local Unix-socket Docker endpoint. No
ports were published. The Apache image only copied pristine core files; Apache
never started. No existing WordPress files, configuration, credentials or database
were mounted or reused. Only the repository plugin and synthetic PHP fixtures
were mounted read-only; generated WordPress configuration and secret files were
private to this fixture. WP-CLI ran as root only inside these throwaway containers.

Cron, updates and file modifications were disabled. A mandatory early WordPress
filter denied every outgoing HTTP request and mail delivery; the runner verified
those denials before later fixture filters supplied synthetic API responses.
There were no live Topiqu/provider requests, outgoing mail or production data
changes. Credentials were generated only for the disposable target and deleted;
installation prompt output is suppressed by the private helper.

Cleanup checked exact names and ownership labels before removing the worker and
MySQL containers, both volumes and the internal network. Ephemeral CLI/seed
containers removed themselves. Image cache was retained; no Docker prune or
unrelated resource removal ran.

Private execution evidence: `/private/tmp/topiqu-wordpress-mysql-20261022.log`.
The helper and companion fixtures remain under `/private/tmp/topiqu-wordpress-*`
for review, without credentials. This audit added no application dependency,
persisted service, schema change or production operation.
