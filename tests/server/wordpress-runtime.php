<?php
// Run only on an isolated WordPress: wp eval-file tests/server/wordpress-runtime.php
function topiqu_assert($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
    WP_CLI::log('PASS: ' . $message);
}
wp_set_current_user(1);
foreach (get_posts(array('meta_key' => '_topiqu_article_id', 'meta_value' => 'runtime-test', 'post_status' => 'any', 'numberposts' => -1)) as $old) { wp_delete_post($old->ID, true); }
update_option('topiqu_sync_settings', array('api_url' => 'https://example.com', 'api_key' => 'test', 'author_id' => 1, 'update_mode' => 'safe', 'missing_action' => 'draft', 'download_images' => 0, 'interval' => 'manual'));
$article = array('id' => 'runtime-test', 'title' => 'Runtime test', 'slug' => 'runtime-test', 'content' => '<p>Original</p><script>alert(1)</script>', 'updatedAt' => '2026-09-07T12:00:00Z');
$GLOBALS['topiqu_response'] = array('data' => array($article), 'meta' => array('total' => 1));
add_filter('pre_http_request', static function () {
    return array('headers' => array(), 'body' => wp_json_encode($GLOBALS['topiqu_response']), 'response' => array('code' => 200, 'message' => 'OK'), 'cookies' => array());
});
$result = (new Topiqu_Sync())->run();
topiqu_assert($result['created'] === 1, 'Import creates native post');
$posts = get_posts(array('meta_key' => '_topiqu_article_id', 'meta_value' => 'runtime-test', 'post_status' => 'any'));
$id = $posts[0]->ID;
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
$GLOBALS['topiqu_response'] = array('data' => array(), 'meta' => array('total' => 0));
$result = (new Topiqu_Sync())->run();
topiqu_assert($result['drafted'] === 1 && get_post_status($id) === 'draft', 'Complete empty response drafts missing post');
wp_delete_post($id, true);
WP_CLI::success('Runtime checks passed.');
