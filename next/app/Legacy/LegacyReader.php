<?php

namespace App\Legacy;

use Illuminate\Database\Connection;
use Illuminate\Database\DatabaseManager;
use PDO;
use Throwable;
use WeakMap;

/**
 * The ONLY door from QUOTATION NEXT into the legacy QUOTATION.DNC schema.
 *
 * Wave 1 is read-only (handoff §2 "production read-only", R1 policy), and this
 * class makes that a property of the code rather than a promise:
 *
 *  1. It exposes select() and selectOne() and nothing else. There is no
 *     query builder, no Eloquent model and no statement() behind it.
 *  2. Every SQL string is checked before it is sent: it must begin with
 *     SELECT, must be a single statement, and may not take locks or write
 *     a file (`for update`, `lock in share mode`, `into outfile`).
 *  3. The session itself is sealed the first time each PDO handle is used:
 *     MySQL gets `SET SESSION TRANSACTION READ ONLY` (the server then refuses
 *     any write on that session), SQLite (tests) gets `PRAGMA query_only`.
 *     A handle Laravel reconnects is a new object and is sealed again.
 *
 * A test (LegacyReadOnlyGuardTest) also asserts that no SQL write keyword or
 * query-builder write method appears anywhere under app/Legacy.
 */
final class LegacyReader
{
    public const CONNECTION = 'legacy';

    /** @var WeakMap<PDO, true>|null */
    private static ?WeakMap $sealed = null;

    public function __construct(private readonly DatabaseManager $db) {}

    /** A database name is configured for the legacy connection. */
    public function isConfigured(): bool
    {
        return trim((string) config('database.connections.'.self::CONNECTION.'.database', '')) !== '';
    }

    public function driver(): string
    {
        return (string) config('database.connections.'.self::CONNECTION.'.driver', 'mysql');
    }

    /**
     * @param  array<int, mixed>  $bindings
     * @return list<array<string, mixed>>
     *
     * @throws LegacyNotConfigured|LegacyUnavailable
     */
    public function select(string $sql, array $bindings = []): array
    {
        self::assertReadOnlySql($sql);
        $connection = $this->connection();
        try {
            $rows = $connection->select($sql, $bindings, true);
        } catch (Throwable $e) {
            report($e);
            throw new LegacyUnavailable('legacy read failed', 0, $e);
        }

        return array_values(array_map(static fn ($row) => (array) $row, $rows));
    }

    /**
     * @param  array<int, mixed>  $bindings
     * @return array<string, mixed>|null
     */
    public function selectOne(string $sql, array $bindings = []): ?array
    {
        $rows = $this->select($sql, $bindings);

        return $rows[0] ?? null;
    }

    /**
     * Refuse anything that is not one plain SELECT. Public and static so the
     * guard itself is unit-tested.
     */
    public static function assertReadOnlySql(string $sql): void
    {
        $s = trim($sql);
        // Strip leading SQL comments so a comment cannot disguise what follows it.
        while (preg_match('/^(\/\*.*?\*\/|--[^\n]*(\n|$)|#[^\n]*(\n|$))\s*/s', $s, $m)) {
            $s = trim(substr($s, strlen($m[0])));
        }
        $s = rtrim($s);
        if (! preg_match('/^select\b/i', $s)) {
            throw new LegacyWriteRefused('Only SELECT statements may be sent to the legacy database.');
        }
        if (str_contains($s, ';')) {
            throw new LegacyWriteRefused('Only a single statement may be sent to the legacy database.');
        }
        if (preg_match('/\bfor\s+update\b|\block\s+in\s+share\s+mode\b|\bfor\s+share\b|\binto\s+(outfile|dumpfile)\b|\binto\s+@/i', $s)) {
            throw new LegacyWriteRefused('Locking or file-writing reads are refused on the legacy database.');
        }
    }

    private function connection(): Connection
    {
        if (! $this->isConfigured()) {
            throw new LegacyNotConfigured('legacy database not configured');
        }
        try {
            /** @var Connection $connection */
            $connection = $this->db->connection(self::CONNECTION);
            $this->seal($connection);
        } catch (LegacyNotConfigured $e) {
            throw $e;
        } catch (Throwable $e) {
            report($e);
            throw new LegacyUnavailable('legacy database unreachable', 0, $e);
        }

        return $connection;
    }

    /** Make the session itself refuse writes, once per PDO handle. */
    private function seal(Connection $connection): void
    {
        self::$sealed ??= new WeakMap;
        $handles = [$connection->getPdo()];
        $read = $connection->getReadPdo();
        if ($read !== $handles[0]) {
            $handles[] = $read;
        }
        $driver = $connection->getDriverName();
        foreach ($handles as $pdo) {
            if (! $pdo instanceof PDO || isset(self::$sealed[$pdo])) {
                continue;
            }
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $pdo->exec('SET SESSION TRANSACTION READ ONLY');
            } elseif ($driver === 'sqlite') {
                $pdo->exec('PRAGMA query_only = ON');
            }
            self::$sealed[$pdo] = true;
        }
    }
}
