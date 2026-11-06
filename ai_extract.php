<?php
/**
 * Der-Cheng Quotation — AI photo / PDF extraction endpoint (Quick Add V2.1)
 *
 * POST multipart/form-data { file }  -> JSON { ok, data | error }   photo / PDF
 * POST multipart/form-data { files[] } -> same, 2..AI_MAX_IMAGES images read
 *                                        together as ONE request, in order
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
// Image / PDF provider switch: 'sonnet' or 'luna'. Unset or anything else is
// 'luna', today's behaviour, so a missing or misspelt setting changes nothing.
// Pasted text is never routed by it.
if (!defined('AI_IMAGE_PROVIDER')) define('AI_IMAGE_PROVIDER', 'luna');
require_once __DIR__ . '/ai_anthropic.php';

const AI_MAX_IMAGE_BYTES = 10485760;  // 10 MB
const AI_MAX_PDF_BYTES   = 20971520;  // 20 MB
const AI_MAX_PDF_PAGES   = 10;
// Images per analysis (multi-image Quick Add). All go to the model in ONE
// request; PDFs stay one per analysis and never mix with images.
const AI_MAX_IMAGES      = 5;
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
                'enum'=>['SAG_ROD','STUD','ANCHOR_BOLT','L_BOLT','J_BOLT','OTHER',null]],
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
                        // — one drawing may hold a hooked J-bolt, a bent
                        // L-bolt and several straight two-end rods. Null means
                        // "this row does not say"; the document-level product
                        // then applies.
                        'product'  => ['type'=>['string','null'],
                            'enum'=>['SAG_ROD','STUD','ANCHOR_BOLT','L_BOLT','J_BOLT','OTHER',null]],
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
                        // L_BOLT only: what the drawing measures L and W TO.
                        // Evidence — our own code converts it to the canonical
                        // TO END. UNCLEAR when a reference is drawn but cannot
                        // be told; null when the document shows none at all.
                        'Lref'     => ['type'=>['string','null'], 'enum'=>['TOP','CENTER','END','UNCLEAR',null]],
                        'Wref'     => ['type'=>['string','null'], 'enum'=>['TOP','CENTER','END','UNCLEAR',null]],
                        // Anchor / embedment plate size where the source states
                        // one (a square plate's side). Evidence only, like R:
                        // never W, never an item, never priced.
                        'plate'    => ['type'=>['number','null']],
                    ],
                    'required'=>['M','L','W','TL','qty','Bmid','material','finish','sizeType','unclear',
                                 'product','threadEnds','bodyDia','H','ID','S','R','Lref','Wref','plate'],
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
  - a hook: a rod whose lower end curves round and returns UP alongside
    itself, or a stated return height (S) -> J_BOLT, even when the text says
    "Anchor Bolt" or "Foundation Bolt"
  - a 90-degree bend with a short leg PERPENDICULAR to the shank, or a
    bend/width column (B) in a table -> L_BOLT, same whatever the title says
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
not S, not W, not H, and not a quotation dimension. A radius stated as a formula
("R=2d") with no number gives R null on the drawing; a table column of radii gives
each row its own R.

ANCHOR PLATES, NUTS AND WASHERS ARE NOT THE ROD
A cast-in rod often carries a nut-and-plate anchor at its embedded end: a flat
plate (often square, labelled W, "anchor plate", "plate size"), its thickness (t),
a tack weld and a nut. These are parts of the assembly, not dimensions of the
rod. The plate's size goes in "plate" — the side of a square plate, as printed —
and nowhere else: never W, never L, never a separate item, and never a quantity.
Its thickness and any S / F / t letters belonging to the plate stay out of every
field. A straight rod threaded top and bottom with such a plate is classified by
the rod (two threaded ends: SAG_ROD) — the plate does not change the product.
plate is null on every row the source gives no plate size for.
Where a drawing is headed "Anchor Bolt" but shows a 90-degree bend, it is an
L_BOLT — the bend is geometry and the heading is only wording.
Never fill W, ID, S or H because the product has that field: a number whose role
the drawing does not establish stays null and the review screen asks.

RECOGNISING A J BOLT ON A DRAWING
A J Bolt is a straight threaded shank whose lower end curves through about 180
degrees and comes back up beside itself. On the sheet that shows as:
  - a hook, U-turn or J curve at the bottom of an otherwise straight rod
  - a short return leg drawn PARALLEL to the shank and dimensioned as a height
    — S, "bend high", "hook height", "return height", "leg"
  - the curve dimensioned by its inside width (ID, "inside dia", "I.D.",
    "inner width")
Any ONE of those is enough to classify it. The heading is not: "ANCHOR BOLT",
"FOUNDATION BOLT", "HOOK BOLT", "J TYPE" and plain "BOLT" sit over J Bolts AND
over L Bolts routinely, and the geometry outranks every one of them. A heading
saying "J TYPE" over a rod whose short leg leaves at a right angle and runs AWAY
from the shank is an L_BOLT.
A BEND RADIUS IS NOT J-BOLT EVIDENCE. Every bent bolt has one: an L Bolt's
90-degree corner is drawn and tabled with a radius ("R=2d", "BENT RADIUS 24")
exactly as a J Bolt's curve is. A radius, a "bent radius" column or a "bent
length" column says only that the rod is bent — the DIRECTION of the short leg
decides which product it is, and nothing else does. Thread at the top end only
is common to both and decides nothing.
The difference from an L Bolt is the direction of the short leg: an L Bolt's
leg leaves the shank at a right angle and goes away from it, a J Bolt's turns
back and runs alongside it.

READING A J BOLT'S DIMENSIONS
  H  the OVERALL height of the whole part, end to end, hook included. Customer
     drawings label this L, LENGTH, OVERALL LENGTH, TOTAL LENGTH or OAL far
     more often than they label it H. On a J_BOLT that dimension IS H: report
     it as H and leave L null.
  S  the return / bend height — the short leg running beside the shank.
  TL the threaded length at the top, however it is labelled: T, THD, THREAD,
     "thread length", "T=50".
  ID the INSIDE width of the hook, and ONLY where an inside dimension is
     actually written. A radius is not an inside diameter. R goes in R, ID
     stays null, and the review screen asks for it. Do not double a radius, do
     not halve a diameter, do not derive either from the other, and do not put
     the radius in ID because ID is empty. A J Bolt drawn with a radius and no
     stated inside width is a complete, correct answer with ID null.
Worked example, following those rules. A hook bolt titled "ANCHOR BOLT",
labelled D1=12mm, L=280mm, S=80mm, T=50mm, R=25mm:
  product J_BOLT — the hook is geometry, the title is only wording
  {"M":"M12","L":null,"W":null,"H":280,"ID":null,"S":80,"TL":50,"R":25}
D1 (also D, d, dia) is the rod diameter, so M12. L spans the whole part, so it
is H. T is the thread, so TL. R stays in R. ID is null because no inside width
appears anywhere on the sheet — it is not calculated from the 25.

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

WHICH PART DOES AN OVERALL DIMENSION BELONG TO
Decide this by POSITION on the sheet, before you decide anything else about it.
  - Parts stacked down a sheet are read top to bottom; parts placed side by
    side are read left to right. That reading order is the order you report
    them in, and it is the order their dimensions are in too.
  - A part's own band is the horizontal strip its outline occupies. An overall
    dimension line drawn inside that band, or immediately above or below its
    outline and spanning the same width as it, is THAT part's overall length.
    A dimension inside the band of the part above belongs to the part above.
  - N parts stacked down a sheet with N overall dimensions means one each, in
    the same order: the first dimension from the top belongs to the first part
    from the top, the second to the second, and so on. Do not pair the second
    part with the first part's dimension because the numbers look similar.
  - Follow the extension lines. An overall dimension line ends in two extension
    lines that touch the two ends of ONE part. Whatever they touch is what the
    dimension measures.
  - Parts that differ only in length are the ordinary case, and their lengths
    are meant to differ. 865, 1000, 1200 and 1285 down one sheet are four
    parts' lengths, one each, in that order — not four candidates for any one
    of them.
  - Only when the sheet genuinely does not show which part a dimension belongs
    to — no extension lines you can follow, no band you can place it in — is
    that part's L null. Say what you could not place in "unclear"; never offer
    another part's dimension as an alternative reading of this one.

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

COPY THE SPECIFICATION, DO NOT TRANSLATE IT
The wording goes into material and finish exactly as the document writes it.
Our own code maps it to the material we quote — that mapping is the company's
and it is not yours to apply or to second-guess.
  - Grade 8.8, Class 8.8, GR8.8, HT8.8, 8.8, High Tensile 8.8, DIN 975 Grade
    8.8, Grade 10.9, Class 10.9, HT10.9, ISO 898 Class 5.8 are STRENGTH classes
    and the standards that define them. Copy the wording. Do NOT write an alloy
    of your own in its place: never answer 8.8 with "4140", "42CrMo" or
    "high tensile steel", and never answer 10.9 with "4340". Report what is
    printed and let our rules decide what it is bought as.
  - HDG, Hot Dip Galvanised, Galvanized, GI, ZP, Zinc, Zinc Plated,
    Electroplated, PL, Plain, Black, Self Colour and Painted are FINISHES. They
    belong in finish. None of them is ever a material: a block whose only
    wording is "GRADE 8.8 / HDG" has material "GRADE 8.8", finish "HDG", and
    nothing else.
  - A2, A2-70, A2-80, SUS304, SS304, S/S 304, AISI 304 and 304 are the
    stainless class for 304; A4, A4-70, A4-80, SUS316, SS316, S/S 316,
    AISI 316 and 316 are the stainless class for 316. Copy the wording as
    written. They are stainless designations and are never read as carbon
    strength grades — A2 is not "grade 2", and A4-70's 70 is a property class,
    not grade 8.8. Where a block says both a stainless class and a strength
    class, copy both and let our rules settle which is the material. Watch the
    paper trap: "A4", "A3" or "A2" beside sheet, paper, size, scale, format or
    drawing size is the paper the drawing is printed on, and is not a material
    at all.
Report the wording the document uses, whole. An alloy you supplied yourself
would go to a customer as if the drawing had named it.

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
  Lref / Wref = L_BOLT ONLY, null on every other product. Where each dimension
       LINE ENDS, read from the extension lines on the drawing — never from the
       label. "L", "L2", "C", "W", "short leg" and "hook leg" are only names;
       none of them says what the line is measured to.
       An L bolt is a long straight leg (the SHANK, threaded at its free end)
       and a short BENT LEG at a right angle. Orientation does not matter: the
       drawing may be upright, lying on its side or rotated.
       L runs along the shank, from its free threaded end to the bent leg, and
       Lref is where that line stops on the bent leg:
         "END"    — the FAR outer edge of the bent leg: the full outside extent
         "TOP"    — the NEAR edge of the bent leg, the edge facing the threaded
                    end, so the line stops before the bent leg's full thickness
         "CENTER" — the centre line of the bent leg
       W runs along the bent leg, from its free end to the shank, and Wref is
       where that line stops on the shank, by the same three words (END = the
       far outer edge of the shank, TOP = its near edge, CENTER = its centre
       line). A short leg dimensioned over its full height or width, outside to
       outside, is END. L and W can differ: a shank "TOP" and a short leg "END"
       on the same drawing is ordinary.
       Report L and W EXACTLY as printed — never add or subtract anything; our
       own code converts to TO END. Look at the extension lines on every L_BOLT
       drawing and give each of Lref and Wref a value: "UNCLEAR" when a dimension
       line clearly ends on the bend but you cannot tell where. null ONLY when
       the document draws no dimension lines for it at all (a table, a text
       line). Never choose END just because it is the common case or because of
       the label.
       EACH REFERENCE IS DECIDED ON ITS OWN. Lref is read from the L line's own
       extension line and Wref from the W line's own extension line: two separate
       readings. Never give one the other's value, never set both from one look
       at the drawing, and never carry a reference from L to W because they sit
       on the same bolt. A drawing measuring L to the bent leg's centre line and
       W over the outside of the shank is ordinary.
       CENTER needs evidence that THIS line ends on a centre line: a chain line
       (long dash, short dash) along the middle of that leg at the line's end, a
       "C/L", "CL" or centre-line mark there, or a stated "to centre".
         L: the L line's extension line stopping level with the chain line of the
            bent leg — its middle, not its outer face — is CENTER, even when the
            outline of the bend is drawn round it.
         W: the W line's end on the shank is CENTER only when that end itself is
            marked to the shank's centre line. An end that merely lines up with
            ANOTHER dimension taken from the bolt's centre (an edge distance,
            Eg, a spacing, a pitch) says nothing about W. An end inside the rod's
            thickness, where outer face and centre cannot be told apart, is not
            CENTER.
       A short leg given as the leg's own length — "B", "BENT LENGTH", "LEG",
       "LEG LENGTH", "HOOK LENGTH", a B column — with no centre-line mark at its
       shank end is measured over the outside of the shank: Wref "END".
       A value the source calls overall, outside or O/A is already TO END:
       report it as printed with "END" and never as CENTER or TOP, so no
       correction is ever applied to it twice.
       Where a W line is drawn to the shank, is not a leg-length callout, and its
       end genuinely cannot be told, Wref is "UNCLEAR" — a person decides.
       Deciding Wref says nothing about Lref, and the reverse. Read the L line
       first, on its own: follow its lower extension line to where it stops on
       the bent leg, and only then turn to the W line.
       Worked example (illustration only, not these values): an upright L bolt
       whose overall "L" and embedment lines both stop on a horizontal line drawn
       through the middle of the bent leg, and whose short leg is dimensioned "B"
       from the leg's free end to the shank, M10 x L300 x B40 ->
         {"M":"M10","L":300,"W":40,"Lref":"CENTER","Wref":"END"}
       L and W stay as printed; our code turns L 300 into the outside length.
       A TABLE TAKES ITS REFERENCE FROM THE DRAWING THAT DEFINES IT. A table of
       L-bolt sizes is usually accompanied by the drawing its columns refer to —
       a thumbnail beside the table, a sketch on the same sheet, or a separate
       image of the same type ("TYPE-A", the same letters L, B, C, d). The
       table's L and W columns are the dimensions THAT drawing defines, so every
       row the drawing defines carries the Lref read off that drawing's L line
       and, separately, the Wref read off its W line, each by the rules above. Report the table's numbers exactly as printed and the
       references from the drawing; never add the conversion yourself, and never
       report a value that already includes it as if it did not.
       A canonical sheet shows the SAME bolt as D x L x C x T: D the diameter, T
       the thread, L the long leg and C the short leg, both measured to the far
       outer end. That is the convention our own system stores; a customer
       drawing is read by its own dimension lines and need not look like it.
       C, L2 and any other name for the short leg go in W.
  TL = thread length; a pair as the string "75/75" or "50/110", preserving
       asymmetry exactly; a single value as a number
  Bmid = centre unthreaded segment of a segmented sag rod drawing, else null.
       This is NOT the L-bolt bend column — a bend/B column goes to W.
  qty from pcs/pc/nos/qty — a quantity is never a dimension
  product = what THIS row is, by its own geometry — SAG_ROD, STUD, ANCHOR_BOLT,
       L_BOLT, J_BOLT — or null when the row does not show it and the document
       already said. Geometry beats wording here exactly as it does at document level.
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
  SAG_ROD      M, L, TL      TL is BOTH ends: "75/75", "50/110"  qty optional
  ANCHOR_BOLT  M, L, TL      TL is ONE value: 100               qty optional
  STUD         M, L                                             qty optional
  L_BOLT       M, L, W, TL   W is the short perpendicular leg    qty optional
  J_BOLT       M, H, ID, S, TL   no L at all — the overall height is H
A diameter written once in a heading, a thread stated once beside it and a list
of lengths underneath describe ONE specification: put that M and that TL on
EVERY item that does not state its own. A value written on a row overrides the
shared one for THAT row only, and the shared value still applies to the rows
after it.

A TABLE MAY BE PRINTED SIDEWAYS
Engineering sheets are photographed at an angle, scanned upside down, or carry
a wide table turned 90 degrees so it fits a tall sheet. Read the table as the
table it is, not as the page it sits on:
  - Work out the table's own orientation from its heading row and the baselines
    of its text. Where the headings read bottom-to-top or top-to-bottom, the
    table is rotated: turn it upright in your head and read it normally.
  - Once upright, a ROW is one item and a COLUMN is one field, exactly as on
    any other table. Never report a rotated table's columns as items.
  - Report the rows in the table's own reading order, first to last.
  - Rotation changes no value. Do not transpose dimensions, do not swap length
    against quantity, do not reorder or renumber the rows, and do not drop the
    first or last row because it sits at an edge of the photograph.
  - A single cell whose text is printed sideways inside an otherwise upright
    table is a tall merged cell, not a rotated table. It covers the rows the
    cell spans — see the rule below.
Every other rule here applies unchanged to a rotated table.

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

WHAT A SPECIFICATION CELL ACTUALLY COVERS
A specification, material or remarks cell merged beside a block of rows
describes THOSE rows and nothing else. Two questions decide what it says:
  1. WHICH ROWS. Exactly the rows the merge spans, and no further. A cell
     beside rows 1-2 says nothing whatever about rows 3-6, and the cell beside
     rows 3-6 says nothing about rows 1-2. Report each block's wording on the
     FIRST row it covers and leave the field null on the rest of that block.
  2. WHICH PART. One cell often specifies a whole assembly in a single
     paragraph — the rod, its nuts and its washers together: "STUD DIN 975
     GRADE 8.8 / HEX NUT DIN 934 GRADE 8 / FLAT WASHER DIN 125 / HDG". The
     item being quoted is the ROD. Take the material, grade and standard
     attached to the rod and ignore the ones attached to the nut, the washer,
     the lock nut, the plate or the anchor. A hex nut's Grade 8 is not the
     stud's grade; a washer's hardness is not the stud's anything.
A finish stated once for such an assembly — HDG, ZP, PL — applies to the rows
that cell covers. It is a finish, and it never becomes the material.

A ROW'S OWN SPECIFICATION BEATS A GENERAL REMARK
Sheets carry sheet-wide notes: "ALL BOLTS TO ISO 898 CLASS 5.8", "UNLESS NOTED
OTHERWISE", a standard printed in the title block. Those are the fallback, used
only where nothing more specific applies. A grade, standard or material written
against a particular row or block replaces the general note for those rows:
where the sheet note says Class 5.8 and the cell beside rows 3-6 says DIN 975
Grade 8.8, those rows are Grade 8.8. Report the row's own wording, do not
overwrite it with the sheet-wide note, and do not merge the two into one
string.

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

/**
 * Validate a multi-image upload ($_FILES['files'], PHP's per-field arrays).
 * Every entry goes through ai_validate_upload() and must be an image — a PDF
 * is one per analysis and never mixes with images. Order is the upload order.
 * Returns ['ok'=>true,'kind'=>'images','parts'=>[upload...],'mime'=>...,'size'=>...]
 * or the first failure.
 */
function ai_validate_uploads($files) {
    if (!is_array($files) || !isset($files['error']) || !is_array($files['error'])) {
        return ['ok'=>false,'error'=>'no_file','message'=>'No file was uploaded.'];
    }
    $n = count($files['error']);
    if ($n < 1) {
        return ['ok'=>false,'error'=>'no_file','message'=>'No file was uploaded.'];
    }
    if ($n > AI_MAX_IMAGES) {
        return ['ok'=>false,'error'=>'too_many_files',
                'message'=>'Maximum '.AI_MAX_IMAGES.' images per analysis.'];
    }
    $parts = []; $size = 0;
    foreach (array_keys($files['error']) as $k) {
        $one = [];
        foreach (['name','type','tmp_name','error','size'] as $f) $one[$f] = $files[$f][$k] ?? null;
        $u = ai_validate_upload($one);
        if (!$u['ok']) return $u;
        if ($u['kind'] !== 'image') {
            return ['ok'=>false,'error'=>'mixed_upload',
                    'message'=>'Upload either images or one PDF, not both.'];
        }
        $parts[] = $u; $size += $u['size'];
    }
    return ['ok'=>true,'kind'=>'images','parts'=>$parts,'mime'=>'images/'.count($parts),'size'=>$size];
}

/** One Responses API content part for one validated file. */
function ai_file_part($upload) {
    $dataUrl = 'data:' . $upload['mime'] . ';base64,' . base64_encode($upload['bytes']);
    if ($upload['kind'] === 'pdf') {
        return ['type'=>'input_file','filename'=>$upload['name'],'file_data'=>$dataUrl];
    }
    // high detail: engineering text on screenshots and photos is small
    return ['type'=>'input_image','image_url'=>$dataUrl,'detail'=>'high'];
}

/**
 * Per-file notes, sent as file_notes[] in file order beside files[] (or beside
 * the single file). Each is cleaned like the global note. Anything that is not
 * a list of strings is ignored, never an error.
 */
function ai_clean_file_notes($raw) {
    if (!is_array($raw)) return [];
    $out = [];
    foreach (array_values($raw) as $v) $out[] = ai_clean_note($v);
    return $out;
}

/** Build the Responses API payload for one validated upload (or one image set).
 *  $note is the GLOBAL note (every file); $fileNotes[i] belongs to file i only. */
function ai_build_payload($upload, $note = '', $fileNotes = []) {
    if ($upload['kind'] === 'images') {
        // Several images, ONE request: the model reads them side by side so a
        // dimension on one can be matched to the item drawn on another.
        $n = count($upload['parts']);
        $lead = 'Extract the quotation specification from these '.$n.' images. '
              . 'They belong to ONE customer request: read them together and '
              . 'cross-reference information across them. Their order (Image 1 to '
              . 'Image '.$n.') is contextual evidence. Do not create duplicate items '
              . 'merely because the same item appears in more than one image. If two '
              . 'images give conflicting values for the same field, do not guess: '
              . 'return null for that field and describe the conflict in that row\'s '
              . '"unclear" field.';
        $fileParts = [];
        foreach ($upload['parts'] as $i => $p) {
            $fileParts[] = ['type'=>'input_text', 'text'=>'Image '.($i+1).' of '.$n.':'];
            $fileParts[] = ai_file_part($p);
            // A note written for ONE image is scoped to it, said beside it, and
            // must not be carried over to items that appear only in other images.
            $fn = $fileNotes[$i] ?? '';
            if ($fn !== '') {
                $fileParts[] = ['type'=>'input_text', 'text'=>'Note for Image '.($i+1).' ONLY (it does not '
                    . 'apply to the other images). Where it gives a value for a field of an item shown in '
                    . 'Image '.($i+1).", that value is correct:\n".$fn];
            }
        }
        if (array_filter($fileNotes, 'strlen')) {
            $lead .= ' Some images carry their own note. Apply each note only to items from its own '
                   . 'image. If a note for one image conflicts with the note for the whole request, or '
                   . 'with another image, do not guess: return null for that field and describe the '
                   . 'conflict in that row\'s "unclear" field.';
        }
    } else {
        $fileParts = [ai_file_part($upload)];
        $lead = 'Extract the quotation specification from this document.';
        // One document: its own note and the global note describe the same file.
        $fn = $fileNotes[0] ?? '';
        if ($fn !== '') $note = $note !== '' ? $note . "\n" . $fn : $fn;
    }
    // The person who uploaded the drawing is looking at it. Where their note
    // gives a value, that value is the answer — said here so the model reads the
    // rest of the drawing in the same terms, and enforced independently by the
    // caller so a model that ignores this line changes nothing.
    if ($note !== '') {
        $lead .= "\n\nThe person who sent this document added the following note about it"
               . ($upload['kind'] === 'images' ? " (it applies to ALL the images)" : "") . ". "
               . "Where the note gives a value for a field, that value is correct and "
               . "replaces what the document shows for that field:\n" . $note;
    }
    return [
        'model' => AI_EXTRACT_MODEL_PRIMARY,
        'instructions' => ai_instructions(),
        'input' => [[
            'role' => 'user',
            'content' => array_merge(
                [['type'=>'input_text', 'text'=>$lead]],
                $fileParts
            ),
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
    $prodOk = ['SAG_ROD','STUD','ANCHOR_BOLT','L_BOLT','J_BOLT','OTHER'];
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
            // L-bolt dimension references, passed through as evidence only.
            'Lref'     => in_array($it['Lref'] ?? null, ['TOP','CENTER','END','UNCLEAR'], true) ? $it['Lref'] : null,
            'Wref'     => in_array($it['Wref'] ?? null, ['TOP','CENTER','END','UNCLEAR'], true) ? $it['Wref'] : null,
            // Anchor plate size: evidence shown to staff, never a quotation field.
            'plate'    => (($pl = $num($it['plate'] ?? null)) !== null && $pl >= 1) ? $pl : null,
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

/** The answers the person holding the document sees when no rows came back. */
function ai_failure($code) {
    $m = [
        'ai_refused'        => 'The analysis service declined to read this document. Paste the text manually instead.',
        'ai_too_long'       => 'This document has more rows than one analysis can return, so the answer was cut off. Split it into two uploads — or crop to part of the table — and try again.',
        'ai_incomplete'     => 'The analysis stopped before it finished. Try again, or split the document into smaller uploads.',
        'ai_output_invalid' => 'The analysis came back in a form this app could not read. Try again, or paste the text manually.',
    ];
    return ['error' => $code, 'message' => $m[$code] ?? $m['ai_output_invalid']];
}

// ── Second reading: quotation coverage + L Bolt references (R3 FAST Loop #6/#7) ──
/* ONE short Sonnet request that sees the same images, is never shown the main
   answer, and reports two things the main reading has been measured getting
   wrong on the Owner's own drawing:

   1. COVERAGE — which items the customer asks to have quoted. The main reading
      twice returned ONE row of ten (raw response checked in Loop #7: the model
      itself answered with one item, end_turn, nothing truncated or dropped by
      our parser). A short list looks exactly like a complete one, so the
      check's own list is compared with the rows by size and length:
        coverage.state  complete   every checked item has a row
                        partial    checked items with no row — named in
                                   coverage.missing; Quick Add holds Add behind
                                   the same "I have checked the source" tick a
                                   cut-off answer uses
                        uncertain  the check did not answer: said, not blocked
      The check is evidence only: its items never become rows, dimensions or
      prices, and rows it does not list are never removed.

   2. L BOLT REFERENCES — where each L and W extension line ends, compared per
      row and per dimension with the main reading:
        Lchk / Wchk   agree | conflict | unclear | unmatched | failed
        Lalt / Walt   the check's own reference (TOP / CENTER / END / UNCLEAR / null)
      Only "agree" lets a conversion go through on its own; everything else
      holds the value back for a one-click confirmation in Quick Add.

   Nothing here rewrites L, W or the main reading: they reach the client as printed. */
const AI_REFCHECK_ENDS = ['CENTRE_LINE', 'FAR_FACE', 'NEAR_FACE', 'CANNOT_TELL', 'NOT_DRAWN', 'N_A'];
const AI_REFCHECK_MAP  = ['CENTRE_LINE' => 'CENTER', 'FAR_FACE' => 'END', 'NEAR_FACE' => 'TOP',
                          'CANNOT_TELL' => 'UNCLEAR', 'NOT_DRAWN' => null];
const AI_REFCHECK_KINDS = ['L_BOLT', 'J_BOLT', 'SAG_ROD', 'STUD', 'ANCHOR_BOLT', 'U_BOLT', 'PLATE', 'OTHER'];
const AI_REFCHECK_TIMEOUT = 60;
/* Sonnet 5.5 thinks by default and its thinking counts against max_tokens:
   2000 left room for four L bolts, not for a thirty-row schedule. */
const AI_REFCHECK_MAX_TOKENS = 12000;

function ai_refcheck_schema() {
    $end = ['type' => 'string', 'enum' => AI_REFCHECK_ENDS];
    return [
        'type' => 'object', 'additionalProperties' => false,
        'properties' => ['items' => ['type' => 'array', 'items' => [
            'type' => 'object', 'additionalProperties' => false,
            'properties' => ['kind' => ['type' => 'string', 'enum' => AI_REFCHECK_KINDS],
                             'M' => ['type' => 'string'], 'L' => ['type' => 'number'], 'W' => ['type' => 'number'],
                             'qty' => ['type' => 'integer'], 'Lend' => $end, 'Wend' => $end],
            'required' => ['kind', 'M', 'L', 'W', 'qty', 'Lend', 'Wend'],
        ]]],
        'required' => ['items'],
    ];
}

function ai_refcheck_instructions() {
    return <<<'TXT'
You check a customer's fastener drawings, tables or lists for two things. Nothing else is asked and nothing else is reported.

PART 1 — WHICH ITEMS THE CUSTOMER ASKS TO HAVE QUOTED

List every item the customer is asking us to quote:
  each row of a quantity table, schedule or bill of materials is one item;
  each item written with its own quantity is one item.
A drawing that only shows what a table's rows look like adds no items of its own: a drawing and the table that refers to it are the same items, listed once.
Parts drawn only for context — nuts, washers, base plates, grout, concrete, sleeves, an anchor plate given as a dimension of a bolt — are not items, unless the document lists them as their own line with a quantity.
Count what is there. Do not merge two rows that differ in any value, do not split one row into several, and do not add items the document does not ask for.

For each item:
  kind  L_BOLT (long straight leg with a short leg bent at a right angle), J_BOLT (hooked end), SAG_ROD (straight rod threaded at both ends), STUD, ANCHOR_BOLT (straight rod threaded at one end), U_BOLT, PLATE, OTHER
  M     the size as printed, e.g. "M12"; "" when the item has none
  L     the item's length as printed, in mm — a J bolt's overall height — 0 when none is given
  W     an L bolt's short leg as printed, in mm; 0 for every other item
  qty   the quantity as printed; 0 when none is given

PART 2 — WHERE L-BOLT DIMENSION LINES END (L_BOLT items only; every other item: Lend and Wend are N_A)

An L bolt has a long straight leg (the SHANK, threaded at its free end) and a short BENT LEG at a right angle. The drawing may be upright, on its side or rotated.
  L is the dimension along the shank, from its threaded end to the bent leg.
  W is the dimension along the bent leg, from its free end to the shank.
Each row of an L-bolt table is one size, and a table's L and W columns are the dimensions of the drawing that defines them (a sketch beside the table, the same sheet, or another image of the same type).
  Lend  what the L line's extension line touches at the BENT-LEG end
  Wend  what the W line's extension line touches at the SHANK end

Each of Lend and Wend is one of:
  CENTRE_LINE  the extension line stops level with a chain line (long dash, short dash) or a centre-line mark (CL, C/L) running along the MIDDLE of that leg, or the document says "to centre". It is CENTRE_LINE even when the outline of the bend is drawn around it.
  FAR_FACE     it stops at the outside face of that leg, the face farthest from where the line starts: the full outside extent. A value called overall, outside or O/A is FAR_FACE.
  NEAR_FACE    it stops at the inside face of that leg, the face nearest to where the line starts.
  CANNOT_TELL  a line is drawn to that leg but where it stops cannot be told.
  NOT_DRAWN    no dimension line is drawn for it (a table or text with no drawing defining the column).

Rules:
  Follow the line itself to its end. The letter, the product name, the bolt's purpose and what is usual say nothing about where a line ends.
  Decide Lend and Wend separately, each from its own extension line. Never give one the other's answer.
  A short leg given as its own length — B, LEG, LEG LENGTH, BENT LENGTH, a B column — with no centre-line mark at its shank end is FAR_FACE.
  A W end that merely lines up with ANOTHER dimension taken from the bolt's centre (an edge distance, a spacing) says nothing: it is CENTRE_LINE only when that end itself is marked to the centre line.
  A W extension line that meets the shank WITHIN its drawn thickness (the shank is two thin lines close together, and the line's end cannot be told apart from either face or the middle) is not CENTRE_LINE; for a B / leg-length dimension it is FAR_FACE.
TXT;
}

/** The images / PDF of the upload as Messages content, labelled as the extraction labels them. */
function ai_refcheck_request($upload) {
    $parts = ($upload['kind'] ?? '') === 'images' ? $upload['parts'] : [$upload];
    $n = count($parts);
    $content = [['type' => 'text', 'text' => $n > 1
        ? "Check these $n images. They belong to one customer request."
        : 'Check this document.']];
    foreach ($parts as $i => $p) {
        if ($n > 1) $content[] = ['type' => 'text', 'text' => 'Image ' . ($i + 1) . " of $n:"];
        $src = ['type' => 'base64', 'media_type' => $p['mime'], 'data' => base64_encode($p['bytes'])];
        $content[] = ($p['kind'] ?? '') === 'pdf' ? ['type' => 'document', 'source' => $src] : ['type' => 'image', 'source' => $src];
    }
    return [
        'model'      => ai_anthropic_model(),
        'max_tokens' => AI_REFCHECK_MAX_TOKENS,
        'system'     => [['type' => 'text', 'text' => ai_refcheck_instructions(), 'cache_control' => ['type' => 'ephemeral']]],
        'messages'   => [['role' => 'user', 'content' => $content]],
        'output_config' => ['format' => ['type' => 'json_schema', 'schema' => ai_refcheck_schema()]],
    ];
}

/** Does this extraction hold an L Bolt dimension? (marks the rows a single reading leaves unverified) */
function ai_refcheck_needed($data) {
    foreach (($data['items'] ?? []) as $it) {
        $p = $it['product'] ?? null;
        if ($p === null) $p = $data['product'] ?? null;
        if ($p === 'L_BOLT' && (($it['L'] ?? null) !== null || ($it['W'] ?? null) !== null)) return true;
    }
    return false;
}

/**
 * The check's answer, validated: ['items' => every listed item, 'bolts' => the L-bolt
 * readings], or null when it is not one (an error, a refusal, a cut-off answer).
 */
function ai_refcheck_parse($code, $body, $curlErr, $curlErrNo) {
    if ($curlErr !== '' || $curlErrNo || $code !== 200 || !is_array($body) || ($body['stop_reason'] ?? '') !== 'end_turn') return null;
    $text = '';
    foreach (($body['content'] ?? []) as $b) if (($b['type'] ?? '') === 'text') $text .= $b['text'];
    $d = json_decode($text, true);
    if (!is_array($d) || !isset($d['items']) || !is_array($d['items'])) return null;
    $num = fn($v) => (is_int($v) || is_float($v)) && $v > 0 && $v < 1000000 ? $v : null;
    $items = []; $bolts = [];
    foreach (array_slice($d['items'], 0, AI_MAX_ITEMS) as $b) {
        if (!is_array($b) || !is_string($b['M'] ?? null)) continue;
        if (!in_array($b['kind'] ?? null, AI_REFCHECK_KINDS, true)) continue;
        if (!in_array($b['Lend'] ?? null, AI_REFCHECK_ENDS, true) || !in_array($b['Wend'] ?? null, AI_REFCHECK_ENDS, true)) continue;
        $row = ['kind' => $b['kind'], 'M' => strtoupper(preg_replace('/\s+/', '', $b['M'])), 'L' => $num($b['L'] ?? null),
                'W' => $num($b['W'] ?? null), 'qty' => (is_int($b['qty'] ?? null) && $b['qty'] > 0) ? $b['qty'] : null];
        $items[] = $row;
        if ($b['Lend'] !== 'N_A' && $b['Wend'] !== 'N_A') {
            $bolts[] = $row + ['Lref' => AI_REFCHECK_MAP[$b['Lend']], 'Wref' => AI_REFCHECK_MAP[$b['Wend']]];
        }
    }
    return ['items' => $items, 'bolts' => $bolts];
}

/** "M30 L250" — how a checked item is named to staff. */
function ai_refcheck_label($c) {
    $l = trim(($c['M'] ?? '') . (($c['L'] ?? null) !== null ? ' L' . $c['L'] : ''));
    if ($l === '') $l = str_replace('_', ' ', $c['kind'] ?? 'item');
    return $l;
}

/**
 * Compare the two readings and write the outcome onto the extraction.
 * $check === null: the check did not answer — every L Bolt dimension is "failed"
 * (unverified, confirmed by a person) and coverage is "uncertain".
 */
function ai_refcheck_apply($data, $check) {
    if (!is_array($data) || !isset($data['items'])) return $data;
    $bolts = $check === null ? null : ($check['bolts'] ?? []);
    $eff  = fn($r) => $r === null ? 'END' : $r;            // no reference drawn = as printed = to the end
    $same = fn($a, $b) => $a !== null && $b !== null && abs($a - $b) < 0.5;
    $normM = fn($m) => strtoupper(preg_replace('/\s+/', '', (string)$m));
    foreach ($data['items'] as &$it) {
        $p = $it['product'] ?? null;
        if ($p === null) $p = $data['product'] ?? null;
        if ($p !== 'L_BOLT') continue;
        $match = null;
        if ($bolts !== null) {
            $m = $normM($it['M'] ?? '');
            $c = array_values(array_filter($bolts, fn($b) => $m !== '' && $b['M'] === $m));
            if (count($c) > 1) {
                $byL = array_values(array_filter($c, fn($b) => $same($b['L'], $it['L'] ?? null)));
                if ($byL) $c = $byL;
                if (count($c) > 1) {
                    $byW = array_values(array_filter($c, fn($b) => $same($b['W'], $it['W'] ?? null)));
                    if ($byW) $c = $byW;
                }
                /* Still more than one and they disagree: no single answer to compare with. */
                if (count($c) > 1 && count(array_unique(array_map(fn($b) => ($b['Lref'] ?? '-') . '|' . ($b['Wref'] ?? '-'), $c))) > 1) $c = [];
            }
            $match = $c[0] ?? null;
        }
        foreach (['L', 'W'] as $k) {
            if (($it[$k] ?? null) === null) continue;      // nothing printed, nothing to check
            $first = $it[$k . 'ref'] ?? null;
            if ($bolts === null)      { $it[$k . 'chk'] = 'failed';    $it[$k . 'alt'] = null; continue; }
            if ($match === null)      { $it[$k . 'chk'] = 'unmatched'; $it[$k . 'alt'] = null; continue; }
            $alt = $match[$k . 'ref'];
            $it[$k . 'alt'] = $alt;
            if ($first === 'UNCLEAR')                       $it[$k . 'chk'] = 'unclear';
            elseif ($alt !== 'UNCLEAR' && $eff($first) === $eff($alt)) $it[$k . 'chk'] = 'agree';
            else                                            $it[$k . 'chk'] = 'conflict';
        }
    }
    unset($it);

    /* Coverage: every item the check listed should have a row. One row stands
       for one checked item (a repeated size is counted, not collapsed). Size
       and length decide; the product word does not, so a row the two readers
       name differently still covers it. A row the check did not list is left
       alone — the check is never a reason to remove anything. */
    if ($check === null) {
        $data['coverage'] = ['state' => 'uncertain', 'checked' => null, 'read' => count($data['items']), 'missing' => []];
    } else {
        $pool = [];
        foreach ($data['items'] as $i => $it) {
            $len = $it['L'] ?? null; if ($len === null) $len = $it['H'] ?? null;
            $pool[$i] = ['M' => $normM($it['M'] ?? ''), 'L' => $len];
        }
        $missing = [];
        foreach ($check['items'] as $c) {
            $hit = null;
            foreach ($pool as $i => $r) {                  // size and length first
                if ($r['M'] === $c['M'] && $same($r['L'], $c['L'])) { $hit = $i; break; }
            }
            if ($hit === null) foreach ($pool as $i => $r) {   // one side gives no length: size alone
                if ($r['M'] === $c['M'] && ($r['L'] === null || $c['L'] === null)) { $hit = $i; break; }
            }
            if ($hit === null) $missing[] = ai_refcheck_label($c);
            else unset($pool[$hit]);
        }
        $data['coverage'] = ['state' => $missing ? 'partial' : 'complete', 'checked' => count($check['items']),
                             'read' => count($data['items']), 'missing' => array_slice($missing, 0, 30)];
    }
    return $data;
}

/** The check's answer as a log line (never the customer's content). */
function ai_refcheck_log($upload, $code, $body, $check, $t, $ms = null) {
    $u = is_array($body) ? ($body['usage'] ?? []) : [];
    $res = ['http' => $code, 'outcome' => $check === null ? 'refcheck_failed' : 'ok', 'data' => null,
            'usage' => ['in' => (int)($u['input_tokens'] ?? 0) + (int)($u['cache_read_input_tokens'] ?? 0) + (int)($u['cache_creation_input_tokens'] ?? 0),
                        'cached_in' => (int)($u['cache_read_input_tokens'] ?? 0), 'cache_write' => (int)($u['cache_creation_input_tokens'] ?? 0),
                        'out' => (int)($u['output_tokens'] ?? 0)]];
    $e = ai_log_entry($upload, 'anthropic', ai_anthropic_model(), $res, $t,
                      ['stage' => 'refcheck', 'items' => $check === null ? 0 : count($check['items']),
                       'stop' => is_array($body) ? ($body['stop_reason'] ?? null) : null]);
    if ($ms !== null) $e['ms'] = $ms;
    return $e;
}

/**
 * The extraction and the check, sent AT THE SAME TIME (the check does not need
 * the extraction's answer), so it adds no waiting. Same headers, body and
 * per-request timeout as ai_call_anthropic. Returns one
 * [httpCode, decodedBody|null, curlErr, curlErrNo, ms] per request, in order.
 */
function ai_call_anthropic_multi($requests, $key, $timeouts) {
    $mh = curl_multi_init(); $hs = [];
    foreach ($requests as $i => $req) {
        $ch = curl_init(ai_anthropic_url());
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($req),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'x-api-key: ' . $key, 'anthropic-version: ' . AI_ANTHROPIC_VERSION],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeouts[$i] ?? 120,
            CURLOPT_CONNECTTIMEOUT => 15,
        ]);
        curl_multi_add_handle($mh, $ch); $hs[$i] = $ch;
    }
    $errNo = [];
    do {
        $st = curl_multi_exec($mh, $running);
        while ($info = curl_multi_info_read($mh)) {
            foreach ($hs as $i => $ch) if ($ch === $info['handle']) $errNo[$i] = (int)$info['result'];
        }
        /* select() can return -1 at once on some builds: wait a moment instead of spinning. */
        if ($running && $st === CURLM_OK && curl_multi_select($mh, 1.0) === -1) usleep(20000);
    } while ($running && $st === CURLM_OK);
    $out = [];
    foreach ($hs as $i => $ch) {
        $raw  = curl_multi_getcontent($ch);
        $no   = $errNo[$i] ?? curl_errno($ch);
        $err  = $no ? (curl_error($ch) ?: curl_strerror($no)) : '';
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $ms   = (int)round(curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000);
        curl_multi_remove_handle($mh, $ch); curl_close($ch);
        $out[$i] = [$code, is_string($raw) && $raw !== '' ? json_decode($raw, true) : null, $err, $no, $ms];
    }
    curl_multi_close($mh);
    return $out;
}

// ── provider orchestration ───────────────────────────────────────────────────
function ai_image_provider() {
    return AI_IMAGE_PROVIDER === 'sonnet' ? 'sonnet' : 'luna';
}

/* A Sonnet answer that never arrived is a TECHNICAL failure: Luna then reads the
   same request once, and the whole result is marked for review. An answer that
   arrived but is uncertain — unclear fields, no rows, cut off — is never
   replaced: a second model would paper over a doubt the reviewer must see.
   A refusal counts as technical: on a fastener drawing it can only be a
   safeguard false positive, never doubt about the document. */
const AI_TECHNICAL_FAILURES = ['not_configured', 'preflight_oversize', 'timeout', 'network', 'auth',
                               'rate', 'upstream', 'request', 'malformed', 'refusal'];

// USD per million tokens, from the providers' price pages on 2026-11-03.
const AI_PRICES = [
    'openai'    => ['in' => 0.20, 'cached_in' => 0.02, 'cache_write' => 0.20, 'out' => 1.20],
    'anthropic' => ['in' => 2.00, 'cached_in' => 0.10, 'cache_write' => 2.50, 'out' => 10.00],
];
function ai_est_usd($provider, $u) {
    $p = AI_PRICES[$provider];
    $plain = max(0, ($u['in'] ?? 0) - ($u['cached_in'] ?? 0) - ($u['cache_write'] ?? 0));
    return round(($plain * $p['in'] + ($u['cached_in'] ?? 0) * $p['cached_in']
                  + ($u['cache_write'] ?? 0) * $p['cache_write'] + ($u['out'] ?? 0) * $p['out']) / 1e6, 6);
}

/** Luna's answer reduced to the shape ai_anthropic_result() returns. */
function ai_luna_result($code, $body, $curlErr, $curlErrNo) {
    $r = ['outcome' => 'ok', 'http' => $code, 'data' => null, 'truncated' => false, 'error' => null,
          'usage' => ['in' => 0, 'cached_in' => 0, 'cache_write' => 0, 'out' => 0]];
    if ($e = ai_map_error($code, $body, $curlErr, $curlErrNo)) { $r['outcome'] = $e['error']; $r['error'] = $e; return $r; }
    $u = is_array($body) ? ($body['usage'] ?? []) : [];
    $r['usage'] = ['in' => (int)($u['input_tokens'] ?? 0), 'cached_in' => (int)($u['input_tokens_details']['cached_tokens'] ?? 0),
                   'cache_write' => 0, 'out' => (int)($u['output_tokens'] ?? 0)];
    /* ── Why it failed matters ──────────────────────────────────────────────
       Every model-side failure used to arrive as one sentence — "Could not
       analyze this file" — whether the service had declined to read it, run
       out of room mid-answer, or returned something that was not JSON. Those
       need three different things from the person holding the document, so
       they are now three different answers. */
    $refusal    = ai_output_refusal($body);
    $incomplete = ai_incomplete_reason($body);
    $text       = ai_extract_output_text($body);
    $r['data']  = $text !== null ? ai_sanitise_extraction($text) : null;
    /* Cut off mid-answer: keep the rows that arrived whole, and say so. */
    if ($r['data'] === null && $text !== null && $incomplete !== '' && ($s = ai_salvage_extraction($text)) !== null) {
        $r['data'] = ai_sanitise_data($s);
    }
    if ($r['data'] !== null && $incomplete !== '') $r['truncated'] = true;
    if ($r['data'] === null) {
        $code = $refusal !== '' ? 'ai_refused'
              : ($incomplete === 'max_output_tokens' ? 'ai_too_long' : ($incomplete !== '' ? 'ai_incomplete' : 'ai_output_invalid'));
        $r['outcome'] = $code; $r['error'] = ai_failure($code);
    }
    return $r;
}

/** One structured log line per provider call: never a key, a header or the customer's content. */
function ai_log_entry($upload, $provider, $model, $res, $t0, $extra = []) {
    return array_merge([
        'kind' => $upload['kind'], 'mime' => $upload['mime'] ?? '', 'size' => $upload['size'] ?? 0,
        'provider' => $provider, 'model' => $model, 'ms' => (int)round((microtime(true) - $t0) * 1000),
        'http' => $res['http'] ?? null, 'outcome' => $res['outcome'],
        'in' => $res['usage']['in'] ?? 0, 'cached_in' => $res['usage']['cached_in'] ?? 0,
        'cache_write' => $res['usage']['cache_write'] ?? 0, 'out' => $res['usage']['out'] ?? 0,
        'est_usd' => ai_est_usd($provider, $res['usage'] ?? []),
        'items' => $res['data'] ? count($res['data']['items']) : 0,
        'fallback' => false, 'fallback_reason' => null, 'preflight' => 'n/a',
    ], $extra);
}

/** Pasted text, or images / PDFs while the switch says Luna: today's single call. */
function ai_extract_luna($upload, $payload, $deps = []) {
    $call = $deps['luna'] ?? 'ai_call_openai';
    $t = microtime(true);
    list($c, $b, $e, $n) = $call($payload);
    $r = ai_luna_result($c, $b, $e, $n);
    /* A drawing read once: its L Bolt references are unverified and its
       completeness was not double-checked (pasted text is neither). */
    if (($upload['kind'] ?? '') !== 'text' && $r['data'] !== null) $r['data'] = ai_refcheck_apply($r['data'], null);
    return ['result' => $r, 'provider' => 'openai', 'model' => AI_EXTRACT_MODEL_PRIMARY, 'fallback' => null,
            'review' => $r['truncated'], 'log' => [ai_log_entry($upload, 'openai', AI_EXTRACT_MODEL_PRIMARY, $r, $t)]];
}

/**
 * Images and PDFs with Sonnet primary: the extraction and the second reading
 * (coverage + L Bolt references) go out together, then at most one Luna call if
 * the extraction technically failed — never a loop. $deps lets the tests replace
 * the transports and the key; with an injected 'sonnet' the two Sonnet requests
 * run one after the other through it ('refcheck' overrides the second).
 */
function ai_extract_media($upload, $payload, $deps = []) {
    $luna   = $deps['luna'] ?? 'ai_call_openai';
    $key    = array_key_exists('key', $deps) ? $deps['key'] : ai_anthropic_key();
    $zero   = ['in' => 0, 'cached_in' => 0, 'cache_write' => 0, 'out' => 0];
    $pf = ai_anthropic_preflight($upload);
    $t = microtime(true);
    $check = null; $checkLog = null;
    if ($key === '')    $res = ['outcome' => 'not_configured', 'http' => null, 'data' => null, 'truncated' => false, 'usage' => $zero];
    elseif (!$pf['ok']) $res = ['outcome' => 'preflight_oversize', 'http' => null, 'data' => null, 'truncated' => false, 'usage' => $zero];
    else {
        $main = ai_anthropic_request($payload); $chkReq = ai_refcheck_request($upload);
        if (isset($deps['sonnet'])) {
            list($c, $b, $e, $n) = $deps['sonnet']($main, $key);
            $tc = microtime(true);
            list($cc, $cb, $ce, $cn) = ($deps['refcheck'] ?? $deps['sonnet'])($chkReq, $key, AI_REFCHECK_TIMEOUT);
            $cms = null;
        } else {
            list($r0, $r1) = ai_call_anthropic_multi([$main, $chkReq], $key, [120, AI_REFCHECK_TIMEOUT]);
            list($c, $b, $e, $n) = $r0; list($cc, $cb, $ce, $cn, $cms) = $r1; $tc = $t;
        }
        $res = ai_anthropic_result($c, $b, $e, $n);
        $check = ai_refcheck_parse($cc, $cb, $ce, $cn);
        $checkLog = ai_refcheck_log($upload, $cc, $cb, $check, $tc, $cms);
    }
    $log = [ai_log_entry($upload, 'anthropic', ai_anthropic_model(), $res, $t, ['preflight' => $pf['ok'] ? 'pass' : 'block'])];
    if ($checkLog) $log[] = $checkLog;

    if (in_array($res['outcome'], AI_TECHNICAL_FAILURES, true)) {
        $t = microtime(true);
        list($c, $b, $e, $n) = $luna($payload);
        $l = ai_luna_result($c, $b, $e, $n);
        $log[] = ai_log_entry($upload, 'openai', AI_EXTRACT_MODEL_PRIMARY, $l, $t,
                              ['fallback' => true, 'fallback_reason' => $res['outcome']]);
        /* The backup reader's rows are compared with the same second reading
           when it answered; when it did not, they are unverified and uncertain. */
        if ($l['data'] !== null) $l['data'] = ai_refcheck_apply($l['data'], $check);
        return ['result' => $l, 'provider' => 'openai', 'model' => AI_EXTRACT_MODEL_PRIMARY,
                'fallback' => $res['outcome'], 'review' => true, 'log' => $log];
    }
    if ($res['outcome'] === 'too_long') $res['error'] = ai_failure('ai_too_long');
    if ($res['data'] !== null) $res['data'] = ai_refcheck_apply($res['data'], $check);
    $cov = $res['data']['coverage']['state'] ?? 'complete';
    return ['result' => $res, 'provider' => 'anthropic', 'model' => ai_anthropic_model(), 'fallback' => null,
            'review' => $res['truncated'] || ($res['data'] !== null && !$res['data']['items']) || $cov !== 'complete', 'log' => $log];
}

/* What every user sees beside the AI badge: which model read the source, whether
   it was the backup reader, how long it took and what it cost. Only these five
   facts leave the server — never a key, a token count, a request id or any of
   the model's own wording. */
function ai_result_meta($run, $t0) {
    return ['provider' => $run['provider'], 'model' => $run['model'], 'fallback' => $run['fallback'],
            'ms' => (int)round((microtime(true) - $t0) * 1000),
            'est_usd' => round(array_sum(array_column($run['log'], 'est_usd')), 6)];
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
    /* Same origin + this session's token (X-DC-CSRF), so no other page —
       the Portal's origin included — can spend OpenAI quota as this user.
       Multipart, so no JSON content-type requirement. */
    dc_require_csrf_api(false);
    $openaiReady = !(OPENAI_API_KEY === '' || OPENAI_API_KEY === 'sk-REPLACE-ME');
    $sonnetMedia = !isset($_POST['text']) && ai_image_provider() === 'sonnet';
    /* Text and Luna-read files need the OpenAI key; Sonnet-read files need at
       least one of the two, because Luna is their technical fallback. */
    if (!$openaiReady && !($sonnetMedia && ai_anthropic_key() !== '')) {
        ai_json(['ok'=>false,'error'=>'not_configured',
                 'message'=>'AI extraction is not configured on this server yet.'], 503);
    }
    /* Two request shapes, one endpoint: a file upload (photo / PDF) or pasted
       text from the Quick Add fallback. Exactly one of them, never both, so a
       request cannot smuggle a file past the text path. */
    $hasMulti = isset($_FILES['files']);
    $hasFile = isset($_FILES['file']) || $hasMulti;
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
    } elseif ($hasMulti) {
        $upload = ai_validate_uploads($_FILES['files']);
        foreach ((array)($_FILES['files']['tmp_name'] ?? []) as $tmp) {
            if (is_string($tmp) && $tmp !== '') @unlink($tmp);
        }
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
        : ai_build_payload($upload, ai_clean_note($_POST['note'] ?? ''),
                           ai_clean_file_notes($_POST['file_notes'] ?? []));
    $run = $sonnetMedia ? ai_extract_media($upload, $payload) : ai_extract_luna($upload, $payload);
    unset($upload['bytes'], $upload['text'], $upload['parts'], $payload);    // free the raw input from memory
    foreach ($run['log'] as $entry) error_log('[ai_extract] ' . json_encode($entry, JSON_UNESCAPED_SLASHES));

    $r = $run['result'];
    if ($r['data'] === null) {
        $e = $r['error'] ?? ai_failure('ai_output_invalid');
        ai_json(['ok'=>false,'error'=>$e['error'],'message'=>$e['message']], 502);
    }
    /* truncated says: these rows are right, and there may have been more. The
       review screen shows it as a warning against the list, never as a row.
       review says: someone must look before this is trusted — a backup reader
       was used, the answer was cut off, or no rows came back. */
    $out = ['ok'=>true, 'data'=>$r['data'], 'truncated'=>$r['truncated'], 'review'=>$run['review']];
    $out['meta'] = ai_result_meta($run, $t0);
    ai_json($out);
}
