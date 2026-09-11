<?php

defined('ABSPATH') || exit;

final class Topiqu_API {
    private string $base_url;
    private string $api_key;

    public function __construct(array $settings) {
        $this->base_url = untrailingslashit((string) ($settings['api_url'] ?? ''));
        $this->api_key = (string) ($settings['api_key'] ?? '');
    }

    public function site() {
        return $this->get('/api/external/site');
    }

    public function articles(int $page, int $limit = 100) {
        return $this->get('/api/external/articles?page=' . $page . '&limit=' . $limit);
    }

    private function get(string $path) {
        if (!$this->base_url || !$this->api_key) {
            return new WP_Error('topiqu_not_configured', __('Topiqu API URL and key are required.', 'topiqu-sync'));
        }

        if ('https' !== wp_parse_url($this->base_url, PHP_URL_SCHEME)) {
            return new WP_Error('topiqu_https_required', __('Topiqu URL must use HTTPS.', 'topiqu-sync'));
        }

        $response = wp_safe_remote_get($this->base_url . $path, array(
            'timeout' => 20,
            'redirection' => 0,
            'headers' => array(
                'Accept' => 'application/json',
                'User-Agent' => 'Topiqu-Sync/' . TOPIQU_SYNC_VERSION,
                'x-api-key' => $this->api_key,
            ),
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if ($status < 200 || $status >= 300) {
            /* translators: %d: HTTP status code returned by the Topiqu API. */
            $message = is_array($body) && !empty($body['message']) && is_string($body['message']) ? $body['message'] : sprintf(__('Topiqu API returned HTTP %d.', 'topiqu-sync'), $status);
            return new WP_Error('topiqu_http_error', sanitize_text_field($message), array('status' => $status));
        }
        if (!is_array($body) || !isset($body['data']) || !is_array($body['data'])) {
            return new WP_Error('topiqu_invalid_response', __('Topiqu API returned an invalid response.', 'topiqu-sync'));
        }
        return $body;
    }
}
