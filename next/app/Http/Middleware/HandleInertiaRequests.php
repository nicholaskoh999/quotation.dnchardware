<?php

namespace App\Http\Middleware;

use App\Services\Identity\CurrentActor;
use App\Support\Release;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /** @return array<string, mixed> */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'appName' => config('app.name'),
            'release' => fn () => Release::info(),
            /* The signed-in person (CurrentActor), or null for a guest:
               {id, username, displayName, source}. Never a role, hash or
               canonical id. */
            'auth' => [
                'user' => fn () => app(CurrentActor::class)->get()?->toSharedArray(),
            ],
            /* "Back to DNC Workspace" — a plain https origin, else null. */
            'workspace' => [
                'url' => fn () => self::workspaceUrl(),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }

    private static function workspaceUrl(): ?string
    {
        $url = rtrim((string) config('quotation.workspace.url', ''), '/');

        return preg_match('#^https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?$#', $url) === 1 ? $url : null;
    }
}
