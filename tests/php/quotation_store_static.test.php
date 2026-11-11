<?php
/**
 * ── quotation_store.php — side-effect free, moved verbatim, not exposed ─────
 *
 * Run:  php tests/php/quotation_store_static.test.php
 *
 * No database. Needs git and the production base commit ca5f0a5 in the
 * repository for section B (the verbatim-move proof); set DC_ALLOW_NO_BASE=1
 * only in a shallow clone, and B is then reported as NOT RUN.
 *
 *   A  including the store in a fresh process prints nothing, starts no
 *      session, sends no header, opens no connection, does not exit; its
 *      top level is definitions only
 *   B  every moved function is byte-identical to production ca5f0a5's
 *      api.php (dc_write_revision: the one documented split), api.php no
 *      longer defines any of them, and nothing was lost or duplicated
 *   C  nothing is exposed: no service file names the store, the create
 *      function or the table; api.php passes no idempotency key
 *   D  the idempotency key, payload hash and option checks, without a DB
 */

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($a, $e, $msg) {
    ok($a === $e, $msg . "\n      expected: " . var_export($e, true) . "\n      actual:   " . var_export($a, true));
}
$label = 'quotation store — side-effect free, moved verbatim, not exposed';
$ROOT  = dirname(__DIR__, 2);
/* Compared with LF line ends: the checkout may be CRLF, git show is LF. */
$lf    = function ($s) { return str_replace("\r\n", "\n", (string)$s); };
$STORE = $lf(file_get_contents("$ROOT/quotation_store.php"));
$API   = $lf(file_get_contents("$ROOT/api.php"));

/* Every top-level function in a PHP source, name => exact source text from the
   `function` keyword to its closing brace. Token based, so braces inside
   strings and comments cannot confuse it. */
function dc_fn_map($src) {
    $t = token_get_all($src); $n = count($t); $out = []; $depth = 0;
    for ($i = 0; $i < $n; $i++) {
        $tok = $t[$i];
        $txt = is_array($tok) ? $tok[1] : $tok;
        if (is_array($tok) && $tok[0] === T_FUNCTION && $depth === 0) {
            $j = $i + 1;
            while ($j < $n && is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) $j++;
            if (!is_array($t[$j]) || $t[$j][0] !== T_STRING) continue;   // closure
            $name = $t[$j][1];
            $buf = ''; $d = 0; $started = false;
            for ($k = $i; $k < $n; $k++) {
                $x = $t[$k]; $s = is_array($x) ? $x[1] : $x;
                $buf .= $s;
                if ($s === '{' || (is_array($x) && in_array($x[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) { $d++; $started = true; }
                elseif ($s === '}') { $d--; if ($started && $d === 0) break; }
            }
            $out[$name] = $buf; $i = $k; continue;
        }
        if ($txt === '{' || (is_array($tok) && in_array($tok[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) $depth++;
        elseif ($txt === '}') $depth--;
    }
    return $out;
}
/* Top-level `const NAME = ...;` and define('NAME', ...) statements, verbatim. */
function dc_const_map($src) {
    $out = [];
    preg_match_all('/^const\s+([A-Z_0-9]+)\s*=.*?;\s*$/ms', $src, $m, PREG_SET_ORDER);
    foreach ($m as $x) $out[$x[1]] = $x[0];
    preg_match_all("/^define\('([A-Z_0-9]+)'.*?;\s*$/m", $src, $m, PREG_SET_ORDER);
    foreach ($m as $x) $out[$x[1]] = $x[0];
    return $out;
}

// ══ A · including it does nothing but define ═══════════════════════════════
{
    /* The top level holds only <?php, comments, whitespace, function and const
       definitions and define() calls. Walk the tokens at depth 0. */
    $t = token_get_all($STORE); $depth = 0; $bad = []; $i = 0; $n = count($t);
    $skipToSemicolon = false;
    for (; $i < $n; $i++) {
        $tok = $t[$i]; $id = is_array($tok) ? $tok[0] : null; $s = is_array($tok) ? $tok[1] : $tok;
        if ($depth > 0) {
            if ($s === '{' || in_array($id, [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true)) $depth++;
            elseif ($s === '}') $depth--;
            continue;
        }
        if ($skipToSemicolon) { if ($s === ';') $skipToSemicolon = false; continue; }
        if (in_array($id, [T_OPEN_TAG, T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) continue;
        if ($id === T_FUNCTION) {      // to the body's opening brace
            while ($i < $n && $t[$i] !== '{') $i++;
            $depth = 1; continue;
        }
        if ($id === T_CONST) { $skipToSemicolon = true; continue; }
        if ($id === T_STRING && $s === 'define') { $skipToSemicolon = true; continue; }
        $bad[] = is_array($tok) ? token_name($id) . ' ' . trim($s) : $s;
    }
    eq($bad, [], 'A: the top level of quotation_store.php is definitions only (no statement, no echo, no exit, no require)');
    $code = preg_replace(['~/\*.*?\*/~s', '~//[^\n]*~'], '', $STORE);
    foreach (['session_start', 'header(', 'getDB(', 'new mysqli', 'mysqli_connect', 'ob_start', 'exit', 'die('] as $needle) {
        ok(stripos($code, $needle) === false, "A: the store never calls {$needle}");
    }
    ok(preg_match('/\b(require|include)(_once)?\s*[(\'"_]/i', $code) === 0, 'A: the store requires and includes nothing');

    /* And at run time, in a fresh process. */
    $probe = tempnam(sys_get_temp_dir(), 'dcqs') . '.php';
    file_put_contents($probe, '<?php ob_start(); $before = get_defined_functions()["user"];'
        . ' require ' . var_export("$ROOT/quotation_store.php", true) . ';'
        . ' $out = ob_get_clean();'
        . ' echo json_encode(["out" => $out, "session" => session_status(), "headers" => headers_list(),'
        . ' "sent" => headers_sent(), "txn_global" => array_key_exists("DC_TXN", $GLOBALS),'
        . ' "fns" => count(get_defined_functions()["user"]) - count($before),'
        . ' "lock" => defined("DC_REF_LOCK") ? DC_REF_LOCK : null, "alive" => true]);');
    $raw = shell_exec(escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($probe) . ' 2>&1');
    @unlink($probe); @unlink(substr($probe, 0, -4));
    $r = json_decode((string)$raw, true);
    ok(is_array($r), 'A: the probe ran to its end (the include did not exit or die): ' . substr((string)$raw, 0, 300));
    $r = is_array($r) ? $r : [];
    eq($r['out'] ?? null, '', 'A: including it prints nothing');
    eq($r['session'] ?? null, PHP_SESSION_NONE, 'A: including it starts no session');
    eq($r['headers'] ?? null, [], 'A: including it sets no header');
    eq($r['sent'] ?? null, false, 'A: and sends none');
    eq($r['txn_global'] ?? null, false, 'A: it does not even set the transaction-scope global — the host does');
    ok(($r['fns'] ?? 0) >= 30, 'A: it defines the store functions (' . ($r['fns'] ?? 0) . ')');
    eq($r['lock'] ?? null, 'dc_quotation_ref_alloc', 'A: the numbering lock name is unchanged');
}

// ══ B · moved verbatim from production ═════════════════════════════════════
$MOVED = ['dc_txn_begin', 'dc_txn_commit', 'dc_txn_rollback', 'dc_txn_note_lock', 'dc_txn_cleanup',
          'query_or_fail', 'prepare_or_fail', 'execute_or_fail',
          'dc_price_acceptance_ok', 'validate_quotation_payload',
          'dc_new_item_uid', 'dc_is_item_uid', 'dc_item_uid_absent', 'dc_mint_item_uid',
          'dc_lock_quotation_for_update', 'dc_read_quotation_snapshot_row', 'dc_build_quotation_snapshot',
          'dc_ksort_deep', 'dc_business_items', 'dc_business_state',
          'dc_next_revision_no', 'dc_write_revision',
          'dc_assign_item_uids', 'dc_reconcile_item_uids',
          'acquire_ref_lock', 'release_ref_lock', 'ref_no_in_use',
          'dc_save_quotation_insert', 'next_free_ref_no'];
$MOVED_CONST = ['DC_PRICE_SOURCES', 'DC_ITEM_UID_RE', 'DC_SNAPSHOT_SCHEMA_VERSION', 'DC_REF_LOCK'];
$NEW = ['dc_write_revision_as', 'dc_store_refusal', 'dc_is_idempotency_key', 'dc_store_payload_sha256',
        'dc_store_idempotency_prepare', 'dc_store_idempotency_lookup', 'dc_store_idempotency_answer',
        'dc_store_create_quotation'];

$BASE = 'ca5f0a5692adc8614017ec8054f9bd9fbe337d20';
$prodApi = null;
if (is_dir("$ROOT/.git") || is_file("$ROOT/.git")) {
    $prodApi = $lf(shell_exec('git -C ' . escapeshellarg($ROOT) . " show {$BASE}:api.php 2>" . (PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null')));
}
if (!is_string($prodApi) || strlen($prodApi) < 10000) {
    ok(getenv('DC_ALLOW_NO_BASE') === '1', "B: production base {$BASE} must be readable with git show (set DC_ALLOW_NO_BASE=1 only in a shallow clone)");
    echo "\n  NOTE  B NOT RUN: production api.php unavailable\n";
} else {
    $P = dc_fn_map($prodApi); $S = dc_fn_map($STORE); $A = dc_fn_map($API);
    foreach ($MOVED as $fn) {
        ok(isset($P[$fn]), "B: {$fn} existed in production api.php");
        ok(isset($S[$fn]), "B: {$fn} is defined in quotation_store.php");
        ok(!isset($A[$fn]), "B: {$fn} is no longer defined in api.php");
        if ($fn === 'dc_write_revision') continue;
        eq($S[$fn] ?? null, $P[$fn] ?? '', "B: {$fn} is byte-identical to production");
    }
    /* THE ONE SPLIT. The wrapper keeps the signature and supplies the session
       actor; the core is the production body with only the name, the extra
       parameter and the one dc_current_user() line changed. */
    eq($S['dc_write_revision'] ?? null,
       "function dc_write_revision(\$db, \$quotationId, \$eventType) {\n"
     . "    return dc_write_revision_as(\$db, \$quotationId, \$eventType, dc_current_user());\n}",
       'B: dc_write_revision is now the thin session wrapper, same signature');
    $expect = str_replace("function dc_write_revision(\$db, \$quotationId, \$eventType) {",
                          "function dc_write_revision_as(\$db, \$quotationId, \$eventType, \$actor) {",
                          $P['dc_write_revision'] ?? '');
    $expect = str_replace("    \$actor     = dc_current_user();\n", '', $expect);
    eq($S['dc_write_revision_as'] ?? null, $expect,
       'B: dc_write_revision_as is the production writer, actor passed in, nothing else changed');

    $PC = dc_const_map($prodApi); $SC = dc_const_map($STORE); $AC = dc_const_map($API);
    foreach ($MOVED_CONST as $c) {
        eq($SC[$c] ?? null, $PC[$c] ?? '', "B: constant {$c} moved byte-identical");
        ok(!isset($AC[$c]), "B: constant {$c} is no longer declared in api.php");
    }
    /* Nothing lost, nothing duplicated: every production function is in
       exactly one of the two files, and the store adds only the new ones. */
    foreach (array_keys($P) as $fn) {
        ok(isset($A[$fn]) xor isset($S[$fn]), "B: {$fn} is defined in exactly one of api.php / quotation_store.php");
    }
    $extra = array_values(array_diff(array_keys($S), array_keys($P)));
    sort($extra); $want = $NEW; sort($want);
    eq($extra, $want, 'B: the store adds only the create path and the revision split');
    $apiNew = array_values(array_diff(array_keys($A), array_keys($P)));
    eq($apiNew, [], 'B: api.php gains no function');

    /* api.php outside the moved code and the save_quotation branch is
       byte-identical to production. */
    $seg = function ($src) {
        $a = strpos($src, "} elseif (\$action === 'save_quotation') {");
        $b = strpos($src, "} elseif (\$action === 'update_quotation') {");
        return [substr($src, 0, $a), substr($src, $b)];
    };
    [$prodHead, $prodTail] = $seg($prodApi); [$curHead, $curTail] = $seg($API);
    eq($curTail, $prodTail, 'B: api.php from update_quotation to the end is byte-identical to production');
    $strip = function ($src) use ($MOVED, $MOVED_CONST) {
        $m = dc_fn_map($src);
        foreach ($MOVED as $fn) if (isset($m[$fn])) $src = str_replace($m[$fn], '', $src);
        foreach (dc_const_map($src) as $c => $txt) if (in_array($c, $MOVED_CONST, true)) $src = str_replace($txt, '', $src);
        $src = preg_replace(['~/\*.*?\*/~s', '~//[^\n]*~'], '', $src);
        return preg_replace('/\s+/', ' ', $src);
    };
    $curHeadNoRequire = str_replace("require_once __DIR__ . '/quotation_store.php';", '', $curHead);
    eq($strip($curHeadNoRequire), $strip($prodHead),
       'B: api.php before save_quotation is production minus the moved definitions, plus one require (code, comments aside)');
    $reqAt = strpos($API, "require_once __DIR__ . '/quotation_store.php';");
    ok($reqAt !== false && $reqAt > strpos($API, "require_once 'db.php';")
       && $reqAt < strpos($API, '$db = getDB();'), 'B: the store is required beside the existing requires, after the login gate');
    ok(strpos($API, "require_once __DIR__ . '/quotation_store.php';") > strpos($API, 'dc_require_api_login();'),
       'B: the login gate still runs before anything from the store can');
}

// ══ C · nothing is exposed ═════════════════════════════════════════════════
{
    foreach (['service.php', 'service_auth.php', 'service_actions.php', 'service_config.sample.php',
              'index.php', 'companies.php', 'handoff.php', 'dnc_handoff.php', 'login.php'] as $f) {
        if (!is_file("$ROOT/$f")) continue;
        $c = file_get_contents("$ROOT/$f");
        foreach (['quotation_store', 'dc_store_create_quotation', 'quotation_create_requests'] as $needle) {
            ok(stripos($c, $needle) === false, "C: {$f} does not name {$needle}");
        }
    }
    eq(substr_count($API, 'dc_store_create_quotation('), 1, 'C: api.php calls the create path in one place');
    ok(strpos($API, 'dc_store_create_quotation($db, $input, dc_current_user(), null)') !== false,
       'C: …from save_quotation, with NO idempotency key');
    $apiCode = preg_replace(['~/\*.*?\*/~s', '~//[^\n]*~'], '', $API);
    ok(stripos($apiCode, 'quotation_create_requests') === false, 'C: api.php code never names the request table');
    ok(stripos($apiCode, 'idempotency') === false, 'C: api.php code reads no idempotency input');
    if (is_file("$ROOT/.cpanel.yml")) {
        ok(strpos(file_get_contents("$ROOT/.cpanel.yml"), 'tests/') === false, 'C: the deploy allow-list names nothing under tests/');
    }
}

// ══ D · idempotency checks that need no database ═══════════════════════════
{
    $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];
    require_once "$ROOT/quotation_store.php";
    $good = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
    ok(dc_is_idempotency_key($good), 'D: a lowercase UUID v4 is a key');
    foreach (['3F2B8C1E-9A4D-4E6F-8B2A-1C3D5E7F9A0B' => 'uppercase',
              '3f2b8c1e-9a4d-1e6f-8b2a-1c3d5e7f9a0b' => 'version 1',
              '3f2b8c1e-9a4d-4e6f-cb2a-1c3d5e7f9a0b' => 'wrong variant',
              '3f2b8c1e9a4d4e6f8b2a1c3d5e7f9a0b'     => 'no hyphens',
              "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b\n" => 'trailing newline',
              ' 3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b' => 'leading space',
              '{3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b}' => 'braced',
              '' => 'empty'] as $k => $why) {
        ok(!dc_is_idempotency_key($k), "D: refused as a key: {$why}");
    }
    foreach ([null, 123, ['x'], true] as $k) ok(!dc_is_idempotency_key($k), 'D: refused as a key: ' . gettype($k));

    $a = ['items' => [['qty' => 2, 'desc' => 'SAG ROD'], ['desc' => 'NUT', 'qty' => 1]], 'customer_name' => 'Gamma'];
    $b = ['customer_name' => 'Gamma', 'items' => [['desc' => 'SAG ROD', 'qty' => 2], ['qty' => 1, 'desc' => 'NUT']]];
    $c = ['customer_name' => 'Gamma', 'items' => [['qty' => 1, 'desc' => 'NUT'], ['desc' => 'SAG ROD', 'qty' => 2]]];
    eq(dc_store_payload_sha256($a), dc_store_payload_sha256($b), 'D: key order does not change the hash');
    ok(dc_store_payload_sha256($a) !== dc_store_payload_sha256($c), 'D: item order DOES change the hash');
    ok(dc_store_payload_sha256(['t' => 5]) !== dc_store_payload_sha256(['t' => 5.0]), 'D: 5 and 5.0 hash differently');
    ok(dc_store_payload_sha256(['t' => 5]) !== dc_store_payload_sha256(['t' => '5']), 'D: 5 and "5" hash differently');
    eq(preg_match('/^[0-9a-f]{64}$/', (string)dc_store_payload_sha256($a)), 1, 'D: the hash is 64 lowercase hex');
    eq(dc_store_payload_sha256(['x' => "\xff"]), null, 'D: an unencodable payload has no hash');
    eq(dc_store_payload_sha256('nope'), null, 'D: a non-array payload has no hash');

    $actor = ['id' => null, 'username' => 'synth.user', 'display_name' => 'Synthetic User', 'source' => 'dnc', 'dnc_user_id' => 41];
    $p = dc_store_idempotency_prepare($a, $actor, ['key' => $good]);
    ok($p['ok'] === true && $p['source'] === 'qq' && $p['actor_user_id'] === 41, 'D: a good request prepares, source defaults to qq');
    $codes = [
        [['key' => 'nope'], $actor, 'idempotency_key_invalid'],
        [['key' => $good], null, 'idempotency_actor_invalid'],
        [['key' => $good], ['id' => 7, 'username' => 'x', 'display_name' => 'X'], 'idempotency_actor_invalid'],
        [['key' => $good], ['dnc_user_id' => '41', 'username' => 'x'], 'idempotency_actor_invalid'],
        [['key' => $good], ['dnc_user_id' => 0, 'username' => 'x'], 'idempotency_actor_invalid'],
        [['key' => $good], ['dnc_user_id' => 41, 'username' => ''], 'idempotency_actor_invalid'],
        [['key' => $good], ['dnc_user_id' => 41, 'username' => str_repeat('u', 65)], 'idempotency_actor_invalid'],
        [['key' => $good, 'source' => 'QQ'], $actor, 'idempotency_options_invalid'],
        [['key' => $good, 'parser_core_sha256' => 'abc'], $actor, 'idempotency_options_invalid'],
        [['key' => $good, 'wa_contact_id' => '5'], $actor, 'idempotency_options_invalid'],
    ];
    foreach ($codes as $i => [$idem, $act, $code]) {
        $r = dc_store_idempotency_prepare($a, $act, $idem);
        eq($r['code'] ?? 'ok', $code, "D: prepare case {$i} refused as {$code}");
    }
    eq(dc_store_idempotency_prepare(['x' => "\xff"], $actor, ['key' => $good])['code'] ?? 'ok', 'validation_failed',
       'D: an unencodable payload is refused before any lock');
    /* A refusal before the lock — no database handle is ever touched. */
    $r = dc_store_create_quotation(null, ['items' => [['qty' => 1]]], $actor, ['key' => 'bad']);
    eq($r, ['ok' => false, 'code' => 'idempotency_key_invalid', 'error' => 'The idempotency key must be a lowercase UUID v4.'],
       'D: a malformed key is refused by the create path without touching the database');
    $r = dc_store_create_quotation(null, ['items' => []], $actor, null);
    eq($r, ['ok' => false, 'code' => 'validation_failed', 'error' => 'Quotation has no items.'],
       'D: validation still comes first, with the same message as save_quotation');
}

if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n"; exit(1);
}
echo "\n  ok    $label  ($asserts assertions)\n\n";
