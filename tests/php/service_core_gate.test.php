<?php
/**
 * ── Service API — the core-version acceptance gate ─────────────────────────
 *
 * Run:
 *   php tests/php/service_core_gate.test.php                      (part 1 only)
 *   DC_SERVICE_TEST_DB_HOST=127.0.0.1 DC_SERVICE_TEST_DB_PORT=33171 \
 *   DC_SERVICE_TEST_DB_USER=root DC_SERVICE_TEST_DB_PASS= \
 *   php tests/php/service_core_gate.test.php                      (parts 1 + 2)
 *
 * Part 1 (no database): the verdict functions against copies of the shipped
 * cores in a temp directory — exact hashes, unknown parser / pricing hash,
 * operator-listed older hashes (and their removal), mixed versions and listed
 * pairs, contract mismatch, missing / malformed claims, a core file missing
 * or unreadable on the server, and the guard.
 *
 * Part 2 (THROWAWAY MySQL only; SKIPPED without DC_SERVICE_TEST_DB_HOST and
 * DC_SERVICE_TEST_DB_PORT — a skip is not a pass): the shipped files over real
 * HTTP. The `core` object on every answer, read-only actions still answering
 * when the core is rejected, contacts.link refused with 412 core_not_accepted
 * and nothing written, operator listing via service_config.php, claims sent
 * anywhere but the signed body ignored, a tampered claim breaking the
 * signature, a core file missing on the server.
 *
 * All data is synthetic. Nothing here contacts a real server.
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);
$label = 'service API — core-version acceptance gate';

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

$PARSER  = (string)file_get_contents("$ROOT/quo-parser-core.js");
$PRICING = (string)file_get_contents("$ROOT/quo-pricing-core.js");
ok($PARSER !== '' && $PRICING !== '', '1: both shipped cores exist');
$contractOf = fn ($src, $c) => preg_match('/^const ' . $c . ' = (\d+);/m', $src, $m) ? (int)$m[1] : null;
eq([$contractOf($PARSER, 'QUO_PARSER_CORE_CONTRACT'), $contractOf($PRICING, 'QUO_PRICING_CORE_CONTRACT')], [1, 1], '1: both shipped cores declare contract 1');
$P_SHA = hash('sha256', $PARSER); $Q_SHA = hash('sha256', $PRICING);
$OLD_P = hash('sha256', 'synthetic older parser core');  $OLD_Q = hash('sha256', 'synthetic older pricing core');
$claim = fn ($sha, $contract = 1, $v = '1.0.0') => ['version' => $v, 'contract' => $contract, 'sha256' => $sha];
$both  = fn ($p, $q) => ['parser' => $p, 'pricing' => $q];
$body  = fn ($cores) => json_encode(['actor' => ['sub' => 7, 'username' => 'u'], 'params' => (object)[]] + ($cores === '__none' ? [] : ['client' => ['cores' => $cores]]));

// ══ 1 · server cores ═══════════════════════════════════════════════════════
$GOOD = $mkdir('good', ['quo-parser-core.js' => $PARSER, 'quo-pricing-core.js' => $PRICING]);
$S = dc_service_server_cores($GOOD);
eq($S, ['parser' => ['sha256' => $P_SHA, 'contract' => 1], 'pricing' => ['sha256' => $Q_SHA, 'contract' => 1]], '1: the server reads its own cores: SHA-256 of the bytes + contract from the file');
eq(dc_service_server_cores($ROOT), $S, '1: …the same for the files beside service.php');
$NOPARSER = $mkdir('noparser', ['quo-pricing-core.js' => $PRICING]);
eq(dc_service_server_cores($NOPARSER)['parser'], null, '1: parser file MISSING → unknown');
$EMPTY = $mkdir('empty', ['quo-parser-core.js' => '', 'quo-pricing-core.js' => $PRICING]);
eq(dc_service_server_cores($EMPTY)['parser'], null, '1: an empty file → unknown');
$NOCONST = $mkdir('noconst', ['quo-parser-core.js' => str_replace('const QUO_PARSER_CORE_CONTRACT = 1;', 'let x = 1;', $PARSER), 'quo-pricing-core.js' => $PRICING]);
eq(dc_service_server_cores($NOCONST)['parser'], null, '1: contract constant absent → unknown');
$TWICE = $mkdir('twice', ['quo-parser-core.js' => $PARSER . "\nconst QUO_PARSER_CORE_CONTRACT = 1;\n", 'quo-pricing-core.js' => $PRICING]);
eq(dc_service_server_cores($TWICE)['parser'], null, '1: contract constant declared twice → unknown');
$C2 = $mkdir('contract2', ['quo-parser-core.js' => $PARSER, 'quo-pricing-core.js' => str_replace('const QUO_PRICING_CORE_CONTRACT = 1;', 'const QUO_PRICING_CORE_CONTRACT = 2;', $PRICING)]);
eq(dc_service_server_cores($C2)['pricing'], null, '1: a deployed core on a contract this service does not support → unknown');
$EVIL = $mkdir('evil', ['quo-parser-core.js' => "const QUO_PARSER_CORE_CONTRACT = 1;\nrequire('child_process').execSync('exit 7');\n", 'quo-pricing-core.js' => $PRICING]);
ok(is_array(dc_service_server_cores($EVIL)['parser']), '1: the file is read as text only — its JavaScript is never executed');

// ══ 2 · claims come from the body, parsed strictly ═════════════════════════
eq(dc_service_core_claims($body('__none')), null, '2: no client → no claim (null)');
eq(dc_service_core_claims('{"actor":{"sub":7,"username":"u"},"client":{}}'), null, '2: client without cores → no claim');
eq(dc_service_core_claims('{"actor":{"sub":7,"username":"u"},"client":{"cores":null}}'), null, '2: cores null → no claim');
eq(dc_service_core_claims($body($both($claim($P_SHA), $claim($Q_SHA)))), $both($claim($P_SHA), $claim($Q_SHA)), '2: a full claim parses');
eq(dc_service_core_claims($body(['parser' => $claim($P_SHA)])), ['parser' => $claim($P_SHA), 'pricing' => null], '2: a claim for one core only is kept as incomplete');
foreach ([
    'client a list'      => '{"client":[1]}',
    'cores a string'     => '{"client":{"cores":"x"}}',
    'parser a string'    => $body(['parser' => 'x', 'pricing' => $claim($Q_SHA)]),
    'sha upper-case'     => $body($both($claim(strtoupper($P_SHA)), $claim($Q_SHA))),
    'sha 63 hex'         => $body($both($claim(substr($P_SHA, 1)), $claim($Q_SHA))),
    'contract a string'  => $body($both($claim($P_SHA, '1'), $claim($Q_SHA))),
    'contract zero'      => $body($both($claim($P_SHA, 0), $claim($Q_SHA))),
    'version not dotted' => $body($both($claim($P_SHA, 1, 'latest'), $claim($Q_SHA))),
    'version missing'    => $body($both(['contract' => 1, 'sha256' => $P_SHA], $claim($Q_SHA))),
] as $what => $raw) {
    eq(dc_service_core_claims($raw), false, "2: MALFORMED claim ($what) → false");
}

// ══ 3 · the verdict ════════════════════════════════════════════════════════
$none = ['parser' => [], 'pricing' => [], 'pairs' => []];
$v = fn ($claims, $allow = null, $server = null) => dc_service_core_evaluate($claims, $server ?? $S, $allow ?? $none);
$G = fn ($claims, $allow = null, $dir = null) => dc_service_require_accepted_core($claims, $allow ?? $none, $dir ?? $GOOD);

// A
$r = $v($both($claim($P_SHA), $claim($Q_SHA)));
eq($r, ['accepted' => true, 'parser' => ['status' => 'current', 'version' => '1.0.0'], 'pricing' => ['status' => 'current', 'version' => '1.0.0'], 'reason' => 'accepted'],
   'A: EXACT hashes of both deployed cores → accepted');
eq($G($both($claim($P_SHA), $claim($Q_SHA))), null, 'A: …and the guard lets it through');
// B
$r = $v($both($claim($OLD_P), $claim($Q_SHA)));
eq([$r['accepted'], $r['parser']['status'], $r['pricing']['status'], $r['reason']], [false, 'unknown_hash', 'current', 'mixed_versions'], 'B: UNKNOWN parser hash → rejected');
eq($G($both($claim($OLD_P), $claim($Q_SHA))), ['error' => 'core_not_accepted', 'reason' => 'mixed_versions'], 'B: …and the GUARD REFUSES');
// C
$r = $v($both($claim($P_SHA), $claim($OLD_Q)));
eq([$r['accepted'], $r['parser']['status'], $r['pricing']['status']], [false, 'current', 'unknown_hash'], 'C: UNKNOWN pricing hash → rejected');
eq($G($both($claim($P_SHA), $claim($OLD_Q)))['error'] ?? null, 'core_not_accepted', 'C: …guard refuses');
$r = $v($both($claim($OLD_P), $claim($OLD_Q)));
eq([$r['accepted'], $r['reason']], [false, 'not_accepted'], 'B/C: both unknown → rejected (not_accepted)');
// D
$entry = fn ($sha, $contract = 1) => ['sha256' => $sha, 'contract' => $contract, 'reason' => 'synthetic rollout overlap', 'date' => '2026-11-11'];
$listP = dc_service_core_allow_list(['parser' => [$entry($OLD_P)]]);
$r = $v($both($claim($OLD_P, 1, '0.9.0'), $claim($Q_SHA)), $listP);
eq([$r['accepted'], $r['parser'], $r['pricing']['status'], $r['reason']], [true, ['status' => 'listed', 'version' => '0.9.0'], 'current', 'accepted'],
   'D: an OLDER parser hash LISTED by the operator → accepted');
eq($G($both($claim($OLD_P), $claim($Q_SHA)), $listP), null, 'D: …guard passes');
eq($v($both($claim($OLD_P), $claim($Q_SHA)), dc_service_core_allow_list(['parser' => []]))['accepted'], false, 'D: entry REMOVED → refused again');
eq($v($both($claim($OLD_P), $claim($Q_SHA)), dc_service_core_allow_list(['pricing' => [$entry($OLD_P)]]))['accepted'], false, 'D: listed under the other core → does not count');
eq($v($both($claim($OLD_P), $claim($OLD_Q)), dc_service_core_allow_list(['parser' => [$entry($OLD_P)], 'pricing' => [$entry($OLD_Q)]]))['accepted'], true,
   'D: both older cores listed → accepted');
foreach ([
    'no reason'            => ['sha256' => $OLD_P, 'contract' => 1, 'date' => '2026-11-11'],
    'empty reason'         => ['sha256' => $OLD_P, 'contract' => 1, 'reason' => ' ', 'date' => '2026-11-11'],
    'no date'              => ['sha256' => $OLD_P, 'contract' => 1, 'reason' => 'x'],
    'bad date'             => ['sha256' => $OLD_P, 'contract' => 1, 'reason' => 'x', 'date' => '11/11/2026'],
    'no contract'          => ['sha256' => $OLD_P, 'reason' => 'x', 'date' => '2026-11-11'],
    'contract as a string' => ['sha256' => $OLD_P, 'contract' => '1', 'reason' => 'x', 'date' => '2026-11-11'],
    'upper-case sha'       => ['sha256' => strtoupper($OLD_P), 'contract' => 1, 'reason' => 'x', 'date' => '2026-11-11'],
    'a bare hash string'   => $OLD_P,
] as $what => $bad) {
    eq(dc_service_core_allow_list(['parser' => [$bad]])['parser'], [], "D: an undocumented / malformed operator entry ($what) is ignored");
}
eq(dc_service_core_allow_list('yes'), $none, 'D: a list that is not an array → empty');
eq(dc_service_settings(['QQ_SERVICE_ENABLED' => 'true', 'QQ_SERVICE_SECRET' => 'base64:' . base64_encode(str_repeat('k', 32))])['core_allow'] ?? null, $none,
   'D: the operator list is EMPTY by default');
$sample = include "$ROOT/service_config.sample.php";
eq(dc_service_core_allow_list($sample['QQ_SERVICE_ACCEPTED_CORES'] ?? null), $none, 'D: …and empty in the sample');
// F
$r = $v($both($claim($P_SHA), $claim($OLD_Q)));
eq([$r['accepted'], $r['reason']], [false, 'mixed_versions'], 'F: MIXED (parser current, pricing unknown) → rejected');
$pair = fn ($p, $q, $pc = 1, $qc = 1) => dc_service_core_allow_list(['pairs' => [['parser' => ['sha256' => $p, 'contract' => $pc], 'pricing' => ['sha256' => $q, 'contract' => $qc], 'reason' => 'pilot', 'date' => '2026-11-11']]]);
$r = $v($both($claim($P_SHA), $claim($OLD_Q)), $pair($P_SHA, $OLD_Q));
eq([$r['accepted'], $r['pricing']['status'], $r['reason']], [true, 'unknown_hash', 'pair_listed'], 'F: …accepted when that EXACT PAIR is listed');
eq($v($both($claim($OLD_P), $claim($OLD_Q)), $pair($P_SHA, $OLD_Q))['accepted'], false, 'F: a listed pair does not accept another parser');
eq($v($both($claim($P_SHA), $claim($OLD_P)), $pair($P_SHA, $OLD_Q))['accepted'], false, 'F: …nor another pricing');
eq($v($both($claim($OLD_Q), $claim($P_SHA)), $pair($P_SHA, $OLD_Q))['accepted'], false, 'F: …nor the two swapped');
eq($v($both($claim($P_SHA), $claim($OLD_Q)), dc_service_core_allow_list(['pricing' => [['sha256' => $OLD_Q, 'contract' => 1, 'reason' => 'x']]]))['accepted'], false,
   'F: a pair entry without a date is ignored');
// contract mismatch
$r = $v($both($claim($P_SHA, 2), $claim($Q_SHA)));
eq([$r['accepted'], $r['parser']['status'], $r['reason']], [false, 'contract_mismatch', 'contract_mismatch'], 'CONTRACT: the right hash claimed under another contract → rejected');
eq($v($both($claim($OLD_P, 2), $claim($Q_SHA)), dc_service_core_allow_list(['parser' => [$entry($OLD_P, 2)]]))['accepted'], false,
   'CONTRACT: a per-core listing cannot accept another contract');
eq($v($both($claim($OLD_P, 2), $claim($Q_SHA)), $pair($OLD_P, $Q_SHA, 2, 1))['reason'], 'pair_listed', 'CONTRACT: …only an exact pair listing can');
eq($v($both($claim($OLD_P, 1), $claim($Q_SHA)), $pair($OLD_P, $Q_SHA, 2, 1))['accepted'], false, 'CONTRACT: the pair contract must match too');
// missing / malformed claims
eq($v(null), ['accepted' => null, 'parser' => ['status' => 'absent'], 'pricing' => ['status' => 'absent'], 'reason' => 'no_claim'], 'MISSING: no claim → accepted null (not verified), never true');
eq($G(null), ['error' => 'core_not_accepted', 'reason' => 'no_claim'], 'MISSING: …and the guard refuses null too');
eq($v(false)['accepted'] ?? null, false, 'MALFORMED: a malformed claim → rejected');
eq($G(false), ['error' => 'core_not_accepted', 'reason' => 'claim_malformed'], 'MALFORMED: …guard refuses');
$r = $v(['parser' => $claim($P_SHA), 'pricing' => null]);
eq([$r['accepted'], $r['pricing']['status'], $r['reason']], [false, 'missing', 'claim_incomplete'], 'MISSING: only one core claimed → rejected');
eq($v(['parser' => $claim($P_SHA), 'pricing' => null], $pair($P_SHA, $Q_SHA))['accepted'], false, 'MISSING: …no listing rescues an incomplete claim');
// server core unknown
foreach (['parser file missing' => $NOPARSER, 'parser file empty' => $EMPTY, 'contract constant absent' => $NOCONST, 'pricing on an unsupported contract' => $C2] as $what => $dir) {
    $r = dc_service_core_evaluate($both($claim($P_SHA), $claim($Q_SHA)), dc_service_server_cores($dir), $none);
    eq([$r['accepted'], $r['reason']], [false, 'server_core_unknown'], "SERVER: $what → unknown, NEVER accepted");
    $everything = dc_service_core_allow_list(['parser' => [$entry($P_SHA)], 'pricing' => [$entry($Q_SHA)], 'pairs' => [['parser' => ['sha256' => $P_SHA, 'contract' => 1], 'pricing' => ['sha256' => $Q_SHA, 'contract' => 1], 'reason' => 'x', 'date' => '2026-11-11']]]);
    eq(dc_service_core_evaluate($both($claim($P_SHA), $claim($Q_SHA)), dc_service_server_cores($dir), $everything)['accepted'], false, "SERVER: $what → not even an operator listing makes it accepted");
    eq($G($both($claim($P_SHA), $claim($Q_SHA)), $everything, $dir), ['error' => 'core_not_accepted', 'reason' => 'server_core_unknown'], "SERVER: $what → the guard refuses");
}
/* Each verdict reason is a fixed word that dc_service_refuse() will pass on. */
foreach (['accepted', 'pair_listed', 'no_claim', 'claim_malformed', 'claim_incomplete', 'server_core_unknown', 'contract_mismatch', 'mixed_versions', 'not_accepted'] as $w) {
    ok(preg_match('/^[A-Za-z_]{1,40}$/D', $w) === 1, "reason $w is a plain word");
}
eq(DC_SERVICE_ERRORS['core_not_accepted'] ?? null, [412, 'Client core version is not accepted'], 'GUARD: core_not_accepted is 412 with a fixed message');

// ══ 4 · the guard inside the write action ══════════════════════════════════
/* No database needed: the guard answers before any query. A handle that is not a
   mysqli proves nothing was even attempted. */
$noDb = new stdClass();
eq(dc_service_contacts_link($noDb, ['companyId' => 901, 'waPhone' => '60000000001', 'chatKind' => 'individual'], ['sub' => 7, 'username' => 'u'],
                            ['claims' => $both($claim($OLD_P), $claim($Q_SHA)), 'core_allow' => $none]),
   ['error' => 'core_not_accepted', 'reason' => 'mixed_versions'], 'GUARD: contacts.link with a rejected core is refused before any query');
eq(dc_service_contacts_link($noDb, [], ['sub' => 7, 'username' => 'u'], []), ['error' => 'core_not_accepted', 'reason' => 'no_claim'],
   'GUARD: contacts.link with no claim (and no params) is refused by the guard first');
eq(dc_service_contacts_link($noDb, ['companyId' => 'x'], ['sub' => 7, 'username' => 'u'], ['claims' => $both($claim($P_SHA), $claim($Q_SHA)), 'core_allow' => $none]),
   ['error' => 'validation_failed', 'field' => 'companyId'], 'GUARD: with an accepted core it continues to its own validation');
eq(dc_service_ping($noDb, [], ['sub' => 7, 'username' => 'u'], ['claims' => false])['data']['service'] ?? null, 'quo-service', 'READ: ping does not consult the guard');

// ══ 5 · over HTTP (needs a throwaway MySQL) ════════════════════════════════
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
    ok((int)$q->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='{$QDB}'")->fetch_row()[0] === 5, 'HTTP: schema built from the shipped migrations');
    $q->query("INSERT INTO companies (id, name, short_code) VALUES (901, 'Example Trading Sdn Bhd', 'EXT')");
    $q->query("INSERT INTO diameter_settings (product_type, material, size_type, size, diameter) VALUES ('sagrod', 'MS', 'UNDERSIZE', 'M12', 10.9)");
    $root->query("CREATE TABLE {$UDB}.users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(255) NOT NULL, username VARCHAR(20) NOT NULL, email VARCHAR(255) NULL,
        email_verified_at TIMESTAMP NULL, role VARCHAR(16) NOT NULL DEFAULT 'member', password VARCHAR(255) NOT NULL, must_change_password TINYINT(1) NOT NULL DEFAULT 0,
        password_changed_at TIMESTAMP NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, is_legacy_placeholder TINYINT(1) NOT NULL DEFAULT 0, disabled_at TIMESTAMP NULL,
        last_login_at TIMESTAMP NULL, locale VARCHAR(10) NULL, remember_token VARCHAR(100) NULL, created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
        PRIMARY KEY (id), UNIQUE KEY users_username_unique (username)) ENGINE=InnoDB");
    $root->query("INSERT INTO {$UDB}.users (id, name, username, password) VALUES (7, 'Example User', 'exampleuser', 'x-not-a-hash')");
    $root->query("CREATE USER '{$RO_USER}'@'%' IDENTIFIED BY '{$RO_PASS}'");
    $root->query("GRANT SELECT ON {$UDB}.users TO '{$RO_USER}'@'%'");

    foreach (['service.php', 'service_auth.php', 'service_actions.php', 'dnc_handoff.php', 'auth.php', 'quo-parser-core.js', 'quo-pricing-core.js',
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

    /** One signed call; $cores = client.cores (or '__none'); $o: headers, query, tamper (body sent ≠ body signed). */
    $call = function (string $action, array $params, $cores, array $o = []) use ($PORT, $KEY) {
        $env = ['actor' => ['sub' => 7, 'username' => 'exampleuser'], 'requestId' => 'req_cg', 'params' => (object)$params];
        if ($cores !== '__none') $env['client'] = ['cores' => $cores];
        $body = json_encode($env); $signed = $o['signBody'] ?? $body;
        $ts = (string)time(); $nonce = bin2hex(random_bytes(16));
        $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', "qqs1\nPOST\n$action\n$ts\n$nonce\n" . hash('sha256', $signed), $KEY, true)), '+/', '-_'), '=');
        $h = ['Content-Type' => 'application/json', 'X-QQS-Key-Id' => 'qq-backend-1', 'X-QQS-Timestamp' => $ts, 'X-QQS-Nonce' => $nonce, 'X-QQS-Signature' => $sig] + ($o['headers'] ?? []);
        $s = fsockopen('127.0.0.1', $PORT, $en, $es, 10);
        $req = "POST /service.php?action=" . rawurlencode($action) . ($o['query'] ?? '') . " HTTP/1.1\r\nHost: quo.test.invalid\r\nConnection: close\r\nContent-Length: " . strlen($body) . "\r\n";
        foreach ($h as $k => $vv) $req .= "$k: $vv\r\n";
        fwrite($s, $req . "\r\n" . $body);
        $raw = ''; while (!feof($s)) $raw .= fread($s, 65536); fclose($s);
        [$head, $content] = array_pad(explode("\r\n\r\n", $raw, 2), 2, '');
        preg_match('#^HTTP/\S+ (\d+)#', $head, $m);
        return ['status' => (int)($m[1] ?? 0), 'json' => json_decode($content, true)];
    };
    $links = fn () => (int)$q->query('SELECT COUNT(*) FROM company_whatsapp_contacts')->fetch_row()[0];
    $LINK = ['companyId' => 901, 'waPhone' => '60000000001', 'chatKind' => 'individual'];
    $GOODC = $both($claim($P_SHA), $claim($Q_SHA)); $STALE = $both($claim($OLD_P, 1, '0.9.0'), $claim($Q_SHA));

    if ($up) {
        // A over HTTP
        $r = $call('ping', [], $GOODC);
        eq([$r['status'], $r['json']['core']['accepted'] ?? 'x', $r['json']['core']['reason'] ?? null], [200, true, 'accepted'], 'HTTP A: exact hashes → core.accepted true on ping');
        $r = $call('contacts.link', $LINK, $GOODC);
        eq([$r['status'], $r['json']['data']['created'] ?? null, $r['json']['core']['accepted'] ?? null], [200, true, true], 'HTTP A: …and contacts.link is allowed');
        $n = $links();
        // B + read-only actions still answer when rejected
        foreach (['ping' => [], 'diameter_settings.get' => [], 'companies.search' => ['q' => 'Example'], 'contacts.lookup' => ['waPhone' => '60000000001', 'chatKind' => 'individual']] as $a => $pp) {
            $r = $call($a, $pp, $STALE);
            eq([$r['status'], $r['json']['ok'] ?? null, $r['json']['core']['accepted'] ?? 'x', $r['json']['core']['parser']['status'] ?? null], [200, true, false, 'unknown_hash'],
               "HTTP B: rejected core → read-only $a STILL ANSWERS, reporting core.accepted false");
        }
        $r = $call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000002', 'chatKind' => 'individual'], $STALE);
        eq([$r['status'], $r['json']['error']['code'] ?? null, $r['json']['error']['reason'] ?? null, $r['json']['core']['accepted'] ?? 'x'], [412, 'core_not_accepted', 'mixed_versions', false],
           'HTTP B: rejected core → contacts.link 412 core_not_accepted (reason mixed_versions), core reported');
        eq($links(), $n, 'HTTP B: …and nothing was written');
        // C
        $r = $call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000002', 'chatKind' => 'individual'], $both($claim($P_SHA), $claim($OLD_Q)));
        eq([$r['status'], $r['json']['core']['pricing']['status'] ?? null], [412, 'unknown_hash'], 'HTTP C: unknown pricing hash → link refused');
        // no claim → null; link refused
        $r = $call('ping', [], '__none');
        eq([$r['status'], array_key_exists('accepted', $r['json']['core'] ?? []) ? $r['json']['core']['accepted'] : 'x', $r['json']['core']['reason'] ?? null], [200, null, 'no_claim'],
           'HTTP: no claim → core.accepted null (not verified)');
        $r = $call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000002', 'chatKind' => 'individual'], '__none');
        eq([$r['status'], $r['json']['error']['reason'] ?? null], [412, 'no_claim'], 'HTTP: no claim → link refused (null is not accepted)');
        $r = $call('ping', [], ['parser' => 'nope']);
        eq([$r['status'], $r['json']['core']['reason'] ?? null], [200, 'claim_malformed'], 'HTTP: malformed claim → ping answers, core claim_malformed');
        $r = $call('ping', [], $both($claim($P_SHA, 2), $claim($Q_SHA)));
        eq($r['json']['core']['reason'] ?? null, 'contract_mismatch', 'HTTP: contract mismatch reported');
        // D over HTTP: operator lists, then removes
        $writeConf(['QQ_SERVICE_ACCEPTED_CORES' => ['parser' => [['sha256' => $OLD_P, 'contract' => 1, 'reason' => 'synthetic overlap', 'date' => '2026-11-11']]]]);
        $r = $call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000003', 'chatKind' => 'individual'], $STALE);
        eq([$r['status'], $r['json']['core']['parser']['status'] ?? null, $r['json']['data']['created'] ?? null], [200, 'listed', true], 'HTTP D: older parser LISTED in service_config.php → accepted, link allowed');
        $writeConf();
        $r = $call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000004', 'chatKind' => 'individual'], $STALE);
        eq([$r['status'], $r['json']['error']['code'] ?? null], [412, 'core_not_accepted'], 'HTTP D: entry removed → refused again on the next request');
        // F over HTTP
        $MIX = $both($claim($P_SHA), $claim($OLD_Q));
        eq($call('ping', [], $MIX)['json']['core']['reason'] ?? null, 'mixed_versions', 'HTTP F: mixed → rejected');
        $writeConf(['QQ_SERVICE_ACCEPTED_CORES' => ['pairs' => [['parser' => ['sha256' => $P_SHA, 'contract' => 1], 'pricing' => ['sha256' => $OLD_Q, 'contract' => 1], 'reason' => 'pilot', 'date' => '2026-11-11']]]]);
        eq($call('ping', [], $MIX)['json']['core']['reason'] ?? null, 'pair_listed', 'HTTP F: …accepted once the exact pair is listed');
        $writeConf();
        // TAMPER: claims outside the signed body never count
        $r = $call('ping', [], '__none', ['headers' => ['X-QQ-Parser-Core' => "1.0.0; contract=1; sha256=$P_SHA", 'X-QQ-Pricing-Core' => "1.0.0; contract=1; sha256=$Q_SHA"],
                                         'query' => '&client[cores][parser][sha256]=' . $P_SHA]);
        eq([$r['status'], array_key_exists('accepted', $r['json']['core'] ?? []) ? $r['json']['core']['accepted'] : 'x'], [200, null],
           'TAMPER: valid claims in headers and the query string, none in the body → still no claim (null)');
        $r = $call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000005', 'chatKind' => 'individual'], $STALE,
                   ['headers' => ['X-QQ-Parser-Core' => "1.0.0; contract=1; sha256=$P_SHA"]]);
        eq($r['status'], 412, 'TAMPER: a good header cannot rescue a stale body claim');
        $staleBody = json_encode(['actor' => ['sub' => 7, 'username' => 'exampleuser'], 'requestId' => 'req_cg', 'params' => (object)$LINK, 'client' => ['cores' => $STALE]]);
        $r = $call('contacts.link', $LINK, $GOODC, ['signBody' => $staleBody]);
        eq([$r['status'], $r['json']['error']['code'] ?? null], [401, 'invalid_signature'], 'TAMPER: claims swapped for good ones after signing → 401 invalid_signature');
        eq($links(), $n + 1, 'TAMPER: nothing written by any tampered or refused request');
        // E/SERVER: a core file missing on the server
        rename("$SB/quo-pricing-core.js", "$SB/quo-pricing-core.js.gone");
        $r = $call('ping', [], $GOODC);
        eq([$r['status'], $r['json']['core']['accepted'] ?? 'x', $r['json']['core']['pricing']['status'] ?? null, $r['json']['core']['reason'] ?? null], [200, false, 'server_unknown', 'server_core_unknown'],
           'SERVER: pricing core missing on the server → unknown, NOT accepted; ping still answers');
        eq($call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000006', 'chatKind' => 'individual'], $GOODC)['status'], 412, 'SERVER: …and the link is refused');
        rename("$SB/quo-pricing-core.js.gone", "$SB/quo-pricing-core.js");
        eq($call('ping', [], $GOODC)['json']['core']['accepted'] ?? null, true, 'SERVER: file back → accepted again');
        // refusals before the body is read carry no core verdict
        $r = $call('nope.action', [], $GOODC);
        ok($r['status'] === 404 && !isset($r['json']['core']), 'HTTP: a refusal before the signed body is read carries no core object');
    }
}

$leftover = array_filter($LOG, fn ($l) => strpos($l, 'nonce.') !== false);
eq(array_values($leftover), [], 'no nonce housekeeping happened in the pure part');

if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    $label  ($asserts assertions" . ($httpRan ? ', incl. HTTP + MySQL' : '; HTTP part SKIPPED — no DC_SERVICE_TEST_DB_HOST/PORT, a skip is not a pass') . ")\n\n";
