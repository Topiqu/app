=== Topiqu Sync ===
Contributors: topiqu
Tags: topiqu, articles, import, synchronization
Requires at least: 6.5
Requires PHP: 8.0
Stable tag: 0.1.0
License: GPLv2 or later

Synchronizes published Topiqu articles into native WordPress posts.

== Installation ==

1. Upload the `topiqu-sync` directory or install the ZIP in Plugins > Add New > Upload Plugin.
2. Activate Topiqu Sync.
3. Open Settings > Topiqu Sync.
4. Enter the Topiqu application URL and the API key from the site's integration settings.
5. Save, test the connection, and run the first synchronization.

== Synchronization ==

The plugin imports all published source-language articles, tags, dates, metadata, and featured images. A complete successful scan also moves imported posts no longer returned by Topiqu to draft. It never deletes posts or media.

The safe update mode detects local changes to the title, slug, excerpt, or content and does not overwrite those posts. The overwrite mode treats Topiqu as the source of truth. The new-only mode never updates an existing import.

WP-Cron requires site traffic. Production installations can trigger `wp cron event run topiqu_sync_cron` from a system cron for predictable execution.
