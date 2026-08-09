<?php

defined('ABSPATH') || exit;

final class Topiqu_Plugin {
    private static ?Topiqu_Plugin $instance = null;

    public static function instance(): Topiqu_Plugin {
        return self::$instance ??= new self();
    }

    public function boot(): void {
        add_filter('cron_schedules', array($this, 'cron_schedules'));
        add_action('topiqu_sync_cron', array($this, 'run_cron'));

        if (is_admin()) {
            (new Topiqu_Admin())->boot();
        }
    }

    public static function activate(): void {
        if (version_compare(PHP_VERSION, '8.0', '<')) {
            deactivate_plugins(plugin_basename(TOPIQU_SYNC_FILE));
            wp_die(esc_html__('Topiqu Sync requires PHP 8.0 or newer.', 'topiqu-sync'));
        }

        $defaults = array(
            'api_url' => '',
            'api_key' => '',
            'interval' => 'topiqu_15_minutes',
            'author_id' => get_current_user_id(),
            'update_mode' => 'safe',
            'missing_action' => 'draft',
            'download_images' => 1,
        );
        add_option('topiqu_sync_settings', $defaults, '', false);
        self::schedule();
    }

    public static function deactivate(): void {
        wp_clear_scheduled_hook('topiqu_sync_cron');
    }

    public function cron_schedules(array $schedules): array {
        $schedules['topiqu_15_minutes'] = array('interval' => 15 * MINUTE_IN_SECONDS, 'display' => __('Every 15 minutes', 'topiqu-sync'));
        $schedules['topiqu_hourly'] = array('interval' => HOUR_IN_SECONDS, 'display' => __('Hourly', 'topiqu-sync'));
        $schedules['topiqu_daily'] = array('interval' => DAY_IN_SECONDS, 'display' => __('Daily', 'topiqu-sync'));
        return $schedules;
    }

    public static function schedule(): void {
        wp_clear_scheduled_hook('topiqu_sync_cron');
        $settings = get_option('topiqu_sync_settings', array());
        $interval = $settings['interval'] ?? 'topiqu_15_minutes';
        if ('manual' !== $interval && !wp_next_scheduled('topiqu_sync_cron')) {
            wp_schedule_event(time() + MINUTE_IN_SECONDS, $interval, 'topiqu_sync_cron');
        }
    }

    public function run_cron(): void {
        (new Topiqu_Sync())->run();
    }
}
