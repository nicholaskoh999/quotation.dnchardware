<?php

namespace App\Http\Controllers\Read;

use App\Http\Controllers\Controller;
use App\Legacy\DataSource;
use App\Legacy\LegacyNotConfigured;
use App\Legacy\LegacyUnavailable;
use App\Legacy\Quotations\QuotationPresenter;
use App\Legacy\Quotations\QuotationReader;
use App\Legacy\Revisions\QuotationRevisions;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Read-only saved quotations. No Edit / Delete / Save in Wave 1; the detail
 * shows the customer unit price and never the internal pricing recipe.
 */
class QuotationController extends Controller
{
    public function index(Request $request, QuotationReader $reader): Response
    {
        $company = $request->query('company');
        $companyId = is_scalar($company) && ctype_digit((string) $company) ? (int) $company : null;
        $search = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $sort = $request->query('sort') === QuotationReader::SORT_OLDEST ? QuotationReader::SORT_OLDEST : QuotationReader::SORT_NEWEST;

        $source = DataSource::CONNECTED;
        $list = null;
        try {
            $list = $reader->list($companyId, $page, 25, $search, $sort);
        } catch (LegacyNotConfigured|LegacyUnavailable $e) {
            $source = DataSource::fromThrowable($e);
        }

        return Inertia::render('Quotations/Index', [
            'source' => $source,
            'filters' => ['company' => $companyId, 'search' => $search, 'page' => $page, 'sort' => $sort],
            'quotations' => $list,
        ]);
    }

    public function show(int $id, QuotationReader $reader, QuotationRevisions $revisions): Response
    {
        $source = DataSource::CONNECTED;
        $detail = null;
        try {
            $detail = $reader->find($id);
        } catch (LegacyNotConfigured|LegacyUnavailable $e) {
            $source = DataSource::fromThrowable($e);
        }
        if ($source === DataSource::CONNECTED && $detail === null) {
            abort(404);
        }

        return Inertia::render('Quotations/Show', [
            'source' => $source,
            'quotationId' => $id,
            'quotation' => $detail ? QuotationPresenter::forPage($detail) : null,
            'revisions' => $detail ? $revisions->forQuotation($id) : ['state' => $source, 'entries' => []],
        ]);
    }
}
