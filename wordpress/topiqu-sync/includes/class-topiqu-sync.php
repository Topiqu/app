<?php

defined('ABSPATH') || exit;

final class Topiqu_Sync {
    private const LOCK = 'topiqu_sync_lock';
    private array $settings;
    private Topiqu_API $api;

    public function __construct() {
        $this->settings = get_option('topiqu_sync_settings', array());
        $this->api = new Topiqu_API($this->settings);
    }

    public function run() {
        if (!add_option(self::LOCK, wp_generate_uuid4(), '', false)) {
            return new WP_Error('topiqu_locked', __('A Topiqu synchronization is already running.', 'topiqu-sync'));
        }
        // Release even on a fatal error; never expire a lock while its worker is active.
        $lock_owner = get_option(self::LOCK);
        register_shutdown_function(static function () use ($lock_owner): void {
            if (get_option(self::LOCK) === $lock_owner) {
                delete_option(self::LOCK);
            }
        });

        $result = array('created' => 0, 'updated' => 0, 'skipped' => 0, 'drafted' => 0, 'errors' => array());
        $remote_ids = array();
        $page = 1;
        $complete = false;
        $expected_total = null;

        try {
            do {
                $response = $this->api->articles($page, 100);
                if (is_wp_error($response)) {
                    return $this->finish_error($result, $response);
                }
                $articles = $response['data'];
                $total = $response['meta']['total'] ?? null;
                if (!is_int($total) || $total < 0 || array_values($articles) !== $articles
                    || (null !== $expected_total && $expected_total !== $total)) {
                    return $this->finish_error($result, new WP_Error('topiqu_invalid_page', __('Topiqu returned invalid or changing pagination. Please retry.', 'topiqu-sync')));
                }
                $expected_total = $total;
                foreach ($articles as $article) {
                    if (!is_array($article) || !isset($article['id']) || !is_string($article['id']) || '' === trim($article['id'])
                        || in_array($article['id'], $remote_ids, true)) {
                        return $this->finish_error($result, new WP_Error('topiqu_invalid_article', __('Topiqu returned an invalid or duplicate article ID.', 'topiqu-sync')));
                    }
                    $remote_ids[] = (string) $article['id'];
                    $outcome = $this->upsert($article);
                    if (is_wp_error($outcome)) {
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
                $result['drafted'] = $this->reconcile_missing($remote_ids);
            }
            return $this->finish($result, empty($result['errors']) ? 'success' : 'error');
        } finally {
            delete_option(self::LOCK);
        }
    }

    private function upsert(array $article) {
        $remote_id = sanitize_text_field((string) $article['id']);
        $existing = get_posts(array(
            'post_type' => 'post',
            'post_status' => 'any',
            'meta_key' => '_topiqu_article_id',
            'meta_value' => $remote_id,
            'numberposts' => 1,
            'fields' => 'ids',
        ));
        $post_id = $existing ? (int) $existing[0] : 0;
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

    private function reconcile_missing(array $remote_ids): int {
        if ('keep' === ($this->settings['missing_action'] ?? 'draft')) {
            return 0;
        }
        $post_ids = get_posts(array(
            'post_type' => 'post',
            'post_status' => array('publish', 'future', 'private'),
            'meta_key' => '_topiqu_article_id',
            'numberposts' => -1,
            'fields' => 'ids',
        ));
        $drafted = 0;
        foreach ($post_ids as $post_id) {
            if (!in_array((string) get_post_meta($post_id, '_topiqu_article_id', true), $remote_ids, true)) {
                $updated = wp_update_post(array('ID' => $post_id, 'post_status' => 'draft'), true);
                if (!is_wp_error($updated)) {
                    ++$drafted;
                    update_post_meta($post_id, '_topiqu_missing_at', current_time('mysql', true));
                }
            }
        }
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
        update_option('topiqu_sync_last_run', $log, false);
        return $result;
    }
}
