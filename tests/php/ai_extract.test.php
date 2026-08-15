<?php
/**
 * ── Extraction endpoint: limits, truncation and error causes ───────────────
 * Requirements 9, 10, 43, 44.
 *
 * Run:  php tests/php/ai_extract.test.php
 *
 * AI_EXTRACT_TEST stops the endpoint body from running, so the validators, the
 * sanitiser, the salvage path and the error mapper are exercised directly. No
 * network call is made and no key is needed.
 */

define('AI_EXTRACT_TEST', 1);
define('OPENAI_API_KEY', 'sk-test');
define('AI_EXTRACT_MODEL_PRIMARY', 'test-model');
require_once __DIR__ . '/../../ai_extract.php';

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

/* One item as the strict schema requires it: every key present. */
function item($m, $l, $tl, $qty, $extra = []) {
    return array_merge([
        'M' => $m, 'L' => $l, 'W' => null, 'TL' => $tl, 'qty' => $qty, 'Bmid' => null,
        'material' => null, 'finish' => null, 'sizeType' => null, 'unclear' => null,
        'product' => null, 'threadEnds' => null, 'bodyDia' => null,
        'H' => null, 'ID' => null, 'S' => null, 'R' => null,
    ], $extra);
}
function extraction($items, $head = []) {
    return json_encode(array_merge([
        'product' => 'ANCHOR_BOLT', 'material' => 'MS', 'finish' => 'HDG',
        'sizeType' => null, 'threadEnds' => 1, 'note' => null,
    ], $head, ['items' => $items]));
}

// ── a dense table is not a failure ──────────────────────────────────────────
$sizes = ['3/8"', '3/4"', '7/8"', '1"', 'M8', 'M12', 'M14', 'M18', 'M20', 'M22', 'M24', 'M27', 'M30'];
$rows = [];
for ($i = 0; $i < 29; $i++) {
    $rows[] = item($sizes[$i % count($sizes)], 250 + $i * 10, $i < 18 ? 150 : 300, 4 + $i);
}
$d = ai_sanitise_extraction(extraction($rows));
ok($d !== null, '29 rows sanitise without failing the whole document');
eq(count($d['items']), 29, 'all 29 rows survive');
eq($d['items'][0]['TL'], 150, 'the merged TL covering rows 1-18 lands on the first of them');
eq($d['items'][18]['TL'], 300, 'and the later merge lands on the first row it covers');
eq($d['items'][3]['M'], '1"', 'an imperial row keeps its own notation');
eq($d['items'][4]['M'], 'M8', 'and a metric row beside it keeps its own');

// ── the ceiling has room for them ──────────────────────────────────────────
ok(AI_MAX_OUTPUT_TOKENS >= 16000,
   'the output ceiling has room for AI_MAX_ITEMS rows plus the reasoning that reads them');
$payload = ai_build_text_payload('M20 x 300 x 100');
eq($payload['max_output_tokens'], AI_MAX_OUTPUT_TOKENS, 'the text path uses it');
ok(strpos($payload['instructions'], 'EACH DRAWING OWNS ITS OWN DIMENSIONS') !== false,
   'the instructions carry the drawing-region rule');
ok(strpos($payload['instructions'], 'A SHARED VALUE REACHES ONLY THE ROWS IT COVERS') !== false,
   'and the merged-cell rule');
ok(strpos($payload['instructions'], 'STRUCTURED COLUMNS OUTRANK THE DESCRIPTION') !== false,
   'and the table-column rule');

// ── one bad row does not cost the others ───────────────────────────────────
$mixed = [item('M20', 300, 100, 5), 'not an object', item('M24', 400, 120, 6)];
$d = ai_sanitise_extraction(extraction($mixed));
eq(count($d['items']), 2, 'an unusable row is skipped and the readable ones are kept');
eq($d['items'][1]['M'], 'M24', 'in document order');

$badValues = [item('M20', 300, 100, 5), item('M24', -5, 'nonsense', 0)];
$d = ai_sanitise_extraction(extraction($badValues));
eq(count($d['items']), 2, 'a row with unusable VALUES is still a row');
eq($d['items'][1]['L'], null, 'its impossible length becomes null rather than a negative dimension');
eq($d['items'][1]['TL'], null, 'its unreadable thread likewise');
eq($d['items'][1]['qty'], null, 'and a qty of 0 is not a quantity');

// ── truncation: what arrived whole is kept, and flagged ────────────────────
$full = extraction([item('M20', 300, 150, 4), item('M24', 400, 150, 6), item('M30', 500, 300, 8)]);
$cut  = substr($full, 0, strpos($full, '"M30"') + 30);      // sliced mid-row
ok(json_decode($cut, true) === null, 'the truncated text is not valid JSON');
eq(ai_sanitise_extraction($cut), null, 'so the ordinary sanitiser refuses it');
$salv = ai_salvage_extraction($cut);
ok($salv !== null, 'the salvage path recovers something');
eq(count($salv['items']), 2, 'exactly the rows that arrived whole — the cut row is discarded, not half-read');
eq($salv['items'][0]['M'], 'M20', 'first row intact');
eq($salv['items'][1]['M'], 'M24', 'second row intact');
eq($salv['product'], 'ANCHOR_BOLT', 'the document-level product survived the cut');
eq($salv['material'], 'MS', 'and the material');
eq($salv['threadEnds'], 1, 'and the thread-end evidence');
$clean = ai_sanitise_data($salv);
ok($clean !== null, 'and the salvaged extraction passes the same validation as a whole one');
eq(count($clean['items']), 2, 'with the same two rows');

eq(ai_salvage_extraction('{"product":"ANCHOR_BOLT","items":[{"M":"M20"'), null,
   'a cut that lands inside the FIRST row salvages nothing rather than inventing a row');
eq(ai_salvage_extraction('not json at all'), null, 'and nonsense salvages nothing');

// ── the segments are checked against the overall length, HERE ──────────────
/* Rows 2-5 of HAB-TA-01: a thread, a plain centre and a thread that add up to
   the overall dimension the drawing spans. The arithmetic is done on the server
   rather than trusted to the model, and it CONFIRMS the length — it does not
   turn it into a doubt. */
$sheet = ai_sanitise_extraction(extraction([
    item('M30', 950,  null,      null),
    item('M30', 865,  '200/200', null, ['Bmid' => 465]),
    item('M30', 1000, '200/200', null, ['Bmid' => 600]),
    item('M30', 1200, '200/200', null, ['Bmid' => 800]),
    item('M30', 1285, '200/200', null, ['Bmid' => 885]),
], ['product' => 'SAG_ROD', 'threadEnds' => 2]));
eq(count($sheet['items']), 5, 'five drawing parts');
foreach ([950, 865, 1000, 1200, 1285] as $i => $len) {
    eq($sheet['items'][$i]['L'], $len, "part " . ($i + 1) . " keeps its own overall length of $len");
}
foreach ([1, 2, 3, 4] as $i) {
    eq($sheet['items'][$i]['TL'], '200/200', 'part ' . ($i + 1) . ' is threaded 200 at each end');
    eq($sheet['items'][$i]['Bbad'], false,
       'part ' . ($i + 1) . ': 200 + centre + 200 equals the stated length, so nothing is flagged');
    ok($sheet['items'][$i]['L'] != 200 && $sheet['items'][$i]['L'] != 400,
       'part ' . ($i + 1) . ': the thread is not the length');
}
$clash = ai_sanitise_extraction(extraction([item('M30', 1000, '200/200', null, ['Bmid' => 999])]));
eq($clash['items'][0]['Bbad'], true, 'segments that do not add up ARE flagged');
eq($clash['items'][0]['L'], 1000, 'and the printed length is reported as printed, never adjusted to fit');

// ── the causes are told apart ──────────────────────────────────────────────
eq(ai_incomplete_reason(['status' => 'incomplete', 'incomplete_details' => ['reason' => 'max_output_tokens']]),
   'max_output_tokens', 'a response cut off for length says so');
eq(ai_incomplete_reason(['status' => 'completed']), '', 'a complete one says nothing');
eq(ai_output_refusal(['output' => [['content' => [['type' => 'refusal', 'refusal' => 'no']]]]]), 'no',
   'a refusal is recognised as a refusal');
eq(ai_output_refusal(['output' => [['type' => 'message', 'content' => [['type' => 'output_text', 'text' => '{}']]]]]), '',
   'an ordinary answer is not');

$e = ai_map_error(0, null, 'Operation timed out', 28);
eq($e['error'], 'timeout', 'a timeout is reported as a timeout, not as an unreachable host');
ok(strpos($e['message'], 'split') !== false, 'and suggests what to do about it');
eq(ai_map_error(0, null, 'could not resolve host', 6)['error'], 'network', 'an unreachable host is still a network error');
eq(ai_map_error(429, null, '', 0)['error'], 'rate', 'a 429 is still rate limiting');
eq(ai_map_error(401, null, '', 0)['error'], 'auth', 'a 401 is still an auth problem');
eq(ai_map_error(200, [], '', 0), null, 'a 200 is not a transport error');

// ── upload limits still speak for themselves ───────────────────────────────
$r = ai_validate_text(str_repeat('x', AI_MAX_TEXT_CHARS + 1));
eq($r['error'], 'text_too_long', 'an over-long paste says which limit it hit');
$r = ai_validate_text('   ');
eq($r['error'], 'no_text', 'and an empty one says that instead');
ok(AI_MAX_ITEMS >= 100, 'the row cap is well above any real table');
$over = [];
for ($i = 0; $i < AI_MAX_ITEMS + 5; $i++) $over[] = item('M20', 300, 100, 1);
eq(count(ai_sanitise_extraction(extraction($over))['items']), AI_MAX_ITEMS,
   'and beyond it the extra rows are dropped rather than the document');

// ── report ─────────────────────────────────────────────────────────────────
echo "  " . (count($failures) ? 'FAIL' : 'ok  ')
   . "  ai_extract — dense tables, truncation and error causes  ($asserts assertions"
   . (count($failures) ? ', ' . count($failures) . ' failed' : '') . ")\n";
foreach ($failures as $f) echo "   - $f\n";
exit(count($failures) ? 1 : 0);
