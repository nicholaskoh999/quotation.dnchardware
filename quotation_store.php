<?php
/* ── quotation_store.php — QUO quotation persistence ────────────────────────
   The functions that VALIDATE, NUMBER, INSERT, UPDATE-LOCK and REVISION a
   quotation, moved verbatim out of api.php (QQ R1 Loop #6, foundation plan
   §5.5, blocker B3) so a second caller can reuse them instead of copying them.
   docs/QUOTATION-STORE.md is the contract.

   THIS FILE ONLY DEFINES THINGS. Including it prints nothing, starts no
   session, sends no header, opens no database connection and exits nothing.
   Every function takes the mysqli handle it works on.

   WHAT THE INCLUDING SCRIPT MUST PROVIDE, before calling anything here:
     · fail_json($error) and dc_db_fail($label, $handle = null) — the error
       channel. They MUST call dc_txn_cleanup() first and MUST NOT return
       (api.php echoes JSON and exits; a test harness throws).
     · $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false]
       (api.php sets it; dc_store_create_quotation() sets it if absent).
     · dc_current_user() — only for dc_write_revision(), the browser wrapper
       that records the signed-in session user. dc_write_revision_as() takes
       the actor explicitly.
     · mysqli_report(MYSQLI_REPORT_OFF) and the Asia/Kuala_Lumpur timezone, as
       api.php sets them: every check here reads return values, and the
       server-side quote_date default and the Q-YYYY year use date().

   Nothing in this file is reachable over HTTP on its own: it is not an
   endpoint, and service.php does not include it. */

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

function query_or_fail($db, $sql, $label = 'Database query failed') {
    $res = $db->query($sql);
    if (!$res) dc_db_fail($label, $db);
    return $res;
}

function prepare_or_fail($db, $sql, $label = 'Database prepare failed') {
    $stmt = $db->prepare($sql);
    if (!$stmt) dc_db_fail($label, $db);
    return $stmt;
}

function execute_or_fail($stmt, $label = 'Database execute failed') {
    if (!$stmt->execute()) dc_db_fail($label, $stmt);
}

// ── Suggested / Accepted price (owner rule) ──
// The browser commits an item only once its price was ACCEPTED, and records
// that on the item as priceAcceptance {state, value, source, at, historyRef?}
// inside the items JSON — no schema change. An item WITHOUT the key predates
// the rule (or came from a handoff) and is accepted as saved, so every legacy
// quotation still loads and re-saves. An item that carries the key must say
// it was accepted, at the price it is being saved with.
const DC_PRICE_SOURCES = ['built_in', 'default_rule', 'manual_recipe', 'history_recipe',
                          'history_manual', 'manual', 'legacy_saved'];
function dc_price_acceptance_ok($item, &$error, $n) {
    if (!array_key_exists('priceAcceptance', $item)) return true;
    $pa = $item['priceAcceptance'];
    if (!is_array($pa) || ($pa['state'] ?? '') !== 'accepted') {
        $error = "Item {$n}: the price has not been accepted. Press Apply Price, then save again.";
        return false;
    }
    if (isset($pa['source']) && !in_array($pa['source'], DC_PRICE_SOURCES, true)) {
        $error = "Item {$n}: unknown price source.";
        return false;
    }
    $v = $pa['value'] ?? null;
    $p = $item['finalUnitPrice'] ?? null;
    if (!is_numeric($v) || !is_numeric($p) || abs((float)$v - (float)$p) > 0.005) {
        $error = "Item {$n}: the unit price differs from the accepted price. Review it and press Apply Price again.";
        return false;
    }
    return true;
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
        if (!dc_price_acceptance_ok($item, $error, $n)) return false;
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
   quotation change down with it.

   SPLIT (Loop #6): dc_write_revision() is the browser wrapper and keeps its
   signature — WHO comes from the authenticated session, dc_current_user().
   dc_write_revision_as() is the same writer with the actor passed in, for
   dc_store_create_quotation(). The body below is unchanged apart from where
   $actor comes from. */
function dc_write_revision($db, $quotationId, $eventType) {
    return dc_write_revision_as($db, $quotationId, $eventType, dc_current_user());
}

function dc_write_revision_as($db, $quotationId, $eventType, $actor) {
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
        dc_db_fail('Revision write failed', $stmt);
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


/* ══ ONE CREATE PATH ══════════════════════════════════════════════════════════
   dc_store_create_quotation() is the only way a quotation is created. The
   browser's save_quotation calls it with $idempotency = null; a future service
   caller will pass a key. Either way it runs the SAME allocator (DC_REF_LOCK +
   next_free_ref_no + the one 1062 retry) and the SAME revision writer, so there
   is one numbering system and one history.

   Returns an array, never prints:
     ['ok'=>true,  'id'=>int, 'ref_no'=>string, 'reassigned'=>bool,
                   'items'=>array|null, 'replayed'=>bool]
     ['ok'=>false, 'code'=>string, 'error'=>string]       a refusal; nothing written
   A database failure is NOT returned: it goes through dc_db_fail()/fail_json(),
   which roll back, release the lock and do not return (see the file header).

   Refusal codes: validation_failed, in_progress, idempotency_key_invalid,
   idempotency_actor_invalid, idempotency_options_invalid,
   key_reused_with_different_payload.

   IDEMPOTENCY ($idempotency !== null). ['key' => UUID v4, lowercase] plus
   optional 'source' (default 'qq') and provenance (ext_version,
   parser_core_sha256, pricing_core_sha256, settings_version, wa_contact_id),
   scoped per acting user: $actor['dnc_user_id'], the canonical DNC users.id.
     · same user + key + payload  → the SAME quotation, replayed => true,
                                    nothing written
     · same user + key, other payload → key_reused_with_different_payload
     · another user, same key     → independent
   The request row, the quotation and its 'create' revision are ONE
   transaction: all three commit or none does. The lookup runs while
   DC_REF_LOCK is held, so a concurrent second submit waits for the first to
   commit and then replays it; UNIQUE (actor_user_id, idempotency_key) is the
   backstop. Requires migrations/2026-11-11-create-quotation-create-requests.sql
   — only when a key is passed; the browser path never touches that table. */

const DC_IDEMPOTENCY_KEY_RE    = '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/';
const DC_IDEMPOTENCY_SOURCE_RE = '/^[a-z][a-z0-9_]{0,19}$/';
const DC_STORE_BUSY_ERROR      = 'Could not reserve a quotation number (busy). Please try again.';

function dc_store_refusal($code, $error) {
    return ['ok' => false, 'code' => $code, 'error' => $error];
}

/* Strict: version nibble 4, RFC 4122 variant, lowercase, hyphenated, 36 chars.
   preg_match's $ also matches before a trailing "\n", so the length is
   checked as well. */
function dc_is_idempotency_key($v) {
    return is_string($v) && strlen($v) === 36 && preg_match(DC_IDEMPOTENCY_KEY_RE, $v) === 1;
}

/* SHA-256 of the canonical JSON of the request payload: keys sorted at every
   level (dc_ksort_deep — list order is preserved, so a reorder is a different
   payload), no escaped unicode or slashes, 5.0 kept distinct from 5. Null when
   the payload cannot be encoded (e.g. invalid UTF-8). */
function dc_store_payload_sha256($payload) {
    if (!is_array($payload)) return null;
    dc_ksort_deep($payload);
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                                | JSON_PRESERVE_ZERO_FRACTION);
    return $json === false ? null : hash('sha256', $json);
}

/* Everything about the key checked BEFORE the lock is taken, so a malformed
   request costs nothing. Returns the normalised request or a refusal. */
function dc_store_idempotency_prepare($payload, $actor, array $idempotency) {
    $key = $idempotency['key'] ?? null;
    if (!dc_is_idempotency_key($key)) {
        return dc_store_refusal('idempotency_key_invalid', 'The idempotency key must be a lowercase UUID v4.');
    }
    $uid  = is_array($actor) ? ($actor['dnc_user_id'] ?? null) : null;
    $user = is_array($actor) ? ($actor['username'] ?? null) : null;
    if (!is_int($uid) || $uid <= 0 || !is_string($user) || $user === ''
        || mb_strlen($user, 'UTF-8') > 64) {
        return dc_store_refusal('idempotency_actor_invalid', 'An idempotent create needs a signed-in canonical user.');
    }
    $source = $idempotency['source'] ?? 'qq';
    if (!is_string($source) || preg_match(DC_IDEMPOTENCY_SOURCE_RE, $source) !== 1) {
        return dc_store_refusal('idempotency_options_invalid', 'Unknown request source.');
    }
    $opt = [];
    foreach (['ext_version' => '/^[0-9A-Za-z._+-]{1,20}$/',
              'parser_core_sha256' => '/^[0-9a-f]{64}$/',
              'pricing_core_sha256' => '/^[0-9a-f]{64}$/',
              'settings_version' => '/^[0-9A-Za-z._:+-]{1,40}$/'] as $f => $re) {
        $v = $idempotency[$f] ?? null;
        if ($v !== null && (!is_string($v) || preg_match($re, $v) !== 1 || substr($v, -1) === "\n")) {
            return dc_store_refusal('idempotency_options_invalid', "Invalid {$f}.");
        }
        $opt[$f] = $v;
    }
    $wa = $idempotency['wa_contact_id'] ?? null;
    if ($wa !== null && (!is_int($wa) || $wa <= 0 || $wa > 2147483647)) {
        return dc_store_refusal('idempotency_options_invalid', 'Invalid wa_contact_id.');
    }
    $hash = dc_store_payload_sha256($payload);
    if ($hash === null) {
        return dc_store_refusal('validation_failed', 'The quotation could not be encoded.');
    }
    return ['ok' => true, 'key' => $key, 'source' => $source, 'actor_user_id' => $uid,
            'actor_username' => $user, 'payload_sha256' => $hash, 'wa_contact_id' => $wa] + $opt;
}

function dc_store_idempotency_lookup($db, array $idem) {
    $stmt = prepare_or_fail($db,
        "SELECT id, payload_sha256, quotation_id, ref_no FROM quotation_create_requests "
      . "WHERE actor_user_id = ? AND idempotency_key = ?",
        'Quotation request lookup prepare failed');
    $stmt->bind_param('is', $idem['actor_user_id'], $idem['key']);
    execute_or_fail($stmt, 'Quotation request lookup failed');
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ?: null;
}

/* The answer for a key that was already used. Writes nothing. A committed
   request row always carries its quotation_id (both land in one transaction);
   items is null only if that quotation was deleted afterwards. */
function dc_store_idempotency_answer($db, array $row, array $idem) {
    if (!hash_equals((string)$row['payload_sha256'], $idem['payload_sha256'])) {
        return dc_store_refusal('key_reused_with_different_payload',
            'This idempotency key was already used for a different quotation.');
    }
    $qid   = (int)$row['quotation_id'];
    $items = null;
    $stmt  = prepare_or_fail($db, "SELECT items FROM quotations WHERE id = ?",
                             'Quotation replay read prepare failed');
    $stmt->bind_param('i', $qid);
    execute_or_fail($stmt, 'Quotation replay read failed');
    $res = $stmt->get_result();
    $q   = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if ($q) { $items = json_decode((string)$q['items'], true); if (!is_array($items)) $items = null; }
    return ['ok' => true, 'id' => $qid, 'ref_no' => (string)$row['ref_no'],
            'reassigned' => false, 'items' => $items, 'replayed' => true];
}

function dc_store_create_quotation($db, $payload, $actor, $idempotency = null) {
    if (!isset($GLOBALS['DC_TXN'])) $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];

    /* From here to the commit this is save_quotation's create, statement for
       statement and in the same order — company and requested number read
       first, then validation, then the lock, the transaction, the allocator,
       the INSERT with its one 1062 retry, the revision, COMMIT, release. */
    $company_id  = intval($payload['company_id'] ?? 0) ?: null;
    $requested_ref = trim($payload['ref_no'] ?? '');
    $validationError = '';
    if (!validate_quotation_payload($payload, $validationError)) {
        return dc_store_refusal('validation_failed', $validationError);
    }
    $idem = null;
    if ($idempotency !== null) {
        $idem = is_array($idempotency)
              ? dc_store_idempotency_prepare($payload, $actor, $idempotency)
              : dc_store_refusal('idempotency_options_invalid', 'Invalid idempotency options.');
        if (!$idem['ok']) return $idem;
    }
    $quote_date  = ($payload['quote_date'] ?? '') ?: date('Y-m-d'); // server-side default, Malaysia time
    $valid_until = ($payload['valid_until'] ?? '') ?: null;
    $prep_by     = trim($payload['prepared_by'] ?? '');
    $remarks     = trim($payload['remarks'] ?? '');
    $cust_name   = trim($payload['customer_name'] ?? '');
    $cust_phone  = trim($payload['customer_phone'] ?? '');
    /* Item identity is minted here, not by the browser. */
    $itemsArr    = dc_assign_item_uids($payload['items'] ?? []);
    $items       = json_encode($itemsArr);
    $total       = floatval($payload['total_amount'] ?? 0);

    // Allocate the quotation number server-side, under a named lock, so two
    // simultaneous saves can never end up with the same ref_no.
    if (!acquire_ref_lock($db)) {
        return dc_store_refusal('in_progress', DC_STORE_BUSY_ERROR);
    }
    /* The lock is taken FIRST and the transaction opened inside it, so the
       allocation and the INSERT that uses it are one atomic write. READ
       COMMITTED, because the 1062 retry — and the idempotency lookup — must
       SEE rows committed while this request waited for the lock. */
    if (!dc_txn_begin($db, true)) {
        release_ref_lock($db);
        dc_db_fail('Could not begin the save transaction', $db);
    }

    $reqId = null;
    if ($idem !== null) {
        /* Under the lock: a concurrent submit with this key has either
           committed (we see it and replay) or not started. */
        $prior = dc_store_idempotency_lookup($db, $idem);
        if ($prior === null) {
            $stmt = prepare_or_fail($db,
                "INSERT INTO quotation_create_requests "
              . "(source, idempotency_key, payload_sha256, actor_user_id, actor_username, "
              . " ext_version, parser_core_sha256, pricing_core_sha256, settings_version, wa_contact_id) "
              . "VALUES (?,?,?,?,?,?,?,?,?,?)",
                'Quotation request record prepare failed');
            $stmt->bind_param('sssisssssi', $idem['source'], $idem['key'], $idem['payload_sha256'],
                              $idem['actor_user_id'], $idem['actor_username'], $idem['ext_version'],
                              $idem['parser_core_sha256'], $idem['pricing_core_sha256'],
                              $idem['settings_version'], $idem['wa_contact_id']);
            if (!$stmt->execute()) {
                /* 1062: the UNIQUE key saw a row the lock did not (a writer
                   outside DC_REF_LOCK). Answer from that row. Anything else is
                   a hard failure. */
                if ((int)$stmt->errno !== 1062) dc_db_fail('Quotation request record failed', $stmt);
                $stmt->close();
                dc_txn_rollback($db);
                $prior = dc_store_idempotency_lookup($db, $idem);
                if ($prior === null) dc_db_fail('Quotation request record failed', 'duplicate key but no row');
            } else {
                $reqId = (int)$db->insert_id;
                $stmt->close();
            }
        }
        if ($prior !== null) {
            dc_txn_rollback($db);
            release_ref_lock($db);
            return dc_store_idempotency_answer($db, $prior, $idem);
        }
    }

    if ($requested_ref !== '' && !ref_no_in_use($db, $requested_ref)) {
        $ref_no = $requested_ref;               // previewed / custom number still free — keep it
    } else {
        $ref_no = next_free_ref_no($db);        // taken or blank — allocate the next free number
    }
    $stmt = prepare_or_fail($db, "INSERT INTO quotations (company_id,ref_no,quote_date,valid_until,prepared_by,remarks,customer_name,customer_phone,items,total_amount) VALUES (?,?,?,?,?,?,?,?,?,?)", 'Quotation save prepare failed');
    $stmt->bind_param('issssssssd', $company_id,$ref_no,$quote_date,$valid_until,$prep_by,$remarks,$cust_name,$cust_phone,$items,$total);
    /* One retry, for a duplicate ref_no and for nothing else. $ref_no is bound
       by reference, so a re-allocation inside is what the second attempt sends. */
    if (!dc_save_quotation_insert($stmt, $ref_no, function () use ($db) { return next_free_ref_no($db); })) {
        /* fail_json rolls the transaction back and gives the named lock back
           before it answers. Nothing partial survives — the request row
           included. */
        dc_db_fail('Quotation save failed', $stmt);
    }
    $new_id = $db->insert_id;
    /* Exactly ONE revision, after the retry has settled and before COMMIT. */
    dc_write_revision_as($db, $new_id, 'create', $actor);
    if ($reqId !== null) {
        /* The replay answer, filled before COMMIT so a committed key always
           names its quotation. */
        $link = prepare_or_fail($db, "UPDATE quotation_create_requests SET quotation_id = ?, ref_no = ? WHERE id = ?",
                                'Quotation request link prepare failed');
        $link->bind_param('isi', $new_id, $ref_no, $reqId);
        execute_or_fail($link, 'Quotation request link failed');
        $link->close();
    }
    /* COMMIT BEFORE THE LOCK IS RELEASED. The lock exists to stop a second
       request allocating the same number; letting go of it while this INSERT
       is still uncommitted would hand out a number that is not yet taken. */
    if (!dc_txn_commit($db)) {
        dc_db_fail('Quotation save could not be committed', $db);
    }
    release_ref_lock($db);
    return ['ok' => true, 'id' => $new_id, 'ref_no' => $ref_no,
            'reassigned' => ($requested_ref !== '' && $ref_no !== $requested_ref),
            'items'=>$itemsArr, 'replayed' => false];
}
