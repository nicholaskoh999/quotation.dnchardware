<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// ── Login required (shared staff account) ──
// Returns HTTP 401 + JSON when not signed in. Runs before db.php so an
// unauthenticated request never touches the database.
require_once __DIR__ . '/auth.php';
dc_require_api_login();

/* ── The one line that keeps this application working on PHP 8.1 and later ──
   PHP 8.1 changed the DEFAULT mysqli report mode from MYSQLI_REPORT_OFF to
   MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT, which makes mysqli THROW where it
   used to return false. Every error path in this file reads a return value and
   then an errno — getDB() checks $conn->connect_error, query_or_fail() checks
   !$res, execute_or_fail() checks !$stmt->execute(), and
   dc_save_quotation_insert() checks !$stmt->execute() and then $stmt->errno.
   There is no try/catch anywhere in this application. Under the 8.1 default
   every one of those checks becomes dead code: the request dies on an uncaught
   mysqli_sql_exception before a single byte of JSON is written, and the
   duplicate-ref_no retry below never runs at all.

   Turning reporting OFF restores the contract this code was written against
   rather than rewriting the code to a different one. On PHP 8.0 — what
   production runs today — OFF is already the default, so this is a no-op and
   behaviour is unchanged. On 8.4 it puts the behaviour back.

   It is placed HERE, before db.php is required, because getDB() lives in
   db.php: that file holds the real credentials, exists only on the server, and
   is not in Git. A fix that depended on editing it would be a fix that never
   reaches production. mysqli_report() is process-wide and static, so this one
   call also covers every query, prepare and execute that follows.

   Deliberate and accepted: OFF also silences mysqli warnings. That is exactly
   what PHP 8.0 does today, and this file reports $db->error / $stmt->error in
   its own JSON, so nothing the application relies on is lost.            */
mysqli_report(MYSQLI_REPORT_OFF);

require_once 'db.php';
require_once __DIR__ . '/pricing_history.php';   // identity, accessories and ranking
$db = getDB();

// ── Phase 1 stability: pin timezone to Malaysia ──
// PHP date() (used for the Q-YYYY ref year and server-side quote_date fallback)
// must not depend on the host's php.ini default.
date_default_timezone_set('Asia/Kuala_Lumpur');
// Pin the MySQL session timezone too, so CURRENT_TIMESTAMP (created_at /
// updated_at) stays Malaysia time even if the host's system timezone changes.
// Evidence gathered 2026-08-12 indicates the server already runs at UTC+8,
// so this is a no-op today and a safety net for the future.
@$db->query("SET time_zone = '+08:00'");

$action = $_GET['action'] ?? '';
$input = [];
$raw = file_get_contents('php://input');
if ($raw) $input = json_decode($raw, true) ?? [];

/* ── Transaction scope ──────────────────────────────────────────────────────
   A quotation mutation and, in a later round, its revision snapshot have to be
   one atomic write. This round adds the transaction and nothing that writes a
   revision.

   The awkward part is not BEGIN and COMMIT; it is every path that already
   ends the request. query_or_fail(), prepare_or_fail(), execute_or_fail() and
   the 1062 retry all funnel into fail_json(), which echoes and exits — and an
   exit inside an open transaction would leave the rollback to the connection
   closing, and the named lock to the same. That works, but it is not a
   contract: it is a side effect of the process dying.

   So the scope is recorded as the request runs, and fail_json() unwinds it
   explicitly before it exits. Every existing error path becomes transaction
   safe without a single call site changing, which is also why this round does
   not have to rewrite the helpers the guardrails protect.

   Two levels, deliberately not merged. The named lock is SESSION scoped and
   the transaction is not: COMMIT does not release GET_LOCK, and ROLLBACK does
   not either. They are tracked separately and released separately. */
$GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];

/* $freshReads opens the transaction at READ COMMITTED instead of the server
   default. It exists for exactly one caller and one reason.

   THE 1062 RETRY CANNOT WORK UNDER REPEATABLE READ. That isolation gives a
   transaction a consistent snapshot at its first read, and it never moves. So
   when another session commits the ref_no the allocator is about to use:

       the INSERT is refused with 1062        — writes always see the latest state
       but next_free_ref_no()'s plain SELECT  — still reads the ORIGINAL snapshot
       returns THE SAME NUMBER                — so the retry collides again

   and the one permitted attempt is spent on a number that was never going to
   work. The retry accepted at 86cf262 became unreachable the moment
   save_quotation was wrapped in a transaction, and nothing said so.

   READ COMMITTED takes a fresh snapshot for each consistent read, so the
   reallocation sees the row that caused the collision and picks the next free
   number. That is the whole fix.

   WHY THIS IS SAFE HERE, AND WHY IT IS NOT APPLIED EVERYWHERE. The create
   transaction never reads the same thing twice expecting it not to move: it
   allocates a number, inserts, and — if refused — allocates again, which is
   precisely the read that MUST move. Allocation is already serialised by
   DC_REF_LOCK, so this changes nothing about ordinary concurrent saves; it
   only lets the retry see reality in the rare case something OUTSIDE that lock
   took the number. The update path is left at the server default: it depends
   on SELECT ... FOR UPDATE, which is a locking read and already sees the
   latest committed state, so it has nothing to gain and its accepted
   read-before-write behaviour is not disturbed.

   SET TRANSACTION without SESSION or GLOBAL applies to the NEXT transaction
   only, so the scope ends when this one does. */
function dc_txn_begin($db, $freshReads = false) {
    if ($freshReads && !$db->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')) return false;
    if (!$db->begin_transaction()) return false;
    $GLOBALS['DC_TXN']['db']     = $db;
    $GLOBALS['DC_TXN']['active'] = true;
    return true;
}

function dc_txn_commit($db) {
    $ok = $db->commit();
    /* Cleared either way. A failed COMMIT has already ended the transaction;
       what it has NOT done is succeed, and the caller must not report success. */
    $GLOBALS['DC_TXN']['active'] = false;
    return $ok;
}

function dc_txn_rollback($db) {
    if (!$GLOBALS['DC_TXN']['active']) return;
    @$db->rollback();
    $GLOBALS['DC_TXN']['active'] = false;
}

/* Called by acquire_ref_lock() / release_ref_lock() so the unwind below knows
   whether this request is holding the named lock. */
function dc_txn_note_lock($db, $held) {
    $GLOBALS['DC_TXN']['db']   = $db;
    $GLOBALS['DC_TXN']['lock'] = $held;
}

/* Roll back an open transaction and release a held named lock, in that order.
   Safe to call when neither is true, which is every request that fails before
   any of this starts. */
function dc_txn_cleanup() {
    $t = &$GLOBALS['DC_TXN'];
    if (!$t['db']) return;
    if ($t['active']) { @$t['db']->rollback(); $t['active'] = false; }
    if ($t['lock'])   { @$t['db']->query("SELECT RELEASE_LOCK('" . DC_REF_LOCK . "')"); $t['lock'] = false; }
}

function fail_json($error) {
    /* Before the response, not after: an exit must never be the thing that
       ends a transaction this code opened. */
    dc_txn_cleanup();
    echo json_encode(['ok'=>false,'error'=>$error]);
    exit;
}

function query_or_fail($db, $sql, $label = 'Database query failed') {
    $res = $db->query($sql);
    if (!$res) fail_json($label . ': ' . $db->error);
    return $res;
}

function prepare_or_fail($db, $sql, $label = 'Database prepare failed') {
    $stmt = $db->prepare($sql);
    if (!$stmt) fail_json($label . ': ' . $db->error);
    return $stmt;
}

function execute_or_fail($stmt, $label = 'Database execute failed') {
    if (!$stmt->execute()) fail_json($label . ': ' . $stmt->error);
}

function table_exists($db, $table) {
    $safe = $db->real_escape_string($table);
    $res = $db->query("SHOW TABLES LIKE '{$safe}'");
    return $res && $res->num_rows > 0;
}

function require_table($db, $table) {
    if (!table_exists($db, $table)) {
        fail_json("Missing database table {$table}. Import database-safe-patch.sql in phpMyAdmin.");
    }
}

/* Quick Open reads quotations.previous_ref_no (the old number kept after a
   historical renumber). Checked once per request so the lookup degrades to a
   ref_no-only search instead of failing outright if the files are uploaded
   before the column is added. */
function column_exists($db, $table, $column) {
    static $cache = [];
    $key = $table . '.' . $column;
    if (isset($cache[$key])) return $cache[$key];
    $t = $db->real_escape_string($table);
    $c = $db->real_escape_string($column);
    $res = $db->query("SHOW COLUMNS FROM `{$t}` LIKE '{$c}'");
    return $cache[$key] = ($res && $res->num_rows > 0);
}

// ── v2.23.0 Stage 7B-18A: Master Data Excel (CSV) Import / Export ──
function normalize_product_type($v) {
    static $map = [
        'sagrod'=>'sagrod','sag rod'=>'sagrod',
        'stud'=>'stud',
        'anchorbolt'=>'anchorbolt','anchor bolt'=>'anchorbolt',
        'ubolt'=>'ubolt','u-bolt'=>'ubolt','u bolt'=>'ubolt',
        'squbolt'=>'squbolt','sq u-bolt'=>'squbolt','sq u bolt'=>'squbolt','squ bolt'=>'squbolt',
        'lbolt'=>'lbolt','l bolt'=>'lbolt',
        'lbolt45'=>'lbolt45','l bolt 45deg'=>'lbolt45','l bolt 45 deg'=>'lbolt45','l bolt45deg'=>'lbolt45',
        'jbolt'=>'jbolt','j bolt'=>'jbolt',
    ];
    $key = strtolower(trim((string)$v));
    return $map[$key] ?? null;
}
function product_type_label($code) {
    static $labels = [
        'sagrod'=>'Sag Rod','stud'=>'Stud','anchorbolt'=>'Anchor Bolt','ubolt'=>'U-Bolt',
        'squbolt'=>'SQ U-Bolt','lbolt'=>'L Bolt','lbolt45'=>'L Bolt 45DEG','jbolt'=>'J Bolt',
    ];
    return $labels[$code] ?? $code;
}
/* Shared normaliser for the historical item search. Uppercases, turns every
   separator (hyphens, ×, Ø, slashes, punctuation) into a space, folds
   "FULL SIZE"/"UNDER SIZE" onto the single-word spellings the app stores, and
   collapses runs of whitespace. Applied identically to the query and to the
   item text so the two are always compared on the same footing. */
function search_normalize($s) {
    $s = (string)$s;
    if (function_exists('mb_strtoupper')) $s = mb_strtoupper($s, 'UTF-8');
    else $s = strtoupper($s);
    $s = preg_replace('/[^A-Z0-9]+/u', ' ', $s);
    $s = preg_replace('/\bFULL\s+SIZE\b/', 'FULLSIZE', $s);
    $s = preg_replace('/\bUNDER\s+SIZE\b/', 'UNDERSIZE', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}
function normalize_material($v) {
    static $map = [
        'ms'=>'MS',
        's45c'=>'S45C',
        's45c_harden_g8_8'=>'S45C_HARDEN_G8_8','s45c + harden = g8.8'=>'S45C_HARDEN_G8_8',
        // "4140 QT" keeps its original internal value 4140. Bare "4140" is the separate
        // new material (4140_PLAIN) — every export written by this system spells the QT
        // material out as "4140 QT", so old export files still import unchanged.
        '4140 qt'=>'4140',
        '4140'=>'4140_PLAIN','4140_plain'=>'4140_PLAIN',
        '4140_harden_g10_9'=>'4140_HARDEN_G10_9','4140 qt + harden = g10.9'=>'4140_HARDEN_G10_9',
        '4340'=>'4340','4340 qt'=>'4340',
        'ss304'=>'SS304',
        'ss316'=>'SS316',
        'y bar'=>'Y_BAR','y_bar'=>'Y_BAR','ybar'=>'Y_BAR',
    ];
    $key = strtolower(trim((string)$v));
    return $map[$key] ?? null;
}
function material_label($code) {
    static $labels = [
        'MS'=>'MS','S45C'=>'S45C','S45C_HARDEN_G8_8'=>'S45C + HARDEN = G8.8',
        '4140'=>'4140 QT','4140_HARDEN_G10_9'=>'4140 QT + HARDEN = G10.9',
        '4140_PLAIN'=>'4140','Y_BAR'=>'Y BAR',
        '4340'=>'4340 QT','SS304'=>'SS304','SS316'=>'SS316',
    ];
    return $labels[$code] ?? $code;
}
// Returns null for "no size type" (valid, e.g. Stud), false when the text is invalid
function normalize_size_type($v, $type) {
    if ($type === 'stud') return null;
    $key = strtoupper(trim((string)$v));
    if ($key === '' || $key === 'NA' || $key === 'N/A' || $key === 'NO_SIZE_TYPE') return null;
    if ($key === 'FULLSIZE' || $key === 'UNDERSIZE') return $key;
    return false;
}
// Returns null for N/A (valid), false when the text is invalid
function normalize_finish($v) {
    $key = strtoupper(trim((string)$v));
    if ($key === '' || $key === 'NA' || $key === 'N/A') return null;
    if (in_array($key, ['PL','ZP','HDG'], true)) return $key;
    return false;
}
function parse_csv_text($text) {
    $text = preg_replace('/^\xEF\xBB\xBF/', '', (string)$text);
    $lines = preg_split("/\r\n|\r|\n/", $text);
    $rows = [];
    foreach ($lines as $line) {
        if (trim($line) === '') continue;
        /* '\\' is the default this call has always used; PHP 8.4 deprecates
           relying on it and PHP 9 changes it, so it is now stated. */
        $rows[] = str_getcsv($line, ',', '"', "\\");
    }
    return $rows;
}
function build_csv($header, $rows) {
    $fh = fopen('php://temp', 'w+');
    /* Same three defaults, stated for the same reason. These run once per row,
       so leaving them implicit put one deprecation notice per exported row into
       the error log — and into the download itself wherever display_errors is
       on. */
    fputcsv($fh, $header, ',', '"', "\\");
    foreach ($rows as $r) fputcsv($fh, $r, ',', '"', "\\");
    rewind($fh);
    $out = stream_get_contents($fh);
    fclose($fh);
    return "\xEF\xBB\xBF" . $out;
}


// ── Phase 1 stability: server-side quotation validation ──
// Lenient on missing fields (legacy quotations may lack some keys) but strict
// on present-and-invalid values, so bad new input can never be saved while
// old quotations can still be re-saved unchanged.
function validate_quotation_payload($input, &$error) {
    $items = $input['items'] ?? [];
    if (!is_array($items) || count($items) === 0) {
        $error = 'Quotation has no items.';
        return false;
    }
    foreach ($items as $idx => $item) {
        $n = $idx + 1;
        if (!is_array($item)) { $error = "Item {$n}: invalid item data."; return false; }
        if (array_key_exists('qty', $item)) {
            $qty = $item['qty'];
            if (!is_numeric($qty) || (float)$qty != (int)(float)$qty || (int)$qty < 1) {
                $val = is_scalar($qty) ? (string)$qty : gettype($qty);
                $error = "Item {$n}: Qty must be a whole number of at least 1 (got '{$val}').";
                return false;
            }
        }
        if (array_key_exists('finalUnitPrice', $item)) {
            $p = $item['finalUnitPrice'];
            if (!is_numeric($p) || (float)$p < 0) {
                $error = "Item {$n}: Unit Price must be a number of at least 0.";
                return false;
            }
        }
        if (array_key_exists('totalAmount', $item)) {
            $t = $item['totalAmount'];
            if (!is_numeric($t) || (float)$t < 0) {
                $error = "Item {$n}: line total must be a number of at least 0.";
                return false;
            }
        }
    }
    $total = $input['total_amount'] ?? 0;
    if (!is_numeric($total) || (float)$total < 0) {
        $error = 'Quotation total cannot be negative.';
        return false;
    }
    $qd = $input['quote_date'] ?? null;
    if ($qd !== null && $qd !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$qd)) {
        $error = 'Quotation date must be in YYYY-MM-DD format.';
        return false;
    }
    return true;
}


// ── Item identity ────────────────────────────────────────────────────────────
// Every PERSISTED quotation item carries an item_uid. The browser holds one and
// gives it back; it never mints one. Identity a client can invent is not
// identity — it is a field, and a field cannot be trusted to say which row of a
// quotation's history is which.
//
//     itm_ + 32 lowercase hex        128 bits from random_bytes()
//
// It lives inside the quotations.items JSON, so there is NO schema change and no
// item table. The previous release never reads the key, so a backfilled
// quotation RENDERS and PRICES under the old application exactly as it did
// before.
//
// It does NOT follow that the old application preserves the key. Its edit path
// rebuilds an item object from the entry form, and a rebuilt object does not
// carry item_uid, so a quotation edited under the old release can come back
// with identity missing from the rows that were touched. That is not a fault
// and nothing breaks — the backfill is idempotent and this function fails
// closed with ITEM_IDENTITY_BACKFILL_REQUIRED rather than guessing — but it is
// why quotation edits must stay PAUSED between the backfill and the
// deployment, and why that window is kept short.
//
// This round establishes identity and nothing else: no revision storage, no
// audit rows, no transaction redesign.

const DC_ITEM_UID_RE = '/^itm_[0-9a-f]{32}$/';

function dc_new_item_uid() {
    return 'itm_' . bin2hex(random_bytes(16));
}

function dc_is_item_uid($v) {
    return is_string($v) && preg_match(DC_ITEM_UID_RE, $v) === 1;
}

/* The two shapes a browser produces for "this item has no identity yet": the
   key is absent, or it is null / empty string. A key that is PRESENT and is
   something else — a number, an array, a non-empty non-UID string — is not one
   of them, and is refused rather than forgiven. Forgiving it is how a forged
   identity becomes a new item without anyone noticing. */
function dc_item_uid_absent($item) {
    if (!is_array($item) || !array_key_exists('item_uid', $item)) return true;
    $v = $item['item_uid'];
    return $v === null || $v === '';
}

/* A new UID may never collide with one this quotation already holds. The odds
   are 2^-128 and the loop will never run twice; it is here because "will never
   happen" is not the same as "cannot happen", and the cost is one array read. */
function dc_mint_item_uid(array &$used) {
    do { $uid = dc_new_item_uid(); } while (isset($used[$uid]));
    $used[$uid] = true;
    return $uid;
}

/* READ BEFORE WRITE. The persisted quotation, read INSIDE the caller's
   transaction and locked with FOR UPDATE, so that between reading it and
   writing it nobody else can change it.

   Returns the whole row rather than the one column reconciliation needs. That
   is deliberate: this is the authoritative BEFORE state, and the Snapshot
   Revision Writer will snapshot it from here. Reading it twice — once to
   reconcile, once to snapshot — would reintroduce exactly the gap this
   function exists to close.

   WHAT THE LOCK DOES, AND WHAT IT DOES NOT. Two UPDATE transactions cannot
   hold the same quotation row at once: the second waits for the first to
   commit or roll back. That is what gives the writer a deterministic BEFORE
   state. It is NOT optimistic concurrency — a browser holding a stale copy can
   still overwrite a newer edit, because nothing here compares versions. That
   is a different round and this one does not claim it.

   Returns null when there is no such row; the caller decides what that means. */
function dc_lock_quotation_for_update($db, $id) {
    $stmt = prepare_or_fail($db, "SELECT * FROM quotations WHERE id = ? FOR UPDATE",
                            'Quotation lock prepare failed');
    $stmt->bind_param('i', $id);
    execute_or_fail($stmt, 'Quotation lock failed');
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ?: null;
}

/* ── The revision writer ─────────────────────────────────────────────────────
   A quotation mutation and its immutable snapshot are ONE transaction. There is
   exactly one INSERT into quotation_revisions in this whole file and no UPDATE
   and no DELETE against it anywhere — that is how append-only is enforced,
   because the storage round deliberately did not add a trigger.

   THE TABLE IS REQUIRED. If quotation_revisions is absent the save FAILS and
   rolls back. That is not an oversight and must not be softened into a
   fallback: a "save that worked but kept no history" is precisely the state
   this round exists to make impossible. It does mean a deployment order —
   migrations/2026-08-28-create-quotation-revisions.sql must be APPLIED BEFORE
   this application is deployed — and that order is written into ROUND-SCOPE.

   SNAPSHOT OF PERSISTED FACT, NOT OF REQUEST INTENT. The row is read back out
   of the database after the mutation, inside the same transaction, so what is
   recorded is what the server actually stored: the ref_no the allocator chose
   (possibly reassigned by the 1062 retry), the quote_date it defaulted, the
   item_uid values it minted, the total it wrote. Snapshotting $input would
   record what the browser asked for, which is a different and less useful
   fact. */

const DC_SNAPSHOT_SCHEMA_VERSION = 1;

/* The persisted quotation with its company name RESOLVED, so the snapshot
   freezes what the document said at that moment. Renaming a company later must
   not rewrite the past, which is the same reason Actor Identity snapshots the
   username beside the id. */
function dc_read_quotation_snapshot_row($db, $id) {
    $stmt = prepare_or_fail($db,
        "SELECT q.*, c.name AS company_name FROM quotations q "
      . "LEFT JOIN companies c ON q.company_id = c.id WHERE q.id = ?",
        'Revision snapshot read prepare failed');
    $stmt->bind_param('i', $id);
    execute_or_fail($stmt, 'Revision snapshot read failed');
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ?: null;
}

/* The shape snapshot_schema_version = 1 names. The version lives in the COLUMN
   and not inside the JSON: two copies of the same fact can disagree, and the
   accepted storage contract already put it in a column of its own. */
function dc_build_quotation_snapshot(array $row) {
    $items = json_decode((string)($row['items'] ?? ''), true);
    if (!is_array($items)) $items = [];
    return [
        'quotation' => [
            'id'             => (int)$row['id'],
            'ref_no'         => $row['ref_no'],
            'company_id'     => (isset($row['company_id']) && $row['company_id'] !== null)
                                ? (int)$row['company_id'] : null,
            /* FROZEN. Resolved here, never looked up again when the revision is
               read back. */
            'company_name'   => $row['company_name'] ?? null,
            'customer_name'  => $row['customer_name'] ?? null,
            'customer_phone' => $row['customer_phone'] ?? null,
            'quote_date'     => $row['quote_date'] ?? null,
            'valid_until'    => $row['valid_until'] ?? null,
            /* A field OF THE DOCUMENT — whose name is printed on the quotation.
               It is NOT the audit actor and must never be used as one; that is
               what actor_user_id / actor_username / actor_display_name are, and
               they come from the authenticated session. */
            'prepared_by'    => $row['prepared_by'] ?? null,
            'remarks'        => $row['remarks'] ?? null,
            'total_amount'   => $row['total_amount'] ?? null,
            'created_at'     => $row['created_at'] ?? null,
        ],
        /* Verbatim, every one carrying the item_uid the server owns. No item
           table: identity lives inside the snapshot exactly as it lives inside
           quotations.items. */
        'items'      => $items,
        'item_count' => count($items),
    ];
}

/* ── READ-TIME HISTORY: what changed, worked out when someone asks ────────

   THE SNAPSHOTS ARE THE ONLY STORED FACT AND THIS CHANGES NONE OF THEM. Every
   function below is pure: it takes two decoded snapshots and returns a
   description of the difference. Nothing here writes, and the whole history
   path is one SELECT.

   WHY IT IS DERIVED RATHER THAN STORED. The accepted quotation_revisions
   schema has eleven columns and no diff field, and refuses a twelfth — so a
   persisted diff would need a schema this round is not allowed to change. It
   also would not be better: two adjacent immutable snapshots already contain
   the whole answer, and deriving it means a later, smarter renderer can say
   more about history that has ALREADY been recorded.

   WHAT IT RETURNS IS DATA, NOT PROSE. Each change carries a machine `kind` and
   the persisted values; the page turns those into sentences through the same
   dictionary as everything else, so history is translated like the rest of the
   UI rather than shipping English out of the server.

   HONESTY RULES, because a history that guesses is worse than none:
     · the first recorded revision being an UPDATE means the state before it
       was never recorded. It is reported as exactly that, and NOT as a
       create, and NOT as a diff against nothing.
     · a snapshot whose schema version this code does not know is reported as
       unsupported. Its structure is not guessed at.
     · a company that was renamed between revisions keeps the name FROZEN in
       each snapshot. The live companies table is never consulted here; that
       would rewrite what the document said. */

/* The item fields worth naming in history, in the order a person reads them.
   Anything else that differs is counted rather than named, so an unlabelled
   internal key can never surface as English text in a translated screen. */
const DC_HISTORY_ITEM_FIELDS = ['desc', 'cleanSize', 'dimensionPreview', 'size',
                                'qty', 'finalUnitPrice', 'totalAmount',
                                'material', 'finish', 'productType', 'sizeType',
                                'weight', 'markup'];

/* The quotation fields worth naming. id and created_at are excluded because an
   update cannot change them, and company is handled on its own below. */
const DC_HISTORY_QUOTATION_FIELDS = ['ref_no', 'customer_name', 'customer_phone',
                                     'quote_date', 'valid_until', 'prepared_by',
                                     'remarks', 'total_amount'];

function dc_history_scalar($v) {
    if ($v === null) return null;
    if (is_bool($v)) return $v ? '1' : '0';
    if (is_array($v)) return null;          // handled by the item/other paths
    return (string)$v;
}

/* A label for an item, built from what the item itself carries. Trade
   vocabulary, so it is data rather than something to translate. */
function dc_history_item_label(array $it) {
    foreach (['cleanSize', 'desc', 'size', 'productType'] as $k) {
        $v = trim((string)($it[$k] ?? ''));
        if ($v !== '') {
            $dim = trim((string)($it['dimensionPreview'] ?? ''));
            return ($dim !== '' && $k === 'cleanSize') ? ($v . ' · ' . $dim) : $v;
        }
    }
    return '';
}

function dc_history_items_by_uid(array $items) {
    $out = [];
    foreach ($items as $i => $it) {
        if (!is_array($it)) continue;
        $uid = (isset($it['item_uid']) && is_string($it['item_uid'])) ? $it['item_uid'] : null;
        if ($uid === null) continue;
        $out[$uid] = ['pos' => $i, 'item' => $it];
    }
    return $out;
}

/* ITEM IDENTITY DECIDES EVERYTHING HERE. An item is the same item when its
   item_uid is the same, whatever moved around it — which is what stops a
   reorder being reported as a removal plus an addition. */
function dc_history_item_changes(array $prevItems, array $curItems) {
    $out  = [];
    $was  = dc_history_items_by_uid($prevItems);
    $now  = dc_history_items_by_uid($curItems);

    foreach ($now as $uid => $cur) {
        if (!isset($was[$uid])) {
            $out[] = ['kind' => 'item_added', 'item' => dc_history_item_label($cur['item']),
                      'qty' => dc_history_scalar($cur['item']['qty'] ?? null)];
        }
    }
    foreach ($was as $uid => $old) {
        if (!isset($now[$uid])) {
            $out[] = ['kind' => 'item_removed', 'item' => dc_history_item_label($old['item']),
                      'qty' => dc_history_scalar($old['item']['qty'] ?? null)];
        }
    }
    /* Every field that moved on ONE item is grouped under that item, so a row
       whose qty and price both changed reads as one edit and not two. */
    foreach ($now as $uid => $cur) {
        if (!isset($was[$uid])) continue;
        $a = $was[$uid]['item']; $b = $cur['item'];
        $fields = []; $other = 0;
        foreach (DC_HISTORY_ITEM_FIELDS as $f) {
            $x = dc_history_scalar($a[$f] ?? null);
            $y = dc_history_scalar($b[$f] ?? null);
            if ($x !== $y) $fields[] = ['field' => $f, 'from' => $x, 'to' => $y];
        }
        $named = array_flip(DC_HISTORY_ITEM_FIELDS);
        foreach (array_keys($a + $b) as $k) {
            if ($k === 'item_uid' || isset($named[$k])) continue;
            $x = $a[$k] ?? null; $y = $b[$k] ?? null;
            if (json_encode($x) !== json_encode($y)) $other++;
        }
        if ($fields || $other) {
            $out[] = ['kind' => 'item_changed', 'item' => dc_history_item_label($b),
                      'fields' => $fields, 'other' => $other];
        }
    }
    /* A REORDER IS A CHANGE, and it is the change that is left when the uid SET
       is identical and every body is identical but the sequence is not. */
    $wasSeq = array_keys($was); $nowSeq = array_keys($now);
    if (!$out && $wasSeq !== $nowSeq) {
        $ws = $wasSeq; $ns = $nowSeq; sort($ws); sort($ns);
        if ($ws === $ns) $out[] = ['kind' => 'items_reordered'];
    }
    return $out;
}

/* The whole difference between two adjacent recorded snapshots. */
function dc_history_changes($prev, $cur) {
    $out = [];
    $pq  = is_array($prev) && isset($prev['quotation']) && is_array($prev['quotation'])
           ? $prev['quotation'] : [];
    $cq  = is_array($cur) && isset($cur['quotation']) && is_array($cur['quotation'])
           ? $cur['quotation'] : [];

    foreach (DC_HISTORY_QUOTATION_FIELDS as $f) {
        $x = dc_history_scalar($pq[$f] ?? null);
        $y = dc_history_scalar($cq[$f] ?? null);
        if ($x !== $y) $out[] = ['kind' => 'field', 'field' => $f, 'from' => $x, 'to' => $y];
    }
    /* COMPANY IS ONE CHANGE, NOT TWO, and it is shown by the name each snapshot
       FROZE rather than by the id or by whatever the companies table says
       today. A rename recorded between two revisions is a real difference
       between them and is reported as one. */
    $pid = dc_history_scalar($pq['company_id'] ?? null);
    $cid = dc_history_scalar($cq['company_id'] ?? null);
    $pnm = dc_history_scalar($pq['company_name'] ?? null);
    $cnm = dc_history_scalar($cq['company_name'] ?? null);
    if ($pid !== $cid || $pnm !== $cnm) {
        $out[] = ['kind' => 'field', 'field' => 'company', 'from' => $pnm, 'to' => $cnm];
    }

    $pi = (is_array($prev) && isset($prev['items']) && is_array($prev['items'])) ? $prev['items'] : [];
    $ci = (is_array($cur)  && isset($cur['items'])  && is_array($cur['items']))  ? $cur['items']  : [];
    foreach (dc_history_item_changes($pi, $ci) as $c) $out[] = $c;

    return $out;
}

/* ── NO-OP SUPPRESSION: is there anything for a revision to record? ────────

   An UPDATE that changes nothing used to write a revision anyway. That is not
   history, it is noise: revision numbers advance, a reader cannot tell which
   entries represent an edit, and the one thing a history is for — showing what
   changed — gets buried under entries where nothing did.

   WHAT IS COMPARED, AND WHY IT IS EXACTLY THIS. Persisted BEFORE against
   persisted AFTER — never the browser payload. The BEFORE state is the row this
   transaction already holds FOR UPDATE; the AFTER state is the row read back
   once the UPDATE has run. Comparing intent instead would be wrong in both
   directions: it would miss what the database did to a value (a DECIMAL(12,2)
   rounding 10.005 to 10.01, a VARCHAR truncating) and it would report a change
   when the payload merely arrived differently shaped.

   THE SURFACE IS THE NINE COLUMNS THE UPDATE CAN WRITE, and that is not a
   judgement call — it is the SET list of the statement below: company_id,
   quote_date, valid_until, prepared_by, remarks, customer_name, customer_phone,
   items, total_amount. Everything else in the row is unreachable from here.
   ref_no is deliberately not in the SET list, id and created_at are never
   written, and there is no updated_at anywhere in this schema — so there is no
   save-only metadata to filter out. If none of the nine differs the row is
   unchanged, and a revision would record a snapshot identical to the one
   already stored.

   company_name is resolved for the snapshot but is NOT compared: it is derived
   from company_id, which IS compared, and from companies.name, which this
   request does not write. Both reads happen inside one transaction, so it
   cannot differ between them.

   ITEMS ARE COMPARED THROUGH item_uid, AND ORDER IS PART OF THE COMPARISON.
   The uid sequence is stated explicitly beside the item bodies, so identity is
   part of the answer rather than incidental to it: an added item, a removed
   item and a reordered item all change that sequence.

   A REORDER IS A CHANGE, DELIBERATELY. Item order is business fact — it is the
   order printed on the quotation, and "Item 3 is item 3 on Screen, on Print and
   in WhatsApp" is a protected rule. Moving row 2 above row 1 edits the
   document, so it writes a revision. That a reorder is not a remove plus an add
   is a separate question, and it belongs to whichever later round records WHAT
   changed rather than WHETHER anything did.

   THIS SHAPE IS NOT A STORAGE CONTRACT. Nothing here is persisted, nothing is
   returned, and no column holds it. It exists for the length of one comparison.
   The accepted revision schema has no diff field and there is no accepted diff
   representation, which is why the persisted diff engine was deferred rather
   than improvised — see ROUND-SCOPE. */

/* ksort at every level so two encodings of the same item compare equal.
   Deliberately applied to lists as well: their keys are already 0..n, so
   sorting them changes nothing and ORDER IS PRESERVED — which is what makes a
   reorder register as a change rather than being normalised away. */
function dc_ksort_deep(&$v) {
    if (!is_array($v)) return;
    foreach ($v as &$child) dc_ksort_deep($child);
    unset($child);
    ksort($v);
}

/* The persisted items column, as something two saves can be compared on. */
function dc_business_items($raw) {
    $items = json_decode((string)$raw, true);
    if (!is_array($items)) $items = [];
    $uids = [];
    foreach ($items as $k => $it) {
        $uids[] = (is_array($it) && isset($it['item_uid']) && is_string($it['item_uid']))
                  ? $it['item_uid'] : null;
        dc_ksort_deep($items[$k]);
    }
    return ['uid_order' => $uids, 'items' => $items];
}

/* The nine writable columns, normalised so that only a real difference in
   persisted business fact can make two of these unequal. Both rows come from
   mysqli on the same connection, so their scalar types already match; the casts
   state the intent rather than repair anything. total_amount is compared as the
   DECIMAL string MySQL returns, never as a float. */
function dc_business_state(array $row) {
    return [
        'company_id'     => (isset($row['company_id']) && $row['company_id'] !== null)
                            ? (int)$row['company_id'] : null,
        'quote_date'     => $row['quote_date']     ?? null,
        'valid_until'    => $row['valid_until']    ?? null,
        'prepared_by'    => $row['prepared_by']    ?? null,
        'remarks'        => $row['remarks']        ?? null,
        'customer_name'  => $row['customer_name']  ?? null,
        'customer_phone' => $row['customer_phone'] ?? null,
        'total_amount'   => (isset($row['total_amount']) && $row['total_amount'] !== null)
                            ? (string)$row['total_amount'] : null,
        'items'          => dc_business_items($row['items'] ?? null),
    ];
}

/* Monotonic PER QUOTATION, allocated INSIDE the transaction.
   On the update path the quotation row is already held FOR UPDATE, so two
   updates of one quotation are serialised and cannot read the same MAX. On the
   create path the row was just inserted by this transaction and nobody else can
   see it yet. UNIQUE (quotation_id, revision_no) is the backstop that makes a
   mistake here a refused write rather than a silently duplicated history. */
function dc_next_revision_no($db, $quotationId) {
    $stmt = prepare_or_fail($db,
        "SELECT COALESCE(MAX(revision_no), 0) + 1 AS n FROM quotation_revisions WHERE quotation_id = ?",
        'Revision number prepare failed');
    $stmt->bind_param('i', $quotationId);
    execute_or_fail($stmt, 'Revision number lookup failed');
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return (int)($row['n'] ?? 1);
}

/* The one INSERT. Called after the mutation and BEFORE COMMIT, so the quotation
   and its revision commit together or neither does. Every failure inside goes
   through fail_json(), which rolls the transaction back and releases the named
   lock before it answers — so a revision that cannot be written takes the
   quotation change down with it. */
function dc_write_revision($db, $quotationId, $eventType) {
    $row = dc_read_quotation_snapshot_row($db, $quotationId);
    if ($row === null) {
        fail_json('Revision not written: the quotation could not be read back');
    }
    $json = json_encode(dc_build_quotation_snapshot($row),
                        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        fail_json('Revision not written: the quotation snapshot would not encode');
    }

    /* WHO, from the authenticated session and from nowhere else. NULL when
       there is no signed-in person behind the request — a script or a future
       system actor — because a placeholder id would be a lie. */
    $actor     = dc_current_user();
    $actorId   = ($actor && isset($actor['id'])) ? (int)$actor['id'] : null;
    $actorUser = $actor['username'] ?? null;
    $actorName = $actor['display_name'] ?? null;

    $revNo  = dc_next_revision_no($db, $quotationId);
    $ver    = DC_SNAPSHOT_SCHEMA_VERSION;
    $refNo  = (string)$row['ref_no'];

    $stmt = prepare_or_fail($db,
        "INSERT INTO quotation_revisions "
      . "(quotation_id, revision_no, quotation_ref_no, event_type, "
      . " actor_user_id, actor_username, actor_display_name, "
      . " snapshot_schema_version, snapshot_json) VALUES (?,?,?,?,?,?,?,?,?)",
        'Revision write prepare failed');
    $stmt->bind_param('iississis', $quotationId, $revNo, $refNo, $eventType,
                      $actorId, $actorUser, $actorName, $ver, $json);
    if (!$stmt->execute()) {
        /* Rolls back the quotation mutation too. No unrevisioned save. */
        fail_json('Revision write failed: ' . $stmt->error);
    }
    $stmt->close();
    return $revNo;
}

/* CREATE. Every item gets a fresh server UID and any client-supplied one is
   discarded — on a create there is nothing for an incoming UID to refer to, so
   accepting one would let a browser choose an identity. */
function dc_assign_item_uids($items) {
    if (!is_array($items)) return [];
    $used = [];
    foreach ($items as $i => $item) {
        if (!is_array($item)) continue;      // validate_quotation_payload already refused it
        $item['item_uid'] = dc_mint_item_uid($used);
        $items[$i] = $item;
    }
    return $items;
}

/* UPDATE. Reconcile what the browser sent against what is already persisted,
   and FAIL CLOSED on anything that does not reconcile. Returns the items to
   persist, or null with $error set — and it is called before a single byte is
   written, so a refusal changes nothing.

   Deliberately NOT position-based. Reconciling by array index is exactly the
   guess this round exists to remove: it cannot tell a reorder from a delete
   followed by an add, and it silently moves identity onto the wrong row.

   The persisted read is the minimum: one column, one row. Making the whole
   update transactional is a different round and is not started here. */
function dc_reconcile_item_uids($incoming, $persistedJson, &$error) {
    $persistedItems = json_decode((string)$persistedJson, true);
    if (!is_array($persistedItems)) {
        /* Unreadable stored items. Nothing here may be guessed. */
        $error = 'ITEM_IDENTITY_BACKFILL_REQUIRED';
        return null;
    }
    $persisted = [];
    foreach ($persistedItems as $p) {
        if (!is_array($p) || dc_item_uid_absent($p)
            || !dc_is_item_uid($p['item_uid']) || isset($persisted[$p['item_uid']])) {
            /* A stored quotation from before this round, or one with a damaged
               identity. It is NOT repaired here and NOT reconciled by position:
               the backfill migration is the one place allowed to write identity
               into existing rows, and it is run deliberately by an operator. */
            $error = 'ITEM_IDENTITY_BACKFILL_REQUIRED';
            return null;
        }
        $persisted[$p['item_uid']] = true;
    }

    if (!is_array($incoming)) { $error = 'ITEM_IDENTITY_MALFORMED_UID'; return null; }

    $used = $persisted;    // retained UIDs are taken; a fresh one must avoid them
    $seen = [];
    foreach ($incoming as $idx => $item) {
        if (!is_array($item)) { $error = 'ITEM_IDENTITY_MALFORMED_UID'; return null; }
        if (dc_item_uid_absent($item)) {
            /* No identity yet — this is a new item, wherever it sits in the
               array. */
            $item['item_uid'] = dc_mint_item_uid($used);
            $incoming[$idx] = $item;
            continue;
        }
        $uid = $item['item_uid'];
        if (!dc_is_item_uid($uid))     { $error = 'ITEM_IDENTITY_MALFORMED_UID'; return null; }
        if (isset($seen[$uid]))        { $error = 'ITEM_IDENTITY_DUPLICATE_UID';  return null; }
        if (!isset($persisted[$uid]))  { $error = 'ITEM_IDENTITY_UNKNOWN_UID';    return null; }
        $seen[$uid] = true;
    }
    /* A persisted UID absent from $incoming is a DELETED item. Nothing is done
       about it on purpose: the identity disappears with the row and is never
       handed to another item. $used starts as a copy of $persisted, so every
       UID this quotation ever held — including the ones being deleted right
       now — stays RESERVED for the whole of this reconciliation, and
       dc_mint_item_uid() skips anything already in it. A freed UID is
       therefore unavailable rather than merely improbable. */
    return $incoming;
}


// ── Phase 1 stability: server-side quotation number allocation ──
// The number shown in the browser at page load is a *preview only*. The real
// number is allocated here, at save time, while holding a named MySQL lock so
// two simultaneous saves can never receive the same ref_no.
// Rules:
//   - If the requested ref_no is still unused, keep it (covers both the
//     previewed number and deliberately typed custom numbers).
//   - If it is already taken (e.g. a second tab), allocate the next free
//     Q-YYYY-NNNN instead and report it back to the client.
// The lock is released explicitly after INSERT; if PHP exits early the
// connection close releases it automatically.
define('DC_REF_LOCK', 'dc_quotation_ref_alloc');

function acquire_ref_lock($db) {
    $res = $db->query("SELECT GET_LOCK('" . DC_REF_LOCK . "', 10) AS l");
    $row = $res ? $res->fetch_assoc() : null;
    $got = $row && intval($row['l']) === 1;
    /* Recorded so a failure anywhere between here and release_ref_lock() gives
       it back explicitly, rather than leaving it to the connection closing. */
    if ($got) dc_txn_note_lock($db, true);
    return $got;
}

function release_ref_lock($db) {
    @$db->query("SELECT RELEASE_LOCK('" . DC_REF_LOCK . "')");
    dc_txn_note_lock($db, false);
}

function ref_no_in_use($db, $ref) {
    $stmt = prepare_or_fail($db, "SELECT COUNT(*) AS c FROM quotations WHERE ref_no = ?", 'Ref check prepare failed');
    $stmt->bind_param('s', $ref);
    execute_or_fail($stmt, 'Ref check failed');
    $row = $stmt->get_result()->fetch_assoc();
    return intval($row['c'] ?? 0) > 0;
}

/* ── The one database error this application can answer ────────────────────
   quotations.ref_no carries a UNIQUE index, so a collision is refused by the
   database with error 1062 instead of becoming a silent duplicate. That is the
   right protection, and it leaves one case worth handling: the number was
   chosen by the SERVER, the person never typed it, and the machine already
   knows what the next free one is. Refusing the save and asking a human to try
   again is a poor answer to a question we can answer ourselves.

   GET_LOCK above is not made redundant by this and is not touched. The lock
   stops two PHP requests racing each other; 1062 catches what a lock held in
   one process cannot see — a second application, an import, a manual insert, or
   a request that died between allocating a number and using it.

   ONE retry, and no loop, because a second collision means something other than
   a race and a retry would only hide it. And ONLY 1062: a prepare failure, a
   lost connection or any other constraint returns false untouched, so the
   caller fails exactly as it did before this function existed. Widening this
   into a general retry is how a hard failure turns into a silent double-write.

   $ref_no is taken BY REFERENCE because mysqli::bind_param binds by reference —
   re-assigning it here IS the retry. Nothing is re-bound, nothing is
   re-prepared, and every other column the second attempt sends is byte for byte
   the one the first attempt sent.

   The allocator is passed in rather than reached for, so this has no hidden
   dependency on $db and can be exercised without a database. */
function dc_save_quotation_insert($stmt, &$ref_no, callable $reallocate) {
    if ($stmt->execute()) return true;
    if ((int)$stmt->errno !== 1062) return false;   // not ours: the caller fails as before
    $ref_no = $reallocate();
    return $stmt->execute();
}

function next_free_ref_no($db) {
    $year = date('Y');
    $res = query_or_fail($db, "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ref_no, '-', -1) AS UNSIGNED)), 0) AS m FROM quotations WHERE ref_no LIKE 'Q-{$year}-%'", 'Next reference lookup failed');
    $row = $res->fetch_assoc();
    $next = intval($row['m'] ?? 0) + 1;
    return sprintf('Q-%s-%04d', $year, $next);
}

// ── Next ref no ──
if ($action === 'get_next_ref') {
    $year = date('Y');
    $prefix = 'Q';
    $res = query_or_fail($db, "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ref_no, '-', -1) AS UNSIGNED)), 0) AS max_running FROM quotations WHERE ref_no LIKE '{$prefix}-{$year}-%'", 'Next reference lookup failed');
    $next = 1;
    if ($row = $res->fetch_assoc()) {
        $next = intval($row['max_running']) + 1;
    }
    echo json_encode(['ok'=>true,'ref_no'=>$prefix.'-'.$year.'-'.str_pad($next,4,'0',STR_PAD_LEFT)]);

// ── Companies ──
} elseif ($action === 'get_companies') {
    $sql = "SELECT c.*,
        COALESCE(qs.quotation_count, 0) AS quotation_count,
        qs.latest_quotation_date,
        qs.latest_quotation_created_at
    FROM companies c
    LEFT JOIN (
        SELECT
            company_id,
            COUNT(*) AS quotation_count,
            MAX(COALESCE(quote_date, DATE(created_at))) AS latest_quotation_date,
            MAX(created_at) AS latest_quotation_created_at
        FROM quotations
        WHERE company_id IS NOT NULL
        GROUP BY company_id
    ) qs ON qs.company_id = c.id
    ORDER BY c.name ASC";
    $res = query_or_fail($db, $sql, 'Companies load failed');
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $r['quotation_count'] = intval($r['quotation_count']);
        $rows[] = $r;
    }
    echo json_encode(['ok'=>true,'data'=>$rows]);

} elseif ($action === 'add_company') {
    $name  = trim($input['name'] ?? '');
    $code  = trim($input['short_code'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $addr  = trim($input['address'] ?? '');
    if (!$name) { echo json_encode(['ok'=>false,'error'=>'Name required']); exit; }
    $stmt = prepare_or_fail($db, "INSERT INTO companies (name,short_code,phone,address) VALUES (?,?,?,?)", 'Company add prepare failed');
    $stmt->bind_param('ssss', $name, $code, $phone, $addr);
    execute_or_fail($stmt, 'Company add failed');
    echo json_encode(['ok'=>true,'id'=>$db->insert_id]);

} elseif ($action === 'update_company') {
    $id    = intval($input['id'] ?? 0);
    $name  = trim($input['name'] ?? '');
    $code  = trim($input['short_code'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $addr  = trim($input['address'] ?? '');
    if (!$id || !$name) { echo json_encode(['ok'=>false,'error'=>'Missing data']); exit; }
    $stmt = prepare_or_fail($db, "UPDATE companies SET name=?,short_code=?,phone=?,address=? WHERE id=?", 'Company update prepare failed');
    $stmt->bind_param('ssssi', $name, $code, $phone, $addr, $id);
    execute_or_fail($stmt, 'Company update failed');
    echo json_encode(['ok'=>true]);

} elseif ($action === 'delete_company') {
    $id = intval($input['id'] ?? 0);
    $stmt = prepare_or_fail($db, "DELETE FROM companies WHERE id=?", 'Company delete prepare failed');
    $stmt->bind_param('i', $id);
    execute_or_fail($stmt, 'Company delete failed');
    echo json_encode(['ok'=>true]);

// ── Quotations ──
} elseif ($action === 'get_quotations') {
    $company_id = intval($_GET['company_id'] ?? 0);
    $limit = intval($_GET['limit'] ?? 0);
    $offset = intval($_GET['offset'] ?? 0);
    if ($limit < 0) $limit = 0;
    if ($limit > 100) $limit = 100;
    if ($offset < 0) $offset = 0;
    $total = null;
    if ($company_id) {
        $countStmt = prepare_or_fail($db, "SELECT COUNT(*) AS total FROM quotations WHERE company_id=?", 'Quotation count prepare failed');
        $countStmt->bind_param('i', $company_id);
        execute_or_fail($countStmt, 'Quotation count failed');
        $countRow = $countStmt->get_result()->fetch_assoc();
        $total = intval($countRow['total'] ?? 0);
        if ($limit > 0) {
            $stmt = prepare_or_fail($db, "SELECT q.*, c.name as company_name FROM quotations q LEFT JOIN companies c ON q.company_id=c.id WHERE q.company_id=? ORDER BY q.created_at DESC LIMIT ? OFFSET ?", 'Quotations load prepare failed');
            $stmt->bind_param('iii', $company_id, $limit, $offset);
        } else {
            $stmt = prepare_or_fail($db, "SELECT q.*, c.name as company_name FROM quotations q LEFT JOIN companies c ON q.company_id=c.id WHERE q.company_id=? ORDER BY q.created_at DESC", 'Quotations load prepare failed');
            $stmt->bind_param('i', $company_id);
        }
    } else {
        $countRes = query_or_fail($db, "SELECT COUNT(*) AS total FROM quotations", 'Quotation count failed');
        $countRow = $countRes->fetch_assoc();
        $total = intval($countRow['total'] ?? 0);
        if ($limit > 0) {
            $stmt = prepare_or_fail($db, "SELECT q.*, c.name as company_name FROM quotations q LEFT JOIN companies c ON q.company_id=c.id ORDER BY q.created_at DESC LIMIT ? OFFSET ?", 'Quotations load prepare failed');
            $stmt->bind_param('ii', $limit, $offset);
        } else {
            $stmt = prepare_or_fail($db, "SELECT q.*, c.name as company_name FROM quotations q LEFT JOIN companies c ON q.company_id=c.id ORDER BY q.created_at DESC LIMIT 50", 'Quotations load prepare failed');
        }
    }
    execute_or_fail($stmt, 'Quotations load failed');
    $res = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $r['items'] = json_decode($r['items'], true);
        $rows[] = $r;
    }
    $out = ['ok'=>true,'data'=>$rows];
    if ($total !== null) $out['total'] = $total;
    echo json_encode($out);

// ── Quick Open: find a saved quotation by its number ──
// Additive action — no existing action is changed. Auth is already enforced
// globally at the top of this file, so this is unreachable when signed out.
// Accepts: "Q-2026-0001", "q-2026-0001", "2026-0001", "0001", "1", or any
// free text (matched against ref_no). Never guesses: when more than one
// quotation matches, every match is returned so staff can pick.
} elseif ($action === 'find_quotation') {
    $raw = trim((string)($_GET['ref'] ?? ''));
    // collapse internal whitespace, drop a stray leading "#", uppercase
    $q = strtoupper(preg_replace('/\s+/', '', $raw));
    $q = ltrim($q, '#');
    if ($q === '') { echo json_encode(['ok'=>true,'mode'=>'none','query'=>$raw,'data'=>[]]); exit; }

    /* previous_ref_no holds the number a quotation used to carry before a
       historical renumber, so staff can still find it by the old number quoted
       over WhatsApp. Every pass below searches BOTH columns. */
    $hasPrev = column_exists($db, 'quotations', 'previous_ref_no');
    $prevCol = $hasPrev ? "q.previous_ref_no" : "NULL";
    $select = "SELECT q.id, q.ref_no, {$prevCol} AS previous_ref_no, q.quote_date, q.customer_name,
                      q.total_amount, q.created_at, c.name AS company_name
               FROM quotations q LEFT JOIN companies c ON q.company_id = c.id ";
    $rows = [];

    $addRows = function($stmt) use (&$rows) {
        execute_or_fail($stmt, 'Quotation lookup failed');
        $res = $stmt->get_result();
        while ($r = $res->fetch_assoc()) {
            $r['id'] = intval($r['id']);
            $rows[$r['id']] = $r;   // keyed by id so passes can't duplicate
        }
    };

    // Rebuild hyphens when the pasted text lost them ("Q 2026 0777", "Q20260777",
    // "20260777" all become "Q-2026-0777"). 4-digit year + 4-or-more running no.
    if (preg_match('/^Q?(\d{4})(\d{4,})$/', $q, $m)) $q = 'Q-' . $m[1] . '-' . $m[2];
    // Missing first hyphen only: "Q2026-0777"
    if (preg_match('/^Q(\d{4})-(\d+)$/', $q, $m)) $q = 'Q-' . $m[1] . '-' . $m[2];

    // 1) Exact match on the CURRENT number or on a retired one. Searching an old
    //    number returns every quotation historically linked to it — the one that
    //    still carries it and the one it was renumbered to — never just the first.
    //    The quotation that currently owns the number is listed first.
    $exact = preg_match('/^\d{4}-\d+$/', $q) ? 'Q-' . $q : $q;
    if ($hasPrev) {
        $stmt = prepare_or_fail($db, $select . "WHERE q.ref_no = ? OR q.previous_ref_no = ?
                                                ORDER BY CASE WHEN q.ref_no = ? THEN 0 ELSE 1 END, q.ref_no ASC
                                                LIMIT 25", 'Quotation lookup prepare failed');
        $stmt->bind_param('sss', $exact, $exact, $exact);
    } else {
        $stmt = prepare_or_fail($db, $select . "WHERE q.ref_no = ? LIMIT 25", 'Quotation lookup prepare failed');
        $stmt->bind_param('s', $exact);
    }
    $addRows($stmt);
    $exactHit = count($rows) === 1;

    // 2) Bare running number ("0001", "1", "498") — match the last segment
    //    numerically so 1 / 001 / 0001 all behave the same. May match several
    //    years, which is reported as a list rather than guessed.
    if (!$exactHit && preg_match('/^\d{1,6}$/', $q)) {
        $n = (int)$q;
        if ($hasPrev) {
            $stmt = prepare_or_fail($db, $select . "WHERE (q.ref_no REGEXP '^Q-[0-9]{4}-[0-9]+$'
                                                          AND CAST(SUBSTRING_INDEX(q.ref_no,'-',-1) AS UNSIGNED) = ?)
                                                       OR (q.previous_ref_no REGEXP '^Q-[0-9]{4}-[0-9]+$'
                                                          AND CAST(SUBSTRING_INDEX(q.previous_ref_no,'-',-1) AS UNSIGNED) = ?)
                                                    ORDER BY q.ref_no DESC LIMIT 25", 'Quotation lookup prepare failed');
            $stmt->bind_param('ii', $n, $n);
        } else {
            $stmt = prepare_or_fail($db, $select . "WHERE CAST(SUBSTRING_INDEX(q.ref_no,'-',-1) AS UNSIGNED) = ?
                                                    AND q.ref_no REGEXP '^Q-[0-9]{4}-[0-9]+$'
                                                    ORDER BY q.ref_no DESC LIMIT 25", 'Quotation lookup prepare failed');
            $stmt->bind_param('i', $n);
        }
        $addRows($stmt);
    }

    // 3) Fallback: partial match on the number (handles custom refs too).
    if (!count($rows)) {
        $like = '%' . $db->real_escape_string($q) . '%';
        if ($hasPrev) {
            $stmt = prepare_or_fail($db, $select . "WHERE q.ref_no LIKE ? OR q.previous_ref_no LIKE ?
                                                    ORDER BY q.created_at DESC LIMIT 25", 'Quotation lookup prepare failed');
            $stmt->bind_param('ss', $like, $like);
        } else {
            $stmt = prepare_or_fail($db, $select . "WHERE q.ref_no LIKE ? ORDER BY q.created_at DESC LIMIT 25", 'Quotation lookup prepare failed');
            $stmt->bind_param('s', $like);
        }
        $addRows($stmt);
    }

    $rows = array_values($rows);
    /* Flag the rows that were found by their RETIRED number so the UI can show
       "Formerly Q-…". A row that matched on its current ref_no is never flagged. */
    foreach ($rows as $i => $r) {
        $prev = strtoupper(trim((string)($r['previous_ref_no'] ?? '')));
        $rows[$i]['matched_previous'] = ($prev !== '' && ($prev === $exact || $prev === $q)
                                         && strtoupper(trim((string)$r['ref_no'])) !== $exact);
    }
    $mode = count($rows) === 0 ? 'none' : (count($rows) === 1 ? 'exact' : 'multiple');
    echo json_encode(['ok'=>true,'mode'=>$mode,'query'=>$raw,'normalized'=>$exact,'count'=>count($rows),
                      'alias_supported'=>$hasPrev,'data'=>$rows]);

// ── Historical item search ──
// Items live as a JSON array inside quotations.items, so there is no item table
// to query and no schema change is made here. Every quotation is scanned once
// per search (on Enter, never per keystroke) and matched in PHP.
// Matching is case-insensitive and order-independent: the query is normalised
// into tokens and an item matches only when EVERY token appears as a whole word
// in its searchable text, so "M16 J BOLT" and "J BOLT M16" behave identically.
} elseif ($action === 'search_items') {
    $raw = trim((string)($_GET['q'] ?? ''));
    $qNorm = search_normalize($raw);
    $tokens = array_values(array_unique(array_filter(explode(' ', $qNorm), function($t){ return $t !== ''; })));
    if (!$tokens) { echo json_encode(['ok'=>true,'query'=>$raw,'count'=>0,'scanned'=>0,'data'=>[]]); exit; }

    $hasPrev = column_exists($db, 'quotations', 'previous_ref_no');
    $prevCol = $hasPrev ? "q.previous_ref_no" : "NULL";
    // Newest first: quote_date is the business date, created_at breaks ties.
    $sql = "SELECT q.id, q.ref_no, {$prevCol} AS previous_ref_no, q.quote_date, q.created_at,
                   q.customer_name, q.total_amount, q.items, c.name AS company_name
            FROM quotations q LEFT JOIN companies c ON q.company_id = c.id
            ORDER BY COALESCE(q.quote_date, DATE(q.created_at)) DESC, q.created_at DESC, q.id DESC";
    $res = query_or_fail($db, $sql, 'Item search failed');

    $out = []; $scanned = 0; $truncated = false;
    $maxResults = 60;
    while ($row = $res->fetch_assoc()) {
        $scanned++;
        $items = json_decode($row['items'], true);
        if (!is_array($items)) continue;
        foreach ($items as $idx => $it) {
            if (!is_array($it)) continue;
            // Everything a person might type: description, size string, product
            // type, material label, size type and finish.
            $parts = [
                $it['desc'] ?? '', $it['size'] ?? '', $it['productType'] ?? '',
                material_label((string)($it['material'] ?? '')), $it['sizeType'] ?? '',
                $it['finish'] ?? '', $it['cleanSize'] ?? '', $it['dimensionPreview'] ?? '',
            ];
            $hay = ' ' . search_normalize(implode(' ', $parts)) . ' ';
            $all = true;
            foreach ($tokens as $t) {
                if (strpos($hay, ' ' . $t . ' ') === false) { $all = false; break; }
            }
            if (!$all) continue;
            if (count($out) >= $maxResults) { $truncated = true; break 2; }
            $out[] = [
                'quotation_id'    => intval($row['id']),
                'ref_no'          => $row['ref_no'],
                'previous_ref_no' => $row['previous_ref_no'],
                'quote_date'      => $row['quote_date'],
                'created_at'      => $row['created_at'],
                'customer'        => $row['customer_name'] ?: $row['company_name'],
                'quotation_total' => $row['total_amount'],
                'desc'            => (string)($it['desc'] ?? ''),
                // Carried so the page can read a legacy desc the way the
                // quotation screen does — "4140_PLAIN" is not "4140 QT".
                'material'        => (string)($it['material'] ?? ''),
                'size'            => (string)($it['size'] ?? ''),
                'finish'          => (string)($it['finish'] ?? ''),
                'qty'             => (int)($it['qty'] ?? 0),
                // The SELLING price actually quoted on that item — never a cost rate.
                'unit_price'      => (float)($it['finalUnitPrice'] ?? 0),
                'item_index'      => $idx,
            ];
        }
    }
    echo json_encode(['ok'=>true,'query'=>$raw,'tokens'=>$tokens,'count'=>count($out),
                      'scanned'=>$scanned,'truncated'=>$truncated,'data'=>$out]);

} elseif ($action === 'get_quotation') {
    $id = intval($_GET['id'] ?? 0);
    $stmt = prepare_or_fail($db, "SELECT q.*, c.name as company_name FROM quotations q LEFT JOIN companies c ON q.company_id=c.id WHERE q.id=?", 'Quotation load prepare failed');
    $stmt->bind_param('i', $id);
    execute_or_fail($stmt, 'Quotation load failed');
    $r = $stmt->get_result()->fetch_assoc();
    if ($r) {
        $r['items'] = json_decode($r['items'], true);
        echo json_encode(['ok'=>true,'data'=>$r]);
    } else {
        echo json_encode(['ok'=>false,'error'=>'Not found']);
    }

} elseif ($action === 'get_quotation_history') {
    /* READ ONLY. One SELECT, no transaction, no lock, and nothing in this
       branch writes a row. Deliberately NOT joined to quotations: a revision
       is a record of what a quotation WAS, and the architecture intends that
       record to outlive the quotation — asking quotations to vouch for it
       would make history disappear exactly when it is most wanted. Whether a
       deleted quotation's history is ever SHOWN is the Baseline / Delete
       Policy round's question and is not answered here. */
    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok'=>false,'error'=>'Missing quotation id']);
        exit;
    }
    $stmt = prepare_or_fail($db,
        "SELECT revision_no, event_type, created_at, actor_user_id, actor_username, "
      . "actor_display_name, snapshot_schema_version, snapshot_json "
      . "FROM quotation_revisions WHERE quotation_id = ? ORDER BY revision_no ASC",
        'Quotation history prepare failed');
    $stmt->bind_param('i', $id);
    execute_or_fail($stmt, 'Quotation history load failed');
    $res  = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) $rows[] = $row;
    $stmt->close();

    /* Walked OLDEST FIRST, because each entry is a difference from the one
       before it. The answer is reversed at the end so the page can render
       newest first without knowing any of this. */
    $out  = [];
    $prevSnapshot = null;          // the last snapshot this loop could READ
    foreach ($rows as $row) {
        $ver = (int)$row['snapshot_schema_version'];
        $entry = [
            'revision_no' => (int)$row['revision_no'],
            'event_type'  => $row['event_type'],
            'created_at'  => $row['created_at'],
            'actor'       => [
                'user_id'      => $row['actor_user_id'] !== null ? (int)$row['actor_user_id'] : null,
                'username'     => $row['actor_username'],
                'display_name' => $row['actor_display_name'],
            ],
            'snapshot_schema_version' => $ver,
        ];
        if ($ver !== DC_SNAPSHOT_SCHEMA_VERSION) {
            /* NOT GUESSED AT. A viewer that invented a structure for a format
               it does not know would be worse than one that says so. */
            $entry['changes'] = [['kind' => 'unsupported_version', 'version' => $ver]];
            $out[] = $entry;
            $prevSnapshot = null;   // and it cannot be a baseline for the next one
            continue;
        }
        $snap = json_decode((string)$row['snapshot_json'], true);
        if (!is_array($snap)) {
            $entry['changes'] = [['kind' => 'unsupported_version', 'version' => $ver]];
            $out[] = $entry;
            $prevSnapshot = null;
            continue;
        }
        if ($row['event_type'] === 'create') {
            $q = isset($snap['quotation']) && is_array($snap['quotation']) ? $snap['quotation'] : [];
            $entry['changes'] = [[
                'kind'         => 'created',
                'item_count'   => isset($snap['item_count']) ? (int)$snap['item_count']
                                  : (isset($snap['items']) && is_array($snap['items']) ? count($snap['items']) : 0),
                'total_amount' => dc_history_scalar($q['total_amount'] ?? null),
                'company'      => dc_history_scalar($q['company_name'] ?? null),
            ]];
        } elseif ($prevSnapshot === null) {
            /* THE FIRST RECORDED REVISION IS AN UPDATE. Baseline rollout is
               deferred, so a quotation that existed before the writer did has
               no recorded state to be compared against. Saying "nothing
               changed" would be a lie and saying "created" would be a bigger
               one. */
            $entry['changes'] = [['kind' => 'no_previous']];
        } else {
            $entry['changes'] = dc_history_changes($prevSnapshot, $snap);
        }
        $prevSnapshot = $snap;
        $out[] = $entry;
    }

    /* Newest first for display; the derivation above needed the other order. */
    echo json_encode(['ok'=>true, 'quotation_id'=>$id, 'revisions'=>array_reverse($out)]);

} elseif ($action === 'save_quotation') {
    $company_id  = intval($input['company_id'] ?? 0) ?: null;
    $requested_ref = trim($input['ref_no'] ?? '');
    $validationError = '';
    if (!validate_quotation_payload($input, $validationError)) {
        echo json_encode(['ok'=>false,'error'=>$validationError]); exit;
    }
    $quote_date  = ($input['quote_date'] ?? '') ?: date('Y-m-d'); // server-side default, Malaysia time
    $valid_until = ($input['valid_until'] ?? '') ?: null;
    $prep_by     = trim($input['prepared_by'] ?? '');
    $remarks     = trim($input['remarks'] ?? '');
    $cust_name   = trim($input['customer_name'] ?? '');
    $cust_phone  = trim($input['customer_phone'] ?? '');
    /* Item identity is minted here, not by the browser. */
    $itemsArr    = dc_assign_item_uids($input['items'] ?? []);
    $items       = json_encode($itemsArr);
    $total       = floatval($input['total_amount'] ?? 0);

    // Allocate the quotation number server-side, under a named lock, so two
    // simultaneous saves can never end up with the same ref_no.
    if (!acquire_ref_lock($db)) {
        echo json_encode(['ok'=>false,'error'=>'Could not reserve a quotation number (busy). Please try again.']); exit;
    }
    /* The lock is taken FIRST and the transaction opened inside it, so the
       allocation and the INSERT that uses it are one atomic write. If BEGIN
       itself fails nothing has been written, and the lock is given back before
       anything else is attempted.

       READ COMMITTED, because the 1062 retry has to be able to SEE the row it
       collided with before it reallocates — see dc_txn_begin(). */
    if (!dc_txn_begin($db, true)) {
        release_ref_lock($db);
        fail_json('Could not begin the save transaction: ' . $db->error);
    }
    if ($requested_ref !== '' && !ref_no_in_use($db, $requested_ref)) {
        $ref_no = $requested_ref;               // previewed / custom number still free — keep it
    } else {
        $ref_no = next_free_ref_no($db);        // taken or blank — allocate the next free number
    }
    $stmt = prepare_or_fail($db, "INSERT INTO quotations (company_id,ref_no,quote_date,valid_until,prepared_by,remarks,customer_name,customer_phone,items,total_amount) VALUES (?,?,?,?,?,?,?,?,?,?)", 'Quotation save prepare failed');
    $stmt->bind_param('issssssssd', $company_id,$ref_no,$quote_date,$valid_until,$prep_by,$remarks,$cust_name,$cust_phone,$items,$total);
    /* One retry, for a duplicate ref_no and for nothing else. $ref_no is bound
       by reference, so a re-allocation inside is what the second attempt sends;
       the 'reassigned' flag below then reports the new number, which the screen
       already knows how to say. */
    if (!dc_save_quotation_insert($stmt, $ref_no, function () use ($db) { return next_free_ref_no($db); })) {
        /* fail_json rolls the transaction back and gives the named lock back
           before it answers. Nothing partial survives. */
        fail_json('Quotation save failed: ' . $stmt->error);
    }
    $new_id = $db->insert_id;
    /* Exactly ONE revision, written after the 1062 retry has settled so a
       reallocated ref_no is the one recorded, and before COMMIT so the
       quotation and its history commit together. A first attempt that failed
       and was retried leaves no revision behind, because none was written
       until here. */
    dc_write_revision($db, $new_id, 'create');
    /* COMMIT BEFORE THE LOCK IS RELEASED. The lock exists to stop a second
       request allocating the same number; letting go of it while this INSERT
       is still uncommitted would hand out a number that is not yet taken. */
    if (!dc_txn_commit($db)) {
        fail_json('Quotation save could not be committed: ' . $db->error);
    }
    release_ref_lock($db);
    /* The normalized persisted items travel back, so the page that saved can
       adopt the UIDs the server just issued. Without that, a second save from
       the same page would send items with no identity and every one of them
       would be read as new. */
    echo json_encode(['ok'=>true,'id'=>$new_id,'ref_no'=>$ref_no,'reassigned'=>($requested_ref !== '' && $ref_no !== $requested_ref),'items'=>$itemsArr]);

} elseif ($action === 'update_quotation') {
    $id          = intval($input['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok'=>false,'error'=>'Missing quotation id']);
        exit;
    }
    $company_id  = intval($input['company_id'] ?? 0) ?: null;
    $validationError = '';
    if (!validate_quotation_payload($input, $validationError)) {
        echo json_encode(['ok'=>false,'error'=>$validationError]); exit;
    }
    $quote_date  = ($input['quote_date'] ?? '') ?: null;
    $valid_until = ($input['valid_until'] ?? '') ?: null;
    $prep_by     = trim($input['prepared_by'] ?? '');
    $remarks     = trim($input['remarks'] ?? '');
    $cust_name   = trim($input['customer_name'] ?? '');
    $cust_phone  = trim($input['customer_phone'] ?? '');

    /* READ BEFORE WRITE. The transaction opens FIRST, then the persisted row
       is read and locked inside it, and the UPDATE below writes that same row
       on that same connection before COMMIT. Previously the read happened
       outside any transaction, so between reconciling identity and writing it
       another request could have changed the very items that were reconciled.

       Every refusal past this point rolls back explicitly and leaves the
       quotation exactly as it was. */
    if (!dc_txn_begin($db)) {
        fail_json('Could not begin the update transaction: ' . $db->error);
    }
    $persisted = dc_lock_quotation_for_update($db, $id);
    if ($persisted === null) {
        dc_txn_rollback($db);
        http_response_code(404);
        echo json_encode(['ok'=>false,'error'=>'Not found']);
        exit;
    }
    /* The BEFORE state, taken from the row this transaction already holds FOR
       UPDATE. No extra read: the locked row IS the authoritative before. */
    $businessBefore = dc_business_state($persisted);
    /* Reconciled against the LOCKED row, not against a copy read before it. */
    $identityError = '';
    $itemsArr = dc_reconcile_item_uids($input['items'] ?? [], $persisted['items'], $identityError);
    if ($itemsArr === null) {
        dc_txn_rollback($db);
        echo json_encode(['ok'=>false,'error'=>$identityError]);
        exit;
    }

    $items       = json_encode($itemsArr);
    $total       = floatval($input['total_amount'] ?? 0);
    // Note: ref_no is deliberately NOT part of this UPDATE — editing an
    // existing quotation always keeps its original quotation number.
    $stmt = prepare_or_fail($db, "UPDATE quotations SET company_id=?,quote_date=?,valid_until=?,prepared_by=?,remarks=?,customer_name=?,customer_phone=?,items=?,total_amount=? WHERE id=?", 'Quotation update prepare failed');
    $stmt->bind_param('isssssssdi', $company_id,$quote_date,$valid_until,$prep_by,$remarks,$cust_name,$cust_phone,$items,$total,$id);
    execute_or_fail($stmt, 'Quotation update failed');
    /* The AFTER state, read back once the write has landed, so what is compared
       is what the database actually holds. Still inside the transaction the
       locked read opened, and still the row it locked. */
    $afterRow = dc_read_quotation_snapshot_row($db, $id);
    if ($afterRow === null) {
        fail_json('Update not recorded: the quotation could not be read back');
    }
    /* THE ONE DECISION THIS ROUND ADDS. Unchanged business fact writes no
       revision: the save still succeeds, the row is still committed, and
       revision_no simply does not advance — nothing is allocated, so no gap
       appears either. A changed one goes to the accepted writer untouched.

       dc_write_revision() reads the row again for its snapshot rather than
       being handed this one. That is two reads of a row this transaction holds
       FOR UPDATE, inside that transaction: they cannot differ, and leaving the
       accepted writer byte-identical is worth more than saving the query. */
    if (dc_business_state($afterRow) !== $businessBefore) {
        dc_write_revision($db, $id, 'update');
    }
    if (!dc_txn_commit($db)) {
        fail_json('Quotation update could not be committed: ' . $db->error);
    }
    echo json_encode(['ok'=>true,'items'=>$itemsArr]);

} elseif ($action === 'delete_quotation') {
    $id = intval($input['id'] ?? 0);
    $stmt = prepare_or_fail($db, "DELETE FROM quotations WHERE id=?", 'Quotation delete prepare failed');
    $stmt->bind_param('i', $id);
    execute_or_fail($stmt, 'Quotation delete failed');
    echo json_encode(['ok'=>true]);

// ── Quoted Price History (V1) ──
// Reuses existing quotations.items JSON. No schema change.
// New-format items already carry productType/material/sizeType/cleanSize/dimensionPreview.
// Old-format items are parsed from desc + size; unparseable items are skipped (never guessed).
} elseif ($action === 'get_price_history') {
    /* Retired. This was the previous-price lookup: it read the newest 300
       quotations, filtered them in PHP, and could report "no previous price"
       for an item whose last quotation fell outside that window. It was
       replaced by get_pricing_history, which searches the whole history behind
       a database prefilter and pages through the result, and nothing has
       called this since. It answers rather than 404s, so an older cached page
       cannot mistake a missing endpoint for "there is no history". */
    echo json_encode(['ok'=>false,'error'=>'get_price_history has been replaced by get_pricing_history']);

} elseif ($action === 'get_pricing_history') {
    /* ── Pricing history ───────────────────────────────────────────────────
       Not a suggestion and not a statistic: the saved rows themselves, with
       the numbers that produced each price, so staff can see WHY one quotation
       was dearer than another — a longer rod, a longer thread, a different
       cost rate, a different markup, or a different customer.

       The whole history is searched, not the newest 300. Items live inside a
       JSON blob so the specification cannot be a SQL predicate, but the SIZE
       can be a text prefilter on that blob, and that is what keeps the decode
       loop off rows that could never match. The prefilter only ever narrows:
       every surviving row is compared field by field by dc_history_record, and
       quotations written before cleanSize existed are let through it so a
       legacy record is never lost to an optimisation. */
    $want = [
        'productType'      => trim($_GET['productType'] ?? ''),
        'material'         => trim($_GET['material'] ?? ''),
        'sizeType'         => trim($_GET['sizeType'] ?? ''),
        'finish'           => trim($_GET['finish'] ?? ''),
        'cleanSize'        => trim($_GET['cleanSize'] ?? ''),
        'dimensionPreview' => trim($_GET['dimensionPreview'] ?? ''),
        'companyId'        => intval($_GET['company_id'] ?? 0),
    ];
    $offset = max(0, intval($_GET['offset'] ?? 0));
    $limit  = min(100, max(1, intval($_GET['limit'] ?? 20)));

    /* Identity is the point. Without a size and a product there is nothing to
       look up, and "everything of this material" is a different answer to a
       different question. */
    if ($want['cleanSize'] === '' || $want['productType'] === '') {
        echo json_encode(['ok'=>true,'data'=>['records'=>[],'total'=>0,'ownTotal'=>0,'otherTotal'=>0,
                                              'offset'=>0,'limit'=>$limit]]);
        exit;
    }

    /* Which quotations to decode. ONE definition, in pricing_history.php, so
       what the database is asked for is the same thing dc_history_blob_matches
       tests — see dc_history_sql_where. It narrows on the SIZE only, in either
       of the two ways a saved quotation can carry it, and dc_history_record
       then compares every field.

       It used to demand the MATERIAL as well, and to send a quotation down the
       legacy branch only where the WHOLE blob contained no "cleanSize"
       anywhere. Both of those could lose a real record: the second meant a
       legacy line sitting inside a quotation that also held a modern one was
       unreachable, which is exactly what a quotation edited across versions
       looks like.

       There is no recency window here and there never should be: an older
       quotation must not disappear because newer unrelated ones exist. The
       whole matching set is built and the browser is handed one page of it. */
    list($whereSql, $whereParams) = dc_history_sql_where($want);
    $stmt = prepare_or_fail($db,
        "SELECT q.id, q.ref_no, q.quote_date, q.created_at, q.company_id, q.customer_name, q.items,
                c.name AS company_name
           FROM quotations q
           LEFT JOIN companies c ON q.company_id = c.id
          WHERE $whereSql
          ORDER BY COALESCE(q.quote_date, q.created_at) DESC, q.id DESC",
        'Pricing history prepare failed');
    $stmt->bind_param(str_repeat('s', count($whereParams)), ...$whereParams);
    execute_or_fail($stmt, 'Pricing history load failed');
    $res = $stmt->get_result();

    $records = [];
    while ($row = $res->fetch_assoc()) {
        $items = json_decode($row['items'], true);
        if (!is_array($items)) continue;
        $meta = [
            'quotationId' => (int)$row['id'],
            'refNo'       => $row['ref_no'],
            'date'        => $row['quote_date'] ?: $row['created_at'],
            'customer'    => $row['customer_name'] ?: $row['company_name'],
            'companyId'   => (int)$row['company_id'],
        ];
        foreach ($items as $item) {
            $rec = dc_history_record($item, $want, $meta);
            if ($rec !== null) $records[] = $rec;
        }
    }
    dc_history_sort($records);

    echo json_encode(['ok'=>true,'data'=>[
        'records'    => array_slice($records, $offset, $limit),
        'total'      => count($records),
        'ownTotal'   => count(array_filter($records, function ($r) { return $r['own']; })),
        'otherTotal' => count(array_filter($records, function ($r) { return !$r['own']; })),
        'offset'     => $offset,
        'limit'      => $limit,
    ]]);

} elseif ($action === 'get_default_prices') {
    require_table($db, 'default_prices');
    $res = query_or_fail($db, "SELECT * FROM default_prices ORDER BY product_type, material, size_type, size, finish", 'Default prices load failed');
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $rows[] = [
            'id'=>(int)$r['id'],'type'=>$r['product_type'],'product_type'=>$r['product_type'],
            'material'=>$r['material'],'sizeType'=>$r['size_type'] ?? '','size_type'=>$r['size_type'] ?? '',
            'size'=>$r['size'],'finish'=>$r['finish'] ?? '',
            'costRate'=>(float)$r['cost_rate'],'cost_rate'=>(float)$r['cost_rate'],
            'addCost'=>(float)$r['additional_cost'],'additional_cost'=>(float)$r['additional_cost'],
            'markup'=>(float)$r['markup'],'active'=>(string)$r['is_active'],'is_active'=>(int)$r['is_active']
        ];
    }
    echo json_encode(['ok'=>true,'data'=>$rows]);

} elseif ($action === 'save_default_price' || $action === 'update_default_price') {
    require_table($db, 'default_prices');
    $id = intval($input['id'] ?? 0);
    $type = trim($input['type'] ?? $input['product_type'] ?? '');
    $material = trim($input['material'] ?? '');
    $sizeType = $type === 'stud' ? null : (trim($input['sizeType'] ?? $input['size_type'] ?? '') ?: null);
    $size = strtoupper(trim($input['size'] ?? ''));
    $finish = trim($input['finish'] ?? '') ?: null;
    $costRate = floatval($input['costRate'] ?? $input['cost_rate'] ?? 0);
    $addCost = floatval($input['addCost'] ?? $input['additional_cost'] ?? 0);
    $markup = floatval($input['markup'] ?? 0);
    $active = intval($input['active'] ?? $input['is_active'] ?? 1);
    if (!$type || !$material || !$size) { echo json_encode(['ok'=>false,'error'=>'Missing default price data']); exit; }
    if ($id) {
        $stmt = prepare_or_fail($db, "UPDATE default_prices SET product_type=?,material=?,size_type=?,size=?,finish=?,cost_rate=?,additional_cost=?,markup=?,is_active=? WHERE id=?", 'Default price update prepare failed');
        $stmt->bind_param('sssssdddii',$type,$material,$sizeType,$size,$finish,$costRate,$addCost,$markup,$active,$id);
        execute_or_fail($stmt, 'Default price update failed');
        echo json_encode(['ok'=>true,'id'=>$id]);
    } else {
        $stmt = prepare_or_fail($db, "INSERT INTO default_prices (product_type,material,size_type,size,finish,cost_rate,additional_cost,markup,is_active) VALUES (?,?,?,?,?,?,?,?,?)", 'Default price save prepare failed');
        $stmt->bind_param('sssssdddi',$type,$material,$sizeType,$size,$finish,$costRate,$addCost,$markup,$active);
        execute_or_fail($stmt, 'Default price save failed');
        echo json_encode(['ok'=>true,'id'=>$db->insert_id]);
    }

} elseif ($action === 'delete_default_price') {
    require_table($db, 'default_prices');
    $id = intval($input['id'] ?? 0);
    $stmt = prepare_or_fail($db, "DELETE FROM default_prices WHERE id=?", 'Default price delete prepare failed');
    $stmt->bind_param('i',$id);
    execute_or_fail($stmt, 'Default price delete failed');
    echo json_encode(['ok'=>true]);

} elseif ($action === 'get_diameter_settings') {
    require_table($db, 'diameter_settings');
    $res = query_or_fail($db, "SELECT * FROM diameter_settings WHERE is_active=1 ORDER BY product_type, material, size_type, size", 'Diameter settings load failed');
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $rows[] = [
            'id'=>(int)$r['id'],'type'=>$r['product_type'],'product_type'=>$r['product_type'],
            'material'=>$r['material'],'sizeType'=>$r['size_type'] ?? '','size_type'=>$r['size_type'] ?? '',
            'size'=>$r['size'],'diameter'=>(float)$r['diameter'],
            'active'=>(string)$r['is_active'],'is_active'=>(int)$r['is_active']
        ];
    }
    echo json_encode(['ok'=>true,'data'=>$rows]);

} elseif ($action === 'save_diameter_setting' || $action === 'update_diameter_setting') {
    require_table($db, 'diameter_settings');
    $id = intval($input['id'] ?? 0);
    $type = trim($input['type'] ?? $input['product_type'] ?? '');
    $material = trim($input['material'] ?? '');
    $sizeType = $type === 'stud' ? null : (trim($input['sizeType'] ?? $input['size_type'] ?? '') ?: null);
    $size = strtoupper(trim($input['size'] ?? ''));
    $diameter = floatval($input['diameter'] ?? 0);
    $active = intval($input['active'] ?? $input['is_active'] ?? 1);
    if (!$type || !$material || !$size || $diameter <= 0) { echo json_encode(['ok'=>false,'error'=>'Missing diameter data']); exit; }
    if ($id) {
        $stmt = prepare_or_fail($db, "UPDATE diameter_settings SET product_type=?,material=?,size_type=?,size=?,diameter=?,is_active=? WHERE id=?", 'Diameter setting update prepare failed');
        $stmt->bind_param('ssssdii',$type,$material,$sizeType,$size,$diameter,$active,$id);
        execute_or_fail($stmt, 'Diameter setting update failed');
        echo json_encode(['ok'=>true,'id'=>$id]);
    } else {
        $stmt = prepare_or_fail($db, "INSERT INTO diameter_settings (product_type,material,size_type,size,diameter,is_active) VALUES (?,?,?,?,?,?)", 'Diameter setting save prepare failed');
        $stmt->bind_param('ssssdi',$type,$material,$sizeType,$size,$diameter,$active);
        execute_or_fail($stmt, 'Diameter setting save failed');
        echo json_encode(['ok'=>true,'id'=>$db->insert_id]);
    }

} elseif ($action === 'delete_diameter_setting') {
    require_table($db, 'diameter_settings');
    $id = intval($input['id'] ?? 0);
    $stmt = prepare_or_fail($db, "DELETE FROM diameter_settings WHERE id=?", 'Diameter setting delete prepare failed');
    $stmt->bind_param('i',$id);
    execute_or_fail($stmt, 'Diameter setting delete failed');
    echo json_encode(['ok'=>true]);

} elseif ($action === 'get_whatsapp_template') {
    require_table($db, 'whatsapp_templates');
    $res = query_or_fail($db, "SELECT * FROM whatsapp_templates WHERE is_default=1 ORDER BY id ASC LIMIT 1", 'Template load failed');
    $row = $res->fetch_assoc();
    if (!$row) {
        $row = ['template_name'=>'Default','template_body'=>"Hi {customer},
Quotation {quotationNo} is ready.
Date: {date}
Valid Until: {validUntil}

Items:
{items}

Total: RM{total}

Prepared by: {preparedBy}
Thank you.",'is_default'=>1];
    }
    echo json_encode(['ok'=>true,'data'=>$row]);

} elseif ($action === 'save_whatsapp_template') {
    require_table($db, 'whatsapp_templates');
    $body = (string)($input['template_body'] ?? '');
    if ($body === '') { echo json_encode(['ok'=>false,'error'=>'Template required']); exit; }
    $name = trim($input['template_name'] ?? 'Default');
    query_or_fail($db, "UPDATE whatsapp_templates SET is_default=0 WHERE is_default=1", 'Template save failed while updating default flag');
    $stmt = prepare_or_fail($db, "INSERT INTO whatsapp_templates (template_name,template_body,is_default) VALUES (?,?,1)", 'Template save prepare failed');
    $stmt->bind_param('ss',$name,$body);
    execute_or_fail($stmt, 'Template save failed');
    echo json_encode(['ok'=>true,'id'=>$db->insert_id]);

} elseif ($action === 'reset_whatsapp_template') {
    require_table($db, 'whatsapp_templates');
    $body = "Hi {customer}
Quotation {quotationNo} is ready.
Date: {date}
Valid Until: {validUntil}

Items:
{items}

Total: RM{total}

Prepared by: {preparedBy}
Thank you.";
    $name = 'Default';
    query_or_fail($db, "UPDATE whatsapp_templates SET is_default=0 WHERE is_default=1", 'Template reset failed while updating default flag');
    $stmt = prepare_or_fail($db, "INSERT INTO whatsapp_templates (template_name,template_body,is_default) VALUES (?,?,1)", 'Template reset prepare failed');
    $stmt->bind_param('ss',$name,$body);
    execute_or_fail($stmt, 'Template reset failed');
    echo json_encode(['ok'=>true,'id'=>$db->insert_id]);

// ── v2.23.0 Stage 7B-18A: Diameter Settings — Template / Export / Import ──
} elseif ($action === 'diameter_template') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="Diameter_Settings_Template.csv"');
    $rows = [
        ['Sag Rod','MS','FULLSIZE','M12','12'],
        ['Sag Rod','4140 QT','FULLSIZE','M12','13'],
        ['U-Bolt','MS','UNDERSIZE','M12','10.6'],
        ['L Bolt','MS','FULLSIZE','M16','16'],
    ];
    echo build_csv(['Product Type','Material','Size Type','Size','Diameter'], $rows);
    exit;

} elseif ($action === 'export_diameter_settings') {
    require_table($db, 'diameter_settings');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="Diameter_Settings_Export.csv"');
    $res = query_or_fail($db, "SELECT * FROM diameter_settings WHERE is_active=1 ORDER BY product_type, material, size_type, size", 'Diameter settings export failed');
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $rows[] = [product_type_label($r['product_type']), material_label($r['material']), $r['size_type'] ?? '', $r['size'], $r['diameter']];
    }
    echo build_csv(['Product Type','Material','Size Type','Size','Diameter'], $rows);
    exit;

} elseif ($action === 'import_diameter_settings') {
    require_table($db, 'diameter_settings');
    $mode = (($input['mode'] ?? 'preview') === 'confirm') ? 'confirm' : 'preview';
    $rows = parse_csv_text((string)($input['csv'] ?? ''));
    if (!empty($rows) && count($rows[0]) >= 5 && strtolower(trim($rows[0][0])) === 'product type') array_shift($rows);

    $existing = [];
    $res = query_or_fail($db, "SELECT product_type,material,size_type,size FROM diameter_settings WHERE is_active=1", 'Diameter settings load failed');
    while ($r = $res->fetch_assoc()) {
        $existing[strtolower($r['product_type'].'|'.$r['material'].'|'.($r['size_type']??'').'|'.$r['size'])] = true;
    }

    $seen = []; $validRows = []; $errorRows = []; $dupRows = []; $rowNum = 1;
    foreach ($rows as $row) {
        $rowNum++;
        $productTypeRaw = trim($row[0] ?? ''); $materialRaw = trim($row[1] ?? '');
        $sizeTypeRaw = trim($row[2] ?? ''); $size = strtoupper(trim($row[3] ?? ''));
        $diameterRaw = trim($row[4] ?? '');
        if ($productTypeRaw==='' && $materialRaw==='' && $size==='') continue;

        $type = normalize_product_type($productTypeRaw);
        if (!$type) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Unknown Product Type '{$productTypeRaw}'"]; continue; }
        $material = normalize_material($materialRaw);
        if (!$material) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Unknown Material '{$materialRaw}'"]; continue; }
        $sizeType = normalize_size_type($sizeTypeRaw, $type);
        if ($sizeType === false) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Invalid Size Type '{$sizeTypeRaw}'"]; continue; }
        if ($size === '') { $errorRows[] = ['row'=>$rowNum,'reason'=>'Size is empty']; continue; }
        $diameter = is_numeric($diameterRaw) ? (float)$diameterRaw : null;
        if ($diameter === null || $diameter <= 0) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Diameter must be > 0 (got '{$diameterRaw}')"]; continue; }

        $key = strtolower($type.'|'.$material.'|'.($sizeType??'').'|'.$size);
        if (isset($existing[$key]) || isset($seen[$key])) {
            $dupRows[] = ['row'=>$rowNum,'key'=>product_type_label($type).' / '.$material.' / '.$size];
            continue;
        }
        $seen[$key] = true;
        $validRows[] = [$type,$material,$sizeType,$size,$diameter];
    }

    $imported = 0;
    if ($mode === 'confirm' && $validRows) {
        $stmt = prepare_or_fail($db, "INSERT INTO diameter_settings (product_type,material,size_type,size,diameter,is_active) VALUES (?,?,?,?,?,1)", 'Diameter import insert prepare failed');
        foreach ($validRows as $vr) {
            [$type,$material,$sizeType,$size,$diameter] = $vr;
            $stmt->bind_param('ssssd',$type,$material,$sizeType,$size,$diameter);
            if ($stmt->execute()) $imported++;
        }
    }

    echo json_encode(['ok'=>true,'mode'=>$mode,'total'=>count($rows),'validCount'=>count($validRows),
        'duplicateCount'=>count($dupRows),'errorCount'=>count($errorRows),
        'duplicates'=>$dupRows,'errors'=>$errorRows,'imported'=>$imported]);

// ── v2.23.0 Stage 7B-18A: Default Price Settings — Template / Export / Import ──
} elseif ($action === 'default_price_template') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="Default_Price_Settings_Template.csv"');
    $rows = [
        ['Sag Rod','MS','FULLSIZE','ALL','PL','2.80','0','0'],
        ['Sag Rod','MS','FULLSIZE','ALL','ZP','4.20','0','0'],
        ['Sag Rod','4140 QT','FULLSIZE','M12','PL','8.50','2.50','0'],
    ];
    echo build_csv(['Product Type','Material','Size Type','Size','Finish','Cost Rate','Additional Cost','Markup'], $rows);
    exit;

} elseif ($action === 'export_default_prices') {
    require_table($db, 'default_prices');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="Default_Price_Settings_Export.csv"');
    $res = query_or_fail($db, "SELECT * FROM default_prices WHERE is_active=1 ORDER BY product_type, material, size_type, size, finish", 'Default prices export failed');
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $rows[] = [product_type_label($r['product_type']), material_label($r['material']), $r['size_type'] ?? '', $r['size'], $r['finish'] ?? '', $r['cost_rate'], $r['additional_cost'], $r['markup']];
    }
    echo build_csv(['Product Type','Material','Size Type','Size','Finish','Cost Rate','Additional Cost','Markup'], $rows);
    exit;

} elseif ($action === 'import_default_prices') {
    require_table($db, 'default_prices');
    $mode = (($input['mode'] ?? 'preview') === 'confirm') ? 'confirm' : 'preview';
    $rows = parse_csv_text((string)($input['csv'] ?? ''));
    if (!empty($rows) && count($rows[0]) >= 6 && strtolower(trim($rows[0][0])) === 'product type') array_shift($rows);

    $existing = [];
    $res = query_or_fail($db, "SELECT product_type,material,size_type,size,finish FROM default_prices WHERE is_active=1", 'Default prices load failed');
    while ($r = $res->fetch_assoc()) {
        $existing[strtolower($r['product_type'].'|'.$r['material'].'|'.($r['size_type']??'').'|'.$r['size'].'|'.($r['finish']??''))] = true;
    }

    $seen = []; $validRows = []; $errorRows = []; $dupRows = []; $rowNum = 1;
    foreach ($rows as $row) {
        $rowNum++;
        $productTypeRaw = trim($row[0] ?? ''); $materialRaw = trim($row[1] ?? '');
        $sizeTypeRaw = trim($row[2] ?? ''); $size = strtoupper(trim($row[3] ?? ''));
        $finishRaw = trim($row[4] ?? ''); $costRateRaw = trim($row[5] ?? '');
        $addCostRaw = trim($row[6] ?? ''); $markupRaw = trim($row[7] ?? '');
        if ($productTypeRaw==='' && $materialRaw==='' && $size==='') continue;

        $type = normalize_product_type($productTypeRaw);
        if (!$type) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Unknown Product Type '{$productTypeRaw}'"]; continue; }
        $material = normalize_material($materialRaw);
        if (!$material) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Unknown Material '{$materialRaw}'"]; continue; }
        $sizeType = normalize_size_type($sizeTypeRaw, $type);
        if ($sizeType === false) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Invalid Size Type '{$sizeTypeRaw}'"]; continue; }
        if ($size === '') { $errorRows[] = ['row'=>$rowNum,'reason'=>'Size is empty']; continue; }
        $finish = normalize_finish($finishRaw);
        if ($finish === false) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Invalid Finish '{$finishRaw}'"]; continue; }
        if ($costRateRaw === '' || !is_numeric($costRateRaw) || (float)$costRateRaw < 0) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Cost Rate must be a number >= 0 (got '{$costRateRaw}')"]; continue; }
        if ($addCostRaw !== '' && (!is_numeric($addCostRaw) || (float)$addCostRaw < 0)) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Additional Cost must be a number >= 0 (got '{$addCostRaw}')"]; continue; }
        if ($markupRaw !== '' && !is_numeric($markupRaw)) { $errorRows[] = ['row'=>$rowNum,'reason'=>"Markup must be a number (got '{$markupRaw}')"]; continue; }
        $costRate = (float)$costRateRaw;
        $addCost = $addCostRaw === '' ? 0.0 : (float)$addCostRaw;
        $markup = $markupRaw === '' ? 0.0 : (float)$markupRaw;

        $key = strtolower($type.'|'.$material.'|'.($sizeType??'').'|'.$size.'|'.($finish??''));
        if (isset($existing[$key]) || isset($seen[$key])) {
            $dupRows[] = ['row'=>$rowNum,'key'=>product_type_label($type).' / '.$material.' / '.$size.' / '.($finish??'N/A')];
            continue;
        }
        $seen[$key] = true;
        $validRows[] = [$type,$material,$sizeType,$size,$finish,$costRate,$addCost,$markup];
    }

    $imported = 0;
    if ($mode === 'confirm' && $validRows) {
        $stmt = prepare_or_fail($db, "INSERT INTO default_prices (product_type,material,size_type,size,finish,cost_rate,additional_cost,markup,is_active) VALUES (?,?,?,?,?,?,?,?,1)", 'Default price import insert prepare failed');
        foreach ($validRows as $vr) {
            [$type,$material,$sizeType,$size,$finish,$costRate,$addCost,$markup] = $vr;
            $stmt->bind_param('sssssddd',$type,$material,$sizeType,$size,$finish,$costRate,$addCost,$markup);
            if ($stmt->execute()) $imported++;
        }
    }

    echo json_encode(['ok'=>true,'mode'=>$mode,'total'=>count($rows),'validCount'=>count($validRows),
        'duplicateCount'=>count($dupRows),'errorCount'=>count($errorRows),
        'duplicates'=>$dupRows,'errors'=>$errorRows,'imported'=>$imported]);

} else {
    echo json_encode(['ok'=>false,'error'=>'Unknown action: '.$action]);
}

$db->close();
