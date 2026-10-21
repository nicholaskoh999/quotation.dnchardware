<?php

use App\Handoff\DncUserDirectory;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/*
 * The `dnc_users` connection registered at boot is READ-ONLY at the MySQL
 * session level (SET SESSION TRANSACTION READ ONLY), whatever the grant.
 * Proven against a THROWAWAY schema on the local MySQL (127.0.0.1, root);
 * skipped where no local MySQL is available.
 */

const RO_SCHEMA = 'quo_next_test_c_dnc_users';

function localMysql(): ?PDO
{
    try {
        return new PDO('mysql:host=127.0.0.1;port=3306', 'root', '', [PDO::ATTR_TIMEOUT => 2, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    } catch (Throwable) {
        return null;
    }
}

beforeEach(function () {
    $this->pdo = localMysql();
    if ($this->pdo === null) {
        $this->markTestSkipped('No local MySQL at 127.0.0.1:3306.');
    }
    $this->pdo->exec('DROP DATABASE IF EXISTS '.RO_SCHEMA);
    $this->pdo->exec('CREATE DATABASE '.RO_SCHEMA);
    $this->pdo->exec('CREATE TABLE '.RO_SCHEMA.'.users (id BIGINT UNSIGNED PRIMARY KEY, username VARCHAR(20) NOT NULL, name VARCHAR(255) NULL,
        role VARCHAR(16) NOT NULL, is_active TINYINT(1) NOT NULL, is_legacy_placeholder TINYINT(1) NOT NULL, must_change_password TINYINT(1) NOT NULL)');
    $this->pdo->exec('INSERT INTO '.RO_SCHEMA.".users VALUES (42, 'alson', 'Alson Tan', 'member', 1, 0, 0)");

    // The boot-registered connection (with its read-only init command), pointed at the throwaway schema.
    config(['database.connections.dnc_users' => array_merge(config('database.connections.dnc_users'), [
        'host' => '127.0.0.1', 'port' => 3306, 'database' => RO_SCHEMA, 'username' => 'root', 'password' => '',
    ])]);
    DB::purge('dnc_users');
});

afterEach(function () {
    DB::purge('dnc_users');
    $this->pdo?->exec('DROP DATABASE IF EXISTS '.RO_SCHEMA);
});

it('reads the canonical row by id', function () {
    expect(app(DncUserDirectory::class)->find(42))->toMatchArray(['id' => 42, 'username' => 'alson', 'role' => 'member', 'is_active' => true])
        ->and(app(DncUserDirectory::class)->find(7))->toBeNull();
});

it('cannot write, even as a user whose grant would allow it', function () {
    expect(fn () => DB::connection('dnc_users')->table('users')->where('id', 42)->update(['is_active' => 0]))
        ->toThrow(QueryException::class, 'READ ONLY');

    expect((int) $this->pdo->query('SELECT is_active FROM '.RO_SCHEMA.'.users WHERE id = 42')->fetchColumn())->toBe(1);
});
