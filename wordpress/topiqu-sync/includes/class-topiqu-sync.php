<?php

defined('ABSPATH') || exit;

final class Topiqu_Sync {
    private array $settings;
    private Topiqu_API $api;
    private string $source = '';
    private ?Topiqu_Lock $lock = null;
    private array $page_posts = array();

    public function __construct() {
        $this->settings = get_option('topiqu_sync_settings', array());
        $this->api = new Topiqu_API($this->settings);
    }

    public function run() {
        $lock = Topiqu_Lock::acquire();
        if (is_wp_error($lock)) return $lock;
        $this->lock = $lock;

        $result = array('created' => 0, 'updated' => 0, 'skipped' => 0, 'drafted' => 0, 'errors' => array());
        $remote_ids = array();
        $page = 1;
        $complete = false;
        $expected_total = null;

        try {
            $source = Topiqu_Source::verified($this->api, $this->settings);
            if (is_wp_error($source)) return $this->finish_error($result, $source);
            $this->source = $source['namespace'];
            do {
                $response = $this->api->articles($page, 100);
                if (!$this->lock->heartbeat()) return $this->lost_lock();
                if (is_wp_error($response)) {
                    return $this->finish_error($result, $response);
                }
                if (($response['meta']['siteId'] ?? null) !== $source['id']) {
                    return $this->finish_error($result, new WP_Error('topiqu_source_changed', __('The publication identity changed during synchronization. No missing posts were drafted.', 'topiqu-sync')));
                }
                $articles = $response['data'];
                $total = $response['meta']['total'] ?? null;
                if (!is_int($total) || $total < 0 || array_values($articles) !== $articles || count($articles) > 100
                    || (null !== $expected_total && $expected_total !== $total)) {
                    return $this->finish_error($result, new WP_Error('topiqu_invalid_page', __('Topiqu returned invalid or changing pagination. Please retry.', 'topiqu-sync')));
                }
                $expected_total = $total;
                $page_ids = array();
                foreach ($articles as $article) {
                    if (!is_array($article) || !isset($article['id']) || !is_string($article['id'])
                        || !preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $article['id']) || isset($remote_ids[$article['id']])) {
                        return $this->finish_error($result, new WP_Error('topiqu_invalid_article', __('Topiqu returned an invalid or duplicate article ID.', 'topiqu-sync')));
                    }
                    $remote_ids[$article['id']] = true;
                    $page_ids[] = $article['id'];
                }
                $loaded = $this->load_page_posts($page_ids);
                if (is_wp_error($loaded)) return $this->finish_error($result, $loaded);
                foreach ($articles as $article) {
                    $outcome = $this->upsert($article);
                    if (is_wp_error($outcome)) {
                        if ('topiqu_lock_lost' === $outcome->get_error_code()) return $outcome;
                        $result['errors'][] = $outcome->get_error_message();
                    } else {
                        ++$result[$outcome];
                    }
                }
                ++$page;
            } while (count($remote_ids) < $total && !empty($articles));

            $complete = count($remote_ids) === $total;
            if (!$complete) {
                return $this->finish_error($result, new WP_Error('topiqu_incomplete', __('Topiqu returned an incomplete article list. No missing posts were drafted.', 'topiqu-sync')));
            }
            if ($complete && empty($result['errors'])) {
                $drafted = $this->reconcile_missing($remote_ids);
                if (is_wp_error($drafted)) return $this->finish_error($result, $drafted);
                $result['drafted'] = $drafted;
            }
            return $this->finish($result, empty($result['errors']) ? 'success' : 'error');
        } finally {
            $this->lock->release();
        }
    }

    private function upsert(array $article) {
        if (!$this->lock->heartbeat()) return $this->lost_lock();
        $remote_id = sanitize_text_field((string) $article['id']);
        $post_id = $this->page_posts[$remote_id] ?? 0;
        // Keep this an opaque revision token, including on SQLite date coercion.
        $remote_updated = 'revision:' . sanitize_text_field((string) ($article['updatedAt'] ?? ''));

        if ($post_id && get_post_meta($post_id, '_topiqu_updated_at', true) === $remote_updated) {
            return 'skipped';
        }
        if ($post_id && 'new_only' === ($this->settings['update_mode'] ?? 'safe')) {
            return 'skipped';
        }
        if ($post_id && 'safe' === ($this->settings['update_mode'] ?? 'safe') && $this->was_edited($post_id)) {
            update_post_meta($post_id, '_topiqu_sync_conflict', current_time('mysql', true));
            return 'skipped';
        }

        $postarr = array(
            'ID' => $post_id,
            'post_type' => 'post',
            'post_status' => 'publish',
            'post_author' => $this->author_id(),
            'post_title' => sanitize_text_field((string) ($article['title'] ?? '')),
            'post_name' => sanitize_title((string) ($article['slug'] ?? '')),
            'post_excerpt' => wp_kses_post((string) ($article['excerpt'] ?? '')),
            'post_content' => wp_kses_post((string) ($article['content'] ?? '')),
        );
        if (!empty($article['publishedAt'])) {
            $timestamp = strtotime((string) $article['publishedAt']);
            if ($timestamp) {
                $postarr['post_date_gmt'] = gmdate('Y-m-d H:i:s', $timestamp);
                $postarr['post_date'] = get_date_from_gmt($postarr['post_date_gmt']);
            }
        }

        if (!$this->lock->heartbeat()) return $this->lost_lock();
        $saved_id = wp_insert_post(wp_slash($postarr), true);
        if (is_wp_error($saved_id)) {
            return $saved_id;
        }

        $tags = array();
        foreach (($article['tags'] ?? array()) as $wrapper) {
            $tag = isset($wrapper['tag']) && is_array($wrapper['tag']) ? $wrapper['tag'] : $wrapper;
            if (!empty($tag['name'])) {
                $tags[] = sanitize_text_field((string) $tag['name']);
            }
        }
        wp_set_post_tags($saved_id, $tags, false);

        update_post_meta($saved_id, '_topiqu_article_id', $remote_id);
        update_post_meta($saved_id, '_topiqu_source', $this->source);
        update_post_meta($saved_id, '_topiqu_updated_at', $remote_updated);
        update_post_meta($saved_id, '_topiqu_reading_time', absint($article['readingTime'] ?? 0));
        update_post_meta($saved_id, '_topiqu_total_words', absint($article['totalWords'] ?? 0));
        update_post_meta($saved_id, '_topiqu_sources', wp_json_encode($article['sources'] ?? array()));
        update_post_meta($saved_id, '_topiqu_image_credit', wp_json_encode($article['imageCredit'] ?? null));
        update_post_meta($saved_id, '_topiqu_series', wp_json_encode($article['articleSeries'] ?? null));
        update_post_meta($saved_id, '_topiqu_import_hash', $this->post_hash($saved_id));
        delete_post_meta($saved_id, '_topiqu_sync_conflict');

        if (!empty($this->settings['download_images']) && !empty($article['imageUrl'])) {
            $this->sync_image($saved_id, esc_url_raw((string) $article['imageUrl']), $postarr['post_title']);
        }
        return $post_id ? 'updated' : 'created';
    }

    private function was_edited(int $post_id): bool {
        $import_hash = (string) get_post_meta($post_id, '_topiqu_import_hash', true);
        return $import_hash !== '' && !hash_equals($import_hash, $this->post_hash($post_id));
    }

    private function load_page_posts(array $remote_ids) {
        $this->page_posts = array();
        if (!$remote_ids) return true;
        global $wpdb;
        $wpdb->last_error = '';
        $placeholders = implode(',', array_fill(0, count($remote_ids), '%s'));
        // Match WP_Query's post_status=any, including custom excluded statuses.
        $excluded_statuses = array_values(array_unique(array_merge(array('trash', 'auto-draft', 'inherit'), get_post_stati(array('exclude_from_search' => true)))));
        $status_placeholders = implode(',', array_fill(0, count($excluded_statuses), '%s'));
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT article.meta_value AS remote_id, MIN(p.ID) AS post_id FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} source ON source.post_id = p.ID AND source.meta_key = '_topiqu_source' AND source.meta_value = %s
            INNER JOIN {$wpdb->postmeta} article ON article.post_id = p.ID AND article.meta_key = '_topiqu_article_id'
            WHERE p.post_type = 'post' AND p.post_status NOT IN ({$status_placeholders})
            AND article.meta_value IN ({$placeholders}) GROUP BY article.meta_value LIMIT 100",
            array_merge(array($this->source), $excluded_statuses, $remote_ids)
        ));
        if ($wpdb->last_error || !is_array($rows)) return new WP_Error('topiqu_local_scan_failed', __('The local article scan failed. Imported posts were preserved.', 'topiqu-sync'));
        foreach ($rows as $row) $this->page_posts[(string) $row->remote_id] = (int) $row->post_id;
        return true;
    }

    private function post_hash(int $post_id): string {
        $post = get_post($post_id);
        return hash('sha256', implode("\n", array($post->post_title, $post->post_name, $post->post_excerpt, $post->post_content)));
    }

    private function sync_image(int $post_id, string $url, string $title): void {
        if (get_post_meta($post_id, '_topiqu_image_url', true) === $url && has_post_thumbnail($post_id)) {
            return;
        }
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $attachment_id = media_sideload_image($url, $post_id, $title, 'id');
        if (!is_wp_error($attachment_id)) {
            set_post_thumbnail($post_id, $attachment_id);
            update_post_meta($post_id, '_topiqu_image_url', $url);
        }
    }

    private function reconcile_missing(array $remote_ids) {
        if ('keep' === ($this->settings['missing_action'] ?? 'draft')) {
            return 0;
        }
        global $wpdb;
        $drafted = 0;
        $cursor = 0;
        do {
            if (!$this->lock->heartbeat()) return $this->lost_lock();
            // A keyset keeps batches stable while drafting removes rows from this query.
            $wpdb->last_error = '';
            $post_ids = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT p.ID FROM {$wpdb->posts} p
                INNER JOIN {$wpdb->postmeta} source ON source.post_id = p.ID AND source.meta_key = '_topiqu_source' AND source.meta_value = %s
                INNER JOIN {$wpdb->postmeta} article ON article.post_id = p.ID AND article.meta_key = '_topiqu_article_id'
                WHERE p.post_type = 'post' AND p.post_status IN ('publish', 'future', 'private') AND p.ID > %d
                ORDER BY p.ID ASC LIMIT 100", $this->source, $cursor
            ));
            if ($wpdb->last_error || !is_array($post_ids)) return new WP_Error('topiqu_local_scan_failed', __('The local article scan failed. Imported posts were preserved.', 'topiqu-sync'));
            foreach ($post_ids as $post_id) {
                $cursor = (int) $post_id;
                if (!$this->lock->heartbeat()) return $this->lost_lock();
                if (!isset($remote_ids[(string) get_post_meta($post_id, '_topiqu_article_id', true)])) {
                    $updated = wp_update_post(array('ID' => $post_id, 'post_status' => 'draft'), true);
                    if (is_wp_error($updated)) return $updated;
                    ++$drafted;
                    update_post_meta($post_id, '_topiqu_missing_at', current_time('mysql', true));
                }
            }
        } while (count($post_ids) === 100);
        return $drafted;
    }

    private function author_id(): int {
        $author_id = absint($this->settings['author_id'] ?? 0);
        return get_user_by('id', $author_id) ? $author_id : 1;
    }

    private function finish_error(array $result, WP_Error $error): WP_Error {
        $result['errors'][] = $error->get_error_message();
        $this->finish($result, 'error');
        return $error;
    }

    private function finish(array $result, string $status): array {
        $log = array('time' => current_time('mysql', true), 'status' => $status, 'result' => $result);
        if ($this->lock && $this->lock->owns()) update_option('topiqu_sync_last_run', $log, false);
        return $result;
    }

    private function lost_lock(): WP_Error {
        return new WP_Error('topiqu_lock_lost', __('Synchronization ownership changed. This worker stopped without reconciling missing posts.', 'topiqu-sync'));
    }
}
