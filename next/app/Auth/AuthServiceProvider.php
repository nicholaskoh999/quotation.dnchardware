<?php

namespace App\Auth;

use App\Handoff\DncUserDirectory;
use App\Handoff\HandoffLog;
use App\Handoff\HandoffStore;
use App\Services\Identity\CurrentActor;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

/**
 * Wires named-user authentication (app/Auth/NOTES.md):
 *  - provider driver `legacy-app-users` (read-only app_users),
 *  - guard driver `quo-identity` (session identity facts, no remember-me),
 *  - the read-only `dnc_users` connection for the DNC Workspace handoff,
 *    registered from config/quotation.php only when not already defined.
 */
final class AuthServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(HandoffLog::class);
        $this->app->singleton(HandoffStore::class);
        $this->app->singleton(DncUserDirectory::class, fn (Application $app) => new DncUserDirectory(
            $app['db'],
            $app->make(HandoffLog::class),
            (string) config('quotation.handoff.users_connection', 'dnc_users'),
        ));
        $this->app->scoped(CurrentActor::class);
    }

    public function boot(): void
    {
        $name = (string) config('quotation.handoff.users_connection', 'dnc_users');
        if (! is_array(config('database.connections.'.$name))) {
            $connection = (array) config('quotation.handoff.users_db', []);
            // Read-only at the session level, whatever the grant (legacy: SET SESSION TRANSACTION READ ONLY).
            if (extension_loaded('pdo_mysql')) {
                $init = defined('Pdo\Mysql::ATTR_INIT_COMMAND') ? constant('Pdo\Mysql::ATTR_INIT_COMMAND') : \PDO::MYSQL_ATTR_INIT_COMMAND;
                $connection['options'] = ($connection['options'] ?? []) + [$init => 'SET SESSION TRANSACTION READ ONLY'];
            }
            config(['database.connections.'.$name => $connection]);
        }

        Auth::provider('legacy-app-users', fn (Application $app, array $config) => new LegacyAppUserProvider(
            $app['db'],
            (string) config('quotation.auth.connection', 'legacy'),
            array_values(array_map(Username::normalize(...), (array) config('quotation.auth.refused_usernames', ['admin']))),
            (int) config('quotation.auth.failure_delay_ms', 400),
        ));

        Auth::extend('quo-identity', function (Application $app, string $name, array $config) {
            $provider = Auth::createUserProvider($config['provider'] ?? null);
            if (! $provider instanceof LegacyAppUserProvider) {
                throw new \LogicException('The quo-identity guard needs the legacy-app-users provider.');
            }

            return new IdentityGuard(
                $provider,
                $app['session.store'],
                $app->make(DncUserDirectory::class),
                $app->make(HandoffLog::class),
                (int) config('quotation.auth.absolute_lifetime_seconds', 604800),
            );
        });
    }
}
