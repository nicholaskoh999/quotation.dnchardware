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

function fail_json($error) {
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
        $rows[] = str_getcsv($line);
    }
    return $rows;
}
function build_csv($header, $rows) {
    $fh = fopen('php://temp', 'w+');
    fputcsv($fh, $header);
    foreach ($rows as $r) fputcsv($fh, $r);
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
    return $row && intval($row['l']) === 1;
}

function release_ref_lock($db) {
    @$db->query("SELECT RELEASE_LOCK('" . DC_REF_LOCK . "')");
}

function ref_no_in_use($db, $ref) {
    $stmt = prepare_or_fail($db, "SELECT COUNT(*) AS c FROM quotations WHERE ref_no = ?", 'Ref check prepare failed');
    $stmt->bind_param('s', $ref);
    execute_or_fail($stmt, 'Ref check failed');
    $row = $stmt->get_result()->fetch_assoc();
    return intval($row['c'] ?? 0) > 0;
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
    $items       = json_encode($input['items'] ?? []);
    $total       = floatval($input['total_amount'] ?? 0);

    // Allocate the quotation number server-side, under a named lock, so two
    // simultaneous saves can never end up with the same ref_no.
    if (!acquire_ref_lock($db)) {
        echo json_encode(['ok'=>false,'error'=>'Could not reserve a quotation number (busy). Please try again.']); exit;
    }
    if ($requested_ref !== '' && !ref_no_in_use($db, $requested_ref)) {
        $ref_no = $requested_ref;               // previewed / custom number still free — keep it
    } else {
        $ref_no = next_free_ref_no($db);        // taken or blank — allocate the next free number
    }
    $stmt = prepare_or_fail($db, "INSERT INTO quotations (company_id,ref_no,quote_date,valid_until,prepared_by,remarks,customer_name,customer_phone,items,total_amount) VALUES (?,?,?,?,?,?,?,?,?,?)", 'Quotation save prepare failed');
    $stmt->bind_param('issssssssd', $company_id,$ref_no,$quote_date,$valid_until,$prep_by,$remarks,$cust_name,$cust_phone,$items,$total);
    execute_or_fail($stmt, 'Quotation save failed');
    $new_id = $db->insert_id;
    release_ref_lock($db);
    echo json_encode(['ok'=>true,'id'=>$new_id,'ref_no'=>$ref_no,'reassigned'=>($requested_ref !== '' && $ref_no !== $requested_ref)]);

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
    $items       = json_encode($input['items'] ?? []);
    $total       = floatval($input['total_amount'] ?? 0);
    // Note: ref_no is deliberately NOT part of this UPDATE — editing an
    // existing quotation always keeps its original quotation number.
    $stmt = prepare_or_fail($db, "UPDATE quotations SET company_id=?,quote_date=?,valid_until=?,prepared_by=?,remarks=?,customer_name=?,customer_phone=?,items=?,total_amount=? WHERE id=?", 'Quotation update prepare failed');
    $stmt->bind_param('isssssssdi', $company_id,$quote_date,$valid_until,$prep_by,$remarks,$cust_name,$cust_phone,$items,$total,$id);
    execute_or_fail($stmt, 'Quotation update failed');
    echo json_encode(['ok'=>true]);

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

    /* Two branches, both of which only ever NARROW:

         * a quotation written with the normalised fields must contain both the
           size and the material of the item being looked up, spelt exactly as
           json_encode wrote them - dc_history_record compares those two field
           for field, so a row without them could never survive it;

         * a quotation written before cleanSize existed carries its size only
           inside the printed label, so it is narrowed by that text instead.
           dc_legacy_item reads the size out of the same label and refuses
           anything else, so this cannot lose a legacy record either.

       Previously the legacy branch was `NOT LIKE '%"cleanSize"%'` with nothing
       else on it, which handed every pre-normalisation quotation in the
       database to PHP to be decoded and thrown away. */
    $likeSize = '%' . dc_history_needle($want['cleanSize']) . '%';
    $likeMat  = '%' . dc_history_material_needle($want['material']) . '%';
    $likeText = '%' . dc_history_size_text_needle($want['cleanSize']) . '%';
    $stmt = prepare_or_fail($db,
        "SELECT q.id, q.ref_no, q.quote_date, q.created_at, q.company_id, q.customer_name, q.items,
                c.name AS company_name
           FROM quotations q
           LEFT JOIN companies c ON q.company_id = c.id
          WHERE (q.items LIKE ? AND q.items LIKE ?)
             OR (q.items NOT LIKE '%\"cleanSize\"%' AND q.items LIKE ?)
          ORDER BY COALESCE(q.quote_date, q.created_at) DESC, q.id DESC",
        'Pricing history prepare failed');
    $stmt->bind_param('sss', $likeSize, $likeMat, $likeText);
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
