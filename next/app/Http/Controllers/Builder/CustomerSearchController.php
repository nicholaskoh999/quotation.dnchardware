<?php

namespace App\Http\Controllers\Builder;

use App\Http\Controllers\Controller;
use App\Legacy\Companies\CompanyDirectory;
use App\Legacy\DataSource;
use App\Legacy\LegacyNotConfigured;
use App\Legacy\LegacyUnavailable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Quotation Builder customer search (Wave 2 · Session E). READ ONLY: the
 * existing company directory reader, a few best matches, the hidden legacy
 * short code never returned (it may still match as an alias). An empty query
 * returns nothing — the Builder never pulls the whole directory.
 *
 * Smart Search / Price Lookup is Session F; this is only the customer picker.
 */
class CustomerSearchController extends Controller
{
    public const LIMIT = 8;

    public function __invoke(Request $request, CompanyDirectory $directory): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '' || mb_strlen($q) > 80) {
            return response()->json(['source' => DataSource::CONNECTED, 'companies' => []]);
        }
        try {
            $rows = array_slice($directory->list($q), 0, self::LIMIT);
        } catch (LegacyNotConfigured|LegacyUnavailable $e) {
            return response()->json(['source' => DataSource::fromThrowable($e), 'companies' => []]);
        }

        return response()->json([
            'source' => DataSource::CONNECTED,
            'companies' => array_map(fn (array $c) => [
                'id' => $c['id'],
                'name' => $c['name'],
                'phone' => $c['phone'],
                'address' => $c['address'],
                'quotationCount' => $c['quotationCount'],
                'lastQuotedDate' => $c['lastQuotedDate'],
                'matchedBy' => $c['matchedBy'],
            ], $rows),
        ]);
    }
}
