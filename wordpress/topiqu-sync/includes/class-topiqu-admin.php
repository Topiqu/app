<?php

defined('ABSPATH') || exit;

final class Topiqu_Admin {
    public function boot(): void {
        add_action('admin_menu', array($this, 'menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_post_topiqu_test_connection', array($this, 'test_connection'));
        add_action('admin_post_topiqu_sync_now', array($this, 'sync_now'));
        add_action('update_option_topiqu_sync_settings', array($this, 'reschedule'), 10, 2);
        add_filter('plugin_action_links_' . plugin_basename(TOPIQU_SYNC_FILE), array($this, 'action_links'));
    }

    public function menu(): void {
        add_options_page(__('Topiqu Sync', 'topiqu-sync'), __('Topiqu Sync', 'topiqu-sync'), 'manage_options', 'topiqu-sync', array($this, 'page'));
    }

    public function register_settings(): void {
        register_setting('topiqu_sync', 'topiqu_sync_settings', array(
            'type' => 'array',
            'sanitize_callback' => array($this, 'sanitize'),
            'default' => array(),
        ));
    }

    public function sanitize($input): array {
        $old = get_option('topiqu_sync_settings', array());
        $modes = array('safe', 'overwrite', 'new_only');
        $intervals = array('manual', 'topiqu_15_minutes', 'topiqu_hourly', 'topiqu_daily');
        $api_key = trim((string) ($input['api_key'] ?? ''));
        return array(
            'api_url' => untrailingslashit(esc_url_raw((string) ($input['api_url'] ?? ''))),
            'api_key' => '' !== $api_key ? $api_key : (string) ($old['api_key'] ?? ''),
            'interval' => in_array($input['interval'] ?? '', $intervals, true) ? $input['interval'] : 'topiqu_15_minutes',
            'author_id' => absint($input['author_id'] ?? 0),
            'update_mode' => in_array($input['update_mode'] ?? '', $modes, true) ? $input['update_mode'] : 'safe',
            'missing_action' => 'keep' === ($input['missing_action'] ?? '') ? 'keep' : 'draft',
            'download_images' => empty($input['download_images']) ? 0 : 1,
        );
    }

    public function action_links(array $links): array {
        array_unshift($links, '<a href="' . esc_url(admin_url('options-general.php?page=topiqu-sync')) . '">' . esc_html__('Settings', 'topiqu-sync') . '</a>');
        return $links;
    }

    public function reschedule(): void {
        Topiqu_Plugin::schedule();
    }

    public function test_connection(): void {
        $this->guard('topiqu_test_connection');
        $response = (new Topiqu_API(get_option('topiqu_sync_settings', array())))->site();
        if (is_wp_error($response)) {
            $this->redirect('error', $response->get_error_message());
        }
        $site = $response['data'];
        $message = sprintf(__('Connected to %1$s — %2$d published articles.', 'topiqu-sync'), (string) ($site['name'] ?? 'Topiqu'), (int) ($site['articleCount'] ?? 0));
        $this->redirect('success', $message);
    }

    public function sync_now(): void {
        $this->guard('topiqu_sync_now');
        $result = (new Topiqu_Sync())->run();
        if (is_wp_error($result)) {
            $this->redirect('error', $result->get_error_message());
        }
        $message = sprintf(
            __('Synchronization finished: %1$d created, %2$d updated, %3$d skipped, %4$d drafted, %5$d errors.', 'topiqu-sync'),
            $result['created'], $result['updated'], $result['skipped'], $result['drafted'], count($result['errors'])
        );
        $this->redirect(empty($result['errors']) ? 'success' : 'warning', $message);
    }

    private function guard(string $action): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You are not allowed to manage Topiqu Sync.', 'topiqu-sync'), 403);
        }
        check_admin_referer($action);
    }

    private function redirect(string $status, string $message): void {
        $url = add_query_arg(array('page' => 'topiqu-sync', 'topiqu_status' => $status, 'topiqu_message' => $message), admin_url('options-general.php'));
        wp_safe_redirect($url);
        exit;
    }

    public function page(): void {
        if (!current_user_can('manage_options')) {
            return;
        }
        $settings = wp_parse_args(get_option('topiqu_sync_settings', array()), array(
            'api_url' => '', 'api_key' => '', 'interval' => 'topiqu_15_minutes', 'author_id' => 0,
            'update_mode' => 'safe', 'missing_action' => 'draft', 'download_images' => 1,
        ));
        $last = get_option('topiqu_sync_last_run', array());
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Topiqu Sync', 'topiqu-sync'); ?></h1>
            <?php if (isset($_GET['topiqu_message'])) : ?>
                <div class="notice notice-<?php echo 'error' === ($_GET['topiqu_status'] ?? '') ? 'error' : 'success'; ?> is-dismissible"><p><?php echo esc_html(wp_unslash($_GET['topiqu_message'])); ?></p></div>
            <?php endif; ?>
            <p><?php esc_html_e('Import published Topiqu articles as native WordPress posts.', 'topiqu-sync'); ?></p>
            <form method="post" action="options.php">
                <?php settings_fields('topiqu_sync'); ?>
                <table class="form-table" role="presentation">
                    <tr><th><label for="topiqu-api-url"><?php esc_html_e('Topiqu URL', 'topiqu-sync'); ?></label></th><td><input class="regular-text" id="topiqu-api-url" name="topiqu_sync_settings[api_url]" type="url" required value="<?php echo esc_attr($settings['api_url']); ?>" placeholder="https://app.example.com"></td></tr>
                    <tr><th><label for="topiqu-api-key"><?php esc_html_e('API key', 'topiqu-sync'); ?></label></th><td><input class="regular-text" id="topiqu-api-key" name="topiqu_sync_settings[api_key]" type="password" autocomplete="new-password" value=""><p class="description"><?php esc_html_e('Leave blank to keep the saved key.', 'topiqu-sync'); ?></p></td></tr>
                    <tr><th><label for="topiqu-interval"><?php esc_html_e('Synchronization', 'topiqu-sync'); ?></label></th><td><select id="topiqu-interval" name="topiqu_sync_settings[interval]"><?php $this->options(array('manual' => __('Manual only', 'topiqu-sync'), 'topiqu_15_minutes' => __('Every 15 minutes', 'topiqu-sync'), 'topiqu_hourly' => __('Hourly', 'topiqu-sync'), 'topiqu_daily' => __('Daily', 'topiqu-sync')), $settings['interval']); ?></select></td></tr>
                    <tr><th><label for="topiqu-author"><?php esc_html_e('Post author', 'topiqu-sync'); ?></label></th><td><?php wp_dropdown_users(array('name' => 'topiqu_sync_settings[author_id]', 'id' => 'topiqu-author', 'selected' => $settings['author_id'], 'who' => 'authors')); ?></td></tr>
                    <tr><th><label for="topiqu-mode"><?php esc_html_e('Existing posts', 'topiqu-sync'); ?></label></th><td><select id="topiqu-mode" name="topiqu_sync_settings[update_mode]"><?php $this->options(array('safe' => __('Update unless edited in WordPress', 'topiqu-sync'), 'overwrite' => __('Always overwrite from Topiqu', 'topiqu-sync'), 'new_only' => __('Import new posts only', 'topiqu-sync')), $settings['update_mode']); ?></select></td></tr>
                    <tr><th><?php esc_html_e('Missing articles', 'topiqu-sync'); ?></th><td><label><input type="radio" name="topiqu_sync_settings[missing_action]" value="draft" <?php checked($settings['missing_action'], 'draft'); ?>> <?php esc_html_e('Move to draft', 'topiqu-sync'); ?></label><br><label><input type="radio" name="topiqu_sync_settings[missing_action]" value="keep" <?php checked($settings['missing_action'], 'keep'); ?>> <?php esc_html_e('Keep published', 'topiqu-sync'); ?></label></td></tr>
                    <tr><th><?php esc_html_e('Featured images', 'topiqu-sync'); ?></th><td><label><input type="checkbox" name="topiqu_sync_settings[download_images]" value="1" <?php checked($settings['download_images']); ?>> <?php esc_html_e('Download into the Media Library', 'topiqu-sync'); ?></label></td></tr>
                </table>
                <?php submit_button(); ?>
            </form>
            <hr>
            <h2><?php esc_html_e('Connection and manual synchronization', 'topiqu-sync'); ?></h2>
            <p>
                <a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=topiqu_test_connection'), 'topiqu_test_connection')); ?>"><?php esc_html_e('Test connection', 'topiqu-sync'); ?></a>
                <a class="button button-primary" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=topiqu_sync_now'), 'topiqu_sync_now')); ?>"><?php esc_html_e('Synchronize now', 'topiqu-sync'); ?></a>
            </p>
            <?php if (!empty($last)) : ?><p><strong><?php esc_html_e('Last run:', 'topiqu-sync'); ?></strong> <?php echo esc_html($last['time'] ?? ''); ?> UTC — <?php echo esc_html($last['status'] ?? ''); ?></p><?php endif; ?>
        </div>
        <?php
    }

    private function options(array $options, string $selected): void {
        foreach ($options as $value => $label) {
            printf('<option value="%s"%s>%s</option>', esc_attr($value), selected($selected, $value, false), esc_html($label));
        }
    }
}
