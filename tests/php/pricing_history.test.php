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
    ['material',  'MS',        'mild steel instead of 4140 QT'],
] as $case) {
    list($field, $value, $why) = $case;
    eq(dc_history_record(item([$field => $value]), $WANT, $M), null, 'never matched: ' . $why);
}
/* A COATING is the one identity field that admits a reference. The same rod in
   another finish is the same rod, and hiding it reported "no previous price"
   for an item that had been quoted twice. It is kept and flagged, never
   silently treated as the same specification. */
foreach ([['ZP', 'zinc plated instead of plain'], ['HDG', 'galvanised instead of plain']] as $case) {
    list($value, $why) = $case;
    $ref = dc_history_record(item(['finish' => $value]), $WANT, $M);
    ok($ref !== null, 'kept as a reference: ' . $why);
    if ($ref !== null) {
        eq($ref['finishMatch'], false, "and flagged as a different finish: $why");
        eq($ref['finish'], $value, 'reporting the finish it actually was');
    }
}
$exact = dc_history_record(item(), $WANT, $M);
eq($exact['finishMatch'], true, 'while the same finish is an exact match');
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
eq($none['lineUnitPrice'], 30.0, 'and its line is that same figure, whichever rule it was saved under');

/* A legacy record's single figure already WAS the customer's line, which is
   what the current rule asks for — so it needs no adjustment, and its
   accessory share stays unknowable rather than being guessed at. */
eq($ambiguous['lineUnitPrice'], 30.70,
   'a legacy record\'s line is the figure it was saved with, accessories already inside it');

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

// ── three vintages of saved item, and one answer each ─────────────────────
/* Stage 0B. The customer is quoted ONE inclusive figure and the bolt component
   is kept beside it — so the screen can show what the line came to while the
   reuse button reuses the bolt. A record that confused the two would quote a
   rod at the price of a rod plus somebody else's nuts, and would do it again,
   larger, every time it were reused. */

// the current rule: finalUnitPrice IS the customer's price, boltUnitPrice beside it
$inc = dc_history_record(item(['accessories'=>$withAcc,'finalUnitPrice'=>30.70,
                               'boltUnitPrice'=>30.00,'accessoryUnitPrice'=>0.70,
                               'pricingModel'=>'accessory-inclusive',
                               'lineUnitPrice'=>30.70,'priceMode'=>'auto']), $WANT, $M);
eq($inc['boltUnitPrice'], 30.0, 'an inclusive record reports the bolt component as it was saved');
eq($inc['accessoryCost'], 0.7, 'and the accessory total as it was saved');
eq($inc['lineUnitPrice'], 30.70, 'its line IS its saved figure — RM30.70 is what the customer paid');
eq($inc['unitPrice'], 30.70, 'and the unit price it reports is that same inclusive figure');
eq($inc['accessoryAmbiguous'], false, 'with nothing left ambiguous');
eq($inc['accessorySummary'], '2 Nut PL + 1 FW PL', 'and the wording is shown');

// an inclusive record written before boltUnitPrice was stored: derived, exactly
$incOld = dc_history_record(item(['accessories'=>$withAcc,'finalUnitPrice'=>30.70,
                                  'accessoryUnitPrice'=>0.70,
                                  'pricingModel'=>'accessory-inclusive',
                                  'priceMode'=>'auto']), $WANT, $M);
eq($incOld['boltUnitPrice'], 30.0,
   'without a stored bolt component it is derived by subtraction, which is exact because the accessory figure beside it is');
eq($incOld['lineUnitPrice'], 30.70, 'and its line is still the figure it was saved with');

// the superseded rule: finalUnitPrice was the BOLT, the line was the two added
$sep = dc_history_record(item(['accessories'=>$withAcc,'finalUnitPrice'=>30.00,
                               'accessoryUnitPrice'=>0.70,'pricingModel'=>'bolt-separate',
                               'lineUnitPrice'=>30.70,'priceMode'=>'auto']), $WANT, $M);
eq($sep['boltUnitPrice'], 30.0, 'a bolt-separate record reports the bolt price as it was saved');
eq($sep['accessoryCost'], 0.7, 'and the accessory charge as it was saved');
eq($sep['accessoryAmbiguous'], false, 'with nothing left ambiguous');
eq($sep['lineUnitPrice'], 30.70,
   'its LINE is the bolt plus its accessories — the RM30.70 the customer was actually charged');
eq($sep['unitPrice'], 30.0, 'while the figure it stored under finalUnitPrice was the bolt, and is reported as that');

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
$msRef = dc_history_record(ssItem('PL','MS'), $MS_WANT, $M);
ok($msRef !== null, 'a mild steel PL record is a reference for a mild steel HDG item');
if ($msRef !== null) eq($msRef['finishMatch'], false, 'flagged as the different finish it is');
eq(dc_finish_for('SS304', 'HDG'), '', 'dc_finish_for takes the finish off SS304');
eq(dc_finish_for('SS316', 'ZP'),  '', 'and off SS316');
eq(dc_finish_for('MS', 'HDG'), 'HDG', 'and leaves every other material alone');
eq(dc_finish_for('4140', 'PL'), 'PL', 'including 4140 QT');

// ── a legacy record whose material label has a space in it ─────────────────
/* "Previous price does not come out." A quotation saved before the normalised
   fields existed carries its specification only in the printed description,
   and dc_legacy_item reads it back with

       ^(\S+)\s+(FULLSIZE|UNDERSIZE)\s+(.+)$

   — one non-space token for the material. But buildDesc writes the material's
   LABEL, and two of the four canonical materials are two words: "4140 QT" and
   "4340 QT". So "4140 QT FULLSIZE SAG ROD" put "4140" where the pattern then
   demanded FULLSIZE, found "QT", and matched nothing at all: the record was
   dropped without a trace. Every legacy 4140 QT and 4340 QT line in the
   database was invisible to its own specification. */
function legacyItem($desc, $size, $extra = []) {
    /* Exactly the shape of a pre-normalisation item: a description, a printed
       size label, a price — and none of the normalised identity fields. */
    return array_merge([
        'itemType' => 'sagrod', 'desc' => $desc, 'size' => $size,
        'qty' => 10, 'finalUnitPrice' => 12.00, 'totalAmount' => 120.00,
        'markup' => 4, 'weight' => 0.4735,
    ], $extra);
}
$LEG_WANT = ['productType'=>'SAG ROD','material'=>'4140','sizeType'=>'FULLSIZE','finish'=>'',
             'cleanSize'=>'M16','dimensionPreview'=>'L 300 x TL 50/50mm','companyId'=>7];

$r = dc_history_record(legacyItem('4140 QT FULLSIZE SAG ROD', 'M16 x L 300 x TL 50/50mm'),
                       $LEG_WANT, $M);
ok($r !== null, 'a legacy 4140 QT record is found by a 4140 QT specification');
if ($r !== null) {
    eq($r['material'], '4140', 'and reports the canonical material code, not the printed label');
    eq($r['cleanSize'], 'M16', 'with its size read out of the printed label');
    eq($r['legacy'], true, 'marked as the legacy record it is');
}
$r = dc_history_record(legacyItem('4340 QT FULLSIZE SAG ROD', 'M16 x L 300 x TL 50/50mm'),
                       array_merge($LEG_WANT, ['material'=>'4340']), $M);
ok($r !== null, 'and a legacy 4340 QT record by a 4340 QT specification');
$r = dc_history_record(legacyItem('Y BAR FULLSIZE SAG ROD', 'M16 x L 300 x TL 50/50mm'),
                       array_merge($LEG_WANT, ['material'=>'Y_BAR']), $M);
ok($r !== null, 'and a legacy Y BAR record');
$r = dc_history_record(legacyItem('4140 QT + HARDEN = G10.9 FULLSIZE SAG ROD', 'M16 x L 300 x TL 50/50mm'),
                       array_merge($LEG_WANT, ['material'=>'4140_HARDEN_G10_9']), $M);
ok($r !== null, 'and one whose material label is a whole sentence');
/* One-word labels must not break on the way. */
$r = dc_history_record(legacyItem('MS FULLSIZE SAG ROD', 'M16 x L 300 x TL 50/50mm'),
                       array_merge($LEG_WANT, ['material'=>'MS']), $M);
ok($r !== null, 'a legacy MS record still reads as it always did');

// ── and the four canonical materials are still four ────────────────────────
/* Finding more records must never mean finding the wrong ones. */
foreach ([['4140','4340 QT FULLSIZE SAG ROD'], ['4340','4140 QT FULLSIZE SAG ROD'],
          ['4140','SS304 FULLSIZE SAG ROD'],   ['SS304','4140 QT FULLSIZE SAG ROD'],
          ['SS304','SS316 FULLSIZE SAG ROD'],  ['SS316','SS304 FULLSIZE SAG ROD'],
          ['4140','MS FULLSIZE SAG ROD']] as $pair) {
    list($want, $desc) = $pair;
    ok(dc_history_record(legacyItem($desc, 'M16 x L 300 x TL 50/50mm'),
                         array_merge($LEG_WANT, ['material'=>$want]), $M) === null,
       "a $want specification does not match a legacy \"$desc\"");
}
/* The same, on normalised records. */
foreach ([['4140','4340'], ['4340','4140'], ['4140','SS304'], ['SS304','4140'],
          ['SS304','SS316'], ['SS316','SS304']] as $pair) {
    list($want, $stored) = $pair;
    ok(dc_history_record(ssItem('', $stored), array_merge($SS_WANT, ['material'=>$want]), $M) === null,
       "$want and $stored are different materials");
}
/* And a different product or size type is still a different item. */
ok(dc_history_record(legacyItem('4140 QT UNDERSIZE SAG ROD', 'M16 x L 300 x TL 50/50mm'),
                     $LEG_WANT, $M) === null, 'a different size type does not match');
ok(dc_history_record(legacyItem('4140 QT FULLSIZE ANCHOR BOLT', 'M16 x L 300 x TL 50/50mm'),
                     $LEG_WANT, $M) === null, 'nor a different product');
ok(dc_history_record(legacyItem('4140 QT FULLSIZE SAG ROD', 'M20 x L 300 x TL 50/50mm'),
                     $LEG_WANT, $M) === null, 'nor a different size');

// ── which quotations the database is asked for ─────────────────────────────
/* The SQL prefilter is only ever allowed to NARROW. dc_history_blob_matches is
   the same predicate in PHP, so what the database is asked for can be tested
   without one. */
$normalised = json_encode([['productType'=>'SAG ROD','material'=>'4140','sizeType'=>'FULLSIZE',
                            'finish'=>'','cleanSize'=>'M16','size'=>'M16 x L 300mm']]);
$legacyOnly = json_encode([legacyItem('4140 QT FULLSIZE SAG ROD', 'M16 x L 300 x TL 50/50mm')]);
$mixed      = json_encode([['productType'=>'SAG ROD','material'=>'MS','sizeType'=>'FULLSIZE',
                            'finish'=>'PL','cleanSize'=>'M24','size'=>'M24 x L 900mm'],
                           legacyItem('4140 QT FULLSIZE SAG ROD', 'M16 x L 300 x TL 50/50mm')]);
ok(dc_history_blob_matches($normalised, $LEG_WANT), 'a normalised quotation is asked for');
ok(dc_history_blob_matches($legacyOnly, $LEG_WANT), 'and a purely legacy one');
ok(dc_history_blob_matches($mixed, $LEG_WANT),
   'and a legacy line sitting inside an otherwise modern quotation, which is how a '
 . 'quotation edited across versions looks');
ok(!dc_history_blob_matches(json_encode([['productType'=>'SAG ROD','material'=>'MS',
     'sizeType'=>'FULLSIZE','finish'=>'PL','cleanSize'=>'M24','size'=>'M24 x L 900mm']]), $LEG_WANT),
   'a quotation with nothing of that size in it is not asked for');

// ── an older match is not hidden behind newer unrelated quotations ─────────
/* There is no global recency window in the query, and this proves it stays
   that way: three hundred newer quotations that cannot match are simply not
   asked for, and the one older quotation that can is. */
$asked = 0;
for ($i = 0; $i < 300; $i++) {
    $blob = json_encode([['productType'=>'STUD','material'=>'MS','sizeType'=>'',
                          'finish'=>'PL','cleanSize'=>'M8','size'=>'M8 x L '.(100+$i).'mm']]);
    if (dc_history_blob_matches($blob, $LEG_WANT)) $asked++;
}
eq($asked, 0, 'three hundred newer unrelated quotations are not even asked for');
ok(dc_history_blob_matches($legacyOnly, $LEG_WANT),
   'and the older matching one still is, however many newer ones exist');


// ── the exact specification first, then the same rod in another coating ────
/* The reported half-inch case: MS UNDERSIZE 1/2" quoted twice before at L980
   and L1080, asked for today at L1020 in a different coating. Both must be
   offered, the nearer length first, and the coating said. */
$HALF_WANT = ['productType'=>'SAG ROD','material'=>'MS','sizeType'=>'UNDERSIZE','finish'=>'ZP',
              'cleanSize'=>'1/2','dimensionPreview'=>'L 1020 x TL 100/100mm','companyId'=>7];
function halfItem($len, $finish) {
    return item(['itemType'=>'sagrod','productType'=>'SAG ROD','material'=>'MS',
                 'sizeType'=>'UNDERSIZE','finish'=>$finish,'cleanSize'=>'1/2','sizeCode'=>'1/2',
                 'size'=>'1/2" x L '.$len.' x TL 100/100mm',
                 'dimensionPreview'=>'L '.$len.' x TL 100/100mm',
                 'desc'=>'MS UNDERSIZE SAG ROD']);
}
$r980  = dc_history_record(halfItem(980,  'PL'), $HALF_WANT, meta(1,'Q-2026-0470','2026-01-20','Alpha',7));
$r1080 = dc_history_record(halfItem(1080, 'PL'), $HALF_WANT, meta(2,'Q-2026-0471','2026-02-20','Alpha',7));
$rZp   = dc_history_record(halfItem(1200, 'ZP'), $HALF_WANT, meta(3,'Q-2026-0472','2026-03-20','Alpha',7));
ok($r980  !== null, 'the L980 half-inch record is not hidden by its coating');
ok($r1080 !== null, 'nor the L1080 one');
ok($rZp   !== null, 'and a record in the same coating is there too');
eq($r980['finishMatch'],  false, 'the L980 is flagged as another coating');
eq($rZp['finishMatch'],   true,  'while the ZP one is an exact match');
eq($r980['dimDistance'],  40.0,  'L980 is 40mm from L1020');
eq($r1080['dimDistance'], 60.0,  'and L1080 is 60mm');

$ranked = [$r1080, $r980, $rZp];
dc_history_sort($ranked);
eq(implode(',', array_column($ranked, 'refNo')), 'Q-2026-0472,Q-2026-0470,Q-2026-0471',
   'the exact coating ranks first, then the nearest length among the references');

/* And the boundary the reference must never cross. */
eq(dc_history_record(halfItem(980,'PL'), array_merge($HALF_WANT, ['cleanSize'=>'M16']), $M), null,
   'a half-inch record is never offered to an M16');
eq(dc_history_record(halfItem(980,'PL'), array_merge($HALF_WANT, ['cleanSize'=>'M12']), $M), null,
   'nor to an M12 — a different diameter is a different rod');
eq(dc_history_record(halfItem(980,'PL'), array_merge($HALF_WANT, ['material'=>'4140']), $M), null,
   'and a coating reference never relaxes the material');
eq(dc_history_record(halfItem(980,'PL'), array_merge($HALF_WANT, ['sizeType'=>'FULLSIZE']), $M), null,
   'nor the size type');
eq(dc_history_record(halfItem(980,'PL'), array_merge($HALF_WANT, ['productType'=>'ANCHOR BOLT']), $M), null,
   'nor the product');


// ── an inch size is not a metric one, and the database is asked in SQL ─────
/* THE LIVE FAILURE. json_encode escapes a forward slash, so a half-inch rod is
   stored "cleanSize":"1\/2" — and that backslash is MySQL's LIKE escape
   character. The prefilter asked for %"cleanSize":"1\/2"%, LIKE read the
   backslash as an escape, dropped it, and looked for "cleanSize":"1/2" — which
   is not what is in the blob. Every imperial size was invisible to pricing
   history, and the screen said "No pricing history for this exact
   specification" for a rod that had been quoted twice.

   dc_history_blob_matches models MySQL's LIKE, not strpos, because those two
   disagree on exactly that character. */
$halfBlob = json_encode([['productType'=>'SAG ROD','material'=>'MS','sizeType'=>'UNDERSIZE',
                          'finish'=>'PL','cleanSize'=>'1/2',
                          'size'=>'1/2" x L 980 x TL 100/100mm',
                          'dimensionPreview'=>'L 980 x TL 100/100mm']]);
ok(dc_history_blob_matches($halfBlob, ['cleanSize'=>'1/2']),
   'a half-inch quotation is asked for by a half-inch specification');
foreach (['3/4', '7/8', '1-1/4', '1-1/2', '5/8', '3/8'] as $inch) {
    $blob = json_encode([['productType'=>'SAG ROD','material'=>'MS','sizeType'=>'UNDERSIZE',
                          'finish'=>'PL','cleanSize'=>$inch,'size'=>$inch.'" x L 980mm']]);
    ok(dc_history_blob_matches($blob, ['cleanSize'=>$inch]), "and so is a $inch one");
}
$metric = json_encode([['productType'=>'SAG ROD','material'=>'MS','sizeType'=>'FULLSIZE',
                        'finish'=>'PL','cleanSize'=>'M16','size'=>'M16 x L 300mm']]);
ok(dc_history_blob_matches($metric, ['cleanSize'=>'M16']), 'a metric one still is');

/* And an inch size never reaches for a metric one, or the wrong inch. */
ok(!dc_history_blob_matches($halfBlob, ['cleanSize'=>'M12']),
   'a half-inch quotation is NOT asked for by an M12 — imperial is not metric');
ok(!dc_history_blob_matches($halfBlob, ['cleanSize'=>'M16']), 'nor by an M16');
ok(!dc_history_blob_matches($metric,   ['cleanSize'=>'1/2']), 'nor a metric one by a half inch');
ok(!dc_history_blob_matches($halfBlob, ['cleanSize'=>'3/4']), 'nor a half inch by a three-quarter');

/* A wildcard in a size can never turn the prefilter into "everything". */
ok(!dc_history_blob_matches($metric, ['cleanSize'=>'%']),
   'a percent sign is a character to look for, not a wildcard to match all');
ok(!dc_history_blob_matches($metric, ['cleanSize'=>'M_6']),
   'and an underscore is a character too');

// ── the live case end to end, through dc_history_record ────────────────────
$LIVE_WANT = ['productType'=>'SAG ROD','material'=>'MS','sizeType'=>'UNDERSIZE','finish'=>'ZP',
              'cleanSize'=>'1/2','dimensionPreview'=>'L 1020 x TL 100/100mm','companyId'=>7];
function liveItem($len, $finish = 'PL') {
    return item(['itemType'=>'sagrod','productType'=>'SAG ROD','material'=>'MS',
                 'sizeType'=>'UNDERSIZE','finish'=>$finish,'cleanSize'=>'1/2','sizeCode'=>'1/2',
                 'size'=>'1/2" x L '.$len.' x TL 100/100mm',
                 'dimensionPreview'=>'L '.$len.' x TL 100/100mm',
                 'desc'=>'MS UNDERSIZE SAG ROD']);
}
$live980  = dc_history_record(liveItem(980),  $LIVE_WANT, meta(1,'Q-2026-0470','2026-01-20','Alpha',7));
$live1080 = dc_history_record(liveItem(1080), $LIVE_WANT, meta(1,'Q-2026-0470','2026-01-20','Alpha',7));
ok($live980  !== null, 'LIVE: the L980 half-inch PL record is returned for a ZP L1020 row');
ok($live1080 !== null, 'LIVE: and the L1080 one');
if ($live980 !== null && $live1080 !== null) {
    eq($live980['finishMatch'],  false, 'LIVE: flagged as a different finish');
    eq($live1080['finishMatch'], false, 'LIVE: both of them');
    eq($live980['cleanSize'],  '1/2', 'LIVE: reported as a half inch');
    eq($live980['dimDistance'],  40.0, 'LIVE: L980 is 40mm from L1020');
    eq($live1080['dimDistance'], 60.0, 'LIVE: L1080 is 60mm');
    $order = [$live1080, $live980];
    dc_history_sort($order);
    eq(implode(',', array_column($order, 'dimDistance')), '40,60',
       'LIVE: and the nearer length ranks first');
}


// ── report ──────────────────────────────────────────────────────────────────
echo "  " . (count($failures) ? 'FAIL' : 'ok  ')
   . "  pricing history — identity, accessories, ranking  ($asserts assertions"
   . (count($failures) ? ', ' . count($failures) . ' failed' : '') . ")\n";
foreach ($failures as $f) echo "   - $f\n";
exit(count($failures) ? 1 : 0);
