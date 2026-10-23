<?php
require __DIR__ . '/wordpress-fixture.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-api.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-source.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-lock.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-sync.php';

$settings = topiqu_test_settings();
update_option('topiqu_sync_settings', $settings);
$legacy_id = wp_insert_post(array('post_title' => 'Legacy local title', 'post_content' => 'Preserve my local edit'));
update_post_meta($legacy_id, '_topiqu_article_id', 'legacy-article');
update_post_meta($legacy_id, '_custom_rights', 'Original rights');
$GLOBALS['remote_articles'] = array(array('id' => 'legacy-article', 'title' => 'Remote title', 'updatedAt' => 'v1'));
topiqu_check(is_wp_error((new Topiqu_Sync())->run()), 'Unconfirmed source cannot mutate legacy posts');
topiqu_check(is_wp_error(Topiqu_Source::confirm($settings, false, true)), 'Legacy adoption requires explicit source confirmation');
topiqu_check('' === get_post_meta($legacy_id, '_topiqu_source', true), 'No ownership is inferred from an article ID or URL');
$confirmed = Topiqu_Source::confirm($settings, true, false);
topiqu_check(!is_wp_error($confirmed) && 0 === $confirmed['adopted'], 'Administrator can bind a new source without adopting uncertain legacy posts');
topiqu_check('' === get_post_meta($legacy_id, '_topiqu_source', true), 'Unassociated history remains untouched');
$import = (new Topiqu_Sync())->run();
topiqu_check(!is_wp_error($import) && 1 === $import['created'], 'A confirmed new source creates a separate scoped post');
topiqu_check('Legacy local title' === get_post($legacy_id)->post_title, 'New imports do not overwrite unassociated local history');
$collision = Topiqu_Source::confirm($settings, true, true);
topiqu_check(!is_wp_error($collision) && 1 === $collision['conflicts'], 'Explicit adoption preserves conflicting same-source identities');
topiqu_check('' === get_post_meta($legacy_id, '_topiqu_source', true), 'Conflicting legacy post remains unassociated and preserved');
topiqu_check('Original rights' === get_post_meta($legacy_id, '_custom_rights', true), 'Adoption never rewrites unrelated rights metadata');

$GLOBALS['wpdb'] = new Topiqu_Test_Wpdb();
update_option('topiqu_sync_settings', $settings);
$legacy_ids = array();
for ($index = 0; $index < 650; ++$index) {
    $post_id = wp_insert_post(array('post_title' => 'Legacy ' . $index, 'post_content' => 'Local content'));
    update_post_meta($post_id, '_topiqu_article_id', 'legacy-' . $index);
    $legacy_ids[] = $post_id;
}
$GLOBALS['max_loaded_posts'] = 0;
$first = Topiqu_Source::confirm($settings, true, true);
topiqu_check(!is_wp_error($first) && 500 === $first['adopted'] && $first['source']['legacy_pending'], 'Legacy migration is bounded to 500 posts per explicit request');
topiqu_check(is_wp_error((new Topiqu_Sync())->run()), 'Incomplete adoption blocks imports that could duplicate remaining legacy rows');
$next = Topiqu_Source::confirm($settings, true, true);
topiqu_check(!is_wp_error($next) && 150 === $next['adopted'] && !$next['source']['legacy_pending'], 'Repeated confirmed adoption safely resumes remaining legacy posts');
topiqu_check($GLOBALS['max_loaded_posts'] <= 100, 'Legacy adoption loads at most 100 IDs per batch');
foreach ($legacy_ids as $post_id) {
    if (get_post_meta($post_id, '_topiqu_source', true) !== $next['source']['namespace'] || 'Local content' !== get_post($post_id)->post_content) throw new RuntimeException('Adoption corrupted post identity/content');
}
topiqu_check(true, 'Every adopted post retains its content and receives the verified namespace');
$lock = Topiqu_Lock::acquire();
topiqu_check(is_wp_error(Topiqu_Source::confirm($settings, true, false)), 'Source cannot switch while a synchronization owner is active');
$lock->release();

$GLOBALS['wpdb'] = new Topiqu_Test_Wpdb();
update_option('topiqu_sync_settings', $settings);
$namespace = hash('sha256', "site-a\nhttps://service.test");
for ($index = 0; $index < 500; ++$index) {
    $legacy = wp_insert_post(array('post_title' => 'Conflicting legacy'));
    update_post_meta($legacy, '_topiqu_article_id', 'conflict-' . $index);
    $scoped = wp_insert_post(array('post_title' => 'Scoped owner'));
    update_post_meta($scoped, '_topiqu_article_id', 'conflict-' . $index);
    update_post_meta($scoped, '_topiqu_source', $namespace);
}
$last_legacy = wp_insert_post(array('post_title' => 'Legacy after conflicts'));
update_post_meta($last_legacy, '_topiqu_article_id', 'after-conflicts');
$conflicting_batch = Topiqu_Source::confirm($settings, true, true);
topiqu_check(!is_wp_error($conflicting_batch) && 500 === $conflicting_batch['conflicts'] && $conflicting_batch['source']['legacy_pending'], 'A full conflict batch is preserved for administrator review');
$after_conflicts = Topiqu_Source::confirm($settings, true, true);
topiqu_check(!is_wp_error($after_conflicts) && 1 === $after_conflicts['adopted'] && !$after_conflicts['source']['legacy_pending'], 'Durable migration progress advances past preserved conflicts');
