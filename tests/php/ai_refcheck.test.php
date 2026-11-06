<?php
/**
 * ── Second reading: quotation coverage + L Bolt references (R3 FAST Loop #6/#7) ──
 *
 * Run:  php tests/php/ai_refcheck.test.php
 *
 * No network. The extraction and the second reading are both stubbed with the
 * answers the provider gives, including the two measured failures on the
 * Owner's drawing: L read to END instead of the centre line (Loop #6), and the
 * extraction returning ONE row of ten (Loop #7).
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
function sag($M, $L, $TL, $qty, $plate) {
    return item(['M' => $M, 'L' => $L, 'W' => null, 'TL' => $TL, 'qty' => $qty, 'product' => 'SAG_ROD', 'R' => null, 'Lref' => null, 'Wref' => null, 'plate' => $plate]);
}
function claude_doc($items, $stop = 'end_turn') {
    $t = is_string($items) ? $items : json_encode(['product' => null, 'material' => null, 'finish' => null, 'sizeType' => null, 'items' => $items]);
    return ['stop_reason' => $stop, 'content' => [['type' => 'thinking', 'thinking' => ''], ['type' => 'text', 'text' => $t]],
        'usage' => ['input_tokens' => 100, 'output_tokens' => 400, 'cache_read_input_tokens' => 9000, 'cache_creation_input_tokens' => 0]];
}
function check_ans($items, $stop = 'end_turn') {
    return ['stop_reason' => $stop, 'content' => [['type' => 'thinking', 'thinking' => ''], ['type' => 'text', 'text' => json_encode(['items' => $items])]],
            'usage' => ['input_tokens' => 50, 'output_tokens' => 120, 'cache_read_input_tokens' => 9000, 'cache_creation_input_tokens' => 0]];
}
/* A checked item. L bolts carry their two line ends; every other item N_A. */
function bolt($M, $L, $W, $Lend, $Wend, $qty = 0) { return ['kind' => 'L_BOLT', 'M' => $M, 'L' => $L, 'W' => $W, 'qty' => $qty, 'Lend' => $Lend, 'Wend' => $Wend]; }
function chk($kind, $M, $L, $qty = 0) { return ['kind' => $kind, 'M' => $M, 'L' => $L, 'W' => 0, 'qty' => $qty, 'Lend' => 'N_A', 'Wend' => 'N_A']; }
function upload_imgs($order = [1, 2, 3]) {
    $parts = [];
    foreach ($order as $n) $parts[] = ['kind' => 'image', 'mime' => 'image/jpeg', 'bytes' => "img$n", 'name' => "$n.jpg"];
    return ['ok' => true, 'kind' => 'images', 'mime' => 'images/' . count($parts), 'size' => 9, 'parts' => $parts];
}
$LB = [item(), item(['M' => 'M16', 'L' => 360, 'W' => 75, 'TL' => 70, 'qty' => 500, 'R' => 32]),
       item(['M' => 'M20', 'L' => 525, 'W' => 100, 'TL' => 90, 'qty' => 400, 'R' => 40]), item(['M' => 'M24', 'L' => 610, 'W' => 100, 'TL' => 100, 'qty' => 300, 'R' => 48])];
$SR = [sag('M30', 250, '120/65', 300, 125), sag('M36', 360, '130/75', 300, 125), sag('M42', 525, '150/90', 200, 150),
       sag('M48', 960, '160/100', 200, 150), sag('M56', 1200, '170/120', 100, 170), sag('M64', 1300, '180/130', 100, 200)];
$owner = array_merge($LB, $SR);
$asEnd = array_map(fn($i) => $i['product'] === 'L_BOLT' ? array_merge($i, ['Lref' => 'END']) : $i, $owner);
$checkLB = [bolt('M12', 250, 50, 'CENTRE_LINE', 'FAR_FACE', 200), bolt('M16', 360, 75, 'CENTRE_LINE', 'FAR_FACE', 500),
            bolt('M20', 525, 100, 'CENTRE_LINE', 'FAR_FACE', 400), bolt('M24', 610, 100, 'CENTRE_LINE', 'FAR_FACE', 300)];
$checkSR = [chk('SAG_ROD', 'M30', 250, 300), chk('SAG_ROD', 'M36', 360, 300), chk('SAG_ROD', 'M42', 525, 200),
            chk('SAG_ROD', 'M48', 960, 200), chk('SAG_ROD', 'M56', 1200, 100), chk('SAG_ROD', 'M64', 1300, 100)];
$checkAll = array_merge($checkLB, $checkSR);

function run_media($first, $check, &$calls = null, $upload = null, $mainStop = 'end_turn') {
    $calls = [];
    $upload = $upload ?? upload_imgs();
    $sonnet = function ($req, $key, $timeout = 120) use ($first, $check, &$calls, $mainStop) {
        $isCheck = isset($req['output_config']['format']['schema']['properties']['items']['items']['properties']['kind']);
        $calls[] = ['check' => $isCheck, 'timeout' => $timeout, 'req' => $req];
        if ($isCheck) return is_array($check) && isset($check[0]) && is_int($check[0]) ? $check : [200, $check, '', 0];
        return [200, claude_doc($first, $mainStop), '', 0];
    };
    $luna = function () { throw new RuntimeException('luna must not be called'); };
    return ai_extract_media($upload, ai_build_payload($upload), ['sonnet' => $sonnet, 'luna' => $luna, 'key' => 'k-test']);
}
$rows = fn($run) => $run['result']['data']['items'];
$cov  = fn($run) => $run['result']['data']['coverage'] ?? null;

// ══ COVERAGE ══════════════════════════════════════════════════════════════
// C1  all ten returned, the check lists the same ten
$run = run_media($owner, check_ans($checkAll), $calls);
eq(count($calls), 2, 'C1 one extraction + one second reading');
ok(!$calls[0]['check'] && $calls[1]['check'] && $calls[1]['timeout'] === AI_REFCHECK_TIMEOUT, 'C1 the second call is the check, with its own timeout');
eq([$cov($run)['state'], $cov($run)['checked'], $cov($run)['read'], $cov($run)['missing']], ['complete', 10, 10, []], 'C1 complete: 10 checked, 10 read, none missing');
eq($run['review'], false, 'C1 a complete, agreeing read is not forced to review by the server');
// C2  the measured failure: only M12 returned
$run = run_media([$owner[0]], check_ans($checkAll));
eq($cov($run)['state'], 'partial', 'C2 one row of ten: partial');
eq($cov($run)['missing'], ['M16 L360', 'M20 L525', 'M24 L610', 'M30 L250', 'M36 L360', 'M42 L525', 'M48 L960', 'M56 L1200', 'M64 L1300'],
   'C2 the nine missing items are named — Sag Rods included, not only L Bolts');
eq(count($rows($run)), 1, 'C2 the row that arrived is kept; nothing is invented');
eq($run['review'], true, 'C2 server review flag set');
// C3 / C4  some L bolts missing, some sag rods missing
$run = run_media(array_merge([$LB[0], $LB[2]], $SR), check_ans($checkAll));
eq($cov($run)['missing'], ['M16 L360', 'M24 L610'], 'C3 two L Bolts missing are named');
$run = run_media(array_merge($LB, [$SR[0], $SR[5]]), check_ans($checkAll));
eq($cov($run)['missing'], ['M36 L360', 'M42 L525', 'M48 L960', 'M56 L1200'], 'C4 four Sag Rods missing are named');
// C5  mixed product types: a J bolt is matched on its height
$mixed = [item(['M' => 'M16', 'L' => null, 'W' => null, 'H' => 450, 'product' => 'J_BOLT', 'Lref' => null, 'Wref' => null]),
          sag('M20', 1000, '100/100', 10, null), item(['M' => 'M12', 'L' => 300, 'product' => 'STUD', 'W' => null, 'Lref' => null, 'Wref' => null])];
$run = run_media($mixed, check_ans([chk('J_BOLT', 'M16', 450), chk('SAG_ROD', 'M20', 1000), chk('STUD', 'M12', 300)]));
eq($cov($run)['state'], 'complete', 'C5 J bolt (H) + sag rod + stud: complete');
// C6  unknown expected count: whatever the check lists decides; zero listed
$run = run_media([$SR[0], $SR[1], $SR[2]], check_ans(array_slice($checkSR, 0, 3)));
eq([$cov($run)['state'], $cov($run)['checked']], ['complete', 3], 'C6 a three-row document is complete at three');
$run = run_media([$SR[0]], check_ans([]));
eq([$cov($run)['state'], $cov($run)['missing']], ['complete', []], 'C6 a check that lists nothing claims nothing is missing');
// C7  unrelated objects / rows the check did not list: never removed, never flagged
$extra = array_merge($owner, [item(['M' => 'M10', 'L' => 100, 'product' => 'OTHER', 'W' => null, 'Lref' => null, 'Wref' => null])]);
$run = run_media($extra, check_ans($checkAll));
eq([$cov($run)['state'], count($rows($run))], ['complete', 11], 'C7 a row the check did not list stays, coverage complete');
// C8  the two readers name a product differently: size and length still match
$run = run_media([$SR[0]], check_ans([chk('ANCHOR_BOLT', 'M30', 250)]));
eq($cov($run)['state'], 'complete', 'C8 SAG_ROD row covers an ANCHOR_BOLT check item of the same size and length');
// C9  truncated main answer (salvaged) + check
$full = json_encode(['product' => null, 'material' => null, 'finish' => null, 'sizeType' => null, 'items' => $owner]);
$cut = substr($full, 0, strpos($full, '"M":"M36"') - 2);
$run = run_media($cut, check_ans($checkAll), $calls, null, 'max_tokens');
ok($run['result']['truncated'] === true && $cov($run)['state'] === 'partial' && count($cov($run)['missing']) === 10 - count($rows($run)),
   'C9 cut-off answer: truncated AND partial, missing = checked − salvaged (' . count($rows($run)) . ' salvaged)');
// C10  check answers that are not usable -> uncertain, L refs failed
foreach ([[500, null, '', 0], [0, null, 'Operation timed out', 28], [200, ['stop_reason' => 'refusal', 'content' => []], '', 0],
          [200, ['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => '{"bolts":[]}']]], '', 0],
          [200, ['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => '{"items":[{"M":"M1']]], '', 0],
          [200, check_ans($checkAll, 'max_tokens'), '', 0]] as $n => $resp) {
    $run = run_media($owner, $resp);
    eq([$cov($run)['state'], $run['review']], ['uncertain', true], "C10.$n unusable check: coverage uncertain, review");
    eq(array_unique(array_map(fn($r) => $r['Lchk'] . '|' . $r['Wchk'], array_slice($rows($run), 0, 4))), ['failed|failed'], "C10.$n every L Bolt dimension unverified");
    eq(count($rows($run)), 10, "C10.$n all ten rows still returned");
}
// C11  image order: the check sees the images in the order they were sent
$run = run_media($owner, check_ans($checkAll), $calls, upload_imgs([3, 1, 2]));
$imgs = array_map(fn($c) => $c['source']['data'], array_values(array_filter($calls[1]['req']['messages'][0]['content'], fn($c) => $c['type'] === 'image')));
eq($imgs, [base64_encode('img3'), base64_encode('img1'), base64_encode('img2')], 'C11 order 3,1,2 is kept in the check request');
eq($cov($run)['state'], 'complete', 'C11 coverage does not depend on order');
// C12  a size repeated in the document is counted, not collapsed
$run = run_media([$SR[0]], check_ans([chk('SAG_ROD', 'M30', 250), chk('SAG_ROD', 'M30', 250)]));
eq($cov($run)['missing'], ['M30 L250'], 'C12 two identical checked rows need two rows');
// C13  no invented rows, no dimension or price from the check
$run = run_media([$owner[0]], check_ans($checkAll));
eq(array_keys($rows($run)[0]), array_merge(array_keys(ai_sanitise_data(['product' => null, 'items' => [$owner[0]]])['items'][0]), ['Lalt', 'Lchk', 'Walt', 'Wchk']),
   'C13 the check adds only its comparison fields to an existing row');
// C14  a check item without a length is matched on size alone; one without size by label
$run = run_media([$SR[0]], check_ans([chk('SAG_ROD', 'M30', 0), chk('PLATE', '', 0, 4)]));
eq($cov($run)['missing'], ['PLATE'], 'C14 size-only item covered; an unsized listed item is named by kind');

// ══ L BOLT REFERENCES (Loop #6 cases on the combined check) ══════════════
$run = run_media($owner, check_ans($checkAll));
eq(array_map(fn($r) => [$r['Lchk'] ?? '-', $r['Wchk'] ?? '-'], array_slice($rows($run), 0, 4)), array_fill(0, 4, ['agree', 'agree']), 'R1 all four L Bolts agree on L and W');
eq(array_column(array_slice($rows($run), 0, 4), 'L'), [250, 360, 525, 610], 'R1 L reaches the client as printed (the client converts)');
ok(!array_key_exists('Lchk', $rows($run)[4]), 'R1 the Sag Rod row carries no reference field');
eq(count($run['log']), 2, 'R1 the check is logged as its own entry');
eq([$run['log'][1]['stage'] ?? null, $run['log'][1]['items'] ?? null, $run['log'][1]['stop'] ?? null], ['refcheck', 10, 'end_turn'], 'R1 log names the stage, items and stop reason');
ok($run['log'][1]['est_usd'] > 0, 'R1 the check cost is counted');
$run = run_media($asEnd, check_ans($checkAll));
eq(array_map(fn($r) => [$r['Lchk'], $r['Lalt'], $r['Wchk']], array_slice($rows($run), 0, 4)), array_fill(0, 4, ['conflict', 'CENTER', 'agree']),
   'R2 END vs CENTRE_LINE is a conflict on L only; W still agrees');
eq($rows($run)[0]['Lref'], 'END', 'R2 the first reading is kept as evidence, not rewritten');
$run = run_media($owner, check_ans(array_merge(array_map(fn($b) => array_merge($b, ['Lend' => 'FAR_FACE']), $checkLB), $checkSR)));
eq($rows($run)[2]['Lchk'] . '/' . $rows($run)[2]['Lalt'], 'conflict/END', 'R3 CENTER vs FAR_FACE is a conflict too');
$run = run_media($owner, check_ans(array_merge(array_map(fn($b) => array_merge($b, ['Lend' => 'CANNOT_TELL']), $checkLB), $checkSR)));
eq($rows($run)[1]['Lchk'] . '/' . $rows($run)[1]['Lalt'], 'conflict/UNCLEAR', 'R4 a check that cannot tell does not confirm');
$u = $owner; $u[0]['Lref'] = 'UNCLEAR';
$run = run_media($u, check_ans($checkAll));
eq($rows($run)[0]['Lchk'] . '/' . $rows($run)[0]['Lalt'], 'unclear/CENTER', 'R5 UNCLEAR stays unclear, with the check offered as a candidate');
$run = run_media($owner, check_ans(array_merge(array_slice($checkLB, 1), $checkSR)));
eq([$rows($run)[0]['Lchk'], $rows($run)[1]['Lchk']], ['unmatched', 'agree'], 'R6 M12 not reported by the check: unmatched; M16 agrees');
$n0 = $owner; $n0[0]['Lref'] = null; $n0[0]['Wref'] = null;
$c9 = $checkAll; $c9[0] = bolt('M12', 250, 50, 'NOT_DRAWN', 'FAR_FACE');
$run = run_media($n0, check_ans($c9));
eq($rows($run)[0]['Lchk'] . '/' . $rows($run)[0]['Wchk'], 'agree/agree', 'R9 null and NOT_DRAWN / FAR_FACE are the same as-printed value');
$c9[0] = bolt('M12', 250, 50, 'CENTRE_LINE', 'FAR_FACE');
$run = run_media($n0, check_ans($c9));
eq($rows($run)[0]['Lchk'], 'conflict', 'R9 null vs CENTRE_LINE is a conflict');
$run = run_media([item(['L' => 250]), item(['L' => 400])], check_ans([bolt('M12', 400, 50, 'FAR_FACE', 'FAR_FACE'), bolt('M 12', 250, 50, 'CENTRE_LINE', 'FAR_FACE')]));
eq([$rows($run)[0]['Lchk'], $rows($run)[1]['Lchk']], ['agree', 'conflict'], 'R10 rows with the same M are matched on L ("M 12" normalised)');
$run = run_media([item()], check_ans([bolt('M12', 999, 0, 'CENTRE_LINE', 'FAR_FACE'), bolt('M12', 998, 0, 'FAR_FACE', 'FAR_FACE')]));
eq($rows($run)[0]['Lchk'], 'unmatched', 'R10 ambiguous duplicates that disagree are not guessed between');
// the check request: same images, never the first answer, short schema within strict limits
run_media($owner, check_ans($checkAll), $calls);
$req = $calls[1]['req'];
eq(count(array_filter($req['messages'][0]['content'], fn($c) => $c['type'] === 'image')), 3, 'R11 the check sees the same three images');
ok(strpos(json_encode($req['messages']), 'L_BOLT') === false && strpos(json_encode($req['messages']), '"Lref"') === false, 'R11 the check request carries no extraction output');
eq($req['max_tokens'], AI_REFCHECK_MAX_TOKENS, 'R11 the check has its own answer budget');
ok(AI_REFCHECK_MAX_TOKENS >= 8000, 'R11 budget leaves room for default adaptive thinking plus a long schedule');
$lim = ai_anthropic_schema_limits(ai_refcheck_schema());
ok(count($lim['union']) <= AI_ANTHROPIC_MAX_UNIONS && count($lim['optional']) <= AI_ANTHROPIC_MAX_OPTIONAL && !$lim['enum_type_mismatch'], 'R11 check schema within strict limits');
$ins = ai_refcheck_instructions();
ok(strpos($ins, 'WITHIN its drawn thickness') !== false && strpos($ins, 'B, LEG, LEG LENGTH') !== false, 'R14 the Loop #6 W rules are kept word for word');
ok(strpos($ins, 'Parts drawn only for context') !== false && strpos($ins, 'listed once') !== false, 'R14 coverage is the quotation scope, not every drawn object');

// ── Luna: fallback compared with the check when it answered; Luna-only media uncertain ──
$lunaOk = fn() => [200, ['status' => 'completed', 'output' => [['type' => 'message', 'content' => [['type' => 'output_text',
    'text' => json_encode(['product' => null, 'material' => null, 'finish' => null, 'sizeType' => null, 'threadEnds' => null, 'note' => null, 'items' => [$owner[0]]])]]]],
    'usage' => ['input_tokens' => 9000, 'output_tokens' => 300]], '', 0];
$sonnet = function ($req, $key, $t = 120) use ($checkAll) {
    return isset($req['output_config']['format']['schema']['properties']['items']['items']['properties']['kind']) ? [200, check_ans($checkAll), '', 0] : [503, null, '', 0]; };
$run = ai_extract_media(upload_imgs(), ai_build_payload(upload_imgs()), ['sonnet' => $sonnet, 'luna' => $lunaOk, 'key' => 'k']);
eq([$run['provider'], $rows($run)[0]['Lchk'], $cov($run)['state'], count($cov($run)['missing'])], ['openai', 'agree', 'partial', 9],
   'L1 Sonnet down, check answered: Luna\'s one row is compared and the nine others named');
$sonnetDown = fn() => [503, null, '', 0];
$run = ai_extract_media(upload_imgs(), ai_build_payload(upload_imgs()), ['sonnet' => $sonnetDown, 'luna' => $lunaOk, 'key' => 'k']);
eq([$rows($run)[0]['Lchk'], $cov($run)['state']], ['failed', 'uncertain'], 'L2 both Sonnet calls down: Luna rows unverified, coverage uncertain');
$run = ai_extract_luna(upload_imgs(), ai_build_payload(upload_imgs()), ['luna' => $lunaOk]);
eq($cov($run)['state'], 'uncertain', 'L3 Luna-only media: coverage uncertain');
$run = ai_extract_luna(['kind' => 'text', 'mime' => 'text/plain', 'size' => 3], ai_build_text_payload('M12 x 250'), ['luna' => $lunaOk]);
ok(!isset($run['result']['data']['coverage']) && !isset($rows($run)[0]['Lchk']), 'L4 pasted text: no coverage and no reference fields (unchanged)');

// ── parallel transport against a local stub server (no network) ──
/* A Node server (php -S answers one request at a time, so it cannot show overlap):
   the check-sized request waits 300 ms, the other 600 ms. */
$port = 18000 + random_int(0, 999);
$js = 'require("http").createServer((q,s)=>{let d="";q.on("data",c=>d+=c);q.on("end",()=>{const b=JSON.parse(d||"{}");'
    . 'setTimeout(()=>{s.setHeader("Content-Type","application/json");s.end(JSON.stringify({stop_reason:"end_turn",'
    . 'content:[{type:"text",text:JSON.stringify({which:b.max_tokens})}],usage:{output_tokens:1}}))},b.max_tokens===' . AI_REFCHECK_MAX_TOKENS . '?300:600)})})'
    . '.listen(' . $port . ',"127.0.0.1",()=>console.log("up"))';
$node = trim((string)shell_exec(PHP_OS_FAMILY === 'Windows' ? 'where node 2>NUL' : 'command -v node 2>/dev/null'));
$node = strtok($node, "\r\n");
if (!$node) { ok(false, 'P0 node not found: parallel transport not exercised'); }
else {
    $srv = proc_open([$node, '-e', $js], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    fgets($pipes[1]);                                   // "up"
    define('AI_ANTHROPIC_URL', "http://127.0.0.1:$port/");
    $t0 = microtime(true);
    $r = ai_call_anthropic_multi([['max_tokens' => 32000], ['max_tokens' => AI_REFCHECK_MAX_TOKENS]], 'k', [5, 5]);
    $ms = (microtime(true) - $t0) * 1000;
    proc_terminate($srv);
    $which = array_map(fn($x) => json_decode($x[1]['content'][0]['text'] ?? 'null', true)['which'] ?? null, $r);
    eq([$r[0][0], $r[1][0], $which], [200, 200, [32000, AI_REFCHECK_MAX_TOKENS]], 'P1 both answers come back, each to its own request');
    ok($ms < 850, 'P1 the two requests ran at the same time (' . round($ms) . ' ms for 600 + 300 ms of server time)');
    ok($r[1][4] >= 250 && $r[1][4] < $r[0][4], 'P1 each request reports its own time (' . $r[1][4] . ' / ' . $r[0][4] . ' ms)');
    $r = ai_call_anthropic_multi([['max_tokens' => 1]], 'k', [2]);
    ok($r[0][3] !== 0 && $r[0][2] !== '' && $r[0][1] === null, 'P2 a closed server reports a curl error, not an answer');
}

echo "  " . (count($failures) ? 'FAIL' : 'ok  ')
   . "  ai_refcheck — coverage complete / partial / uncertain + L Bolt references  ($asserts assertions"
   . (count($failures) ? ', ' . count($failures) . ' failed' : '') . ")\n";
foreach ($failures as $f) echo "   - $f\n";
exit(count($failures) ? 1 : 0);
