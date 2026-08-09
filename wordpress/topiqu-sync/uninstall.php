<?php

defined('WP_UNINSTALL_PLUGIN') || exit;

wp_clear_scheduled_hook('topiqu_sync_cron');
delete_option('topiqu_sync_settings');
delete_option('topiqu_sync_last_run');
delete_transient('topiqu_sync_lock');

// Imported posts and media deliberately remain in the site.
