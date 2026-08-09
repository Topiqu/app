<?php
/**
 * Plugin Name: Topiqu Sync
 * Description: Synchronizes published Topiqu articles into native WordPress posts.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * Author: Topiqu
 * Author URI: https://topiqu.com/
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: topiqu-sync
 */

defined('ABSPATH') || exit;

define('TOPIQU_SYNC_VERSION', '1.0.0');
define('TOPIQU_SYNC_FILE', __FILE__);
define('TOPIQU_SYNC_DIR', plugin_dir_path(__FILE__));

require_once TOPIQU_SYNC_DIR . 'includes/class-topiqu-api.php';
require_once TOPIQU_SYNC_DIR . 'includes/class-topiqu-sync.php';
require_once TOPIQU_SYNC_DIR . 'includes/class-topiqu-admin.php';
require_once TOPIQU_SYNC_DIR . 'includes/class-topiqu-plugin.php';

register_activation_hook(__FILE__, array('Topiqu_Plugin', 'activate'));
register_deactivation_hook(__FILE__, array('Topiqu_Plugin', 'deactivate'));

Topiqu_Plugin::instance()->boot();
