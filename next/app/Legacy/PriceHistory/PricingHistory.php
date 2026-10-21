<?php

namespace App\Legacy\PriceHistory;

/**
 * A faithful, namespaced port of the legacy `pricing_history.php` (repository
 * root, the oracle). Every method below is the legacy function of the same
 * name with the `dc_` prefix dropped and camel-cased; the bodies are copied
 * and must stay behaviour-identical:
 *
 *   - identity: product · material · size type · exact clean size; a finish
 *     mismatch is kept but flagged (finishMatch = false); qty is not identity
 *   - vintage split: accessory-inclusive / bolt-separate / legacy, where a
 *     legacy row with accessories and no recorded price mode is AMBIGUOUS and
 *     its bolt price is null (never invented)
 *   - ranking: same customer → exact finish → nearest dimensions → newest
 *     date → highest quotation id
 *   - the LIKE prefilter with the json-escaped slash ("1\/2") trap
 *
 * Parity is pinned twice: against fixtures/golden/history.json, and
 * differentially against the shipped pricing_history.php
 * (tests/Feature/Legacy/PricingHistoryParityTest.php).
 *
 * Pure: no database, session or HTTP. PriceHistoryRepository reads rows and
 * hands each stored item here.
 */
final class PricingHistory
{
    /** SS304 / SS316 are quoted without a finish (legacy DC_NO_FINISH_MATERIALS). */
    public const NO_FINISH_MATERIALS = ['SS304', 'SS316'];

    public static function finishFor($material, $finish): string
    {
        $m = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $material));

        return in_array($m, self::NO_FINISH_MATERIALS, true) ? '' : (string) $finish;
    }

    public static function normProduct($raw): string
    {
        $s = strtoupper(preg_replace('/[-\s]+/', '', (string) $raw));
        $map = ['SAGROD' => 'SAG ROD', 'STUD' => 'STUD', 'ANCHORBOLT' => 'ANCHOR BOLT', 'UBOLT' => 'U BOLT',
            'SQUBOLT' => 'SQ U BOLT', 'LBOLT' => 'L BOLT', 'JBOLT' => 'J BOLT'];
        if (isset($map[$s])) {
            return $map[$s];
        }

        return strtoupper(trim((string) $raw));
    }

    public static function dimKey($s): string
    {
        return strtoupper(preg_replace('/[^A-Z0-9]+/i', '', (string) $s));
    }

    /** @return array<string, float> */
    public static function dimValues($s): array
    {
        $out = [];
        $re = '/\b(TL|ID|IH|OH|CL|CH|L|W|H|S|T|B|R)\s*'
            .'([0-9]+(?:\.[0-9]+)?)(?:\s*\/\s*([0-9]+(?:\.[0-9]+)?))?/i';
        if (! preg_match_all($re, (string) $s, $m, PREG_SET_ORDER)) {
            return $out;
        }
        foreach ($m as $hit) {
            $label = strtoupper($hit[1]);
            if (! isset($out[$label])) {
                $out[$label] = (float) $hit[2];
            }
            if (isset($hit[3]) && $hit[3] !== '' && ! isset($out[$label.'2'])) {
                $out[$label.'2'] = (float) $hit[3];
            }
        }

        return $out;
    }

    public static function dimDistance($wantDims, $recordDims): ?float
    {
        $a = self::dimValues($wantDims);
        $b = self::dimValues($recordDims);
        if (! $a || ! $b) {
            return null;
        }
        $total = 0.0;
        foreach (array_unique(array_merge(array_keys($a), array_keys($b))) as $k) {
            $total += abs((float) ($a[$k] ?? 0) - (float) ($b[$k] ?? 0));
        }

        return round($total, 4);
    }

    /**
     * An item saved before the normalised fields existed, read out of its
     * description and size label. Null when it cannot be read safely.
     *
     * @return array{productType: string, material: string, sizeType: string, cleanSize: string, dimensionPreview: string}|null
     */
    public static function legacyItem($item): ?array
    {
        $desc = (string) ($item['desc'] ?? '');
        $size = (string) ($item['size'] ?? '');
        if (! $desc || ! $size) {
            return null;
        }
        if (! preg_match('/^(.+?)\s+(FULLSIZE|UNDERSIZE)\s+(.+)$/', $desc, $dm)) {
            return null;
        }

        $xPos = strpos($size, ' x ');
        $left = $xPos === false ? $size : substr($size, 0, $xPos);
        $dims = $xPos === false ? '' : substr($size, $xPos + 3);
        $clean = preg_match('/^Ø[\d.]+-(.+)$/u', $left, $om) ? $om[1] : $left;
        if (! $clean) {
            return null;
        }

        return [
            'productType' => self::normProduct($dm[3]),
            'material' => self::materialCode($dm[1]),
            'sizeType' => $dm[2],
            'cleanSize' => $clean,
            'dimensionPreview' => $dims,
        ];
    }

    /** accAddon(), in PHP. */
    public static function accCost($acc): float
    {
        if (! is_array($acc)) {
            return 0.0;
        }
        $n = 0.0;
        foreach (['nut', 'fw'] as $k) {
            $part = $acc[$k] ?? null;
            if (is_array($part) && ! empty($part['enabled'])) {
                $n += (float) ($part['qty'] ?? 0) * (float) ($part['unitPrice'] ?? 0);
            }
        }
        $custom = $acc['custom'] ?? null;
        if (is_array($custom) && ! empty($custom['enabled'])) {
            $n += (float) ($custom['unitPrice'] ?? 0);
        }

        return round($n, 4);
    }

    public static function accHas($acc): bool
    {
        if (! is_array($acc)) {
            return false;
        }
        foreach (['nut', 'fw', 'custom'] as $k) {
            if (is_array($acc[$k] ?? null) && ! empty($acc[$k]['enabled'])) {
                return true;
            }
        }

        return false;
    }

    /** The accessory wording, for showing beside a price. Never added to one. */
    public static function accSummary($acc): string
    {
        if (! is_array($acc)) {
            return '';
        }
        $bits = [];
        $nut = $acc['nut'] ?? null;
        if (is_array($nut) && ! empty($nut['enabled'])) {
            $bits[] = (int) ($nut['qty'] ?? 0).' Nut'.(! empty($nut['finish']) ? ' '.$nut['finish'] : '');
        }
        $fw = $acc['fw'] ?? null;
        if (is_array($fw) && ! empty($fw['enabled'])) {
            $bits[] = (int) ($fw['qty'] ?? 0).' FW'.(! empty($fw['finish']) ? ' '.$fw['finish'] : '');
        }
        $cu = $acc['custom'] ?? null;
        if (is_array($cu) && ! empty($cu['enabled'])) {
            $bits[] = trim((string) ($cu['text'] ?? 'Custom'));
        }

        return implode(' + ', $bits);
    }

    /**
     * One saved item against the item being quoted (legacy dc_history_record).
     *
     * @param  array<string, mixed>  $want  productType, material, sizeType, finish, cleanSize, dimensionPreview, companyId
     * @param  array<string, mixed>  $meta  quotationId, refNo, date, customer, companyId
     * @return array<string, mixed>|null
     */
    public static function historyRecord($item, $want, $meta): ?array
    {
        if (! is_array($item)) {
            return null;
        }

        if (isset($item['productType'], $item['material'], $item['sizeType'], $item['cleanSize'])) {
            $productType = self::normProduct($item['productType']);
            $material = (string) $item['material'];
            $sizeType = (string) $item['sizeType'];
            $cleanSize = (string) $item['cleanSize'];
            $dimPreview = (string) ($item['dimensionPreview'] ?? '');
            $legacy = false;
        } else {
            $parsed = self::legacyItem($item);
            if ($parsed === null) {
                return null;
            }
            $productType = $parsed['productType'];
            $material = $parsed['material'];
            $sizeType = $parsed['sizeType'];
            $cleanSize = $parsed['cleanSize'];
            $dimPreview = $parsed['dimensionPreview'];
            $legacy = true;
        }
        $finish = self::finishFor((string) ($item['material'] ?? ''), (string) ($item['finish'] ?? ''));

        if ($productType !== self::normProduct($want['productType'] ?? '')) {
            return null;
        }
        if (strcasecmp($material, (string) ($want['material'] ?? '')) !== 0) {
            return null;
        }
        if (strcasecmp($sizeType, (string) ($want['sizeType'] ?? '')) !== 0) {
            return null;
        }
        $wantFinish = self::finishFor($material, (string) ($want['finish'] ?? ''));
        $finishMatch = strcasecmp($finish, $wantFinish) === 0;
        if (strcasecmp($cleanSize, (string) ($want['cleanSize'] ?? '')) !== 0) {
            return null;
        }

        $form = is_array($item['formData'] ?? null) ? $item['formData'] : [];
        $acc = is_array($item['accessories'] ?? null) ? $item['accessories'] : null;
        $mode = (string) ($item['priceMode'] ?? ($form['priceMode'] ?? ''));
        $unit = (float) ($item['finalUnitPrice'] ?? 0);
        $aCost = self::accCost($acc);
        $hasAcc = self::accHas($acc);

        $model = (string) ($item['pricingModel'] ?? '');
        if ($model === 'accessory-inclusive') {
            $ambiguous = false;
            $aCost = round((float) ($item['accessoryUnitPrice'] ?? 0), 4);
            $bolt = isset($item['boltUnitPrice']) && $item['boltUnitPrice'] !== ''
                       ? round((float) $item['boltUnitPrice'], 4)
                       : round($unit - $aCost, 4);
            $line = $unit;
            $hasAcc = $hasAcc || $aCost > 0;
        } elseif ($model === 'bolt-separate') {
            $ambiguous = false;
            $bolt = $unit;
            $aCost = round((float) ($item['accessoryUnitPrice'] ?? 0), 4);
            $line = round($unit + $aCost, 4);
            $hasAcc = $hasAcc || $aCost > 0;
        } else {
            $ambiguous = $hasAcc && $mode === '';
            if (! $hasAcc) {
                $bolt = $unit;
            } elseif ($mode === 'manual') {
                $bolt = $unit;
            } elseif ($mode !== '') {
                $bolt = round($unit - $aCost, 4);
            } else {
                $bolt = null;
            }
            $line = $unit;
        }

        $num = function ($v) {
            return ($v === null || $v === '') ? null : (float) $v;
        };
        $wantDims = (string) ($want['dimensionPreview'] ?? '');
        $dist = self::dimDistance($wantDims, $dimPreview);
        $exact = ($dist !== null && $dist == 0.0)
              || ($wantDims !== '' && self::dimKey($dimPreview) === self::dimKey($wantDims));

        $modeLabels = ['auto' => 'Auto Round', 'no_round' => 'No Round', 'manual' => 'Manual'];
        $modeLabel = $modeLabels[$mode] ?? 'Legacy / Unknown';

        return [
            'quotationId' => (int) ($meta['quotationId'] ?? 0),
            'refNo' => (string) ($meta['refNo'] ?? ''),
            'date' => (string) ($meta['date'] ?? ''),
            'customer' => (string) ($meta['customer'] ?? ''),
            'companyId' => (int) ($meta['companyId'] ?? 0),
            'own' => (! empty($want['companyId']) && (int) ($meta['companyId'] ?? 0) === (int) $want['companyId']),
            'productType' => $productType,
            'material' => $material,
            'sizeType' => $sizeType,
            'finish' => $finish,
            'finishMatch' => $finishMatch,
            'cleanSize' => $cleanSize,
            'dimensionPreview' => $dimPreview,
            'exactDims' => $exact,
            'dimDistance' => $dist,
            'qty' => (int) ($item['qty'] ?? 0),
            'unitPrice' => $unit,
            'lineUnitPrice' => $line,
            'boltUnitPrice' => $bolt,
            'accessoryCost' => $aCost,
            'accessorySummary' => $hasAcc ? self::accSummary($acc) : '',
            'accessoryAmbiguous' => $ambiguous,
            'priceMode' => $mode,
            'priceModeLabel' => $modeLabel,
            'costRate' => $num($form['costRate'] ?? null),
            'addCost' => $num($form['addCost'] ?? null),
            'markup' => isset($item['markup']) ? (float) $item['markup'] : $num($form['markup'] ?? null),
            'weight' => isset($item['weight']) ? (float) $item['weight'] : null,
            'legacy' => $legacy,
        ];
    }

    /**
     * Reading order (legacy dc_history_sort): this customer first, then the
     * exact finish, then nearest dimensions, newest date, highest id.
     *
     * @param  list<array<string, mixed>>  $records
     */
    public static function sort(array &$records): void
    {
        usort($records, function ($a, $b) {
            $ra = empty($a['own']) ? 1 : 0;
            $rb = empty($b['own']) ? 1 : 0;
            if ($ra !== $rb) {
                return $ra <=> $rb;
            }
            $fa = (isset($a['finishMatch']) && $a['finishMatch'] === false) ? 1 : 0;
            $fb = (isset($b['finishMatch']) && $b['finishMatch'] === false) ? 1 : 0;
            if ($fa !== $fb) {
                return $fa <=> $fb;
            }
            $da = $a['dimDistance'] === null ? INF : (float) $a['dimDistance'];
            $db = $b['dimDistance'] === null ? INF : (float) $b['dimDistance'];
            if ($da !== $db) {
                return $da <=> $db;
            }
            $d = strcmp((string) $b['date'], (string) $a['date']);
            if ($d !== 0) {
                return $d;
            }

            return $b['quotationId'] <=> $a['quotationId'];
        });
    }

    public static function needle($cleanSize): string
    {
        return '"cleanSize":'.json_encode((string) $cleanSize);
    }

    public static function sizeTextNeedle($cleanSize): string
    {
        $enc = json_encode((string) $cleanSize);

        return substr($enc, 1, -1);
    }

    /**
     * The WHERE fragment and LIKE patterns (legacy dc_history_sql_where).
     *
     * @return array{0: string, 1: array{0: string, 1: string}}
     */
    public static function sqlWhere($want): array
    {
        return [
            '(q.items LIKE ? OR q.items LIKE ?)',
            ['%'.self::likeEscape(self::needle($want['cleanSize'] ?? '')).'%',
                '%'.self::likeEscape(self::sizeTextNeedle($want['cleanSize'] ?? '')).'%'],
        ];
    }

    /** Backslash first, then the wildcards — a size is text, never a pattern. */
    public static function likeEscape($s): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $s);
    }

    /** MySQL's LIKE, modelled (backslash is the escape character). */
    public static function likeMatches($subject, $pattern): bool
    {
        $re = '';
        $len = strlen($pattern);
        for ($i = 0; $i < $len; $i++) {
            $ch = $pattern[$i];
            if ($ch === '\\' && $i + 1 < $len) {
                $re .= preg_quote($pattern[++$i], '/');
            } elseif ($ch === '%') {
                $re .= '.*';
            } elseif ($ch === '_') {
                $re .= '.';
            } else {
                $re .= preg_quote($ch, '/');
            }
        }

        return (bool) preg_match('/^'.$re.'$/s', (string) $subject);
    }

    public static function blobMatches($itemsJson, $want): bool
    {
        [, $params] = self::sqlWhere($want);
        foreach ($params as $pattern) {
            if (self::likeMatches((string) $itemsJson, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /** The canonical material code behind a printed label (legacy dc_material_code). */
    public static function materialCode($label): string
    {
        static $codes = [
            '4140 QT' => '4140',
            '4340 QT' => '4340',
            '4140 QT + HARDEN = G10.9' => '4140_HARDEN_G10_9',
            'S45C + HARDEN = G8.8' => 'S45C_HARDEN_G8_8',
            'Y BAR' => 'Y_BAR',
        ];
        $k = strtoupper(trim(preg_replace('/\s+/', ' ', (string) $label)));
        foreach ($codes as $lab => $code) {
            if (strtoupper($lab) === $k) {
                return $code;
            }
        }

        return trim((string) $label);
    }
}
