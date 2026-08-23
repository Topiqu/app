=== Topiqu Sync ===
Contributors: topiqu
Tags: content sync, articles, publishing, import, headless
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 8.0
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Synchronize published Topiqu articles into native WordPress posts.

== Description ==

Topiqu Sync connects a WordPress site to the Topiqu content service. It imports published source-language articles as native WordPress posts, including their titles, slugs, excerpts, HTML content, publication dates, tags, metadata, and featured images.

The plugin prevents duplicate posts by storing the stable Topiqu article ID. It supports manual synchronization and scheduled synchronization through WP-Cron.

Three update policies are available:

* **Safe update** preserves a post when its title, slug, excerpt, or content was edited in WordPress.
* **Overwrite** treats Topiqu as the source of truth.
* **New posts only** never updates an existing imported post.

After a complete error-free scan, imported posts no longer published by Topiqu can be moved to draft. The plugin never deletes posts or media.

An active Topiqu account, a Topiqu site, and its API key are required. Topiqu is a hosted software service and is not included with this plugin.

== External services ==

This plugin connects to the Topiqu server URL entered by the site administrator. The connection is required to test credentials and retrieve site metadata, articles, tags, and referenced featured images. Requests are made only after an administrator saves a Topiqu URL and API key or starts a synchronization.

The plugin sends the configured API key in the `x-api-key` request header. It also sends the plugin name and version as the HTTP User-Agent. It does not send WordPress users, visitor activity, post edits, analytics, or the WordPress site URL to Topiqu.

Imported article data and downloaded images are stored in the WordPress database and Media Library. Please review the Topiqu [privacy policy](https://topiqu.com/en/privacy-policy) and [terms of service](https://topiqu.com/en/terms-of-service) before connecting a site.

== Installation ==

1. Install and activate Topiqu Sync.
2. Open **Settings > Topiqu Sync**.
3. Enter the public URL of the Topiqu service and the API key from the Topiqu site's integration settings.
4. Select the WordPress author, synchronization interval, update policy, and missing-article behavior.
5. Save the settings and use **Test connection**.
6. Run **Synchronize now** and review the imported posts under **Posts**.

== Frequently Asked Questions ==

= Where are imported articles stored? =

They are standard WordPress posts under **Posts > All Posts**. They work with themes, feeds, search, caching, and SEO plugins like other posts.

= Does the plugin delete content? =

No. A successfully completed synchronization can move a missing imported article to draft. Uninstalling the plugin retains all imported posts, tags, and media.

= Will synchronization overwrite WordPress edits? =

Not in the default safe update mode. The plugin detects local changes to the title, slug, excerpt, and content and skips that post. Administrators can explicitly select overwrite or new-posts-only behavior.

= Why did the scheduled synchronization not run at the exact time? =

WP-Cron is triggered by site traffic. For predictable production scheduling, invoke the `topiqu_sync_cron` event from a real system cron or WP-CLI.

= Does it import translations? =

Version 1.0.0 imports the primary source-language article. Full WPML or Polylang translation mapping is not included.

== Privacy ==

Topiqu Sync does not track visitors and does not collect analytics. An administrator explicitly configures the external Topiqu service. See the **External services** section for the data sent during synchronization.

== Changelog ==

= 1.0.0 =

* Initial public release.
* Import and update native posts, tags, metadata, publication dates, and featured images.
* Add safe, overwrite, and new-posts-only update policies.
* Add complete-scan reconciliation, manual synchronization, WP-Cron scheduling, and concurrent-run locking.
