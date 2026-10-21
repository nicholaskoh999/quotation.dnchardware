<?php

namespace App\Http\Controllers;

use App\Support\Release;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * GET /health — the minimal, public, preview-safe health answer (handoff §28,
 * employee-safe subset). It says whether the app responds, which release it
 * is, and whether the database is reachable — yes / no / not configured.
 *
 * It NEVER returns a driver message, host, user, schema, path, PHP version or
 * stack trace: a failure is a boolean and nothing else. The detailed admin
 * health page belongs to a later wave behind authentication.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $release = Release::info();
        $db = $this->database();

        return response()->json([
            'status' => $db === false ? 'degraded' : 'ok',
            'app' => 'up',
            'release' => $release['version'],
            'sha' => $release['sha'],
            'builtAt' => $release['builtAt'],
            'database' => $db === null ? 'not_configured' : ($db ? 'reachable' : 'unreachable'),
            'time' => now()->toIso8601String(),
        ], 200, ['Cache-Control' => 'no-store']);
    }

    /** true = reachable, false = configured but failed, null = not configured. */
    private function database(): ?bool
    {
        $name = config('database.connections.legacy.database');
        if (! config('quotation.health_checks_database') || ! $name) {
            return null;
        }
        try {
            DB::connection('legacy')->select('SELECT 1');

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        } finally {
            try {
                DB::disconnect('legacy');
            } catch (Throwable) {
            }
        }
    }
}
