<?php
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * QUOTATION.DNC — backfill item_uid into existing quotations
 *
 *   Prepared  : 2026-08-27
 *   Applied   : NOT APPLIED by this file's presence. It does nothing without
 *               --apply, and --apply is never run automatically.
 *   Round     : ITEM IDENTITY FOUNDATION (candidate)
 *
 * WHY
 *   Every quotation item persisted from now on carries a server-owned
 *   item_uid. Quotations saved BEFORE that have none, and api.php refuses to
 *   reconcile identity it would have to guess — it answers
 *   ITEM_IDENTITY_BACKFILL_REQUIRED rather than matching rows by array
 *   position. This file is the one place allowed to write identity into rows
 *   that already exist, and an operator runs it deliberately.
 *
 * WHAT IT WILL NOT DO
 *   · No schema change. item_uid lives inside the quotations.items JSON.
 *   · No business field is touched. Not the ref_no, not the company, not the
 *     item order, not a description, size, material, qty, price, total or
 *     date. The run PROVES this per row rather than promising it: the items
 *     array is compared before and after with item_uid stripped out, and a
 *     single difference aborts the whole transaction.
 *   · It never runs from the web, never writes without --apply, and never
 *     prints customer data.
 *
 * USAGE  (on the server, from the cPanel git checkout — migrations/ is not
 *         part of the deployed file set)
 *
 *     php migrations/2026-08-27-backfill-item-uids.php --db=/home5/dnchardw/quo.dnchardware.com/db.php
 *     php migrations/2026-08-27-backfill-item-uids.php --db=... --apply
 *
 *   --db=PATH         REQUIRED. The live db.php. Named explicitly so this can
 *                     never guess which database it is about to write to.
 *   --apply           Actually write. Without it this is a DRY RUN and the
 *                     transaction is rolled back.
 *   --limit=N         Process at most N quotations (for a cautious first pass).
 *
 * THE GATE — malformed or duplicated STORED identity
 *   This file adds identity where there is none. It does NOT rewrite identity
 *   that already exists, even when that identity is damaged. If any stored
 *   item_uid is malformed, or two items in one quotation claim the same one,
 *   the run REPORTS the affected quotation ids and REFUSES TO WRITE ANYTHING
 *   — not just those rows, the whole run — and exits non-zero.
 *
 *   That is deliberate. Deciding which of two rows keeps a duplicated identity,
 *   or what a malformed one was meant to be, is a judgement about which item is
 *   which. A migration that made that choice silently would be guessing exactly
 *   the thing this round exists to stop guessing. A person inspects those
 *   quotations and decides.
 *
 * IDEMPOTENT. A second run finds nothing to change and writes nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("This migration is CLI-only.\n");
}

/* Same driver contract the application is written against: check return
   values, do not catch exceptions. api.php calls this before requiring db.php;
   any file that opens its own connection must do the same. */
mysqli_report(MYSQLI_REPORT_OFF);

// ── arguments ────────────────────────────────────────────────────────────────
$opt = ['db' => null, 'apply' => false, 'limit' => 0];
foreach (array_slice($argv, 1) as $a) {
    if (strpos($a, '--db=') === 0)            $opt['db']     = substr($a, 5);
    elseif ($a === '--apply')                 $opt['apply']  = true;
    elseif (strpos($a, '--limit=') === 0)     $opt['limit']  = max(0, (int)substr($a, 8));
    elseif ($a === '--help' || $a === '-h')   { echo file_get_contents(__FILE__, false, null, 0, 2200), "\n"; exit(0); }
    else { fwrite(STDERR, "Unknown argument: {$a}\n"); exit(2); }
}
if ($opt['db'] === null || $opt['db'] === '') {
    fwrite(STDERR, "--db=/path/to/db.php is required. Refusing to guess the database.\n");
    exit(2);
}
if (!is_file($opt['db'])) {
    fwrite(STDERR, "Not a file: {$opt['db']}\n");
    exit(2);
}

require_once $opt['db'];
if (!function_exists('getDB')) {
    fwrite(STDERR, "getDB() not defined by {$opt['db']}.\n");
    exit(2);
}

// ── the identity contract, stated once ───────────────────────────────────────
const BF_UID_RE = '/^itm_[0-9a-f]{32}$/';
function bf_new_uid()      { return 'itm_' . bin2hex(random_bytes(16)); }
function bf_is_uid($v)     { return is_string($v) && preg_match(BF_UID_RE, $v) === 1; }
function bf_uid_absent($i) {
    if (!is_array($i) || !array_key_exists('item_uid', $i)) return true;
    return $i['item_uid'] === null || $i['item_uid'] === '';
}
/* The proof. Everything except identity, in order, exactly as stored. */
function bf_strip_uids($items) {
    $out = [];
    foreach ($items as $it) {
        if (is_array($it)) unset($it['item_uid']);
        $out[] = $it;
    }
    return $out;
}

// ── run ──────────────────────────────────────────────────────────────────────
$mode = $opt['apply'] ? 'APPLY' : 'DRY RUN';
echo "\n  QUOTATION.DNC — item_uid backfill · {$mode}\n";
echo '  ' . str_repeat('-', 70) . "\n";

$db = getDB();
if (!$db || (isset($db->connect_errno) && $db->connect_errno)) {
    fwrite(STDERR, "  Database connection failed.\n");
    exit(1);
}
$rs = $db->query('SELECT DATABASE()');
$dbName = $rs ? ($rs->fetch_row()[0] ?? '?') : '?';
if ($rs) $rs->free();
echo "  database: {$dbName}\n";

$sql = 'SELECT id, items FROM quotations ORDER BY id';
if ($opt['limit'] > 0) $sql .= ' LIMIT ' . $opt['limit'];

$stmt = $db->prepare($sql);
if (!$stmt)          { fwrite(STDERR, "  prepare failed: {$db->error}\n"); exit(1); }
if (!$stmt->execute()){ fwrite(STDERR, "  execute failed: {$stmt->error}\n"); exit(1); }
$qid = null; $qitems = null;
$stmt->bind_result($qid, $qitems);
$rows = [];
while ($stmt->fetch()) $rows[] = [$qid, $qitems];
$stmt->close();

$n = [
    'quotations'      => count($rows),
    'items'           => 0,
    'already'         => 0,   // items that already had a valid unique uid
    'minted'          => 0,   // items given one
    'changed'         => 0,   // quotation rows that need a write
    'unchanged'       => 0,
    'unreadable'      => 0,   // items JSON that will not decode to an array
    'skipped_invalid' => 0,   // quotations whose stored identity is damaged
    'invalid_items'   => 0,   // the items inside them
];
/* The counts reconcile, so a report can be checked rather than believed:
       items seen = already + minted + invalid + unreadable-rows' items */
$problem = [];   // quotation ids only — never customer data

if (!$db->begin_transaction()) { fwrite(STDERR, "  could not begin a transaction: {$db->error}\n"); exit(1); }

$upd = $db->prepare('UPDATE quotations SET items=? WHERE id=?');
if (!$upd) { fwrite(STDERR, "  update prepare failed: {$db->error}\n"); $db->rollback(); exit(1); }

$abort = null;
foreach ($rows as [$id, $json]) {
    $items = json_decode((string)$json, true);
    if (!is_array($items)) { $n['unreadable']++; $problem['unreadable'][] = (int)$id; continue; }

    $before  = bf_strip_uids($items);
    $seen    = [];
    $invalid = false;
    $out     = [];
    $minted  = 0;

    /* Pass 1 — claim every VALID, non-duplicate uid first, so a later
       malformed row can never take an earlier row's identity. */
    foreach ($items as $it) {
        if (is_array($it) && !bf_uid_absent($it) && bf_is_uid($it['item_uid']) && !isset($seen[$it['item_uid']])) {
            $seen[$it['item_uid']] = true;
        }
    }
    $claimed = $seen;

    foreach ($items as $it) {
        $n['items']++;
        if (!is_array($it)) { $out[] = $it; $invalid = true; continue; }
        if (bf_uid_absent($it)) {
            do { $u = bf_new_uid(); } while (isset($seen[$u]));
            $seen[$u] = true; $it['item_uid'] = $u; $minted++;
            $out[] = $it; continue;
        }
        $u = $it['item_uid'];
        if (bf_is_uid($u) && isset($claimed[$u])) {
            unset($claimed[$u]);          // the first holder keeps it
            $n['already']++;
            $out[] = $it; continue;
        }
        /* Malformed, or a second row claiming a uid the first already holds.
           NOT repaired here, and not by any flag: rewriting stored identity is
           a judgement about which item is which, and this file does not make
           it. Counted, reported, and the whole run refuses to write. */
        $invalid = true;
        $n['invalid_items']++;
        $out[] = $it;
    }

    if ($invalid) {
        $n['skipped_invalid']++; $problem['invalid'][] = (int)$id;
        continue;
    }

    /* THE PROOF. Identity is the only thing this file may add. */
    if (bf_strip_uids($out) !== $before) {
        $abort = "quotation {$id}: business data would change — aborting, nothing written";
        break;
    }

    if ($minted === 0) { $n['unchanged']++; continue; }

    $n['minted'] += $minted; $n['changed']++;

    $enc = json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($enc === false) { $abort = "quotation {$id}: items would not re-encode — aborting"; break; }
    $idInt = (int)$id;
    $upd->bind_param('si', $enc, $idInt);
    if (!$upd->execute()) { $abort = "quotation {$id}: update failed: {$upd->error}"; break; }
}
$upd->close();

if ($abort !== null) {
    $db->rollback();
    fwrite(STDERR, "\n  ABORTED — {$abort}\n  Nothing was written.\n\n");
    exit(1);
}
/* ── GATE ────────────────────────────────────────────────────────────────────
   Damaged stored identity anywhere means nothing is written anywhere. Not the
   damaged rows, not the healthy ones. A partial backfill would leave the
   operator believing the job was done. */
$gateClosed = $n['skipped_invalid'] > 0;
if ($opt['apply'] && !$gateClosed) {
    if (!$db->commit()) { $db->rollback(); fwrite(STDERR, "  commit failed: {$db->error}\n"); exit(1); }
} else {
    $db->rollback();
}

// ── report: counts only ──────────────────────────────────────────────────────
printf("  quotations read          %6d\n", $n['quotations']);
printf("  items seen               %6d\n", $n['items']);
printf("  already had identity     %6d\n", $n['already']);
printf("  identity minted          %6d\n", $n['minted']);
printf("  quotation rows to write  %6d\n", $n['changed']);
printf("  quotation rows unchanged %6d\n", $n['unchanged']);
if ($n['invalid_items'])   printf("  items with invalid uid   %6d\n", $n['invalid_items']);
if ($n['unreadable'])      printf("  items JSON unreadable    %6d   ids: %s\n", $n['unreadable'], implode(',', array_slice($problem['unreadable'], 0, 20)));
if ($n['skipped_invalid']) printf("  SKIPPED, invalid uid     %6d   ids: %s\n", $n['skipped_invalid'], implode(',', array_slice($problem['invalid'], 0, 20)));
echo '  ' . str_repeat('-', 70) . "\n";
if ($gateClosed) {
    echo "  GATE CLOSED — nothing was written.\n\n";
    echo "  The quotation ids listed above hold identity that is malformed, or that\n";
    echo "  two of their items claim at once. This migration adds identity where\n";
    echo "  there is none; it does not rewrite identity that already exists, because\n";
    echo "  choosing which item keeps a duplicated uid is a decision about which item\n";
    echo "  is which. Inspect those quotations and decide by hand.\n\n";
    echo "  Until then update_quotation will refuse them with\n";
    echo "  ITEM_IDENTITY_BACKFILL_REQUIRED, which is the correct refusal.\n\n";
    exit(1);
}
if ($opt['apply']) {
    echo "  APPLIED and committed. Re-run without --apply: it must report 0 to write.\n\n";
} else {
    echo "  DRY RUN — transaction rolled back, nothing written.\n";
    echo "  Re-run with --apply to write.\n\n";
}
exit(0);
