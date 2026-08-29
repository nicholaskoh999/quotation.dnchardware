<?php
/**
 * ── Reading history — derived when asked, stored nowhere ────────────────────
 *
 * Run:  php tests/php/history_read.test.php
 *
 *     DC_TEST_DB_HOST / _PORT / _USER / _PASS
 *
 * The shipped api.php is copied byte-identically into a sandbox and SERVED OVER
 * REAL HTTP, so get_quotation_history runs exactly as production would run it.
 * Revisions are made the only way the application makes them — by saving and
 * updating real quotations through the real endpoints — except where a case is
 * ABOUT a record this application cannot produce (a legacy first UPDATE, a
 * future snapshot version, a nameless actor), which is inserted directly and
 * says so.
 *
 * WHAT IS BEING MEASURED IS HONESTY AS MUCH AS CORRECTNESS. A history that
 * invents a previous state, guesses at a format it does not know, or reports a
 * reorder as a removal plus an addition would be worse than no history, so each
 * of those has a case of its own.
 *
 * Needs a real MySQL. EXITS NON-ZERO rather than skipping.
 */

$asserts = 0; $failures = [];
function ok($cond, $msg) {
    global $asserts, $failures;
    $asserts++;
    if (!$cond) $failures[] = $msg;
}
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

$ROOT = dirname(__DIR__, 2);
$API  = file_get_contents($ROOT . '/api.php');
$MIG  = file_get_contents($ROOT . '/migrations/2026-08-28-create-quotation-revisions.sql');

// ══ 0 · the read path, in the shipped source ═══════════════════════════════
{
    $seg = function ($a, $b) use ($API) {
        $i = strpos($API, $a); $j = strpos($API, $b);
        return ($i === false || $j === false || $j < $i) ? '' : substr($API, $i, $j - $i);
    };
    $hist = $seg("\$action === 'get_quotation_history'", "\$action === 'save_quotation'");
    ok($hist !== '', '0: the history action exists in the shipped file');

    /* READ ONLY, and asserted on the code rather than hoped for. */
    $bare = preg_replace('~//[^\n]*~', '', preg_replace('~/\*.*?\*/~s', '', $hist));
    eq(preg_match_all('/\bINSERT\b/i', $bare), 0, '0: the history branch contains no INSERT');
    eq(preg_match_all('/\bUPDATE\s+\w/i', $bare), 0, '0: no UPDATE');
    eq(preg_match_all('/\bDELETE\s+FROM\b/i', $bare), 0, '0: no DELETE');
    eq(preg_match_all('/\bTRUNCATE\b/i', $bare), 0, '0: no TRUNCATE');
    ok(strpos($bare, 'dc_txn_begin(') === false, '0: it opens no transaction');
    ok(strpos($bare, 'dc_write_revision(') === false, '0: and never reaches the writer');
    ok(strpos($bare, 'FOR UPDATE') === false, '0: and takes no row lock — it is a read');

    /* NOT JOINED TO quotations. A revision records what a quotation WAS, and
       asking quotations to vouch for it would make history vanish exactly when
       it is most wanted. */
    ok(stripos($bare, 'JOIN quotations') === false,
       '0: the history read does not join quotations to fetch revisions');
    ok(strpos($bare, 'FROM quotation_revisions WHERE quotation_id = ?') !== false,
       '0: it reads quotation_revisions directly, by a bound quotation_id');
    ok(strpos($bare, 'ORDER BY revision_no ASC') !== false,
       '0: oldest first, because each entry is a difference from the one before it');
    ok(strpos($bare, 'bind_param') !== false && strpos($bare, "\$_GET['id']") !== false,
       '0: the requested id is bound, not interpolated');

    /* The accepted storage contract is untouched by this round. */
    $code = preg_replace('~//[^\n]*~', '', preg_replace('~/\*.*?\*/~s', '', $API));
    eq(substr_count($code, 'INSERT INTO quotation_revisions'), 1,
       '0: still exactly ONE INSERT into quotation_revisions in the whole application');
    eq(preg_match_all('/(UPDATE|DELETE\s+FROM|TRUNCATE)\s+(TABLE\s+)?quotation_revisions/i', $code), 0,
       '0: and still no UPDATE, DELETE or TRUNCATE against it');
    ok(strpos($code, 'const DC_SNAPSHOT_SCHEMA_VERSION = 1;') !== false,
       '0: snapshot_schema_version is still 1 — this round adds no version 2');
    ok(strpos($code, 'ALTER TABLE quotation_revisions') === false,
       '0: and the application alters no revision schema');
    ok(!preg_match('/[\'"](diff|diff_json)[\'"]\s*=>/', $code),
       '0: nothing derived is written back into a snapshot');
}

// ══ connect ════════════════════════════════════════════════════════════════
mysqli_report(MYSQLI_REPORT_OFF);
$H = getenv('DC_TEST_DB_HOST') ?: '127.0.0.1';
$P = (int)(getenv('DC_TEST_DB_PORT') ?: 3306);
$U = getenv('DC_TEST_DB_USER') ?: 'root';
$W = getenv('DC_TEST_DB_PASS'); if ($W === false) $W = '';

$db = @new mysqli($H, $U, $W, null, $P);
if (!$db || $db->connect_errno) {
    echo "\n  FAIL  history read — no MySQL at {$H}:{$P}\n\n";
    echo "   - This suite measures what the endpoint returns from a real database.\n";
    echo "   - It is deliberately NOT skipped.\n\n";
    exit(1);
}
$server = $db->query('SELECT VERSION()')->fetch_row()[0];

$DBN = 'dc_hist_test_' . getmypid();
$ex = $db->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$DBN}'");
if ($ex && $ex->num_rows) { echo "\n  FAIL  {$DBN} already exists — refusing to reuse it.\n\n"; exit(1); }
$db->query("CREATE DATABASE {$DBN}");
$db->select_db($DBN);

preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', $MIG, $m2);
ok(!empty($m2[1]), 'schema: section 2 lifted from the shipped migration');

$db->query("CREATE TABLE companies (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB");
$db->query("CREATE TABLE quotations (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT UNSIGNED NULL,
    ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    quote_date DATE NULL, valid_until DATE NULL,
    prepared_by VARCHAR(100) NULL, remarks TEXT NULL,
    customer_name VARCHAR(200) NULL, customer_phone VARCHAR(50) NULL,
    items LONGTEXT NULL, total_amount DECIMAL(12,2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
$db->query($m2[1]);

// ── the sandbox: the SHIPPED api.php, served over real HTTP ────────────────
$SB = sys_get_temp_dir() . '/dc-hist-sb-' . getmypid();
@mkdir($SB, 0777, true);
register_shutdown_function(function () use ($SB) {
    foreach (['api.php', 'pricing_history.php', 'auth.php', 'db.php',
              'server-out.log', 'server-err.log'] as $f) @unlink($SB . '/' . $f);
    @rmdir($SB);
});
copy($ROOT . '/api.php', $SB . '/api.php');
copy($ROOT . '/pricing_history.php', $SB . '/pricing_history.php');
file_put_contents($SB . '/auth.php',
    "<?php function dc_require_api_login(){}\n"
  . "function dc_current_user(){ return ['id'=>7,'username'=>'nicholas','display_name'=>'Nicholas Koh']; }\n");
file_put_contents($SB . '/db.php',
    "<?php function getDB(){ static \$d; if(!\$d){ \$d = new mysqli('{$H}','{$U}','{$W}',null,{$P}); \$d->select_db('{$DBN}'); } return \$d; }\n");
ok(sha1_file($SB . '/api.php') === sha1_file($ROOT . '/api.php'),
   '1: the sandbox serves a byte-identical copy of the shipped api.php');

$PORT = 37000 + (getmypid() % 900);
$srvPipes = [];
$srv = proc_open([PHP_BINARY, '-S', "127.0.0.1:{$PORT}", '-t', $SB],
                 [1 => ['file', $SB . '/server-out.log', 'a'],
                  2 => ['file', $SB . '/server-err.log', 'a']], $srvPipes, $SB);
if (!is_resource($srv)) { echo "\n  FAIL  could not start the sandbox web server\n\n"; exit(1); }
register_shutdown_function(function () use (&$srv, &$srvPipes) {
    if (is_resource($srv)) { proc_terminate($srv);
        foreach ($srvPipes as $sp) if (is_resource($sp)) fclose($sp);
        proc_close($srv); $srv = null; }
});
$up = false;
for ($i = 0; $i < 60; $i++) {
    $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3);
    if ($fp) { fclose($fp); $up = true; break; }
    usleep(200000);
}
ok($up, "1: the sandbox web server is listening on 127.0.0.1:{$PORT}");
if (!$up) exit(1);

$post = function ($action, $payload = null) use ($PORT) {
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'header' => "Content-Type: application/json\r\n",
        'content' => $payload === null ? '' : json_encode($payload),
        'ignore_errors' => true, 'timeout' => 30,
    ]]);
    $out = @file_get_contents("http://127.0.0.1:{$PORT}/api.php?action=" . rawurlencode($action), false, $ctx);
    $j = json_decode((string)$out, true);
    return is_array($j) ? $j : ['ok' => false, 'error' => 'non-JSON: ' . substr((string)$out, 0, 300)];
};
$hist = function ($id) use ($PORT) {
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'ignore_errors' => true, 'timeout' => 30]]);
    $out = @file_get_contents("http://127.0.0.1:{$PORT}/api.php?action=get_quotation_history&id="
                              . rawurlencode((string)$id), false, $ctx);
    $j = json_decode((string)$out, true);
    return is_array($j) ? $j : ['ok' => false, 'error' => 'non-JSON: ' . substr((string)$out, 0, 300)];
};
$one  = function ($q) use ($db) { $r = $db->query($q); return $r ? $r->fetch_row()[0] : null; };
$qrow = function ($id) use ($db) {
    $r = $db->query("SELECT * FROM quotations WHERE id=" . (int)$id); return $r ? $r->fetch_assoc() : null;
};
$revRows = function ($id) use ($db) {
    $r = $db->query("SELECT * FROM quotation_revisions WHERE quotation_id=" . (int)$id . " ORDER BY id");
    $o = []; while ($x = $r->fetch_assoc()) $o[] = $x; return $o;
};
/* Every change of one kind in one revision's derived list. */
$kinds = function (array $rev) {
    return array_map(function ($c) { return $c['kind']; }, $rev['changes'] ?? []);
};
$pick = function (array $rev, $kind) {
    $o = [];
    foreach (($rev['changes'] ?? []) as $c) if ($c['kind'] === $kind) $o[] = $c;
    return $o;
};
$field = function (array $rev, $name) {
    foreach (($rev['changes'] ?? []) as $c) {
        if ($c['kind'] === 'field' && $c['field'] === $name) return $c;
    }
    return null;
};

$db->query("INSERT INTO companies (name) VALUES ('Alpha Engineering Sdn Bhd')");
$COMP_A = (int)$db->insert_id;
$db->query("INSERT INTO companies (name) VALUES ('Gamma Hardware Sdn Bhd')");
$COMP_B = (int)$db->insert_id;

$itemA = ['desc' => 'SAG ROD', 'cleanSize' => 'M12', 'dimensionPreview' => 'L 500',
          'size' => 'M12 x 500', 'qty' => 4, 'finalUnitPrice' => 5.76, 'totalAmount' => 23.04,
          'material' => 'MS', 'finish' => 'ZP'];
$itemB = ['desc' => 'HEX NUT', 'cleanSize' => 'M20', 'dimensionPreview' => 'L 250',
          'size' => 'M20 x 250', 'qty' => 10, 'finalUnitPrice' => 1.10, 'totalAmount' => 11.00,
          'material' => 'MS', 'finish' => 'HDG'];
$base = ['company_id' => $COMP_A, 'quote_date' => '2026-08-29', 'valid_until' => '2026-09-30',
         'prepared_by' => 'Siti from the office', 'remarks' => 'handle with care',
         'customer_name' => 'Beta Sdn Bhd', 'customer_phone' => '012-3456789',
         'total_amount' => 34.04];

// ══ 2 · no revisions at all ════════════════════════════════════════════════
{
    /* A quotation row that exists with no history — the honest answer is an
       empty list, not an error and not an invented entry. */
    $db->query("INSERT INTO quotations (ref_no, customer_name, items, total_amount)
                VALUES ('Q-EMPTY-0001', 'No History Sdn Bhd', '[]', 0)");
    $emptyId = (int)$db->insert_id;
    $h = $hist($emptyId);
    ok(!empty($h['ok']), '2: a quotation with no revisions answers ok: ' . json_encode($h));
    eq($h['quotation_id'], $emptyId, '2: for the id that was asked for');
    eq($h['revisions'], [], '2: with an empty history, not a fabricated one');

    /* An id nothing has ever used answers the same way rather than failing. */
    $h2 = $hist(999999);
    ok(!empty($h2['ok']), '2: an unknown id also answers ok');
    eq($h2['revisions'], [], '2: with nothing in it');

    /* A missing id is refused rather than silently treated as 0. */
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'ignore_errors' => true, 'timeout' => 30]]);
    $raw = @file_get_contents("http://127.0.0.1:{$PORT}/api.php?action=get_quotation_history", false, $ctx);
    $j = json_decode((string)$raw, true);
    ok(is_array($j) && empty($j['ok']), '2: a request with no id is refused');
}

// ══ 3 · one CREATE revision ════════════════════════════════════════════════
$r = $post('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$itemA, $itemB]]));
ok(!empty($r['ok']), '3: a quotation was created: ' . json_encode($r));
$ID   = (int)$r['id'];
$live = $r['items'];
$uidA = $live[0]['item_uid'];
$uidB = $live[1]['item_uid'];
{
    $h = $hist($ID);
    ok(!empty($h['ok']), '3: its history reads back');
    eq(count($h['revisions']), 1, '3: exactly one entry');
    $e = $h['revisions'][0];
    eq((int)$e['revision_no'], 1, '3: numbered 1');
    eq($e['event_type'], 'create', '3: a create');
    eq((int)$e['snapshot_schema_version'], 1, '3: schema version 1');
    eq($e['actor']['user_id'], 7, '3: the actor the session named');
    eq($e['actor']['username'], 'nicholas', '3: by username');
    eq($e['actor']['display_name'], 'Nicholas Koh', '3: and display name');
    eq($kinds($e), ['created'], '3: ONE change, and it is "created"');
    $c = $e['changes'][0];
    eq((int)$c['item_count'], 2, '3: carrying the item count');
    eq($c['total_amount'], '34.04', '3: the persisted total');
    eq($c['company'], 'Alpha Engineering Sdn Bhd', '3: and the FROZEN company name');
    /* NOTHING PRETENDS THERE WAS A BEFORE. */
    ok(!array_key_exists('from', $c) && !array_key_exists('to', $c),
       '3: with no before/after values invented for a creation');
}

// ══ 4 · a scalar field change ══════════════════════════════════════════════
{
    $r2 = $post('update_quotation', array_merge($base, ['id' => $ID, 'items' => $live,
        'customer_name' => 'Delta Sdn Bhd']));
    ok(!empty($r2['ok']), '4: a customer_name change saves: ' . json_encode($r2));
    $h = $hist($ID);
    eq(count($h['revisions']), 2, '4: two entries now');
    $e = $h['revisions'][0];
    eq((int)$e['revision_no'], 2, '4: NEWEST FIRST — revision 2 leads');
    eq($e['event_type'], 'update', '4: an update');
    eq($kinds($e), ['field'], '4: exactly ONE change, and it is a field');
    $c = $field($e, 'customer_name');
    ok($c !== null, '4: the field is customer_name');
    eq($c['from'], 'Beta Sdn Bhd', '4: from the value the previous snapshot recorded');
    eq($c['to'], 'Delta Sdn Bhd', '4: to the one this snapshot recorded');
}

// ══ 5 · a company change shows the FROZEN names ════════════════════════════
{
    $r2 = $post('update_quotation', array_merge($base, ['id' => $ID, 'items' => $live,
        'customer_name' => 'Delta Sdn Bhd', 'company_id' => $COMP_B]));
    ok(!empty($r2['ok']), '5: a company change saves');
    $h = $hist($ID);
    $e = $h['revisions'][0];
    eq($kinds($e), ['field'], '5: ONE change — company is one change, not id plus name');
    $c = $field($e, 'company');
    ok($c !== null, '5: and it is the company');
    eq($c['from'], 'Alpha Engineering Sdn Bhd', '5: from the name FROZEN in the older snapshot');
    eq($c['to'], 'Gamma Hardware Sdn Bhd', '5: to the name frozen in the newer one');

    /* THE LIVE TABLE IS NEVER CONSULTED. Renaming the company now must not
       rewrite what either document said at the time. */
    $db->query("UPDATE companies SET name='RENAMED LATER Sdn Bhd' WHERE id=" . $COMP_B);
    $h2 = $hist($ID);
    $c2 = $field($h2['revisions'][0], 'company');
    eq($c2['to'], 'Gamma Hardware Sdn Bhd',
       '5: and it still reads the frozen name after the company was renamed');
    $db->query("UPDATE companies SET name='Gamma Hardware Sdn Bhd' WHERE id=" . $COMP_B);
}
$base['company_id'] = $COMP_B;
$base['customer_name'] = 'Delta Sdn Bhd';

// ══ 6 · an item field change, on the same item_uid ═════════════════════════
{
    $edited = $live;
    $edited[0] = array_merge($edited[0], ['qty' => 9, 'finalUnitPrice' => 6.00]);
    $r2 = $post('update_quotation', array_merge($base, ['id' => $ID, 'items' => $edited]));
    ok(!empty($r2['ok']), '6: an item edit saves');
    $live = $r2['items'];
    $h = $hist($ID);
    $e = $h['revisions'][0];
    eq($kinds($e), ['item_changed'],
       '6: ONE change — an item CHANGED, not a removal plus an addition');
    eq(count($pick($e, 'item_added')), 0, '6: nothing was added');
    eq(count($pick($e, 'item_removed')), 0, '6: and nothing was removed');
    $c = $e['changes'][0];
    /* BOTH FIELDS ARE GROUPED UNDER THE ONE ITEM. */
    eq(count($c['fields']), 2, '6: both changed fields are grouped under that one item');
    $byField = [];
    foreach ($c['fields'] as $f) $byField[$f['field']] = $f;
    eq($byField['qty']['from'], '4', '6: qty from 4');
    eq($byField['qty']['to'], '9', '6: to 9');
    eq($byField['finalUnitPrice']['from'], '5.76', '6: unit price from 5.76');
    eq($byField['finalUnitPrice']['to'], '6', '6: to 6');
    ok(strpos($c['item'], 'M12') !== false, '6: labelled by what the item itself carries: ' . $c['item']);
    ok(strpos(json_encode($c), $uidA) === false,
       '6: and the uid is used for matching, not shown as the label');
}

// ══ 7 · an item added ══════════════════════════════════════════════════════
{
    $itemC = ['desc' => 'WASHER', 'cleanSize' => 'M16', 'dimensionPreview' => '', 'size' => 'M16',
              'qty' => 20, 'finalUnitPrice' => 0.25, 'totalAmount' => 5.00,
              'material' => 'MS', 'finish' => 'ZP'];
    $r2 = $post('update_quotation', array_merge($base, ['id' => $ID,
        'items' => array_merge($live, [$itemC])]));
    ok(!empty($r2['ok']), '7: adding an item saves');
    $live = $r2['items'];
    $uidC = $live[2]['item_uid'];
    $h = $hist($ID);
    $e = $h['revisions'][0];
    eq($kinds($e), ['item_added'], '7: EXACTLY ONE change, and it is an addition');
    $c = $pick($e, 'item_added')[0];
    ok(strpos($c['item'], 'M16') !== false, '7: naming the item that arrived: ' . $c['item']);
    eq($c['qty'], '20', '7: with the quantity it arrived carrying');
    eq(count($pick($e, 'item_removed')), 0, '7: and nothing is reported as removed');
    eq(count($pick($e, 'item_changed')), 0, '7: nor the untouched items as changed');
}

// ══ 8 · an item removed ════════════════════════════════════════════════════
{
    $kept = [$live[0], $live[2]];              // drop the middle one
    $r2 = $post('update_quotation', array_merge($base, ['id' => $ID, 'items' => $kept]));
    ok(!empty($r2['ok']), '8: removing an item saves');
    $live = $r2['items'];
    $h = $hist($ID);
    $e = $h['revisions'][0];
    eq($kinds($e), ['item_removed'], '8: EXACTLY ONE change, and it is a removal');
    $c = $pick($e, 'item_removed')[0];
    ok(strpos($c['item'], 'M20') !== false, '8: naming the item that left: ' . $c['item']);
    eq(count($pick($e, 'item_added')), 0, '8: nothing is reported as added');
    eq(count($pick($e, 'item_changed')), 0, '8: and the survivors are not reported as changed');
}

// ══ 9 · a REORDER is a reorder, and nothing else ═══════════════════════════
{
    $swapped = [$live[1], $live[0]];
    $r2 = $post('update_quotation', array_merge($base, ['id' => $ID, 'items' => $swapped]));
    ok(!empty($r2['ok']), '9: a pure reorder saves');
    $h = $hist($ID);
    $e = $h['revisions'][0];
    eq($kinds($e), ['items_reordered'], '9: ONE change, and it is a reorder');
    eq(count($pick($e, 'item_added')), 0, '9: ZERO false additions');
    eq(count($pick($e, 'item_removed')), 0, '9: ZERO false removals');
    eq(count($pick($e, 'item_changed')), 0, '9: and no item is reported as edited');
    /* The identity set is what makes it a reorder rather than a replacement. */
    $before = array_map(function ($i) { return $i['item_uid']; }, $live);
    $after  = array_map(function ($i) { return $i['item_uid']; }, $r2['items']);
    $b = $before; $a = $after; sort($b); sort($a);
    eq($a, $b, '9: with the SAME set of item_uids on both sides');
    ok($after !== $before, '9: in a different order');
    $live = $r2['items'];
}

// ══ 10 · each entry compares against the one immediately before it ═════════
{
    $h = $hist($ID);
    $nos = array_map(function ($e) { return (int)$e['revision_no']; }, $h['revisions']);
    eq($nos, [7, 6, 5, 4, 3, 2, 1], '10: seven entries, newest first, deterministic');
    /* Walk it oldest-first and check each one describes a step, not a total. */
    $byNo = [];
    foreach ($h['revisions'] as $e) $byNo[(int)$e['revision_no']] = $e;
    eq($kinds($byNo[1]), ['created'],          '10: #1 created');
    eq($kinds($byNo[2]), ['field'],            '10: #2 one field');
    eq($kinds($byNo[3]), ['field'],            '10: #3 one field');
    eq($kinds($byNo[4]), ['item_changed'],     '10: #4 one item changed');
    eq($kinds($byNo[5]), ['item_added'],       '10: #5 one item added');
    eq($kinds($byNo[6]), ['item_removed'],     '10: #6 one item removed');
    eq($kinds($byNo[7]), ['items_reordered'],  '10: #7 a reorder');
    /* #3 changed only the company; if it had been compared against #1 rather
       than #2 it would also have carried the customer_name change. */
    eq(count($byNo[3]['changes']), 1,
       '10: and #3 describes only its own step, not everything since #1');
    /* Asking twice returns the same thing. */
    eq($hist($ID), $h, '10: and two identical reads answer identically');
}

// ══ 11 · a quotation this application could not have produced ══════════════
//         a legacy first UPDATE, a nameless actor, a future snapshot version
{
    /* INSERTED DIRECTLY, and it says so. Baseline rollout is deferred, so a
       quotation that existed before the writer did can genuinely have an
       UPDATE as its first recorded revision. */
    $db->query("INSERT INTO quotations (ref_no, company_id, customer_name, items, total_amount)
                VALUES ('Q-LEGACY-0009', NULL, 'Legacy Sdn Bhd', '[]', 100.00)");
    $LID = (int)$db->insert_id;
    $snapOf = function ($customer, $total) use ($LID) {
        return json_encode([
            'quotation' => ['id' => $LID, 'ref_no' => 'Q-LEGACY-0009', 'company_id' => null,
                            'company_name' => null, 'customer_name' => $customer,
                            'customer_phone' => null, 'quote_date' => null, 'valid_until' => null,
                            'prepared_by' => null, 'remarks' => null,
                            'total_amount' => $total, 'created_at' => '2026-01-01 00:00:00'],
            'items' => [], 'item_count' => 0,
        ]);
    };
    $ins = function ($no, $event, $ver, $json, $actorId, $user, $name) use ($db, $LID) {
        $st = $db->prepare("INSERT INTO quotation_revisions
            (quotation_id, revision_no, quotation_ref_no, event_type, actor_user_id,
             actor_username, actor_display_name, snapshot_schema_version, snapshot_json)
            VALUES (?,?,?,?,?,?,?,?,?)");
        $ref = 'Q-LEGACY-0009';
        $st->bind_param('iississis', $LID, $no, $ref, $event, $actorId, $user, $name, $ver, $json);
        $r = $st->execute(); $st->close(); return $r;
    };
    ok($ins(1, 'update', 1, $snapOf('Legacy Sdn Bhd', '100.00'), null, null, null),
       '11: a legacy revision #1 UPDATE was inserted directly, with no actor recorded');
    ok($ins(2, 'update', 1, $snapOf('Legacy Renamed Sdn Bhd', '100.00'), null, null, null),
       '11: and a second one after it');
    ok($ins(3, 'update', 9, '{"whatever":true}', 4, 'ghost', null),
       '11: and a third written in a snapshot format this viewer does not know');

    $h = $hist($LID);
    ok(!empty($h['ok']), '11: the legacy history reads back');
    eq(count($h['revisions']), 3, '11: three entries');
    $byNo = [];
    foreach ($h['revisions'] as $e) $byNo[(int)$e['revision_no']] = $e;

    /* FIRST RECORDED REVISION IS AN UPDATE. */
    eq($kinds($byNo[1]), ['no_previous'],
       '11: #1 says the previous state is not available');
    ok($byNo[1]['event_type'] === 'update',
       '11: and is still reported as the UPDATE it is — not quietly turned into a create');
    eq(count($byNo[1]['changes']), 1, '11: with nothing else claimed about it');
    ok(!isset($byNo[1]['changes'][0]['from']) && !isset($byNo[1]['changes'][0]['to']),
       '11: and no from/to values invented against a state nobody recorded');

    /* NULL ACTOR FIELDS SURVIVE AS NULL. */
    eq($byNo[1]['actor']['user_id'], null, '11: a missing actor id stays null');
    eq($byNo[1]['actor']['username'], null, '11: a missing username stays null');
    eq($byNo[1]['actor']['display_name'], null, '11: and a missing display name too');

    /* #2 has a real predecessor, so it derives normally. */
    eq($kinds($byNo[2]), ['field'], '11: #2 has a predecessor and derives a real change');
    eq($field($byNo[2], 'customer_name')['to'], 'Legacy Renamed Sdn Bhd',
       '11: with the value the newer snapshot recorded');

    /* AN UNKNOWN SNAPSHOT VERSION IS NOT GUESSED AT. */
    eq($kinds($byNo[3]), ['unsupported_version'], '11: #3 is reported as unsupported');
    eq((int)$byNo[3]['changes'][0]['version'], 9, '11: naming the version it found');
    eq((int)$byNo[3]['snapshot_schema_version'], 9, '11: which the entry also carries');
    eq($byNo[3]['actor']['username'], 'ghost', '11: while the metadata it CAN read is still read');
    eq($byNo[3]['actor']['display_name'], null, '11: including the parts that are absent');
}

// ══ 12 · asking is not touching ════════════════════════════════════════════
{
    $qBefore    = $qrow($ID);
    $revsBefore = $revRows($ID);
    $countAll   = (int)$one("SELECT COUNT(*) FROM quotation_revisions");
    for ($i = 0; $i < 3; $i++) $hist($ID);
    eq($qrow($ID), $qBefore, '12: reading history leaves the quotation row byte-identical');
    eq($revRows($ID), $revsBefore, '12: and every revision row byte-identical');
    eq((int)$one("SELECT COUNT(*) FROM quotation_revisions"), $countAll,
       '12: the revision count did not move');
    eq(array_map(function ($r) { return (int)$r['revision_no']; }, $revRows($ID)),
       array_map(function ($r) { return (int)$r['revision_no']; }, $revsBefore),
       '12: and no revision_no changed');
}

// ══ 13 · the id that was asked for is the id that answers ══════════════════
{
    /* A second quotation with its own history: asking for one must never
       return the other's revisions. */
    $r2 = $post('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$itemA],
        'customer_name' => 'Second Sdn Bhd']));
    ok(!empty($r2['ok']), '13: a second quotation exists: ' . json_encode($r2));
    $ID2 = (int)$r2['id'];

    $h1 = $hist($ID);  $h2 = $hist($ID2);
    eq($h1['quotation_id'], $ID,  '13: the first answers for its own id');
    eq($h2['quotation_id'], $ID2, '13: the second for its own');
    eq(count($h2['revisions']), 1, '13: and carries only its own single revision');
    ok(count($h1['revisions']) > count($h2['revisions']),
       '13: the two histories are genuinely different');
    eq($kinds($h2['revisions'][0]), ['created'], '13: the second quotation was created');

    /* A non-numeric id is bound as an integer rather than reaching SQL. */
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'ignore_errors' => true, 'timeout' => 30]]);
    $raw = @file_get_contents("http://127.0.0.1:{$PORT}/api.php?action=get_quotation_history&id="
                              . rawurlencode("1 OR 1=1"), false, $ctx);
    $j = json_decode((string)$raw, true);
    ok(is_array($j), '13: a non-numeric id still answers JSON');
    if (is_array($j) && !empty($j['ok'])) {
        eq((int)$j['quotation_id'], 1, '13: read as the integer 1, and nothing wider');
        ok(count($j['revisions']) <= 1, '13: and does not return every quotation history');
    } else {
        ok(true, '13: or is refused outright');
        ok(true, '13: either way it is not an injection');
    }
}

// ── clean up ─────────────────────────────────────────────────────────────────
$db->select_db('mysql');
ok($db->query("DROP DATABASE {$DBN}") === true, '13: the throwaway database was dropped');
$db->close();

$name = 'history read — derived when asked, and stored nowhere';
if ($failures) {
    echo "\n  FAIL  {$name}  ({$asserts} assertions, " . count($failures) . " failed)  [MySQL {$server}]\n\n";
    foreach ($failures as $f) echo "   - {$f}\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    {$name}  ({$asserts} assertions)  [MySQL {$server}]\n\n";
