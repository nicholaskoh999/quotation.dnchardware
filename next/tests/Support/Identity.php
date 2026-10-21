<?php

/*
 * Test helpers for named identity. The `app_users` table is created HERE, in
 * an in-memory sqlite `legacy` connection — never by a migration file — with
 * the columns of migrations/2026-08-26-create-app-users.sql.
 */

use App\Auth\AppUser;
use App\Services\Identity\Actor;
use App\Services\Identity\ActorSource;
use Illuminate\Support\Facades\DB;

function useThrowawayAppUsers(): void
{
    config([
        'database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
        'quotation.auth.failure_delay_ms' => 0,
    ]);
    DB::purge('legacy');
    DB::connection('legacy')->statement('CREATE TABLE app_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(64) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        enabled TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )');
}

/** Inserts a row the way an operator would (username stored lowercase). Cost 4 keeps tests fast. */
function seedAppUser(string $username, string $displayName, string $password, int $enabled = 1): int
{
    return (int) DB::connection('legacy')->table('app_users')->insertGetId([
        'username' => $username,
        'display_name' => $displayName,
        'password_hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 4]),
        'enabled' => $enabled,
    ]);
}

/** A snapshot of app_users, to prove sign-in never writes to it. */
function appUsersSnapshot(): array
{
    return DB::connection('legacy')->table('app_users')->orderBy('id')->get()->map(fn ($r) => (array) $r)->all();
}

function namedUser(int $id = 7, string $username = 'nicholas', string $display = 'Nicholas Koh'): AppUser
{
    return new AppUser(new Actor($id, $username, $display, ActorSource::AppUsers));
}
