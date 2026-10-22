<?php

namespace App\Legacy\Quotations;

/**
 * What a Wave 1 read PAGE may carry. An Inertia page embeds its props in the
 * HTML, so the page payload drops:
 *
 *   - `raw` per item and `rawItems` per quotation: the stored JSON carries
 *     formData with the internal pricing recipe;
 *   - `internal` per item: cost rate, additional cost, price mode
 *     (handoff §26: customer-facing views never expose them).
 *
 * Owner Smoke Loop #2 (§10): the signed-in INTERNAL detail shows the item's
 * markup as a badge, so two derived facts are kept on `pricing`:
 * `markupPercent` (only when > 0 and the price was calculated) and `manual`
 * (the typed price replaced the calculated one). Cost rate and additional cost
 * never reach a page. Customer output (print / WhatsApp / copy) is unaffected.
 *
 * The full read DTO (with raw and internal) stays available to server code.
 */
final class QuotationPresenter
{
    /**
     * @param  array<string, mixed>  $detail  QuotationReader::find()
     * @return array<string, mixed>
     */
    public static function forPage(array $detail): array
    {
        unset($detail['rawItems']);
        $detail['items'] = array_map(self::item(...), $detail['items'] ?? []);

        return $detail;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    public static function item(array $item): array
    {
        if (($item['state'] ?? null) === 'ok' && isset($item['pricing']) && is_array($item['pricing'])) {
            $internal = is_array($item['internal'] ?? null) ? $item['internal'] : [];
            $manual = ($internal['priceMode'] ?? '') === 'manual';
            $markup = $internal['markup'] ?? null;
            $item['pricing']['manual'] = $manual;
            $item['pricing']['markupPercent'] = (! $manual && is_float($markup) && $markup > 0) ? $markup : null;
        }
        unset($item['raw'], $item['internal']);

        return $item;
    }
}
