<?php
/**
 * TEST-ONLY child process: one create on its OWN connection, so two of these
 * running at once are two real parallel MySQL sessions.
 *
 *   php create_child.php <db> <job.json> <result.json> [<barrier-file>]
 *
 * job.json = {"payload":{...}, "actor":{...}|null, "idem":{...}|null}
 * With a barrier file, the child connects first and then spins until that
 * file exists, so every child starts its create at (nearly) the same moment.
 */
require __DIR__ . '/harness.php';

[$_, $dbName, $jobFile, $outFile] = $argv;
$barrier = $argv[4] ?? null;
$job = json_decode((string)file_get_contents($jobFile), true);

$db = dc_test_connect($dbName);
if (!$db) { file_put_contents($outFile, json_encode(['ok' => false, 'code' => 'no_db'])); exit(1); }

file_put_contents($outFile . '.ready', '1');
if ($barrier) {
    $t = microtime(true);
    while (!file_exists($barrier) && microtime(true) - $t < 30) usleep(2000);
}
$r = dc_test_create($db, $job['payload'], $job['actor'] ?? null, $job['idem'] ?? null);
file_put_contents($outFile, json_encode($r));
