<?php
/**
 * Part of tests/php/service_static.test.php (included at its end; uses its
 * ok(), eq(), code_only(), $ROOT and $code). No database.
 *
 *   R  REACHABILITY: from the service files, the only quotation_store.php
 *      functions reachable are the create path. No UPDATE of a quotation, no
 *      DELETE, no update/reconcile/lock-for-update function can be reached.
 *   W  whatsapp_template.get runs api.php's exact SELECT
 *   V  quotations.create parameter and item rules, without a database
 */

// ══ R · only create is reachable ═══════════════════════════════════════════
{
    $store = code_only("$ROOT/quotation_store.php");
    preg_match_all('/\nfunction\s+(\w+)\s*\(/', "\n" . $store, $defs);
    $storeFns = array_flip($defs[1]);
    $bodies = [];
    foreach ($defs[1] as $fn) {
        preg_match('/function\s+' . $fn . '\s*\(.*?\n\}/s', $store, $m);
        $bodies[$fn] = $m[0] ?? '';
    }
    $callsIn = function (string $src) use ($storeFns) {
        preg_match_all('/(?<![\w>$:])(\w+)\s*\(/', $src, $m);
        $out = array_values(array_unique(array_filter($m[1], fn ($x) => isset($storeFns[$x]))));
        sort($out);
        return $out;
    };
    $svc = implode("\n", $code);
    $entry = $callsIn(preg_replace('/function\s+(fail_json|dc_db_fail)\s*\(/', 'function x(', $svc));
    eq($entry, ['dc_is_idempotency_key', 'dc_store_create_quotation', 'dc_txn_cleanup', 'validate_quotation_payload'],
       'R: the service calls exactly these store functions (the create, its validator, the key check, and the unwind its error channel needs)');
    $seen = []; $todo = $entry;
    while ($todo) {
        $fn = array_pop($todo);
        if (isset($seen[$fn])) continue;
        $seen[$fn] = true;
        foreach ($callsIn($bodies[$fn] ?? '') as $c) if (!isset($seen[$c])) $todo[] = $c;
    }
    $reach = array_keys($seen); sort($reach);
    foreach (['dc_lock_quotation_for_update', 'dc_reconcile_item_uids', 'dc_business_state', 'dc_business_items', 'dc_write_revision'] as $never) {
        ok(!in_array($never, $reach, true), "R: $never (update / browser path) is NOT reachable from the service");
    }
    $sql = '';
    foreach ($reach as $fn) $sql .= "\n" . $bodies[$fn];
    preg_match_all('/\b(INSERT\s+INTO\s+\w+|UPDATE\s+\w+\s+SET|DELETE\s+FROM\s+\w+|REPLACE\s+INTO\s+\w+)/i', $sql, $w);
    $writes = array_values(array_unique(array_map(fn ($x) => preg_replace('/\s+/', ' ', strtoupper($x)), $w[1]))); sort($writes);
    eq($writes, ['INSERT INTO QUOTATIONS', 'INSERT INTO QUOTATION_CREATE_REQUESTS', 'INSERT INTO QUOTATION_REVISIONS', 'UPDATE QUOTATION_CREATE_REQUESTS SET'],
       'R: every data-changing statement reachable from the service: create the quotation, its revision and its request row, and link the request row to it — no UPDATE of quotations, no DELETE');
    ok(in_array('quotations.create', DC_SERVICE_CORE_GATED_ACTIONS, true), 'R: the create action is in the gated list');
    preg_match('/function dc_service_quotations_create\(.*?\n\}/s', $code['service_quotations.php'], $cb);
    eq(substr_count($cb[0] ?? '', 'dc_store_create_quotation('), 1, 'R: the create handler calls the store create exactly once');
    ok(strpos($cb[0] ?? '', 'next_free_ref_no') === false && strpos($cb[0] ?? '', 'GET_LOCK') === false && strpos($cb[0] ?? '', 'INSERT') === false,
       'R: …and has no allocator, lock or INSERT of its own');
    ok(strpos($cb[0] ?? '', "'ref_no'") === false, 'R: the create never passes a ref_no to the store (QUO allocates the number)');
}

// ══ W · whatsapp_template.get = api.php's SELECT ═══════════════════════════
{
    $api = file_get_contents("$ROOT/api.php");
    ok(preg_match('/\} elseif \(\$action === \'get_whatsapp_template\'\) \{(.*?)\n\} elseif/s', $api, $blk) === 1, 'W: api.php get_whatsapp_template block found');
    preg_match('/"(SELECT \* FROM whatsapp_templates[^"]*)"/', $blk[1] ?? '', $a);
    preg_match('/function dc_service_whatsapp_template_get\(.*?\n\}/s', $code['service_quotations.php'], $sb);
    preg_match('/"(SELECT \* FROM whatsapp_templates[^"]*)"/', $sb[0] ?? '', $b);
    ok(!empty($a[1]) && ($a[1] ?? 'a') === ($b[1] ?? 'b'), 'W: whatsapp_template.get runs api.php\'s exact SQL');
}

// ══ V · create parameters and items, no database ═══════════════════════════
{
    $KEY = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
    $item = ['itemType' => 'sagrod', 'desc' => 'MS UNDERSIZE SAG ROD ZP', 'qty' => 10, 'finalUnitPrice' => 3.5, 'totalAmount' => 35.0,
             'pricingModel' => 'accessory-inclusive', 'priceMode' => 'manual', 'manualUnitPrice' => '3.50',
             'priceAcceptance' => ['state' => 'accepted', 'value' => 3.5, 'source' => 'manual', 'at' => '2026-11-11T00:00:00.000Z']];
    $p = ['idempotencyKey' => $KEY, 'companyId' => 901, 'items' => [$item], 'claimedTotal' => 35.0, 'settingsVersion' => 'ds1-0123456789abcdef',
          'parse' => ['omittedCount' => 0, 'acknowledged' => false]];
    eq(dc_service_create_params_error($p), null, 'V: a well-formed request passes the parameter rules');
    $e = fn (array $over, array $drop = []) => dc_service_create_params_error(array_diff_key(array_merge($p, $over), array_flip($drop)));
    foreach (['refNo' => 'Q-2026-0001', 'ref_no' => 'Q-2026-0001', 'createdBy' => 7, 'revision' => 1, 'prepared_by' => 'x'] as $k => $v) {
        eq($e([$k => $v]), ['error' => 'validation_failed', 'field' => $k, 'reason' => 'not_allowed'], "V: a client-sent $k is REFUSED");
    }
    eq($e([], ['idempotencyKey'])['field'] ?? null, 'idempotencyKey', 'V: no key → refused');
    eq($e(['idempotencyKey' => strtoupper($KEY)])['field'] ?? null, 'idempotencyKey', 'V: an upper-case key → refused');
    eq($e([], ['settingsVersion'])['field'] ?? null, 'settingsVersion', 'V: no settings version → refused');
    eq($e(['claimedTotal' => '35.00'])['field'] ?? null, 'claimedTotal', 'V: a total as a string → refused');
    eq($e(['companyId' => '901'])['field'] ?? null, 'companyId', 'V: a company id as a string → refused');
    eq($e([], ['parse'])['field'] ?? null, 'parse', 'V: no parse declaration → refused');
    eq($e(['parse' => ['omittedCount' => 2, 'acknowledged' => false]]), ['error' => 'validation_failed', 'field' => 'parse', 'reason' => 'omitted_not_acknowledged'],
       'V: parser reported omitted lines and the user did not acknowledge → refused (QUO\'s completeness hold)');
    eq($e(['parse' => ['omittedCount' => 2, 'acknowledged' => true]]), null, 'V: …acknowledged → accepted');
    eq($e(['quoteDate' => '2026-02-30'])['field'] ?? null, 'quoteDate', 'V: an impossible date → refused');
    eq($e(['items' => []])['field'] ?? null, 'items', 'V: no items → refused');
    eq($e(['items' => array_fill(0, DC_SERVICE_CREATE_MAX_ITEMS + 1, $item)])['reason'] ?? null, 'too_many_items', 'V: more than the item cap → refused');
    $iv = function (array $over, array $drop = [], $pa = null) use ($e, $item) {
        $it = array_diff_key(array_merge($item, $over), array_flip($drop));
        if ($pa !== null) $it['priceAcceptance'] = array_merge($item['priceAcceptance'], $pa);
        $r = $e(['items' => [$item, $it]]);
        return $r === null ? null : [$r['field'] ?? null, $r['index'] ?? null, $r['reason'] ?? null];
    };
    eq($iv(['item_uid' => 'itm_00000000000000000000000000000001']), ['items', 1, 'item_uid_not_allowed'], 'V: a client item_uid is REFUSED, naming item index 1');
    eq($iv(['itemType' => 'plate']), ['items', 1, 'item_type_unsupported'], 'V: a type QUO\'s quote core does not build → refused');
    eq($iv(['qty' => 0]), ['items', 1, 'qty_invalid'], 'V: qty 0 → refused');
    eq($iv(['qty' => 1.5]), ['items', 1, 'qty_invalid'], 'V: a fractional qty → refused');
    eq($iv(['totalAmount' => 35.02]), ['items', 1, 'line_total_mismatch'], 'V: line total ≠ qty × unit price → refused');
    eq($iv(['pricingModel' => 'bolt-separate']), ['items', 1, 'pricing_model_unsupported'], 'V: a pricing model the core does not build → refused');
    eq($iv([], ['priceAcceptance']), ['items', 1, 'price_not_accepted'], 'V: no priceAcceptance → refused (never stored as a legacy item)');
    eq($iv([], [], ['state' => 'pending']), ['items', 1, 'price_not_accepted'], 'V: not accepted → refused');
    eq($iv([], [], ['value' => 3.6]), ['items', 1, 'price_not_accepted'], 'V: accepted at another price → refused');
    foreach (['built_in', 'default_rule', 'manual_recipe', 'history_recipe', 'history_manual', 'legacy_saved'] as $src) {
        eq($iv([], [], ['source' => $src]), ['items', 1, 'price_source_unsupported'], "V: price source $src → refused (QQ cannot know it exactly)");
    }
    eq($iv(['priceMode' => 'auto']), ['items', 1, 'price_source_unsupported'], 'V: source manual but priceMode auto → refused');
    eq($iv([], [], ['historyRef' => 'q:1']), ['items', 1, 'price_source_unsupported'], 'V: a history reference → refused');
}
