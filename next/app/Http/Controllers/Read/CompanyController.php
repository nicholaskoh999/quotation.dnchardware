<?php

namespace App\Http\Controllers\Read;

use App\Http\Controllers\Controller;
use App\Legacy\Companies\CompanyDirectory;
use App\Legacy\DataSource;
use App\Legacy\LegacyNotConfigured;
use App\Legacy\LegacyUnavailable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Read-only customer directory pages (handoff §11). No create / edit / delete
 * in Wave 1. A host without a legacy database, or one whose database cannot
 * be read, gets an honest page state — never an error page.
 */
class CompanyController extends Controller
{
    public function index(Request $request, CompanyDirectory $directory): Response
    {
        $search = trim((string) $request->query('q', ''));
        $source = DataSource::CONNECTED;
        $companies = [];
        try {
            $companies = array_map(CompanyDirectory::forPage(...), $directory->list($search));
        } catch (LegacyNotConfigured|LegacyUnavailable $e) {
            $source = DataSource::fromThrowable($e);
        }

        return Inertia::render('Companies/Index', [
            'source' => $source,
            'search' => $search,
            'companies' => $companies,
        ]);
    }

    public function show(Request $request, int $id, CompanyDirectory $directory): Response
    {
        $source = DataSource::CONNECTED;
        $profile = null;
        try {
            $profile = $directory->profile($id, max(1, (int) $request->query('page', 1)));
        } catch (LegacyNotConfigured|LegacyUnavailable $e) {
            $source = DataSource::fromThrowable($e);
        }
        if ($source === DataSource::CONNECTED && $profile === null) {
            abort(404);
        }

        return Inertia::render('Companies/Show', [
            'source' => $source,
            'companyId' => $id,
            'company' => $profile ? CompanyDirectory::forPage($profile['company']) : null,
            'quotations' => $profile['quotations'] ?? null,
        ]);
    }
}
