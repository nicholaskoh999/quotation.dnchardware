<?php
/**
 * R0b — pricing-history matching / ranking characterisation.
 *
 * Runs the SHIPPED pricing_history.php (DB-free) over a fixed set of saved
 * items and prints the golden as JSON on stdout. Called by run.js; never
 * touches a database.
 *
 * What it pins: which records are the same item (exact product · material ·
 * size type · clean size; finish kept-but-flagged), the bolt / line / accessory
 * split for each pricing vintage, and the ranking order
 * (same customer → exact finish → nearest dimensions → newest date → newest id).
 */
require_once __DIR__ . '/../../pricing_history.php';

function item($over = []) {
    return array_merge([
        'itemType' => 'sagrod', 'productType' => 'SAG ROD', 'desc' => 'MS UNDERSIZE SAG ROD',
        'material' => 'MS', 'sizeType' => 'UNDERSIZE', 'finish' => 'ZP',
        'cleanSize' => 'M12', 'sizeCode' => 'M12',
        'size' => 'M12 x L 1000 x TL 100/100mm', 'dimensionPreview' => 'L 1000 x TL 100/100mm',
        'qty' => 10, 'finalUnitPrice' => 2.50, 'totalAmount' => 25.00, 'markup' => 0,
        'weight' => 0.6928, 'accessories' => null, 'priceMode' => 'auto',
        'formData' => ['costRate' => '4.20', 'addCost' => '0.60', 'markup' => '0', 'priceMode' => 'auto'],
    ], $over);
}
function meta($id, $date, $companyId, $customer) {
    return ['quotationId' => $id, 'refNo' => sprintf('Q-%s-%04d', substr($date, 0, 4), $id),
            'date' => $date, 'customer' => $customer, 'companyId' => $companyId];
}

$want = ['productType' => 'SAG ROD', 'material' => 'MS', 'sizeType' => 'UNDERSIZE', 'finish' => 'ZP',
         'cleanSize' => 'M12', 'dimensionPreview' => 'L 1000 x TL 100/100mm', 'companyId' => 7];

$records = [
    ['label' => 'other customer, exact dims, newest',  'item' => item(),                                         'meta' => meta(310, '2026-10-01', 9, 'OTHER CO')],
    ['label' => 'same customer, exact dims, older',    'item' => item(['finalUnitPrice' => 2.40]),               'meta' => meta(120, '2026-03-01', 7, 'ACME')],
    ['label' => 'same customer, L1200, newer',          'item' => item(['dimensionPreview' => 'L 1200 x TL 100/100mm', 'finalUnitPrice' => 2.90]), 'meta' => meta(200, '2026-06-01', 7, 'ACME')],
    ['label' => 'same customer, PL finish (flagged)',   'item' => item(['finish' => 'PL', 'finalUnitPrice' => 2.00]), 'meta' => meta(250, '2026-08-01', 7, 'ACME')],
    ['label' => 'same customer, exact dims, same date, higher id', 'item' => item(['finalUnitPrice' => 2.45]),  'meta' => meta(121, '2026-03-01', 7, 'ACME')],
    ['label' => 'M10 — must NOT match M12',             'item' => item(['cleanSize' => 'M10']),                   'meta' => meta(400, '2026-10-02', 7, 'ACME')],
    ['label' => 'FULLSIZE — must NOT match UNDERSIZE',  'item' => item(['sizeType' => 'FULLSIZE']),               'meta' => meta(401, '2026-10-02', 7, 'ACME')],
    ['label' => '4140 — must NOT match MS',             'item' => item(['material' => '4140']),                   'meta' => meta(402, '2026-10-02', 7, 'ACME')],
    ['label' => 'qty differs — qty is not identity',    'item' => item(['qty' => 999]),                           'meta' => meta(130, '2026-04-01', 7, 'ACME')],
    ['label' => 'accessory-inclusive with nuts',        'item' => item(['finalUnitPrice' => 3.50, 'boltUnitPrice' => 2.50, 'accessoryUnitPrice' => 1.00,
        'pricingModel' => 'accessory-inclusive', 'accessories' => ['nut' => ['enabled' => true, 'qty' => 2, 'unitPrice' => 0.5]]]), 'meta' => meta(140, '2026-05-01', 9, 'OTHER CO')],
    ['label' => 'bolt-separate vintage with nuts',      'item' => item(['finalUnitPrice' => 2.50, 'accessoryUnitPrice' => 1.00, 'lineUnitPrice' => 3.50,
        'pricingModel' => 'bolt-separate', 'accessories' => ['nut' => ['enabled' => true, 'qty' => 2, 'unitPrice' => 0.5]]]), 'meta' => meta(141, '2026-05-02', 9, 'OTHER CO')],
    ['label' => 'legacy vintage, accessories, no mode (ambiguous)', 'item' => item(['finalUnitPrice' => 3.50, 'priceMode' => null, 'formData' => [],
        'accessories' => ['nut' => ['enabled' => true, 'qty' => 2, 'unitPrice' => 0.5]]]), 'meta' => meta(142, '2026-05-03', 9, 'OTHER CO')],
    ['label' => 'legacy description-only item',         'item' => ['desc' => 'MS UNDERSIZE SAG ROD (ZP)', 'size' => 'M12 x L 1000 x TL 100/100mm',
        'qty' => 5, 'finalUnitPrice' => 2.20, 'finish' => 'ZP'],                                                  'meta' => meta(50, '2025-11-01', 7, 'ACME')],
];

$matched = [];
$perRecord = [];
foreach ($records as $r) {
    $rec = dc_history_record($r['item'], $want, $r['meta']);
    $perRecord[] = ['label' => $r['label'], 'quotationId' => $r['meta']['quotationId'], 'matched' => $rec !== null,
        'result' => $rec === null ? null : array_intersect_key($rec, array_flip([
            'own', 'finishMatch', 'exactDims', 'dimDistance', 'lineUnitPrice', 'boltUnitPrice', 'accessoryCost',
            'accessoryAmbiguous', 'priceModeLabel', 'costRate', 'addCost', 'markup', 'legacy']))];
    if ($rec !== null) $matched[] = $rec;
}
dc_history_sort($matched);

$like = [];
foreach (['M12', '1/2', '1-1/4'] as $s) {
    $blob = json_encode([['cleanSize' => $s]]);
    $like[] = ['cleanSize' => $s, 'storedBlob' => $blob, 'prefilterMatches' => dc_history_blob_matches($blob, ['cleanSize' => $s])];
}

$out = [
    ['topic' => 'record matching + pricing vintage split', 'want' => $want, 'cls' => 'A',
     'legacy' => $perRecord, 'expected' => $perRecord,
     'note' => 'identity: product, material, size type, exact clean size (M12 never matches M10/M14); finish mismatch kept but flagged; qty is not identity.'],
    ['topic' => 'ranking order', 'cls' => 'A',
     'legacy' => array_map(function ($r) { return $r['quotationId']; }, $matched),
     'expected' => array_map(function ($r) { return $r['quotationId']; }, $matched),
     'note' => 'same customer first; then exact finish before flagged finish; then nearest dimensions; then newest date; then highest quotation id. §23 adds product/material/size-type/size keys — those are identity filters here, so the order is consistent with §23.'],
    ['topic' => 'imperial LIKE prefilter (json-escaped slash)', 'cls' => 'A', 'legacy' => $like, 'expected' => $like],
    ['topic' => 'reference-number format', 'cls' => 'A',
     'legacy' => ['format' => "sprintf('Q-%s-%04d', date('Y'), MAX+1)", 'timezone' => 'Asia/Kuala_Lumpur',
        'samples' => [sprintf('Q-%s-%04d', '2026', 1), sprintf('Q-%s-%04d', '2026', 1317), sprintf('Q-%s-%04d', '2026', 10000)]],
     'expected' => null, 'note' => 'write path (GET_LOCK, READ COMMITTED create, one 1062 retry, item_uid, revisions, no-op suppression) is pinned by tests/php/{save_retry,item_identity,transaction_foundation,revision_writer,noop_suppression}.test.php — not re-implemented here.'],
];
$out[3]['expected'] = $out[3]['legacy'];
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
