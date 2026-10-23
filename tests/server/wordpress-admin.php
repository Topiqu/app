<?php
require __DIR__ . '/wordpress-fixture.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-api.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-source.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-lock.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-admin.php';

final class Topiqu_Test_Redirect extends RuntimeException {}
function current_user_can($capability) { return $GLOBALS['authorized'] ?? true; }
function check_admin_referer($action) { if (!($GLOBALS['valid_nonce'] ?? true)) throw new RuntimeException('Invalid nonce'); }
function wp_die($message, $code = 0) { throw new RuntimeException('Capability rejected', $code); }
function esc_html__($value, $domain = '') { return $value; }
function esc_url_raw($value) { return $value; }
function wp_unslash($value) { return $value; }
function admin_url($value) { return 'https://wordpress.test/' . $value; }
function wp_create_nonce($action) { return 'offline-nonce'; }
function wp_safe_redirect($url) { throw new Topiqu_Test_Redirect($url); }
function add_settings_error($group, $code, $message) { $GLOBALS['settings_errors'][] = $code; }
function add_query_arg($key, $value, $url = null) {
    if (is_array($key)) { $url = $value; $params = $key; } else $params = array($key => $value);
    return $url . (str_contains($url, '?') ? '&' : '?') . http_build_query($params);
}
function admin_call(callable $run) {
    try { $run(); } catch (Topiqu_Test_Redirect $redirect) {
        parse_str(parse_url($redirect->getMessage(), PHP_URL_QUERY), $query);
        return $query['topiqu_status'];
    }
    throw new RuntimeException('Expected native admin redirect');
}

$admin = new Topiqu_Admin();
$settings = topiqu_test_settings();
update_option('topiqu_sync_settings', $settings);
foreach (array('confirm_source', 'recover_lock') as $action) {
    $GLOBALS['authorized'] = false;
    try { $admin->$action(); throw new RuntimeException('Missing capability guard'); }
    catch (RuntimeException $error) { topiqu_check('Capability rejected' === $error->getMessage(), $action . ' enforces manage_options'); }
    $GLOBALS['authorized'] = true;
    $GLOBALS['valid_nonce'] = false;
    try { $admin->$action(); throw new RuntimeException('Missing nonce guard'); }
    catch (RuntimeException $error) { topiqu_check('Invalid nonce' === $error->getMessage(), $action . ' enforces its nonce'); }
    $GLOBALS['valid_nonce'] = true;
}
topiqu_check(empty($GLOBALS['requests']), 'Rejected admin actions never send credentials');
$_POST = array();
topiqu_check('error' === admin_call(array($admin, 'confirm_source')), 'Source change rejects missing runtime confirmation');
$_POST = array('confirm_source' => '1');
topiqu_check('success' === admin_call(array($admin, 'confirm_source')), 'Explicit administrator confirmation binds source');
$changed = $settings;
$changed['api_url'] = 'https://another-service.test';
$changed['api_key'] = '';
topiqu_check($settings === $admin->sanitize($changed), 'Changing URL cannot forward a retained secret to another host');
topiqu_check(in_array('topiqu_new_url_key', $GLOBALS['settings_errors'], true), 'URL change explains why a fresh key is required');
$lock = Topiqu_Lock::acquire();
$_POST = array('lock_owner' => Topiqu_Lock::status()['owner'], 'confirm_inactive' => '1');
topiqu_check('error' === admin_call(array($admin, 'recover_lock')), 'Admin recovery cannot remove a recent owner');
$lock->release();
