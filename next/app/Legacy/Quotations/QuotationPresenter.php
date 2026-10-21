<?php

namespace App\Legacy\Quotations;

/**
 * What a Wave 1 read PAGE may carry. The pages are not behind authentication
 * yet (Session C adds it), and an Inertia page embeds its props in the HTML,
 * so the page payload drops:
 *
 *   - `raw` per item and `rawItems` per quotation: the stored JSON carries
 *     formData with the internal pricing recipe;
 *   - `internal` per item: cost rate, additional cost, markup, price mode
 *     (handoff §26: customer-facing views never expose them).
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
        unset($item['raw'], $item['internal']);

        return $item;
    }
}
