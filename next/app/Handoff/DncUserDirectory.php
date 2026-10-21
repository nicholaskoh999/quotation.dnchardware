<?php

namespace App\Handoff;

use Illuminate\Database\ConnectionResolverInterface;
use Throwable;

/**
 * Canonical DNC users (Internal PO `users`), read through the separate
 * READ-ONLY `dnc_users` connection (env DNC_USERS_DB_*), matched by users.id
 * ONLY — never by name, username or email. Port of legacy dc_dnc_user_row(),
 * dc_dnc_user_refusal(), dc_dnc_display_name(), dc_dnc_session_check().
 *
 * Read-only twice over: the database user should hold SELECT only, and a
 * MySQL connection is opened with SET SESSION TRANSACTION READ ONLY (init
 * command) so even a broader grant cannot write. Unconfigured = unavailable:
 * every caller fails closed.
 */
final class DncUserDirectory
{
    /** The revision history's actor_display_name column is VARCHAR(100). */
    public const DISPLAY_MAX = 100;

    public function __construct(
        private readonly ConnectionResolverInterface $db,
        private readonly HandoffLog $log,
        private readonly string $connection,
    ) {}

    public function isConfigured(): bool
    {
        $c = config('database.connections.'.$this->connection);
        if (! is_array($c)) {
            return false;
        }
        if (($c['driver'] ?? null) === 'sqlite') {
            return ($c['database'] ?? '') !== '';
        }

        return ($c['host'] ?? '') !== '' && ($c['database'] ?? '') !== '' && ($c['username'] ?? '') !== '';
    }

    /**
     * The canonical row for one users.id, read fresh.
     *
     * @return array{id: int, username: string, name: string, role: string, is_active: bool, is_legacy_placeholder: bool, must_change_password: bool}|null|false
     *                                                                                                                                                           the row; null when no such id; false when it could not be read
     */
    public function find(int $id): array|null|false
    {
        if ($id <= 0 || ! $this->isConfigured()) {
            return false;
        }
        try {
            $row = $this->db->connection($this->connection)
                ->table('users')
                ->select(['id', 'username', 'name', 'role', 'is_active', 'is_legacy_placeholder', 'must_change_password'])
                ->where('id', $id)
                ->limit(1)
                ->first();
        } catch (Throwable $e) {
            // A code only: the driver message can name the user, host or schema.
            $this->log->write('dnc_users_db.unavailable', ['errno' => is_int($e->getCode()) ? $e->getCode() : null]);

            return false;
        }
        if ($row === null) {
            return null;
        }
        $row = (array) $row;

        return [
            'id' => (int) $row['id'],
            'username' => (string) $row['username'],
            'name' => (string) ($row['name'] ?? ''),
            'role' => (string) $row['role'],
            'is_active' => (int) $row['is_active'] === 1,
            'is_legacy_placeholder' => (int) $row['is_legacy_placeholder'] === 1,
            'must_change_password' => (int) $row['must_change_password'] === 1,
        ];
    }

    /**
     * Why this row may not use Quotation, or null when it may. With $claims,
     * username and role must also equal the token's (cross-check only —
     * access never comes from the token's role).
     *
     * @param  array<string, mixed>|null  $row
     * @param  array<string, mixed>|null  $claims
     */
    public static function refusal(?array $row, ?array $claims = null): ?string
    {
        return match (true) {
            ! is_array($row) => 'user_not_found',
            ! $row['is_active'] => 'user_inactive',
            (bool) $row['is_legacy_placeholder'] => 'user_legacy_placeholder',
            (bool) $row['must_change_password'] => 'user_must_change_password',
            $claims !== null && ($row['username'] !== $claims['username'] || $row['role'] !== $claims['role']) => 'user_mismatch',
            default => null,
        };
    }

    /** What History shows for this person: the canonical name, else the username. */
    public static function displayName(array $row): string
    {
        $name = trim(preg_replace('/\s+/u', ' ', (string) $row['name']) ?? '');
        if ($name === '') {
            $name = (string) $row['username'];
        }

        return mb_substr($name, 0, self::DISPLAY_MAX, 'UTF-8');
    }

    /**
     * Is the DNC user behind a session still allowed in?
     *
     * @return string 'ok'; 'unavailable' (refuse this request, keep the
     *                session); or a refusal reason (end the session)
     */
    public function sessionCheck(int $dncUserId, string $username): string
    {
        $row = $this->find($dncUserId);
        if ($row === false) {
            return 'unavailable';
        }
        $reason = self::refusal($row);
        if ($reason === null && $row['username'] !== $username) {
            $reason = 'user_mismatch';
        }

        return $reason ?? 'ok';
    }
}
