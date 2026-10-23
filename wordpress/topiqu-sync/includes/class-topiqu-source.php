<?php

defined('ABSPATH') || exit;

final class Topiqu_Source {
    public const OPTION = 'topiqu_sync_source';

    public static function inspect(Topiqu_API $api, array $settings) {
        $response = $api->site();
        if (is_wp_error($response)) return $response;
        $site = $response['data'];
        $id = $site['id'] ?? null;
        if (!is_string($id) || !preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $id)) {
            return new WP_Error('topiqu_invalid_source', __('Topiqu returned an invalid publication identity.', 'topiqu-sync'));
        }
        $url = untrailingslashit((string) ($settings['api_url'] ?? ''));
        return array(
            'id' => $id,
            'namespace' => hash('sha256', $id . "\n" . $url),
            'url' => $url,
            'name' => sanitize_text_field((string) ($site['name'] ?? 'Topiqu')),
            'articleCount' => isset($site['articleCount']) && is_int($site['articleCount']) ? max(0, $site['articleCount']) : 0,
        );
    }

    public static function verified(Topiqu_API $api, array $settings) {
        $candidate = self::inspect($api, $settings);
        if (is_wp_error($candidate)) return $candidate;
        $current = get_option(self::OPTION, array());
        if (!is_array($current) || ($current['namespace'] ?? '') !== $candidate['namespace']) {
            return new WP_Error('topiqu_source_unconfirmed', __('Confirm this publication as the synchronization source in Topiqu Sync settings before importing.', 'topiqu-sync'));
        }
        if (!empty($current['legacy_pending'])) {
            return new WP_Error('topiqu_legacy_pending', __('Finish the confirmed legacy-post adoption in Topiqu Sync settings before importing.', 'topiqu-sync'));
        }
        return $candidate;
    }

    public static function confirm(array $settings, bool $confirmed, bool $adopt_legacy) {
        if (!$confirmed) return new WP_Error('topiqu_source_confirmation', __('Confirm the publication identity before changing the synchronization source.', 'topiqu-sync'));
        $lock = Topiqu_Lock::acquire();
        if (is_wp_error($lock)) return $lock;
        try {
            $candidate = self::inspect(new Topiqu_API($settings), $settings);
            if (is_wp_error($candidate)) return $candidate;
            unset($candidate['articleCount']);
            if (!$lock->heartbeat()) return new WP_Error('topiqu_lock_lost', __('Synchronization ownership changed.', 'topiqu-sync'));
            $candidate['legacy_pending'] = false;
            $adopted = 0;
            $conflicts = 0;
            if ($adopt_legacy) {
                $current = get_option(self::OPTION, array());
                $cursor = is_array($current) && ($current['namespace'] ?? '') === $candidate['namespace'] && !empty($current['legacy_pending'])
                    ? (int) ($current['legacy_cursor'] ?? 0) : 0;
                for ($batch = 0; $batch < 5; ++$batch) {
                    $post_ids = self::legacy_ids($cursor);
                    if (is_wp_error($post_ids)) return $post_ids;
                    foreach ($post_ids as $post_id) {
                        $cursor = (int) $post_id;
                        if (!$lock->heartbeat()) return new WP_Error('topiqu_lock_lost', __('Synchronization ownership changed.', 'topiqu-sync'));
                        $remote_id = (string) get_post_meta($post_id, '_topiqu_article_id', true);
                        $existing = get_posts(array('post_type' => 'post', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'meta_query' => array(
                            array('key' => '_topiqu_article_id', 'value' => $remote_id),
                            array('key' => '_topiqu_source', 'value' => $candidate['namespace']),
                        )));
                        if ($existing) { ++$conflicts; continue; }
                        if (!update_post_meta($post_id, '_topiqu_source', $candidate['namespace'])) {
                            return new WP_Error('topiqu_adoption_failed', __('A legacy post could not be associated. Retry source confirmation before importing.', 'topiqu-sync'));
                        }
                        ++$adopted;
                    }
                    if (count($post_ids) < 100) break;
                }
                $remaining = self::legacy_ids($cursor);
                if (is_wp_error($remaining)) return $remaining;
                $candidate['legacy_pending'] = !empty($remaining);
                $candidate['legacy_cursor'] = $cursor;
            }
            if (!update_option(self::OPTION, $candidate, false) && get_option(self::OPTION) !== $candidate) {
                return new WP_Error('topiqu_source_save_failed', __('The verified source could not be saved. Synchronization remains paused until confirmation succeeds.', 'topiqu-sync'));
            }
            return array('source' => $candidate, 'adopted' => $adopted, 'conflicts' => $conflicts);
        } finally { $lock->release(); }
    }

    public static function legacy_ids(int $after = 0) {
        global $wpdb;
        $wpdb->last_error = '';
        $ids = $wpdb->get_col($wpdb->prepare(
            "SELECT DISTINCT p.ID FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} article ON article.post_id = p.ID AND article.meta_key = '_topiqu_article_id'
            WHERE p.post_type = 'post' AND p.ID > %d
            AND NOT EXISTS (SELECT 1 FROM {$wpdb->postmeta} source WHERE source.post_id = p.ID AND source.meta_key = '_topiqu_source')
            ORDER BY p.ID ASC LIMIT 100", $after
        ));
        if ($wpdb->last_error || !is_array($ids)) return new WP_Error('topiqu_local_scan_failed', __('The local article scan failed. Imported posts were preserved.', 'topiqu-sync'));
        return $ids;
    }
}
