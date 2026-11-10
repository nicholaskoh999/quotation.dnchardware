<?php
/**
 * ── Service API — what can be proven without a database ────────────────────
 *
 * Run:  php tests/php/service_static.test.php
 *
 *   A  the door is DISABLED BY DEFAULT: no config, enabled=false, a missing,
 *      malformed or short secret, a secret shared with the handoff
 *   B  the signing recipe, against the fixed vector printed in
 *      docs/SERVICE-API.md (a FAKE secret) — computed here independently
 *   C  the request envelope
 *   D  static: service.php and its own includes never require api.php or
 *      auth.php, never touch a session, a cookie or a CORS header, and hold
 *      exactly two data-changing statements — the nonce INSERT and the
 *      contact-link INSERT
 *   E  the deploy allow-list: the new files ship, the real config never does
 *   F  including the files does nothing (no output, no session, no header)
 *
 * No MySQL, no HTTP, no network. All data is synthetic.
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

// ══ F · including the function files does nothing ══════════════════════════
ob_start();
require_once "$ROOT/service_auth.php";
require_once "$ROOT/service_actions.php";
$printed = ob_get_clean();
eq($printed, '', 'F: service_auth.php and service_actions.php print nothing when included');
eq(session_status(), PHP_SESSION_NONE, 'F: no session was started by including them');
eq(headers_list(), [], 'F: no header was set by including them');
$LOG = [];
$GLOBALS['DC_SERVICE_LOG_SINK'] = function ($l) use (&$LOG) { $LOG[] = $l; };

// ══ A · disabled by default ════════════════════════════════════════════════
/* 32 ASCII bytes, obviously not a key. The same value docs/SERVICE-API.md uses. */
$FAKE_RAW = 'FAKE-TEST-SECRET-NOT-A-REAL-KEY!';
eq(strlen($FAKE_RAW), 32, 'A: the fake key is 32 bytes');
$FAKE = 'base64:' . base64_encode($FAKE_RAW);
$good = ['QQ_SERVICE_ENABLED' => 'true', 'QQ_SERVICE_KEY_ID' => 'qq-backend-1', 'QQ_SERVICE_SECRET' => $FAKE, 'QQ_SERVICE_SECRET_PREVIOUS' => ''];

ok(!is_file("$ROOT/service_config.php"), 'A: no real service_config.php exists in the working tree');
eq(dc_service_config_file("$ROOT/tests/php/no-such-service-config.php"), [], 'A: a missing config file reads as empty');
eq(dc_service_settings([]), null, 'A: no config → disabled');
eq(dc_service_settings(dc_service_config_file()), null, 'A: the tree as shipped → disabled');
$sample = include "$ROOT/service_config.sample.php";
ok(is_array($sample), 'A: the sample returns an array');
eq(dc_service_settings($sample), null, 'A: the sample copied unchanged → disabled');
eq($sample['QQ_SERVICE_SECRET'] ?? null, '', 'A: the sample carries no secret');
eq($sample['QQ_SERVICE_SECRET_PREVIOUS'] ?? null, '', 'A: …and no previous secret');
eq(strtolower((string)($sample['QQ_SERVICE_ENABLED'] ?? '')), 'false', 'A: the sample ships OFF');

$s = dc_service_settings($good);
ok(is_array($s) && $s['key_id'] === 'qq-backend-1' && $s['keys'] === [$FAKE_RAW], 'A: a complete config → enabled, one key');
foreach ([
    'enabled=false'                 => ['QQ_SERVICE_ENABLED' => 'false'],
    'enabled missing'               => ['QQ_SERVICE_ENABLED' => null],
    'enabled=0'                     => ['QQ_SERVICE_ENABLED' => '0'],
    'enabled is an integer 1'       => ['QQ_SERVICE_ENABLED' => 1],
    'secret empty'                  => ['QQ_SERVICE_SECRET' => ''],
    'secret missing'                => ['QQ_SERVICE_SECRET' => null],
    'secret without base64: prefix' => ['QQ_SERVICE_SECRET' => base64_encode($FAKE_RAW)],
    'secret not base64'             => ['QQ_SERVICE_SECRET' => 'base64:***not-base64***'],
    'secret 31 bytes'               => ['QQ_SERVICE_SECRET' => 'base64:' . base64_encode(substr($FAKE_RAW, 0, 31))],
    'secret 16 bytes'               => ['QQ_SERVICE_SECRET' => 'base64:' . base64_encode(substr($FAKE_RAW, 0, 16))],
    'secret is an array'            => ['QQ_SERVICE_SECRET' => [$FAKE]],
    'previous secret malformed'     => ['QQ_SERVICE_SECRET_PREVIOUS' => 'base64:short'],
    'previous secret wrong type'    => ['QQ_SERVICE_SECRET_PREVIOUS' => 5],
    'key id with a space'           => ['QQ_SERVICE_KEY_ID' => 'qq backend'],
    'key id empty'                  => ['QQ_SERVICE_KEY_ID' => ''],
    'key id too long'               => ['QQ_SERVICE_KEY_ID' => str_repeat('k', 33)],
] as $label => $over) {
    eq(dc_service_settings(array_merge($good, $over)), null, "A: $label → disabled");
}
foreach (['true', 'TRUE', ' on ', '1', 'yes', true] as $v) {
    ok(is_array(dc_service_settings(array_merge($good, ['QQ_SERVICE_ENABLED' => $v]))), 'A: enabled=' . var_export($v, true) . ' → enabled');
}
$prevRaw = 'FAKE-PREVIOUS-KEY-NOT-REAL-00001';
$s = dc_service_settings(array_merge($good, ['QQ_SERVICE_SECRET_PREVIOUS' => 'base64:' . base64_encode($prevRaw)]));
eq($s['keys'] ?? null, [$FAKE_RAW, $prevRaw], 'A: during a rotation the current key is tried first, then the previous');

/* One key must never do two jobs: equal to the handoff secret → disabled. */
putenv('DNC_HANDOFF_SECRET=' . $FAKE);
eq(dc_service_settings($good), null, 'A: a service secret equal to DNC_HANDOFF_SECRET → disabled');
putenv('DNC_HANDOFF_SECRET');
putenv('DNC_HANDOFF_SECRET_PREVIOUS=' . $FAKE);
eq(dc_service_settings($good), null, 'A: …or equal to DNC_HANDOFF_SECRET_PREVIOUS → disabled');
putenv('DNC_HANDOFF_SECRET_PREVIOUS');
ok(is_array(dc_service_settings($good)), 'A: and enabled again once they differ');

/* The service settings are read from the FILE only, never the environment. */
putenv('QQ_SERVICE_ENABLED=true'); putenv('QQ_SERVICE_SECRET=' . $FAKE);
eq(dc_service_settings(dc_service_config_file("$ROOT/tests/php/no-such-service-config.php")), null,
   'A: environment variables alone cannot enable the service');
putenv('QQ_SERVICE_ENABLED'); putenv('QQ_SERVICE_SECRET');

// ══ B · the signing recipe, fixed vector ═══════════════════════════════════
$V_ACTION = 'ping';
$V_TS     = '1794300000';
$V_NONCE  = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
$V_BODY   = '{"actor":{"sub":7,"username":"exampleuser"},"requestId":"req_EXAMPLE0001","params":{}}';
$bodyHash = hash('sha256', $V_BODY);
$expectString = "qqs1\nPOST\n$V_ACTION\n$V_TS\n$V_NONCE\n$bodyHash";
eq(dc_service_signing_string($V_ACTION, $V_TS, $V_NONCE, $V_BODY), $expectString,
   'B: signing string = qqs1 / POST / action / timestamp / nonce / sha256(body), joined by \\n, no trailing newline');
/* Independent of the code under test: PHP's own primitives only. */
$expectSig = rtrim(strtr(base64_encode(hash_hmac('sha256', $expectString, $FAKE_RAW, true)), '+/', '-_'), '=');
eq(dc_service_sign($FAKE_RAW, $V_ACTION, $V_TS, $V_NONCE, $V_BODY), $expectSig, 'B: signature = base64url(HMAC-SHA256(key, string)), unpadded');
eq(strlen($expectSig), 43, 'B: 43 characters');
ok(preg_match('/^[A-Za-z0-9_-]{43}$/', $expectSig) === 1, 'B: base64url alphabet, no padding');

$DOC = (string)@file_get_contents("$ROOT/docs/SERVICE-API.md");
ok($DOC !== '', 'B: docs/SERVICE-API.md exists');
ok(strpos($DOC, $FAKE) !== false, 'B: the doc\'s worked example uses the fake secret');
ok(strpos($DOC, $V_BODY) !== false, 'B: …this exact body');
ok(strpos($DOC, $bodyHash) !== false, 'B: …its SHA-256 as computed here');
ok(strpos($DOC, $expectSig) !== false, 'B: …and the signature computed here (the doc\'s vector is true)');

ok(dc_service_signature_ok([$FAKE_RAW], $V_ACTION, $V_TS, $V_NONCE, $V_BODY, $expectSig), 'B: the vector verifies');
ok(dc_service_signature_ok([$prevRaw, $FAKE_RAW], $V_ACTION, $V_TS, $V_NONCE, $V_BODY, $expectSig), 'B: …also as the second (previous) key');
ok(!dc_service_signature_ok([$prevRaw], $V_ACTION, $V_TS, $V_NONCE, $V_BODY, $expectSig), 'B: wrong key → refused');
ok(!dc_service_signature_ok([$FAKE_RAW], 'contacts.link', $V_TS, $V_NONCE, $V_BODY, $expectSig), 'B: another action → refused');
ok(!dc_service_signature_ok([$FAKE_RAW], $V_ACTION, '1794300001', $V_NONCE, $V_BODY, $expectSig), 'B: another timestamp → refused');
ok(!dc_service_signature_ok([$FAKE_RAW], $V_ACTION, $V_TS, str_repeat('0', 32), $V_BODY, $expectSig), 'B: another nonce → refused');
ok(!dc_service_signature_ok([$FAKE_RAW], $V_ACTION, $V_TS, $V_NONCE, $V_BODY . ' ', $expectSig), 'B: one extra byte in the body → refused');
ok(!dc_service_signature_ok([$FAKE_RAW], $V_ACTION, $V_TS, $V_NONCE, $V_BODY, ''), 'B: empty signature → refused');
ok(!dc_service_signature_ok([$FAKE_RAW], $V_ACTION, $V_TS, $V_NONCE, $V_BODY, $expectSig . '='), 'B: padded signature → refused');
ok(!dc_service_signature_ok([], $V_ACTION, $V_TS, $V_NONCE, $V_BODY, $expectSig), 'B: no keys → refused');
$src = file_get_contents("$ROOT/service_auth.php");
ok(strpos($src, 'hash_equals(') !== false && strpos($src, 'hash_hmac(') !== false, 'B: hash_hmac + hash_equals (constant time)');

ok(dc_service_timestamp_in_window('1000000000', 1000000060), 'B: 60 s old → inside the window');
ok(dc_service_timestamp_in_window('1000000060', 1000000000), 'B: 60 s ahead → inside the window');
ok(!dc_service_timestamp_in_window('1000000000', 1000000061), 'B: 61 s old → outside');
ok(!dc_service_timestamp_in_window('1000000061', 1000000000), 'B: 61 s ahead → outside');
foreach (['', '0', '179430000', '1794300000.5', '-1794300000', '1794300000000', ' 1794300000', '1e9'] as $bad) {
    ok(!dc_service_timestamp_shape_ok($bad), 'B: timestamp ' . var_export($bad, true) . ' is not Unix seconds');
}
ok(dc_service_timestamp_shape_ok('1794300000'), 'B: ten digits of Unix seconds');
foreach (['', str_repeat('a', 31), str_repeat('a', 33), str_repeat('A', 32), str_repeat('g', 32), str_repeat('a', 31) . ' '] as $bad) {
    ok(!dc_service_nonce_shape_ok($bad), 'B: nonce ' . var_export($bad, true) . ' is not 32 lowercase hex');
}
ok(dc_service_nonce_shape_ok(bin2hex(random_bytes(16))), 'B: bin2hex(random_bytes(16)) is a nonce');

// ══ C · the envelope ═══════════════════════════════════════════════════════
$p = dc_service_parse_body($V_BODY);
eq($p, ['sub' => 7, 'username' => 'exampleuser', 'params' => [], 'request_id' => 'req_EXAMPLE0001'], 'C: the worked example parses');
foreach ([
    'empty'                 => '',
    'not JSON'              => '{actor',
    'a list'                => '[1,2]',
    'a string'              => '"x"',
    'no actor'              => '{"params":{}}',
    'actor not an object'   => '{"actor":7}',
    'sub as a string'       => '{"actor":{"sub":"7","username":"u"}}',
    'sub zero'              => '{"actor":{"sub":0,"username":"u"}}',
    'sub negative'          => '{"actor":{"sub":-7,"username":"u"}}',
    'sub a float'           => '{"actor":{"sub":7.5,"username":"u"}}',
    'no username'           => '{"actor":{"sub":7}}',
    'empty username'        => '{"actor":{"sub":7,"username":""}}',
    'username not a string' => '{"actor":{"sub":7,"username":["u"]}}',
    'params a list'         => '{"actor":{"sub":7,"username":"u"},"params":[1]}',
    'params a string'       => '{"actor":{"sub":7,"username":"u"},"params":"x"}',
] as $label => $raw) {
    eq(dc_service_parse_body($raw), null, "C: $label → refused");
}
eq(dc_service_parse_body('{"actor":{"sub":7,"username":"u"}}')['params'] ?? null, [], 'C: params may be omitted');
eq(dc_service_parse_body('{"actor":{"sub":7,"username":"u"},"requestId":"<script>"}'), ['sub' => 7, 'username' => 'u', 'params' => [], 'request_id' => null],
   'C: a request id that is not a plain token is dropped, never echoed');

// ══ identity normalisation (no database needed) ════════════════════════════
eq(dc_service_identity(['chatKind' => 'individual', 'waPhone' => '+60 00-000 0001'])['phone'] ?? null, '60000000001', 'C: "+60 00-000 0001" → 60000000001');
eq(dc_service_identity(['chatKind' => 'individual', 'waPhone' => '60000000001'])['phone'] ?? null, '60000000001', 'C: digits stay as they are');
foreach (['0123456789', '1234567', '1234567890123456', '6000000000a', '', '++60000000001', "60000000001\n2"] as $bad) {
    eq(dc_service_identity(['chatKind' => 'individual', 'waPhone' => $bad])['error'] ?? null, 'validation_failed', 'C: phone ' . var_export($bad, true) . ' → refused');
}
eq(dc_service_identity(['chatKind' => 'individual', 'waPhone' => 60000000001])['error'] ?? null, 'validation_failed', 'C: a phone sent as a number → refused');
eq(dc_service_identity(['waPhone' => '60000000001'])['error'] ?? null, 'validation_failed', 'C: chatKind is required');
eq(dc_service_identity(['chatKind' => 'broadcast', 'waPhone' => '60000000001'])['error'] ?? null, 'validation_failed', 'C: an unknown chatKind → refused');
eq(dc_service_identity(['chatKind' => 'individual', 'waChatId' => 'fake chat'])['error'] ?? null, 'validation_failed', 'C: a chat id with a space → refused');
eq(dc_service_identity(['chatKind' => 'individual', 'waChatId' => str_repeat('a', 65)])['error'] ?? null, 'validation_failed', 'C: a 65-character chat id → refused');
eq(dc_service_identity(['chatKind' => 'group', 'waChatId' => '000000000000000001@g.us'])['group'] ?? null, true, 'C: chatKind group → a group');
eq(dc_service_identity(['chatKind' => 'individual', 'waChatId' => '000000000000000001@g.us'])['group'] ?? null, true, 'C: an @g.us identifier is a group whatever chatKind says');
eq(dc_service_identity(['chatKind' => 'individual', 'waChatId' => '000000000000001@lid'])['group'] ?? null, false, 'C: an individual identifier is not');
eq(dc_service_like_escape('50%_a|b'), '50|%|_a||b', 'C: LIKE wildcards and the escape character are escaped');

// ══ D · static: what the service files contain ═════════════════════════════
$OWN = ['service.php', 'service_auth.php', 'service_actions.php'];
/** Source with comments and inline HTML removed, so prose cannot satisfy or trip a check. */
function code_only($path) {
    $out = '';
    foreach (token_get_all(file_get_contents($path)) as $t) {
        if (is_array($t)) { if (in_array($t[0], [T_COMMENT, T_DOC_COMMENT, T_INLINE_HTML], true)) continue; $out .= $t[1]; }
        else $out .= $t;
    }
    return $out;
}
$code = []; foreach ($OWN as $f) { ok(is_file("$ROOT/$f"), "D: $f exists"); $code[$f] = code_only("$ROOT/$f"); }
$allCode = implode("\n", $code);

$requires = [];
foreach ($code as $f => $c) {
    preg_match_all('/\b(?:require|require_once|include|include_once)\b\s*\(?\s*([^;]+);/', $c, $m);
    foreach ($m[1] as $target) $requires[] = "$f → " . preg_replace('/\s+/', ' ', trim($target));
}
sort($requires);
eq($requires, [
    "service.php → __DIR__ . '/service_actions.php'",
    "service.php → __DIR__ . '/service_auth.php'",
    "service_auth.php → \$path",
    "service_auth.php → __DIR__ . '/dnc_handoff.php'",
], 'D: the complete include graph of the service files — api.php and auth.php are not in it');
foreach ($code as $f => $c) {
    ok(preg_match('/[\'"\/]api\.php/', $c) === 0, "D: $f never names api.php");
    ok(preg_match('/[\'"\/](auth|login|logout|handoff|index|companies|pricing_history|ai_extract)\.php/', $c) === 0, "D: $f never names auth.php, login.php or another page");
}
/* dnc_handoff.php is included for the canonical-user functions, and it loads
   auth.php. Both only DEFINE things; these are the session-touching names
   they define, and the service files call none of them. */
foreach (['session_start', 'session_id', 'session_regenerate_id', 'session_name', 'session_set_cookie_params', 'setcookie', 'setrawcookie',
          'dc_session_start', 'dc_require_login', 'dc_require_api_login', 'dc_require_csrf_api', 'dc_current_user', 'dc_login', 'dc_logout',
          'dc_csrf_token', 'dc_handoff_start', 'dc_handoff_callback', 'dc_handoff_rate_limited', 'dc_handoff_consume_jti', 'dc_handoff_prune_jtis'] as $fn) {
    ok(preg_match('/\b' . preg_quote($fn, '/') . '\s*\(/', $allCode) === 0, "D: no service file calls $fn()");
}
ok(preg_match('/\$_(SESSION|COOKIE)\b/', $allCode) === 0, 'D: $_SESSION and $_COOKIE are never read');
ok(stripos($allCode, 'Access-Control-') === false, 'D: no CORS header anywhere');
ok(stripos($allCode, 'Set-Cookie') === false, 'D: no Set-Cookie anywhere');
ok(preg_match('/\b(sodium_\w+|openssl_\w+|mcrypt_\w+)\s*\(/', $allCode) === 0, 'D: no sodium / openssl call — hash_hmac and hash_equals only');
ok(preg_match('/\b(eval|exec|shell_exec|system|passthru|proc_open|popen|curl_\w+|file_put_contents|fopen|unlink)\s*\(/', $allCode) === 0,
   'D: no eval, shell, outbound HTTP or file write');
ok(preg_match('/\bgetenv\s*\(/', $allCode) === 0, 'D: the service files read no environment variable themselves');

/* Every data-changing or schema-changing SQL keyword in the three files. */
preg_match_all('/\b(INSERT\s+(?:IGNORE\s+)?INTO|REPLACE\s+INTO|UPDATE\s+[`A-Za-z_][`\w.]*\s+(?:[A-Za-z_]\w*\s+)?SET|DELETE\s+FROM|TRUNCATE\s+|DROP\s+(?:TABLE|DATABASE|INDEX)|ALTER\s+TABLE|CREATE\s+(?:TABLE|INDEX|DATABASE)|RENAME\s+TABLE|ON\s+DUPLICATE\s+KEY|LOAD\s+DATA|GRANT\s|CALL\s)\s*[\'"]?\s*(?:\.\s*)?([A-Z_a-z`.]*)/i',
               $allCode, $w, PREG_SET_ORDER);
$writes = array_map(fn ($x) => strtoupper(preg_replace('/\s+/', ' ', $x[1])) . ' ' . trim($x[2], '`.'), $w);
sort($writes);
eq($writes, ['INSERT INTO DC_SERVICE_NONCE_TABLE', 'INSERT INTO company_whatsapp_contacts'],
   'D: exactly two write statements exist: the nonce INSERT and the contact-link INSERT');
eq(DC_SERVICE_NONCE_TABLE, 'service_request_nonces', 'D: …and the nonce INSERT targets service_request_nonces');
ok(preg_match('/\b(UPDATE|DELETE|REPLACE|TRUNCATE|DROP|ALTER)\b/', preg_replace('/ON UPDATE|updated_at/i', '', $allCode)) === 0,
   'D: the words UPDATE, DELETE, REPLACE, TRUNCATE, DROP and ALTER do not appear in code at all');
ok(preg_match('/\bmulti_query\s*\(/', $allCode) === 0, 'D: no multi-statement query');
/* companies and quotations are only ever read. */
preg_match_all('/\b(?:INTO|UPDATE|FROM|JOIN)\s+([a-z_]+)\b/', $allCode, $t);
$tables = array_values(array_unique($t[1])); sort($tables);
eq($tables, ['companies', 'company_whatsapp_contacts', 'diameter_settings', 'quotations'],
   'D: the only tables named in SQL (besides the nonce table constant)');
ok(preg_match('/INTO\s+(companies|quotations|diameter_settings)\b/i', $allCode) === 0, 'D: nothing is inserted into companies, quotations or diameter_settings');
ok(preg_match('/\bphone\b/', preg_replace('/wa_phone|\$phone|\'phone\'|waPhone|idx_cwc_phone/', '', $allCode)) === 0,
   'D: companies.phone is never selected or written (the column name does not occur)');
ok(strpos($allCode, 'c.*') === false && preg_match('/SELECT\s+\*\s+FROM\s+companies/i', $allCode) === 0, 'D: no SELECT * on companies');

/* The allow-list is exactly five actions and each has a handler. */
eq(DC_SERVICE_ACTIONS, ['ping', 'diameter_settings.get', 'companies.search', 'contacts.lookup', 'contacts.link'], 'D: the allow-list');
eq(array_keys(dc_service_handlers()), DC_SERVICE_ACTIONS, 'D: one handler per allowed action, nothing more');
foreach (dc_service_handlers() as $a => $fn) ok(function_exists($fn), "D: handler for $a exists");
preg_match('/const DC_MUTATING_ACTIONS = \[(.*?)\];/s', file_get_contents("$ROOT/api.php"), $mm);
preg_match_all("/'([a-z_]+)'/", $mm[1] ?? '', $mut);
ok(count($mut[1]) >= 16, 'D: api.php\'s mutating actions were read (' . count($mut[1]) . ')');
eq(array_values(array_intersect($mut[1], DC_SERVICE_ACTIONS)), [], 'D: no api.php mutating action is on the service allow-list');
foreach (['quotations.create', 'quotations.update', 'quotations.delete', 'companies.create', 'companies.update', 'companies.delete', 'contacts.unlink'] as $a) {
    ok(!in_array($a, DC_SERVICE_ACTIONS, true), "D: $a is not offered");
}

/* The Diameter Settings query and row mapping are api.php's, character for character. */
$api = file_get_contents("$ROOT/api.php");
ok(preg_match('/\} elseif \(\$action === \'get_diameter_settings\'\) \{(.*?)\n\} elseif/s', $api, $blk) === 1, 'D: api.php get_diameter_settings block found');
preg_match('/"(SELECT \* FROM diameter_settings[^"]*)"/', $blk[1] ?? '', $apiSql);
preg_match('/\$rows\[\] = \[(.*?)\];/s', $blk[1] ?? '', $apiMap);
$act = file_get_contents("$ROOT/service_actions.php");
preg_match('/function dc_service_diameter_rows\(\$db\) \{(.*?)\n\}/s', $act, $svcBlk);
preg_match('/"(SELECT \* FROM diameter_settings[^"]*)"/', $svcBlk[1] ?? '', $svcSql);
preg_match('/\$rows\[\] = \[(.*?)\];/s', $svcBlk[1] ?? '', $svcMap);
ok(!empty($apiSql[1]) && ($apiSql[1] ?? 'a') === ($svcSql[1] ?? 'b'), 'D: diameter_settings.get runs api.php\'s exact SQL');
$squash = fn ($s) => preg_replace('/\s+/', '', (string)$s);
ok(!empty($apiMap[1]) && $squash($apiMap[1] ?? 'a') === $squash($svcMap[1] ?? 'b'), 'D: …and api.php\'s exact row mapping');

/* The files this round was told not to touch are byte-identical to production ca5f0a5. */
$BASE = 'ca5f0a5692adc8614017ec8054f9bd9fbe337d20';
$git = function ($args) use ($ROOT) { $o = []; $rc = 1; @exec('git -C ' . escapeshellarg($ROOT) . ' ' . $args . ' 2>&1', $o, $rc); return [$rc, implode("\n", $o)]; };
[$rc, ] = $git("cat-file -e $BASE^{commit}");
if ($rc === 0) {
    [$rc2, $changed] = $git("diff --name-only $BASE -- index.php api.php auth.php login.php logout.php handoff.php dnc_handoff.php companies.php pricing_history.php ai_extract.php ai_anthropic.php version.php app tests/run.js .gitignore");
    eq([$rc2, $changed], [0, ''], 'D: index.php, api.php, auth.php, login.php, handoff.php, dnc_handoff.php, companies.php, pricing and parsing files are unchanged since ca5f0a5');
} else {
    ok(true, 'D: (base commit not available here — unchanged-files check not applicable)');
}

// ══ E · the deploy allow-list ══════════════════════════════════════════════
$yml = file_get_contents("$ROOT/.cpanel.yml");
preg_match('/export APPFILES="([^"]+)"/', $yml, $m1);
preg_match('/export PROTECTED="([^"]+)"/', $yml, $m2);
$appfiles = preg_split('/\s+/', trim($m1[1] ?? '')); $protected = preg_split('/\s+/', trim($m2[1] ?? ''));
foreach (['service.php', 'service_auth.php', 'service_actions.php', 'service_config.sample.php'] as $f) {
    ok(in_array($f, $appfiles, true), "E: $f is deployed (APPFILES)");
    ok(is_file("$ROOT/$f"), "E: …and exists in the checkout");
}
ok(in_array('service_config.php', $protected, true), 'E: service_config.php is PROTECTED');
ok(!in_array('service_config.php', $appfiles, true), 'E: …and is not in APPFILES: a deploy can neither create nor overwrite it');
eq(end($appfiles), 'version.php', 'E: version.php is still the LAST file copied');
eq(count($appfiles), count(array_unique($appfiles)), 'E: no file is listed twice');
foreach (['dnc_handoff.php', 'auth.php', 'app/Handoff/Contract/HandoffToken.php', 'app/Handoff/Contract/InvalidHandoffToken.php'] as $f) {
    ok(in_array($f, $appfiles, true), "E: $f, which the service loads, is deployed too");
}
foreach (['ai_config.php', 'db.php', 'dnc_config.php', 'error_log', 'php.ini', '.htaccess'] as $f) {
    ok(in_array($f, $protected, true), "E: $f is still PROTECTED");
}
ok(!is_file("$ROOT/migrations/service_config.php") && !preg_match('/migrations\//', $m1[1] ?? ''), 'E: migrations are not deployed to the docroot');

/* Nothing that looks like a real key in any new file. */
foreach (array_merge($OWN, ['service_config.sample.php', 'docs/SERVICE-API.md', 'docs/SERVICE-API-MIGRATIONS.md',
         'migrations/2026-11-10-create-service-request-nonces.sql', 'migrations/2026-11-10-create-company-whatsapp-contacts.sql']) as $f) {
    $txt = (string)@file_get_contents("$ROOT/$f");
    ok($txt !== '', "E: $f exists");
    preg_match_all('/base64:[A-Za-z0-9+\/=]{20,}/', $txt, $keys);
    eq(array_values(array_unique(array_diff($keys[0], [$FAKE]))), [], "E: $f holds no key other than the documented fake one");
}

eq($LOG, [], 'no log line was written by any pure function above');

// ── report ──────────────────────────────────────────────────────────────────
$label = 'service API — disabled by default, signing vector, static guarantees';
if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    $label  ($asserts assertions)\n\n";
