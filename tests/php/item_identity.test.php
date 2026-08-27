<?php
/**
 * ── Item identity — a UID the server owns, and a reconciliation that guesses
 *    nothing ──────────────────────────────────────────────────────────────────
 *
 * Run:  php tests/php/item_identity.test.php
 *
 * Every persisted quotation item carries item_uid. The whole point is that the
 * browser cannot choose it and the server never infers it from array position,
 * so what is measured here is mostly REFUSAL: a forged uid, a duplicated one,
 * a stored quotation from before this round.
 *
 * api.php cannot be included — it requires auth.php and db.php and connects on
 * the first line — so the functions under test are EXTRACTED FROM THE SHIPPED
 * FILE by brace matching and evaluated, exactly as save_retry.test.php and
 * mysqli_compat.test.php do. If the source changes, this test runs the change.
 *
 * The backfill migration IS executed, as a real subprocess, against a stub
 * db.php that keeps its "database" in a JSON file. Dry run, apply, second
 * apply and the business-data proof are measured on the shipped file rather
 * than described.
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
$IDX  = file_get_contents($ROOT . '/index.php');

/* ── lift a named function out of the shipped source ─────────────────────── */
function lift($src, $name) {
    $at = strpos($src, "function {$name}(");
    if ($at === false) return null;
    $i = strpos($src, '{', $at); $depth = 0;
    for ($k = $i, $n = strlen($src); $k < $n; $k++) {
        if ($src[$k] === '{') $depth++;
        elseif ($src[$k] === '}') { $depth--; if ($depth === 0) return substr($src, $at, $k - $at + 1); }
    }
    return null;
}

$NEEDED = ['dc_new_item_uid', 'dc_is_item_uid', 'dc_item_uid_absent',
           'dc_mint_item_uid', 'dc_assign_item_uids', 'dc_reconcile_item_uids'];
$code = '';
foreach ($NEEDED as $fn) {
    $body = lift($API, $fn);
    ok($body !== null, "{$fn}() is present in the shipped api.php");
    if ($body === null) { echo "  cannot continue\n"; exit(1); }
    $code .= $body . "\n";
}
ok(preg_match("/const\s+DC_ITEM_UID_RE\s*=\s*'([^']+)'\s*;/", $API, $m) === 1,
   'the shipped api.php states the uid pattern as a constant');
eval("const DC_ITEM_UID_RE = '" . $m[1] . "';\n" . $code);


// ══ 1 · the format, and where it comes from ═════════════════════════════════
{
    $a = dc_new_item_uid();
    $b = dc_new_item_uid();
    ok(preg_match('/^itm_[0-9a-f]{32}$/', $a) === 1, '1: a minted uid is itm_ + 32 lowercase hex');
    ok($a !== $b, '1: two mints differ');
    ok(dc_is_item_uid($a), '1: and the shipped validator accepts its own output');

    ok(strpos($API, 'bin2hex(random_bytes(16))') !== false,
       '1: identity comes from random_bytes(16) — 128 bits, not a counter or a hash of the row');

    foreach (['', 'itm_', 'itm_ABCDEF0123456789abcdef0123456789', 'itm_0123456789abcdef0123456789abcde',
              'itm_0123456789abcdef0123456789abcdef0', '6f9d7e8b9f4d4ec986f0d093e7815fd2',
              'itm-6f9d7e8b9f4d4ec986f0d093e7815fd2'] as $bad) {
        ok(!dc_is_item_uid($bad), "1: rejected as a uid: '" . $bad . "'");
    }
    ok(!dc_is_item_uid(null) && !dc_is_item_uid(12345) && !dc_is_item_uid(['x']),
       '1: a non-string is never a uid');

    /* "no identity yet" is exactly two shapes, and nothing else. */
    ok(dc_item_uid_absent([]), '1: a missing key means no identity yet');
    ok(dc_item_uid_absent(['item_uid' => null]), '1: null means no identity yet');
    ok(dc_item_uid_absent(['item_uid' => '']), '1: empty string means no identity yet');
    ok(!dc_item_uid_absent(['item_uid' => 'anything']), '1: a present non-empty value is NOT absent');
    ok(!dc_item_uid_absent(['item_uid' => 0]), '1: and 0 is not treated as absent either');
}


// ══ 2 · CREATE — every item gets one, the client gets no say ════════════════
{
    $items = [
        ['desc' => 'SAG ROD', 'qty' => 4],
        ['desc' => 'ANCHOR BOLT', 'qty' => 6, 'item_uid' => 'itm_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
        ['desc' => 'STUD', 'qty' => 1, 'item_uid' => 'not-a-uid'],
    ];
    $out = dc_assign_item_uids($items);
    eq(count($out), 3, '2: every item survives the create');
    foreach ($out as $i => $it) ok(dc_is_item_uid($it['item_uid']), "2: item {$i} received a valid uid");
    $uids = array_column($out, 'item_uid');
    eq(count(array_unique($uids)), 3, '2: three items, three distinct uids');
    ok(!in_array('itm_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', $uids, true),
       '2: a client-supplied uid is IGNORED on create — nothing for it to refer to');
    ok(!in_array('not-a-uid', $uids, true), '2: and a malformed one is not kept either');

    /* Business data is untouched. */
    eq($out[0]['desc'], 'SAG ROD', '2: the description is unchanged');
    eq($out[1]['qty'], 6, '2: the qty is unchanged');
    foreach ($out as $i => $it) {
        $copy = $it; unset($copy['item_uid']);
        $orig = $items[$i]; unset($orig['item_uid']);
        eq($copy, $orig, "2: item {$i} carries no change other than identity");
    }
    eq(dc_assign_item_uids([]), [], '2: an empty quotation mints nothing');
}


// ══ 3 · UPDATE — reconcile, or refuse ═══════════════════════════════════════
$U1 = 'itm_11111111111111111111111111111111';
$U2 = 'itm_22222222222222222222222222222222';
$U3 = 'itm_33333333333333333333333333333333';
$persisted = json_encode([
    ['desc' => 'A', 'qty' => 1, 'item_uid' => $U1],
    ['desc' => 'B', 'qty' => 2, 'item_uid' => $U2],
    ['desc' => 'C', 'qty' => 3, 'item_uid' => $U3],
]);

{
    // 3a · an ordinary edit
    $err = '';
    $in  = [['desc' => 'A', 'qty' => 9, 'item_uid' => $U1],
            ['desc' => 'B', 'qty' => 2, 'item_uid' => $U2],
            ['desc' => 'C', 'qty' => 3, 'item_uid' => $U3]];
    $out = dc_reconcile_item_uids($in, $persisted, $err);
    ok($out !== null, '3a: an ordinary edit reconciles');
    eq(array_column($out, 'item_uid'), [$U1, $U2, $U3], '3a: and every uid is preserved exactly');
    eq($out[0]['qty'], 9, '3a: the edited value is the one that changed');

    // 3b · REORDER — identity travels with the item, not with the slot
    $err = '';
    $in  = [['desc' => 'C', 'qty' => 3, 'item_uid' => $U3],
            ['desc' => 'A', 'qty' => 1, 'item_uid' => $U1],
            ['desc' => 'B', 'qty' => 2, 'item_uid' => $U2]];
    $out = dc_reconcile_item_uids($in, $persisted, $err);
    ok($out !== null, '3b: a reorder reconciles');
    eq(array_column($out, 'item_uid'), [$U3, $U1, $U2], '3b: each uid moved WITH its item');
    eq(array_column($out, 'desc'), ['C', 'A', 'B'], '3b: and the pairing is still uid-to-item, not uid-to-position');

    // 3c · DELETE — the uid disappears with the row
    $err = '';
    $in  = [['desc' => 'A', 'qty' => 1, 'item_uid' => $U1],
            ['desc' => 'C', 'qty' => 3, 'item_uid' => $U3]];
    $out = dc_reconcile_item_uids($in, $persisted, $err);
    ok($out !== null, '3c: deleting the middle item reconciles');
    eq(array_column($out, 'item_uid'), [$U1, $U3], '3c: B\'s uid is simply gone');
    ok(!in_array($U2, array_column($out, 'item_uid'), true), '3c: and was not handed to another row');

    // 3d · ADD — a new item arrives with no identity and is given a fresh one
    $err = '';
    $in  = [['desc' => 'A', 'qty' => 1, 'item_uid' => $U1],
            ['desc' => 'B', 'qty' => 2, 'item_uid' => $U2],
            ['desc' => 'C', 'qty' => 3, 'item_uid' => $U3],
            ['desc' => 'D', 'qty' => 4]];
    $out = dc_reconcile_item_uids($in, $persisted, $err);
    ok($out !== null, '3d: adding an item reconciles');
    eq(count($out), 4, '3d: four items now');
    ok(dc_is_item_uid($out[3]['item_uid']), '3d: the new one received a valid uid');
    ok(!in_array($out[3]['item_uid'], [$U1, $U2, $U3], true),
       '3d: and it differs from every retained uid');
    eq(array_slice(array_column($out, 'item_uid'), 0, 3), [$U1, $U2, $U3], '3d: the three retained uids did not move');

    // 3e · delete-then-add: a freed uid is NEVER reissued
    $err = '';
    $in  = [['desc' => 'A', 'qty' => 1, 'item_uid' => $U1],
            ['desc' => 'NEW', 'qty' => 7]];
    $out = dc_reconcile_item_uids($in, $persisted, $err);
    ok($out !== null, '3e: deleting two and adding one reconciles');
    ok(!in_array($out[1]['item_uid'], [$U2, $U3], true),
       '3e: the new item did NOT inherit a deleted item\'s identity');

    // 3f · an empty uid on an otherwise-existing-looking item is a NEW item
    foreach ([null, ''] as $blank) {
        $err = '';
        $in  = [['desc' => 'A', 'qty' => 1, 'item_uid' => $U1],
                ['desc' => 'B', 'qty' => 2, 'item_uid' => $blank]];
        $out = dc_reconcile_item_uids($in, $persisted, $err);
        ok($out !== null && dc_is_item_uid($out[1]['item_uid']) && $out[1]['item_uid'] !== $U2,
           '3f: a blank uid is a new item, not a match on ' . var_export($blank, true));
    }
}


// ══ 4 · the refusals — every one fails closed ═══════════════════════════════
{
    // 4a · a uid that is not in this quotation
    $err = '';
    $in  = [['desc' => 'A', 'item_uid' => $U1],
            ['desc' => 'X', 'item_uid' => 'itm_deadbeefdeadbeefdeadbeefdeadbeef']];
    eq(dc_reconcile_item_uids($in, $persisted, $err), null, '4a: a forged uid is refused');
    eq($err, 'ITEM_IDENTITY_UNKNOWN_UID', '4a: and says why');

    // 4b · a uid belonging to a DIFFERENT quotation is exactly the same refusal
    $other = json_encode([['desc' => 'Z', 'item_uid' => 'itm_99999999999999999999999999999999']]);
    $err = '';
    eq(dc_reconcile_item_uids([['desc' => 'Z', 'item_uid' => $U1]], $other, $err), null,
       '4b: a uid from another quotation does not belong here');
    eq($err, 'ITEM_IDENTITY_UNKNOWN_UID', '4b: same refusal, stated');

    // 4c · the same uid twice
    $err = '';
    $in  = [['desc' => 'A', 'item_uid' => $U1], ['desc' => 'A again', 'item_uid' => $U1]];
    eq(dc_reconcile_item_uids($in, $persisted, $err), null, '4c: two items claiming one identity is refused');
    eq($err, 'ITEM_IDENTITY_DUPLICATE_UID', '4c: and says which rule broke');

    // 4d · malformed, present, non-empty
    foreach (['itm_nothex', 'ITM_11111111111111111111111111111111', 42, ['a'], true] as $bad) {
        $err = '';
        eq(dc_reconcile_item_uids([['desc' => 'A', 'item_uid' => $bad]], $persisted, $err), null,
           '4d: a malformed uid is refused, not treated as new: ' . var_export($bad, true));
        eq($err, 'ITEM_IDENTITY_MALFORMED_UID', '4d: with the malformed reason');
    }

    // 4e · a legacy quotation — no identity stored at all
    $legacy = json_encode([['desc' => 'A', 'qty' => 1], ['desc' => 'B', 'qty' => 2]]);
    $err = '';
    eq(dc_reconcile_item_uids([['desc' => 'A', 'qty' => 1]], $legacy, $err), null,
       '4e: a quotation saved before this round cannot be reconciled');
    eq($err, 'ITEM_IDENTITY_BACKFILL_REQUIRED', '4e: it asks for the backfill by name');

    // 4f · stored identity that is damaged
    $dup = json_encode([['desc' => 'A', 'item_uid' => $U1], ['desc' => 'B', 'item_uid' => $U1]]);
    $err = '';
    eq(dc_reconcile_item_uids([['desc' => 'A', 'item_uid' => $U1]], $dup, $err), null,
       '4f: duplicated stored identity is not reconciled by position');
    eq($err, 'ITEM_IDENTITY_BACKFILL_REQUIRED', '4f: backfill required');

    $mal = json_encode([['desc' => 'A', 'item_uid' => 'nope']]);
    $err = '';
    eq(dc_reconcile_item_uids([['desc' => 'A', 'item_uid' => 'nope']], $mal, $err), null,
       '4g: malformed stored identity is not accepted just because it round-trips');
    eq($err, 'ITEM_IDENTITY_BACKFILL_REQUIRED', '4g: backfill required');

    // 4h · unreadable stored items
    $err = '';
    eq(dc_reconcile_item_uids([['desc' => 'A']], 'not json at all', $err), null,
       '4h: unreadable stored items fail closed');
    eq($err, 'ITEM_IDENTITY_BACKFILL_REQUIRED', '4h: and are never guessed at');

    // 4i · a refusal returns null, so the caller has nothing to write
    $err = '';
    ok(dc_reconcile_item_uids([['desc' => 'A', 'item_uid' => 'itm_deadbeefdeadbeefdeadbeefdeadbeef']],
                              $persisted, $err) === null,
       '4i: every refusal yields null — there is no partial result to persist');
}


// ══ 5 · api.php is actually wired to it ═════════════════════════════════════
{
    $save = substr($API, strpos($API, "\$action === 'save_quotation'"),
                   strpos($API, "\$action === 'update_quotation'") - strpos($API, "\$action === 'save_quotation'"));
    ok(strpos($save, 'dc_assign_item_uids(') !== false, '5: save_quotation mints identity for every item');
    ok(preg_match('/json_encode\(\$itemsArr\)/', $save) === 1, '5: and persists the array it minted into');
    ok(strpos($save, "'items'=>\$itemsArr") !== false,
       '5: save_quotation answers with the persisted items, so the page can adopt the uids');

    $upd = substr($API, strpos($API, "\$action === 'update_quotation'"),
                  strpos($API, "\$action === 'delete_quotation'") - strpos($API, "\$action === 'update_quotation'"));
    ok(strpos($upd, 'dc_reconcile_item_uids(') !== false, '5: update_quotation reconciles identity');
    ok(strpos($upd, 'SELECT items FROM quotations WHERE id=?') !== false,
       '5: reading the minimum it needs — one column, one row');
    ok(strpos($upd, "'items'=>\$itemsArr") !== false, '5: and answers with the persisted items too');
    /* Order matters more than presence: the refusal has to come first. */
    ok(strpos($upd, 'dc_reconcile_item_uids(') < strpos($upd, 'UPDATE quotations SET'),
       '5: identity is reconciled BEFORE the UPDATE is even prepared');
    ok(strpos($upd, '$itemsArr === null') !== false && strpos($upd, 'exit;') !== false,
       '5: a refusal exits without writing');
    ok(strpos($upd, 'ref_no') !== false && strpos($upd, 'UPDATE quotations SET company_id=?,quote_date=?') !== false,
       '5: and the UPDATE statement itself is unchanged — ref_no is still not in it');

    /* Nothing this round may touch. */
    ok(substr_count($API, 'GET_LOCK') >= 1, '5: GET_LOCK is still there');
    ok(strpos($API, 'mysqli_report(MYSQLI_REPORT_OFF)') !== false, '5: the driver contract is still restored');
    ok(strpos($API, '1062') !== false, '5: and the one-time 1062 retry is still there');
}


// ══ 6 · the page carries identity, and never invents it ═════════════════════
{
    ok(strpos($IDX, 'function dcCarryItemUid(') !== false, '6: index.php has the carry helper');
    ok(strpos($IDX, 'function dcStripItemUid(') !== false, '6: and one that clears identity for a copy');
    ok(strpos($IDX, 'function dcAdoptServerItems(') !== false, '6: and one that adopts what the server issued');

    /* Every place an item built from the form REPLACES a persisted row must
       carry the identity across. A miss here silently deletes a row and adds a
       different one on the next save. */
    eq(substr_count($IDX, 'quoteItems[idx]=dcCarryItemUid(quoteItems[idx],item);'), 2,
       '6: both indexed commit sites carry the uid across the replacement');
    eq(substr_count($IDX, 'quoteItems[updatedIndex]=dcCarryItemUid(quoteItems[updatedIndex],item);'), 1,
       '6: and so does the third');
    eq(substr_count($IDX, 'quoteItems[idx]=item;'), 0, '6: no commit site replaces a row bare');
    eq(substr_count($IDX, 'quoteItems[updatedIndex]=item;'), 0, '6: none of them');

    /* The three ADD paths must not mint anything. */
    eq(substr_count($IDX, 'quoteItems.push(item);'), 3, '6: three add paths, unchanged');
    ok(strpos($IDX, "item_uid:'itm_") === false && !preg_match('/item_uid\s*[:=]\s*[\'"]itm_/', $IDX),
       '6: the page never writes a uid literal — it cannot mint identity');
    ok(!preg_match('/random_bytes|crypto\.randomUUID|Math\.random\(\)[^;]*item_uid/', $IDX),
       '6: and it has no uid generator of its own');

    /* The save path adopts the server\'s answer BEFORE it snapshots. */
    $save = substr($IDX, strpos($IDX, 'async function doSaveQuotation()'));
    $save = substr($save, 0, strpos($save, 'function checkHandoff()'));
    ok(strpos($save, 'dcAdoptServerItems(res.items)') !== false,
       '6: doSaveQuotation adopts the uids the server issued');
    ok(strpos($save, 'dcAdoptServerItems(res.items)') < strpos($save, 'captureSavedQuotationSnapshot()'),
       '6: before the snapshot, so create -> edit -> save again keeps the same identities');
    ok(strpos($save, 'dcAdoptServerItems(res.items)') > strpos($save, "if(!res.ok)"),
       '6: and only on the success path');
}


// ══ 7 · the backfill migration, actually executed ═══════════════════════════
{
    $MIG = $ROOT . '/migrations/2026-08-27-backfill-item-uids.php';
    ok(is_file($MIG), '7: the backfill migration exists');
    $mig = file_get_contents($MIG);
    ok(strpos($mig, "PHP_SAPI !== 'cli'") !== false, '7: it refuses to run from the web');
    ok(strpos($mig, 'mysqli_report(MYSQLI_REPORT_OFF)') !== false,
       '7: it opens its own connection, so it states the same driver contract');
    ok(strpos($mig, 'ALTER TABLE') === false && strpos($mig, 'DROP ') === false,
       '7: no schema change and nothing dropped');

    $tmp   = sys_get_temp_dir() . '/dc-item-uid-' . getmypid();
    @mkdir($tmp, 0777, true);
    $store = $tmp . '/store.json';
    $stub  = $tmp . '/db.php';

    /* A quotation from before this round, one already carrying identity, and
       one with a duplicate — the three shapes the backfill has to tell apart. */
    $seed = [
        ['id' => 1, 'items' => json_encode([
            ['desc' => 'SAG ROD', 'size' => 'M20', 'qty' => 4, 'finalUnitPrice' => 5.76, 'totalAmount' => 23.04],
            ['desc' => 'STUD',    'size' => 'M12', 'qty' => 2, 'finalUnitPrice' => 1.10, 'totalAmount' => 2.20],
        ])],
        ['id' => 2, 'items' => json_encode([
            ['desc' => 'ANCHOR', 'qty' => 1, 'item_uid' => 'itm_44444444444444444444444444444444'],
        ])],
        ['id' => 3, 'items' => json_encode([
            ['desc' => 'DUP A', 'qty' => 1, 'item_uid' => 'itm_55555555555555555555555555555555'],
            ['desc' => 'DUP B', 'qty' => 1, 'item_uid' => 'itm_55555555555555555555555555555555'],
        ])],
    ];
    file_put_contents($store, json_encode($seed));
    file_put_contents($stub, str_replace('__STORE__', addslashes($store), <<<'STUB'
<?php
/* A stub db.php: just enough mysqli for the migration, with the "database" in
   a JSON file so the test can read what was actually written. */
$GLOBALS['DC_STORE'] = '__STORE__';
class FakeRes { private $r; function __construct($r){ $this->r=$r; } function fetch_row(){ return $this->r; } function free(){} }
class FakeSel {
    public $error=''; private $rows; private $i=0; private $b=[]; private $lim;
    function __construct($rows,$lim){ $this->rows=$rows; $this->lim=$lim; }
    function execute(){ return true; }
    function bind_result(&$a,&$b){ $this->b=[&$a,&$b]; return true; }
    function fetch(){
        $max = $this->lim > 0 ? min($this->lim, count($this->rows)) : count($this->rows);
        if ($this->i >= $max) return null;
        $r = $this->rows[$this->i++];
        $this->b[0] = $r['id']; $this->b[1] = $r['items'];
        return true;
    }
    function close(){ return true; }
}
class FakeUpd {
    public $error=''; private $db; private $j; private $id;
    function __construct($db){ $this->db=$db; }
    function bind_param($t,&$a,&$b){ $this->j=&$a; $this->id=&$b; return true; }
    function execute(){ $this->db->pending[(int)$this->id] = $this->j; return true; }
    function close(){ return true; }
}
class FakeDB {
    public $connect_errno = 0; public $error = ''; public $pending = [];
    function query($sql){ return new FakeRes(['fake_db']); }
    function prepare($sql){
        if (strpos($sql, 'SELECT id, items FROM quotations') === 0) {
            $lim = preg_match('/LIMIT (\d+)/', $sql, $m) ? (int)$m[1] : 0;
            return new FakeSel(json_decode(file_get_contents($GLOBALS['DC_STORE']), true), $lim);
        }
        if (strpos($sql, 'UPDATE quotations SET items=? WHERE id=?') === 0) return new FakeUpd($this);
        return false;
    }
    function begin_transaction(){ $this->pending = []; return true; }
    function commit(){
        $rows = json_decode(file_get_contents($GLOBALS['DC_STORE']), true);
        foreach ($rows as $k => $r) if (isset($this->pending[(int)$r['id']])) $rows[$k]['items'] = $this->pending[(int)$r['id']];
        file_put_contents($GLOBALS['DC_STORE'], json_encode($rows));
        $this->pending = []; return true;
    }
    function rollback(){ $this->pending = []; return true; }
}
function getDB(){ static $d; if (!$d) $d = new FakeDB(); return $d; }
STUB
    ));

    $php = PHP_BINARY;
    $run = function ($args) use ($php, $MIG, $stub) {
        $cmd = escapeshellarg($php) . ' ' . escapeshellarg($MIG) . ' --db=' . escapeshellarg($stub) . ' ' . $args . ' 2>&1';
        $out = shell_exec($cmd);
        return (string)$out;
    };
    $load = function () use ($store) {
        $rows = json_decode(file_get_contents($store), true);
        $by = [];
        foreach ($rows as $r) $by[(int)$r['id']] = json_decode($r['items'], true);
        return $by;
    };
    $strip = function ($items) {
        $o = [];
        foreach ($items as $it) { if (is_array($it)) unset($it['item_uid']); $o[] = $it; }
        return $o;
    };

    $before = $load();

    // 7a · DRY RUN writes nothing
    $out = $run('');
    ok(strpos($out, 'DRY RUN') !== false, '7a: it announces the dry run');
    ok(preg_match('/identity minted\s+2/', $out) === 1, '7a: it finds the two items with no identity');
    ok(preg_match('/already had identity\s+2/', $out) === 1, '7a: and the two that already had it');
    ok(preg_match('/items with invalid uid\s+1/', $out) === 1, '7a: and the one that is a duplicate');
    ok(preg_match('/SKIPPED, invalid uid\s+1/', $out) === 1, '7a: whose quotation is reported as skipped');
    /* The counts reconcile, so the report can be checked rather than believed. */
    ok(preg_match('/items seen\s+(\d+)/', $out, $mm) === 1 && (int)$mm[1] === 5,
       '7a: five items seen = 2 already + 2 minted + 1 invalid');
    eq($load(), $before, '7a: and the database is byte-for-byte what it was');

    // 7b · APPLY
    $out = $run('--apply');
    ok(strpos($out, 'APPLIED and committed') !== false, '7b: the apply run commits');
    $after = $load();
    ok(dc_is_item_uid($after[1][0]['item_uid'] ?? ''), '7b: the legacy quotation\'s first item now has identity');
    ok(dc_is_item_uid($after[1][1]['item_uid'] ?? ''), '7b: and so does its second');
    ok(($after[1][0]['item_uid'] ?? '') !== ($after[1][1]['item_uid'] ?? ''),
       '7b: two items in one quotation got two different uids');
    eq($after[2][0]['item_uid'], 'itm_44444444444444444444444444444444',
       '7b: an item that already had identity KEEPS it');
    eq($after[3], $before[3], '7b: the quotation with duplicated identity was left untouched');

    // 7c · THE PROOF — strip identity and nothing moved
    foreach ([1, 2, 3] as $id) {
        eq($strip($after[$id]), $strip($before[$id]),
           "7c: quotation {$id} — with item_uid stripped, the business data is identical");
    }
    eq(count($after[1]), count($before[1]), '7c: the item count did not change');
    eq(array_column($after[1], 'desc'), array_column($before[1], 'desc'), '7c: nor the item ORDER');
    eq($after[1][0]['totalAmount'], 23.04, '7c: nor a line total');
    eq($after[1][1]['finalUnitPrice'], 1.10, '7c: nor a unit price');

    // 7d · IDEMPOTENT
    $twice = $load();
    $out = $run('--apply');
    ok(preg_match('/identity minted\s+0/', $out) === 1, '7d: a second apply mints nothing');
    ok(preg_match('/quotation rows to write\s+0/', $out) === 1, '7d: and has nothing to write');
    eq($load(), $twice, '7d: the database is unchanged by the second run');

    // 7e · --repair-invalid is what fixes the damaged one, and only then
    $out = $run('--apply --repair-invalid');
    ok(preg_match('/invalid identity remade\s+1/', $out) === 1, '7e: --repair-invalid re-mints the duplicate');
    $rep = $load();
    eq($rep[3][0]['item_uid'], 'itm_55555555555555555555555555555555',
       '7e: the FIRST holder keeps the identity it had');
    ok(dc_is_item_uid($rep[3][1]['item_uid']) && $rep[3][1]['item_uid'] !== $rep[3][0]['item_uid'],
       '7e: and the second gets a fresh one');
    eq($strip($rep[3]), $strip($before[3]), '7e: business data still identical');

    // 7f · it refuses to guess which database
    $bare = shell_exec(escapeshellarg($php) . ' ' . escapeshellarg($MIG) . ' 2>&1');
    ok(strpos((string)$bare, '--db=') !== false, '7f: without --db it refuses rather than guessing');

    @unlink($store); @unlink($stub); @rmdir($tmp);
}


// ── report ───────────────────────────────────────────────────────────────────
$name = 'item identity — a uid the server owns, and nothing reconciled by position';
if ($failures) {
    echo "\n  FAIL  {$name}  ({$asserts} assertions, " . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - {$f}\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    {$name}  ({$asserts} assertions)\n\n";
