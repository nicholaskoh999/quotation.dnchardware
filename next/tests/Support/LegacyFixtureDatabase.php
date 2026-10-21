<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use PDO;
use Throwable;

/**
 * A THROWAWAY legacy schema for tests — never a real database.
 *
 *   mysql   a uniquely named schema on the local 127.0.0.1 server (root, no
 *           password), created per test and dropped afterwards. Skipped when
 *           no local MySQL answers (e.g. CI without a MySQL service).
 *   sqlite  a temp file, deleted afterwards.
 *
 * Seeding goes through a separate `legacy_fixture` connection: the `legacy`
 * connection the application reads through is sealed read-only and would
 * refuse the writes — which is exactly the point.
 */
final class LegacyFixtureDatabase
{
    public const MYSQL_HOST = '127.0.0.1';

    private static ?bool $mysqlUp = null;

    /** @var list<self> */
    private static array $live = [];

    private ?string $mysqlSchema = null;

    private ?string $sqliteFile = null;

    /** @param string|null $schemaName a fixed MySQL schema name (the e2e seeding script); random otherwise */
    public function __construct(public readonly string $driver, private readonly ?string $schemaName = null) {}

    /**
     * Bring a fixture up for one test (skipping MySQL when none answers) and
     * remember it so downAll() can drop it afterwards.
     *
     * @param  list<string>  $without
     */
    public static function for(string $driver, array $without = [], bool $seed = true): self
    {
        if ($driver === 'mysql' && ! self::mysqlAvailable()) {
            test()->markTestSkipped('No local MySQL at '.self::MYSQL_HOST.' — the MySQL leg of this test was skipped.');
        }
        $db = new self($driver);
        self::$live[] = $db;
        if (count(self::$live) === 1) {
            register_shutdown_function(static fn () => self::downAll());
        }

        return $db->up($without, $seed);
    }

    public static function downAll(): void
    {
        while ($db = array_pop(self::$live)) {
            $db->down();
        }
    }

    public static function mysqlAvailable(): bool
    {
        if (self::$mysqlUp !== null) {
            return self::$mysqlUp;
        }
        try {
            new PDO('mysql:host='.self::MYSQL_HOST.';port=3306', 'root', '', [PDO::ATTR_TIMEOUT => 1]);
            self::$mysqlUp = true;
        } catch (Throwable) {
            self::$mysqlUp = false;
        }

        return self::$mysqlUp;
    }

    /** @return array<string, mixed> */
    public static function dataset(): array
    {
        return json_decode((string) file_get_contents(base_path('tests/Fixtures/legacy/dataset.json')), true, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * Create the schema, seed it, and point the `legacy` connection at it.
     *
     * @param  list<string>  $without  tables to leave out (to prove "unavailable" ≠ "empty")
     */
    public function up(array $without = [], bool $seed = true): self
    {
        if ($this->driver === 'mysql') {
            $this->mysqlSchema = $this->schemaName ?? 'dnc_next_d_test_'.getmypid().'_'.bin2hex(random_bytes(4));
            $admin = new PDO('mysql:host='.self::MYSQL_HOST.';port=3306', 'root', '');
            $admin->exec('CREATE DATABASE `'.$this->mysqlSchema.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci');
            $base = [
                'driver' => 'mysql', 'host' => self::MYSQL_HOST, 'port' => '3306', 'database' => $this->mysqlSchema,
                'username' => 'root', 'password' => '', 'unix_socket' => '', 'charset' => 'utf8mb4',
                'collation' => 'utf8mb4_general_ci', 'prefix' => '', 'strict' => true, 'engine' => null,
                'timezone' => '+08:00', 'options' => [PDO::ATTR_TIMEOUT => 2],
            ];
        } else {
            $this->sqliteFile = tempnam(sys_get_temp_dir(), 'dnc-legacy-').'.sqlite';
            touch($this->sqliteFile);
            $base = ['driver' => 'sqlite', 'database' => $this->sqliteFile, 'prefix' => '', 'foreign_key_constraints' => false];
        }

        config(['database.connections.legacy_fixture' => $base, 'database.connections.legacy' => $base]);
        DB::purge('legacy_fixture');
        DB::purge('legacy');

        $fixture = DB::connection('legacy_fixture');
        foreach ($this->schema() as $table => $sql) {
            if (! in_array($table, $without, true)) {
                $fixture->statement($sql);
            }
        }
        if ($seed) {
            $this->seed($without);
        }
        DB::purge('legacy_fixture');

        return $this;
    }

    public function down(): void
    {
        try {
            DB::purge('legacy');
            DB::purge('legacy_fixture');
        } catch (Throwable) {
        }
        if ($this->mysqlSchema !== null) {
            $admin = new PDO('mysql:host='.self::MYSQL_HOST.';port=3306', 'root', '');
            $admin->exec('DROP DATABASE IF EXISTS `'.$this->mysqlSchema.'`');
            $this->mysqlSchema = null;
        }
        if ($this->sqliteFile !== null) {
            @unlink($this->sqliteFile);
            @unlink(substr($this->sqliteFile, 0, -strlen('.sqlite')));
            $this->sqliteFile = null;
        }
    }

    /** Insert one more quotation row (through the fixture connection). */
    public function insertQuotation(array $row): void
    {
        $fixture = DB::connection('legacy_fixture');
        $fixture->table('quotations')->insert($this->quotationRow($row));
        DB::purge('legacy_fixture');
    }

    /** @param list<string> $without */
    private function seed(array $without): void
    {
        $data = self::dataset();
        $fixture = DB::connection('legacy_fixture');
        foreach (['companies', 'quotation_revisions', 'whatsapp_templates', 'default_prices', 'diameter_settings'] as $table) {
            if (! in_array($table, $without, true) && $data[$table] !== []) {
                $fixture->table($table)->insert($data[$table]);
            }
        }
        foreach ($data['quotations'] as $q) {
            $fixture->table('quotations')->insert($this->quotationRow($q));
        }
    }

    /** @param array<string, mixed> $q */
    private function quotationRow(array $q): array
    {
        // json_encode() defaults, exactly as api.php stores items: "1\/2".
        $items = array_key_exists('items_raw', $q) ? $q['items_raw'] : json_encode($q['items']);
        unset($q['items_raw']);
        $q['items'] = $items;

        return $q;
    }

    /** @return array<string, string> */
    private function schema(): array
    {
        if ($this->driver === 'mysql') {
            return [
                'companies' => 'CREATE TABLE companies (
                    id INT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(200) NOT NULL,
                    short_code VARCHAR(20) NULL, phone VARCHAR(50) NULL, address TEXT NULL,
                    PRIMARY KEY (id)) ENGINE=InnoDB',
                'quotations' => 'CREATE TABLE quotations (
                    id INT NOT NULL AUTO_INCREMENT, company_id INT NULL,
                    ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
                    quote_date DATE NULL, valid_until DATE NULL,
                    prepared_by VARCHAR(100) NULL, remarks TEXT NULL,
                    customer_name VARCHAR(200) NULL, customer_phone VARCHAR(50) NULL,
                    items LONGTEXT NULL, total_amount DECIMAL(12,2) NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB',
                'quotation_revisions' => 'CREATE TABLE quotation_revisions (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, quotation_id INT UNSIGNED NOT NULL,
                    revision_no INT UNSIGNED NOT NULL, quotation_ref_no VARCHAR(100) NOT NULL,
                    event_type VARCHAR(32) NOT NULL, actor_user_id INT UNSIGNED NULL,
                    actor_username VARCHAR(64) NULL, actor_display_name VARCHAR(100) NULL,
                    snapshot_schema_version SMALLINT UNSIGNED NOT NULL, snapshot_json JSON NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id), UNIQUE KEY uq_quotation_revisions_no (quotation_id, revision_no)) ENGINE=InnoDB',
                'whatsapp_templates' => 'CREATE TABLE whatsapp_templates (
                    id INT NOT NULL AUTO_INCREMENT, template_name VARCHAR(100) NULL, template_body TEXT NULL,
                    is_default TINYINT(1) NOT NULL DEFAULT 0, PRIMARY KEY (id)) ENGINE=InnoDB',
                'default_prices' => 'CREATE TABLE default_prices (
                    id INT NOT NULL AUTO_INCREMENT, product_type VARCHAR(50) NOT NULL, material VARCHAR(50) NOT NULL,
                    size_type VARCHAR(20) NULL, size VARCHAR(20) NOT NULL, finish VARCHAR(10) NULL,
                    cost_rate DECIMAL(10,4) NOT NULL DEFAULT 0, additional_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
                    markup DECIMAL(10,4) NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1,
                    PRIMARY KEY (id)) ENGINE=InnoDB',
                'diameter_settings' => 'CREATE TABLE diameter_settings (
                    id INT NOT NULL AUTO_INCREMENT, product_type VARCHAR(50) NOT NULL, material VARCHAR(50) NOT NULL,
                    size_type VARCHAR(20) NULL, size VARCHAR(20) NOT NULL, diameter DECIMAL(10,3) NOT NULL,
                    is_active TINYINT(1) NOT NULL DEFAULT 1, PRIMARY KEY (id)) ENGINE=InnoDB',
            ];
        }

        return [
            'companies' => 'CREATE TABLE companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
                short_code TEXT NULL, phone TEXT NULL, address TEXT NULL)',
            'quotations' => 'CREATE TABLE quotations (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NULL,
                ref_no TEXT NOT NULL UNIQUE, quote_date TEXT NULL, valid_until TEXT NULL, prepared_by TEXT NULL,
                remarks TEXT NULL, customer_name TEXT NULL, customer_phone TEXT NULL, items TEXT NULL,
                total_amount NUMERIC NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
            'quotation_revisions' => 'CREATE TABLE quotation_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT,
                quotation_id INTEGER NOT NULL, revision_no INTEGER NOT NULL, quotation_ref_no TEXT NOT NULL,
                event_type TEXT NOT NULL, actor_user_id INTEGER NULL, actor_username TEXT NULL,
                actor_display_name TEXT NULL, snapshot_schema_version INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (quotation_id, revision_no))',
            'whatsapp_templates' => 'CREATE TABLE whatsapp_templates (id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_name TEXT NULL, template_body TEXT NULL, is_default INTEGER NOT NULL DEFAULT 0)',
            'default_prices' => 'CREATE TABLE default_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, product_type TEXT NOT NULL,
                material TEXT NOT NULL, size_type TEXT NULL, size TEXT NOT NULL, finish TEXT NULL,
                cost_rate NUMERIC NOT NULL DEFAULT 0, additional_cost NUMERIC NOT NULL DEFAULT 0,
                markup NUMERIC NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1)',
            'diameter_settings' => 'CREATE TABLE diameter_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, product_type TEXT NOT NULL,
                material TEXT NOT NULL, size_type TEXT NULL, size TEXT NOT NULL, diameter NUMERIC NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1)',
        ];
    }
}
