<?php
/**
 * Der-Cheng Quotation — service API: the quotation actions (QQ R1 Loop #7).
 * FUNCTIONS ONLY; including this file does nothing. Contract: docs/SERVICE-API.md §4.6–4.8
 *
 *   whatsapp_template.get      read only
 *   quotations.create          CREATE ONLY, core-gated, idempotent, behind QQ_SERVICE_CREATE_ENABLED
 *   quotations.lookup_by_key   read only, scoped to the acting user
 *
 * quotations.create persists through dc_store_create_quotation() in
 * quotation_store.php — the same function api.php's save_quotation calls — so
 * there is one validator, one numbering lock and allocator, one transaction
 * and one revision writer. This file copies none of that logic. The only
 * function of the store it calls is dc_store_create_quotation() (plus the pure
 * helpers validate_quotation_payload() for an early, indexed refusal and
 * dc_is_idempotency_key()); nothing here can reach an UPDATE or DELETE of a
 * quotation (tests/php/service_static.test.php proves the call graph).
 *
 * The store's include contract (docs/QUOTATION-STORE.md §1) is met here:
 * fail_json() / dc_db_fail() unwind (dc_txn_cleanup) and THROW instead of
 * printing; the handler turns that into quo_unavailable. dc_current_user() is
 * defined by auth.php but never called on this path (the actor is passed in).
 */

require_once __DIR__ . '/quotation_store.php';

final class DcServiceStoreFail extends RuntimeException {}

if (!isset($GLOBALS['DC_TXN'])) $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];

/* The store's error channel for this door: unwind, then throw. Never prints. */
function fail_json($error) {
    dc_txn_cleanup();
    throw new DcServiceStoreFail('store_failed');
}
function dc_db_fail($label, $handle = null) {
    $errno = is_object($handle) ? (int)@$handle->errno : 0;
    dc_service_log('store.failed', ['errno' => $errno ?: null]);
    fail_json($label);
}

/** The product types QQ builds with quo-quote-core.js (QUO_ITEM_FORM_FIELDS). */
const DC_SERVICE_CREATE_ITEM_TYPES = ['sagrod', 'stud', 'anchorbolt', 'ubolt', 'squbolt', 'lbolt', 'lbolt45', 'jbolt'];
/** Every key quotations.create accepts. Anything else (refNo, ref_no, item uids, revision, createdBy, …) is REFUSED. */
const DC_SERVICE_CREATE_PARAMS = ['idempotencyKey', 'companyId', 'items', 'claimedTotal', 'settingsVersion', 'defaultPricesVersion',
                                  'parse', 'waContactId', 'quoteDate', 'extVersion'];
/** Price modes an item may carry (index.php getPriceMode). */
const DC_SERVICE_CREATE_PRICE_MODES = ['auto', 'no_round', 'manual'];
/**
 * The price sources this door accepts for a priceMode other than 'manual':
 * what quoPriceSource() (quo-quote-core.js) answers for a host WITHOUT price
 * history. history_recipe / history_manual need QUO's price history and
 * legacy_saved is only ever a reopened old item, so QQ can never compute them.
 */
const DC_SERVICE_CREATE_RECIPE_SOURCES = ['manual_recipe', 'built_in', 'default_rule'];

// ── whatsapp_template.get ────────────────────────────────────────────────────

/**
 * The saved template QUO's page would use. The SELECT is api.php's
 * get_whatsapp_template query, character for character. api.php answers a
 * missing row with a hard-coded body and a missing table with an error; in
 * both cases (and for an empty saved body) the page falls back to
 * WA_DEFAULT_TPL (index.php loadWATemplate + sanitizeWATemplate), so this
 * action says so with template '' / isDefault true and the formatter applies
 * its own default.
 */
function dc_service_whatsapp_template_get($db, array $params, array $actor, array $ctx = []) {
    $t = $db->query("SHOW TABLES LIKE 'whatsapp_templates'");
    if (!$t) return dc_service_q_fail('whatsapp_template.get', 'read_failed', $db);
    $body = '';
    if ($t->num_rows > 0) {
        $res = $db->query("SELECT * FROM whatsapp_templates WHERE is_default=1 ORDER BY id ASC LIMIT 1");
        if (!$res) return dc_service_q_fail('whatsapp_template.get', 'read_failed', $db);
        $row = $res->fetch_assoc();
        if ($row && is_string($row['template_body'] ?? null)) $body = $row['template_body'];
    }
    return ['data' => [
        'template'  => $body,
        'isDefault' => $body === '',
        'version'   => 'wt1-' . substr(hash('sha256', $body), 0, 16),
    ]];
}

function dc_service_q_fail($action, $reason, $db = null) {
    dc_service_log('action.failed', ['action' => $action, 'reason' => $reason, 'errno' => $db instanceof mysqli ? ((int)$db->errno ?: null) : null]);
    return ['error' => 'quo_unavailable'];
}

// ── quotations.create: validation ───────────────────────────────────────────

/** A JSON number (not a string, not a bool). */
function dc_service_is_num($v) { return (is_int($v) || is_float($v)) && is_finite((float)$v); }

/**
 * One item as QUO's quote core builds it, checked for what this door accepts.
 * Returns null or [reason]. See docs/SERVICE-API.md §4.8 "Items".
 *
 * PRICE SOURCE (docs/SERVICE-API.md §4.8.1). The source is computed by the
 * client with QUO's own shared function, quoPriceSource(quoRecommend(...))
 * in quo-quote-core.js — the function QUO's editor and Quick Add call. This
 * server cannot run it (PHP); it checks what it can:
 *   - priceMode 'manual'  ⇔ source 'manual' (quoPriceSource answers 'manual'
 *     for Manual Price before consulting anything, and never otherwise);
 *   - any other priceMode → manual_recipe, built_in or default_rule;
 *   - no history source, no legacy_saved, no historyRef (QQ has no history);
 *   - the inputs' versions: settingsVersion (Diameter Settings) and, for a
 *     non-Manual item, defaultPricesVersion (Default Price rules) must be the
 *     ones in force now (dc_service_quotations_create).
 * Whether built_in vs manual_recipe is the RIGHT answer for the typed numbers
 * is the client's computation, trusted as the prices themselves are today.
 */
function dc_service_create_item_error($it) {
    if (!is_array($it) || ($it !== [] && array_is_list($it))) return 'item_not_object';
    if (array_key_exists('item_uid', $it)) return 'item_uid_not_allowed';
    foreach (['revision', 'revision_no', 'created_by', 'createdBy', 'id'] as $k) if (array_key_exists($k, $it)) return 'field_not_allowed';
    if (!in_array($it['itemType'] ?? null, DC_SERVICE_CREATE_ITEM_TYPES, true)) return 'item_type_unsupported';
    $desc = $it['desc'] ?? null;
    if (!is_string($desc) || trim($desc) === '' || mb_strlen($desc, 'UTF-8') > 500 || !mb_check_encoding($desc, 'UTF-8')) return 'desc_invalid';
    $qty = $it['qty'] ?? null;
    if (!is_int($qty) || $qty < 1 || $qty > 1000000) return 'qty_invalid';
    $p = $it['finalUnitPrice'] ?? null; $t = $it['totalAmount'] ?? null;
    if (!dc_service_is_num($p) || $p < 0 || $p > 10000000) return 'price_invalid';
    if (!dc_service_is_num($t) || $t < 0) return 'line_total_invalid';
    if (abs(round($p * $qty, 2) - (float)$t) > 0.005) return 'line_total_mismatch';
    if (($it['pricingModel'] ?? null) !== 'accessory-inclusive') return 'pricing_model_unsupported';
    $pa = $it['priceAcceptance'] ?? null;
    if (!is_array($pa) || ($pa['state'] ?? null) !== 'accepted') return 'price_not_accepted';
    if (!dc_service_is_num($pa['value'] ?? null) || abs((float)$pa['value'] - (float)$p) > 0.005) return 'price_not_accepted';
    $mode = $it['priceMode'] ?? null;
    $src = $pa['source'] ?? null;
    if (!in_array($mode, DC_SERVICE_CREATE_PRICE_MODES, true) || array_key_exists('historyRef', $pa)) return 'price_source_unsupported';
    if ($mode === 'manual' ? $src !== 'manual' : !in_array($src, DC_SERVICE_CREATE_RECIPE_SOURCES, true)) return 'price_source_unsupported';
    return null;
}

/** @return array|null  a refusal, or null */
function dc_service_create_params_error(array $p) {
    foreach (array_keys($p) as $k) {
        if (!in_array($k, DC_SERVICE_CREATE_PARAMS, true)) {
            return ['error' => 'validation_failed', 'field' => is_string($k) && preg_match('/^[A-Za-z_]{1,40}$/D', $k) ? $k : 'params', 'reason' => 'not_allowed'];
        }
    }
    $bad = fn ($f, $r = 'invalid') => ['error' => 'validation_failed', 'field' => $f, 'reason' => $r];
    if (!dc_is_idempotency_key($p['idempotencyKey'] ?? null)) return $bad('idempotencyKey');
    $cid = $p['companyId'] ?? null;
    if (!is_int($cid) || $cid <= 0 || $cid > 2147483647) return $bad('companyId');
    if (!is_string($p['settingsVersion'] ?? null) || preg_match('/^ds1-[0-9a-f]{16}$/D', $p['settingsVersion']) !== 1) return $bad('settingsVersion');
    if (array_key_exists('defaultPricesVersion', $p)
        && (!is_string($p['defaultPricesVersion']) || preg_match('/^dp1-[0-9a-f]{16}$/D', $p['defaultPricesVersion']) !== 1)) return $bad('defaultPricesVersion');
    if (!dc_service_is_num($p['claimedTotal'] ?? null) || $p['claimedTotal'] < 0) return $bad('claimedTotal');
    /* Completeness hold (production 34ab583): QUO's Quick Add keeps Add
       disabled while its parser reports omitted lines, until the person ticks
       "I have checked the message". This door never sees the message, so the
       client must DECLARE what the parser reported and the acknowledgement. */
    $parse = $p['parse'] ?? null;
    if (!is_array($parse) || !is_int($parse['omittedCount'] ?? null) || $parse['omittedCount'] < 0 || $parse['omittedCount'] > 10000
        || !is_bool($parse['acknowledged'] ?? null)) return $bad('parse');
    if ($parse['omittedCount'] > 0 && $parse['acknowledged'] !== true) return $bad('parse', 'omitted_not_acknowledged');
    if (array_key_exists('waContactId', $p) && $p['waContactId'] !== null
        && (!is_int($p['waContactId']) || $p['waContactId'] <= 0 || $p['waContactId'] > 2147483647)) return $bad('waContactId');
    if (array_key_exists('quoteDate', $p) && $p['quoteDate'] !== null) {
        $d = $p['quoteDate'];
        if (!is_string($d) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $d, $m) !== 1 || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) return $bad('quoteDate');
    }
    if (array_key_exists('extVersion', $p) && $p['extVersion'] !== null
        && (!is_string($p['extVersion']) || preg_match('/^[0-9A-Za-z._+-]{1,20}$/D', $p['extVersion']) !== 1)) return $bad('extVersion');
    $items = $p['items'] ?? null;
    if (!is_array($items) || !array_is_list($items) || count($items) < 1) return $bad('items');
    if (count($items) > DC_SERVICE_CREATE_MAX_ITEMS) return $bad('items', 'too_many_items');
    $enc = json_encode($items);
    if ($enc === false || strlen($enc) > DC_SERVICE_CREATE_MAX_ITEMS_JSON) return $bad('items', 'too_large');
    foreach ($items as $i => $it) {
        $why = dc_service_create_item_error($it);
        if ($why !== null) return ['error' => 'validation_failed', 'field' => 'items', 'index' => $i, 'reason' => $why];
    }
    /* A recommendation-based source was computed against the Default Price
       rules: the client must say which ones. */
    if (!array_key_exists('defaultPricesVersion', $p)) {
        foreach ($items as $it) if ($it['priceMode'] !== 'manual') return $bad('defaultPricesVersion', 'required');
    }
    return null;
}

// ── quotations.create ───────────────────────────────────────────────────────

function dc_service_quotations_create($db, array $params, array $actor, array $ctx = []) {
    /* A write: refused unless all three cores are accepted. First. */
    $gate = dc_service_require_accepted_core($ctx['claims'] ?? null, $ctx['core_allow'] ?? []);
    if ($gate !== null) return $gate;
    if (($ctx['create_enabled'] ?? false) !== true) return ['error' => 'create_disabled'];

    $bad = dc_service_create_params_error($params);
    if ($bad !== null) return $bad;
    $key = $params['idempotencyKey'];
    $companyId = $params['companyId'];
    $items = $params['items'];

    /* Diameter Settings the client priced with must be the ones in force now. */
    $rows = dc_service_diameter_rows($db);
    if ($rows === null) return dc_service_q_fail('quotations.create', 'settings_read_failed', $db);
    if (!hash_equals(dc_service_diameter_version($rows), $params['settingsVersion'])) return ['error' => 'settings_changed'];

    /* …and so must the Default Price rules the price sources were computed with. */
    if (array_key_exists('defaultPricesVersion', $params)) {
        $dp = dc_service_default_price_rows($db);
        if ($dp === null) return dc_service_q_fail('quotations.create', 'default_prices_read_failed', $db);
        if (!hash_equals(dc_service_default_prices_version($dp), $params['defaultPricesVersion'])) return ['error' => 'default_prices_changed'];
    }

    /* The customer as QUO's editor stores it when a company is chosen
       (index.php: qi-customer = companies.name, qi-phone = companies.phone || ''),
       from QUO's own row, never from the client. */
    $stmt = $db->prepare('SELECT id, name, phone FROM companies WHERE id = ? LIMIT 1');
    $company = null;
    if ($stmt && $stmt->bind_param('i', $companyId) && $stmt->execute() && ($res = $stmt->get_result())) $company = $res->fetch_assoc() ?: false;
    if ($stmt) $stmt->close();
    if ($company === null) return dc_service_q_fail('quotations.create', 'company_read_failed', $db);
    if ($company === false) return ['error' => 'not_found', 'field' => 'companyId'];

    $wa = $params['waContactId'] ?? null;
    if ($wa !== null) {
        $stmt = $db->prepare('SELECT id FROM company_whatsapp_contacts WHERE id = ? AND company_id = ? AND is_active = 1 LIMIT 1');
        $found = null;
        if ($stmt && $stmt->bind_param('ii', $wa, $companyId) && $stmt->execute() && ($res = $stmt->get_result())) $found = (bool)$res->fetch_row();
        if ($stmt) $stmt->close();
        if ($found === null) return dc_service_q_fail('quotations.create', 'contact_read_failed', $db);
        if (!$found) return ['error' => 'validation_failed', 'field' => 'waContactId', 'reason' => 'not_linked'];
    }

    /* Totals: recomputed from the items the store will persist, as the editor
       computes total_amount (the sum of item totalAmount). */
    $sum = 0.0; foreach ($items as $it) $sum += (float)$it['totalAmount'];
    $total = round($sum, 2);
    if (abs($total - (float)$params['claimedTotal']) > 0.005) return ['error' => 'totals_mismatch'];

    $payload = [
        'company_id' => $companyId, 'quote_date' => $params['quoteDate'] ?? '', 'valid_until' => '',
        'prepared_by' => '', 'remarks' => '',
        'customer_name' => (string)$company['name'], 'customer_phone' => (string)($company['phone'] ?? ''),
        'items' => $items, 'total_amount' => $total,
    ];
    /* The store's own validation, early, so a refusal can name the item. */
    $msg = '';
    if (!validate_quotation_payload($payload, $msg)) {
        $r = ['error' => 'validation_failed', 'field' => 'items', 'reason' => 'store_rule'];
        if (preg_match('/^Item (\d+):/', $msg, $m)) $r['index'] = (int)$m[1] - 1;
        return $r;
    }

    /* Actor attribution exactly as a DNC browser session records it
       (auth.php dc_current_user for source 'dnc'): id NULL, canonical username,
       canonical display name, dnc_user_id for the idempotency scope. */
    $udb = dc_dnc_users_db();
    $urow = $udb === null ? false : dc_dnc_user_row($udb, (int)$actor['sub']);
    if (!is_array($urow)) return ['error' => 'actor_check_unavailable'];
    $storeActor = ['id' => null, 'username' => (string)$actor['username'], 'display_name' => dc_dnc_display_name($urow),
                   'source' => 'dnc', 'dnc_user_id' => (int)$actor['sub']];
    $claims = is_array($ctx['claims'] ?? null) ? $ctx['claims'] : [];
    $idem = ['key' => $key, 'source' => 'qq', 'ext_version' => $params['extVersion'] ?? null,
             'parser_core_sha256' => $claims['parser']['sha256'] ?? null, 'pricing_core_sha256' => $claims['pricing']['sha256'] ?? null,
             'settings_version' => $params['settingsVersion'], 'wa_contact_id' => $wa];

    try {
        $created = dc_store_create_quotation($db, $payload, $storeActor, $idem);
    } catch (DcServiceStoreFail $e) {
        return dc_service_q_fail('quotations.create', 'store_failed');
    }
    if (!$created['ok']) {
        switch ($created['code']) {
            case 'in_progress':                       return ['error' => 'in_progress'];
            case 'key_reused_with_different_payload': return ['error' => 'key_reused_with_different_payload'];
            case 'idempotency_key_invalid':           return ['error' => 'validation_failed', 'field' => 'idempotencyKey'];
            case 'validation_failed':                 return ['error' => 'validation_failed', 'field' => 'items', 'reason' => 'store_rule'];
            default:                                  return dc_service_q_fail('quotations.create', 'store_refused');
        }
    }
    $out = dc_service_quotation_readback($db, (int)$created['id'], (int)$actor['sub'], $key);
    if ($out === null) return dc_service_q_fail('quotations.create', 'readback_failed', $db);
    dc_service_log($created['replayed'] ? 'quotation.replayed' : 'quotation.created',
                   ['quotation' => (int)$created['id'], 'actor' => (int)$actor['sub']]);
    return ['data' => $out + ['replayed' => (bool)$created['replayed']]];
}

/**
 * What a quotation IS after commit: read from the persisted rows, never from
 * the request. null on a read failure or a missing quotation.
 */
function dc_service_quotation_readback($db, $qid, $actorSub, $key) {
    $one = function ($sql, $types, ...$args) use ($db) {
        $stmt = $db->prepare($sql);
        if (!$stmt || !$stmt->bind_param($types, ...$args) || !$stmt->execute()) { if ($stmt) $stmt->close(); return false; }
        $res = $stmt->get_result(); $row = $res ? $res->fetch_assoc() : false; $stmt->close();
        return $row ?: null;
    };
    $q = $one('SELECT id, company_id, ref_no, quote_date, customer_name, items, total_amount, created_at FROM quotations WHERE id = ?', 'i', $qid);
    if (!$q) return null;
    $rev = $one("SELECT revision_no, event_type, actor_user_id, actor_username, actor_display_name, created_at
                 FROM quotation_revisions WHERE quotation_id = ? AND event_type = 'create' ORDER BY revision_no ASC LIMIT 1", 'i', $qid);
    $req = $one('SELECT idempotency_key, wa_contact_id, created_at FROM quotation_create_requests WHERE actor_user_id = ? AND idempotency_key = ?', 'is', $actorSub, $key);
    if ($rev === false || $req === false) return null;
    $items = json_decode((string)$q['items'], true);
    return [
        'quotationId' => (int)$q['id'],
        'refNo'       => (string)$q['ref_no'],
        'quoteDate'   => $q['quote_date'],
        'customer'    => ['companyId' => $q['company_id'] === null ? null : (int)$q['company_id'], 'name' => (string)$q['customer_name']],
        'items'       => is_array($items) ? $items : [],
        'totalAmount' => $q['total_amount'] === null ? null : (string)$q['total_amount'],
        'createdAt'   => $q['created_at'],
        'revision'    => $rev ? ['no' => (int)$rev['revision_no'], 'event' => (string)$rev['event_type'],
                                 'actorUserId' => $rev['actor_user_id'] === null ? null : (int)$rev['actor_user_id'],
                                 'actorUsername' => $rev['actor_username'], 'actorDisplayName' => $rev['actor_display_name'],
                                 'createdAt' => $rev['created_at']] : null,
        'request'     => $req ? ['idempotencyKey' => (string)$req['idempotency_key'], 'createdAt' => $req['created_at'],
                                 'waContactId' => $req['wa_contact_id'] === null ? null : (int)$req['wa_contact_id']] : null,
        /* QUO's existing hand-off: companies.php reads ?openId=<id> and opens
           the Quotation Detail view (openByRefFromUrl); "Load" there opens the
           editor. There is no direct link into the editor. */
        'open'        => ['path' => 'companies.php?openId=' . (int)$q['id']],
    ];
}

// ── quotations.lookup_by_key (read only) ────────────────────────────────────

/** "Did my key already produce a quotation?" — for a lost response. Never creates anything. */
function dc_service_quotations_lookup_by_key($db, array $params, array $actor, array $ctx = []) {
    $key = $params['idempotencyKey'] ?? null;
    if (!dc_is_idempotency_key($key)) return ['error' => 'validation_failed', 'field' => 'idempotencyKey'];
    $sub = (int)$actor['sub'];
    $stmt = $db->prepare('SELECT quotation_id FROM quotation_create_requests WHERE actor_user_id = ? AND idempotency_key = ?');
    $row = null;
    if ($stmt && $stmt->bind_param('is', $sub, $key) && $stmt->execute() && ($res = $stmt->get_result())) $row = $res->fetch_assoc() ?: false;
    if ($stmt) $stmt->close();
    if ($row === null) return dc_service_q_fail('quotations.lookup_by_key', 'read_failed', $db);
    if ($row === false || $row['quotation_id'] === null) return ['data' => ['found' => false]];
    $out = dc_service_quotation_readback($db, (int)$row['quotation_id'], $sub, $key);
    if ($out === null) return ['data' => ['found' => false, 'reason' => 'quotation_missing']];
    return ['data' => ['found' => true] + $out];
}
