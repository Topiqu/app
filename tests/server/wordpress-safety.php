<?php
// Standalone behavioral tests: php tests/server/wordpress-safety.php
require __DIR__ . '/wordpress-fixture.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-api.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-source.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-lock.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-sync.php';
function check($condition, $label) { if (!$condition) throw new Exception($label); echo "PASS: $label\n"; }
update_option('topiqu_sync_settings', topiqu_test_settings());
check(!is_wp_error(Topiqu_Source::confirm(topiqu_test_settings(), true, false)), 'Source explicitly confirmed');
foreach (array(array('data' => null), array('data' => array()), array('data' => array(), 'meta' => array('total' => 2)), array('data' => array('oops' => 'bad'), 'meta' => array('total' => 0))) as $response) {
    if (isset($response['meta'])) $response['meta']['siteId'] = 'site-a';
    $GLOBALS['remote_override'] = $response;
    $before = $GLOBALS['local_reconciliations'] ?? 0;
    check(is_wp_error((new Topiqu_Sync())->run()), 'Malformed/incomplete response fails');
    check(($GLOBALS['local_reconciliations'] ?? 0) === $before, 'No reconciliation after invalid response');
    check(!get_option('topiqu_sync_lock'), 'Lock released on failure');
}
$GLOBALS['remote_override'] = array('data' => array(), 'meta' => array('total' => 0, 'siteId' => 'site-a'));
check(!is_wp_error((new Topiqu_Sync())->run()), 'Valid empty scan succeeds');
check($GLOBALS['local_reconciliations'] === 1, 'Valid empty scan reconciles');
update_option('topiqu_sync_lock', 'other-worker');
check(is_wp_error((new Topiqu_Sync())->run()), 'Concurrent run refused');
check(get_option('topiqu_sync_lock') === 'other-worker', 'Other worker retains lock');
delete_option('topiqu_sync_lock');
$GLOBALS['requests'] = array();
check(is_wp_error((new Topiqu_API(array('api_url' => 'http://example.com', 'api_key' => 'test')))->site()), 'HTTP rejected');
check(count($GLOBALS['requests']) === 0, 'No key sent over HTTP');
$GLOBALS['http_status'] = 302;
check(is_wp_error((new Topiqu_API(get_option('topiqu_sync_settings')))->site()), 'Redirect rejected');
check($GLOBALS['requests'][0]['args']['redirection'] === 0, 'Redirect following disabled');
check($GLOBALS['requests'][0]['args']['limit_response_size'] <= 16 * 1024 * 1024, 'Remote body allocations are bounded');
