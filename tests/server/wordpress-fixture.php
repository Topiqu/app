<?php
// Isolated WordPress API fixture backed by a disposable SQLite database.
define('ABSPATH', __DIR__ . '/');
define('TOPIQU_SYNC_VERSION', '1.0.0');
define('MINUTE_IN_SECONDS', 60);
define('HOUR_IN_SECONDS', 3600);
define('DAY_IN_SECONDS', 86400);
class WP_Error {
    public function __construct(public $code, public $message = '', public $data = null) {}
    public function get_error_message() { return $this->message; }
    public function get_error_code() { return $this->code; }
}
final class Topiqu_Test_Wpdb {
    public string $options = 'options';
    public string $posts = 'posts';
    public string $postmeta = 'postmeta';
    public string $prefix = 'test_';
    public string $last_error = '';
    public PDO $db;
    public function __construct() {
        $this->db = new PDO('sqlite:' . (getenv('TOPIQU_TEST_DB') ?: ':memory:'));
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->db->exec('PRAGMA busy_timeout=5000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS options (option_id INTEGER PRIMARY KEY, option_name TEXT UNIQUE, option_value TEXT, autoload TEXT)');
        $this->db->exec('CREATE TABLE IF NOT EXISTS posts (ID INTEGER PRIMARY KEY, post_type TEXT, post_status TEXT, post_author INTEGER, post_title TEXT, post_name TEXT, post_excerpt TEXT, post_content TEXT, post_date_gmt TEXT, post_date TEXT)');
        $this->db->exec('CREATE TABLE IF NOT EXISTS postmeta (meta_id INTEGER PRIMARY KEY, post_id INTEGER, meta_key TEXT, meta_value TEXT, UNIQUE(post_id, meta_key))');
        $this->db->exec('CREATE INDEX IF NOT EXISTS meta_lookup ON postmeta(meta_key, meta_value, post_id)');
    }
    public function prepare($sql, ...$args) {
        if (isset($args[0]) && is_array($args[0])) $args = $args[0];
        $index = 0;
        return preg_replace_callback('/%[sd]/', function ($match) use ($args, &$index) {
            $value = $args[$index++];
            return '%d' === $match[0] ? (string) (int) $value : $this->db->quote((string) $value);
        }, $sql);
    }
    public function query($sql) { return $this->db->exec($sql); }
    public function get_var($sql) { $value = $this->db->query($sql)->fetchColumn(); return false === $value ? null : $value; }
    public function get_results($sql) {
        if (str_contains($sql, 'GROUP BY article.meta_value')) $GLOBALS['identity_lookup_queries'] = ($GLOBALS['identity_lookup_queries'] ?? 0) + 1;
        $rows = $this->db->query($sql)->fetchAll(PDO::FETCH_OBJ);
        $GLOBALS['max_loaded_posts'] = max($GLOBALS['max_loaded_posts'] ?? 0, count($rows));
        return $rows;
    }
    public function get_col($sql) {
        if (str_contains($sql, 'p.post_status IN')) $GLOBALS['local_reconciliations'] = ($GLOBALS['local_reconciliations'] ?? 0) + 1;
        $rows = $this->db->query($sql)->fetchAll(PDO::FETCH_COLUMN);
        $GLOBALS['max_loaded_posts'] = max($GLOBALS['max_loaded_posts'] ?? 0, count($rows));
        return $rows;
    }
    public function delete($table, $where) { return $this->query('DELETE FROM ' . $table . ' WHERE ' . $this->where($where)); }
    public function update($table, $data, $where) {
        $sets = array();
        foreach ($data as $key => $value) $sets[] = $key . '=' . $this->db->quote((string) $value);
        return $this->query('UPDATE ' . $table . ' SET ' . implode(',', $sets) . ' WHERE ' . $this->where($where));
    }
    private function where($values) {
        $parts = array();
        foreach ($values as $key => $value) $parts[] = $key . '=' . $this->db->quote((string) $value);
        return implode(' AND ', $parts);
    }
}
$GLOBALS['wpdb'] = new Topiqu_Test_Wpdb();
function __($value, $domain = '') { return $value; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function untrailingslashit($value) { return rtrim($value, '/'); }
function wp_parse_url($value, $part = -1) { return parse_url($value, $part); }
function sanitize_text_field($value) { return trim(strip_tags($value)); }
function sanitize_title($value) { return strtolower(str_replace(' ', '-', sanitize_text_field($value))); }
function wp_generate_uuid4() { return bin2hex(random_bytes(16)); }
function current_time($format, $gmt = false) { return gmdate('Y-m-d H:i:s'); }
function maybe_serialize($value) { return is_array($value) || is_object($value) ? serialize($value) : (string) $value; }
function maybe_unserialize($value) {
    if (!is_string($value) || !preg_match('/^(?:a|s|i|b|d|N):/', $value)) return $value;
    return unserialize($value, array('allowed_classes' => false));
}
function wp_cache_delete($key, $group = '') { return true; }
function get_option($name, $default = false) {
    global $wpdb;
    $value = $wpdb->get_var($wpdb->prepare('SELECT option_value FROM options WHERE option_name=%s', $name));
    return null === $value ? $default : maybe_unserialize($value);
}
function add_option($name, $value, $deprecated = '', $autoload = false) {
    global $wpdb;
    return 1 === $wpdb->query($wpdb->prepare('INSERT OR IGNORE INTO options(option_name,option_value,autoload) VALUES (%s,%s,%s)', $name, maybe_serialize($value), 'off'));
}
function delete_option($name) { global $wpdb; return $wpdb->delete('options', array('option_name' => $name)) > 0; }
function update_option($name, $value, $autoload = false) {
    global $wpdb;
    $wpdb->query($wpdb->prepare('INSERT INTO options(option_name,option_value,autoload) VALUES (%s,%s,%s) ON CONFLICT(option_name) DO UPDATE SET option_value=excluded.option_value', $name, maybe_serialize($value), 'off'));
    return true;
}
function wp_safe_remote_get($url, $args) {
    $GLOBALS['requests'][] = array('url' => $url, 'args' => $args);
    $site = $GLOBALS['remote_site'] ?? array('id' => 'site-a', 'name' => 'Site A');
    if (str_ends_with(parse_url($url, PHP_URL_PATH), '/site')) $body = array('data' => $site);
    else {
        parse_str(parse_url($url, PHP_URL_QUERY) ?: '', $query);
        $articles = $GLOBALS['remote_articles'] ?? array();
        $body = array('data' => array_slice($articles, ((int) ($query['page'] ?? 1) - 1) * 100, 100), 'meta' => array('total' => count($articles), 'siteId' => $site['id']));
        if (isset($GLOBALS['remote_override'])) $body = $GLOBALS['remote_override'];
    }
    if (isset($GLOBALS['remote_hook'])) ($GLOBALS['remote_hook'])($url, $body);
    return array('body' => json_encode($body), 'status' => $GLOBALS['http_status'] ?? 200);
}
function wp_remote_retrieve_response_code($response) { return $response['status']; }
function wp_remote_retrieve_body($response) { return $response['body']; }
function get_post_stati($args = array()) { return array_merge(array('trash' => 'trash', 'auto-draft' => 'auto-draft', 'inherit' => 'inherit'), $GLOBALS['excluded_post_statuses'] ?? array()); }
function get_posts($args) {
    global $wpdb;
    $GLOBALS['post_queries'][] = $args;
    $where = array('p.post_type=' . $wpdb->db->quote($args['post_type'] ?? 'post'));
    if ('any' !== ($args['post_status'] ?? 'publish')) {
        $statuses = (array) ($args['post_status'] ?? 'publish');
        $where[] = 'p.post_status IN (' . implode(',', array_map($wpdb->db->quote(...), $statuses)) . ')';
    } else {
        $where[] = 'p.post_status NOT IN (' . implode(',', array_map($wpdb->db->quote(...), get_post_stati(array('exclude_from_search' => true)))) . ')';
    }
    $clauses = $args['meta_query'] ?? array();
    $keys = array_column(array_filter($clauses, 'is_array'), 'key');
    if (in_array('_topiqu_article_id', $keys, true) && in_array('_topiqu_source', $keys, true)) $GLOBALS['identity_lookup_queries'] = ($GLOBALS['identity_lookup_queries'] ?? 0) + 1;
    if (isset($args['meta_key'])) $clauses[] = array('key' => $args['meta_key'], 'value' => $args['meta_value'] ?? null);
    foreach ($clauses as $clause) {
        if (!is_array($clause)) continue;
        $test = 'm.post_id=p.ID AND m.meta_key=' . $wpdb->db->quote($clause['key']);
        if (isset($clause['value'])) $test .= ' AND m.meta_value=' . $wpdb->db->quote((string) $clause['value']);
        $where[] = ('NOT EXISTS' === ($clause['compare'] ?? '') ? 'NOT ' : '') . 'EXISTS (SELECT 1 FROM postmeta m WHERE ' . $test . ')';
    }
    $sql = 'SELECT p.ID FROM posts p WHERE ' . implode(' AND ', $where) . ' ORDER BY p.ID ASC';
    $limit = $args['numberposts'] ?? $args['posts_per_page'] ?? 5;
    if ($limit >= 0) $sql .= ' LIMIT ' . (int) $limit . ' OFFSET ' . (int) ($args['offset'] ?? 0);
    $ids = array_map('intval', $wpdb->get_col($sql));
    return 'ids' === ($args['fields'] ?? '') ? $ids : array_map('get_post', $ids);
}
function wp_insert_post($data, $error = false) {
    global $wpdb;
    $id = (int) ($data['ID'] ?? 0);
    unset($data['ID']);
    if ($id) $wpdb->update('posts', $data, array('ID' => $id));
    else {
        $data = array_merge(array('post_type' => 'post', 'post_status' => 'publish', 'post_author' => 1, 'post_title' => '', 'post_name' => '', 'post_excerpt' => '', 'post_content' => ''), $data);
        $wpdb->query('INSERT INTO posts(' . implode(',', array_keys($data)) . ') VALUES (' . implode(',', array_map($wpdb->db->quote(...), array_values($data))) . ')');
        $id = (int) $wpdb->db->lastInsertId();
    }
    return $id;
}
function wp_update_post($data, $error = false) { return wp_insert_post($data, $error); }
function get_post($id) { global $wpdb; return $wpdb->db->query('SELECT * FROM posts WHERE ID=' . (int) $id)->fetchObject(); }
function get_post_status($id) { return get_post($id)->post_status; }
function get_post_meta($id, $key, $single = false) { global $wpdb; return $wpdb->get_var($wpdb->prepare('SELECT meta_value FROM postmeta WHERE post_id=%d AND meta_key=%s', $id, $key)) ?? ''; }
function update_post_meta($id, $key, $value) { global $wpdb; return $wpdb->query($wpdb->prepare('INSERT INTO postmeta(post_id,meta_key,meta_value) VALUES (%d,%s,%s) ON CONFLICT(post_id,meta_key) DO UPDATE SET meta_value=excluded.meta_value', $id, $key, maybe_serialize($value))); }
function delete_post_meta($id, $key) { global $wpdb; return $wpdb->query($wpdb->prepare('DELETE FROM postmeta WHERE post_id=%d AND meta_key=%s', $id, $key)); }
function get_user_by($field, $id) { return (object) array('ID' => 1); }
function wp_slash($value) { return $value; }
function wp_kses_post($value) { return preg_replace('#<script\b[^>]*>.*?</script>#is', '', $value); }
function absint($value) { return abs((int) $value); }
function wp_json_encode($value) { return json_encode($value); }
function wp_set_post_tags($id, $tags, $append = false) { return array(); }
function get_date_from_gmt($value) { return $value; }
function topiqu_check($condition, $label) { if (!$condition) throw new RuntimeException($label); echo "PASS: $label\n"; }
function topiqu_test_settings() { return array('api_url' => 'https://service.test', 'api_key' => 'offline-key', 'update_mode' => 'safe', 'missing_action' => 'draft', 'download_images' => 0); }
