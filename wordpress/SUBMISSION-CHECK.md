# Topiqu Sync submission check

Checked on 2026-09-07 with WordPress 7.1, local PHP and SQLite Database Integration, and unmodified Plugin Check 2.1.0.

The final `dist/topiqu-sync.zip` was installed successfully into an isolated WordPress instance. Full Plugin Check was run with its runtime bootstrap enabled:

```text
wp --require=<wordpress>/wp-content/plugins/plugin-check/cli.php plugin check topiqu-sync --format=json
```

Result: **0 errors, 3 performance warnings**, with no checks or result codes suppressed.

## Reviewed warnings

`WordPress.DB.SlowDBQuery.slow_db_query_meta_key` (two occurrences) and `WordPress.DB.SlowDBQuery.slow_db_query_meta_value` (one occurrence), in `includes/class-topiqu-sync.php`.

These flag WordPress metadata queries, not measured query failures. The importer looks up one existing post by the external article ID and lists imported post IDs to reconcile missing articles. They run only during explicit or scheduled synchronization, not on public page requests. The single-article lookup is limited to one ID and reconciliation requests IDs only. These are intentional uses of native WordPress metadata; on very large sites they can still be slow. No performance guarantee or blanket claim of false positives is made.

## Runtime checks

`tests/server/wordpress-runtime.php`, run through WP-CLI on the isolated installation, passed:

- Creating a native WordPress post.
- Removing script tags from imported content.
- Skipping unchanged articles without duplicates.
- Preserving local edits in safe mode.
- Rejecting malformed API responses without drafting published content.
- Blocking a concurrent synchronization worker.
- Drafting missing content after a valid complete empty response.

`php tests/server/wordpress-safety.php` passed malformed/incomplete response, lock ownership/release, HTTPS, and redirect tests.

The earlier Playground attempts failed due to PHP stream limitations. The final result above comes from native PHP and the original, unmodified Plugin Check package.

## Suggested Additional Information

Topiqu Sync imports published articles from the Topiqu hosted service into native WordPress posts. A Topiqu account and API key are required. External requests and the data transmitted are documented in readme.txt, including links to our privacy policy and terms. The plugin contains no paid feature gates or executable code downloads.

Tested with Plugin Check 2.1.0, including runtime checks, on WordPress 7.1. No errors remain. Three general SlowDBQuery warnings concern intentional metadata lookups during manual/cron imports (external article ID lookup and missing-article reconciliation); these do not run on frontend page views.

Final directory acceptance remains subject to the WordPress.org team's manual review. This check does not certify every possible deployment, site size, or remote-service failure mode.
