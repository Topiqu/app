<?php

defined('ABSPATH') || exit;

final class Topiqu_Lock {
    private const OPTION = 'topiqu_sync_lock';
    public const STALE_AFTER = 900;
    private string $owner;

    private function __construct(string $owner) { $this->owner = $owner; }

    public static function acquire() {
        $owner = wp_generate_uuid4();
        $record = array('owner' => $owner, 'started_at' => time(), 'heartbeat_at' => time(), 'revision' => 0);
        if (!add_option(self::OPTION, $record, '', false)) {
            return new WP_Error('topiqu_locked', __('A Topiqu synchronization is already running. Review its heartbeat in Topiqu Sync settings if a worker crashed.', 'topiqu-sync'));
        }
        $lock = new self($owner);
        register_shutdown_function(array($lock, 'release'));
        return $lock;
    }

    private static function raw() {
        global $wpdb;
        // Ownership must bypass per-request and persistent option caches.
        return $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", self::OPTION));
    }

    public static function status(): array {
        $raw = self::raw();
        if (null === $raw) return array();
        $record = maybe_unserialize($raw);
        if (!is_array($record)) return array('owner' => (string) $record, 'legacy' => true);
        return $record;
    }

    private static function clear_cache(): void {
        wp_cache_delete(self::OPTION, 'options');
        wp_cache_delete('notoptions', 'options');
    }

    public function owns(): bool {
        return (self::status()['owner'] ?? null) === $this->owner;
    }

    public function heartbeat(): bool {
        global $wpdb;
        $raw = self::raw();
        $record = maybe_unserialize($raw);
        if (!is_array($record) || ($record['owner'] ?? null) !== $this->owner) return false;
        $record['heartbeat_at'] = time();
        $record['revision'] = (int) ($record['revision'] ?? 0) + 1;
        $saved = $wpdb->update($wpdb->options, array('option_value' => maybe_serialize($record)), array('option_name' => self::OPTION, 'option_value' => $raw));
        self::clear_cache();
        return 1 === $saved;
    }

    public function release(): void {
        global $wpdb;
        $raw = self::raw();
        $record = maybe_unserialize($raw);
        if (!is_array($record) || ($record['owner'] ?? null) !== $this->owner) return;
        $wpdb->delete($wpdb->options, array('option_name' => self::OPTION, 'option_value' => $raw));
        self::clear_cache();
    }

    public static function recover(string $expected_owner, bool $confirmed_inactive) {
        global $wpdb;
        if (!$confirmed_inactive || '' === $expected_owner) {
            return new WP_Error('topiqu_recovery_confirmation', __('First confirm that no synchronization worker is still running.', 'topiqu-sync'));
        }
        $raw = self::raw();
        $record = maybe_unserialize($raw);
        $owner = is_array($record) ? ($record['owner'] ?? '') : (string) $record;
        if ($owner !== $expected_owner) {
            return new WP_Error('topiqu_recovery_changed', __('The synchronization owner changed. Refresh this page before recovery.', 'topiqu-sync'));
        }
        if (is_array($record) && time() - (int) ($record['heartbeat_at'] ?? time()) < self::STALE_AFTER) {
            return new WP_Error('topiqu_recovery_active', __('The synchronization heartbeat is recent. Recovery is blocked while the worker may be active.', 'topiqu-sync'));
        }
        // Staleness alone never authorizes takeover: a slow but live PHP hook can
        // outlast any lease. The administrator must verify worker termination.
        if (1 !== $wpdb->delete($wpdb->options, array('option_name' => self::OPTION, 'option_value' => $raw))) {
            return new WP_Error('topiqu_recovery_changed', __('The synchronization owner changed. Refresh this page before recovery.', 'topiqu-sync'));
        }
        self::clear_cache();
        return true;
    }
}
