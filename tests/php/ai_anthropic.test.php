<?php
/**
 * ── Sonnet (Anthropic) path: schema adapter, request, answer, fallback ─────
 *
 * Run:  php tests/php/ai_anthropic.test.php
 *
 * No network: both transports are replaced by stubs that return what the
 * provider would. The fallback matrix is the one measured against the real
 * APIs in the 2026-11-03 media precheck.
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
    return array_merge(['M' => 'M30', 'L' => 300, 'W' => null, 'TL' => 80, 'qty' => 6, 'Bmid' => null, 'material' => null,
        'finish' => null, 'sizeType' => null, 'unclear' => null, 'product' => 'ANCHOR_BOLT', 'threadEnds' => null,
        'bodyDia' => null, 'H' => null, 'ID' => null, 'S' => null, 'R' => null, 'Lref' => null, 'Wref' => null], $o);
}
/* A Messages API answer as the provider sends it. */
function claude($items, $stop = 'end_turn', $usage = ['input_tokens' => 120, 'output_tokens' => 80, 'cache_read_input_tokens' => 14000, 'cache_creation_input_tokens' => 0]) {
    $text = is_string($items) ? $items : json_encode(['product' => null, 'material' => null, 'finish' => null, 'sizeType' => null, 'items' => $items]);
    return ['stop_reason' => $stop, 'content' => $text === null ? [] : [['type' => 'text', 'text' => $text]], 'usage' => $usage];
}
/* A Responses API answer as OpenAI sends it. */
function luna($items) {
    return ['status' => 'completed', 'output' => [['type' => 'message', 'content' => [['type' => 'output_text',
        'text' => json_encode(['product' => null, 'material' => null, 'finish' => null, 'sizeType' => null, 'threadEnds' => null, 'note' => null, 'items' => $items])]]]],
        'usage' => ['input_tokens' => 9300, 'output_tokens' => 279]];
}
function upload_image($bytes = 'img') { return ['ok' => true, 'kind' => 'image', 'mime' => 'image/jpeg', 'bytes' => $bytes, 'size' => strlen($bytes), 'name' => 'a.jpg']; }

// ── schema adapter v2 ──────────────────────────────────────────────────────
$canon = ai_output_schema();
$s = ai_anthropic_schema($canon);
$lim = ai_anthropic_schema_limits($s);
ok(count($lim['union']) <= AI_ANTHROPIC_MAX_UNIONS, 'the adapted schema stays within Anthropic\'s union limit (' . count($lim['union']) . ' of ' . AI_ANTHROPIC_MAX_UNIONS . ') — a schema change that breaks this would break Sonnet in production');
ok(count($lim['optional']) <= AI_ANTHROPIC_MAX_OPTIONAL, 'and within the optional-parameter limit (' . count($lim['optional']) . ' of ' . AI_ANTHROPIC_MAX_OPTIONAL . ')');
eq($lim['enum_type_mismatch'], [], 'no enum disagrees with its type');
ok(in_array('product', $s['required'], true) && in_array('product', $s['properties']['items']['items']['required'], true),
   'product is REQUIRED at document and row level (optional product made the model write OTHER for "not stated")');
ok(in_array(['type' => 'null'], $s['properties']['items']['items']['properties']['product']['anyOf'], true), 'and a row product can still be null');
eq(array_keys($s['properties']['items']['items']['properties']), array_keys($canon['properties']['items']['items']['properties']),
   'every canonical row field is still in the schema, in order');

$omitted = ['material' => null, 'finish' => 'HDG', 'sizeType' => null, 'product' => null,
            'items' => [['M' => 'M12', 'L' => 1070, 'W' => null, 'TL' => 100, 'qty' => 2, 'material' => null, 'finish' => null,
                         'unclear' => null, 'H' => null, 'ID' => null, 'S' => null, 'product' => 'SAG_ROD']]];
$norm = ai_anthropic_canonical($omitted, $canon);
eq(array_keys($norm['items'][0]), array_keys($canon['properties']['items']['items']['properties']), 'an answer that omits optional keys comes back in the full canonical shape');
eq($norm['items'][0]['Lref'], null, 'and an omitted key is null');
ok(ai_sanitise_data($norm) !== null, 'which the production sanitiser accepts');

// ── request mapping ────────────────────────────────────────────────────────
$req = ai_anthropic_request(ai_build_payload(upload_image('photo'), 'H 530', []));
$blocks = array_map(fn($b) => $b['type'], $req['messages'][0]['content']);
eq($blocks, ['text', 'image'], 'one photo: the lead text (with the staff note) then the image');
ok(strpos($req['messages'][0]['content'][0]['text'], 'H 530') !== false, 'the staff note reaches Sonnet through the same lead text Luna gets');
eq($req['model'], 'claude-sonnet-5-5', 'the measured model');
eq($req['system'][0]['text'], ai_instructions(), 'the production instructions, unchanged');
eq($req['output_config']['format']['schema'], ai_anthropic_schema($canon), 'the adapted schema');

$multi = ['ok' => true, 'kind' => 'images', 'mime' => 'images/3', 'size' => 9,
          'parts' => [upload_image('one'), upload_image('two'), upload_image('three')]];
$req = ai_anthropic_request(ai_build_payload($multi, '', ['', 'only image 2', '']));
$c = $req['messages'][0]['content'];
eq(array_map(fn($b) => $b['type'], $c), ['text', 'text', 'image', 'text', 'image', 'text', 'text', 'image'], 'three images: label, image, in order, with image 2\'s own note beside it');
eq([$c[1]['text'], $c[3]['text'], $c[6]['text']], ['Image 1 of 3:', 'Image 2 of 3:', 'Image 3 of 3:'], 'each image keeps its "Image i of n" label');
eq([base64_decode($c[2]['source']['data']), base64_decode($c[4]['source']['data']), base64_decode($c[7]['source']['data'])], ['one', 'two', 'three'], 'images in upload order');

$pdf = ['ok' => true, 'kind' => 'pdf', 'mime' => 'application/pdf', 'bytes' => '%PDF-1.4 x', 'size' => 10, 'name' => 'po.pdf'];
$req = ai_anthropic_request(ai_build_payload($pdf, '', []));
$doc = $req['messages'][0]['content'][1];
eq([$doc['type'], $doc['source']['media_type']], ['document', 'application/pdf'], 'a PDF goes as ONE native document block, never rendered to images');

// ── preflight ──────────────────────────────────────────────────────────────
$limit = (int)floor(AI_ANTHROPIC_IMAGE_B64_LIMIT * (1 - AI_ANTHROPIC_PREFLIGHT_MARGIN));
$rawMax = intdiv($limit, 4) * 3;
ok(ai_anthropic_preflight(upload_image(str_repeat('a', $rawMax)))['ok'], 'an image whose base64 sits just under the limit less the margin is sent');
ok(!ai_anthropic_preflight(upload_image(str_repeat('a', $rawMax + 3)))['ok'], 'one a few bytes over is not');
ok(ai_anthropic_preflight($pdf)['ok'], 'a PDF is not judged by the image limit');
$big = $multi; $big['parts'][1] = upload_image(str_repeat('a', $rawMax + 3));
ok(!ai_anthropic_preflight($big)['ok'], 'one oversize image in a multi-image upload stops the whole Sonnet request');

// ── answer parsing ─────────────────────────────────────────────────────────
$r = ai_anthropic_result(200, claude([item()]), '', 0);
eq([$r['outcome'], count($r['data']['items'])], ['ok', 1], 'a normal answer: ok, one row');
eq($r['usage'], ['in' => 14120, 'cached_in' => 14000, 'cache_write' => 0, 'out' => 80], 'tokens: cached prompt counted as input, and kept apart');
eq(ai_est_usd('anthropic', $r['usage']), round((120 * 2.00 + 14000 * 0.10 + 80 * 10.00) / 1e6, 6), 'cost: cache reads at the cache price');
foreach ([[401, 'auth'], [403, 'auth'], [429, 'rate'], [500, 'upstream'], [529, 'upstream'], [400, 'request'], [413, 'request']] as [$h, $want]) {
    eq(ai_anthropic_result($h, ['type' => 'error'], '', 0)['outcome'], $want, "HTTP $h is $want");
}
eq(ai_anthropic_result(0, null, 'Operation timed out', 28)['outcome'], 'timeout', 'curl 28 is a timeout');
eq(ai_anthropic_result(0, null, 'Failed to connect', 7)['outcome'], 'network', 'curl 7 is a network failure');
eq(ai_anthropic_result(200, claude('M30 x 300 {not json'), '', 0)['outcome'], 'malformed', 'text that is not JSON is malformed');
eq(ai_anthropic_result(200, claude(null, 'refusal'), '', 0)['outcome'], 'refusal', 'a refusal is named');
$full = json_encode(['product' => null, 'material' => null, 'finish' => null, 'sizeType' => null, 'items' => [item(), item(['L' => 450]), item(['L' => 600])]]);
$r = ai_anthropic_result(200, claude(substr($full, 0, (int)(strlen($full) * 0.8)), 'max_tokens'), '', 0);
eq([$r['outcome'], $r['truncated'], count($r['data']['items'])], ['ok', true, 2], 'cut off mid-answer: the whole rows are kept and marked truncated');
eq(ai_anthropic_result(200, claude('{"items":[{"M":"M3', 'max_tokens'), '', 0)['outcome'], 'too_long', 'cut off with nothing whole: too long, not malformed');

// ── key ────────────────────────────────────────────────────────────────────
putenv("ANTHROPIC_API_KEY=sk-ant-abc\ndef \r");
eq(ai_anthropic_key(), 'sk-ant-abcdef', 'the key loses line breaks and spaces (a pasted line break made curl refuse the header)');
putenv('ANTHROPIC_API_KEY');
eq(ai_anthropic_key(), '', 'no environment key and no config key: empty');

// ── provider switch ────────────────────────────────────────────────────────
eq(ai_image_provider(), 'luna', 'unset switch: Luna, today\'s behaviour');

// ── fallback matrix (stub transports; counts every call) ────────────────────
$payload = ai_build_payload(upload_image('photo'), '', []);
function run_case($sonnetAnswer, $opts = []) {
    global $payload;
    $calls = ['sonnet' => 0, 'luna' => 0, 'check' => 0];
    $deps = [
        'key' => $opts['key'] ?? 'sk-ant-test',
        'sonnet' => function ($req, $key) use (&$calls, $sonnetAnswer) { $calls['sonnet']++; return $sonnetAnswer; },
        'luna' => function ($p) use (&$calls) { $calls['luna']++; return [200, luna([item(['L' => 300])]), '', 0]; },
        /* Loop #7: the second reading (coverage + L Bolt references) always goes out
           beside the extraction; it is not a retry and is counted on its own. */
        'refcheck' => function ($req, $key, $timeout = 60) use (&$calls) { $calls['check']++;
            return [200, ['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => '{"items":[]}']], 'usage' => []], '', 0]; },
    ];
    $run = ai_extract_media($opts['upload'] ?? upload_image('photo'), $payload, $deps);
    return [$run, $calls];
}
$big1 = upload_image(str_repeat('a', $rawMax + 3));
$TECH = [
    'missing key'       => [[200, claude([item()]), '', 0], ['key' => ''], 'not_configured', 0],
    'invalid key (401)' => [[401, ['type' => 'error'], '', 0], [], 'auth', 1],
    'timeout'           => [[0, null, 'timed out', 28], [], 'timeout', 1],
    'HTTP 429'          => [[429, ['type' => 'error'], '', 0], [], 'rate', 1],
    'HTTP 500'          => [[500, ['type' => 'error'], '', 0], [], 'upstream', 1],
    'HTTP 529'          => [[529, ['type' => 'error'], '', 0], [], 'upstream', 1],
    'malformed JSON'    => [[200, claude('not json {'), '', 0], [], 'malformed', 1],
    'network failure'   => [[0, null, 'Failed to connect', 7], [], 'network', 1],
    'oversize preflight' => [[200, claude([item()]), '', 0], ['upload' => $big1], 'preflight_oversize', 0],
    'refusal'           => [[200, claude(null, 'refusal'), '', 0], [], 'refusal', 1],
];
foreach ($TECH as $name => [$answer, $opts, $reason, $sonnetCalls]) {
    [$run, $calls] = run_case($answer, $opts);
    eq([$run['provider'], $run['fallback'], $run['review']], ['openai', $reason, true], "$name: one Luna fallback, reason $reason, Review Needed");
    eq($calls, ['sonnet' => $sonnetCalls, 'luna' => 1, 'check' => $sonnetCalls], "$name: Sonnet $sonnetCalls extraction call(s) (+ the same number of checks), Luna exactly once — no loop");
    $l = end($run['log']);
    eq([$l['provider'], $l['fallback'], $l['fallback_reason']], ['openai', true, $reason], "$name: the log names the fallback and why");
}
$SEMANTIC = [
    'zero rows'           => [[200, claude([]), '', 0], true],
    'truncated, salvaged' => [[200, claude(substr($full, 0, (int)(strlen($full) * 0.8)), 'max_tokens'), '', 0], true],
    'row flagged unclear' => [[200, claude([item(['M' => null, 'unclear' => 'size M20 or M30'])]), '', 0], false],
    'clean answer'        => [[200, claude([item()]), '', 0], false],
];
foreach ($SEMANTIC as $name => [$answer, $review]) {
    [$run, $calls] = run_case($answer);
    eq([$run['provider'], $run['fallback'], $calls['luna']], ['anthropic', null, 0], "$name: no fallback, Luna never called");
    eq($run['review'], $review, "$name: server review flag " . var_export($review, true) . ' (row-level doubt is flagged by the browser)');
}
[$run, $calls] = run_case([200, claude('{"items":[{"M":"M3', 'max_tokens'), '', 0]);
eq([$run['result']['error']['error'], $calls['luna']], ['ai_too_long', 0], 'cut off with nothing whole: "split the document", no fallback');
[$run] = run_case([200, claude([item(['M' => null, 'unclear' => 'size M20 or M30'])]), '', 0]);
eq($run['result']['data']['items'][0]['M'], null, 'an unclear Sonnet field stays null — Luna never fills it');

// ── logs carry no secret and no content ────────────────────────────────────
[$run] = run_case([401, ['type' => 'error'], '', 0]);
$logText = json_encode($run['log']);
ok(strpos($logText, 'sk-ant-test') === false && strpos($logText, 'sk-test') === false, 'no API key in any log line');
ok(strpos($logText, base64_encode('photo')) === false && !preg_match('/[A-Za-z0-9+\/]{120,}/', $logText), 'no file content in any log line');
eq(array_keys($run['log'][0]), ['kind', 'mime', 'size', 'provider', 'model', 'ms', 'http', 'outcome', 'in', 'cached_in', 'cache_write', 'out',
    'est_usd', 'items', 'fallback', 'fallback_reason', 'preflight'], 'one structured log line per call, fixed fields');

// ── report ─────────────────────────────────────────────────────────────────
echo "  " . (count($failures) ? 'FAIL' : 'ok  ')
   . "  ai_anthropic — Sonnet schema, request, answer and fallback matrix  ($asserts assertions"
   . (count($failures) ? ', ' . count($failures) . ' failed' : '') . ")\n";
foreach ($failures as $f) echo "   - $f\n";
exit(count($failures) ? 1 : 0);
