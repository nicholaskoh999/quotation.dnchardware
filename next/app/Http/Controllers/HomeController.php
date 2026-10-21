<?php

namespace App\Http\Controllers;

use App\Legacy\LegacyNotConfigured;
use App\Legacy\LegacyUnavailable;
use App\Legacy\Quotations\QuotationReader;
use Inertia\Inertia;
use Inertia\Response;

/**
 * QUO Home (W1 integration glue): Session A's Home / Overview, with "Recent
 * Quotations" read through Session D's read-only QuotationReader. When the
 * legacy data source is not configured or not reachable the prop is OMITTED,
 * so the page shows its honest "not connected" state — never fake rows.
 */
class HomeController extends Controller
{
    public function __invoke(QuotationReader $reader): Response
    {
        $props = [];
        try {
            $list = $reader->list(null, 1, 5);
            $props['recentQuotations'] = array_map(fn (array $q) => [
                'id' => $q['id'],
                'refNo' => $q['refNo'],
                'customer' => $q['customerDisplay'] ?? '—',
                'date' => $q['quoteDate'] ?? '',
                'total' => $q['totalAmount'] !== null ? 'RM '.$q['totalAmount'] : null,
            ], $list['rows']);
        } catch (LegacyNotConfigured|LegacyUnavailable) {
            // honest empty state on the page
        }

        return Inertia::render('Home', $props);
    }
}
