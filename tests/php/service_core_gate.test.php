<?php
/**
 * ── Service API — the THREE-core acceptance gate (QQ R1 Loop #7) ───────────
 *
 * Run:
 *   php tests/php/service_core_gate.test.php                      (part 1 only)
 *   DC_SERVICE_TEST_DB_HOST=127.0.0.1 DC_SERVICE_TEST_DB_PORT=33191 \
 *   DC_SERVICE_TEST_DB_USER=root DC_SERVICE_TEST_DB_PASS= \
 *   php tests/php/service_core_gate.test.php                      (parts 1 + 2)
 *
 * The gate vouches for quo-parser-core.js, quo-pricing-core.js and
 * quo-quote-core.js together. Every expected hash, contract and version here
 * is computed FROM THE FILES beside service.php, never written as a literal.
 *
 *   A  all three current                      → accepted
 *   B  parser hash differs                    → rejected
 *   C  pricing hash differs                   → rejected
 *   D  quote hash differs                     → rejected
 *   E  a mixed set                            → rejected unless that exact set is listed
 *   F  a core missing (claim, or server file) → rejected
 *   G  QUO unavailable                        → unknown, never accepted (QQ backend side:
 *                                               tests/Feature/QuotationCreateTest.php; here: the
 *                                               guard refuses a request it cannot evaluate)
 *   H  an older core                          → accepted ONLY via an exact listed combination
 *
 * Part 2 (THROWAWAY MySQL only; SKIPPED without DC_SERVICE_TEST_DB_HOST/PORT —
 * a skip is not a pass): the shipped files over real HTTP. Reads stay ungated.
 *
 * All data is synthetic. Nothing here contacts a real server.
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);
$label = 'service API — three-core acceptance gate';

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

require_once "$ROOT/service_auth.php";
require_once "$ROOT/service_actions.php";
$LOG = [];
$GLOBALS['DC_SERVICE_LOG_SINK'] = function ($l) use (&$LOG) { $LOG[] = $l; };

$TMP = sys_get_temp_dir() . '/dc-core-gate-' . getmypid();
$dirs = [];
$mkdir = function (string $name, array $files) use ($TMP, &$dirs) {
    $d = "$TMP/$name"; @mkdir($d, 0777, true); $dirs[] = $d;
    foreach ($files as $f => $bytes) file_put_contents("$d/$f", $bytes);
    return $d;
};
register_shutdown_function(function () use ($TMP, &$dirs) {
    foreach ($dirs as $d) { foreach ((array)glob("$d/*") as $f) @unlink($f); @rmdir($d); }
    @rmdir($TMP);
});

/* The three shipped cores, read from the files. */
$FILES = ['parser' => 'quo-parser-core.js', 'pricing' => 'quo-pricing-core.js', 'quote' => 'quo-quote-core.js'];
$SRC = []; $SHA = []; $VER = []; $CON = [];
foreach ($FILES as $core => $file) {
    $SRC[$core] = (string)file_get_contents("$ROOT/$file");
    $SHA[$core] = hash('sha256', $SRC[$core]);
    $U = strtoupper($core);
    $VER[$core] = preg_match("/const QUO_{$U}_CORE_VERSION\\s*=\\s*'([0-9.]+)'/", $SRC[$core], $m) ? $m[1] : null;
    $CON[$core] = preg_match("/^const QUO_{$U}_CORE_CONTRACT\\s*=\\s*(\\d+);/m", $SRC[$core], $m) ? (int)$m[1] : null;
    ok($SRC[$core] !== '' && $VER[$core] !== null && $CON[$core] !== null, "1: $file exists and declares a version ({$VER[$core]}) and a contract ({$CON[$core]})");
}
eq(array_keys(DC_SERVICE_CORES), ['parser', 'pricing', 'quote'], '1: the gate knows exactly three cores');
foreach ($FILES as $core => $file) eq(DC_SERVICE_CORES[$core][0], $file, "1: $core core is $file");
$OLD = ['parser' => hash('sha256', 'synthetic older parser core'), 'pricing' => hash('sha256', 'synthetic older pricing core'), 'quote' => hash('sha256', 'synthetic older quote core')];
$claim = fn ($core, $sha = null, $contract = null, $v = null) => ['version' => $v ?? $VER[$core], 'contract' => $contract ?? $CON[$core], 'sha256' => $sha ?? $SHA[$core]];
$all = fn (array $over = []) => array_merge(['parser' => $claim('parser'), 'pricing' => $claim('pricing'), 'quote' => $claim('quote')], $over);
$body = fn ($cores) => json_encode(['actor' => ['sub' => 7, 'username' => 'u'], 'params' => (object)[]] + ($cores === '__none' ? [] : ['client' => ['cores' => $cores]]));
$combo = fn (array $c, $reason = 'synthetic rollout', $date = '2026-11-11') => dc_service_core_allow_list(['combinations' => [
    ['parser' => ['sha256' => $c['parser']['sha256'], 'contract' => $c['parser']['contract']],
     'pricing' => ['sha256' => $c['pricing']['sha256'], 'contract' => $c['pricing']['contract']],
     'quote' => ['sha256' => $c['quote']['sha256'], 'contract' => $c['quote']['contract']], 'reason' => $reason, 'date' => $date]]]);
$none = ['combinations' => []];

// ══ 1 · server cores ═══════════════════════════════════════════════════════
$GOOD = $mkdir('good', ['quo-parser-core.js' => $SRC['parser'], 'quo-pricing-core.js' => $SRC['pricing'], 'quo-quote-core.js' => $SRC['quote']]);
$S = dc_service_server_cores($GOOD);
eq($S, ['parser' => ['sha256' => $SHA['parser'], 'contract' => $CON['parser']], 'pricing' => ['sha256' => $SHA['pricing'], 'contract' => $CON['pricing']],
        'quote' => ['sha256' => $SHA['quote'], 'contract' => $CON['quote']]], '1: the server reads its three cores: SHA-256 of the bytes + contract from the file');
eq(dc_service_server_cores($ROOT), $S, '1: …the same for the files beside service.php');
$NOQUOTE = $mkdir('noquote', ['quo-parser-core.js' => $SRC['parser'], 'quo-pricing-core.js' => $SRC['pricing']]);
eq(dc_service_server_cores($NOQUOTE)['quote'], null, '1: quote core file MISSING → unknown');
$QC2 = $mkdir('quote2', ['quo-parser-core.js' => $SRC['parser'], 'quo-pricing-core.js' => $SRC['pricing'],
                         'quo-quote-core.js' => preg_replace('/const QUO_QUOTE_CORE_CONTRACT\s*=\s*\d+;/', 'const QUO_QUOTE_CORE_CONTRACT=99;', $SRC['quote'])]);
eq(dc_service_server_cores($QC2)['quote'], null, '1: a quote core on an unsupported contract → unknown');
$NOCONST = $mkdir('noconst', ['quo-parser-core.js' => preg_replace('/const QUO_PARSER_CORE_CONTRACT\s*=\s*\d+;/', 'let x = 1;', $SRC['parser']),
                              'quo-pricing-core.js' => $SRC['pricing'], 'quo-quote-core.js' => $SRC['quote']]);
eq(dc_service_server_cores($NOCONST)['parser'], null, '1: contract constant absent → unknown');

// ══ 2 · claims from the body ═══════════════════════════════════════════════
eq(dc_service_core_claims($body('__none')), null, '2: no client → no claim');
eq(dc_service_core_claims($body($all())), $all(), '2: a full three-core claim parses');
eq(dc_service_core_claims($body(['parser' => $claim('parser'), 'pricing' => $claim('pricing')])),
   ['parser' => $claim('parser'), 'pricing' => $claim('pricing'), 'quote' => null], '2: a Loop #6 two-core claim is kept, quote null (incomplete)');
eq(dc_service_core_claims($body($all(['quote' => 'x']))), false, '2: a malformed quote claim → malformed');
eq(dc_service_core_claims($body($all(['quote' => $claim('quote', strtoupper($SHA['quote']))]))), false, '2: an upper-case quote hash → malformed');

$v = fn ($claims, $allow = null, $server = null) => dc_service_core_evaluate($claims, $server ?? $S, $allow ?? $none);
$G = fn ($claims, $allow = null, $dir = null) => dc_service_require_accepted_core($claims, $allow ?? $none, $dir ?? $GOOD);

// ══ A ═══════════════════════════════════════════════════════════════════════
eq($v($all()), ['accepted' => true, 'parser' => ['status' => 'current', 'version' => $VER['parser']], 'pricing' => ['status' => 'current', 'version' => $VER['pricing']],
                'quote' => ['status' => 'current', 'version' => $VER['quote']], 'reason' => 'accepted'], 'A: all three current → accepted');
eq($G($all()), null, 'A: …the guard lets it through');
// ══ B C D ═══════════════════════════════════════════════════════════════════
foreach (['B' => 'parser', 'C' => 'pricing', 'D' => 'quote'] as $L => $core) {
    $r = $v($all([$core => $claim($core, $OLD[$core])]));
    eq([$r['accepted'], $r[$core]['status'], $r['reason']], [false, 'unknown_hash', 'mixed_versions'], "$L: $core hash differs → rejected (mixed_versions)");
    eq($G($all([$core => $claim($core, $OLD[$core])])), ['error' => 'core_not_accepted', 'reason' => 'mixed_versions'], "$L: …the guard refuses");
    eq($v($all([$core => $claim($core, null, $CON[$core] + 1)]))['reason'], 'contract_mismatch', "$L: right $core hash on another contract → contract_mismatch");
}
eq($v(['parser' => $claim('parser', $OLD['parser']), 'pricing' => $claim('pricing', $OLD['pricing']), 'quote' => $claim('quote', $OLD['quote'])])['reason'], 'not_accepted',
   'B–D: all three unknown → not_accepted');
// ══ E ═══════════════════════════════════════════════════════════════════════
$MIX = $all(['pricing' => $claim('pricing', $OLD['pricing'], null, '0.9.0')]);
eq($v($MIX)['accepted'], false, 'E: mixed set (parser + quote current, pricing older) → rejected');
$r = $v($MIX, $combo($MIX));
eq([$r['accepted'], $r['pricing']['status'], $r['reason']], [true, 'unknown_hash', 'combination_listed'], 'E: …accepted when that EXACT set is listed');
eq($G($MIX, $combo($MIX)), null, 'E: …the guard passes');
eq($v($all(['quote' => $claim('quote', $OLD['quote'])]), $combo($MIX))['accepted'], false, 'E: a listed set does not accept another mix');
$swapped = $MIX; $swapped['quote']['contract'] = $CON['quote'] + 1;
eq($v($swapped, $combo($MIX))['accepted'], false, 'E: …nor the same hashes on another contract');
foreach (['no reason' => ['', '2026-11-11'], 'no date' => ['x', ''], 'bad date' => ['x', '11/11/2026']] as $what => [$why, $date]) {
    eq($combo($MIX, $why, $date), $none, "E: an undocumented combination ($what) is ignored");
}
eq(dc_service_core_allow_list(['combinations' => [['parser' => ['sha256' => $SHA['parser'], 'contract' => 1], 'pricing' => ['sha256' => $OLD['pricing'], 'contract' => 1], 'reason' => 'x', 'date' => '2026-11-11']]]),
   $none, 'E: a combination without the quote core is ignored');
// ══ F ═══════════════════════════════════════════════════════════════════════
$two = ['parser' => $claim('parser'), 'pricing' => $claim('pricing'), 'quote' => null];
$r = $v($two);
eq([$r['accepted'], $r['quote']['status'], $r['reason']], [false, 'missing', 'claim_incomplete'], 'F: quote claim MISSING (a Loop #6 client) → rejected');
eq($G($two), ['error' => 'core_not_accepted', 'reason' => 'claim_incomplete'], 'F: …guard refuses');
foreach (['quote file missing' => $NOQUOTE, 'quote on an unsupported contract' => $QC2, 'parser constant absent' => $NOCONST] as $what => $dir) {
    $r = dc_service_core_evaluate($all(), dc_service_server_cores($dir), $none);
    eq([$r['accepted'], $r['reason']], [false, 'server_core_unknown'], "F: server $what → rejected");
    eq(dc_service_core_evaluate($all(), dc_service_server_cores($dir), $combo($all()))['accepted'], false, "F: server $what → not even a listed combination accepts");
}
// ══ G ═══════════════════════════════════════════════════════════════════════
eq($v(null)['accepted'], null, 'G: no claim → accepted null (unknown, not verified)');
eq($G(null), ['error' => 'core_not_accepted', 'reason' => 'no_claim'], 'G: …null is never accepted by the guard');
eq($G(false), ['error' => 'core_not_accepted', 'reason' => 'claim_malformed'], 'G: a malformed claim is refused');
// ══ H ═══════════════════════════════════════════════════════════════════════
$OLDSET = ['parser' => $claim('parser', $OLD['parser'], null, '1.0.0'), 'pricing' => $claim('pricing'), 'quote' => $claim('quote')];
eq($v($OLDSET)['accepted'], false, 'H: an OLDER parser alone → rejected');
eq(dc_service_core_allow_list(['parser' => [['sha256' => $OLD['parser'], 'contract' => 1, 'reason' => 'x', 'date' => '2026-11-11']]]), $none,
   'H: the Loop #6 per-core listing is no longer read (an older core needs a combination)');
eq(dc_service_core_allow_list(['pairs' => [['parser' => ['sha256' => $OLD['parser'], 'contract' => 1], 'pricing' => ['sha256' => $SHA['pricing'], 'contract' => 1], 'reason' => 'x', 'date' => '2026-11-11']]]), $none,
   'H: …nor the Loop #6 pair listing');
eq($v($OLDSET, $combo($OLDSET))['reason'], 'combination_listed', 'H: the older parser accepted via its exact listed combination');
eq($v($OLDSET, dc_service_core_allow_list([]))['accepted'], false, 'H: combination REMOVED → refused again');
$sample = include "$ROOT/service_config.sample.php";
eq(dc_service_core_allow_list($sample['QQ_SERVICE_ACCEPTED_CORES'] ?? null), $none, 'H: the sample lists nothing');
eq(dc_service_settings(['QQ_SERVICE_ENABLED' => 'true', 'QQ_SERVICE_SECRET' => 'base64:' . base64_encode(str_repeat('k', 32))])['core_allow'] ?? null, $none, 'H: empty by default');
foreach (['accepted', 'combination_listed', 'no_claim', 'claim_malformed', 'claim_incomplete', 'server_core_unknown', 'contract_mismatch', 'mixed_versions', 'not_accepted'] as $w) {
    ok(preg_match('/^[A-Za-z_]{1,40}$/D', $w) === 1, "reason $w is a plain word");
}
eq(DC_SERVICE_CORE_GATED_ACTIONS, ['contacts.link', 'quotations.create'], 'GUARD: both write actions are gated');

// ══ 4 · the guard inside the write actions, before any query ═══════════════
$noDb = new stdClass();
eq(dc_service_contacts_link($noDb, ['companyId' => 901], ['sub' => 7, 'username' => 'u'], ['claims' => $two, 'core_allow' => $none]),
   ['error' => 'core_not_accepted', 'reason' => 'claim_incomplete'], 'GUARD: contacts.link with a two-core claim is refused before any query');
require_once "$ROOT/service_quotations.php";
eq(dc_service_quotations_create($noDb, ['companyId' => 901], ['sub' => 7, 'username' => 'u'], ['claims' => $MIX, 'core_allow' => $none, 'create_enabled' => true]),
   ['error' => 'core_not_accepted', 'reason' => 'mixed_versions'], 'GUARD: quotations.create with a mixed set is refused before any query');
eq(dc_service_quotations_create($noDb, [], ['sub' => 7, 'username' => 'u'], ['claims' => $all(), 'core_allow' => $none]),
   ['error' => 'create_disabled'], 'GUARD: with accepted cores but the switch off → create_disabled, before any query');
eq(dc_service_ping($noDb, [], ['sub' => 7, 'username' => 'u'], ['claims' => false])['data']['service'] ?? null, 'quo-service', 'READ: ping does not consult the guard');

// ══ 5 · over HTTP (throwaway MySQL) ════════════════════════════════════════
$H = getenv('DC_SERVICE_TEST_DB_HOST'); $P = getenv('DC_SERVICE_TEST_DB_PORT');
$httpRan = false;
if ($H !== false && $H !== '' && $P !== false && $P !== '') {
    $httpRan = true;
    $P = (int)$P; $U = getenv('DC_SERVICE_TEST_DB_USER') ?: 'root'; $W = getenv('DC_SERVICE_TEST_DB_PASS'); if ($W === false) $W = '';
    mysqli_report(MYSQLI_REPORT_OFF);
    $root = @new mysqli($H, $U, $W, null, $P);
    if (!$root || $root->connect_errno) { echo "\n  FAIL  $label — database configured but unreachable\n\n"; exit(1); }
    $PID = getmypid(); $QDB = "dc_coregate_q_{$PID}"; $UDB = "dc_coregate_u_{$PID}"; $RO_USER = "dc_cg_ro_{$PID}"; $RO_PASS = bin2hex(random_bytes(12));
    foreach ([$QDB, $UDB] as $d) { $ex = $root->query("SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$d}'"); if ($ex && $ex->num_rows) { echo "\n  FAIL  {$d} exists\n\n"; exit(1); } }
    $SB = sys_get_temp_dir() . "/dc-core-gate-sb-{$PID}"; @mkdir("$SB/app/Handoff/Contract", 0777, true);
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
    $q = new mysqli($H, $U, $W, $QDB, $P); $q->set_charset('utf8mb4');
    $q->query("CREATE TABLE companies (id int NOT NULL AUTO_INCREMENT, name varchar(200) NOT NULL, short_code varchar(50) DEFAULT NULL, phone varchar(100) DEFAULT NULL,
               address text, created_at datetime DEFAULT CURRENT_TIMESTAMP, updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB");
    $q->query("CREATE TABLE quotations (id int NOT NULL AUTO_INCREMENT, company_id int DEFAULT NULL, ref_no varchar(100) NOT NULL, quote_date date DEFAULT NULL,
               items longtext NOT NULL, total_amount decimal(12,2) DEFAULT NULL, created_at datetime DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB");
    $q->query("CREATE TABLE diameter_settings (id int NOT NULL AUTO_INCREMENT, product_type varchar(50) NOT NULL, material varchar(50) NOT NULL, size_type varchar(50) DEFAULT NULL,
               size varchar(50) NOT NULL, diameter decimal(10,3) NOT NULL, is_active tinyint(1) NOT NULL DEFAULT '1', PRIMARY KEY (id)) ENGINE=InnoDB");
    $section = function ($file) use ($ROOT) { preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', file_get_contents("$ROOT/migrations/$file"), $m); return $m[1] ?? ''; };
    foreach (['2026-11-10-create-service-request-nonces.sql', '2026-11-10-create-company-whatsapp-contacts.sql'] as $mf) {
        $q->multi_query($section($mf)); do { if ($x = $q->store_result()) $x->free(); } while ($q->more_results() && $q->next_result());
    }
    $q->query("INSERT INTO companies (id, name, short_code) VALUES (901, 'Example Trading Sdn Bhd', 'EXT')");
    $root->query("CREATE TABLE {$UDB}.users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(255) NOT NULL, username VARCHAR(20) NOT NULL, role VARCHAR(16) NOT NULL DEFAULT 'member',
        password VARCHAR(255) NOT NULL, must_change_password TINYINT(1) NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1, is_legacy_placeholder TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (id), UNIQUE KEY users_username_unique (username)) ENGINE=InnoDB");
    $root->query("INSERT INTO {$UDB}.users (id, name, username, password) VALUES (7, 'Example User', 'exampleuser', 'x-not-a-hash')");
    $root->query("CREATE USER '{$RO_USER}'@'%' IDENTIFIED BY '{$RO_PASS}'");
    $root->query("GRANT SELECT ON {$UDB}.users TO '{$RO_USER}'@'%'");
    foreach (['service.php', 'service_auth.php', 'service_actions.php', 'service_quotations.php', 'quotation_store.php', 'dnc_handoff.php', 'auth.php',
              'quo-parser-core.js', 'quo-pricing-core.js', 'quo-quote-core.js',
              'app/Handoff/Contract/HandoffToken.php', 'app/Handoff/Contract/InvalidHandoffToken.php'] as $f) copy("$ROOT/$f", "$SB/$f");
    file_put_contents("$SB/db.php", "<?php function getDB(){ \$d = new mysqli(" . var_export($H, true) . ',' . var_export($U, true) . ',' . var_export($W, true) . ','
        . var_export($QDB, true) . ",{$P}); if (\$d->connect_error) { die('x'); } \$d->set_charset('utf8mb4'); return \$d; }\n");
    file_put_contents("$SB/dnc_config.php", '<?php return ' . var_export(['DNC_HANDOFF_ENABLED' => 'false', 'DNC_HANDOFF_SECRET' => 'base64:' . base64_encode(random_bytes(32)),
        'DNC_USERS_DB_HOST' => $H, 'DNC_USERS_DB_PORT' => (string)$P, 'DNC_USERS_DB_DATABASE' => $UDB, 'DNC_USERS_DB_USERNAME' => $RO_USER, 'DNC_USERS_DB_PASSWORD' => $RO_PASS], true) . ';');
    $KEY = random_bytes(32);
    $CONF = ['QQ_SERVICE_ENABLED' => 'true', 'QQ_SERVICE_KEY_ID' => 'qq-backend-1', 'QQ_SERVICE_SECRET' => 'base64:' . base64_encode($KEY), 'QQ_SERVICE_NONCE_PRUNE_EVERY' => 0];
    $writeConf = function (array $extra = []) use ($SB, $CONF) { file_put_contents("$SB/service_config.php", '<?php return ' . var_export($CONF + $extra, true) . ';'); };
    $writeConf();
    $PORT = 38000 + ($PID % 900);
    $env = []; foreach (getenv() as $k => $vv) if (strpos($k, 'DNC_') !== 0 && strpos($k, 'QQ_') !== 0) $env[$k] = $vv;
    $srv = proc_open([PHP_BINARY, '-d', "error_log=$SB/php-error.log", '-d', 'log_errors=1', '-d', 'opcache.enable_cli=0', '-S', "127.0.0.1:{$PORT}", '-t', $SB],
                     [1 => ['file', "$SB/server.out", 'w'], 2 => ['file', "$SB/server.err", 'w']], $pipes, $SB, $env);
    $up = false;
    for ($i = 0; $i < 60 && !$up; $i++) { $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3); if ($fp) { fclose($fp); $up = true; } else usleep(200000); }
    ok($up, 'HTTP: server up');
    $call = function (string $action, array $params, $cores, array $o = []) use ($PORT, $KEY) {
        $env = ['actor' => ['sub' => 7, 'username' => 'exampleuser'], 'requestId' => 'req_cg', 'params' => (object)$params];
        if ($cores !== '__none') $env['client'] = ['cores' => $cores];
        $body = json_encode($env); $signed = $o['signBody'] ?? $body;
        $ts = (string)time(); $nonce = bin2hex(random_bytes(16));
        $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', "qqs1\nPOST\n$action\n$ts\n$nonce\n" . hash('sha256', $signed), $KEY, true)), '+/', '-_'), '=');
        $h = ['Content-Type' => 'application/json', 'X-QQS-Key-Id' => 'qq-backend-1', 'X-QQS-Timestamp' => $ts, 'X-QQS-Nonce' => $nonce, 'X-QQS-Signature' => $sig] + ($o['headers'] ?? []);
        $s = fsockopen('127.0.0.1', $PORT, $en, $es, 10);
        $req = "POST /service.php?action=" . rawurlencode($action) . " HTTP/1.1\r\nHost: quo.test.invalid\r\nConnection: close\r\nContent-Length: " . strlen($body) . "\r\n";
        foreach ($h as $k => $vv) $req .= "$k: $vv\r\n";
        fwrite($s, $req . "\r\n" . $body);
        $raw = ''; while (!feof($s)) $raw .= fread($s, 65536); fclose($s);
        [$head, $content] = array_pad(explode("\r\n\r\n", $raw, 2), 2, '');
        preg_match('#^HTTP/\S+ (\d+)#', $head, $m);
        return ['status' => (int)($m[1] ?? 0), 'json' => json_decode($content, true)];
    };
    $links = fn () => (int)$q->query('SELECT COUNT(*) FROM company_whatsapp_contacts')->fetch_row()[0];
    $phone = 60000000001;
    $link = function ($cores) use ($call, &$phone) { return $call('contacts.link', ['companyId' => 901, 'waPhone' => (string)($phone++), 'chatKind' => 'individual'], $cores); };
    if ($up) {
        $r = $call('ping', [], $all());
        eq([$r['status'], $r['json']['core']['accepted'] ?? 'x', $r['json']['core']['quote']['status'] ?? null, $r['json']['core']['quote']['version'] ?? null],
           [200, true, 'current', $VER['quote']], 'HTTP A: three current cores → accepted; quote version echoed from the claim');
        eq([$link($all())['status'], $links()], [200, 1], 'HTTP A: …contacts.link allowed');
        foreach (['B' => 'parser', 'C' => 'pricing', 'D' => 'quote'] as $L => $core) {
            $r = $link($all([$core => $claim($core, $OLD[$core])]));
            eq([$r['status'], $r['json']['error']['code'] ?? null, $r['json']['core'][$core]['status'] ?? null], [412, 'core_not_accepted', 'unknown_hash'], "HTTP $L: $core mismatch → link 412, nothing written");
        }
        $r = $link($two);
        eq([$r['status'], $r['json']['error']['reason'] ?? null], [412, 'claim_incomplete'], 'HTTP F: a two-core (Loop #6) claim → 412 claim_incomplete');
        foreach (['ping' => [], 'diameter_settings.get' => [], 'companies.search' => ['q' => 'Example'], 'whatsapp_template.get' => []] as $a => $pp) {
            $r = $call($a, $pp, $MIX);
            eq([$r['status'], $r['json']['ok'] ?? null, $r['json']['core']['accepted'] ?? 'x'], [200, true, false], "HTTP: reads stay ungated — $a answers with core.accepted false");
        }
        $r = $call('quotations.create', [], $MIX);
        eq([$r['status'], $r['json']['error']['code'] ?? null], [412, 'core_not_accepted'], 'HTTP E: quotations.create with a mixed set → 412');
        $writeConf(['QQ_SERVICE_ACCEPTED_CORES' => ['combinations' => [['parser' => ['sha256' => $MIX['parser']['sha256'], 'contract' => $MIX['parser']['contract']],
            'pricing' => ['sha256' => $MIX['pricing']['sha256'], 'contract' => $MIX['pricing']['contract']], 'quote' => ['sha256' => $MIX['quote']['sha256'], 'contract' => $MIX['quote']['contract']],
            'reason' => 'synthetic', 'date' => '2026-11-11']]]]);
        eq([$link($MIX)['status'], $call('ping', [], $MIX)['json']['core']['reason'] ?? null], [200, 'combination_listed'], 'HTTP E/H: the exact combination listed in service_config.php → accepted');
        $writeConf();
        eq($link($MIX)['status'], 412, 'HTTP H: listing removed → refused on the next request');
        eq($links(), 2, 'HTTP: exactly the two accepted links were written');
        rename("$SB/quo-quote-core.js", "$SB/quo-quote-core.js.gone");
        $r = $call('ping', [], $all());
        eq([$r['json']['core']['accepted'] ?? 'x', $r['json']['core']['quote']['status'] ?? null, $r['json']['core']['reason'] ?? null], [false, 'server_unknown', 'server_core_unknown'],
           'HTTP F: quote core missing on the server → server_core_unknown, ping still answers');
        eq($link($all())['status'], 412, 'HTTP F: …and the link is refused');
        rename("$SB/quo-quote-core.js.gone", "$SB/quo-quote-core.js");
        $r = $call('ping', [], '__none', ['headers' => ['X-QQ-Quote-Core' => "{$VER['quote']}; contract={$CON['quote']}; sha256={$SHA['quote']}"]]);
        eq(array_key_exists('accepted', $r['json']['core'] ?? []) ? $r['json']['core']['accepted'] : 'x', null, 'TAMPER: a quote claim in a header is ignored (no claim)');
        $good = json_encode(['actor' => ['sub' => 7, 'username' => 'exampleuser'], 'requestId' => 'req_cg', 'params' => (object)[], 'client' => ['cores' => $MIX]]);
        eq($call('contacts.link', [], $all(), ['signBody' => $good])['status'], 401, 'TAMPER: claims swapped after signing → 401');
    }
}

eq(array_values(array_filter($LOG, fn ($l) => strpos($l, 'nonce.') !== false)), [], 'no nonce housekeeping happened in the pure part');

if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    $label  ($asserts assertions" . ($httpRan ? ', incl. HTTP + MySQL' : '; HTTP part SKIPPED — no DC_SERVICE_TEST_DB_HOST/PORT, a skip is not a pass') . ")\n\n";
