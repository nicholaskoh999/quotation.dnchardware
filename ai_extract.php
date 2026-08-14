<?php
/**
 * Der-Cheng Quotation — AI photo / PDF extraction endpoint (Quick Add V2.1)
 *
 * POST multipart/form-data { file }  -> JSON { ok, data | error }   photo / PDF
 * POST                      { text }  -> JSON { ok, data | error }   pasted text
 *
 * Exactly one of the two per request. Both shapes share the same instructions,
 * the same JSON schema and the same sanitiser, so there is one set of
 * extraction rules rather than a second, drifting prompt for text.
 *
 * The browser NEVER talks to OpenAI. This endpoint receives the upload,
 * validates it, sends it to the OpenAI Responses API server-side with a strict
 * JSON-Schema structured output, deletes the temp file, and returns only the
 * validated extraction. The uploaded document is never written into the
 * quotation database and no copy is kept by this app.
 *
 * The AI only EXTRACTS. It never prices anything and never saves anything —
 * its output is re-normalised through the existing Quick Add business rules
 * in the browser and then flows through the normal review -> Add path.
 */

define('AI_EXTRACT_ENTRY', 1);

require_once __DIR__ . '/auth.php';

// ── configuration ────────────────────────────────────────────────────────────
// Environment variable first (preferred), ai_config.php as the shared-hosting
// fallback. The sample ships as ai_config.sample.php; the real file is created
// on the server only, like db.php.
if (is_file(__DIR__ . '/ai_config.php')) {
    require_once __DIR__ . '/ai_config.php';
}
if (!defined('OPENAI_API_KEY')) {
    $envKey = getenv('OPENAI_API_KEY');
    define('OPENAI_API_KEY', $envKey === false ? '' : $envKey);
}
if (!defined('AI_EXTRACT_MODEL_PRIMARY')) {
    // Same model production runs, so an install using only the environment key
    // behaves identically to one with a full ai_config.php.
    define('AI_EXTRACT_MODEL_PRIMARY', 'gpt-5.6-luna');
}

const AI_MAX_IMAGE_BYTES = 10485760;  // 10 MB
const AI_MAX_PDF_BYTES   = 20971520;  // 20 MB
const AI_MAX_PDF_PAGES   = 10;
const AI_MAX_ITEMS       = 100;
/* Pasted WhatsApp text. Generous for a long customer list, small enough that a
   pasted document can never turn into a large bill. */
const AI_MAX_TEXT_CHARS  = 6000;

const AI_ALLOWED_MIME = [
    'image/jpeg' => 'image',
    'image/png'  => 'image',
    'image/webp' => 'image',
    'application/pdf' => 'pdf',
];

// ── validation ───────────────────────────────────────────────────────────────

/** Cheap PDF page count from the /Count entry of the page tree; 0 = unknown. */
function ai_pdf_page_count($bytes) {
    if (preg_match_all('/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/s', $bytes, $m)) {
        return max(array_map('intval', $m[1]));
    }
    if (preg_match_all('/\/Type\s*\/Page[^s]/', $bytes, $m)) {
        return count($m[0]);
    }
    return 0;
}

/**
 * Validate one uploaded file. Returns
 *   ['ok'=>true,'kind'=>'image'|'pdf','mime'=>...,'bytes'=>...,'name'=>...]
 * or ['ok'=>false,'error'=>...,'message'=>...].
 * MIME comes from finfo on the CONTENT, never from the client, so renaming a
 * .txt to .png does not get past this.
 */
function ai_validate_upload($file) {
    if (!is_array($file) || !isset($file['error'])) {
        return ['ok'=>false,'error'=>'no_file','message'=>'No file was uploaded.'];
    }
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        return ['ok'=>false,'error'=>'too_large','message'=>'The file is larger than the server upload limit.'];
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['ok'=>false,'error'=>'upload_failed','message'=>'The upload did not complete. Please try again.'];
    }
    $size = (int)$file['size'];
    if ($size <= 0) {
        return ['ok'=>false,'error'=>'empty_file','message'=>'The file is empty.'];
    }
    /* The fileinfo extension is not guaranteed on shared hosting — a cPanel
       MultiPHP version switch once removed it here and every upload died with
       an uncaught "Class 'finfo' not found". Two variants must both land in
       this branch rather than in a fatal: the extension is absent (no class at
       all), or the host neutered it through the disable_classes ini directive,
       which leaves a stub class whose ->file() does not exist.
       Fail CLOSED. Content-based sniffing is the only thing separating a real
       image from an arbitrary payload, so there is deliberately no fallback to
       $file['type'] — the browser controls that field and can set it to
       anything. Better to refuse every upload until an admin fixes the server
       than to accept one unverified. */
    if (!class_exists('finfo') || !method_exists('finfo', 'file')) {
        return ['ok'=>false,'error'=>'no_fileinfo',
                'message'=>'AI upload validation is unavailable because the PHP fileinfo extension is not enabled on this server.'];
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);
    if (!isset(AI_ALLOWED_MIME[$mime])) {
        return ['ok'=>false,'error'=>'unsupported_type',
                'message'=>'Only JPG, PNG, WEBP images and PDF files are supported.'];
    }
    $kind = AI_ALLOWED_MIME[$mime];
    $max  = $kind === 'pdf' ? AI_MAX_PDF_BYTES : AI_MAX_IMAGE_BYTES;
    if ($size > $max) {
        return ['ok'=>false,'error'=>'too_large',
                'message'=>$kind==='pdf' ? 'PDF files must be 20 MB or smaller.'
                                         : 'Images must be 10 MB or smaller.'];
    }
    $bytes = file_get_contents($file['tmp_name']);
    if ($bytes === false) {
        return ['ok'=>false,'error'=>'upload_failed','message'=>'Could not read the uploaded file.'];
    }
    if ($kind === 'pdf') {
        $pages = ai_pdf_page_count($bytes);
        if ($pages > AI_MAX_PDF_PAGES) {
            return ['ok'=>false,'error'=>'too_many_pages',
                    'message'=>'PDFs are limited to '.AI_MAX_PDF_PAGES.' pages for analysis.'];
        }
    }
    $name = preg_replace('/[^A-Za-z0-9._-]/', '_', (string)($file['name'] ?? 'upload'));
    if ($name === '' || $name === '.') $name = $kind === 'pdf' ? 'upload.pdf' : 'upload.png';
    return ['ok'=>true,'kind'=>$kind,'mime'=>$mime,'bytes'=>$bytes,'size'=>$size,'name'=>$name];
}

/**
 * Validate a pasted-text request. Returns
 *   ['ok'=>true,'text'=>...]  or  ['ok'=>false,'error'=>...,'message'=>...].
 * Same result shape as ai_validate_upload() so the endpoint handles both the
 * same way.
 */
function ai_validate_text($raw) {
    if (!is_string($raw)) {
        return ['ok'=>false,'error'=>'no_text','message'=>'No text was supplied.'];
    }
    $t = trim($raw);
    if ($t === '') {
        return ['ok'=>false,'error'=>'no_text','message'=>'No text was supplied.'];
    }
    if (mb_strlen($t) > AI_MAX_TEXT_CHARS) {
        return ['ok'=>false,'error'=>'text_too_long',
                'message'=>'That message is too long to analyze. Trim it and try again.'];
    }
    return ['ok'=>true,'text'=>$t];
}

// ── structured-output schema ─────────────────────────────────────────────────
// Strict JSON Schema: every property required, nullable where genuinely
// unknown, so the model can never invent a dimension to satisfy the schema.
function ai_output_schema() {
    // Deliberately minimal: only the fields Quick Add consumes, compact names,
    // no prose/reasoning/confidence fields — minimum output tokens, and the
    // business rules (G8.8 -> 4140 QT etc.) run in our own code afterwards.
    return [
        'type' => 'object',
        'additionalProperties' => false,
        'properties' => [
            'product' => ['type'=>['string','null'],
                'enum'=>['SAG_ROD','STUD','ANCHOR_BOLT','L_BOLT','OTHER',null]],
            'material' => ['type'=>['string','null']],
            'finish'   => ['type'=>['string','null']],
            'sizeType' => ['type'=>['string','null']],
            // Accessory/assembly wording seen on the document, verbatim and
            // short. Displayed to staff as a note only — Quick Add never turns
            // it into accessories, quantities or prices.
            'note'     => ['type'=>['string','null']],
            'items' => [
                'type'=>'array',
                'items'=>[
                    'type'=>'object',
                    'additionalProperties'=>false,
                    'properties'=>[
                        'M'   => ['type'=>['string','null']],
                        'L'   => ['type'=>['number','null']],
                        'W'   => ['type'=>['number','null']],
                        'TL'  => ['type'=>['number','string','null']],
                        'qty' => ['type'=>['integer','null']],
                        // Centre unthreaded segment of a segmented sag rod
                        // drawing. Never a quotation field — it exists only so
                        // the server can check A + Bmid + C = L deterministically
                        // instead of trusting the model's arithmetic. ~4 tokens.
                        'Bmid' => ['type'=>['number','null']],
                    ],
                    'required'=>['M','L','W','TL','qty','Bmid'],
                ],
            ],
        ],
        'required'=>['product','material','finish','sizeType','note','items'],
    ];
}

function ai_instructions() {
    return <<<'TXT'
Extract fastener quotation specs from the document. Output ONLY the JSON — no
prose, no reasoning, no explanations, no quotes from the source. Never invent a
value: unknown = null. Absent qty = null, never 1. Ignore greetings, logos,
signatures, stamps, prices and unrelated text.

product — classify by GEOMETRY first and customer wording LAST. Titles such as
"Anchor Bolt", "Foundation Bolt", "Bolt", "Bolt & Nut", "Stud" and "Sag Rod"
are used loosely and routinely disagree with what is actually drawn, so the
title is the WEAKEST signal, not the strongest. Never copy the drawing title
into product. Resolve in this order: 1 geometry, 2 dimensional structure,
3 which portions are threaded or bent, 4 drawing annotations, 5 wording.
  - bend/width column (B), or a drawn L / J / U bend -> L_BOLT, even when the
    text says "Anchor Bolt" or "Foundation Bolt"
  - STRAIGHT rod, no bend, threaded at BOTH ends — our M + overall L + TL1/TL2
    shape -> SAG_ROD, even when the title says "Anchor Bolt"
  - straight rod threaded at ONE end only -> SAG_ROD or ANCHOR_BOLT per the
    wording
  - diameter + length only, no thread -> STUD
  - anything else -> OTHER
Geometry has to be VISIBLE to be used. A bare list of lengths and quantities
shows no geometry at all, so none of the above fires — see DO NOT FILL IN WHAT
IS NOT THERE.

Title-vs-geometry worked example. "DETAIL OF ANCHOR BOLT (GR8.8)": one straight
rod, no bend, 48 dimensioned across the rod, overall length 3850, top thread
250, bottom thread 100, middle not dimensioned, no quantity ->
  product SAG_ROD (geometry beats the title), material "GR8.8"
  {"M":"M48","L":3850,"W":null,"TL":"250/100","qty":null,"Bmid":null}
L is the OVERALL 3850. A shorter dimension elsewhere on the same drawing (3600)
is a reference dimension, not L. Bmid stays null because the plain middle is
not dimensioned — never compute it.

material / finish / sizeType — copy the raw wording exactly, do not translate
(materials: MS, S45C, 4140, 4140 QT, G8.8, GR8.8, Grade 8.8, Y BAR; finishes:
PL, Plain, ZP, HDG; size types: Fullsize, Undersize, F/S, U/S). Never infer a
finish that is not written: no wording means finish = null.

note — accessory or assembly wording exactly as written, e.g. "C/W 5PCS NUTS &
2FW" -> "5 Nuts + 2 FW". Keep it under 40 characters, or null when the document
mentions none. Accessories are informational ONLY: never put nuts, washers or
lock nuts into items, never let them change qty, never price them. Staff decide
accessories by hand.

items — one per document row, in document order:
  M  = diameter (M12, M39). A dimension drawn ACROSS the rod — a section width,
       a leader onto the shaft, a "48" spanning the rod's thickness — IS the
       diameter, so 48 across the rod means M48. Use it only where the drawing
       context makes it a metric rod diameter; an unrelated 48 somewhere else
       on the sheet is not M48.
  L  = length in mm — see the drawing rule below
  W  = bend/width in mm (B column on an L-bolt table), null when absent. On a
       straight rod with no bend W is null — a dimension across the rod is M,
       never W.
  TL = thread length; a pair as the string "75/75" or "50/110", preserving
       asymmetry exactly; a single value as a number
  Bmid = centre unthreaded segment of a segmented sag rod drawing, else null.
       This is NOT the L-bolt bend column — a bend/B column goes to W.
  qty from pcs/pc/nos/qty — a quantity is never a dimension
Aliases: D/Dia=diameter · L/Length · TL/Thread/Thread Length · B/Bend/Width ·
Qty/Quantity/Nos/Pcs.

SEGMENTED SAG ROD DRAWINGS — READ THE ROLE, NOT THE LABEL
A sag rod drawing often splits the rod into a threaded end, a plain middle and a
threaded end. Customers label those parts in many ways, or not at all:
  A/B/C · TL1/CENTER/TL2 · THREAD 1/PLAIN/THREAD 2 · LEFT TL/CENTER/RIGHT TL ·
  TL/BODY/TL · T1/MID/T2 · THD 68/CENTER 12/THD 20 · 68/12/20 · 68 + 12 + 20 ·
  68mm THREAD/12mm PLAIN/20mm THREAD · bare numbers on an unlabelled drawing
Never key off the letters. Work out which segment is which from the geometry
(which portions are drawn with thread hatching), from words like TL, THREAD,
THD, PLAIN, CENTER, BODY, MID, from the overall dimension, and from arithmetic.
Then map SEMANTICALLY:
  L    = the OVERALL total rod length (the heading dimension, e.g. M20 x 100mm)
  TL   = "left threaded / right threaded", asymmetry preserved exactly
  Bmid = the plain/centre segment, whatever it is called — validation only
Never map a plain/centre/body length into L. Never assume the first and last
numbers are the threads unless the drawing or wording supports it.
Validate where possible: threaded + plain + threaded should equal L.
  M20 x 100mm total, 68 threaded / 12 plain / 20 threaded, 24 pcs
    -> {"M":"M20","L":100,"W":null,"TL":"68/20","qty":24,"Bmid":12}
  M30 x 70mm total, TL1 39 / CENTER 9 / TL2 22, 16 pcs
    -> {"M":"M30","L":70,"W":null,"TL":"39/22","qty":16,"Bmid":9}
  M12 x 55mm total, THD 35 / PLAIN 7 / THD 13, 20 pcs
    -> {"M":"M12","L":55,"W":null,"TL":"35/13","qty":20,"Bmid":7}
If only one threaded length is visible and nothing indicates the ends match, do
NOT invent the other side. If the roles are genuinely ambiguous, return null for
that field rather than guessing. If the numbers cannot be reconciled, report
exactly what is printed — never adjust them to make them add up, never drop the
row. Semantic interpretation, not pattern matching.

HANDWRITTEN SHORTHAND LISTS
Rows shaped "<number> - <number>pcs" or "<number> - <number> nos" in what is
plainly a fastener length/quantity list are LENGTH first, QUANTITY second:
  1068 - 38pcs  -> {"M":null,"L":1068,"W":null,"TL":null,"qty":38,"T":null}
  1430 - 148pcs -> {"M":null,"L":1430,"W":null,"TL":null,"qty":148,"T":null}
The quantity is never a dimension. Words written apart from the rows are global
context for every row: "under size"/"undersize"/"under" -> sizeType, "ZP"/"HDG"/
"PL" -> finish. Apply global context only when it is clearly legible.

DO NOT FILL IN WHAT IS NOT THERE
A short note that gives only lengths and quantities yields exactly that:
M = null, TL = null, W = null, material = null, and product = null unless a
product is actually named or the geometry makes it unambiguous. Never assume
M12, never assume a default thread, never assume SAG_ROD just because the rows
look like lengths. Our review screen asks the user for the missing fields; a
guessed value would be silently wrong instead. product = null is a correct
answer. Use OTHER only when the document clearly shows a product we did not
list.

Notes such as "1 bolt 4 nut" are accessory wording. Ignore them entirely for
item extraction: they never become dimensions and never change qty.
TXT;
}

// ── OpenAI request ───────────────────────────────────────────────────────────

/** Build the Responses API payload for one validated upload. */
function ai_build_payload($upload) {
    $dataUrl = 'data:' . $upload['mime'] . ';base64,' . base64_encode($upload['bytes']);
    if ($upload['kind'] === 'pdf') {
        $filePart = ['type'=>'input_file','filename'=>$upload['name'],'file_data'=>$dataUrl];
    } else {
        // high detail: engineering text on screenshots and photos is small
        $filePart = ['type'=>'input_image','image_url'=>$dataUrl,'detail'=>'high'];
    }
    return [
        'model' => AI_EXTRACT_MODEL_PRIMARY,
        'instructions' => ai_instructions(),
        'input' => [[
            'role' => 'user',
            'content' => [
                ['type'=>'input_text',
                 'text'=>'Extract the quotation specification from this document.'],
                $filePart,
            ],
        ]],
        'text' => ['format' => [
            'type'   => 'json_schema',
            'name'   => 'quote_extraction',
            'strict' => true,
            'schema' => ai_output_schema(),
        ]],
        'max_output_tokens' => 4096,
    ];
}

/**
 * Payload for pasted text. Deliberately shares ai_instructions() and
 * ai_output_schema() with the image path: one prompt philosophy, one schema,
 * one set of business rules. The only difference is that the content is text
 * rather than a file, so geometry has to be read from wording and layout.
 */
function ai_build_text_payload($text) {
    return [
        'model' => AI_EXTRACT_MODEL_PRIMARY,
        'instructions' => ai_instructions(),
        'input' => [[
            'role' => 'user',
            'content' => [[
                'type' => 'input_text',
                'text' => "Extract the quotation specification from this customer message.\n\n" . $text,
            ]],
        ]],
        'text' => ['format' => [
            'type'   => 'json_schema',
            'name'   => 'quote_extraction',
            'strict' => true,
            'schema' => ai_output_schema(),
        ]],
        'max_output_tokens' => 4096,
    ];
}

/** POST to the OpenAI Responses API. Returns [httpCode, decodedBody|null, curlErr]. */
function ai_call_openai($payload) {
    $ch = curl_init('https://api.openai.com/v1/responses');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . OPENAI_API_KEY,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 120,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $body = is_string($raw) ? json_decode($raw, true) : null;
    return [$code, $body, $err];
}

/** Pull the structured JSON text out of a Responses API body. Null on failure. */
function ai_extract_output_text($body) {
    if (!is_array($body)) return null;
    if (isset($body['output_text']) && is_string($body['output_text'])) return $body['output_text'];
    foreach (($body['output'] ?? []) as $item) {
        if (($item['type'] ?? '') !== 'message') continue;
        foreach (($item['content'] ?? []) as $part) {
            if (($part['type'] ?? '') === 'output_text' && isset($part['text'])) return $part['text'];
            if (($part['type'] ?? '') === 'refusal') return null;
        }
    }
    return null;
}

/** Validate + sanitise the model's compact JSON. Null when unusable. */
function ai_sanitise_extraction($text) {
    $d = json_decode((string)$text, true);
    if (!is_array($d) || !array_key_exists('product', $d) || !isset($d['items']) || !is_array($d['items'])) {
        return null;
    }
    $num = function($v){ return (is_int($v)||is_float($v)) && is_finite($v) && $v>0 && $v<1000000 ? $v : null; };
    $str = function($v,$max=80){ return is_string($v) && trim($v)!=='' ? trim(mb_substr($v,0,$max)) : null; };
    $tl  = function($v) use ($num) {
        if (is_int($v)||is_float($v)) return $num($v);
        if (is_string($v) && preg_match('/^\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?$/', trim($v))) return trim($v);
        return null;
    };
    $prodOk = ['SAG_ROD','STUD','ANCHOR_BOLT','L_BOLT','OTHER'];
    $prod = (is_string($d['product']) && in_array($d['product'],$prodOk,true)) ? $d['product'] : null;
    $items = [];
    foreach (array_slice($d['items'], 0, AI_MAX_ITEMS) as $it) {
        if (!is_array($it)) continue;
        $row = [
            'M'   => $str($it['M'] ?? null, 20),
            'L'   => $num($it['L'] ?? null),
            'W'   => $num($it['W'] ?? null),
            'TL'  => $tl($it['TL'] ?? null),
            'qty' => (is_int($it['qty'] ?? null) && $it['qty']>0 && $it['qty']<=1000000) ? $it['qty'] : null,
            'Bmid' => $num($it['Bmid'] ?? null),
        ];
        /* A + B + C = L, checked HERE rather than trusting the model to have
           checked it. Only a flag: the printed numbers are never rewritten. */
        $row['Bbad'] = false;
        if ($row['Bmid'] !== null && $row['L'] !== null && is_string($row['TL']) && strpos($row['TL'], '/') !== false) {
            list($a, $c) = array_map('floatval', explode('/', $row['TL'], 2));
            $row['Bbad'] = abs(($a + $row['Bmid'] + $c) - $row['L']) > 0.5;
        }
        $items[] = $row;
    }
    return [
        'product'  => $prod,
        'material' => $str($d['material'] ?? null),
        'finish'   => $str($d['finish'] ?? null),
        'sizeType' => $str($d['sizeType'] ?? null),
        // Shown to staff as a note. Never applied to accessories anywhere.
        'note'     => $str($d['note'] ?? null, 80),
        'items'    => $items,
    ];
}

/** Map transport-level failures to safe client messages (no secrets, no dumps). */
function ai_map_error($httpCode, $body, $curlErr) {
    if ($curlErr !== '')  return ['error'=>'network', 'message'=>'Could not reach the analysis service. Check the connection and try again.'];
    if ($httpCode === 401) return ['error'=>'auth',    'message'=>'The analysis service rejected the server\'s credentials. Ask the administrator to check the API key.'];
    if ($httpCode === 429) return ['error'=>'rate',    'message'=>'The analysis service is busy. Wait a moment and try again.'];
    if ($httpCode >= 500)  return ['error'=>'upstream','message'=>'The analysis service had a problem. Try again shortly.'];
    if ($httpCode !== 200) return ['error'=>'request', 'message'=>'Could not analyze this file. Try again or paste the text manually.'];
    return null;
}

function ai_json($arr, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($arr);
    exit;
}

// ── endpoint main ────────────────────────────────────────────────────────────
if (!defined('AI_EXTRACT_TEST')) {
    dc_require_api_login();                      // JSON 401 when not signed in

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        ai_json(['ok'=>false,'error'=>'method','message'=>'POST only.'], 405);
    }
    if (OPENAI_API_KEY === '' || OPENAI_API_KEY === 'sk-REPLACE-ME') {
        ai_json(['ok'=>false,'error'=>'not_configured',
                 'message'=>'AI extraction is not configured on this server yet.'], 503);
    }
    /* Two request shapes, one endpoint: a file upload (photo / PDF) or pasted
       text from the Quick Add fallback. Exactly one of them, never both, so a
       request cannot smuggle a file past the text path. */
    $hasFile = isset($_FILES['file']);
    $hasText = isset($_POST['text']);
    if ($hasFile === $hasText) {                 // neither, or both
        ai_json(['ok'=>false,'error'=>'no_file',
                 'message'=>'Send exactly one file or one block of text.'], 400);
    }
    if ($hasFile && count($_FILES) !== 1) {
        ai_json(['ok'=>false,'error'=>'no_file','message'=>'Upload exactly one file.'], 400);
    }

    set_time_limit(180);
    $t0 = microtime(true);

    if ($hasText) {
        $upload = ai_validate_text($_POST['text']);
        $upload['kind'] = 'text';
        // Logged like the upload path: size only, never the customer's words.
        $upload['mime'] = 'text/plain';
        $upload['size'] = $upload['ok'] ? mb_strlen($upload['text']) : 0;
    } else {
        $upload = ai_validate_upload($_FILES['file']);
        // The temp upload is consumed into memory above; remove it immediately so
        // no copy of the customer document remains on disk past this point.
        @unlink($_FILES['file']['tmp_name']);
    }
    if (!$upload['ok']) {
        error_log('[ai_extract] reject '.$upload['error']);
        // A missing PHP extension is a server fault the admin must fix, not a
        // bad request — 503, matching the not_configured case above.
        $status = $upload['error'] === 'no_fileinfo' ? 503 : 400;
        ai_json(['ok'=>false,'error'=>$upload['error'],'message'=>$upload['message']], $status);
    }

    $payload = $upload['kind'] === 'text'
        ? ai_build_text_payload($upload['text'])
        : ai_build_payload($upload);
    unset($upload['bytes'], $upload['text']);    // free the raw input from memory

    list($code, $body, $curlErr) = ai_call_openai($payload);
    $ms = (int)round((microtime(true)-$t0)*1000);

    if ($e = ai_map_error($code, $body, $curlErr)) {
        // minimal diagnostics: no file content, no key, no raw upstream body
        error_log("[ai_extract] fail http=$code err={$e['error']} mime={$upload['mime']} size={$upload['size']} ms=$ms model=".AI_EXTRACT_MODEL_PRIMARY);
        ai_json(['ok'=>false,'error'=>$e['error'],'message'=>$e['message']], 502);
    }

    $text = ai_extract_output_text($body);
    $data = $text !== null ? ai_sanitise_extraction($text) : null;
    if ($data === null) {
        error_log("[ai_extract] malformed-output mime={$upload['mime']} size={$upload['size']} ms=$ms model=".AI_EXTRACT_MODEL_PRIMARY);
        ai_json(['ok'=>false,'error'=>'ai_output_invalid',
                 'message'=>'Could not analyze this file. Try again or paste the text manually.'], 502);
    }

    error_log('[ai_extract] ok mime='.$upload['mime'].' size='.$upload['size']
        .' items='.count($data['items'])." ms=$ms model=".AI_EXTRACT_MODEL_PRIMARY);
    ai_json(['ok'=>true,'data'=>$data]);
}
