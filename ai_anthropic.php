<?php
/**
 * Der-Cheng Quotation — Anthropic (Claude Sonnet) transport for image / PDF extraction.
 *
 * Included by ai_extract.php only. The prompt, the canonical schema, the
 * payload builder and the sanitiser all stay in ai_extract.php: this file only
 * translates the SAME request into Anthropic's Messages API and the answer back
 * into the canonical QUO shape, so both providers are judged by one set of rules.
 *
 * Measured before it was written (2026-11-03): claude-sonnet-5-5 with this exact
 * schema adapter and the unchanged production prompt read 39 real drawings with
 * 1 dangerous-error file (Luna: 12), 5 PDFs as native document blocks and 2-5
 * image requests without mixing images.
 */

if (!defined('AI_EXTRACT_ENTRY')) { http_response_code(403); exit; }

const AI_ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5-5';
const AI_ANTHROPIC_VERSION       = '2026-10-21';
const AI_ANTHROPIC_DEFAULT_URL   = 'https://api.anthropic.com/v1/messages';
/* Anthropic's per-image cap is on the BASE64 text, measured from its own 400:
   "image exceeds 10 MB maximum: 10652224 bytes > 10485760 bytes". The preflight
   keeps 5 % below it, so a file is routed elsewhere before the API refuses it. */
const AI_ANTHROPIC_IMAGE_B64_LIMIT = 10485760;
const AI_ANTHROPIC_PREFLIGHT_MARGIN = 0.05;
/* Anthropic's strict-schema limits. tests/php/ai_anthropic.test.php fails if a
   future change to ai_output_schema() pushes the adapted schema past either. */
const AI_ANTHROPIC_MAX_UNIONS   = 16;
const AI_ANTHROPIC_MAX_OPTIONAL = 24;

function ai_anthropic_model() {
    return defined('AI_ANTHROPIC_MODEL') && AI_ANTHROPIC_MODEL !== '' ? AI_ANTHROPIC_MODEL : AI_ANTHROPIC_DEFAULT_MODEL;
}
function ai_anthropic_url() {
    return defined('AI_ANTHROPIC_URL') && AI_ANTHROPIC_URL !== '' ? AI_ANTHROPIC_URL : AI_ANTHROPIC_DEFAULT_URL;
}

/**
 * The key: environment first, then ai_config.php. Whitespace and control
 * characters are removed — an API key never contains them, and a line break
 * pasted into the middle of one makes curl refuse the header outright.
 */
function ai_anthropic_key() {
    $env = getenv('ANTHROPIC_API_KEY');
    $raw = ($env !== false && trim($env) !== '') ? $env : (defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : '');
    $key = preg_replace('/[\s\x00-\x1F\x7F]+/', '', (string)$raw);
    return $key === 'sk-ant-REPLACE-ME' ? '' : $key;
}

// ── schema adapter v2 ────────────────────────────────────────────────────────
/* Anthropic allows at most 16 union-typed and 24 optional parameters per strict
   schema; the canonical schema has 25 nullable (= union) ones. Each field is
   placed in exactly one bucket, derived from ai_output_schema() at run time:
     - product (document and row): stays nullable AND required, spelled anyOf.
       When it was optional instead, the model stopped setting row products and
       used "OTHER" for "not stated" — measured, so it must stay required.
     - threadEnds, Lref, Wref (enums) and note, Bmid, bodyDia, R, row sizeType:
       non-null and optional; an omitted key is read back as null.
     - every other field keeps its production nullable declaration verbatim. */
const AI_ANTHROPIC_OPTIONAL = [
    'doc'  => ['threadEnds', 'note'],
    'item' => ['threadEnds', 'Lref', 'Wref', 'Bmid', 'bodyDia', 'R', 'sizeType'],
];

function ai_anthropic_non_null($prop) {
    if (isset($prop['type']) && is_array($prop['type'])) {
        $t = array_values(array_filter($prop['type'], fn($x) => $x !== 'null'));
        $prop['type'] = count($t) === 1 ? $t[0] : $t;
    }
    if (isset($prop['enum'])) $prop['enum'] = array_values(array_filter($prop['enum'], fn($v) => $v !== null));
    return $prop;
}

function ai_anthropic_adapt_object($obj, $level) {
    foreach (AI_ANTHROPIC_OPTIONAL[$level] as $k) {
        if (!isset($obj['properties'][$k])) throw new RuntimeException("anthropic schema: $level.$k missing from ai_output_schema()");
        $obj['properties'][$k] = ai_anthropic_non_null($obj['properties'][$k]);
    }
    $p = $obj['properties']['product'];
    $vals = array_values(array_filter($p['enum'], fn($v) => $v !== null));
    $obj['properties']['product'] = ['anyOf' => [['type' => 'string', 'enum' => $vals], ['type' => 'null']]];
    $obj['required'] = array_values(array_diff($obj['required'], AI_ANTHROPIC_OPTIONAL[$level]));
    return $obj;
}

function ai_anthropic_schema($canonical) {
    $s = ai_anthropic_adapt_object($canonical, 'doc');
    $s['properties']['items']['items'] = ai_anthropic_adapt_object($canonical['properties']['items']['items'], 'item');
    return $s;
}

/** What Anthropic counts: union-typed and optional parameters, recursively. */
function ai_anthropic_schema_limits($s, $path = '$', &$acc = null) {
    if ($acc === null) $acc = ['union' => [], 'optional' => [], 'enum_type_mismatch' => []];
    if (isset($s['properties'])) {
        $req = array_flip($s['required'] ?? []);
        foreach ($s['properties'] as $k => $p) {
            $pp = "$path.$k";
            if ((isset($p['type']) && is_array($p['type'])) || isset($p['anyOf'])) $acc['union'][] = $pp;
            if (!isset($req[$k])) $acc['optional'][] = $pp;
            if (isset($p['enum'], $p['type'])) {
                foreach ($p['enum'] as $v) {
                    $vt = $v === null ? 'null' : (is_int($v) ? 'integer' : (is_string($v) ? 'string' : gettype($v)));
                    if (!in_array($vt, (array)$p['type'], true)) { $acc['enum_type_mismatch'][] = $pp; break; }
                }
            }
            ai_anthropic_schema_limits($p, $pp, $acc);
        }
    }
    if (isset($s['items'])) ai_anthropic_schema_limits($s['items'], $path . '[]', $acc);
    return $acc;
}

/** Every canonical key back, in canonical order; an omitted key is null. */
function ai_anthropic_canonical($decoded, $canonical) {
    if (!is_array($decoded)) return null;
    $out = [];
    foreach (array_keys($canonical['properties']) as $k) if ($k !== 'items') $out[$k] = $decoded[$k] ?? null;
    if (!isset($decoded['items']) || !is_array($decoded['items'])) return $out;   // stays invalid, as it was
    $keys = array_keys($canonical['properties']['items']['items']['properties']);
    $out['items'] = [];
    foreach ($decoded['items'] as $it) {
        if (!is_array($it)) continue;
        $row = [];
        foreach ($keys as $k) $row[$k] = $it[$k] ?? null;
        $out['items'][] = $row;
    }
    return $out;
}

// ── request ──────────────────────────────────────────────────────────────────
/**
 * The production Responses-API payload as a Messages request. Same instructions
 * (cached: identical on every call), same content in the same order: the lead
 * and note text, "Image i of n:" labels, images, and a PDF as ONE native
 * document block — never rendered to images.
 */
function ai_anthropic_request($payload) {
    $content = [];
    foreach ($payload['input'][0]['content'] as $part) {
        if ($part['type'] === 'input_text') { $content[] = ['type' => 'text', 'text' => $part['text']]; continue; }
        $url = $part['image_url'] ?? $part['file_data'] ?? '';
        if (!preg_match('#^data:([^;]+);base64,(.*)$#s', $url, $m)) continue;
        $src = ['type' => 'base64', 'media_type' => $m[1], 'data' => $m[2]];
        $content[] = $part['type'] === 'input_file' ? ['type' => 'document', 'source' => $src] : ['type' => 'image', 'source' => $src];
    }
    return [
        'model'      => ai_anthropic_model(),
        'max_tokens' => $payload['max_output_tokens'],
        'system'     => [['type' => 'text', 'text' => $payload['instructions'], 'cache_control' => ['type' => 'ephemeral']]],
        'messages'   => [['role' => 'user', 'content' => $content]],
        'output_config' => ['format' => ['type' => 'json_schema', 'schema' => ai_anthropic_schema($payload['text']['format']['schema'])]],
    ];
}

/**
 * Before any call: can every image be sent? The base64 size is computed, not
 * guessed, and compared with the provider limit less the margin. Nothing is
 * decoded or resized here.
 */
function ai_anthropic_preflight($upload) {
    $parts = ($upload['kind'] ?? '') === 'images' ? $upload['parts'] : [$upload];
    $limit = (int)floor(AI_ANTHROPIC_IMAGE_B64_LIMIT * (1 - AI_ANTHROPIC_PREFLIGHT_MARGIN));
    foreach ($parts as $i => $p) {
        if (($p['kind'] ?? '') !== 'image') continue;
        $b64 = 4 * (int)ceil(strlen($p['bytes']) / 3);
        if ($b64 > $limit) return ['ok' => false, 'detail' => 'image ' . ($i + 1) . " base64 $b64 > $limit"];
    }
    return ['ok' => true, 'detail' => ''];
}

// ── transport + answer ──────────────────────────────────────────────────────
/** POST to the Messages API. Returns [httpCode, decodedBody|null, curlErr, curlErrNo]. */
function ai_call_anthropic($request, $key, $timeout = 120) {
    $ch = curl_init(ai_anthropic_url());
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($request),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'x-api-key: ' . $key, 'anthropic-version: ' . AI_ANTHROPIC_VERSION],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $raw   = curl_exec($ch);
    $err   = curl_error($ch);
    $errNo = curl_errno($ch);
    $code  = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$code, is_string($raw) ? json_decode($raw, true) : null, $err, $errNo];
}

/**
 * Reduce a Messages response to the production decision path. `outcome` is
 * one word: a TECHNICAL failure (the provider did not give a usable answer) or
 * a SEMANTIC result (an answer, possibly an uncertain one). The caller decides
 * what each means; this function only names it.
 */
function ai_anthropic_result($code, $body, $curlErr, $curlErrNo) {
    $r = ['outcome' => 'ok', 'http' => $code, 'data' => null, 'truncated' => false,
          'usage' => ['in' => 0, 'cached_in' => 0, 'cache_write' => 0, 'out' => 0]];
    if ($curlErrNo === 28) { $r['outcome'] = 'timeout'; return $r; }
    if ($curlErr !== '' || $curlErrNo) { $r['outcome'] = 'network'; return $r; }
    if ($code === 401 || $code === 403) { $r['outcome'] = 'auth'; return $r; }
    if ($code === 429) { $r['outcome'] = 'rate'; return $r; }
    if ($code >= 500) { $r['outcome'] = 'upstream'; return $r; }          // 500, 502, 503, 529 overloaded
    if ($code !== 200) { $r['outcome'] = 'request'; return $r; }          // 400 schema/size, 413
    $u = is_array($body) ? ($body['usage'] ?? []) : [];
    $r['usage'] = ['in' => (int)($u['input_tokens'] ?? 0) + (int)($u['cache_read_input_tokens'] ?? 0) + (int)($u['cache_creation_input_tokens'] ?? 0),
                   'cached_in' => (int)($u['cache_read_input_tokens'] ?? 0), 'cache_write' => (int)($u['cache_creation_input_tokens'] ?? 0),
                   'out' => (int)($u['output_tokens'] ?? 0)];
    $stop = is_array($body) ? ($body['stop_reason'] ?? '') : '';
    if ($stop === 'refusal') { $r['outcome'] = 'refusal'; return $r; }
    $text = null;
    foreach ((is_array($body) ? ($body['content'] ?? []) : []) as $b) {
        if (($b['type'] ?? '') === 'text') $text = ($text ?? '') . $b['text'];
    }
    $dec = $text !== null ? json_decode($text, true) : null;
    if (is_array($dec)) $text = json_encode(ai_anthropic_canonical($dec, ai_output_schema()));
    $r['data'] = $text !== null ? ai_sanitise_extraction($text) : null;
    if ($stop === 'max_tokens') {
        if ($r['data'] === null && $text !== null && ($s = ai_salvage_extraction($text)) !== null) $r['data'] = ai_sanitise_data($s);
        $r['truncated'] = true;
        if ($r['data'] === null) { $r['outcome'] = 'too_long'; return $r; }   // semantic: the document is too big
    }
    if ($r['data'] === null) { $r['outcome'] = 'malformed'; return $r; }
    return $r;
}
