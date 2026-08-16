<?php
/**
 * The live failure, reproduced at the layer it happened on.
 *
 * Q-2026-0470 holds a 1/2" MS UNDERSIZE sag rod. Asked for that rod today, the
 * endpoint answered "No pricing history for this exact specification". This
 * prints, from the real functions, exactly what the database was asked for and
 * whether the stored row could ever have answered — plus the metric control
 * that always worked, and the wildcard sizes that must never leak.
 *
 * Run against HEAD it fails; run against the fix it passes. No fixtures, no
 * stubs: the blob below is what json_encode writes when that quotation is
 * saved, produced by json_encode itself two lines down.
 */
require_once __DIR__ . '/../../pricing_history.php';

/* Exactly what api.php stores in quotations.items for Q-2026-0470. */
$items = [
    ['type' => 'sagrod', 'productType' => 'SAG ROD', 'material' => 'MS',
     'sizeType' => 'UNDERSIZE', 'finish' => 'PL', 'size' => '1/2', 'cleanSize' => '1/2',
     'desc' => "MS UNDERSIZE SAG ROD (PL)\nM 1/2 x L 980 x TL 100/100mm",
     'size' => 'M 1/2 x L 980 x TL 100/100mm', 'dimensionPreview' => 'L 980 x TL 100/100mm',
     'qty' => 20, 'finalUnitPrice' => 11.20, 'totalAmount' => 224.00, 'markup' => 6,
     'weight' => 0.7179, 'accessories' => null, 'priceMode' => 'auto',
     'formData' => ['costRate' => '5.00', 'addCost' => '2.00', 'markup' => '6', 'priceMode' => 'auto']],
    ['type' => 'sagrod', 'productType' => 'SAG ROD', 'material' => 'MS',
     'sizeType' => 'UNDERSIZE', 'finish' => 'PL', 'size' => '1/2', 'cleanSize' => '1/2',
     'desc' => "MS UNDERSIZE SAG ROD (PL)\nM 1/2 x L 1080 x TL 100/100mm",
     'size' => 'M 1/2 x L 1080 x TL 100/100mm', 'dimensionPreview' => 'L 1080 x TL 100/100mm',
     'qty' => 20, 'finalUnitPrice' => 12.30, 'totalAmount' => 246.00, 'markup' => 6,
     'weight' => 0.7912, 'accessories' => null, 'priceMode' => 'auto',
     'formData' => ['costRate' => '5.00', 'addCost' => '2.00', 'markup' => '6', 'priceMode' => 'auto']],
];
$blob = json_encode($items);

$want = ['productType' => 'SAG ROD', 'material' => 'MS', 'sizeType' => 'UNDERSIZE',
         'finish' => 'ZP', 'cleanSize' => '1/2',
         'dimensionPreview' => 'L 1020 x TL 100/100mm'];

$fail = 0;
function line($s = '') { echo $s, "\n"; }
function check($ok, $what) { global $fail; if (!$ok) $fail++; line(($ok ? '  ok    ' : '  FAIL  ') . $what); }

line('── what the database actually stores ─────────────────────────────────────');
line('  ' . substr($blob, 0, 118) . ' …');
line('  the size, as stored:  ' . substr($blob, strpos($blob, '"cleanSize"'), 22));
line();

line('── what the endpoint asks it for ─────────────────────────────────────────');
list($sql, $params) = dc_history_sql_where($want);
line('  WHERE ' . $sql);
foreach ($params as $i => $p) line('    $' . ($i + 1) . ' = ' . $p);
line();

line('── could that query ever return this row? (MySQL LIKE semantics) ─────────');
foreach ($params as $i => $p) {
    line(sprintf('    pattern %d -> %s', $i + 1, dc_like_matches($blob, $p) ? 'MATCHES' : 'no match'));
}
check(dc_history_blob_matches($blob, $want), 'the half-inch row is reachable at all');
line();

line('── the metric control, which never failed ────────────────────────────────');
$m16 = json_encode([['type' => 'sagrod', 'productType' => 'SAG ROD', 'material' => 'MS',
    'sizeType' => 'FULLSIZE', 'finish' => 'ZP', 'size' => 'M16', 'cleanSize' => 'M16',
    'desc' => "MS FULLSIZE SAG ROD (ZP)\nM M16 x L 980 x TL 100/100mm", 'qty' => 20,
    'finalUnitPrice' => 9.10, 'markup' => 6, 'priceMode' => 'auto', 'weight' => 1.5]]);
$wantM16 = ['productType' => 'SAG ROD', 'material' => 'MS', 'sizeType' => 'FULLSIZE',
            'finish' => 'ZP', 'cleanSize' => 'M16', 'dimensionPreview' => 'L 1020 x TL 100/100mm'];
check(dc_history_blob_matches($m16, $wantM16), 'a metric row is reachable');
check(!dc_history_blob_matches($blob, $wantM16), 'and an M16 enquiry does not reach the half-inch row');
check(!dc_history_blob_matches($m16, $want), 'nor a half-inch enquiry the M16 row');
line();

line('── every imperial size the business quotes ───────────────────────────────');
foreach (['1/2', '3/8', '5/8', '3/4', '7/8', '1-1/4', '1-1/2'] as $sz) {
    $b = json_encode([['cleanSize' => $sz, 'productType' => 'SAG ROD']]);
    $w = ['productType' => 'SAG ROD', 'material' => 'MS', 'sizeType' => 'UNDERSIZE',
          'finish' => 'ZP', 'cleanSize' => $sz, 'dimensionPreview' => ''];
    check(dc_history_blob_matches($b, $w), sprintf('%-6s is reachable', $sz));
}
line();

line('── a size is text to find, never a pattern ───────────────────────────────');
$other = json_encode([['cleanSize' => 'M16', 'productType' => 'SAG ROD']]);
foreach (['%' => 'a bare %% must not match every quotation ever saved',
          'M_6' => 'an underscore must not stand in for a digit'] as $sz => $what) {
    $w = ['productType' => 'SAG ROD', 'material' => 'MS', 'sizeType' => 'FULLSIZE',
          'finish' => 'ZP', 'cleanSize' => $sz, 'dimensionPreview' => ''];
    check(!dc_history_blob_matches($other, $w), $what);
}
line();

line('── and what the row is then given ────────────────────────────────────────');
$meta = ['quotationId' => 1, 'refNo' => 'Q-2026-0470', 'date' => '2026-01-20',
         'customer' => 'Alpha Sdn Bhd', 'companyId' => 7];
$out = [];
foreach ($items as $it) { $r = dc_history_record($it, $want, $meta); if ($r) $out[] = $r; }
dc_history_sort($out);
check(count($out) === 2, 'both earlier quotations of the same rod are returned');
foreach ($out as $r) {
    line(sprintf('    %s  %s  %s  finishMatch=%s  dimDistance=%s  RM %s',
        $r['refNo'], $r['cleanSize'], $r['dimensionPreview'],
        $r['finishMatch'] ? 'true' : 'false', $r['dimDistance'], $r['unitPrice']));
}
if (count($out) === 2) {
    check($out[0]['dimDistance'] == 40 && $out[1]['dimDistance'] == 60,
        'the nearer length ranks first: L980 is 40 from L1020, L1080 is 60');
    check($out[0]['finishMatch'] === false && $out[1]['finishMatch'] === false,
        'both are flagged as a different finish — quoted PL, asked for in ZP');
}
line();
line($fail ? "  $fail FAILED" : '  all checks passed');
exit($fail ? 1 : 0);
