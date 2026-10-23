<?php
// Run only on an isolated WordPress: TOPIQU_WORDPRESS_TEST=1 wp eval-file tests/server/wordpress-runtime.php
if (!defined('WP_CLI') || !WP_CLI || '1' !== getenv('TOPIQU_WORDPRESS_TEST')) throw new RuntimeException('Explicit isolated WordPress test opt-in is required.');
if (get_option('topiqu_sync_lock')) throw new RuntimeException('A synchronization lock exists; do not run this fixture beside a worker.');
$original_settings = get_option('topiqu_sync_settings', false);
$original_source = get_option('topiqu_sync_source', false);
$original_last_run = get_option('topiqu_sync_last_run', false);
$fixture_ids = array();
register_shutdown_function(static function () use ($original_settings, $original_source, $original_last_run, &$fixture_ids) {
    foreach ($fixture_ids as $fixture_id) wp_delete_post($fixture_id, true);
    if (false === $original_settings) delete_option('topiqu_sync_settings'); else update_option('topiqu_sync_settings', $original_settings, false);
    if (false === $original_source) delete_option('topiqu_sync_source'); else update_option('topiqu_sync_source', $original_source, false);
    if (false === $original_last_run) delete_option('topiqu_sync_last_run'); else update_option('topiqu_sync_last_run', $original_last_run, false);
});
function topiqu_assert($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
    WP_CLI::log('PASS: ' . $message);
}
wp_set_current_user(1);
$fixture_token = wp_generate_uuid4();
$fixture_remote_id = 'runtime-' . $fixture_token;
$fixture_source_a = 'runtime-a-' . $fixture_token;
$fixture_source_b = 'runtime-b-' . $fixture_token;
update_option('topiqu_sync_settings', array('api_url' => 'https://example.com', 'api_key' => 'test', 'author_id' => 1, 'update_mode' => 'safe', 'missing_action' => 'draft', 'download_images' => 0, 'interval' => 'manual'));
$article = array('id' => $fixture_remote_id, 'title' => 'Runtime test', 'slug' => $fixture_remote_id, 'content' => '<p>Original</p><script>alert(1)</script>', 'updatedAt' => '2026-09-07T12:00:00Z');
$GLOBALS['topiqu_site_id'] = $fixture_source_a;
$GLOBALS['topiqu_response'] = array('data' => array($article), 'meta' => array('total' => 1, 'siteId' => $fixture_source_a));
add_filter('pre_http_request', static function ($preempt, $args, $url) {
    $body = str_ends_with(wp_parse_url($url, PHP_URL_PATH), '/site')
        ? array('data' => array('id' => $GLOBALS['topiqu_site_id'], 'name' => 'Isolated fixture'))
        : $GLOBALS['topiqu_response'];
    return array('headers' => array(), 'body' => wp_json_encode($body), 'response' => array('code' => 200, 'message' => 'OK'), 'cookies' => array());
}, 10, 3);
topiqu_assert(!is_wp_error(Topiqu_Source::confirm(get_option('topiqu_sync_settings'), true, false)), 'Source explicitly confirmed');
$result = (new Topiqu_Sync())->run();
topiqu_assert($result['created'] === 1, 'Import creates native post');
$posts = get_posts(array('meta_key' => '_topiqu_article_id', 'meta_value' => $fixture_remote_id, 'post_status' => 'any'));
$id = $posts[0]->ID;
$fixture_ids[] = $id;
topiqu_assert(!str_contains(get_post($id)->post_content, '<script'), 'Imported script removed');
$result = (new Topiqu_Sync())->run();
topiqu_assert($result['skipped'] === 1, 'Second scan does not duplicate: ' . wp_json_encode($result));
wp_update_post(array('ID' => $id, 'post_content' => 'Local edit'));
$GLOBALS['topiqu_response']['data'][0]['updatedAt'] = '2026-09-07T13:00:00Z';
$result = (new Topiqu_Sync())->run();
topiqu_assert($result['skipped'] === 1 && get_post($id)->post_content === 'Local edit', 'Safe mode preserves local edit');
$GLOBALS['topiqu_response'] = array('data' => null);
topiqu_assert(is_wp_error((new Topiqu_Sync())->run()) && get_post_status($id) === 'publish', 'Malformed response preserves published post');
add_option('topiqu_sync_lock', 'other-worker', '', false);
topiqu_assert(is_wp_error((new Topiqu_Sync())->run()), 'Atomic lock blocks another worker');
delete_option('topiqu_sync_lock');
$GLOBALS['topiqu_response'] = array('data' => array(), 'meta' => array('total' => 0, 'siteId' => $fixture_source_a));
$result = (new Topiqu_Sync())->run();
topiqu_assert($result['drafted'] === 1 && get_post_status($id) === 'draft', 'Complete empty response drafts missing post');
$GLOBALS['topiqu_site_id'] = $fixture_source_b;
topiqu_assert(!is_wp_error(Topiqu_Source::confirm(get_option('topiqu_sync_settings'), true, false)), 'Source switch explicitly confirmed');
$GLOBALS['topiqu_response'] = array('data' => array($article), 'meta' => array('total' => 1, 'siteId' => $fixture_source_b));
$result = (new Topiqu_Sync())->run();
topiqu_assert($result['created'] === 1, 'Second source gets a separate post for the same article ID');
$second_posts = get_posts(array('post_status' => 'any', 'meta_query' => array(array('key' => '_topiqu_article_id', 'value' => $fixture_remote_id), array('key' => '_topiqu_source', 'value' => get_option('topiqu_sync_source')['namespace']))));
$fixture_ids[] = $second_posts[0]->ID;
wp_update_post(array('ID' => $id, 'post_status' => 'publish'));
$GLOBALS['topiqu_response'] = array('data' => array(), 'meta' => array('total' => 0, 'siteId' => $fixture_source_b));
(new Topiqu_Sync())->run();
topiqu_assert('publish' === get_post_status($id), 'Second-source empty scan leaves first-source posts published');
WP_CLI::success('Runtime checks passed.');
