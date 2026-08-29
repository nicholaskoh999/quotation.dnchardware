<?php
/**
 * ── No-op suppression — an update that changes nothing records nothing ──────
 *
 * Run:  php tests/php/noop_suppression.test.php
 *
 *     DC_TEST_DB_HOST / _PORT / _USER / _PASS
 *
 * The shipped api.php is copied byte-identically into a sandbox and SERVED OVER
 * REAL HTTP, so update_quotation runs exactly as production runs it — real
 * MySQL, real transactions, real request bodies. What is measured is the
 * database afterwards.
 *
 * THE QUESTION THIS SUITE ANSWERS IS NARROW: given a successful save, was there
 * anything for a revision to record? It does not measure what changed. Nothing
 * in this round persists a diff, and the accepted revision schema has no field
 * for one.
 *
 * Needs a real MySQL. EXITS NON-ZERO rather than skipping: a suppression test
 * that did not run must not read as one that passed.
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

// ══ 0 · the shape of the change, in the shipped source ═════════════════════
{
    $seg = function ($a, $b) use ($API) {
        $i = strpos($API, $a); $j = strpos($API, $b);
        return substr($API, $i, $j - $i);
    };
    $create = $seg("\$action === 'save_quotation'", "\$action === 'update_quotation'");
    $update = $seg("\$action === 'update_quotation'", "\$action === 'delete_quotation'");
    ok($create !== '' && $update !== '', '0: both handlers were located in the shipped file');

    /* THE SUPPRESSION IS ON UPDATE AND ONLY ON UPDATE. A create has no before
       state to compare against and always writes exactly one revision. */
    ok(strpos($update, 'dc_business_state(') !== false,
       '0: the update path compares business state');
    ok(strpos($create, 'dc_business_state(') === false,
       '0: the create path does NOT — a create is never suppressed');
    ok(strpos($update, 'if (dc_business_state($afterRow) !== $businessBefore) {') !== false,
       '0: and the writer call is guarded by that comparison');
    /* Counted on the code with comments stripped, so that prose ABOUT the
       writer cannot be mistaken for a second call to it. */
    $bare = function ($t) {
        $t = preg_replace('~/\*.*?\*/~s', '', $t);
        return preg_replace('~//[^
]*~', '', $t);
    };
    eq(substr_count($bare($update), 'dc_write_revision('), 1,
       '0: the update path still calls the writer exactly once, guarded');
    eq(substr_count($bare($create), 'dc_write_revision('), 1,
       '0: and the create path still calls it exactly once, unguarded');

    /* PERSISTED BEFORE vs PERSISTED AFTER, never the browser payload. */
    $b = strpos($update, '$businessBefore = dc_business_state($persisted)');
    $u = strpos($update, 'UPDATE quotations SET');
    $a = strpos($update, '$afterRow = dc_read_quotation_snapshot_row(');
    $w = strpos($update, 'dc_write_revision(');
    $c = strrpos($update, 'dc_txn_commit(');
    ok($b !== false && $a !== false, '0: a BEFORE state and an AFTER state are both taken');
    ok($b < $u, '0: BEFORE is captured before the write');
    ok($u < $a, '0: AFTER is read after it');
    ok($a < $w && $w < $c, '0: and the guarded write still happens INSIDE the transaction');
    ok(strpos($update, 'dc_business_state($input') === false
       && strpos($update, 'dc_business_state($itemsArr') === false,
       '0: the payload is never what gets compared');

    /* THE ACCEPTED TRANSACTION CONTRACT IS UNTOUCHED. */
    ok(strpos($update, 'dc_lock_quotation_for_update(') !== false, '0: the locked read is still there');
    ok(strpos($update, "dc_reconcile_item_uids(\$input['items'] ?? [], \$persisted['items']") !== false,
       '0: item identity is still reconciled against the LOCKED row');
    ok(strpos($update, 'UPDATE quotations SET company_id=?,quote_date=?') !== false
       && strpos($update, 'SET ref_no') === false,
       '0: ref_no is still not in the SET list');

    /* THE COMPARISON IS NOT A STORAGE CONTRACT. Nothing new is persisted, the
       snapshot shape is untouched, and the schema version has not moved. */
    $code = preg_replace('~/\*.*?\*/~s', '', $API);
    $code = preg_replace('~//[^\n]*~', '', $code);
    eq(substr_count($code, 'INSERT INTO quotation_revisions'), 1,
       '0: still exactly ONE INSERT into quotation_revisions');
    eq(preg_match_all('/(UPDATE|DELETE\s+FROM|TRUNCATE)\s+(TABLE\s+)?quotation_revisions/i', $code), 0,
       '0: and still no UPDATE, DELETE or TRUNCATE against it');
    ok(strpos($code, 'const DC_SNAPSHOT_SCHEMA_VERSION = 1;') !== false,
       '0: snapshot_schema_version is still 1 — no v2, and no persisted diff');
    ok(!preg_match('/[\'"](diff|diff_json|changes|before_after)[\'"]\s*=>/', $code),
       '0: the snapshot carries no diff key — nothing about the comparison is stored');
    ok(strpos($code, 'uid_order') !== false
       && strpos($code, 'dc_business_state') !== false,
       '0: the comparison shape exists only as internal PHP');
    ok(strpos($code, 'ALTER TABLE quotation_revisions') === false,
       '0: and the application alters no revision schema');
}

// ══ connect ════════════════════════════════════════════════════════════════
mysqli_report(MYSQLI_REPORT_OFF);
$H = getenv('DC_TEST_DB_HOST') ?: '127.0.0.1';
$P = (int)(getenv('DC_TEST_DB_PORT') ?: 3306);
$U = getenv('DC_TEST_DB_USER') ?: 'root';
$W = getenv('DC_TEST_DB_PASS'); if ($W === false) $W = '';

$db = @new mysqli($H, $U, $W, null, $P);
if (!$db || $db->connect_errno) {
    echo "\n  FAIL  no-op suppression — no MySQL at {$H}:{$P}\n\n";
    echo "   - This suite measures what the database holds, so it needs a server.\n";
    echo "   - It is deliberately NOT skipped.\n\n";
    exit(1);
}
$server = $db->query('SELECT VERSION()')->fetch_row()[0];

$DBN = 'dc_noop_test_' . getmypid();
$ex = $db->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$DBN}'");
if ($ex && $ex->num_rows) { echo "\n  FAIL  {$DBN} already exists — refusing to reuse it.\n\n"; exit(1); }
$db->query("CREATE DATABASE {$DBN}");
$db->select_db($DBN);

/* The revision table comes from the SHIPPED migration, lifted between its
   markers, so this suite cannot pass against a schema the migration would not
   produce — and cannot quietly acquire a column the accepted schema forbids. */
preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', $MIG, $m2);
ok(!empty($m2[1]), 'schema: section 2 lifted from the shipped migration');

$schema = function () use ($db, $m2) {
    $db->query("DROP TABLE IF EXISTS quotation_revisions");
    $db->query("DROP TABLE IF EXISTS quotations");
    $db->query("DROP TABLE IF EXISTS companies");
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
};
$schema();

// ── the sandbox: the SHIPPED api.php, served over real HTTP ────────────────
$SB = sys_get_temp_dir() . '/dc-noop-sb-' . getmypid();
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

$PORT = 36000 + (getmypid() % 900);
/* THE SERVER'S OUTPUT GOES TO FILES, NOT TO PIPES NOBODY READS. The PHP
   built-in server writes one line per request to stderr and serves requests one
   at a time. Handed an unread pipe, it blocks forever the moment the OS pipe
   buffer fills — a few kilobytes, which is forty-odd requests — and the suite
   then hangs with the server alive and idle. This suite makes many more
   requests than that, so the descriptors are files it can always write to. */
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

$call = function ($action, $payload = null) use ($PORT) {
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'header' => "Content-Type: application/json\r\n",
        'content' => $payload === null ? '' : json_encode($payload),
        'ignore_errors' => true, 'timeout' => 30,
    ]]);
    $out = @file_get_contents("http://127.0.0.1:{$PORT}/api.php?action=" . rawurlencode($action), false, $ctx);
    $j = json_decode((string)$out, true);
    return is_array($j) ? $j : ['ok' => false, 'error' => 'non-JSON: ' . substr((string)$out, 0, 300)];
};
$one  = function ($q) use ($db) { $r = $db->query($q); return $r ? $r->fetch_row()[0] : null; };
$revs = function ($qid = null) use ($db) {
    $w = $qid === null ? '' : ' WHERE quotation_id=' . (int)$qid;
    $r = $db->query("SELECT * FROM quotation_revisions{$w} ORDER BY id");
    $out = []; while ($x = $r->fetch_assoc()) $out[] = $x;
    return $out;
};
$qrow = function ($id) use ($db) {
    $r = $db->query("SELECT * FROM quotations WHERE id=" . (int)$id); return $r ? $r->fetch_assoc() : null;
};
$maxNo = function ($id) use ($one) {
    return (int)$one("SELECT COALESCE(MAX(revision_no),0) FROM quotation_revisions WHERE quotation_id=" . (int)$id);
};
$nRevs = function () use ($one) { return (int)$one("SELECT COUNT(*) FROM quotation_revisions"); };
$nQuot = function () use ($one) { return (int)$one("SELECT COUNT(*) FROM quotations"); };

$db->query("INSERT INTO companies (name) VALUES ('Alpha Engineering Sdn Bhd')");
$COMPANY = (int)$db->insert_id;
$db->query("INSERT INTO companies (name) VALUES ('Gamma Hardware Sdn Bhd')");
$COMPANY2 = (int)$db->insert_id;

$itemA = ['desc' => 'SAG ROD', 'size' => 'M20', 'qty' => 4, 'finalUnitPrice' => 5.76, 'totalAmount' => 23.04];
$itemB = ['desc' => 'HEX NUT', 'size' => 'M12', 'qty' => 10, 'finalUnitPrice' => 1.10, 'totalAmount' => 11.00];
$base  = ['company_id' => $COMPANY, 'quote_date' => '2026-08-29', 'valid_until' => '',
          'prepared_by' => 'Siti from the office', 'remarks' => 'handle with care',
          'customer_name' => 'Beta Sdn Bhd', 'customer_phone' => '012-3456789',
          'total_amount' => 34.04];

/* One quotation, created once, carried through every section below. Sending
   the server's own items back is exactly what the browser does after a save:
   index.php adopts the uids the server issued, so a re-save is an EDIT of the
   same items rather than a set of new ones. */
$mk = function ($items) use ($base) {
    return array_merge($base, ['items' => $items]);
};

// ══ 2 · a CREATE still writes exactly one revision ═════════════════════════
$r = $call('save_quotation', array_merge($mk([$itemA, $itemB]), ['ref_no' => '']));
ok(!empty($r['ok']), '2: the quotation was created: ' . json_encode($r));
$ID    = (int)$r['id'];
$live  = $r['items'];                    // server-minted identity, as the browser holds it
$uidA  = $live[0]['item_uid'];
$uidB  = $live[1]['item_uid'];
eq(count($revs($ID)), 1, '2: exactly ONE revision — the create');
eq($revs($ID)[0]['event_type'], 'create', '2: and it is a create');
eq((int)$revs($ID)[0]['revision_no'], 1, '2: numbered 1');
ok(preg_match('/^itm_[0-9a-f]{32}$/', $uidA) && preg_match('/^itm_[0-9a-f]{32}$/', $uidB),
   '2: both items carry server-minted identity');

// ══ 3 · NO-OP: an identical save records nothing ═══════════════════════════
{
    $rowBefore  = $qrow($ID);
    $revsBefore = $revs($ID);
    $noBefore   = $maxNo($ID);

    $x = $call('update_quotation', array_merge($mk($live), ['id' => $ID]));
    ok(!empty($x['ok']), '3: the identical save SUCCEEDS — suppression is not a refusal: ' . json_encode($x));
    eq(count($revs($ID)), count($revsBefore), '3: and adds NO revision');
    eq($revs($ID), $revsBefore, '3: the history is byte-identical, not merely the same length');
    eq($maxNo($ID), $noBefore, '3: revision_no did not advance');
    eq($qrow($ID), $rowBefore, '3: and the quotation row is byte-identical');
    eq($x['items'], $live, '3: the response still carries the items, unchanged');

    /* REPEATED identical saves are the real-world case — reopen, look, close.
       Four more, and the history must still hold exactly one entry. */
    for ($i = 0; $i < 4; $i++) {
        $y = $call('update_quotation', array_merge($mk($live), ['id' => $ID]));
        ok(!empty($y['ok']), '3: repeat identical save ' . ($i + 1) . ' succeeds');
    }
    eq(count($revs($ID)), 1, '3: after five identical saves the history is still just the create');
    eq($maxNo($ID), 1, '3: and revision_no is still 1 — no noise, and no gap either');
    eq($qrow($ID), $rowBefore, '3: the row never moved');
}

// ══ 4 · the same business fact in a different shape is still a no-op ═══════
{
    /* PERSISTED BUSINESS FACT, NOT BYTES. The same items with their keys in a
       different order persist as a different JSON string and mean exactly the
       same thing. A revision saying "the key order changed" is the noise this
       round exists to remove. */
    $shuffled = array_map(function ($it) { $r = $it; ksort($r); return $r; }, $live);
    ok(json_encode($shuffled) !== json_encode($live),
       '4: the re-shaped payload really is a different JSON string');
    $revsBefore = $revs($ID);
    $x = $call('update_quotation', array_merge($mk($shuffled), ['id' => $ID]));
    ok(!empty($x['ok']), '4: it saves successfully');
    eq($revs($ID), $revsBefore, '4: and writes no revision — the business fact did not change');
    $live = $shuffled;                        // this is what is persisted now
    $rowNow = $qrow($ID);

    /* And a number the column rounds to what is already stored is not a change
       either: DECIMAL(12,2) holds 34.04, and 34.041 persists as 34.04. */
    $x = $call('update_quotation', array_merge($mk($live), ['id' => $ID, 'total_amount' => 34.041]));
    ok(!empty($x['ok']), '4: a total the column rounds back to the stored value saves');
    eq($revs($ID), $revsBefore, '4: and writes no revision — what MySQL stored is unchanged');
    eq($qrow($ID)['total_amount'], $rowNow['total_amount'], '4: the stored total really is the same');
}

// ══ 5 · every writable quotation field, one at a time, writes exactly one ══
{
    /* THE OTHER HALF OF THE CONTRACT. Suppression must never swallow a real
       edit, so each of the eight scalar columns the UPDATE can write is moved
       on its own and must produce exactly one revision. */
    $changes = [
        ['company_id',     $COMPANY2],
        ['quote_date',     '2026-09-30'],
        ['valid_until',    '2026-12-31'],
        ['prepared_by',    'Ahmad at the counter'],
        ['remarks',        'deliver to site B'],
        ['customer_name',  'Delta Sdn Bhd'],
        ['customer_phone', '019-8887777'],
        ['total_amount',   99.99],
    ];
    $payload = $mk($live);
    foreach ($changes as [$field, $value]) {
        $countBefore = count($revs($ID));
        $noBefore    = $maxNo($ID);
        $payload[$field] = $value;
        $x = $call('update_quotation', array_merge($payload, ['id' => $ID]));
        ok(!empty($x['ok']), "5: changing {$field} saves: " . json_encode($x));
        eq(count($revs($ID)), $countBefore + 1, "5: changing {$field} writes exactly ONE revision");
        eq($maxNo($ID), $noBefore + 1, "5: and revision_no advances by exactly one");
        $rev = $revs($ID)[count($revs($ID)) - 1];
        eq($rev['event_type'], 'update', "5: recorded as an update");
        $snap = json_decode($rev['snapshot_json'], true);
        eq((string)$snap['quotation'][$field === 'company_id' ? 'company_id' : $field],
           (string)$qrow($ID)[$field],
           "5: and the snapshot carries the persisted {$field}");

        /* Immediately re-saving the SAME state adds nothing. */
        $y = $call('update_quotation', array_merge($payload, ['id' => $ID]));
        ok(!empty($y['ok']), "5: re-saving the same state after a {$field} change succeeds");
        eq(count($revs($ID)), $countBefore + 1, "5: and adds no second revision for {$field}");
    }
    $BASE_NOW = $payload;                     // the state everything below starts from
}

// ══ 6 · item-level changes ════════════════════════════════════════════════
{
    $payload = $BASE_NOW;

    // ── an edit to one item, keeping its item_uid ──
    $countBefore = count($revs($ID));
    $edited = $live;
    $edited[0] = array_merge($edited[0], ['qty' => 7]);
    $x = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $edited]));
    ok(!empty($x['ok']), '6: editing one item saves: ' . json_encode($x));
    eq(count($revs($ID)), $countBefore + 1, '6: an item edit writes exactly ONE revision');
    $its = json_decode($qrow($ID)['items'], true);
    eq($its[0]['item_uid'], $uidA, '6: the edited item KEPT its identity — not a remove plus an add');
    eq($its[1]['item_uid'], $uidB, '6: and the untouched item kept its own');
    eq((int)$its[0]['qty'], 7, '6: the edit landed');
    $live = $edited;
    $y = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $live]));
    ok(!empty($y['ok']), '6: re-saving the edited items succeeds');
    eq(count($revs($ID)), $countBefore + 1, '6: and adds nothing');

    // ── an item ADDED ──
    $countBefore = count($revs($ID));
    $added = array_merge($live, [['desc' => 'WASHER', 'size' => 'M12', 'qty' => 20,
                                  'finalUnitPrice' => 0.25, 'totalAmount' => 5.00]]);
    $x = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $added]));
    ok(!empty($x['ok']), '6: adding an item saves');
    eq(count($revs($ID)), $countBefore + 1, '6: an added item writes exactly ONE revision');
    $its = json_decode($qrow($ID)['items'], true);
    eq(count($its), 3, '6: three items are persisted');
    $uidC = $its[2]['item_uid'];
    ok(preg_match('/^itm_[0-9a-f]{32}$/', $uidC), '6: the new item was minted an identity');
    ok($uidC !== $uidA && $uidC !== $uidB, '6: distinct from the ones already there');
    eq([$its[0]['item_uid'], $its[1]['item_uid']], [$uidA, $uidB], '6: and the existing two are untouched');
    $live = $its;
    $y = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $live]));
    eq(count($revs($ID)), $countBefore + 1, '6: re-saving the three adds nothing');

    // ── an item REMOVED ──
    $countBefore = count($revs($ID));
    $removed = [$live[0], $live[2]];           // drop the middle one
    $x = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $removed]));
    ok(!empty($x['ok']), '6: removing an item saves');
    eq(count($revs($ID)), $countBefore + 1, '6: a removed item writes exactly ONE revision');
    $its = json_decode($qrow($ID)['items'], true);
    eq(count($its), 2, '6: two items remain');
    eq([$its[0]['item_uid'], $its[1]['item_uid']], [$uidA, $uidC],
       '6: the survivors kept their identity and the removed uid is gone');
    $live = $its;
    $y = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $live]));
    eq(count($revs($ID)), $countBefore + 1, '6: re-saving the two adds nothing');

    $LIVE_NOW = $live;
}

// ══ 7 · a REORDER is a change, and it is not a remove plus an add ══════════
{
    /* THE ACCEPTED BUSINESS RULE, STATED HERE BECAUSE IT IS A DECISION.
       Item order is business fact: it is the order printed on the quotation,
       and "Item 3 is item 3 on Screen, on Print and in WhatsApp" is a protected
       rule. Moving row 2 above row 1 edits the document, so it writes a
       revision — a reorder is NOT a no-op. What it is also not is a removal
       followed by an addition: every item_uid that was there is still there. */
    $payload = $BASE_NOW;
    $countBefore = count($revs($ID));
    $before = json_decode($qrow($ID)['items'], true);
    $swapped = [$before[1], $before[0]];
    $x = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $swapped]));
    ok(!empty($x['ok']), '7: a pure reorder saves: ' . json_encode($x));
    eq(count($revs($ID)), $countBefore + 1, '7: and writes exactly ONE revision — a reorder IS a change');

    $its = json_decode($qrow($ID)['items'], true);
    eq([$its[0]['item_uid'], $its[1]['item_uid']],
       [$before[1]['item_uid'], $before[0]['item_uid']],
       '7: the order really did swap');
    $wasUids = array_map(function ($i) { return $i['item_uid']; }, $before);
    $nowUids = array_map(function ($i) { return $i['item_uid']; }, $its);
    sort($wasUids); sort($nowUids);
    eq($nowUids, $wasUids, '7: with the SAME set of item_uids — nothing was removed and nothing added');
    eq(count($its), count($before), '7: and the same number of items');

    /* And the snapshot records the new order, because the snapshot is the
       persisted row. */
    $snap = json_decode($revs($ID)[count($revs($ID)) - 1]['snapshot_json'], true);
    eq(array_map(function ($i) { return $i['item_uid']; }, $snap['items']),
       array_map(function ($i) { return $i['item_uid']; }, $its),
       '7: the revision snapshot carries the reordered items');

    /* Reordering back is another change, not a return to a no-op. */
    $countBefore = count($revs($ID));
    $x = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $before]));
    ok(!empty($x['ok']), '7: reordering back saves');
    eq(count($revs($ID)), $countBefore + 1, '7: and writes one more revision');
    /* Now identical again — and now it suppresses. */
    $countBefore = count($revs($ID));
    $x = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $before]));
    eq(count($revs($ID)), $countBefore, '7: saving that same order again writes nothing');
    $LIVE_NOW = json_decode($qrow($ID)['items'], true);
}

// ══ 8 · numbering stays dense, and the history is still consistent ═════════
{
    $rows = $revs($ID);
    $nos  = array_map(function ($x) { return (int)$x['revision_no']; }, $rows);
    eq($nos, range(1, count($rows)), '8: revision_no runs 1..n with no gaps — suppression allocates nothing');
    eq(count(array_unique($nos)), count($nos), '8: every number distinct');
    eq($rows[0]['event_type'], 'create', '8: the first is the create');
    $rest = array_unique(array_map(function ($x) { return $x['event_type']; }, array_slice($rows, 1)));
    eq(array_values($rest), ['update'], '8: and every other entry is an update');
    eq((int)$one("SELECT COUNT(*) FROM quotation_revisions r
                  LEFT JOIN quotations q ON q.id = r.quotation_id WHERE q.id IS NULL"), 0,
       '8: no revision refers to a quotation that does not exist');
    eq((int)$one("SELECT COUNT(*) FROM quotations q
                  LEFT JOIN quotation_revisions r ON r.quotation_id = q.id WHERE r.id IS NULL"), 0,
       '8: and every quotation this application created still has a history');
}

// ══ 8b · a legacy NULL that becomes '' IS a change, and only once ═════════
{
    /* A row the OLD application wrote can hold NULL where this one writes ''.
       The handler trims every text field, so the first save through it moves
       NULL -> '' — a REAL change in persisted fact, and one the snapshot would
       record as null becoming "". It must NOT be suppressed. It must also
       settle: the second identical save has nothing left to change. */
    $legacyItems = json_encode([array_merge($itemA, ['item_uid' => 'itm_' . str_repeat('a', 32)])]);
    $ref = 'Q-LEGACY-0001';
    ok($db->query("INSERT INTO quotations (ref_no, company_id, quote_date, valid_until,
                     prepared_by, remarks, customer_name, customer_phone, items, total_amount)
                   VALUES ('{$ref}', NULL, NULL, NULL, NULL, NULL, 'Legacy Sdn Bhd', NULL,
                           '" . $db->real_escape_string($legacyItems) . "', 23.04)") === true,
       '8b: a legacy row was inserted directly, with NULLs where this app writes empty strings');
    $lid = (int)$db->insert_id;
    eq($qrow($lid)['remarks'], null, '8b: its remarks really are NULL');
    eq(count($revs($lid)), 0, '8b: and it has no history — nothing wrote one');

    $legacyPayload = ['id' => $lid, 'company_id' => null, 'quote_date' => '', 'valid_until' => '',
                      'prepared_by' => '', 'remarks' => '', 'customer_name' => 'Legacy Sdn Bhd',
                      'customer_phone' => '', 'total_amount' => 23.04,
                      'items' => json_decode($legacyItems, true)];
    $x = $call('update_quotation', $legacyPayload);
    ok(!empty($x['ok']), '8b: saving it succeeds: ' . json_encode($x));
    eq(count($revs($lid)), 1, '8b: and writes ONE revision — NULL becoming "" is a real change');
    eq($qrow($lid)['remarks'], '', '8b: the column now holds an empty string');
    $snap = json_decode($revs($lid)[0]['snapshot_json'], true);
    eq($snap['quotation']['remarks'], '', '8b: which the snapshot records');

    $y = $call('update_quotation', $legacyPayload);
    ok(!empty($y['ok']), '8b: saving the same thing again succeeds');
    eq(count($revs($lid)), 1, '8b: and adds nothing — it settles after exactly one');
}


// ══ 9 · atomicity — a revision that cannot be written still takes the ══════
//        mutation with it, and a no-op never reaches the writer at all
{
    $payload = $BASE_NOW;
    ok($db->query("ALTER TABLE quotation_revisions ADD COLUMN dc_force_fail INT NOT NULL") === true,
       '9: the forced-failure column was added: ' . $db->error);

    /* A NO-OP still succeeds with the writer broken, which is the clearest
       proof that suppression happens BEFORE the INSERT is attempted. */
    $rowBefore  = $qrow($ID);
    $revsBefore = $revs($ID);
    $x = $call('update_quotation', array_merge($payload, ['id' => $ID, 'items' => $LIVE_NOW]));
    ok(!empty($x['ok']), '9: with the writer broken, a NO-OP save still succeeds: ' . json_encode($x));
    eq($revs($ID), $revsBefore, '9: because no revision was ever attempted');
    eq($qrow($ID), $rowBefore, '9: and the row is unchanged');

    /* A REAL change with the writer broken must still refuse and roll back. */
    $x = $call('update_quotation', array_merge($payload,
        ['id' => $ID, 'items' => $LIVE_NOW, 'customer_name' => 'SHOULD NOT LAND']));
    ok(empty($x['ok']), '9: but a REAL change whose revision cannot be written is REFUSED');
    ok(strpos((string)($x['error'] ?? ''), 'Revision') === 0,
       '9: and says the revision was the reason: ' . ($x['error'] ?? ''));
    eq($qrow($ID), $rowBefore, '9: the quotation row is byte-identical — the update rolled back');
    eq($revs($ID), $revsBefore, '9: and no partial revision survived');

    ok($db->query("ALTER TABLE quotation_revisions DROP COLUMN dc_force_fail") === true,
       '9: and the column was removed again');
}

// ══ 10 · CREATE and the 1062 retry are untouched by any of this ════════════
{
    /* A plain create still writes exactly one create revision. */
    $before = count($revs());
    $r2 = $call('save_quotation', array_merge($mk([$itemA]), ['ref_no' => '']));
    ok(!empty($r2['ok']), '10: a second create succeeds: ' . json_encode($r2));
    $id2 = (int)$r2['id'];
    eq(count($revs($id2)), 1, '10: exactly ONE create revision');
    eq($revs($id2)[0]['event_type'], 'create', '10: recorded as a create');
    eq((int)$revs($id2)[0]['revision_no'], 1, '10: numbered 1');
    eq(count($revs()), $before + 1, '10: and nothing else was written');

    /* A REAL 1062 race, exactly as the accepted round proves it: another
       connection holds the next number uncommitted, this request blocks on the
       duplicate key, the other commits, MySQL raises a genuine 1062, and the
       one permitted retry reallocates because the create transaction reads at
       READ COMMITTED. */
    $year = date('Y');
    $next = (int)$one("SELECT COUNT(*) FROM quotations") + 1;
    $squat = sprintf('Q-%s-%04d', $year, $next);
    $S = new mysqli($H, $U, $W, null, $P); $S->select_db($DBN);
    $S->query('SET autocommit=0');
    $S->query('START TRANSACTION');
    ok($S->query("INSERT INTO quotations (ref_no, customer_name, items, total_amount)
                  VALUES ('{$squat}', 'squatter', '[]', 0)") === true,
       "10: another connection holds {$squat} uncommitted: " . $S->error);

    $payload = json_encode(array_merge($mk([$itemA]), ['ref_no' => '']));
    $sock = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 10);
    ok($sock !== false, '10: a second request was opened against the sandbox');
    fwrite($sock, "POST /api.php?action=save_quotation HTTP/1.1\r\nHost: 127.0.0.1\r\n"
                . "Content-Type: application/json\r\nContent-Length: " . strlen($payload) . "\r\n"
                . "Connection: close\r\n\r\n" . $payload);
    usleep(700000);                       // it is now blocked on the duplicate key
    $S->query('COMMIT');                  // and now the collision is real
    $S->close();

    $resp = ''; while (!feof($sock)) $resp .= fread($sock, 8192);
    fclose($sock);
    $body = substr($resp, strpos($resp, "\r\n\r\n") + 4);
    $j = json_decode(trim($body), true);
    ok(is_array($j) && !empty($j['ok']),
       '10: the save SUCCEEDS through a real 1062 retry: ' . substr($body, 0, 200));
    if (is_array($j) && !empty($j['ok'])) {
        $id3 = (int)$j['id'];
        ok($j['ref_no'] !== $squat, '10: on a DIFFERENT number — the retry reallocated');
        eq(count($revs($id3)), 1, '10: and wrote exactly ONE revision');
        eq($revs($id3)[0]['event_type'], 'create', '10: a create');
        eq($revs($id3)[0]['quotation_ref_no'], $j['ref_no'],
           '10: carrying the ref_no the retry SETTLED on');
        $s3 = json_decode($revs($id3)[0]['snapshot_json'], true);
        eq($s3['quotation']['ref_no'], $j['ref_no'], '10: and the snapshot agrees');
        eq((int)$one("SELECT COUNT(*) FROM quotation_revisions WHERE quotation_ref_no = '{$squat}'"), 0,
           '10: no revision claims the number the first attempt lost');
    }
    eq((int)$one("SELECT IS_FREE_LOCK('dc_quotation_ref_alloc')"), 1, '10: the named lock was released');
    $db->query("DELETE FROM quotations WHERE customer_name = 'squatter'");
}

// ── clean up ─────────────────────────────────────────────────────────────────
$db->select_db('mysql');
ok($db->query("DROP DATABASE {$DBN}") === true, '10: the throwaway database was dropped');
$db->close();

$name = 'no-op suppression — an update that changes nothing records nothing';
if ($failures) {
    echo "\n  FAIL  {$name}  ({$asserts} assertions, " . count($failures) . " failed)  [MySQL {$server}]\n\n";
    foreach ($failures as $f) echo "   - {$f}\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    {$name}  ({$asserts} assertions)  [MySQL {$server}]\n\n";
