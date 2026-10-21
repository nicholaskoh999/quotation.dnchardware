<?php

use Illuminate\Support\Facades\DB;

it('answers /health with app up and release info, without touching a database it was not given', function () {
    config(['database.connections.legacy.database' => null]);

    $this->getJson('/health')
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJson(['app' => 'up', 'status' => 'ok', 'database' => 'not_configured'])
        ->assertJsonStructure(['status', 'app', 'release', 'sha', 'builtAt', 'database', 'time']);
});

it('reports an unreachable database as a boolean fact, never the driver text', function () {
    config([
        'quotation.health_checks_database' => true,
        'database.connections.legacy' => [
            'driver' => 'mysql', 'host' => '127.0.0.1', 'port' => 1, 'database' => 'nope_db',
            'username' => 'secret_user_xyz', 'password' => 'secret_pass_xyz', 'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci', 'prefix' => '', 'options' => [PDO::ATTR_TIMEOUT => 1],
        ],
    ]);
    DB::purge('legacy');

    $res = $this->getJson('/health')->assertOk()->assertJson(['status' => 'degraded', 'database' => 'unreachable']);

    $body = $res->getContent();
    foreach (['secret_user_xyz', 'secret_pass_xyz', 'nope_db', '127.0.0.1', 'SQLSTATE', base_path()] as $leak) {
        expect($body)->not->toContain($leak);
    }
});

it('reports a reachable database', function () {
    config([
        'quotation.health_checks_database' => true,
        'database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
    ]);
    DB::purge('legacy');

    $this->getJson('/health')->assertOk()->assertJson(['status' => 'ok', 'database' => 'reachable']);
});

it('reports only a well-formed SHA', function () {
    config(['quotation.release.sha' => 'not-a-sha<script>', 'database.connections.legacy.database' => null]);
    $this->getJson('/health')->assertJson(['sha' => null]);

    config(['quotation.release.sha' => 'ABCDEF1234567890ABCDEF1234567890ABCDEF12']);
    $this->getJson('/health')->assertJson(['sha' => 'abcdef1234567890abcdef1234567890abcdef12']);
});
