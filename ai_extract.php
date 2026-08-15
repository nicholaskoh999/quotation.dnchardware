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
/* Room for the answer, not a budget for it — nothing is charged for tokens the
   model does not generate.

   This was 4096, and a 29-row anchor-bolt table came back as "Could not
   analyze this file". The schema requires all seventeen keys on every item, so
   one row costs roughly 80 tokens of JSON and 29 rows roughly 2,400 — but this
   ceiling covers the model's REASONING as well as its answer, and on a dense
   merged-cell table the reasoning alone can spend the whole 4096. The response
   then comes back status=incomplete with the JSON cut off mid-row, which
   decodes to nothing, which was reported as if the document were unreadable.
   AI_MAX_ITEMS rows of output plus room to think about them is what this has
   to cover, and a document that still exceeds it now says so by name. */
const AI_MAX_OUTPUT_TOKENS = 32000;
/* Pasted WhatsApp text. Generous for a long customer list, small enough that a
   pasted document can never turn into a large bill. */
const AI_MAX_TEXT_CHARS  = 6000;
// One line typed beside an upload ("H 530, ID 100"). Short by design: it is a
// correction, not a second document, and the override it describes is applied
// by the caller afterwards whatever the model does with it.
const AI_MAX_NOTE_CHARS  = 300;

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
            // How many ends of the rod carry a thread, when the document shows
            // it. Evidence, NOT a product name: our own resolver turns it into
            // Sag Rod or Anchor Bolt, the same way it does for pasted text.
            'threadEnds' => ['type'=>['integer','null'], 'enum'=>[1,2,null]],
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
                        // What THIS row is made of, when the row says so — a
                        // drawing with a stainless block under a G8.8 block is
                        // ordinary. Raw wording, null when the row is silent:
                        // the document-level value then applies, and the mapping
                        // to 4140 QT / SS304 runs in our own code either way.
                        'material' => ['type'=>['string','null']],
                        'finish'   => ['type'=>['string','null']],
                        'sizeType' => ['type'=>['string','null']],
                        // What could NOT be read on this row, in a few words:
                        // "size M20 or M30". Informational only — it is shown
                        // to staff as "Check ..." and never becomes a value.
                        // The field it describes must be null.
                        'unclear'  => ['type'=>['string','null']],
                        // What THIS row is, when the row's own geometry says so
                        // — one drawing may hold a bent L-bolt and several
                        // straight two-end rods. Null means "this row does not
                        // say"; the document-level product then applies.
                        'product'  => ['type'=>['string','null'],
                            'enum'=>['SAG_ROD','STUD','ANCHOR_BOLT','L_BOLT','OTHER',null]],
                        // How many ends of THIS row's rod carry a thread. Row
                        // evidence: our own code turns it into the product.
                        'threadEnds' => ['type'=>['integer','null'], 'enum'=>[1,2,null]],
                        // The rod's ACTUAL body/shank diameter where the
                        // drawing states one ("body 33mm" under an M32). Never
                        // the nominal size and never a length.
                        'bodyDia'  => ['type'=>['number','null']],
                        // J Bolt only: overall height, the hook's inside
                        // diameter, and the return height. A J Bolt has no L —
                        // the customer's "length" IS its H.
                        'H'        => ['type'=>['number','null']],
                        'ID'       => ['type'=>['number','null']],
                        'S'        => ['type'=>['number','null']],
                        // Bend radius where a drawing states one. Evidence: it
                        // is not a quotation dimension and never becomes ID,
                        // S, W or H.
                        'R'        => ['type'=>['number','null']],
                    ],
                    'required'=>['M','L','W','TL','qty','Bmid','material','finish','sizeType','unclear',
                                 'product','threadEnds','bodyDia','H','ID','S','R'],
                ],
            ],
        ],
        'required'=>['product','material','finish','sizeType','threadEnds','note','items'],
    ];
}

function ai_instructions() {
    return <<<'TXT'
Extract fastener quotation specs from the document. Output ONLY the JSON — no
prose, no reasoning, no explanations, no quotes from the source. Never invent a
value: unknown = null. Absent qty = null, never 1. Ignore greetings, logos,
signatures, stamps, prices and unrelated text.

A field being required is never a reason to fill it. Do not read a dimension
off the drawing's scale, off how long a part looks next to another, or off what
is normally used at that size — if it is not written, it is null.

HANDWRITING YOU CANNOT READ WITH CERTAINTY
Handwritten digits look alike: 0/3/6/8, 2/7, 1/7, 5/6. When a handwritten value
could plausibly be either of two readings — M20 or M30, M12 or M17, M16 or M18,
55 or 66 — do NOT pick the one that looks more likely and do NOT pick one just
to complete the row. Return null for that field and put a few words in the
row's "unclear" field: "size M20 or M30". A quotation carries that number to a
customer; a null asks a person, and only the null can be corrected.
You MAY resolve it when something other than the handwriting settles it: the
same size written clearly elsewhere on the sheet, a title or specification block
that lists it, a dimension callout that cross-references the row, or a repeated
group heading that fixes it. Appearance alone is never enough. Where a value is
clearly written, read it normally — this rule is only for the ones that are
genuinely in doubt, and "unclear" stays null for every field you could read. Where two
parts of the document disagree, or a number's role cannot be established, return
null rather than choosing. Our review screen asks a person for what is missing;
a guessed value would be silently wrong in a quotation instead.

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
L BOLT and J BOLT are products in their own right, and each has its own
dimensions. Put them in the item's OWN fields and nowhere else:
  L_BOLT   M, L, W, TL     L is the long leg, W the short leg / bend / hook /
                           B column. A drawing showing a straight leg and a
                           perpendicular short one IS an L_BOLT.
  J_BOLT   M, H, ID, S, TL H is the overall height — a J Bolt's "length" or "L"
                           on a customer drawing IS H, so report it as H and
                           leave L null. ID is the inside diameter / inside
                           width of the hook, S the bend or return height.
A bend radius (R25, "bend radius 25") goes in R and nowhere else: it is not ID,
not S, not W, not H, and not a quotation dimension.
Where a drawing is headed "Anchor Bolt" but shows a 90-degree bend, it is an
L_BOLT — the bend is geometry and the heading is only wording.
Never fill W, ID, S or H because the product has that field: a number whose role
the drawing does not establish stays null and the review screen asks.

ONE DOCUMENT MAY HOLD MORE THAN ONE PRODUCT. A drawing with a bent 90-degree
rod at the top and straight rods threaded at both ends underneath is an L_BOLT
and several SAG_RODs, not one product repeated. Classify EACH item by its own
geometry and put the answer in that item's "product"; leave the document-level
product null when the items differ. Never classify the whole sheet by the first
product you find, and never copy one item's product onto the others.
A STANDARD number names the product where geometry is absent: DIN 937, DIN937
or DIN-937 is a stud/stud-bolt standard -> STUD. The DIN wording must be there;
a bare "937" is a quantity or a job number and says nothing. A standard number
never implies a material.
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

EACH DRAWING OWNS ITS OWN DIMENSIONS
A sheet that shows several parts — stacked one above another, side by side, or
repeated down a table — shows several SEPARATE drawings. Every part has its own
region: the outline, the dimension lines that touch it, the leaders that point
at it and the caption directly beside or beneath it. Read each part inside its
own region and nowhere else.
  - A dimension belonging to the part ABOVE or BELOW is not a candidate for
    this part. Not as a value, not as an alternative, not as a doubt. If part 2
    is 865 long and part 3 is 1000 long, part 3 is 1000: the 865 is part 2's
    and says nothing whatever about part 3.
  - Never write "L 1000 or 865", "check length", or any other wording that
    offers one part's dimension as a possible reading of another's. That is not
    an uncertainty; it is a dimension that belongs to a different part.
  - Repeated parts that differ ONLY in one dimension are the normal case on
    these sheets. Expect the lengths to differ and report each as drawn.
  - "unclear" is ONLY for something you genuinely cannot READ inside this
    part's own region — smudged handwriting, an obscured digit. It is never for
    choosing between this part's dimension and a neighbouring part's, and never
    for a value that the arithmetic below confirms. Where the evidence settles
    the value, fill the field and leave "unclear" null.

WHICH DIMENSION IS THE OVERALL LENGTH
Within one part's own region, in this order:
  1. A dimension line that SPANS the whole part end to end. That is L. Prefer
     it over everything else.
  2. Otherwise, the segments along the part that add up: a thread, a plain
     middle and a thread. 200 + 600 + 200 = 1000 makes L 1000, and
     200 + 885 + 200 = 1285 makes L 1285. When the segments add up to a value
     the drawing also shows spanning the part, that is confirmation, not a
     conflict — report L and leave "unclear" null.
  3. Otherwise L is null and the review screen asks.
A thread length is never the overall length. "200/200" written against a part
is TL — 200 at each end — and it is not L, not half of L, and not a candidate
for L. A part whose threads are 200/200 and whose overall dimension is 950 is
{"L":950,"TL":"200/200"}, and the 200s are already inside the 950.

threadEnds — how many ends of the rod carry a thread: 2, 1, or null when the
document does not show it. This is EVIDENCE, not a product name; our own code
turns it into the product. Count what is drawn or written, never what the title
says. "one end thread", "threaded one end", "thread one side", "single end
thread" -> 1. "both ends threaded", "thread both sides", a TL written as a pair
(75/75, 50/110), or two thread lengths given for the two ends -> 2. Ends
actually given outrank ends described: "thread one side 150 / thread other side
100" is 2. A drawing showing thread hatching at each end of a straight rod is 2.

material / finish / sizeType — copy the raw wording exactly, do not translate
(materials: MS, S45C, 4140, 4140 QT, G8.8, GR8.8, Grade 8.8, HT, High Tensile,
HT10.9, Grade 10.9, GR10.9, 10.9, Y BAR, SS304, SUS304, S/S 316; finishes: PL,
Plain, Black, ZP, HDG; size types: Fullsize, Undersize, F/S, U/S). A grade is
only a grade when it is written as one: "length 10.9mm" and "qty 10.9" are
measurements, not materials. "gr10.9 or near material" is still grade 10.9 —
the "or near material" says the customer would accept an equivalent, it does
not name a second material, so copy the grade and nothing else. Never infer a material or finish that is not
written: no wording means null. Stainless needs its GRADE — "stainless" or "SS"
with no 304/316 beside it is material = "stainless steel" and nothing more; do
not choose a grade.

These three are the DOCUMENT-wide values: the ones that apply to the whole
sheet. A document that specifies each block separately has none — put each
block's wording on its own rows instead (see the item fields), and leave the
document-level material or finish null. Never copy one block's material up to
document level: it would then be applied to every other block.

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
  L  = length in mm — see the drawing rule below. On a J_BOLT there is no L:
       its overall length is H.
  H  = J_BOLT overall height in mm, null for every other product
  ID = J_BOLT inside diameter of the hook, in mm
  S  = J_BOLT bend / return height, in mm
  R  = bend radius where the drawing states one — evidence only, never a
       quotation dimension
  W  = bend/width in mm — the short leg of an L_BOLT, the B column on an L-bolt
       table — null when absent. On a straight rod with no bend W is null: a
       dimension across the rod is M, never W.
  TL = thread length; a pair as the string "75/75" or "50/110", preserving
       asymmetry exactly; a single value as a number
  Bmid = centre unthreaded segment of a segmented sag rod drawing, else null.
       This is NOT the L-bolt bend column — a bend/B column goes to W.
  qty from pcs/pc/nos/qty — a quantity is never a dimension
  product = what THIS row is, by its own geometry — SAG_ROD, STUD, ANCHOR_BOLT,
       L_BOLT — or null when the row does not show it and the document already
       said. Geometry beats wording here exactly as it does at document level.
  threadEnds = how many ends of THIS row's rod are threaded: 2, 1, or null.
       Row evidence, not a product name: "thread one end 100" is 1, "thread both
       ends 80" is 2, and two thread values given for one row are 2.
  bodyDia = the rod's ACTUAL body or shank diameter when the drawing states one
       — "body 33mm", "shank dia 33", "(body 38.1)". It is NOT the nominal size
       and NOT a length: an M32 rod with a 33mm body has M "M32", bodyDia 33,
       and its own separate length. Never put it in L, and never turn it into
       the nominal size — if the nominal size is not written, M stays null.
  unclear = a few words naming what could not be read on THIS row, e.g.
       "size M20 or M30" or "qty unreadable"; null when everything on the row
       was legible. Never a value — the field it names must be null.
  material / finish / sizeType = what THIS row is made of, when the row or the
       block it sits under says so — raw wording again, same vocabulary. One
       drawing carrying "GRADE 8.8 / HDG" over the first rows and "S/S 304" over
       the rest is normal: give rows 1-2 material "GRADE 8.8", finish "HDG" and
       the rest material "S/S 304", finish null. Leave all three null when the
       row is covered by the document-wide value or by nothing at all — null
       means "this row does not say", not "this row has none".
Aliases: D/Dia=diameter · L/Length · TL/Thread/Thread Length · B/Bend/Width ·
Qty/Quantity/Nos/Pcs · Inside Dia/I.D./Inner Width=ID · Bend High/Hook
Height/Return Height=S · Height/Overall Height=H · R/Radius/Bend Radius=R.
Every dimension is MILLIMETRES. A drawing in metres, centimetres, feet or
inches is converted before you report it: 4m is 4000, 30cm is 300, 2ft is 609.6,
2ft 6in is 762. The nominal SIZE is not converted — 1/2" stays 1/2".

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

HANDWRITTEN NOTATION
Read the notation, report what it means, invent nothing:
  R12 / R16 / R 12 next to "undersize", "undersized" or "U/S", or on a rod
    drawing -> the nominal diameter: M "M12", sizeType "undersized". The R is
    the draughtsman's round-bar notation, not a different size. An R number in
    an unrelated context is not a diameter — leave M null.
  ZP, Z/P, Z(P), Z[P], "Z P", lower case, any punctuation -> finish "ZP".
  A straight rod drawn with thread hatching at each end -> threadEnds 2.
  Thread marks with NO dimension written against them are not a length: TL
    stays null. Never read a thread length off the picture.

PRODUCT-SPECIFIC DIMENSIONS — SEARCH THE WHOLE DOCUMENT
Once the product is known, the fields the quotation needs are known too, so look
for them EVERYWHERE, not only on the item's own row:
  SAG_ROD      M, L, TL   TL is BOTH ends: "75/75", "50/110"   qty optional
  ANCHOR_BOLT  M, L, TL   TL is ONE value: 100                 qty optional
  STUD         M, L                                            qty optional
A diameter written once in a heading, a thread stated once beside it and a list
of lengths underneath describe ONE specification: put that M and that TL on
EVERY item that does not state its own. A value written on a row overrides the
shared one for THAT row only, and the shared value still applies to the rows
after it.

A SHARED VALUE REACHES ONLY THE ROWS IT COVERS
A table cell merged down a block of rows, or a value written once against a
brace spanning several rows, belongs to THOSE rows and stops where the merge
stops. Report it on the FIRST row it covers and leave that field null on the
rest of that block; where a later block has its own value, report it again on
the first row of the new block. Our own code carries a value forward until the
next one replaces it, so this reproduces the merge exactly and never spreads
one block's value over the whole sheet.
  A TL column merged across rows 1-18 reading 150, then merged across rows
  19-29 reading 300 -> row 1 TL 150, rows 2-18 TL null, row 19 TL 300, rows
  20-29 TL null.
Never take a merged value as document-wide when the document plainly gives a
different one further down. A value written sideways in a tall merged cell is
still that cell's value and covers exactly the rows the cell spans.

STRUCTURED COLUMNS OUTRANK THE DESCRIPTION
Where a table has its own columns — D, L, TL, B, Quantity — those columns are
the values. A description such as "Anchor Bolts & Nuts (M20 x 300)" beside them
restates the same specification in prose: read the columns, use the description
only to confirm them, and never produce a second reading or a second item from
it. Where the two genuinely disagree, report the column value and say so in
"unclear".
A long table is ordinary. Report EVERY row, in document order, however many
there are. Metric and imperial rows sit in one table routinely — 3/8", 3/4",
M8, M20, M30 — and each row keeps its own notation: an inch row stays in
inches and never becomes an M size, and one row's unit system says nothing
about the next row's. A row you cannot read is one row: report it with nulls
and an "unclear", and report every other row normally.
  MS SAG ROD ZP / M12 / TL 100/100 / 1000 - 5pcs / 750 x TL75/75 - 8pcs
    -> {"M":"M12","L":1000,"W":null,"TL":"100/100","qty":5,"Bmid":null}
       {"M":"M12","L":750,"W":null,"TL":"75/75","qty":8,"Bmid":null}
A SAG_ROD's single shared thread means both ends: "M12 TL 75" over a list is
"75/75". An ANCHOR_BOLT has ONE thread: its TL 100 is 100 and never "100/100".
Two thread values stated separately — "thread 60" and "thread 70", "TL1 60" and
"TL2 70", "top thread 250" and "bottom thread 100" — are the TWO ENDS of one
rod, in the order written: "60/70", "250/100". Never collapse them to "60/60",
and never assume they are the same end written twice.
None of this fills anything in. If M or TL is genuinely absent from the whole
document, return null for it and let the review screen ask.

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
item extraction: they never become dimensions and never change qty. The note
field describes THIS document only — never carry over wording from anything you
were shown before.

A NUMBER WHOSE ROLE YOU CANNOT ESTABLISH IS NOT A FIELD. Every unknown labelled
dimension stays out of M, L, TL, W and qty rather than being pushed into
whichever of them is still empty. Requirement-completeness is never a reason to
place a number: a row with three of its five fields filled and two nulls is a
correct row, and the review screen asks a person for the rest.
TXT;
}

// ── OpenAI request ───────────────────────────────────────────────────────────

/**
 * Optional operator note sent alongside an upload. Trimmed, length-capped and
 * stripped of control characters; anything else is a legitimate part of what a
 * person may write about a drawing. An unusable note is simply dropped — it can
 * never fail the analysis, because the deterministic override in the browser
 * does not depend on the model having seen it.
 */
function ai_clean_note($raw) {
    if (!is_string($raw)) return '';
    $t = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', ' ', $raw);
    $t = trim(preg_replace('/\s+/u', ' ', $t));
    if ($t === '') return '';
    return mb_substr($t, 0, AI_MAX_NOTE_CHARS);
}

/** Build the Responses API payload for one validated upload. */
function ai_build_payload($upload, $note = '') {
    $dataUrl = 'data:' . $upload['mime'] . ';base64,' . base64_encode($upload['bytes']);
    if ($upload['kind'] === 'pdf') {
        $filePart = ['type'=>'input_file','filename'=>$upload['name'],'file_data'=>$dataUrl];
    } else {
        // high detail: engineering text on screenshots and photos is small
        $filePart = ['type'=>'input_image','image_url'=>$dataUrl,'detail'=>'high'];
    }
    // The person who uploaded the drawing is looking at it. Where their note
    // gives a value, that value is the answer — said here so the model reads the
    // rest of the drawing in the same terms, and enforced independently by the
    // caller so a model that ignores this line changes nothing.
    $lead = 'Extract the quotation specification from this document.';
    if ($note !== '') {
        $lead .= "\n\nThe person who sent this document added the following note about it. "
               . "Where the note gives a value for a field, that value is correct and "
               . "replaces what the document shows for that field:\n" . $note;
    }
    return [
        'model' => AI_EXTRACT_MODEL_PRIMARY,
        'instructions' => ai_instructions(),
        'input' => [[
            'role' => 'user',
            'content' => [
                ['type'=>'input_text', 'text'=>$lead],
                $filePart,
            ],
        ]],
        'text' => ['format' => [
            'type'   => 'json_schema',
            'name'   => 'quote_extraction',
            'strict' => true,
            'schema' => ai_output_schema(),
        ]],
        'max_output_tokens' => AI_MAX_OUTPUT_TOKENS,
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
        'max_output_tokens' => AI_MAX_OUTPUT_TOKENS,
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
    $raw   = curl_exec($ch);
    $err   = curl_error($ch);
    $errNo = curl_errno($ch);
    $code  = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $body = is_string($raw) ? json_decode($raw, true) : null;
    return [$code, $body, $err, $errNo];
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

/**
 * The model declined to answer. Distinct from "answered badly": there is
 * nothing to salvage and nothing for the operator to retry differently, so it
 * is reported as itself rather than as an unreadable document.
 */
function ai_output_refusal($body) {
    if (!is_array($body)) return '';
    foreach (($body['output'] ?? []) as $item) {
        foreach (($item['content'] ?? []) as $part) {
            if (($part['type'] ?? '') === 'refusal') {
                return is_string($part['refusal'] ?? null) ? $part['refusal'] : 'refused';
            }
        }
    }
    return '';
}

/**
 * Why the response stopped, when it stopped early. '' means it finished.
 * 'max_output_tokens' means the answer was cut off mid-sentence — the JSON is
 * incomplete and the rows after the cut are simply absent.
 */
function ai_incomplete_reason($body) {
    if (!is_array($body)) return '';
    if (($body['status'] ?? '') !== 'incomplete') return '';
    $r = $body['incomplete_details']['reason'] ?? 'unknown';
    return is_string($r) && $r !== '' ? $r : 'unknown';
}

/**
 * What a CUT-OFF response did manage to say.
 *
 * A document with more rows than one answer can hold used to be worth nothing:
 * the JSON was truncated mid-row, json_decode returned null, and 29 anchor
 * bolts became "Could not analyze this file". Twenty-seven readable rows and a
 * warning that some are missing is a better answer than none — provided it is
 * never mistaken for a complete one, which is why the caller flags it and the
 * review screen says so.
 *
 * Only WHOLE item objects are taken. The one the cut landed in is discarded
 * entirely rather than half-read, because a row missing its thread length is
 * indistinguishable from a row whose thread length was never stated.
 */
function ai_salvage_extraction($text) {
    if (!is_string($text) || $text === '') return null;
    $pos = strpos($text, '"items"');
    if ($pos === false) return null;
    $open = strpos($text, '[', $pos);
    if ($open === false) return null;

    $items = [];
    $len = strlen($text);
    $i = $open + 1;
    while ($i < $len) {
        while ($i < $len && $text[$i] !== '{') {
            if ($text[$i] === ']') break 2;
            $i++;
        }
        if ($i >= $len) break;
        $depth = 0; $inStr = false; $esc = false; $end = -1;
        for ($j = $i; $j < $len; $j++) {
            $c = $text[$j];
            if ($inStr) {
                if ($esc)               $esc = false;
                elseif ($c === '\\')    $esc = true;
                elseif ($c === '"')     $inStr = false;
                continue;
            }
            if     ($c === '"') $inStr = true;
            elseif ($c === '{') $depth++;
            elseif ($c === '}') { $depth--; if ($depth === 0) { $end = $j; break; } }
        }
        if ($end < 0) break;                       // the cut landed inside this one
        $obj = json_decode(substr($text, $i, $end - $i + 1), true);
        if (is_array($obj)) $items[] = $obj;
        $i = $end + 1;
    }
    if (!$items) return null;

    /* The document-level fields are emitted before "items", so they survived
       the cut. Each is read on its own, so one unreadable field cannot cost
       the others. */
    $head = substr($text, 0, $pos);
    $scalar = function ($key) use ($head) {
        if (preg_match('/"' . $key . '"\s*:\s*(?:"((?:[^"\\\\]|\\\\.)*)"|null|(\d+))/', $head, $m)) {
            if (isset($m[1]) && $m[1] !== '') return json_decode('"' . $m[1] . '"');
            if (isset($m[2]) && $m[2] !== '') return (int)$m[2];
        }
        return null;
    };
    return [
        'product'    => $scalar('product'),
        'material'   => $scalar('material'),
        'finish'     => $scalar('finish'),
        'sizeType'   => $scalar('sizeType'),
        'threadEnds' => $scalar('threadEnds'),
        'note'       => $scalar('note'),
        'items'      => $items,
    ];
}

/** Validate + sanitise the model's compact JSON. Null when unusable. */
function ai_sanitise_extraction($text) {
    $d = json_decode((string)$text, true);
    return ai_sanitise_data($d);
}

/** The same validation, for an extraction already decoded (or salvaged). */
function ai_sanitise_data($d) {
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
            // Row wording, passed through untranslated. Quick Add runs it
            // through the same rules it runs the document wording through.
            'material' => $str($it['material'] ?? null, 40),
            'finish'   => $str($it['finish'] ?? null, 40),
            'sizeType' => $str($it['sizeType'] ?? null, 40),
            // Shown to staff, never used as a value.
            'unclear'  => $str($it['unclear'] ?? null, 40),
            // Row-level product and end count: evidence, mapped in our own code.
            'product'  => (is_string($it['product'] ?? null) && in_array($it['product'],$prodOk,true))
                            ? $it['product'] : null,
            'threadEnds' => in_array($it['threadEnds'] ?? null, [1,2], true) ? $it['threadEnds'] : null,
            'bodyDia'  => $num($it['bodyDia'] ?? null),
            // J Bolt dimensions and the evidence-only bend radius.
            'H'        => $num($it['H'] ?? null),
            'ID'       => $num($it['ID'] ?? null),
            'S'        => $num($it['S'] ?? null),
            'R'        => $num($it['R'] ?? null),
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
        'threadEnds' => in_array($d['threadEnds'] ?? null, [1, 2], true) ? $d['threadEnds'] : null,
        // Shown to staff as a note. Never applied to accessories anywhere.
        'note'     => $str($d['note'] ?? null, 80),
        'items'    => $items,
    ];
}

/** Map transport-level failures to safe client messages (no secrets, no dumps). */
function ai_map_error($httpCode, $body, $curlErr, $curlErrNo = 0) {
    /* A timeout and an unreachable host feel the same to a person waiting, and
       the answer to each is different: one is worth retrying as-is, the other
       is worth splitting the document up first. */
    if ((int)$curlErrNo === 28) return ['error'=>'timeout',
        'message'=>'The analysis took too long and was stopped. A very dense or multi-page document may need to be split into smaller uploads.'];
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
        : ai_build_payload($upload, ai_clean_note($_POST['note'] ?? ''));
    unset($upload['bytes'], $upload['text']);    // free the raw input from memory

    list($code, $body, $curlErr, $curlErrNo) = ai_call_openai($payload);
    $ms = (int)round((microtime(true)-$t0)*1000);

    if ($e = ai_map_error($code, $body, $curlErr, $curlErrNo)) {
        // minimal diagnostics: no file content, no key, no raw upstream body
        error_log("[ai_extract] fail http=$code err={$e['error']} mime={$upload['mime']} size={$upload['size']} ms=$ms model=".AI_EXTRACT_MODEL_PRIMARY);
        ai_json(['ok'=>false,'error'=>$e['error'],'message'=>$e['message']], 502);
    }

    /* ── Why it failed matters ──────────────────────────────────────────────
       Every model-side failure used to arrive as one sentence — "Could not
       analyze this file" — whether the service had declined to read it, run
       out of room mid-answer, or returned something that was not JSON. Those
       need three different things from the person holding the document, so
       they are now three different answers. */
    $refusal    = ai_output_refusal($body);
    $incomplete = ai_incomplete_reason($body);
    $text       = ai_extract_output_text($body);
    $data       = $text !== null ? ai_sanitise_extraction($text) : null;

    /* Cut off mid-answer: keep the rows that arrived whole, and say so. */
    $truncated = false;
    if ($data === null && $text !== null && $incomplete !== '') {
        $salvaged = ai_salvage_extraction($text);
        if ($salvaged !== null) {
            $data = ai_sanitise_data($salvaged);
            $truncated = $data !== null;
        }
    }
    if ($data !== null && $incomplete !== '') $truncated = true;

    if ($data === null) {
        $why = $refusal !== '' ? 'refused' : ($incomplete !== '' ? 'incomplete:'.$incomplete : 'malformed');
        error_log("[ai_extract] no-data why=$why mime={$upload['mime']} size={$upload['size']} ms=$ms model=".AI_EXTRACT_MODEL_PRIMARY);
        if ($refusal !== '') {
            ai_json(['ok'=>false,'error'=>'ai_refused',
                     'message'=>'The analysis service declined to read this document. Paste the text manually instead.'], 502);
        }
        if ($incomplete === 'max_output_tokens') {
            ai_json(['ok'=>false,'error'=>'ai_too_long',
                     'message'=>'This document has more rows than one analysis can return, so the answer was cut off. Split it into two uploads — or crop to part of the table — and try again.'], 502);
        }
        if ($incomplete !== '') {
            ai_json(['ok'=>false,'error'=>'ai_incomplete',
                     'message'=>'The analysis stopped before it finished. Try again, or split the document into smaller uploads.'], 502);
        }
        ai_json(['ok'=>false,'error'=>'ai_output_invalid',
                 'message'=>'The analysis came back in a form this app could not read. Try again, or paste the text manually.'], 502);
    }

    error_log('[ai_extract] ok mime='.$upload['mime'].' size='.$upload['size']
        .' items='.count($data['items']).($truncated?' TRUNCATED':'')." ms=$ms model=".AI_EXTRACT_MODEL_PRIMARY);
    /* truncated says: these rows are right, and there may have been more. The
       review screen shows it as a warning against the list, never as a row. */
    ai_json(['ok'=>true,'data'=>$data,'truncated'=>$truncated]);
}
