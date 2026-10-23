<?php
require __DIR__ . '/wordpress-fixture.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-api.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-source.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-lock.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-sync.php';

$count = 5000;
$settings = topiqu_test_settings();
update_option('topiqu_sync_settings', $settings);
Topiqu_Source::confirm($settings, true, false);
$GLOBALS['remote_articles'] = array();
for ($i = 0; $i < $count; ++$i) $GLOBALS['remote_articles'][] = array('id' => 'benchmark-' . $i, 'title' => 'Article ' . $i, 'content' => '<p>Fixture article.</p>', 'updatedAt' => 'v1');
$start = hrtime(true);
$created = (new Topiqu_Sync())->run();
$import_ms = (hrtime(true) - $start) / 1e6;
topiqu_check(!is_wp_error($created) && $count === $created['created'], 'Large synthetic publication imports every article');
$start = hrtime(true);
$unchanged = (new Topiqu_Sync())->run();
$unchanged_ms = (hrtime(true) - $start) / 1e6;
topiqu_check(!is_wp_error($unchanged) && $count === $unchanged['skipped'], 'Large repeated scan skips unchanged posts without duplication');
$GLOBALS['remote_articles'] = array();
$start = hrtime(true);
$missing = (new Topiqu_Sync())->run();
$reconcile_ms = (hrtime(true) - $start) / 1e6;
topiqu_check(!is_wp_error($missing) && $count === $missing['drafted'], 'Large empty snapshot reconciles all matching-source posts');
topiqu_check($GLOBALS['max_loaded_posts'] <= 100, 'Large fixture keeps local ID batches bounded');

$ids = array_map(static fn($i) => 'remote-' . $i, range(1, 20000));
$start = hrtime(true);
foreach ($ids as $remote_id) if (!in_array($remote_id, $ids, true)) throw new RuntimeException('Linear reference mismatch');
$linear_ms = (hrtime(true) - $start) / 1e6;
$start = hrtime(true);
$set = array_fill_keys($ids, true);
foreach ($ids as $remote_id) if (!isset($set[$remote_id])) throw new RuntimeException('Set reference mismatch');
$set_ms = (hrtime(true) - $start) / 1e6;
echo json_encode(array('fixture_articles' => $count, 'import_ms' => round($import_ms, 2), 'unchanged_ms' => round($unchanged_ms, 2), 'reconcile_ms' => round($reconcile_ms, 2), 'peak_local_id_batch' => $GLOBALS['max_loaded_posts'], 'php_peak_bytes' => memory_get_peak_usage(true), 'membership_ids' => count($ids), 'linear_membership_ms' => round($linear_ms, 2), 'set_membership_ms' => round($set_ms, 2))) . "\n";
