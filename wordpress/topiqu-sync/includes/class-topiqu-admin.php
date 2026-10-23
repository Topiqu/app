<?php

defined('ABSPATH') || exit;

final class Topiqu_Admin {
    public function boot(): void {
        add_action('admin_menu', array($this, 'menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_post_topiqu_test_connection', array($this, 'test_connection'));
        add_action('admin_post_topiqu_sync_now', array($this, 'sync_now'));
        add_action('admin_post_topiqu_confirm_source', array($this, 'confirm_source'));
        add_action('admin_post_topiqu_recover_lock', array($this, 'recover_lock'));
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
        $api_key = sanitize_text_field((string) ($input['api_key'] ?? ''));
        $api_url = untrailingslashit(esc_url_raw((string) ($input['api_url'] ?? '')));
        if ('https' !== wp_parse_url($api_url, PHP_URL_SCHEME)) {
            add_settings_error('topiqu_sync', 'topiqu_https', __('Topiqu URL must use HTTPS.', 'topiqu-sync'));
            return $old;
        }
        if ($api_url !== ($old['api_url'] ?? '') && !empty($old['api_key']) && '' === $api_key) {
            add_settings_error('topiqu_sync', 'topiqu_new_url_key', __('Enter an API key when changing the Topiqu URL. The saved key is never forwarded to a different URL.', 'topiqu-sync'));
            return $old;
        }
        return array(
            'api_url' => $api_url,
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
        $settings = get_option('topiqu_sync_settings', array());
        $site = Topiqu_Source::inspect(new Topiqu_API($settings), $settings);
        if (is_wp_error($site)) {
            $this->redirect('error', $site->get_error_message());
        }
        /* translators: 1: Topiqu site name, 2: number of published articles. */
        $message = sprintf(__('Connected to %1$s — %2$d published articles.', 'topiqu-sync'), (string) ($site['name'] ?? 'Topiqu'), (int) ($site['articleCount'] ?? 0));
        /* translators: %s: verified publication ID. */
        $message .= ' ' . sprintf(__('Publication ID: %s', 'topiqu-sync'), $site['id']);
        $this->redirect('success', $message);
    }

    public function sync_now(): void {
        $this->guard('topiqu_sync_now');
        $result = (new Topiqu_Sync())->run();
        if (is_wp_error($result)) {
            $this->redirect('error', $result->get_error_message());
        }
        $message = sprintf(
            /* translators: 1: created posts, 2: updated posts, 3: skipped posts, 4: drafted posts, 5: errors. */
            __('Synchronization finished: %1$d created, %2$d updated, %3$d skipped, %4$d drafted, %5$d errors.', 'topiqu-sync'),
            $result['created'], $result['updated'], $result['skipped'], $result['drafted'], count($result['errors'])
        );
        $this->redirect(empty($result['errors']) ? 'success' : 'warning', $message);
    }

    public function confirm_source(): void {
        $this->guard('topiqu_confirm_source');
        $result = Topiqu_Source::confirm(
            get_option('topiqu_sync_settings', array()),
            isset($_POST['confirm_source']) && '1' === $_POST['confirm_source'],
            isset($_POST['adopt_legacy']) && '1' === $_POST['adopt_legacy']
        );
        if (is_wp_error($result)) $this->redirect('error', $result->get_error_message());
        /* translators: 1: verified source name, 2: adopted legacy posts, 3: preserved conflicting posts. */
        $message = sprintf(__('Source confirmed: %1$s. Associated %2$d legacy posts; preserved %3$d conflicting posts.', 'topiqu-sync'), $result['source']['name'], $result['adopted'], $result['conflicts']);
        if (!empty($result['source']['legacy_pending'])) $message .= ' ' . __('More legacy posts remain. Repeat the confirmed adoption before synchronizing.', 'topiqu-sync');
        $this->redirect(!empty($result['source']['legacy_pending']) || $result['conflicts'] ? 'warning' : 'success', $message);
    }

    public function recover_lock(): void {
        $this->guard('topiqu_recover_lock');
        $owner = isset($_POST['lock_owner']) && is_string($_POST['lock_owner']) ? sanitize_text_field(wp_unslash($_POST['lock_owner'])) : '';
        $result = Topiqu_Lock::recover($owner, isset($_POST['confirm_inactive']) && '1' === $_POST['confirm_inactive']);
        if (is_wp_error($result)) $this->redirect('error', $result->get_error_message());
        $this->redirect('success', __('The abandoned synchronization lock was recovered. A new synchronization can now start.', 'topiqu-sync'));
    }

    private function guard(string $action): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You are not allowed to manage Topiqu Sync.', 'topiqu-sync'), 403);
        }
        check_admin_referer($action);
    }

    private function redirect(string $status, string $message): void {
        $url = add_query_arg(array('page' => 'topiqu-sync', 'topiqu_status' => $status, 'topiqu_message' => $message), admin_url('options-general.php'));
        $url = add_query_arg('_wpnonce', wp_create_nonce('topiqu_notice'), $url);
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
        $source = get_option(Topiqu_Source::OPTION, array());
        $legacy = Topiqu_Source::legacy_ids();
        $lock = Topiqu_Lock::status();
        $recent_lock = !empty($lock['heartbeat_at']) && time() - (int) $lock['heartbeat_at'] < Topiqu_Lock::STALE_AFTER;
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Topiqu Sync', 'topiqu-sync'); ?></h1>
            <?php if (isset($_GET['_wpnonce']) && is_string($_GET['_wpnonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_GET['_wpnonce'])), 'topiqu_notice') && isset($_GET['topiqu_message']) && is_string($_GET['topiqu_message'])) : ?>
                <?php
                $notice_status = isset($_GET['topiqu_status']) && is_string($_GET['topiqu_status']) ? sanitize_key(wp_unslash($_GET['topiqu_status'])) : 'success';
                $notice_class = 'error' === $notice_status ? 'error' : ('warning' === $notice_status ? 'warning' : 'success');
                ?>
                <div class="notice notice-<?php echo esc_attr($notice_class); ?> is-dismissible"><p><?php echo esc_html(sanitize_text_field(wp_unslash($_GET['topiqu_message']))); ?></p></div>
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
            <h2><?php esc_html_e('Publication identity', 'topiqu-sync'); ?></h2>
            <p><?php esc_html_e('Confirm the publication returned by the configured API before importing. Changing the source preserves all posts imported from earlier publications.', 'topiqu-sync'); ?></p>
            <?php if (!empty($source['id'])) : ?><p><?php echo esc_html($source['name'] . ' — ' . $source['id']); ?></p><?php endif; ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="topiqu_confirm_source">
                <?php wp_nonce_field('topiqu_confirm_source'); ?>
                <p><label><input type="checkbox" name="confirm_source" value="1" required> <?php esc_html_e('I checked the connection and confirm the configured publication as the synchronization source.', 'topiqu-sync'); ?></label></p>
                <?php if (!is_wp_error($legacy) && $legacy) : ?>
                    <p><?php esc_html_e('Unassociated legacy imports exist. They remain untouched unless you explicitly associate them. Starting a new source can import separate posts with the same article IDs.', 'topiqu-sync'); ?></p>
                    <p><label><input type="checkbox" name="adopt_legacy" value="1"> <?php esc_html_e('I verified that the unassociated imports belong to this publication. Associate up to 500 now; preserve ID conflicts.', 'topiqu-sync'); ?></label></p>
                <?php endif; ?>
                <?php submit_button(__('Confirm source', 'topiqu-sync'), 'secondary'); ?>
            </form>
            <?php if ($lock) : ?>
                <h2><?php esc_html_e('Synchronization recovery', 'topiqu-sync'); ?></h2>
                <p><?php esc_html_e('A recent heartbeat blocks recovery. Stale locks never expire automatically: a slow worker may still be active. Stop or verify termination of the worker before recovering its lock.', 'topiqu-sync'); ?></p>
                <p><?php echo esc_html(!empty($lock['heartbeat_at']) ? gmdate('Y-m-d H:i:s', (int) $lock['heartbeat_at']) . ' UTC' : __('Legacy lock: heartbeat unavailable.', 'topiqu-sync')); ?></p>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <input type="hidden" name="action" value="topiqu_recover_lock">
                    <input type="hidden" name="lock_owner" value="<?php echo esc_attr((string) ($lock['owner'] ?? '')); ?>">
                    <?php wp_nonce_field('topiqu_recover_lock'); ?>
                    <p><label><input type="checkbox" name="confirm_inactive" value="1" required> <?php esc_html_e('I verified that no synchronization worker is still running.', 'topiqu-sync'); ?></label></p>
                    <button class="button button-secondary" type="submit" <?php disabled($recent_lock); ?>><?php esc_html_e('Recover abandoned lock', 'topiqu-sync'); ?></button>
                </form>
            <?php endif; ?>
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
