<?php
/**
 * ── Service API — bounded nonce housekeeping ───────────────────────────────
 *
 * Run (THROWAWAY MySQL 8 only; the account must CREATE / DROP DATABASE and
 * CREATE USER):
 *
 *   DC_SERVICE_TEST_DB_HOST=127.0.0.1 DC_SERVICE_TEST_DB_PORT=33171 \
 *   DC_SERVICE_TEST_DB_USER=root DC_SERVICE_TEST_DB_PASS= \
 *   php tests/php/service_nonce_cleanup.test.php
 *
 * WITHOUT DC_SERVICE_TEST_DB_HOST and DC_SERVICE_TEST_DB_PORT IT PRINTS "SKIP"
 * AND EXITS 0 — a skip, not a pass.
 *
 *   1  functions against real MySQL: fresh nonce accepted, replay refused, old
 *      rows removed, recent rows (and anything younger than the floor, whatever
 *      is asked) kept, the batch limit, two connections at once
 *   2  the shipped service.php over HTTP: cleanup runs after the request's own
 *      nonce is stored, a replay younger than the horizon is still refused
 *      after a cleanup ran, and a failing DELETE (a trigger that SIGNALs) is
 *      logged and swallowed — the request succeeds and replays stay refused
 *
 * All data is synthetic.
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);
$label = 'service API — nonce cleanup';

$H = getenv('DC_SERVICE_TEST_DB_HOST'); $P = getenv('DC_SERVICE_TEST_DB_PORT');
if ($H === false || $H === '' || $P === false || $P === '') {
    echo "\n  SKIP  $label\n\n   - NOT RUN: DC_SERVICE_TEST_DB_HOST and DC_SERVICE_TEST_DB_PORT are not set. This is a skip, not a pass.\n\n";
    exit(0);
}
$P = (int)$P; $U = getenv('DC_SERVICE_TEST_DB_USER') ?: 'root'; $W = getenv('DC_SERVICE_TEST_DB_PASS'); if ($W === false) $W = '';

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true) . "\n      actual:   " . var_export($actual, true));
}

require_once "$ROOT/service_auth.php";
$LOG = [];
$GLOBALS['DC_SERVICE_LOG_SINK'] = function ($l) use (&$LOG) { $LOG[] = $l; };

mysqli_report(MYSQLI_REPORT_OFF);
$root = @new mysqli($H, $U, $W, null, $P);
if (!$root || $root->connect_errno) { echo "\n  FAIL  $label — database configured but unreachable\n\n"; exit(1); }
$server = $root->query('SELECT VERSION()')->fetch_row()[0];
$PID = getmypid(); $QDB = "dc_nonce_q_{$PID}"; $UDB = "dc_nonce_u_{$PID}"; $RO_USER = "dc_nc_ro_{$PID}"; $RO_PASS = bin2hex(random_bytes(12));
foreach ([$QDB, $UDB] as $d) { $ex = $root->query("SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$d}'"); if ($ex && $ex->num_rows) { echo "\n  FAIL  {$d} exists\n\n"; exit(1); } }
$SB = sys_get_temp_dir() . "/dc-nonce-sb-{$PID}";
$srv = null;
register_shutdown_function(function () use ($root, $QDB, $UDB, $RO_USER, $SB, &$srv) {
    if (is_resource($srv)) { proc_terminate($srv); proc_close($srv); $srv = null; usleep(300000); }
    $root->query("DROP DATABASE IF EXISTS {$QDB}"); $root->query("DROP DATABASE IF EXISTS {$UDB}"); $root->query("DROP USER IF EXISTS '{$RO_USER}'@'%'");
    if (is_dir($SB)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($SB, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        @rmdir($SB);
    }
});
foreach ([$QDB, $UDB] as $d) $root->query("CREATE DATABASE {$d} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
$conn = function () use ($H, $U, $W, $QDB, $P) { $c = new mysqli($H, $U, $W, $QDB, $P); $c->set_charset('utf8mb4'); return $c; };
$a = $conn(); $b = $conn();
preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', file_get_contents("$ROOT/migrations/2026-11-10-create-service-request-nonces.sql"), $mig);
ok(!empty($mig[1]), '0: nonce migration section lifted from the shipped file');
$a->multi_query($mig[1]); do { if ($x = $a->store_result()) $x->free(); } while ($a->more_results() && $a->next_result());
ok((bool)$a->query('SELECT 1 FROM service_request_nonces LIMIT 1'), '0: service_request_nonces created by the shipped migration');

$count = fn () => (int)$a->query('SELECT COUNT(*) FROM service_request_nonces')->fetch_row()[0];
$has   = fn ($n) => (int)$a->query("SELECT COUNT(*) FROM service_request_nonces WHERE nonce='$n'")->fetch_row()[0] === 1;
$nn    = fn () => bin2hex(random_bytes(16));
/** A row as if stored $age seconds before $now. */
$aged  = function ($age, $now) use ($a, $nn) { $n = $nn(); $t = $now - $age; $a->query("INSERT INTO service_request_nonces (nonce, key_id, received_at) VALUES ('$n', 'k', FROM_UNIXTIME($t))"); return $n; };

// ══ 1 · functions ══════════════════════════════════════════════════════════
$now = time();
$fresh = $nn();
eq(dc_service_consume_nonce($a, $fresh, 'k', $now), null, '1: FRESH nonce accepted (stored)');
eq(dc_service_consume_nonce($a, $fresh, 'k', $now), 'replayed', '1: REPLAY refused');
eq(dc_service_consume_nonce($b, $fresh, 'k', $now), 'replayed', '1: …from another connection too');

$old = []; foreach ([601, 900, 3600, 86400 * 3] as $age) $old[] = $aged($age, $now);
$recent = []; foreach ([0, 30, 119, 239, 241, 599] as $age) $recent[] = $aged($age, $now);
eq(dc_service_prune_nonces($a, $now, 600, 500), 4, '1: prune with keep 600 s removes exactly the 4 rows older than 600 s');
ok(!array_filter($old, $has), '1: OLD nonces removed');
ok(count(array_filter($recent, $has)) === 6 && $has($fresh), '1: RECENT nonces (0–599 s) preserved, the fresh one too');
eq(dc_service_consume_nonce($a, $fresh, 'k', $now), 'replayed', '1: a replay of a nonce younger than the horizon is STILL refused after the cleanup ran');

/* The floor: whatever keep is asked for, nothing younger than 240 s goes. */
foreach ([0, 1, 60, 120, 239] as $k) {
    dc_service_prune_nonces($a, $now, $k, 500);
}
ok($has($recent[0]) && $has($recent[1]) && $has($recent[2]) && $has($recent[3]), '1: keep 0/1/60/120/239 s cannot remove rows younger than the 240 s floor');
ok(!$has($recent[4]), '1: …the floor itself applies (241 s old is past it)');

/* Batch limit, oldest first. */
$a->query('DELETE FROM service_request_nonces');
$batch = []; for ($i = 0; $i < 30; $i++) $batch[] = $aged(10000 + $i * 10, $now);   // ages 10000 … 10290
$keepers = [$aged(10, $now), $aged(200, $now)];
eq(dc_service_prune_nonces($a, $now, 600, 10), 10, '1: BATCH LIMIT — batch 10 deletes exactly 10 of 30 old rows');
eq($count(), 22, '1: …20 old + 2 recent remain');
ok(!array_filter(array_slice($batch, 20), $has) && count(array_filter(array_slice($batch, 0, 20), $has)) === 20, '1: …and it took the OLDEST ten first');
eq(dc_service_prune_nonces($a, $now, 600, 999999), 20, '1: an oversized batch is clamped (here: removes the remaining 20)');
ok($has($keepers[0]) && $has($keepers[1]), '1: recent rows untouched by every batch');
eq(dc_service_prune_nonces($a, $now, 600, 10), 0, '1: nothing old left → 0 rows, not an error');

/* The probabilistic wrapper. */
$LOG = [];
$aged(5000, $now);
eq(dc_service_maybe_prune_nonces($a, $now, ['every' => 0, 'keep' => 600, 'batch' => 10]), 'skipped', '1: every = 0 → never runs');
eq(dc_service_maybe_prune_nonces($a, $now, ['every' => 50, 'keep' => 600, 'batch' => 10], fn ($n) => false), 'skipped', '1: a losing roll → skipped');
eq(dc_service_maybe_prune_nonces($a, $now, ['every' => 50, 'keep' => 600, 'batch' => 10], fn ($n) => $n === 50), 'pruned', '1: a winning roll → pruned (the roll sees every)');
eq($LOG, ['[service] nonce.pruned rows=1'], '1: …logged as a count only');
$hits = 0; for ($i = 0; $i < 4000; $i++) if (dc_service_maybe_prune_nonces(null, $now, ['every' => 50, 'keep' => 600, 'batch' => 1], fn ($n) => random_int(1, $n) === 1) !== 'skipped') $hits++;
ok($hits > 30 && $hits < 160, "1: with every = 50 about 1 in 50 calls runs ($hits of 4000)");

/* Failure: the statement fails → null; the wrapper logs, swallows, and the nonce stays. */
$a->query("CREATE TRIGGER trg_no_delete BEFORE DELETE ON service_request_nonces FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic delete failure'");
$aged(5000, $now);
$beforeFail = $nn(); dc_service_consume_nonce($a, $beforeFail, 'k', $now);
eq(dc_service_prune_nonces($a, $now, 600, 10), null, '1: DELETE FAILING → prune reports failure (null)');
$LOG = [];
eq(dc_service_maybe_prune_nonces($a, $now, ['every' => 1, 'keep' => 600, 'batch' => 10]), 'failed', '1: …the wrapper returns failed, it does not throw');
eq($LOG, ['[service] nonce.prune_failed errno=1644'], '1: …and logs a reason code + errno only (no SQL, no message text)');
eq(dc_service_consume_nonce($a, $beforeFail, 'k', $now), 'replayed', '1: with cleanup broken, a replay is STILL refused');
$f2 = $nn();
eq(dc_service_consume_nonce($a, $f2, 'k', $now), null, '1: …and a fresh nonce is still accepted');
eq(dc_service_maybe_prune_nonces(new stdClass(), $now, ['every' => 1, 'keep' => 600, 'batch' => 10]), 'failed', '1: no usable handle → failed, swallowed');
$a->query('DROP TRIGGER trg_no_delete');

/* Two connections at once. */
$a->query('DELETE FROM service_request_nonces');
$race = $nn();
$a->query('START TRANSACTION');
eq(dc_service_consume_nonce($a, $race, 'k', $now), null, '1: PARALLEL — connection A stores a nonce inside an open transaction');
$b->query("INSERT INTO service_request_nonces (nonce, key_id, received_at) VALUES ('$race', 'k', FROM_UNIXTIME($now))", MYSQLI_ASYNC);
usleep(300000);
$stale = $aged(7200, $now);   // on A, same transaction
eq(dc_service_prune_nonces($a, $now, 600, 100), 1, '1: PARALLEL — A prunes old rows while B is waiting on the same nonce');
$a->query('COMMIT');
$links = $errors = $reject = [$b]; mysqli_poll($links, $errors, $reject, 10);
$res = $b->reap_async_query();
eq([$res, $b->errno], [false, 1062], '1: PARALLEL — B\'s insert of the same nonce fails with 1062 once A commits: exactly one wins');
ok($has($race) && !$has($stale), '1: PARALLEL — the winning nonce is kept, the stale row is gone');
/* B prunes inside a transaction it keeps open while A stores a fresh nonce. InnoDB may
   make A wait for B's range lock; with a short lock wait A then fails CLOSED
   (nonce_store_failed → 503), never "accepted twice". Either outcome is safe. */
$aged(9000, $now); $aged(9100, $now);
$b->query('START TRANSACTION');
eq(dc_service_prune_nonces($b, $now, 600, 100), 2, '1: PARALLEL — B prunes inside an open transaction');
$a->query('SET SESSION innodb_lock_wait_timeout = 2');
$freshA = $nn();
$resA = dc_service_consume_nonce($a, $freshA, 'k', $now);
ok($resA === null || $resA === 'nonce_store_failed', '1: PARALLEL — A meanwhile either stores its nonce or fails closed (' . var_export($resA, true) . ')');
$b->query('COMMIT');
if ($resA !== null) eq(dc_service_consume_nonce($a, $freshA, 'k', $now), null, '1: PARALLEL — …and after B commits the same nonce is stored once');
ok($has($freshA) && $has($race), '1: PARALLEL — both recent nonces kept');
eq(dc_service_consume_nonce($b, $freshA, 'k', $now), 'replayed', '1: PARALLEL — and a replay of it from B is refused');

// ══ 2 · over HTTP ══════════════════════════════════════════════════════════
$a->query('DELETE FROM service_request_nonces');
$root->query("CREATE TABLE {$UDB}.users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(255) NOT NULL, username VARCHAR(20) NOT NULL, email VARCHAR(255) NULL,
    email_verified_at TIMESTAMP NULL, role VARCHAR(16) NOT NULL DEFAULT 'member', password VARCHAR(255) NOT NULL, must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    password_changed_at TIMESTAMP NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, is_legacy_placeholder TINYINT(1) NOT NULL DEFAULT 0, disabled_at TIMESTAMP NULL,
    last_login_at TIMESTAMP NULL, locale VARCHAR(10) NULL, remember_token VARCHAR(100) NULL, created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
    PRIMARY KEY (id), UNIQUE KEY users_username_unique (username)) ENGINE=InnoDB");
$root->query("INSERT INTO {$UDB}.users (id, name, username, password) VALUES (7, 'Example User', 'exampleuser', 'x-not-a-hash')");
$root->query("CREATE USER '{$RO_USER}'@'%' IDENTIFIED BY '{$RO_PASS}'");
$root->query("GRANT SELECT ON {$UDB}.users TO '{$RO_USER}'@'%'");
@mkdir("$SB/app/Handoff/Contract", 0777, true);
foreach (['service.php', 'service_auth.php', 'service_actions.php', 'dnc_handoff.php', 'auth.php', 'quo-parser-core.js', 'quo-pricing-core.js',
          'app/Handoff/Contract/HandoffToken.php', 'app/Handoff/Contract/InvalidHandoffToken.php'] as $f) copy("$ROOT/$f", "$SB/$f");
file_put_contents("$SB/db.php", "<?php function getDB(){ \$d = new mysqli(" . var_export($H, true) . ',' . var_export($U, true) . ',' . var_export($W, true) . ','
    . var_export($QDB, true) . ",{$P}); if (\$d->connect_error) { die('x'); } \$d->set_charset('utf8mb4'); return \$d; }\n");
file_put_contents("$SB/dnc_config.php", '<?php return ' . var_export(['DNC_HANDOFF_ENABLED' => 'false', 'DNC_HANDOFF_SECRET' => 'base64:' . base64_encode(random_bytes(32)),
    'DNC_USERS_DB_HOST' => $H, 'DNC_USERS_DB_PORT' => (string)$P, 'DNC_USERS_DB_DATABASE' => $UDB, 'DNC_USERS_DB_USERNAME' => $RO_USER, 'DNC_USERS_DB_PASSWORD' => $RO_PASS], true) . ';');
$KEY = random_bytes(32);
$writeConf = function (array $extra) use ($SB, $KEY) {
    file_put_contents("$SB/service_config.php", '<?php return ' . var_export(['QQ_SERVICE_ENABLED' => 'true', 'QQ_SERVICE_KEY_ID' => 'qq-backend-1',
        'QQ_SERVICE_SECRET' => 'base64:' . base64_encode($KEY)] + $extra, true) . ';');
};
/* Every accepted request prunes, so each case below is deterministic. */
$writeConf(['QQ_SERVICE_NONCE_PRUNE_EVERY' => 1, 'QQ_SERVICE_NONCE_PRUNE_BATCH' => 5, 'QQ_SERVICE_NONCE_KEEP_SECONDS' => 600]);
$PORT = 39000 + ($PID % 900); $LOGFILE = "$SB/php-error.log";
$env = []; foreach (getenv() as $k => $v) if (strpos($k, 'DNC_') !== 0 && strpos($k, 'QQ_') !== 0) $env[$k] = $v;
$srv = proc_open([PHP_BINARY, '-d', "error_log=$LOGFILE", '-d', 'log_errors=1', '-d', 'opcache.enable_cli=0', '-S', "127.0.0.1:{$PORT}", '-t', $SB],
                 [1 => ['file', "$SB/server.out", 'w'], 2 => ['file', "$SB/server.err", 'w']], $pipes, $SB, $env);
$up = false;
for ($i = 0; $i < 60 && !$up; $i++) { $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3); if ($fp) { fclose($fp); $up = true; } else usleep(200000); }
ok($up, '2: server up');
$ping = function (?string $nonce = null, ?string $ts = null) use ($PORT, $KEY, $nn) {
    $body = json_encode(['actor' => ['sub' => 7, 'username' => 'exampleuser'], 'params' => (object)[]]);
    $ts = $ts ?? (string)time(); $nonce = $nonce ?? $nn();
    $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', "qqs1\nPOST\nping\n$ts\n$nonce\n" . hash('sha256', $body), $KEY, true)), '+/', '-_'), '=');
    $s = fsockopen('127.0.0.1', $PORT, $en, $es, 10);
    fwrite($s, "POST /service.php?action=ping HTTP/1.1\r\nHost: quo.test.invalid\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: " . strlen($body)
        . "\r\nX-QQS-Key-Id: qq-backend-1\r\nX-QQS-Timestamp: $ts\r\nX-QQS-Nonce: $nonce\r\nX-QQS-Signature: $sig\r\n\r\n$body");
    $raw = ''; while (!feof($s)) $raw .= fread($s, 65536); fclose($s);
    preg_match('#^HTTP/\S+ (\d+)#', $raw, $m);
    return ['status' => (int)($m[1] ?? 0), 'nonce' => $nonce, 'ts' => $ts];
};
$svcLog = fn () => array_values(array_filter(explode("\n", is_file($LOGFILE) ? (string)file_get_contents($LOGFILE) : ''), fn ($l) => strpos($l, '[service] nonce.') !== false));

if ($up) {
    $now = time();
    $oldH = []; for ($i = 0; $i < 8; $i++) $oldH[] = $aged(3600 + $i, $now);
    $recentH = $aged(300, $now);
    $r1 = $ping();
    eq($r1['status'], 200, '2: an accepted request with cleanup due → 200');
    ok($has($r1['nonce']), '2: …its OWN nonce is stored (cleanup ran after the insert and did not touch it)');
    eq(count(array_filter($oldH, $has)), 3, '2: …5 of 8 old rows removed (batch 5 from service_config.php), oldest first');
    ok($has($oldH[0]) && $has($oldH[1]) && $has($oldH[2]) && !array_filter(array_slice($oldH, 3), $has), '2: …the oldest five went (3603–3607 s), the three least old stayed');
    ok($has($recentH), '2: …a 300 s old nonce is kept');
    eq($ping($r1['nonce'], $r1['ts'])['status'], 409, '2: replay of the request just served (younger than the horizon) → 409, after a cleanup ran');
    eq($ping()['status'], 200, '2: the next request prunes the rest');
    eq(count(array_filter($oldH, $has)), 0, '2: …all old rows gone');
    eq($ping($r1['nonce'], $r1['ts'])['status'], 409, '2: …and the replay is still refused');

    /* A keep below the floor in the file is ignored. */
    $writeConf(['QQ_SERVICE_NONCE_PRUNE_EVERY' => 1, 'QQ_SERVICE_NONCE_KEEP_SECONDS' => 1]);
    $young = $aged(100, time());
    eq($ping()['status'], 200, '2: keep = 1 s in service_config.php …');
    ok($has($young) && $has($r1['nonce']), '2: …still never deletes a nonce younger than the 240 s floor');

    /* DELETE failing on the server. */
    $a->query("CREATE TRIGGER trg_no_delete BEFORE DELETE ON service_request_nonces FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic delete failure'");
    $writeConf(['QQ_SERVICE_NONCE_PRUNE_EVERY' => 1]);
    $stuck = $aged(5000, time());
    $before = count($svcLog());
    $r2 = $ping();
    eq($r2['status'], 200, '2: CLEANUP FAILURE — the request still succeeds');
    ok($has($r2['nonce']) && $has($stuck), '2: …its nonce is stored; the old row simply stays');
    eq($ping($r2['nonce'], $r2['ts'])['status'], 409, '2: …and its replay is REFUSED');
    $lines = array_slice($svcLog(), $before);
    ok(count($lines) >= 1 && strpos($lines[0], '[service] nonce.prune_failed errno=1644') !== false && strpos(implode("\n", $lines), 'synthetic') === false,
       '2: …logged as nonce.prune_failed errno=1644, without the database message');
    $a->query('DROP TRIGGER trg_no_delete');

    /* Off switch. */
    $writeConf(['QQ_SERVICE_NONCE_PRUNE_EVERY' => 0]);
    $kept = $aged(5000, time());
    eq($ping()['status'], 200, '2: PRUNE_EVERY = 0 …');
    ok($has($kept), '2: …never prunes');
}

if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    $label  ($asserts assertions)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
