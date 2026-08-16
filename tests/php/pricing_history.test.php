<?php
/**
 * ── Pricing history: identity, accessories, ranking ────────────────────────
 * Phases 5, 6, 9, 10, 12.
 *
 * Run:  php tests/php/pricing_history.test.php
 *
 * pricing_history.php has no database, session or HTTP dependency, so the
 * rules that decide what counts as the same item — and what a bolt actually
 * cost once accessories are taken out of it — are exercised directly on the
 * item shapes the application saves.
 */

require_once __DIR__ . '/../../pricing_history.php';

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

/* The item shape pushItem saves. */
function item($over = []) {
    return array_merge([
        'itemType' => 'lbolt', 'productType' => 'L BOLT', 'desc' => '4140 QT FULLSIZE L BOLT',
        'material' => '4140', 'sizeType' => 'FULLSIZE', 'finish' => 'PL',
        'cleanSize' => 'M20', 'sizeCode' => 'M20',
        'size' => 'M20 x L 1000 x W 100 x TL 150mm',
        'dimensionPreview' => 'L 1000 x W 100 x TL 150mm',
        'qty' => 10, 'finalUnitPrice' => 30.00, 'totalAmount' => 300.00, 'markup' => 4,
        'weight' => 2.4662, 'accessories' => null, 'priceMode' => 'auto',
        'formData' => ['costRate' => '5.00', 'addCost' => '4.00', 'markup' => '4', 'priceMode' => 'auto'],
    ], $over);
}
function meta($id, $ref, $date, $customer, $companyId) {
    return ['quotationId'=>$id,'refNo'=>$ref,'date'=>$date,'customer'=>$customer,'companyId'=>$companyId];
}
/* The item being quoted today. */
$WANT = ['productType'=>'L BOLT','material'=>'4140','sizeType'=>'FULLSIZE','finish'=>'PL',
         'cleanSize'=>'M20','dimensionPreview'=>'L 1000 x W 100 x TL 150mm','companyId'=>7];
$M = meta(1, 'Q2026-0001', '2026-01-05', 'ADVANCE', 7);

// ── core identity must match exactly ────────────────────────────────────────
ok(dc_history_record(item(), $WANT, $M) !== null, 'the same specification is a match');

foreach ([
    ['cleanSize', 'M18',       'a smaller size'],
    ['cleanSize', 'M22',       'a larger size'],
    ['sizeType',  'UNDERSIZE', 'a different size type'],
    ['finish',    'ZP',        'zinc plated instead of plain'],
    ['finish',    'HDG',       'galvanised instead of plain'],
    ['material',  'MS',        'mild steel instead of 4140 QT'],
] as $case) {
    list($field, $value, $why) = $case;
    eq(dc_history_record(item([$field => $value]), $WANT, $M), null, 'never matched: ' . $why);
}
eq(dc_history_record(item(['productType'=>'SAG ROD','itemType'=>'sagrod']), $WANT, $M), null,
   'never matched: a Sag Rod is not an L Bolt');

/* Quantity is not identity. */
$q1 = dc_history_record(item(['qty' => 1]), $WANT, $M);
ok($q1 !== null, 'a historical quantity of 1 still matches a request for 250');
eq($q1['qty'], 1, 'and the quantity is reported as context');

/* Product spelling does not matter; the specification does. */
ok(dc_history_record(item(['productType'=>'lbolt']), $WANT, $M) !== null,
   'the internal product name and the printed one are the same product');

// ── dimensions RANK, they do not hide ───────────────────────────────────────
$exact  = dc_history_record(item(), $WANT, $M);
$other  = dc_history_record(item(['dimensionPreview'=>'L 500 x W 100 x TL 100mm']), $WANT, $M);
ok($other !== null, 'a different length is still the same item and is still shown');
eq($exact['exactDims'], true,  'the identical rod is marked exact');
eq($other['exactDims'], false, 'and the shorter one is marked as differing');
eq(dc_history_record(item(['dimensionPreview'=>'L1000 x W100 x TL150 mm']), $WANT, $M)['exactDims'], true,
   'spacing and punctuation do not make two identical rods different');

// ── whose price it is ───────────────────────────────────────────────────────
eq($exact['own'], true, 'this customer\'s own record is marked as theirs');
$stranger = dc_history_record(item(), $WANT, meta(9,'Q2025-0411','2025-04-11','Gamma Steel',9));
eq($stranger['own'], false, 'another customer\'s is not');
eq($stranger['customer'], 'Gamma Steel', 'and it names them');

// ── the numbers that explain the price ──────────────────────────────────────
eq($exact['costRate'], 5.00, 'the cost rate that produced it');
eq($exact['addCost'],  4.00, 'the additional cost');
eq($exact['markup'],   4.0,  'the markup');
eq($exact['unitPrice'], 30.00, 'and the unit price the customer was given');
eq($exact['refNo'], 'Q2026-0001', 'traceable to its quotation');
eq($exact['date'], '2026-01-05', 'and its date');

// ── accessories are a separate component ────────────────────────────────────
$withAcc = ['nut' => ['enabled'=>true,'qty'=>2,'unitPrice'=>0.30,'finish'=>'PL'],
            'fw'  => ['enabled'=>true,'qty'=>1,'unitPrice'=>0.10,'finish'=>'PL'],
            'custom' => ['enabled'=>false,'text'=>'','unitPrice'=>0]];
$auto = dc_history_record(item(['accessories'=>$withAcc,'finalUnitPrice'=>30.70,'priceMode'=>'auto']), $WANT, $M);
eq($auto['accessoryCost'], 0.7, 'two nuts and a washer are RM0.70 of accessories');
eq($auto['boltUnitPrice'], 30.0, 'and the bolt itself was RM30.00, not RM30.70');
eq($auto['unitPrice'], 30.70, 'the quotation line is still reported as it was sent');
eq($auto['accessoryAmbiguous'], false, 'the saved price mode says how it was priced');
eq($auto['accessorySummary'], '2 Nut PL + 1 FW PL', 'and the wording is shown');

$manual = dc_history_record(item(['accessories'=>$withAcc,'finalUnitPrice'=>30.00,'priceMode'=>'manual']), $WANT, $M);
eq($manual['boltUnitPrice'], 30.0,
   'a manual price replaced the calculation and added no accessory charge, so the bolt price is the whole of it');
eq($manual['accessoryCost'], 0.7, 'the accessories are still reported separately');

$ambiguous = dc_history_record(item(['accessories'=>$withAcc,'finalUnitPrice'=>30.70,
                                     'priceMode'=>null,'formData'=>['costRate'=>'5.00']]), $WANT, $M);
eq($ambiguous['boltUnitPrice'], null,
   'an old record that does not say how it was priced gets NO invented separation');
eq($ambiguous['accessoryAmbiguous'], true, 'it is labelled ambiguous instead');
eq($ambiguous['unitPrice'], 30.70, 'and its quotation line is reported as it stands');

$none = dc_history_record(item(['accessories'=>null]), $WANT, $M);
eq($none['boltUnitPrice'], 30.0, 'a bolt with no accessories is its own price');
eq($none['accessoryCost'], 0.0, 'with nothing beside it');
eq($none['accessorySummary'], '', 'and no wording');

// ── a legacy item, read from its description ────────────────────────────────
$legacy = dc_history_record([
    'desc' => '4140 FULLSIZE L BOLT', 'size' => 'M20 x L 1000 x W 100 x TL 150mm',
    'finish' => 'PL', 'qty' => 5, 'finalUnitPrice' => 28.00,
], $WANT, $M);
ok($legacy !== null, 'an item saved before the normalised fields existed is still found');
eq($legacy['legacy'], true, 'and is marked as legacy');
eq($legacy['cleanSize'], 'M20', 'its size read out of the label');
eq($legacy['exactDims'], true, 'its dimensions read out of the same label');
eq($legacy['costRate'], null, 'with no cost rate to report — it was never saved');
eq(dc_history_record(['desc'=>'', 'size'=>''], $WANT, $M), null,
   'an item that cannot be identified is skipped, never guessed at');
eq(dc_history_record(['desc'=>'4140 FULLSIZE L BOLT','size'=>'M18 x L 1000'], $WANT, $M), null,
   'and a legacy M18 is still not an M20');

// ── reading order ───────────────────────────────────────────────────────────
$rows = [
    dc_history_record(item(['dimensionPreview'=>'L 500 x W 100 x TL 100mm']),  $WANT, meta(4,'Q-C','2026-03-01','Gamma Steel',9)),
    dc_history_record(item(),                                                   $WANT, meta(3,'Q-B','2025-01-01','Gamma Steel',9)),
    dc_history_record(item(['dimensionPreview'=>'L 500 x W 100 x TL 100mm']),  $WANT, meta(2,'Q-D','2026-06-01','ADVANCE',7)),
    dc_history_record(item(),                                                   $WANT, meta(1,'Q-A','2024-01-01','ADVANCE',7)),
    dc_history_record(item(),                                                   $WANT, meta(5,'Q-E','2026-09-01','ADVANCE',7)),
];
dc_history_sort($rows);
$order = array_map(function ($r) { return $r['refNo']; }, $rows);
eq(implode(',', $order), 'Q-E,Q-A,Q-D,Q-B,Q-C', implode("\n", [
    'reading order: this customer exact first (newest first), then this customer with',
    '      different dimensions, then another customer exact, then another customer different',
]));

// ── dimension closeness: core identity first, then the nearest rod ─────────
/* The rule the business stated: an M20 x L600 is compared with M20s, and the
   closest M20 wins. An M24 at exactly L600 is not a candidate at all. */
$L600 = ['productType'=>'L BOLT','material'=>'4140','sizeType'=>'FULLSIZE','finish'=>'PL',
         'cleanSize'=>'M20','dimensionPreview'=>'L 600 x W 100 x TL 150mm','companyId'=>7];
$near = function ($dims) use ($L600, $M) {
    return dc_history_record(item(['dimensionPreview'=>$dims]), $L600, $M);
};
eq($near('L 600 x W 100 x TL 150mm')['dimDistance'], 0.0, 'the identical rod is a distance of zero');
eq($near('L 500 x W 100 x TL 150mm')['dimDistance'], 100.0, 'a 500mm rod is 100 away from a 600mm one');
eq($near('L 1000 x W 100 x TL 150mm')['dimDistance'], 400.0, 'a 1000mm rod is 400 away');
eq($near('L 1200 x W 100 x TL 150mm')['dimDistance'], 600.0, 'and a 1200mm rod is 600 away');
eq($near('L 500 x W 100 x TL 100mm')['dimDistance'], 150.0,
   'a shorter thread counts as much as a shorter rod — 100 of length and 50 of thread');
eq($near('L 1000 x W 200 x TL 250mm')['dimDistance'], 600.0,
   'and every dimension the product uses is counted: 400 + 100 + 100');
eq($near('L 600 x W 100 x TL 150mm')['exactDims'], true, 'a distance of zero is an exact match');
eq($near('L 601 x W 100 x TL 150mm')['exactDims'], false, 'one millimetre is not');

/* A thread written as a pair is read as both of its ends. */
$pair = ['productType'=>'SAG ROD','material'=>'MS','sizeType'=>'FULLSIZE','finish'=>'PL',
         'cleanSize'=>'M20','dimensionPreview'=>'L 1000 x TL 100/100mm','companyId'=>7];
$pairRec = function ($dims) use ($pair, $M) {
    return dc_history_record(item(['productType'=>'SAG ROD','itemType'=>'sagrod','material'=>'MS',
                                   'desc'=>'MS FULLSIZE SAG ROD','dimensionPreview'=>$dims]), $pair, $M);
};
eq($pairRec('L 1000 x TL 100/100mm')['dimDistance'], 0.0, 'the same pair of thread ends is exact');
eq($pairRec('L 1000 x TL 100/50mm')['dimDistance'], 50.0, 'a shorter second end is 50 away, not zero');
eq($pairRec('L 900 x TL 100/100mm')['dimDistance'], 100.0, 'and the length still counts');

/* Nothing measurable on one side is unknown, not close. */
eq($near('')['dimDistance'], null, 'a record with no dimensions has no distance');
eq(dc_history_record(item(), ['productType'=>'L BOLT','material'=>'4140','sizeType'=>'FULLSIZE',
                             'finish'=>'PL','cleanSize'=>'M20','dimensionPreview'=>'','companyId'=>7],
                     $M)['dimDistance'], null,
   'and neither does an item being quoted with none');

// ── reading order: this customer, then the nearest rod ─────────────────────
$ranked = [
    dc_history_record(item(['dimensionPreview'=>'L 600 x W 100 x TL 150mm']), $L600, meta(1,'OTHER-EXACT','2026-09-09','Gamma Steel',9)),
    dc_history_record(item(['dimensionPreview'=>'L 1200 x W 100 x TL 150mm']), $L600, meta(2,'OWN-1200','2026-01-01','ADVANCE',7)),
    dc_history_record(item(['dimensionPreview'=>'L 500 x W 100 x TL 150mm']),  $L600, meta(3,'OWN-500','2025-01-01','ADVANCE',7)),
    dc_history_record(item(['dimensionPreview'=>'L 1000 x W 100 x TL 150mm']), $L600, meta(4,'OWN-1000','2026-06-06','ADVANCE',7)),
    dc_history_record(item(['dimensionPreview'=>'L 600 x W 100 x TL 150mm']),  $L600, meta(5,'OWN-EXACT','2024-01-01','ADVANCE',7)),
    dc_history_record(item(['dimensionPreview'=>'L 1000 x W 100 x TL 150mm']), $L600, meta(6,'OTHER-1000','2026-12-12','Gamma Steel',9)),
];
dc_history_sort($ranked);
eq(implode(',', array_map(function ($r) { return $r['refNo']; }, $ranked)),
   'OWN-EXACT,OWN-500,OWN-1000,OWN-1200,OTHER-EXACT,OTHER-1000',
   implode("\n", [
     'reading order: every one of this customer\'s records first, nearest rod first within',
     '      them, and only then anybody else\'s - a stranger\'s exact match never buries the',
     '      history of the customer being quoted',
   ]));

// ── an accessory charge that was recorded separately needs no working out ──
$sep = dc_history_record(item(['accessories'=>$withAcc,'finalUnitPrice'=>30.00,
                               'accessoryUnitPrice'=>0.70,'pricingModel'=>'bolt-separate',
                               'lineUnitPrice'=>30.70,'priceMode'=>'auto']), $WANT, $M);
eq($sep['boltUnitPrice'], 30.0, 'a separated record reports the bolt price as it was saved');
eq($sep['accessoryCost'], 0.7, 'and the accessory charge as it was saved');
eq($sep['accessoryAmbiguous'], false, 'with nothing left ambiguous');
eq($sep['unitPrice'], 30.0, 'the bolt price IS the item price now — accessories are not inside it');

// ── how the price was arrived at, in the words the screen uses ─────────────
eq(dc_history_record(item(['priceMode'=>'auto']), $WANT, $M)['priceModeLabel'], 'Auto Round', 'auto round is named');
eq(dc_history_record(item(['priceMode'=>'no_round']), $WANT, $M)['priceModeLabel'], 'No Round', 'no round is named');
eq(dc_history_record(item(['priceMode'=>'manual']), $WANT, $M)['priceModeLabel'], 'Manual', 'a manual price is named');
eq(dc_history_record(item(['priceMode'=>'','formData'=>[]]), $WANT, $M)['priceModeLabel'], 'Legacy / Unknown',
   'and a record that never said is called unknown, not called Auto Round');

// ── the prefilter needle matches how the size was written ───────────────────
eq(dc_history_needle('M20'), '"cleanSize":"M20"', 'a metric size needle');
eq(dc_history_needle('1/2'), '"cleanSize":"1\\/2"',
   'an inch size needle escapes the slash exactly as json_encode wrote it');
$saved = json_encode(['cleanSize' => '1/2']);
ok(strpos($saved, dc_history_needle('1/2')) !== false,
   'so the needle is found inside a real saved row: ' . $saved);
$savedM = json_encode(item(['cleanSize' => 'M20']));
ok(strpos($savedM, dc_history_needle('M20')) !== false, 'and inside a metric one');
ok(strpos($savedM, dc_history_needle('M2')) === false,
   'while M2 does not match an M20 row — the needle carries the closing quote');


// ── stainless is quoted without a finish, and identity has to agree ─────────
/* The browser asks for a stainless specification with finish '' — that is the
   rule. A record SAVED before the rule held everywhere carries PL or HDG, and
   comparing the two literally made a real previous price invisible to the very
   item it belonged to, while that same item still printed "(HDG)". */
$SS_WANT = ['productType'=>'SAG ROD','material'=>'SS304','sizeType'=>'FULLSIZE','finish'=>'',
            'cleanSize'=>'M16','dimensionPreview'=>'L 300 x TL 50/50mm','companyId'=>7];
function ssItem($finish, $material = 'SS304') {
    return item(['itemType'=>'sagrod','productType'=>'SAG ROD','material'=>$material,
                 'sizeType'=>'FULLSIZE','finish'=>$finish,'cleanSize'=>'M16','sizeCode'=>'M16',
                 'size'=>'M16 x L 300 x TL 50/50mm','dimensionPreview'=>'L 300 x TL 50/50mm',
                 'desc'=>'SS304 FULLSIZE SAG ROD']);
}
foreach (['', 'PL', 'HDG', 'ZP', 'Plain'] as $stored) {
    $r = dc_history_record(ssItem($stored), $SS_WANT, $M);
    ok($r !== null, "an SS304 record stored with finish " . var_export($stored, true) . " is still the same item");
    if ($r !== null) eq($r['finish'], '', "and it reports no finish");
}
$want316 = array_merge($SS_WANT, ['material'=>'SS316']);
ok(dc_history_record(ssItem('HDG', 'SS316'), $want316, $M) !== null,
   'SS316 follows the same rule');
/* The rule keys on the CANONICAL stored code, exactly as DC_NO_FINISH_MATERIALS
   does in the browser. Source spellings — SUS316, A4-70 — are mapped to that
   code before an item is ever saved, so they never reach this comparison, and
   the server does not carry a second copy of that vocabulary. */
eq(dc_finish_for('SUS316', 'HDG'), 'HDG',
   'a source spelling is not a stored material code, and is left alone here');
/* And the rule reaches no further than stainless. */
$MS_WANT = array_merge($SS_WANT, ['material'=>'MS','finish'=>'HDG']);
ok(dc_history_record(ssItem('HDG','MS'), $MS_WANT, $M) !== null,
   'a mild steel record still matches on its finish');
ok(dc_history_record(ssItem('PL','MS'), $MS_WANT, $M) === null,
   'and a mild steel PL is still not a mild steel HDG');
eq(dc_finish_for('SS304', 'HDG'), '', 'dc_finish_for takes the finish off SS304');
eq(dc_finish_for('SS316', 'ZP'),  '', 'and off SS316');
eq(dc_finish_for('MS', 'HDG'), 'HDG', 'and leaves every other material alone');
eq(dc_finish_for('4140', 'PL'), 'PL', 'including 4140 QT');

// ── report ──────────────────────────────────────────────────────────────────
echo "  " . (count($failures) ? 'FAIL' : 'ok  ')
   . "  pricing history — identity, accessories, ranking  ($asserts assertions"
   . (count($failures) ? ', ' . count($failures) . ' failed' : '') . ")\n";
foreach ($failures as $f) echo "   - $f\n";
exit(count($failures) ? 1 : 0);
