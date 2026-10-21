<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Handoff §2 HARD LOCK, enforced in code: this application refuses to serve
 * the production legacy hostname unless the environment states the owner's
 * approval (QUOTATION_PRODUCTION_APPROVED=true, set only after an instruction
 * containing "PRODUCTION APPROVED BY OWNER"). A copy deployed to the wrong
 * docroot by mistake answers 503 instead of replacing the live application.
 */
class DenyUnapprovedProductionHost
{
    public function handle(Request $request, Closure $next): Response
    {
        $prod = strtolower((string) config('quotation.production_host'));
        $hosts = array_filter([strtolower($request->getHost()), strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST))]);

        if ($prod !== '' && in_array($prod, $hosts, true) && ! config('quotation.production_approved')) {
            return response('This build is not approved for production.', 503, [
                'Content-Type' => 'text/plain; charset=utf-8',
                'Cache-Control' => 'no-store',
                'Retry-After' => '3600',
            ]);
        }

        return $next($request);
    }
}
