<?php
require __DIR__ . '/wordpress-fixture.php';
require __DIR__ . '/../../wordpress/topiqu-sync/includes/class-topiqu-lock.php';

if ('worker' === ($argv[1] ?? '')) {
    $worker = Topiqu_Lock::acquire();
    if (is_wp_error($worker)) exit(2);
    echo Topiqu_Lock::status()['owner'] . "\n";
    flush();
    while (true) usleep(100000);
}

$first = Topiqu_Lock::acquire();
topiqu_check(!is_wp_error($first), 'A worker atomically acquires ownership');
$owner = Topiqu_Lock::status()['owner'];
topiqu_check(is_wp_error(Topiqu_Lock::acquire()), 'Another worker cannot acquire a live lock');
topiqu_check($first->heartbeat(), 'Owner heartbeat succeeds even within the same second');
topiqu_check(is_wp_error(Topiqu_Lock::recover($owner, true)), 'A fresh heartbeat prevents even confirmed recovery');
$stale = Topiqu_Lock::status();
$stale['heartbeat_at'] = time() - Topiqu_Lock::STALE_AFTER - 1;
update_option('topiqu_sync_lock', $stale);
topiqu_check(is_wp_error(Topiqu_Lock::acquire()), 'A stale lease never automatically overlaps a slow live worker');
topiqu_check($first->heartbeat(), 'A long-running live owner can renew a stale heartbeat');
$stale = Topiqu_Lock::status();
$stale['heartbeat_at'] = time() - Topiqu_Lock::STALE_AFTER - 1;
update_option('topiqu_sync_lock', $stale);
topiqu_check(is_wp_error(Topiqu_Lock::recover($owner, false)), 'Abandoned-owner recovery requires explicit verification');
topiqu_check(is_wp_error(Topiqu_Lock::recover('different-owner', true)), 'A stale recovery form cannot remove a different owner');
topiqu_check(true === Topiqu_Lock::recover($owner, true), 'Verified stale owner can be recovered');
$second = Topiqu_Lock::acquire();
$replacement = Topiqu_Lock::status()['owner'];
$first->release();
topiqu_check(Topiqu_Lock::status()['owner'] === $replacement, 'Old owner cleanup cannot erase its replacement');
topiqu_check(!$first->heartbeat(), 'A resumed old worker is fenced from new work');
$second->release();
topiqu_check(array() === Topiqu_Lock::status(), 'The current owner releases its own record');

update_option('topiqu_sync_lock', 'legacy-abandoned-owner');
topiqu_check(is_wp_error(Topiqu_Lock::acquire()), 'Legacy owner is preserved until explicit recovery');
topiqu_check(true === Topiqu_Lock::recover('legacy-abandoned-owner', true), 'Verified abandoned legacy lock can be recovered without guessing its age');

// Kill a separate PHP process without shutdown callbacks, using only a temporary DB.
$path = tempnam(sys_get_temp_dir(), 'topiqu-wp-lock-');
putenv('TOPIQU_TEST_DB=' . $path);
$GLOBALS['wpdb'] = new Topiqu_Test_Wpdb();
$pipes = array();
$process = proc_open(array(PHP_BINARY, __FILE__, 'worker'), array(0 => array('pipe', 'r'), 1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes, null, array('TOPIQU_TEST_DB' => $path));
try {
    if (!is_resource($process)) throw new RuntimeException('Could not create isolated worker');
    fclose($pipes[0]);
    stream_set_timeout($pipes[1], 5);
    $killed_owner = trim((string) fgets($pipes[1]));
    topiqu_check('' !== $killed_owner, 'Isolated worker acquired its durable record');
    proc_terminate($process, 9);
    proc_close($process);
    $process = null;
    topiqu_check((Topiqu_Lock::status()['owner'] ?? '') === $killed_owner, 'Hard-killed process leaves recoverable owner evidence');
    topiqu_check(is_wp_error(Topiqu_Lock::acquire()), 'Hard crash cannot silently enable overlapping imports');
    $expired = Topiqu_Lock::status();
    $expired['heartbeat_at'] = time() - Topiqu_Lock::STALE_AFTER - 1;
    update_option('topiqu_sync_lock', $expired);
    topiqu_check(true === Topiqu_Lock::recover($killed_owner, true), 'Confirmed process death and stale heartbeat permit recovery');
    $recovered = Topiqu_Lock::acquire();
    topiqu_check(!is_wp_error($recovered), 'A new worker runs after guarded crash recovery');
    $recovered->release();
} finally {
    if (is_resource($process)) { proc_terminate($process, 9); proc_close($process); }
    foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
    putenv('TOPIQU_TEST_DB');
    unlink($path);
}
