<?php
/**
 * Der-Cheng Quotation — Pricing History
 *
 * The rules that decide whether a saved item is the same item as the one being
 * quoted, what its bolt price actually was once accessories are taken out of
 * it, and in what order the records are worth reading.
 *
 * Deliberately free of any database, session or HTTP dependency: api.php reads
 * the rows and hands each stored item to these functions, and the test suite
 * hands them the same items without a database. One set of rules, one place,
 * testable.
 *
 * The feature is a LOOKUP, not a recommendation. Nothing here averages,
 * interpolates, reaches for a nearby size, or produces a price of its own. It
 * answers one question — how did we price this exact item before, and why did
 * the prices differ — and every number it returns was read off a quotation
 * somebody actually sent.
 */

/** Product names as the quotation writes them, so 'sagrod' and 'Sag Rod' meet. */
/* The browser's DC_NO_FINISH_MATERIALS, on this side of the wire. SS304 and
   SS316 are quoted without a finish, so identity must not ask one of them for
   a PL — and must not refuse a record that was stored carrying one. Kept beside
   the other identity helpers rather than inside the comparison, because both
   sides of that comparison need it. */
const DC_NO_FINISH_MATERIALS = ['SS304', 'SS316'];
function dc_finish_for($material, $finish) {
    $m = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)$material));
    return in_array($m, DC_NO_FINISH_MATERIALS, true) ? '' : (string)$finish;
}
function dc_norm_product($raw) {
    $s = strtoupper(preg_replace('/[-\s]+/', '', (string)$raw));
    $map = ['SAGROD'=>'SAG ROD','STUD'=>'STUD','ANCHORBOLT'=>'ANCHOR BOLT','UBOLT'=>'U BOLT',
            'SQUBOLT'=>'SQ U BOLT','LBOLT'=>'L BOLT','JBOLT'=>'J BOLT'];
    if (isset($map[$s])) return $map[$s];
    return strtoupper(trim((string)$raw));
}

/** Two dimension strings are the same rod when their digits and letters are. */
function dc_dim_key($s) {
    return strtoupper(preg_replace('/[^A-Z0-9]+/i', '', (string)$s));
}

/**
 * ── How close is this record to the item being quoted? ──────────────────────
 *
 * Core identity has already matched EXACTLY by the time this is asked: same
 * product, material, finish, size type and size. What is left is the geometry,
 * and the question a person actually has is "which of these rods is most like
 * the one I am quoting?".
 *
 * The dimensions are read out of the labels the quotation itself writes —
 * L, W, H, S, T, ID, IH, OH, TL, CL, CH — and a thread length written as a
 * pair ("TL 100/50") is read as both of its ends. Only the labels a product
 * actually uses appear in its own dimension string, so a Sag Rod is never
 * compared on a bend it does not have.
 *
 * The score is the plain sum of the differences, in millimetres:
 *
 *     distance = Σ |current(d) − record(d)|   over every label d in either
 *
 * with a label missing from one side counted at its full value on the other.
 * Nothing is weighted, scaled or learned: 100mm of length and 100mm of thread
 * count the same, because no business rule says otherwise and inventing one
 * would make the order unexplainable.
 *
 *     current  M20 x L600
 *     records  L500 → 100 · L1000 → 400 · L1200 → 600
 *
 * A distance of 0 is an exact dimensional match. Where either side has no
 * readable dimension at all the distance is null — unknown, not zero — and
 * those records sort last within their group rather than pretending to be
 * close.
 */
function dc_dim_values($s) {
    $out = [];
    $re = '/\b(TL|ID|IH|OH|CL|CH|L|W|H|S|T|B|R)\s*'
        . '([0-9]+(?:\.[0-9]+)?)(?:\s*\/\s*([0-9]+(?:\.[0-9]+)?))?/i';
    if (!preg_match_all($re, (string)$s, $m, PREG_SET_ORDER)) return $out;
    foreach ($m as $hit) {
        $label = strtoupper($hit[1]);
        // First writing wins: "L 1000 ... L 500" is one rod described once.
        if (!isset($out[$label])) $out[$label] = (float)$hit[2];
        if (isset($hit[3]) && $hit[3] !== '' && !isset($out[$label . '2'])) {
            $out[$label . '2'] = (float)$hit[3];
        }
    }
    return $out;
}

/** The score above. Null when either side says nothing measurable. */
function dc_dim_distance($wantDims, $recordDims) {
    $a = dc_dim_values($wantDims);
    $b = dc_dim_values($recordDims);
    if (!$a || !$b) return null;
    $total = 0.0;
    foreach (array_unique(array_merge(array_keys($a), array_keys($b))) as $k) {
        $total += abs((float)($a[$k] ?? 0) - (float)($b[$k] ?? 0));
    }
    return round($total, 4);
}

/**
 * An item saved before the normalised fields existed, read out of its
 * description and size label. Returns null when it cannot be read safely —
 * a record we cannot identify is skipped, never guessed at.
 */
function dc_legacy_item($item) {
    $desc = (string)($item['desc'] ?? '');
    $size = (string)($item['size'] ?? '');
    if (!$desc || !$size) return null;
    /* The material is everything before the size type, not one token: two of
       the four canonical materials are written "4140 QT" and "4340 QT", and one
       is a whole sentence. A single-token pattern matched none of them, so every
       legacy record for those materials was dropped without a trace — the
       "previous price does not come out" the shop reported. Non-greedy, so the
       FIRST size type word ends the material. */
    if (!preg_match('/^(.+?)\s+(FULLSIZE|UNDERSIZE)\s+(.+)$/', $desc, $dm)) return null;

    $xPos = strpos($size, ' x ');
    $left = $xPos === false ? $size : substr($size, 0, $xPos);
    $dims = $xPos === false ? '' : substr($size, $xPos + 3);
    // "Ø13-M12" is a custom-diameter label; the size inside it is M12.
    $clean = preg_match('/^Ø[\d.]+-(.+)$/u', $left, $om) ? $om[1] : $left;
    if (!$clean) return null;

    return [
        'productType' => dc_norm_product($dm[3]),
        'material'    => dc_material_code($dm[1]),
        'sizeType'    => $dm[2],
        'cleanSize'   => $clean,
        'dimensionPreview' => $dims,
    ];
}

/** accAddon(), in PHP: the same sum the browser makes for an accessory panel. */
function dc_acc_cost($acc) {
    if (!is_array($acc)) return 0.0;
    $n = 0.0;
    foreach (['nut', 'fw'] as $k) {
        $part = $acc[$k] ?? null;
        if (is_array($part) && !empty($part['enabled'])) {
            $n += (float)($part['qty'] ?? 0) * (float)($part['unitPrice'] ?? 0);
        }
    }
    $custom = $acc['custom'] ?? null;
    if (is_array($custom) && !empty($custom['enabled'])) $n += (float)($custom['unitPrice'] ?? 0);
    return round($n, 4);
}

function dc_acc_has($acc) {
    if (!is_array($acc)) return false;
    foreach (['nut', 'fw', 'custom'] as $k) {
        if (is_array($acc[$k] ?? null) && !empty($acc[$k]['enabled'])) return true;
    }
    return false;
}

/** The accessory wording, for showing beside a price. Never added to one. */
function dc_acc_summary($acc) {
    if (!is_array($acc)) return '';
    $bits = [];
    $nut = $acc['nut'] ?? null;
    if (is_array($nut) && !empty($nut['enabled'])) {
        $bits[] = (int)($nut['qty'] ?? 0) . ' Nut' . (!empty($nut['finish']) ? ' ' . $nut['finish'] : '');
    }
    $fw = $acc['fw'] ?? null;
    if (is_array($fw) && !empty($fw['enabled'])) {
        $bits[] = (int)($fw['qty'] ?? 0) . ' FW' . (!empty($fw['finish']) ? ' ' . $fw['finish'] : '');
    }
    $cu = $acc['custom'] ?? null;
    if (is_array($cu) && !empty($cu['enabled'])) $bits[] = trim((string)($cu['text'] ?? 'Custom'));
    return implode(' + ', $bits);
}

/**
 * One saved item against the item being quoted.
 *
 * Returns the history record, or null when the item is not the same item.
 * Core identity — product, material, finish, size type, size — must match
 * EXACTLY: M20 is not M18 and not M22, fullsize is not undersize, PL is not ZP,
 * an L Bolt is not a Sag Rod. Quantity is not part of it, because a historical
 * quantity of 1 says nothing about what the item cost to make.
 *
 * Dimensions do NOT filter. A 500mm rod and a 1500mm rod of the same
 * specification are both worth seeing, precisely because they explain why the
 * two prices differed; they are marked and ranked, not hidden.
 *
 * $want: ['productType','material','sizeType','finish','cleanSize','dimensionPreview','companyId']
 * $meta: ['quotationId','refNo','date','customer','companyId']
 */
function dc_history_record($item, $want, $meta) {
    if (!is_array($item)) return null;

    if (isset($item['productType'], $item['material'], $item['sizeType'], $item['cleanSize'])) {
        $productType = dc_norm_product($item['productType']);
        $material    = (string)$item['material'];
        $sizeType    = (string)$item['sizeType'];
        $cleanSize   = (string)$item['cleanSize'];
        $dimPreview  = (string)($item['dimensionPreview'] ?? '');
        $legacy      = false;
    } else {
        $parsed = dc_legacy_item($item);
        if ($parsed === null) return null;
        $productType = $parsed['productType'];
        $material    = $parsed['material'];
        $sizeType    = $parsed['sizeType'];
        $cleanSize   = $parsed['cleanSize'];
        $dimPreview  = $parsed['dimensionPreview'];
        $legacy      = true;
    }
    /* SS304 and SS316 are quoted without a finish, and identity has to agree
       with the quotation. A stainless item stored before that rule was enforced
       everywhere carries PL or HDG, and comparing it literally made it invisible
       to its own specification: the browser asks for finish '' on a stainless
       row, the record answered 'HDG', and a real previous price for the very
       same item never appeared. Normalised on BOTH sides of the comparison, so
       old records match and nothing else moves. */
    $finish = dc_finish_for((string)($item['material'] ?? ''), (string)($item['finish'] ?? ''));

    if ($productType !== dc_norm_product($want['productType'] ?? ''))       return null;
    if (strcasecmp($material,  (string)($want['material'] ?? '')) !== 0)    return null;
    if (strcasecmp($sizeType,  (string)($want['sizeType'] ?? '')) !== 0)    return null;
    if (strcasecmp($finish, dc_finish_for($material, (string)($want['finish'] ?? ''))) !== 0) return null;
    if (strcasecmp($cleanSize, (string)($want['cleanSize'] ?? '')) !== 0)   return null;

    $form  = is_array($item['formData'] ?? null) ? $item['formData'] : [];
    $acc   = is_array($item['accessories'] ?? null) ? $item['accessories'] : null;
    $mode  = (string)($item['priceMode'] ?? ($form['priceMode'] ?? ''));
    $unit  = (float)($item['finalUnitPrice'] ?? 0);
    $aCost = dc_acc_cost($acc);
    $hasAcc = dc_acc_has($acc);

    /* Accessories are a separate component and a bolt's price is the bolt's.

       An item saved once the two were separated says so, and says both figures:
       finalUnitPrice IS the bolt, accessoryUnitPrice IS the accessories, and
       nothing has to be worked out.

       Older rows carry one number with the accessory charge inside it. Where
       such a row records how it was priced the two can still be told apart:
       Auto Round and No Round added the accessory charge on top of the
       calculated price, Manual Price replaced it and added nothing. Where the
       row does not say, the separation is NOT invented — the record is
       returned as it stands, marked ambiguous, and the screen says so. */
    $separated = (string)($item['pricingModel'] ?? '') === 'bolt-separate';
    if ($separated) {
        $ambiguous = false;
        $bolt      = $unit;                                   // already the bolt's own
        $aCost     = round((float)($item['accessoryUnitPrice'] ?? 0), 4);
        $hasAcc    = $hasAcc || $aCost > 0;
    } else {
        $ambiguous = $hasAcc && $mode === '';
        if      (!$hasAcc)           $bolt = $unit;
        elseif  ($mode === 'manual') $bolt = $unit;
        elseif  ($mode !== '')       $bolt = round($unit - $aCost, 4);
        else                         $bolt = null;
    }

    $num = function ($v) { return ($v === null || $v === '') ? null : (float)$v; };
    $wantDims = (string)($want['dimensionPreview'] ?? '');
    $dist     = dc_dim_distance($wantDims, $dimPreview);
    /* An exact dimensional match is a distance of zero. The string comparison
       is kept as a second way in, for a dimension written in wording the
       labels above cannot read — identical text is identical geometry. */
    $exact = ($dist !== null && $dist == 0.0)
          || ($wantDims !== '' && dc_dim_key($dimPreview) === dc_dim_key($wantDims));

    /* How the price was arrived at, in the words the screen uses. A row that
       never recorded it says so rather than being called Auto Round. */
    $modeLabels = ['auto' => 'Auto Round', 'no_round' => 'No Round', 'manual' => 'Manual'];
    $modeLabel  = $modeLabels[$mode] ?? 'Legacy / Unknown';

    return [
        'quotationId'  => (int)($meta['quotationId'] ?? 0),
        'refNo'        => (string)($meta['refNo'] ?? ''),
        'date'         => (string)($meta['date'] ?? ''),
        'customer'     => (string)($meta['customer'] ?? ''),
        'companyId'    => (int)($meta['companyId'] ?? 0),
        'own'          => (!empty($want['companyId']) && (int)($meta['companyId'] ?? 0) === (int)$want['companyId']),
        'productType'  => $productType,
        'material'     => $material,
        'sizeType'     => $sizeType,
        'finish'       => $finish,
        'cleanSize'    => $cleanSize,
        'dimensionPreview' => $dimPreview,
        'exactDims'    => $exact,
        'dimDistance'  => $dist,
        'qty'          => (int)($item['qty'] ?? 0),
        'unitPrice'    => $unit,
        /* What the customer's line actually came to. For a record saved once
           the two were separated that is the bolt plus its accessories; for an
           older one the saved figure already WAS the line. */
        'lineUnitPrice' => $separated ? round($unit + $aCost, 4) : $unit,
        'boltUnitPrice' => $bolt,
        'accessoryCost' => $aCost,
        'accessorySummary' => $hasAcc ? dc_acc_summary($acc) : '',
        'accessoryAmbiguous' => $ambiguous,
        'priceMode'    => $mode,
        'priceModeLabel' => $modeLabel,
        'costRate'     => $num($form['costRate'] ?? null),
        'addCost'      => $num($form['addCost'] ?? null),
        'markup'       => isset($item['markup']) ? (float)$item['markup'] : $num($form['markup'] ?? null),
        'weight'       => isset($item['weight']) ? (float)$item['weight'] : null,
        'legacy'       => $legacy,
    ];
}

/**
 * Reading order:
 *
 *     THIS CUSTOMER          exact dimensions
 *                            nearest dimensions
 *                            further dimensions
 *     OTHER CUSTOMERS        exact dimensions
 *                            nearest dimensions
 *                            further dimensions
 *
 * The customer comes first and the geometry second, in that order and never
 * the other way round: this customer's 1500mm rod is a fact about what this
 * customer pays, and a stranger's 600mm rod is not, however close it is. Every
 * one of this customer's records is above every other customer's, so a
 * stranger's exact match can never bury the history that belongs to the person
 * being quoted.
 *
 * Within a group the nearest rod is first (see dc_dim_distance), then the most
 * recent, then the newest quotation. A record whose dimensions cannot be read
 * sorts last in its group — unknown is not the same as close.
 *
 * Nothing is merged across customers and nothing is averaged: two customers'
 * prices for one specification are two facts about two customers.
 */
function dc_history_sort(array &$records) {
    usort($records, function ($a, $b) {
        $ra = empty($a['own']) ? 1 : 0;
        $rb = empty($b['own']) ? 1 : 0;
        if ($ra !== $rb) return $ra <=> $rb;
        $da = $a['dimDistance'] === null ? INF : (float)$a['dimDistance'];
        $db = $b['dimDistance'] === null ? INF : (float)$b['dimDistance'];
        if ($da !== $db) return $da <=> $db;
        $d = strcmp((string)$b['date'], (string)$a['date']);
        if ($d !== 0) return $d;
        return $b['quotationId'] <=> $a['quotationId'];
    });
}

/** The text prefilter that keeps the decode loop off rows that cannot match. */
function dc_history_needle($cleanSize) {
    // json_encode escapes a forward slash, so an inch size is stored "1\/2".
    return '"cleanSize":' . json_encode((string)$cleanSize);
}


/**
 * A quotation written before cleanSize existed carries its size inside the
 * printed size label ("M20 x L 1000mm"), so the size TEXT is the only prefilter
 * available for it. It only ever narrows: dc_legacy_item reads the size out of
 * that same label and refuses anything that is not the size being asked for, so
 * a row this excludes could never have matched anyway.
 */
function dc_history_size_text_needle($cleanSize) {
    $enc = json_encode((string)$cleanSize);          // keeps the \/ of an inch size
    return substr($enc, 1, -1);                      // without the quotes
}

/**
 * Which quotations the database is asked for — one definition, used to build
 * the SQL and to test it.
 *
 * The prefilter exists only to keep the decode loop off rows that could never
 * match; dc_history_record is the authority and compares every field. So it
 * narrows on ONE robust thing: the size, in either of the two ways a saved
 * quotation can carry it. It used to demand the MATERIAL as well, and to send a
 * quotation down the legacy branch only when the WHOLE blob contained no
 * "cleanSize" anywhere — which meant a legacy line sitting inside a quotation
 * that also held a modern one could never be reached, and that is exactly what
 * a quotation edited across versions looks like.
 *
 * Returns [sql-fragment, [params...]] for the WHERE clause.
 */
function dc_history_sql_where($want) {
    return [
        '(q.items LIKE ? OR q.items LIKE ?)',
        ['%' . dc_history_needle($want['cleanSize'] ?? '') . '%',
         '%' . dc_history_size_text_needle($want['cleanSize'] ?? '') . '%'],
    ];
}

/** The same predicate in PHP, so what the database is asked for is testable. */
function dc_history_blob_matches($itemsJson, $want) {
    $blob = (string)$itemsJson;
    return strpos($blob, dc_history_needle($want['cleanSize'] ?? '')) !== false
        || strpos($blob, dc_history_size_text_needle($want['cleanSize'] ?? '')) !== false;
}

/**
 * The canonical material code behind a printed label. buildDesc writes the
 * LABEL into a description — "4140 QT", "4340 QT", "Y BAR", and one that is a
 * whole sentence — while every comparison is made on the code. A legacy record
 * is read out of its description, so it has to come back the same way.
 */
function dc_material_code($label) {
    static $codes = [
        '4140 QT'                   => '4140',
        '4340 QT'                   => '4340',
        '4140 QT + HARDEN = G10.9'  => '4140_HARDEN_G10_9',
        'S45C + HARDEN = G8.8'      => 'S45C_HARDEN_G8_8',
        'Y BAR'                     => 'Y_BAR',
        /* A bare "4140" in a LEGACY description is the old internal value for
           4140 QT, and is read as that — the same reading displayItemDesc
           makes. The newer 4140-plain material shares the printed label but
           its items carry the normalised fields, so they never come through
           this reader at all. */
    ];
    $k = strtoupper(trim(preg_replace('/\s+/', ' ', (string)$label)));
    foreach ($codes as $lab => $code) {
        if (strtoupper($lab) === $k) return $code;
    }
    return trim((string)$label);
}
