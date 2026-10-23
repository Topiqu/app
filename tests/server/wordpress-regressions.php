<?php
require __DIR__ . '/wordpress-fixture.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-api.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-source.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-lock.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-sync.php';

$settings = topiqu_test_settings();
update_option('topiqu_sync_settings', $settings);
$GLOBALS['remote_site'] = array('id' => 'site-a', 'name' => 'Site A');
$GLOBALS['remote_articles'] = array(array('id' => 'article-a', 'title' => 'Source A', 'slug' => 'article-a', 'content' => '<p>A</p>', 'updatedAt' => 'revision-a'));
update_option('topiqu_sync_source', array('id' => 'site-a', 'namespace' => hash('sha256', "site-a\nhttps://service.test"), 'url' => 'https://service.test', 'name' => 'Site A'));
$first = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($first) && 1 === $first['created'], 'Source A imports its article');
$ids = get_posts(array('meta_key' => '_topiqu_article_id', 'meta_value' => 'article-a', 'post_status' => 'any', 'fields' => 'ids'));
$id = $ids[0];
topiqu_check(get_post_meta($id, '_topiqu_source', true) === hash('sha256', "site-a\nhttps://service.test"), 'Imported identity includes its verified source');

$GLOBALS['remote_site'] = array('id' => 'site-b', 'name' => 'Site B');
$GLOBALS['remote_articles'] = array();
update_option('topiqu_sync_source', array('id' => 'site-b', 'namespace' => hash('sha256', "site-b\nhttps://service.test"), 'url' => 'https://service.test', 'name' => 'Site B'));
$second = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($second), 'Source B completes an empty scan');
topiqu_check('publish' === get_post_status($id), 'Source B never drafts source A posts');

$GLOBALS['remote_articles'] = array(array('id' => 'article-a', 'title' => 'Source B collision', 'slug' => 'article-b', 'content' => '<p>B</p>', 'updatedAt' => 'revision-b'));
$third = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($third) && 1 === $third['created'], 'Identical remote ID in source B gets a separate native post');
topiqu_check('Source A' === get_post($id)->post_title, 'Cross-source ID collision never overwrites source A');
$source_b_ids = get_posts(array('meta_query' => array(array('key' => '_topiqu_article_id', 'value' => 'article-a'), array('key' => '_topiqu_source', 'value' => hash('sha256', "site-b\nhttps://service.test"))), 'post_status' => 'any', 'fields' => 'ids'));

$GLOBALS['remote_override'] = array('data' => array(), 'meta' => array('total' => 0, 'siteId' => 'site-c'));
$changed = (new Topiqu_Sync())->run();
topiqu_check(is_wp_error($changed) && 'publish' === get_post_status($id) && 'publish' === get_post_status($source_b_ids[0]), 'Changed page identity prevents reconciliation of both the selected and other source');
unset($GLOBALS['remote_override']);

for ($index = 0; $index < 250; ++$index) {
    $missing_id = wp_insert_post(array('post_title' => 'Missing B ' . $index));
    update_post_meta($missing_id, '_topiqu_article_id', 'missing-b-' . $index);
    update_post_meta($missing_id, '_topiqu_source', hash('sha256', "site-b\nhttps://service.test"));
}
$GLOBALS['remote_articles'] = array();
$GLOBALS['max_loaded_posts'] = 0;
$bounded = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($bounded) && 251 === $bounded['drafted'], 'Batched reconciliation visits every missing post without skipping changed statuses');
topiqu_check($GLOBALS['max_loaded_posts'] <= 100, 'Local reconciliation loads at most 100 post IDs at once');
topiqu_check('publish' === get_post_status($id), 'Large source B reconciliation leaves source A published');

$GLOBALS['remote_articles'] = array();
for ($index = 0; $index < 200; ++$index) $GLOBALS['remote_articles'][] = array('id' => 'page-b-' . $index, 'title' => 'Page B ' . $index, 'updatedAt' => 'v1');
$GLOBALS['identity_lookup_queries'] = 0;
$paged = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($paged) && 200 === $paged['created'], 'Two complete pages import all scoped articles');
topiqu_check($GLOBALS['identity_lookup_queries'] <= 2, 'Existing article identities are resolved in one bounded query per page');

$GLOBALS['excluded_post_statuses'] = array('internal-review' => 'internal-review');
$excluded_id = wp_insert_post(array('post_title' => 'Internal review', 'post_status' => 'internal-review'));
update_post_meta($excluded_id, '_topiqu_article_id', 'excluded-b');
update_post_meta($excluded_id, '_topiqu_source', hash('sha256', "site-b\nhttps://service.test"));
$GLOBALS['remote_articles'] = array(array('id' => 'excluded-b', 'title' => 'Remote published article', 'updatedAt' => 'v1'));
$excluded = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($excluded) && 1 === $excluded['created'] && 'internal-review' === get_post_status($excluded_id), 'Bounded identity lookup preserves custom statuses excluded by WordPress any status');

$GLOBALS['remote_articles'] = array(array('id' => 'policy-b', 'title' => 'Original remote title', 'updatedAt' => 'v1'));
$created = (new Topiqu_Sync())->run();
$policy_ids = get_posts(array('meta_key' => '_topiqu_article_id', 'meta_value' => 'policy-b', 'post_status' => 'any', 'fields' => 'ids'));
$policy_id = $policy_ids[0];
$unchanged = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($created) && !is_wp_error($unchanged) && 1 === $unchanged['skipped'], 'Unchanged revisions skip content writes');
wp_update_post(array('ID' => $policy_id, 'post_title' => 'Local edited title'));
$GLOBALS['remote_articles'][0]['title'] = 'Updated remote title';
$GLOBALS['remote_articles'][0]['updatedAt'] = 'v2';
$safe = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($safe) && 1 === $safe['skipped'] && 'Local edited title' === get_post($policy_id)->post_title && '' !== get_post_meta($policy_id, '_topiqu_sync_conflict', true), 'Safe mode preserves local edits and records the conflict');
$settings['update_mode'] = 'overwrite';
update_option('topiqu_sync_settings', $settings);
$overwrite = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($overwrite) && 1 === $overwrite['updated'] && 'Updated remote title' === get_post($policy_id)->post_title && '' === get_post_meta($policy_id, '_topiqu_sync_conflict', true), 'Explicit overwrite updates the scoped post and clears its conflict');
$settings['update_mode'] = 'new_only';
update_option('topiqu_sync_settings', $settings);
$GLOBALS['remote_articles'][0]['title'] = 'Next remote title';
$GLOBALS['remote_articles'][0]['updatedAt'] = 'v3';
$new_only = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($new_only) && 1 === $new_only['skipped'] && 'Updated remote title' === get_post($policy_id)->post_title, 'New-only mode preserves an existing scoped post');

$GLOBALS['remote_articles'] = array();
$GLOBALS['remote_hook'] = static function ($url) {
    if (str_contains($url, '/articles?')) update_option('topiqu_sync_lock', 'replacement-worker');
};
(new Topiqu_Sync())->run();
topiqu_check('replacement-worker' === get_option('topiqu_sync_lock'), 'An old worker never deletes a replacement owner lock');
unset($GLOBALS['remote_hook']);
delete_option('topiqu_sync_lock');
