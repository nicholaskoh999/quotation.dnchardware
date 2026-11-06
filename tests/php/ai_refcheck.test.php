<?php
/**
 * ── L Bolt dimension-reference check (R3 FAST Loop #6) ─────────────────────
 *
 * Run:  php tests/php/ai_refcheck.test.php
 *
 * No network. The extraction and the reference check are both stubbed with
 * the answers the provider gives, including the measured failure: the Owner's
 * centre-line L Bolt drawing read once as CENTER and once as END.
 */

define('AI_EXTRACT_TEST', 1);
define('OPENAI_API_KEY', 'sk-test');
define('AI_EXTRACT_MODEL_PRIMARY', 'test-luna');
require_once __DIR__ . '/../../ai_extract.php';

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true) . "\n      actual:   " . var_export($actual, true));
}
function item($o = []) {
    return array_merge(['M' => 'M12', 'L' => 250, 'W' => 50, 'TL' => 60, 'qty' => 200, 'Bmid' => null, 'material' => null,
        'finish' => null, 'sizeType' => null, 'unclear' => null, 'product' => 'L_BOLT', 'threadEnds' => null,
        'bodyDia' => null, 'H' => null, 'ID' => null, 'S' => null, 'R' => 24, 'Lref' => 'CENTER', 'Wref' => 'END', 'plate' => null], $o);
}
function claude_doc($items) {
    return ['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => json_encode(
        ['product' => null, 'material' => null, 'finish' => null, 'sizeType' => null, 'items' => $items])]],
        'usage' => ['input_tokens' => 100, 'output_tokens' => 400, 'cache_read_input_tokens' => 9000, 'cache_creation_input_tokens' => 0]];
}
function check_ans($bolts, $stop = 'end_turn') {
    return ['stop_reason' => $stop, 'content' => [['type' => 'text', 'text' => json_encode(['bolts' => $bolts])]],
            'usage' => ['input_tokens' => 50, 'output_tokens' => 120, 'cache_read_input_tokens' => 9000, 'cache_creation_input_tokens' => 0]];
}
function bolt($M, $L, $W, $Lend, $Wend) { return compact('M', 'L', 'W', 'Lend', 'Wend'); }
function upload_imgs() {
    return ['ok' => true, 'kind' => 'images', 'mime' => 'multipart', 'size' => 9, 'parts' => [
        ['kind' => 'image', 'mime' => 'image/png', 'bytes' => 'aaa', 'name' => '1.png'],
        ['kind' => 'image', 'mime' => 'image/jpeg', 'bytes' => 'bbb', 'name' => '2.jpg']]];
}
$owner = [item(), item(['M' => 'M16', 'L' => 360, 'W' => 75, 'TL' => 70, 'qty' => 500]),
          item(['M' => 'M20', 'L' => 525, 'W' => 100, 'TL' => 90, 'qty' => 400]), item(['M' => 'M24', 'L' => 610, 'W' => 100, 'TL' => 100, 'qty' => 300]),
          item(['M' => 'M30', 'L' => 250, 'W' => null, 'TL' => '120/65', 'product' => 'SAG_ROD', 'R' => null, 'Lref' => null, 'Wref' => null, 'plate' => 125])];
$asEnd = array_map(fn($i) => $i['product'] === 'L_BOLT' ? array_merge($i, ['Lref' => 'END']) : $i, $owner);
$checkCL = [bolt('M12', 250, 50, 'CENTRE_LINE', 'FAR_FACE'), bolt('M16', 360, 75, 'CENTRE_LINE', 'FAR_FACE'),
            bolt('M20', 525, 100, 'CENTRE_LINE', 'FAR_FACE'), bolt('M24', 610, 100, 'CENTRE_LINE', 'FAR_FACE')];

function run_media($first, $check, &$calls = null) {
    $calls = [];
    $sonnet = function ($req, $key, $timeout = 120) use ($first, $check, &$calls) {
        $isCheck = isset($req['output_config']['format']['schema']['properties']['bolts']);
        $calls[] = ['check' => $isCheck, 'timeout' => $timeout, 'req' => $req];
        if ($isCheck) return is_array($check) && isset($check[0]) && is_int($check[0]) ? $check : [200, $check, '', 0];
        return [200, claude_doc($first), '', 0];
    };
    $luna = function () { throw new RuntimeException('luna must not be called'); };
    $payload = ai_build_payload(upload_imgs());
    return ai_extract_media(upload_imgs(), $payload, ['sonnet' => $sonnet, 'luna' => $luna, 'key' => 'k-test']);
}
$rows = fn($run) => $run['result']['data']['items'];

// ── R1  readings agree (runs 1 and 3 of the audit) ──
$run = run_media($owner, check_ans($checkCL), $calls);
eq(count($calls), 2, 'R1 one extraction + one reference check');
ok($calls[1]['check'] && $calls[1]['timeout'] === AI_REFCHECK_TIMEOUT, 'R1 the second call is the check, with its own timeout');
eq(array_map(fn($r) => [$r['Lchk'] ?? '-', $r['Wchk'] ?? '-'], array_slice($rows($run), 0, 4)), array_fill(0, 4, ['agree', 'agree']), 'R1 all four L Bolts agree on L and W');
eq(array_column(array_slice($rows($run), 0, 4), 'L'), [250, 360, 525, 610], 'R1 L reaches the client as printed (the client converts)');
ok(!array_key_exists('Lchk', $rows($run)[4]), 'R1 the Sag Rod row carries no check field');
eq(count($run['log']), 2, 'R1 the check is logged as its own entry');
eq($run['log'][1]['stage'] ?? null, 'refcheck', 'R1 log entry names the stage');
ok($run['log'][1]['est_usd'] > 0, 'R1 the check cost is counted');

// ── R2  the measured failure: first reading END, check CENTRE_LINE ──
$run = run_media($asEnd, check_ans($checkCL));
eq(array_map(fn($r) => [$r['Lchk'], $r['Lalt'], $r['Wchk']], array_slice($rows($run), 0, 4)), array_fill(0, 4, ['conflict', 'CENTER', 'agree']),
   'R2 END vs CENTRE_LINE is a conflict on L only; W still agrees');
eq($rows($run)[0]['Lref'], 'END', 'R2 the first reading is kept as evidence, not rewritten');

// ── R3  first reading CENTER, check FAR_FACE (wrong the other way) ──
$run = run_media($owner, check_ans(array_map(fn($b) => array_merge($b, ['Lend' => 'FAR_FACE']), $checkCL)));
eq($rows($run)[2]['Lchk'] . '/' . $rows($run)[2]['Lalt'], 'conflict/END', 'R3 CENTER vs FAR_FACE is a conflict too: neither reading is trusted blindly');

// ── R4  check says CANNOT_TELL ──
$run = run_media($owner, check_ans(array_map(fn($b) => array_merge($b, ['Lend' => 'CANNOT_TELL']), $checkCL)));
eq($rows($run)[1]['Lchk'] . '/' . $rows($run)[1]['Lalt'], 'conflict/UNCLEAR', 'R4 a check that cannot tell does not confirm');

// ── R5  first reading UNCLEAR ──
$u = $owner; $u[0]['Lref'] = 'UNCLEAR';
$run = run_media($u, check_ans($checkCL));
eq($rows($run)[0]['Lchk'] . '/' . $rows($run)[0]['Lalt'], 'unclear/CENTER', 'R5 UNCLEAR stays unclear, with the check offered as a candidate');

// ── R6  bolt missing from the check ──
$run = run_media($owner, check_ans(array_slice($checkCL, 1)));
eq($rows($run)[0]['Lchk'], 'unmatched', 'R6 M12 not reported by the check: unmatched');
eq($rows($run)[1]['Lchk'], 'agree', 'R6 M16 still agrees');

// ── R7  check fails: HTTP error, timeout, refusal, malformed, max_tokens ──
foreach ([[500, null, '', 0], [0, null, 'Operation timed out', 28], [200, ['stop_reason' => 'refusal', 'content' => []], '', 0],
          [200, ['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => '{"nope":1}']]], '', 0],
          [200, check_ans($checkCL, 'max_tokens'), '', 0]] as $n => $resp) {
    $run = run_media($owner, $resp);
    eq(array_unique(array_map(fn($r) => $r['Lchk'] . '|' . $r['Wchk'], array_slice($rows($run), 0, 4))), ['failed|failed'], "R7.$n check failure: every L Bolt dimension unverified");
    ok($run['result']['data'] !== null && count($rows($run)) === 5, "R7.$n the extraction itself is still returned");
}

// ── R8  no L Bolt: no second call ──
$run = run_media([$owner[4]], check_ans([]), $calls);
eq(count($calls), 1, 'R8 no L Bolt, no reference check');

// ── R9  first reading null (no line drawn) vs check ──
$n0 = $owner; $n0[0]['Lref'] = null; $n0[0]['Wref'] = null;
$run = run_media($n0, check_ans([bolt('M12', 250, 50, 'NOT_DRAWN', 'FAR_FACE')] + $checkCL));
eq($rows($run)[0]['Lchk'] . '/' . $rows($run)[0]['Wchk'], 'agree/agree', 'R9 null and NOT_DRAWN / FAR_FACE are the same as-printed value');
$run = run_media($n0, check_ans([bolt('M12', 250, 50, 'CENTRE_LINE', 'FAR_FACE')] + $checkCL));
eq($rows($run)[0]['Lchk'], 'conflict', 'R9 null vs CENTRE_LINE is a conflict');

// ── R10  two M12 rows: matched by L, then W ──
$two = [item(['L' => 250]), item(['L' => 400])];
$run = run_media($two, check_ans([bolt('M12', 400, 50, 'FAR_FACE', 'FAR_FACE'), bolt('M 12', 250, 50, 'CENTRE_LINE', 'FAR_FACE')]));
eq([$rows($run)[0]['Lchk'], $rows($run)[1]['Lchk']], ['agree', 'conflict'], 'R10 rows with the same M are matched on L ("M 12" normalised)');
$run = run_media([item()], check_ans([bolt('M12', 999, 0, 'CENTRE_LINE', 'FAR_FACE'), bolt('M12', 998, 0, 'FAR_FACE', 'FAR_FACE')]));
eq($rows($run)[0]['Lchk'], 'unmatched', 'R10 ambiguous duplicates that disagree are not guessed between');

// ── R11  the check request ──
run_media($owner, check_ans($checkCL), $calls);
$req = $calls[1]['req'];
eq(count(array_filter($req['messages'][0]['content'], fn($c) => $c['type'] === 'image')), 2, 'R11 the check sees the same two images');
ok(strpos(json_encode($req), 'CENTER') === false || strpos(json_encode($req['messages']), '"Lref"') === false, 'R11 the first answer is not shown to the check');
ok(strpos(json_encode($req['messages']), 'L_BOLT') === false, 'R11 the check request carries no extraction output');
eq($req['max_tokens'], AI_REFCHECK_MAX_TOKENS, 'R11 short answer budget');
$lim = ai_anthropic_schema_limits(ai_refcheck_schema());
ok(count($lim['union']) <= AI_ANTHROPIC_MAX_UNIONS && count($lim['optional']) <= AI_ANTHROPIC_MAX_OPTIONAL && !$lim['enum_type_mismatch'], 'R11 check schema within strict limits');

// ── R12  Luna fallback: one reading, unverified ──
$sonnet = fn() => [503, null, '', 0];
$luna = fn() => [200, ['status' => 'completed', 'output' => [['type' => 'message', 'content' => [['type' => 'output_text',
    'text' => json_encode(['product' => null, 'material' => null, 'finish' => null, 'sizeType' => null, 'threadEnds' => null, 'note' => null, 'items' => $owner])]]]],
    'usage' => ['input_tokens' => 9000, 'output_tokens' => 300]], '', 0];
$run = ai_extract_media(upload_imgs(), ai_build_payload(upload_imgs()), ['sonnet' => $sonnet, 'luna' => $luna, 'key' => 'k']);
eq($run['provider'] . '/' . $rows($run)[0]['Lchk'] . '/' . $rows($run)[0]['Wchk'], 'openai/failed/failed', 'R12 fallback rows are unverified');

// ── R13  the check saw L bolts no row stands for (measured: 1 row of 10 returned) ──
$run = run_media([$owner[0]], check_ans($checkCL));
eq($run['result']['data']['refMissing'] ?? null, ['M16 L360', 'M20 L525', 'M24 L610'], 'R13 bolts missing from the list are named');
eq($rows($run)[0]['Lchk'], 'agree', 'R13 the row that did arrive is still compared');
$run = run_media($owner, check_ans($checkCL));
ok(!isset($run['result']['data']['refMissing']), 'R13 a complete list carries no refMissing');
$run = run_media($owner, [500, null, '', 0]);
ok(!isset($run['result']['data']['refMissing']), 'R13 a failed check claims nothing is missing');
// ── R14  the W rule the main prompt uses is in the check prompt too ──
ok(strpos(ai_refcheck_instructions(), 'WITHIN its drawn thickness') !== false && strpos(ai_refcheck_instructions(), 'B, LEG, LEG LENGTH') !== false, 'R14 check prompt carries the B-leg and rod-thickness W rules');

echo "  " . (count($failures) ? 'FAIL' : 'ok  ')
   . "  ai_refcheck — L Bolt reference check: agree / conflict / unclear / unmatched / failed  ($asserts assertions"
   . (count($failures) ? ', ' . count($failures) . ' failed' : '') . ")\n";
foreach ($failures as $f) echo "   - $f\n";
exit(count($failures) ? 1 : 0);
