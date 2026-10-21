<?php

use App\Legacy\LegacyReader;
use App\Legacy\LegacyWriteRefused;
use App\Legacy\Quotations\QuotationReader;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Support\LegacyFixtureDatabase;

/*
 * Wave 1 is READ-ONLY against the legacy schema. Three layers, each tested:
 * the source code cannot write, the reader refuses anything but one SELECT,
 * and the database session itself refuses writes.
 */

afterEach(fn () => LegacyFixtureDatabase::downAll());

function legacyPhpFiles(): array
{
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Legacy'), FilesystemIterator::SKIP_DOTS));
    $files = [];
    foreach ($it as $f) {
        if ($f->getExtension() === 'php') {
            $files[] = $f->getPathname();
        }
    }
    sort($files);

    return $files;
}

it('contains no SQL write keyword anywhere in app/Legacy', function () {
    $files = legacyPhpFiles();
    expect($files)->not->toBeEmpty();
    foreach ($files as $file) {
        $src = (string) file_get_contents($file);
        expect(preg_match_all('/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|REPLACE|GRANT|RENAME)\b/', $src, $m))
            ->toBe(0, basename($file).' contains '.implode(', ', array_unique($m[0] ?? [])));
    }
});

it('uses no query-builder / Eloquent write path in app/Legacy', function () {
    foreach (legacyPhpFiles() as $file) {
        $src = (string) file_get_contents($file);
        expect(preg_match('/->\s*(insert|insertOrIgnore|insertGetId|insertUsing|update|updateOrInsert|upsert|delete|forceDelete|truncate|increment|decrement|save|saveQuietly|push|statement|unprepared|affectingStatement|table)\s*\(/i', $src, $m))
            ->toBe(0, basename($file).' calls '.($m[0] ?? ''))
            ->and($src)->not->toContain('Illuminate\\Database\\Eloquent\\Model')
            ->and($src)->not->toContain('DB::');
        // exec() is allowed in exactly one place: sealing the session read-only.
        preg_match_all('/->exec\(([^)]*)\)/', $src, $execs);
        foreach ($execs[1] as $arg) {
            expect(basename($file))->toBe('LegacyReader.php');
            expect($arg)->toBeIn(["'SET SESSION TRANSACTION READ ONLY'", "'PRAGMA query_only = ON'"]);
        }
    }
});

it('refuses every statement that is not one plain SELECT', function (string $sql) {
    expect(fn () => LegacyReader::assertReadOnlySql($sql))->toThrow(LegacyWriteRefused::class);
})->with([
    'insert' => 'INSERT INTO quotations (ref_no) VALUES (1)',
    'update' => 'UPDATE quotations SET ref_no = 1',
    'delete' => 'delete from quotations',
    'drop' => 'DROP TABLE quotations',
    'truncate' => 'TRUNCATE quotations',
    'alter' => 'ALTER TABLE quotations ADD x INT',
    'create' => 'CREATE TABLE x (id INT)',
    'comment-smuggled' => '/* SELECT */ DELETE FROM quotations',
    'line-comment-smuggled' => "-- SELECT\nDELETE FROM quotations",
    'stacked' => 'SELECT 1; DELETE FROM quotations',
    'locking read' => 'SELECT * FROM quotations WHERE id = 1 FOR UPDATE',
    'share lock' => 'SELECT * FROM quotations LOCK IN SHARE MODE',
    'outfile' => "SELECT * FROM quotations INTO OUTFILE '/tmp/x'",
    'variable' => 'SELECT 1 INTO @x',
    'set' => 'SET SESSION sql_mode = ""',
]);

it('accepts plain reads', function () {
    LegacyReader::assertReadOnlySql("  SELECT q.id FROM quotations q WHERE q.ref_no LIKE ? ESCAPE '!'");
    LegacyReader::assertReadOnlySql("/* comment */\n select 1");
    expect(true)->toBeTrue();
});

it('seals the legacy session so the database itself refuses writes', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    // A read through the reader seals the session…
    expect(app(QuotationReader::class)->find(101))->not->toBeNull();

    // …after which even a direct write on that same connection is refused by the server.
    expect(fn () => DB::connection('legacy')->insert(
        "INSERT INTO companies (name, short_code) VALUES ('SHOULD NOT EXIST', 'X')",
    ))->toThrow(QueryException::class);
    expect(fn () => DB::connection('legacy')->update('UPDATE quotations SET total_amount = 1 WHERE id = 101'))
        ->toThrow(QueryException::class);

    // And the data is untouched.
    expect(app(QuotationReader::class)->find(101)['totalAmount'])->toBe('158.60');
})->with('legacy drivers');

it('registers only GET routes for the read pages', function () {
    $routes = collect(app('router')->getRoutes()->getRoutes())
        ->filter(fn ($r) => str_starts_with($r->uri(), 'companies') || str_starts_with($r->uri(), 'quotations'));
    expect($routes)->not->toBeEmpty();
    foreach ($routes as $route) {
        expect(array_values(array_diff($route->methods(), ['GET', 'HEAD'])))->toBe([], $route->uri());
    }
});

it('keeps the legacy reader off the default connection and writes switched off', function () {
    expect(LegacyReader::CONNECTION)->toBe('legacy')
        ->and(config('database.default'))->not->toBe('legacy')
        ->and(config('quotation.legacy_writes_enabled'))->toBeFalse();
});
