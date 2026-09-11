<?php
// Standalone behavioral tests: php tests/server/wordpress-safety.php
define('ABSPATH', __DIR__);
define('TOPIQU_SYNC_VERSION', '1.0.0');
class WP_Error { public function __construct(public $code, public $message = '', $data = null) {} public function get_error_message() { return $this->message; } }
function __($s, $domain = '') { return $s; }
function is_wp_error($v) { return $v instanceof WP_Error; }
function untrailingslashit($s) { return rtrim($s, '/'); }
function wp_parse_url($s, $part) { return parse_url($s, $part); }
function sanitize_text_field($s) { return trim(strip_tags($s)); }
function wp_generate_uuid4() { return uniqid('', true); }
function current_time($a, $b = false) { return 'test'; }
function get_option($k, $default = false) { return $GLOBALS['options'][$k] ?? $default; }
function add_option($k, $v, $x = '', $y = false) { if (isset($GLOBALS['options'][$k])) return false; $GLOBALS['options'][$k] = $v; return true; }
function delete_option($k) { unset($GLOBALS['options'][$k]); }
function update_option($k, $v, $a = false) { $GLOBALS['options'][$k] = $v; }
function wp_safe_remote_get($url, $args) { $GLOBALS['requests'][] = $args; return array('body' => json_encode($GLOBALS['response']), 'status' => $GLOBALS['status'] ?? 200); }
function wp_remote_retrieve_response_code($r) { return $r['status']; }
function wp_remote_retrieve_body($r) { return $r['body']; }
function get_posts($args) { ++$GLOBALS['reconciliations']; return array(); }
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-api.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-sync.php';
function check($condition, $label) { if (!$condition) throw new Exception($label); echo "PASS: $label\n"; }
$GLOBALS['options'] = array('topiqu_sync_settings' => array('api_url' => 'https://example.com', 'api_key' => 'test'));
$GLOBALS['reconciliations'] = 0;
foreach (array(array('data' => null), array('data' => array()), array('data' => array(), 'meta' => array('total' => 2)), array('data' => array('oops' => 'bad'), 'meta' => array('total' => 0))) as $response) {
    $GLOBALS['response'] = $response;
    check(is_wp_error((new Topiqu_Sync())->run()), 'Malformed/incomplete response fails');
    check($GLOBALS['reconciliations'] === 0, 'No reconciliation after invalid response');
    check(!get_option('topiqu_sync_lock'), 'Lock released on failure');
}
$GLOBALS['response'] = array('data' => array(), 'meta' => array('total' => 0));
check(!is_wp_error((new Topiqu_Sync())->run()), 'Valid empty scan succeeds');
check($GLOBALS['reconciliations'] === 1, 'Valid empty scan reconciles');
$GLOBALS['options']['topiqu_sync_lock'] = 'other-worker';
check(is_wp_error((new Topiqu_Sync())->run()), 'Concurrent run refused');
check(get_option('topiqu_sync_lock') === 'other-worker', 'Other worker retains lock');
delete_option('topiqu_sync_lock');
$GLOBALS['requests'] = array();
check(is_wp_error((new Topiqu_API(array('api_url' => 'http://example.com', 'api_key' => 'test')))->site()), 'HTTP rejected');
check(count($GLOBALS['requests']) === 0, 'No key sent over HTTP');
$GLOBALS['status'] = 302;
check(is_wp_error((new Topiqu_API(get_option('topiqu_sync_settings')))->site()), 'Redirect rejected');
check($GLOBALS['requests'][0]['redirection'] === 0, 'Redirect following disabled');
