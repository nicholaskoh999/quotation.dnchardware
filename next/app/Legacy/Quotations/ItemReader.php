<?php

namespace App\Legacy\Quotations;

use App\Legacy\PriceHistory\PricingHistory;
use App\Legacy\Support\Money;

/**
 * One saved legacy item (an element of quotations.items) read "as it was
 * written": the stored object is kept untouched in `raw`, and a normalised
 * view is built beside it.
 *
 * PRICING VINTAGES (index.php dcItemFinalUnit / dcItemBoltUnit /
 * dcMigrateItemPricing, pricing_history.php dc_history_record):
 *
 *   accessory-inclusive  finalUnitPrice IS the customer's price; the bolt
 *                        component and the accessory share are stored beside it.
 *   bolt-separate        finalUnitPrice was the BOLT; the customer's line is
 *                        lineUnitPrice (or bolt + accessoryUnitPrice).
 *   legacy (no model)    one figure, the customer's price. When the item has
 *                        accessories, the bolt is separated ONLY where the row
 *                        recorded how it was priced (Auto Round / No Round
 *                        added the accessory charge on top; Manual replaced
 *                        it). With no recorded mode the bolt is NULL and the
 *                        item is marked ambiguous — never invented.
 *
 * Welding Anchor Set: the set price contains its marked-up accessories (the
 * one product whose accessories are marked up), so no bolt / accessory split
 * is reported for it at all.
 *
 * The line total is the STORED totalAmount. It is only derived for a
 * bolt-separate item saved without one, exactly as dcMigrateItemPricing does.
 */
final class ItemReader
{
    public const MODEL_INCLUSIVE = 'accessory-inclusive';

    public const MODEL_SEPARATE = 'bolt-separate';

    public const MODEL_LEGACY = 'legacy';

    /**
     * @return array<string, mixed> the full view, including `raw` and `internal`
     */
    public static function read(mixed $raw, int $position): array
    {
        if (! is_array($raw) || (array_is_list($raw) && $raw !== [])) {
            return self::unreadable($raw, $position);
        }
        try {
            return self::readObject($raw, $position);
        } catch (\Throwable $e) {
            // A malformed field (an array where a string was expected, …) makes
            // the ITEM unreadable — never the page.
            report($e);

            return self::unreadable($raw, $position);
        }
    }

    /** @return array<string, mixed> */
    private static function unreadable(mixed $raw, int $position): array
    {
        return [
            'position' => $position,
            'state' => 'unreadable',
            'reason' => 'This saved item could not be read.',
            'raw' => $raw,
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private static function readObject(array $item, int $position): array
    {
        $raw = $item;

        $hasStoredIdentity = isset($item['productType'], $item['material'], $item['sizeType'], $item['cleanSize']);
        $parsed = $hasStoredIdentity ? null : PricingHistory::legacyItem($item);
        $fieldsSource = $hasStoredIdentity ? 'stored' : ($parsed !== null ? 'legacy-description' : 'partial');

        $productType = self::str($item['productType'] ?? null) ?? ($parsed['productType'] ?? null);
        $materialCode = self::str($item['material'] ?? null) ?? ($parsed['material'] ?? null);
        $sizeType = self::str($item['sizeType'] ?? null) ?? ($parsed['sizeType'] ?? null);
        $cleanSize = self::str($item['cleanSize'] ?? null) ?? self::str($item['sizeCode'] ?? null) ?? ($parsed['cleanSize'] ?? null);
        $itemType = self::str($item['itemType'] ?? null);
        $isWas = $itemType === 'was';

        $finish = array_key_exists('finish', $item) ? (string) (is_scalar($item['finish']) ? $item['finish'] : '') : null;
        $material = MaterialMap::read($materialCode);
        $qty = Money::number($item['qty'] ?? null);
        $accessories = self::accessories($item['accessories'] ?? null);

        return [
            'position' => $position,
            'state' => 'ok',
            'itemUid' => self::str($item['item_uid'] ?? null),
            'fieldsSource' => $fieldsSource,
            'itemType' => $itemType,
            'productType' => $productType,
            'productKey' => $productType !== null ? PricingHistory::normProduct($productType) : null,
            'description' => self::str($item['desc'] ?? null),
            'displayDescription' => LegacyItemText::displayDesc($item),
            'material' => $material,
            'sizeType' => $sizeType,
            'finish' => $finish,
            'finishLabel' => $finish === null ? null : ($finish !== '' ? $finish : 'N/A'),
            'sizeLabel' => $isWas ? LegacyItemText::wasDisplay($item)['size'] : (self::str($item['size'] ?? null) ?? ''),
            'cleanSize' => $cleanSize,
            'sizeSystem' => self::sizeSystem($cleanSize),
            'dimensionPreview' => self::str($item['dimensionPreview'] ?? null) ?? ($parsed['dimensionPreview'] ?? null),
            'qty' => $qty === null ? null : (int) $qty,
            'unitSuffix' => $isWas ? '/set' : '',
            'pricing' => self::pricing($item, $isWas, $qty),
            'weight' => Money::number($item['weight'] ?? null),
            'accessories' => $accessories,
            'internal' => self::internal($item),
            'raw' => $raw,
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{model: string, customerUnitPrice: float, boltUnitPrice: float|null, accessoryUnitPrice: float|null, ambiguous: bool, total: float|null, totalSource: string, note: string|null}
     */
    public static function pricing(array $item, bool $isWas, ?float $qty): array
    {
        $modelRaw = is_scalar($item['pricingModel'] ?? null) ? (string) $item['pricingModel'] : '';
        $model = $modelRaw === self::MODEL_INCLUSIVE ? self::MODEL_INCLUSIVE
            : ($modelRaw === self::MODEL_SEPARATE ? self::MODEL_SEPARATE : self::MODEL_LEGACY);
        $final = Money::number($item['finalUnitPrice'] ?? null) ?? 0.0;
        $accStored = Money::number($item['accessoryUnitPrice'] ?? null) ?? 0.0;
        $storedTotal = Money::number($item['totalAmount'] ?? null);
        $note = null;
        $ambiguous = false;

        if ($isWas) {
            $customer = Money::round2($final);
            $bolt = null;
            $acc = null;
            $note = 'Welding Anchor Set: the set price already contains its marked-up accessories; no separate bolt price exists.';
        } elseif ($model === self::MODEL_SEPARATE) {
            $line = Money::number($item['lineUnitPrice'] ?? null);
            $customer = ($line !== null && $line > 0) ? Money::round2($line) : Money::round2($final + $accStored);
            $bolt = Money::round2($final);
            $acc = Money::round2($accStored);
        } elseif ($model === self::MODEL_INCLUSIVE) {
            $customer = Money::round2($final);
            $storedBolt = Money::number($item['boltUnitPrice'] ?? null);
            $bolt = $storedBolt !== null ? Money::round2($storedBolt) : Money::round2($final - $accStored);
            $acc = Money::round2($accStored);
        } else {
            $customer = Money::round2($final);
            $form = is_array($item['formData'] ?? null) ? $item['formData'] : [];
            $mode = self::mode($item, $form);
            $accessories = is_array($item['accessories'] ?? null) ? $item['accessories'] : null;
            if (! PricingHistory::accHas($accessories)) {
                $bolt = $customer;
                $acc = 0.0;
            } elseif ($mode === 'manual') {
                $bolt = $customer;
                $acc = null;
                $note = 'Legacy manual price: the typed price replaced the calculated one, so the accessory share was never recorded.';
            } elseif ($mode !== '') {
                $accCost = PricingHistory::accCost($accessories);
                $acc = Money::round2($accCost);
                $bolt = Money::round2($final - $accCost);
            } else {
                $bolt = null;
                $acc = null;
                $ambiguous = true;
                $note = 'Saved before the pricing model was recorded: the accessory charge is inside the price and cannot be separated.';
            }
        }

        if ($model === self::MODEL_SEPARATE && ! $isWas) {
            [$total, $totalSource] = ($storedTotal !== null && $storedTotal > 0)
                ? [Money::round2($storedTotal), 'stored']
                : [Money::round2($customer * (int) ($qty ?? 0)), 'derived-legacy-rule'];
        } else {
            [$total, $totalSource] = $storedTotal !== null ? [Money::round2($storedTotal), 'stored'] : [null, 'missing'];
        }

        return [
            'model' => $model,
            'customerUnitPrice' => $customer,
            'boltUnitPrice' => $bolt,
            'accessoryUnitPrice' => $acc,
            'ambiguous' => $ambiguous,
            'total' => $total,
            'totalSource' => $totalSource,
            'note' => $note,
        ];
    }

    /**
     * @return array{nut: array<string, mixed>|null, fw: array<string, mixed>|null, custom: array<string, mixed>|null, summary: string}|null
     */
    private static function accessories(mixed $acc): ?array
    {
        if (! is_array($acc) || ! PricingHistory::accHas($acc)) {
            return null;
        }
        $part = function (string $key) use ($acc): ?array {
            $p = $acc[$key] ?? null;
            if (! is_array($p)) {
                return null;
            }

            return $key === 'custom'
                ? ['enabled' => ! empty($p['enabled']), 'text' => self::str($p['text'] ?? null), 'unitPrice' => Money::number($p['unitPrice'] ?? null)]
                : ['enabled' => ! empty($p['enabled']), 'qty' => Money::number($p['qty'] ?? null), 'unitPrice' => Money::number($p['unitPrice'] ?? null), 'finish' => self::str($p['finish'] ?? null)];
        };

        return [
            'nut' => $part('nut'),
            'fw' => $part('fw'),
            'custom' => $part('custom'),
            'summary' => PricingHistory::accSummary($acc),
        ];
    }

    /**
     * The internal pricing recipe. NEVER customer-facing, and stripped from
     * every page payload in Wave 1 (pages are not yet behind auth).
     *
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private static function internal(array $item): array
    {
        $form = is_array($item['formData'] ?? null) ? $item['formData'] : [];
        $mode = self::mode($item, $form);

        return [
            'priceMode' => $mode,
            'costRate' => Money::number($form['costRate'] ?? null),
            'addCost' => Money::number($form['addCost'] ?? null),
            'markup' => Money::number($item['markup'] ?? ($form['markup'] ?? null)),
            'manualUnitPrice' => Money::number($item['manualUnitPrice'] ?? ($form['manualUnitPrice'] ?? null)),
        ];
    }

    /**
     * The legacy `(string)($item['priceMode'] ?? ($form['priceMode'] ?? ''))`,
     * minus the warning a non-scalar value would raise.
     *
     * @param  array<string, mixed>  $item
     * @param  array<string, mixed>  $form
     */
    private static function mode(array $item, array $form): string
    {
        $v = $item['priceMode'] ?? ($form['priceMode'] ?? '');

        return is_scalar($v) ? (string) $v : '';
    }

    private static function sizeSystem(?string $cleanSize): string
    {
        if ($cleanSize === null || $cleanSize === '') {
            return 'unknown';
        }
        if (preg_match('/^M\d+(\.\d+)?$/i', $cleanSize)) {
            return 'metric';
        }
        if (str_contains($cleanSize, '/') || str_contains($cleanSize, '"')) {
            return 'imperial';
        }

        return 'unknown';
    }

    private static function str(mixed $v): ?string
    {
        if ($v === null || is_array($v) || is_object($v) || is_bool($v)) {
            return null;
        }
        $s = (string) $v;

        return $s === '' ? null : $s;
    }
}
