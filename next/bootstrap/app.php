<?php

use App\Http\Middleware\DenyUnapprovedProductionHost;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // First, before anything renders: a build that is not approved for
        // production never answers on the production hostname (handoff §2).
        $middleware->prepend(DenyUnapprovedProductionHost::class);
        $middleware->web(append: [HandleInertiaRequests::class]);
        // Shared hosting sits behind LiteSpeed; trust its forwarded proto so
        // generated URLs and secure cookies are right on HTTPS previews.
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '127.0.0.1'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->is('health') || $request->expectsJson(),
        );

        /* Outside local debugging an HTTP error is a calm Inertia page with a
           short message and a log reference — never the exception message, a
           path, SQL or a stack trace (handoff §28 "never expose"). */
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();
            if (app()->hasDebugModeEnabled() && app()->environment('local')) {
                return $response;
            }
            if ($request->expectsJson() || $request->is('health')) {
                return $response;
            }
            if (! in_array($status, [403, 404, 419, 429, 500, 503], true)) {
                return $response;
            }
            if ($status === 419) {
                return back()->with('error', 'Your session expired. Please try again.');
            }
            $reference = $status >= 500 ? substr(hash('sha256', spl_object_id($e).microtime()), 0, 8) : null;
            if ($reference) {
                logger()->error('http.error', ['ref' => $reference, 'status' => $status, 'exception' => $e::class]);
            }

            return Inertia::render('Error', ['status' => $status, 'reference' => $reference])
                ->toResponse($request)
                ->setStatusCode($status);
        });
    })->create();
