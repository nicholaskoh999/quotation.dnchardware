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
 * An item saved before the normalised fields existed, read out of its
 * description and size label. Returns null when it cannot be read safely —
 * a record we cannot identify is skipped, never guessed at.
 */
function dc_legacy_item($item) {
    $desc = (string)($item['desc'] ?? '');
    $size = (string)($item['size'] ?? '');
    if (!$desc || !$size) return null;
    if (!preg_match('/^(\S+)\s+(FULLSIZE|UNDERSIZE)\s+(.+)$/', $desc, $dm)) return null;

    $xPos = strpos($size, ' x ');
    $left = $xPos === false ? $size : substr($size, 0, $xPos);
    $dims = $xPos === false ? '' : substr($size, $xPos + 3);
    // "Ø13-M12" is a custom-diameter label; the size inside it is M12.
    $clean = preg_match('/^Ø[\d.]+-(.+)$/u', $left, $om) ? $om[1] : $left;
    if (!$clean) return null;

    return [
        'productType' => dc_norm_product($dm[3]),
        'material'    => $dm[1],
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
    $finish = (string)($item['finish'] ?? '');

    if ($productType !== dc_norm_product($want['productType'] ?? ''))       return null;
    if (strcasecmp($material,  (string)($want['material'] ?? '')) !== 0)    return null;
    if (strcasecmp($sizeType,  (string)($want['sizeType'] ?? '')) !== 0)    return null;
    if (strcasecmp($finish,    (string)($want['finish'] ?? '')) !== 0)      return null;
    if (strcasecmp($cleanSize, (string)($want['cleanSize'] ?? '')) !== 0)   return null;

    $form  = is_array($item['formData'] ?? null) ? $item['formData'] : [];
    $acc   = is_array($item['accessories'] ?? null) ? $item['accessories'] : null;
    $mode  = (string)($item['priceMode'] ?? ($form['priceMode'] ?? ''));
    $unit  = (float)($item['finalUnitPrice'] ?? 0);
    $aCost = dc_acc_cost($acc);
    $hasAcc = dc_acc_has($acc);

    /* Accessories are a separate component and a bolt's price is the bolt's.
       Where the saved row says how it was priced the two can be separated:
       Auto Round and No Round added the accessory charge on top of the
       calculated price, Manual Price replaced it and added nothing. Where the
       row does not say — an item saved before the price mode was stored — the
       separation is NOT invented. The record is returned as it stands and
       marked ambiguous, and the screen says so. */
    $ambiguous = $hasAcc && $mode === '';
    if      (!$hasAcc)           $bolt = $unit;
    elseif  ($mode === 'manual') $bolt = $unit;
    elseif  ($mode !== '')       $bolt = round($unit - $aCost, 4);
    else                         $bolt = null;

    $num = function ($v) { return ($v === null || $v === '') ? null : (float)$v; };
    $wantDims = (string)($want['dimensionPreview'] ?? '');

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
        'exactDims'    => ($wantDims !== '' && dc_dim_key($dimPreview) === dc_dim_key($wantDims)),
        'qty'          => (int)($item['qty'] ?? 0),
        'unitPrice'    => $unit,
        'boltUnitPrice' => $bolt,
        'accessoryCost' => $aCost,
        'accessorySummary' => $hasAcc ? dc_acc_summary($acc) : '',
        'accessoryAmbiguous' => $ambiguous,
        'priceMode'    => $mode,
        'costRate'     => $num($form['costRate'] ?? null),
        'addCost'      => $num($form['addCost'] ?? null),
        'markup'       => isset($item['markup']) ? (float)$item['markup'] : $num($form['markup'] ?? null),
        'weight'       => isset($item['weight']) ? (float)$item['weight'] : null,
        'legacy'       => $legacy,
    ];
}

/**
 * Reading order. This customer's own records first, because their own price is
 * the answer and anybody else's is a reference; then the rod that matches
 * dimension for dimension, because it is the closest comparison; then by date.
 *
 * Nothing is merged across customers and nothing is averaged: two customers'
 * prices for one specification are two facts about two customers.
 */
function dc_history_sort(array &$records) {
    usort($records, function ($a, $b) {
        $rank = function ($r) { return ($r['own'] ? 0 : 2) + ($r['exactDims'] ? 0 : 1); };
        $ra = $rank($a); $rb = $rank($b);
        if ($ra !== $rb) return $ra <=> $rb;
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
