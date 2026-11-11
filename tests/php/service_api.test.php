<?php
/**
 * ── Service API — the shipped files over REAL HTTP against REAL MySQL ───────
 *
 * Run (one command; the database comes from the environment):
 *
 *   DC_SERVICE_TEST_DB_HOST=127.0.0.1 DC_SERVICE_TEST_DB_PORT=33171 \
 *   DC_SERVICE_TEST_DB_USER=root DC_SERVICE_TEST_DB_PASS= \
 *   php tests/php/service_api.test.php
 *
 * WITHOUT DC_SERVICE_TEST_DB_HOST and DC_SERVICE_TEST_DB_PORT THIS SUITE IS
 * SKIPPED — it prints "SKIP", runs nothing and exits 0. A skip is not a pass.
 * There is deliberately no default host or port: this suite never guesses a
 * database server. Point it at a THROWAWAY MySQL 8 instance only. The account
 * must be able to CREATE / DROP DATABASE and CREATE USER.
 *
 * What it does there: creates three uniquely named schemas (a synthetic
 * Quotation schema, a synthetic canonical-users schema, a scratch schema for
 * migration refusal tests) and one SELECT-only MySQL user, and drops all of
 * them on exit. It refuses to start if any of those names already exists.
 *
 * The shipped service.php, service_auth.php, service_actions.php,
 * dnc_handoff.php, auth.php and the handoff contract are copied byte for byte
 * into a sandbox and served by the PHP built-in server on 127.0.0.1. Requests
 * are signed HERE with PHP's own primitives — an independent implementation
 * of docs/SERVICE-API.md §3, not the code under test.
 *
 * The two new tables come from the SHIPPED migrations (section 2, lifted
 * between the markers). `diameter_settings` has no CREATE TABLE in this
 * repository: it is reconstructed here from the columns api.php reads and
 * writes (id, product_type, material, size_type, size, diameter, is_active).
 * `companies` and `quotations` follow the production DDL recorded in the QQ
 * schema inspection of 2026-11-10. ALL DATA IS SYNTHETIC.
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);
$label = 'service API — signed requests over HTTP, real MySQL';

$H = getenv('DC_SERVICE_TEST_DB_HOST');
$P = getenv('DC_SERVICE_TEST_DB_PORT');
if ($H === false || $H === '' || $P === false || $P === '') {
    echo "\n  SKIP  $label\n\n";
    echo "   - NOT RUN: DC_SERVICE_TEST_DB_HOST and DC_SERVICE_TEST_DB_PORT are not set.\n";
    echo "   - This is a skip, not a pass. See the header of this file for the command.\n\n";
    exit(0);
}
$P = (int)$P;
$U = getenv('DC_SERVICE_TEST_DB_USER') ?: 'root';
$W = getenv('DC_SERVICE_TEST_DB_PASS'); if ($W === false) $W = '';

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

// ══ connect ════════════════════════════════════════════════════════════════
mysqli_report(MYSQLI_REPORT_OFF);
$root = @new mysqli($H, $U, $W, null, $P);
if (!$root || $root->connect_errno) {
    echo "\n  FAIL  $label — a database was configured ({$H}:{$P}) but cannot be reached\n\n";
    exit(1);
}
$server = $root->query('SELECT VERSION()')->fetch_row()[0];
$PID = getmypid();
$QDB = "dc_service_q_{$PID}";      // synthetic Quotation schema
$UDB = "dc_service_u_{$PID}";      // synthetic canonical users
$XDB = "dc_service_x_{$PID}";      // scratch: migration refusal
$RO_USER = "dc_svc_ro_{$PID}";
$RO_PASS = bin2hex(random_bytes(12));
foreach ([$QDB, $UDB, $XDB] as $d) {
    $ex = $root->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$d}'");
    if ($ex && $ex->num_rows) { echo "\n  FAIL  {$d} already exists — refusing to reuse it.\n\n"; exit(1); }
}
$SB = sys_get_temp_dir() . "/dc-service-sb-{$PID}";
$srv = null;
register_shutdown_function(function () use ($root, $QDB, $UDB, $XDB, $RO_USER, $SB, &$srv) {
    /* The server first: on Windows its open log files would keep the sandbox alive. */
    if (is_resource($srv)) { proc_terminate($srv); proc_close($srv); $srv = null; usleep(300000); }
    $root->query("DROP DATABASE IF EXISTS {$QDB}");
    $root->query("DROP DATABASE IF EXISTS {$UDB}");
    $root->query("DROP DATABASE IF EXISTS {$XDB}");
    $root->query("DROP USER IF EXISTS '{$RO_USER}'@'%'");
    if (is_dir($SB)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($SB, FilesystemIterator::SKIP_DOTS),
                                            RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        @rmdir($SB);
    }
});

/** Runs a multi-statement script; returns [errno, error] of the first failure, or [0, '']. */
function run_script(mysqli $db, string $sql): array {
    if (!$db->multi_query($sql)) return [$db->errno, $db->error];
    do {
        if ($r = $db->store_result()) $r->free();
        if ($db->errno) return [$db->errno, $db->error];
        if (!$db->more_results()) break;
        if (!$db->next_result()) return [$db->errno, $db->error];
    } while (true);
    return [0, ''];
}
function section(string $file, string $name = 'SECTION 2'): string {
    global $ROOT;
    preg_match('/-- >>> ' . $name . ' BEGIN\s*(.*?)\s*-- <<< ' . $name . ' END/s', file_get_contents("$ROOT/migrations/$file"), $m);
    return $m[1] ?? '';
}
function one(mysqli $db, string $sql) { $r = $db->query($sql); if (!$r) return null; $row = $r->fetch_row(); return $row[0] ?? null; }

// ══ schema ═════════════════════════════════════════════════════════════════
foreach ([$QDB, $UDB, $XDB] as $d) $root->query("CREATE DATABASE {$d} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
$q = new mysqli($H, $U, $W, $QDB, $P);
$q->set_charset('utf8mb4');

/* companies and quotations: the production DDL (schema inspection 2026-11-10). */
ok($q->query("CREATE TABLE `companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `short_code` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_general_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci") === true, 'schema: companies');
ok($q->query("CREATE TABLE `quotations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int DEFAULT NULL,
  `ref_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `quote_date` date DEFAULT NULL,
  `items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_ref` (`ref_no`), KEY `idx_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci") === true, 'schema: quotations (the columns the search reads)');
/* RECONSTRUCTED — no CREATE TABLE for diameter_settings exists in the repository. */
ok($q->query("CREATE TABLE `diameter_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_type` varchar(50) NOT NULL,
  `material` varchar(50) NOT NULL,
  `size_type` varchar(50) DEFAULT NULL,
  `size` varchar(50) NOT NULL,
  `diameter` decimal(10,3) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci") === true, 'schema: diameter_settings (reconstructed from api.php)');

// ══ M · the shipped migrations ═════════════════════════════════════════════
$NM = '2026-11-10-create-service-request-nonces.sql';
$CM = '2026-11-10-create-company-whatsapp-contacts.sql';
ok(section($NM) !== '' && section($CM) !== '', 'M: section 2 lifted from both shipped migrations');
eq(run_script($q, section($NM)), [0, ''], 'M: nonce migration runs on a database without the table');
eq(run_script($q, section($CM)), [0, ''], 'M: contacts migration runs on a database without the table');
eq(run_script($q, section($NM)), [0, ''], 'M: nonce migration is re-runnable');
eq(run_script($q, section($CM)), [0, ''], 'M: contacts migration is re-runnable');

$ddl = fn ($t) => $q->query("SHOW CREATE TABLE $t")->fetch_row()[1];
$DDL_N = $ddl('service_request_nonces'); $DDL_C = $ddl('company_whatsapp_contacts');
ok(strpos($DDL_N, 'PRIMARY KEY (`nonce`)') !== false, 'M: service_request_nonces has PRIMARY KEY (nonce)');
foreach (['PRIMARY KEY (`id`)', 'UNIQUE KEY `uq_cwc_company_phone` (`company_id`,`wa_phone`)', 'UNIQUE KEY `uq_cwc_company_chat` (`company_id`,`wa_chat_id`)',
          'KEY `idx_cwc_phone` (`wa_phone`)', 'KEY `idx_cwc_chat` (`wa_chat_id`)', '`linked_by_user_id` bigint unsigned', '`company_id` int NOT NULL',
          'CONSTRAINT `chk_cwc_has_identity` CHECK', 'CONSTRAINT `chk_cwc_phone_format` CHECK', 'COLLATE=utf8mb4_general_ci'] as $frag) {
    ok(strpos($DDL_C, $frag) !== false, "M: company_whatsapp_contacts has $frag");
}
eq((int)one($q, "SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='{$QDB}'"), 0, 'M: no foreign key anywhere');
ok(stripos($DDL_C, 'FOREIGN KEY') === false, 'M: no foreign key to companies');

/* The database itself refuses what the code must never write. */
ok(!$q->query("INSERT INTO company_whatsapp_contacts (company_id, display_name) VALUES (1, 'Name Only')") && $q->errno === 3819,
   'M: a row with a display name but no phone and no chat id is refused by CHECK (3819)');
ok(!$q->query("INSERT INTO company_whatsapp_contacts (company_id, wa_phone) VALUES (1, '0123')") && $q->errno === 3819,
   'M: a malformed phone is refused by CHECK (3819)');
ok($q->query("INSERT INTO company_whatsapp_contacts (company_id, wa_phone) VALUES (999001, '60000000999')") === true, 'M: a well-formed row is accepted');
ok(!$q->query("INSERT INTO company_whatsapp_contacts (company_id, wa_phone) VALUES (999001, '60000000999')") && $q->errno === 1062,
   'M: the same company + phone twice is refused by the unique key (1062)');
eq(run_script($q, section($CM)), [0, ''], 'M: re-running the contacts migration with a row present succeeds…');
eq((int)one($q, 'SELECT COUNT(*) FROM company_whatsapp_contacts'), 1, 'M: …and keeps the row');
$q->query('DELETE FROM company_whatsapp_contacts');
$q->query('ALTER TABLE company_whatsapp_contacts AUTO_INCREMENT = 1');

/* A table of the same name but another shape: the migration refuses, changes nothing. */
$x = new mysqli($H, $U, $W, $XDB, $P);
$x->query('CREATE TABLE service_request_nonces (nonce VARCHAR(10) NOT NULL, note TEXT) ENGINE=InnoDB');
$x->query('CREATE TABLE company_whatsapp_contacts (id INT NOT NULL PRIMARY KEY, company_id INT NOT NULL, phone VARCHAR(30)) ENGINE=InnoDB');
$before = [$x->query('SHOW CREATE TABLE service_request_nonces')->fetch_row()[1], $x->query('SHOW CREATE TABLE company_whatsapp_contacts')->fetch_row()[1]];
eq(run_script($x, section($NM))[0], 1242, 'M: nonce migration REFUSES an existing table of a different shape (error 1242 at the guard)');
eq(run_script($x, section($CM))[0], 1242, 'M: contacts migration REFUSES an existing table of a different shape (error 1242 at the guard)');
eq([$x->query('SHOW CREATE TABLE service_request_nonces')->fetch_row()[1], $x->query('SHOW CREATE TABLE company_whatsapp_contacts')->fetch_row()[1]], $before,
   'M: …and leaves both foreign tables exactly as they were');
/* Same columns but the primary key missing: also refused. */
$x->query('DROP TABLE service_request_nonces');
$x->query('CREATE TABLE service_request_nonces (nonce CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, key_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
eq(run_script($x, section($NM))[0], 1242, 'M: a nonce table without its PRIMARY KEY is refused too');
/* Rollbacks. */
$x->query('DROP TABLE service_request_nonces'); $x->query('DROP TABLE company_whatsapp_contacts');
run_script($x, section($NM)); run_script($x, section($CM));
$NR = section('2026-11-10-create-service-request-nonces.rollback.sql', 'ROLLBACK');
$CR = section('2026-11-10-create-company-whatsapp-contacts.rollback.sql', 'ROLLBACK');
ok($NR !== '' && $CR !== '', 'M: both rollback scripts found');
$x->query("INSERT INTO company_whatsapp_contacts (company_id, wa_phone) VALUES (1, '60000000998')");
eq(run_script($x, $CR)[0], 1242, 'M: contacts rollback REFUSES to drop a table that still holds links');
eq((int)one($x, 'SELECT COUNT(*) FROM company_whatsapp_contacts'), 1, 'M: …and the link is still there');
$x->query("SET @cwc_export_verified := 'YES'");
eq(run_script($x, $CR), [0, ''], 'M: after the operator confirms the export, it drops');
eq(run_script($x, $NR), [0, ''], 'M: nonce rollback drops');
eq((int)one($x, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='{$XDB}'"), 0, 'M: after both rollbacks nothing is left');
eq(run_script($x, $NR), [0, ''], 'M: a rollback run twice is harmless');
$x->close();

// ══ synthetic data ═════════════════════════════════════════════════════════
/* Internal PO's users table shape, as tests/php/handoff_flow.test.php builds it. */
$root->query("CREATE TABLE {$UDB}.users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(255) NOT NULL,
    username VARCHAR(20) NOT NULL, email VARCHAR(255) NULL, email_verified_at TIMESTAMP NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'member', password VARCHAR(255) NOT NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0, password_changed_at TIMESTAMP NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1, is_legacy_placeholder TINYINT(1) NOT NULL DEFAULT 0,
    disabled_at TIMESTAMP NULL, last_login_at TIMESTAMP NULL, locale VARCHAR(10) NULL,
    remember_token VARCHAR(100) NULL, created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
    PRIMARY KEY (id), UNIQUE KEY users_username_unique (username)) ENGINE=InnoDB");
foreach ([[7, 'Example User', 'exampleuser', 1, 0, 0], [8, 'Second Example', 'seconduser', 1, 0, 0], [44, 'Former Example', 'formeruser', 0, 0, 0],
          [45, 'Legacy Example', 'legacyuser', 1, 1, 0], [46, 'New Example', 'newuser', 1, 0, 1]] as [$id, $name, $un, $act, $leg, $must]) {
    $root->query("INSERT INTO {$UDB}.users (id, name, username, password, is_active, is_legacy_placeholder, must_change_password)
                  VALUES ($id, '$name', '$un', 'x-not-a-hash', $act, $leg, $must)");
}
$root->query("CREATE USER '{$RO_USER}'@'%' IDENTIFIED BY '{$RO_PASS}'");
$root->query("GRANT SELECT ON {$UDB}.users TO '{$RO_USER}'@'%'");

$companies = [
    [901, 'Example Trading Sdn Bhd', 'EXT', '+60000000091', '1 Fake Street'],
    [902, 'Example Steel Works',     null,  '+60000000092', null],
    [903, 'Sample 100% Hardware',    'S100', null,          '3 Fake Street'],
    [904, 'Sample_Underscore Co',    'SUC',  '',            ''],
    [905, 'Pipe|Bar Fixtures',       '',     null,          null],
    [906, 'Zeta Fasteners',          'EXZ',  null,          null],
];
foreach ($companies as [$id, $name, $code, $phone, $addr]) {
    $st = $q->prepare('INSERT INTO companies (id, name, short_code, phone, address) VALUES (?, ?, ?, ?, ?)');
    $st->bind_param('issss', $id, $name, $code, $phone, $addr); $st->execute(); $st->close();
}
for ($i = 1; $i <= 30; $i++) $q->query("INSERT INTO companies (id, name, short_code) VALUES (" . (1000 + $i) . ", 'Bulk Fake Customer " . sprintf('%02d', $i) . "', 'BLK')");
$q->query("INSERT INTO quotations (company_id, ref_no, quote_date, items, total_amount, created_at) VALUES
    (901, 'Q-2099-0001', '2099-01-05', '[]', 10.00, '2099-01-05 09:00:00'),
    (901, 'Q-2099-0002', '2099-02-10', '[]', 20.00, '2099-02-10 09:00:00'),
    (901, 'Q-2099-0003', NULL,         '[]', 30.00, '2099-01-20 09:00:00'),
    (906, 'Q-2099-0004', '2099-03-01', '[]', 40.00, '2099-03-01 09:00:00')");
$q->query("INSERT INTO diameter_settings (id, product_type, material, size_type, size, diameter, is_active) VALUES
    (3, 'sagrod', 'MS', 'UNDERSIZE', 'M12', 10.900, 1),
    (4, 'sagrod', 'MS', NULL,        'M16', 14.700, 1),
    (5, 'anchor', 'SS304', 'FULL',   'M20', 20.000, 1),
    (6, 'sagrod', 'MS', 'UNDERSIZE', 'M10', 8.850,  0),
    (7, 'anchor', 'MS', '',          'M24', 22.050, 1)");

$snapshot = function (string $table) use ($q) {
    $r = $q->query("SELECT * FROM $table ORDER BY id");
    $rows = []; while ($row = $r->fetch_assoc()) $rows[] = $row;
    return hash('sha256', serialize($rows)) . ':' . count($rows) . ':' . one($q, "CHECKSUM TABLE $table") ;
};
$checksum = fn ($t) => $q->query("CHECKSUM TABLE $t")->fetch_row()[1];
$COMPANIES_BEFORE = [$snapshot('companies'), $checksum('companies')];
$QUOTES_BEFORE    = [$snapshot('quotations'), $checksum('quotations')];
$DIAM_BEFORE      = [$snapshot('diameter_settings'), $checksum('diameter_settings')];

// ══ sandbox ════════════════════════════════════════════════════════════════
@mkdir("$SB/app/Handoff/Contract", 0777, true);
$SHIPPED = ['service.php', 'service_auth.php', 'service_actions.php', 'service_quotations.php', 'quotation_store.php', 'quo-quote-core.js', 'dnc_handoff.php', 'auth.php',
            'app/Handoff/Contract/HandoffToken.php', 'app/Handoff/Contract/InvalidHandoffToken.php',
            'quo-parser-core.js', 'quo-pricing-core.js'];
foreach ($SHIPPED as $f) copy("$ROOT/$f", "$SB/$f");
$same = true; foreach ($SHIPPED as $f) $same = $same && sha1_file("$SB/$f") === sha1_file("$ROOT/$f");
ok($same, 'sandbox: serves byte-identical copies of the shipped files');
ok(!is_file("$SB/api.php") && !is_file("$SB/index.php") && !is_file("$SB/login.php"), 'sandbox: api.php, index.php and login.php are not even present — the service does not need them');

$dbPhp = fn ($schema, $port) => "<?php function getDB(){ \$d = new mysqli(" . var_export($H, true) . ',' . var_export($U, true) . ','
    . var_export($W, true) . ',' . var_export($schema, true) . ",{$port}); if (\$d->connect_error) { http_response_code(500); "
    . "die(json_encode(['error' => 'DB connection failed: ' . \$d->connect_error])); } \$d->set_charset('utf8mb4'); return \$d; }\n";
file_put_contents("$SB/db.php", $dbPhp($QDB, $P));
$DNC = ['DNC_HANDOFF_ENABLED' => 'false', 'DNC_HANDOFF_SECRET' => 'base64:' . base64_encode(random_bytes(32)),
        'DNC_USERS_DB_HOST' => $H, 'DNC_USERS_DB_PORT' => (string)$P, 'DNC_USERS_DB_DATABASE' => $UDB,
        'DNC_USERS_DB_USERNAME' => $RO_USER, 'DNC_USERS_DB_PASSWORD' => $RO_PASS];
$writeDnc = function (array $over = []) use ($SB, $DNC) { file_put_contents("$SB/dnc_config.php", '<?php return ' . var_export(array_merge($DNC, $over), true) . ';'); };
$writeDnc();

/* A fresh random key per run. It exists only in the sandbox and in memory. */
$KEY = random_bytes(32); $SECRET = 'base64:' . base64_encode($KEY);
$OLDKEY = random_bytes(32); $OLDSECRET = 'base64:' . base64_encode($OLDKEY);
$KEYID = 'qq-backend-1';
$CONF = ['QQ_SERVICE_ENABLED' => 'true', 'QQ_SERVICE_KEY_ID' => $KEYID, 'QQ_SERVICE_SECRET' => $SECRET, 'QQ_SERVICE_SECRET_PREVIOUS' => ''];
$writeConf = function ($conf) use ($SB) {
    if ($conf === null) { @unlink("$SB/service_config.php"); return; }
    file_put_contents("$SB/service_config.php", '<?php return ' . var_export($conf, true) . ';');
};
/* The server starts with NO service_config.php: the shipped default. */

$PORT = 37000 + ($PID % 900);
$LOGFILE = "$SB/php-error.log";
$env = [];
foreach (getenv() as $k => $v) if (strpos($k, 'DNC_') !== 0 && strpos($k, 'QQ_') !== 0) $env[$k] = $v;
$srv = proc_open([PHP_BINARY, '-d', "error_log=$LOGFILE", '-d', 'log_errors=1', '-d', 'display_errors=1', '-d', 'opcache.enable_cli=0',
                  '-S', "127.0.0.1:{$PORT}", '-t', $SB],
                 [1 => ['file', "$SB/server.out", 'w'], 2 => ['file', "$SB/server.err", 'w']], $srvPipes, $SB, $env);
$up = false;
for ($i = 0; $i < 60 && !$up; $i++) { $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3); if ($fp) { fclose($fp); $up = true; } else usleep(200000); }
ok($up, "sandbox: server listening on 127.0.0.1:{$PORT}");

$SEEN = [];      // every response, raw — searched for secrets at the end
$SIGS = [];      // every signature sent
/** A raw HTTP request. */
function http(string $method, string $path, string $body = '', array $headers = []) {
    global $PORT, $SEEN;
    $s = fsockopen('127.0.0.1', $PORT, $en, $es, 10);
    $req = "$method $path HTTP/1.1\r\nHost: quo.test.invalid\r\nConnection: close\r\n";
    if (!array_key_exists('Content-Length', $headers) && ($body !== '' || $method === 'POST')) $headers['Content-Length'] = (string)strlen($body);
    foreach ($headers as $k => $v) if ($v !== null) $req .= "$k: $v\r\n";
    fwrite($s, $req . "\r\n" . $body);
    $raw = ''; while (!feof($s)) $raw .= fread($s, 65536);
    fclose($s);
    $SEEN[] = $raw;
    [$head, $content] = array_pad(explode("\r\n\r\n", $raw, 2), 2, '');
    $lines = explode("\r\n", $head);
    preg_match('#^HTTP/\S+ (\d+)#', (string)array_shift($lines), $m);
    $h = [];
    foreach ($lines as $l) { [$k, $v] = array_pad(explode(':', $l, 2), 2, ''); $h[strtolower(trim($k))][] = trim($v); }
    return ['status' => (int)($m[1] ?? 0), 'h' => $h, 'body' => $content, 'json' => json_decode($content, true)];
}
/** docs/SERVICE-API.md §3, implemented with PHP primitives only. */
function sign(string $key, string $action, string $ts, string $nonce, string $body): string {
    $string = "qqs1\nPOST\n$action\n$ts\n$nonce\n" . hash('sha256', $body);
    return rtrim(strtr(base64_encode(hash_hmac('sha256', $string, $key, true)), '+/', '-_'), '=');
}
/* The client's core claim for a core served beside service.php, computed here
   independently: SHA-256 of the file bytes, contract from the file's constant. */
function core_claim(string $file, string $const): array {
    global $SB;
    $src = (string)file_get_contents("$SB/$file");
    preg_match('/const ' . $const . '\s*=\s*(\d+);/', $src, $m);
    return ['version' => core_version($file), 'contract' => (int)($m[1] ?? 0), 'sha256' => hash('sha256', $src)];
}
/** The version the core file declares (QUO_*_CORE_VERSION), read from the file, never a literal. */
function core_version(string $file): string {
    global $ROOT;
    preg_match("/const QUO_[A-Z]+_CORE_VERSION\s*=\s*'([0-9.]+)'/", (string)file_get_contents("$ROOT/$file"), $m);
    return $m[1] ?? '0';
}
/**
 * One signed call. $o overrides: actor, body (raw), key, keyId, ts, nonce,
 * signAction, signBody, sig, method, headers (extra / null to drop), requestId,
 * cores (the client.cores claims; null = send none). By default the request
 * claims the served cores, i.e. it comes from an up-to-date client.
 */
function call(string $action, array $params = [], array $o = []) {
    global $KEY, $KEYID, $SIGS;
    $actor = $o['actor'] ?? ['sub' => 7, 'username' => 'exampleuser'];
    $envelope = ['actor' => $actor, 'requestId' => $o['requestId'] ?? ('req_' . bin2hex(random_bytes(6))), 'params' => (object)$params];
    $cores = array_key_exists('cores', $o) ? $o['cores']
           : ['parser' => core_claim('quo-parser-core.js', 'QUO_PARSER_CORE_CONTRACT'), 'pricing' => core_claim('quo-pricing-core.js', 'QUO_PRICING_CORE_CONTRACT'), 'quote' => core_claim('quo-quote-core.js', 'QUO_QUOTE_CORE_CONTRACT')];
    if ($cores !== null) $envelope['client'] = ['cores' => $cores];
    $body  = $o['body'] ?? json_encode($envelope);
    $ts    = (string)($o['ts'] ?? time());
    $nonce = $o['nonce'] ?? bin2hex(random_bytes(16));
    $sig   = $o['sig'] ?? sign($o['key'] ?? $KEY, $o['signAction'] ?? $action, $ts, $nonce, $o['signBody'] ?? $body);
    $SIGS[] = $sig;
    $headers = array_merge(['Content-Type' => 'application/json', 'X-QQS-Key-Id' => $o['keyId'] ?? $KEYID, 'X-QQS-Timestamp' => $ts,
                            'X-QQS-Nonce' => $nonce, 'X-QQS-Signature' => $sig], $o['headers'] ?? []);
    $r = http($o['method'] ?? 'POST', '/service.php?action=' . rawurlencode($action), $body, $headers);
    $r['nonce'] = $nonce;
    return $r;
}
function code_of($r) { return $r['json']['error']['code'] ?? ($r['json']['ok'] ?? null ? 'OK' : null); }
function refused($r, int $status, string $code, string $msg) {
    eq([$r['status'], code_of($r), $r['json']['ok'] ?? null], [$status, $code, false], $msg);
    ok(isset($r['json']['error']['message']) && is_string($r['json']['error']['message']) && !isset($r['json']['data']), "$msg — generic message, no data");
}
$nonces = fn () => (int)one($q, 'SELECT COUNT(*) FROM service_request_nonces');

if ($up) {

// ══ A · disabled by default ════════════════════════════════════════════════
$r = call('ping');
refused($r, 404, 'not_available', 'A: no service_config.php → a correctly signed ping is 404 not_available');
eq($r['json']['error']['message'], 'Not available', 'A: with the generic message');
refused(http('GET', '/service.php?action=ping'), 404, 'not_available', 'A: …a GET too');
refused(http('POST', '/service.php', '', ['Content-Type' => 'application/json']), 404, 'not_available', 'A: …and a bare POST');
eq($nonces(), 0, 'A: nothing was written while disabled');
foreach ([
    'enabled=false'              => array_merge($CONF, ['QQ_SERVICE_ENABLED' => 'false']),
    'enabled key missing'        => array_diff_key($CONF, ['QQ_SERVICE_ENABLED' => 1]),
    'secret empty'               => array_merge($CONF, ['QQ_SERVICE_SECRET' => '']),
    'secret 31 bytes'            => array_merge($CONF, ['QQ_SERVICE_SECRET' => 'base64:' . base64_encode(substr($KEY, 0, 31))]),
    'secret not base64:'         => array_merge($CONF, ['QQ_SERVICE_SECRET' => bin2hex($KEY)]),
    'secret = the handoff secret' => array_merge($CONF, ['QQ_SERVICE_SECRET' => $DNC['DNC_HANDOFF_SECRET']]),
    'config file returns a string' => 'true',
] as $what => $conf) {
    $writeConf($conf);
    $key = is_array($conf) && strpos((string)($conf['QQ_SERVICE_SECRET'] ?? ''), 'base64:') === 0 ? (string)base64_decode(substr($conf['QQ_SERVICE_SECRET'], 7)) : $KEY;
    refused(call('ping', [], ['key' => $key === '' ? $KEY : $key]), 404, 'not_available', "A: $what → 404 not_available even when signed with that very value");
}
eq($nonces(), 0, 'A: still nothing written');
$writeConf($CONF);

// ══ B · a valid signed ping ════════════════════════════════════════════════
$t0 = time();
$r = call('ping', [], ['requestId' => 'req_PING0001']);
eq([$r['status'], $r['json']['ok'] ?? null], [200, true], 'B: enabled + valid signature → ping 200 ok');
$d = $r['json']['data'] ?? [];
eq(array_keys($d), ['service', 'contract', 'scheme', 'actions', 'serverTime', 'serverTimeUnix', 'createEnabled'], 'B: ping data keys');
eq($d['createEnabled'] ?? null, false, 'B: quotation create is OFF unless QQ_SERVICE_CREATE_ENABLED says so');
eq([$d['service'] ?? null, $d['contract'] ?? null, $d['scheme'] ?? null], ['quo-service', 1, 'qqs1'], 'B: service, contract version, scheme');
eq($d['actions'] ?? null, ['ping', 'diameter_settings.get', 'default_prices.get', 'companies.search', 'contacts.lookup', 'contacts.link', 'whatsapp_template.get', 'quotations.create', 'quotations.lookup_by_key'], 'B: the allow-list is reported');
ok(is_int($d['serverTimeUnix'] ?? null) && abs($d['serverTimeUnix'] - $t0) <= 5, 'B: server time (Unix seconds)');
ok(preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', (string)($d['serverTime'] ?? '')) === 1, 'B: server time (ISO 8601 UTC)');
eq($r['json']['meta']['requestId'] ?? null, 'req_PING0001', 'B: meta.requestId echoes the plain request id');
eq($r['h']['content-type'][0] ?? null, 'application/json; charset=utf-8', 'B: Content-Type application/json');
eq($r['h']['cache-control'][0] ?? null, 'no-store', 'B: Cache-Control no-store');
eq($r['json']['core'] ?? null, ['accepted' => true, 'parser' => ['status' => 'current', 'version' => core_version('quo-parser-core.js')], 'pricing' => ['status' => 'current', 'version' => core_version('quo-pricing-core.js')], 'quote' => ['status' => 'current', 'version' => core_version('quo-quote-core.js')], 'reason' => 'accepted'],
   'B: the answer carries the core verdict: the served cores are accepted');
eq(array_keys($r['json'] ?? []), ['ok', 'data', 'core', 'meta'], 'B: envelope keys ok, data, core, meta');
eq($nonces(), 1, 'B: exactly one nonce row was written');
eq(one($q, "SELECT key_id FROM service_request_nonces WHERE nonce='{$r['nonce']}'"), $KEYID, 'B: …this request\'s, with its key id');

// ══ C · method, content type, browser headers ══════════════════════════════
$n0 = $nonces();
refused(http('GET', '/service.php?action=ping'), 405, 'method_not_allowed', 'C: GET → 405');
refused(call('ping', [], ['method' => 'GET']), 405, 'method_not_allowed', 'C: GET with a valid signature → still 405');
foreach (['PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as $m) {
    $x = call('ping', [], ['method' => $m]);
    eq($x['status'], 405, "C: $m → 405");
}
refused(call('ping', [], ['headers' => ['Content-Type' => 'text/plain']]), 415, 'unsupported_media_type', 'C: text/plain → 415');
refused(call('ping', [], ['headers' => ['Content-Type' => 'application/x-www-form-urlencoded']]), 415, 'unsupported_media_type', 'C: a form post → 415');
refused(call('ping', [], ['headers' => ['Content-Type' => null]]), 415, 'unsupported_media_type', 'C: no Content-Type → 415');
eq(call('ping', [], ['headers' => ['Content-Type' => 'application/json; charset=utf-8']])['status'], 200, 'C: application/json; charset=utf-8 is accepted');
refused(call('ping', [], ['headers' => ['Origin' => 'https://quo.test.invalid']]), 403, 'browser_request_refused', 'C: an Origin header → 403, valid signature or not');
refused(call('ping', [], ['headers' => ['Cookie' => '__Host-DCQUOSESS=fake']]), 403, 'browser_request_refused', 'C: a Cookie header → 403');
refused(call('ping', [], ['headers' => ['Sec-Fetch-Site' => 'same-origin']]), 403, 'browser_request_refused', 'C: Sec-Fetch-Site → 403');
$big = str_repeat('a', 524289);
refused(call('ping', [], ['body' => $big]), 413, 'payload_too_large', 'C: a body over 512 KB → 413');
eq($nonces(), $n0 + 1, 'C: none of the refused requests stored a nonce (only the accepted one did)');

// ══ D · signature ══════════════════════════════════════════════════════════
$n0 = $nonces();
refused(call('ping', [], ['key' => random_bytes(32)]), 401, 'invalid_signature', 'D: signed with another key → 401 invalid_signature');
refused(call('ping', [], ['sig' => str_repeat('A', 43)]), 401, 'invalid_signature', 'D: a made-up signature → 401');
refused(call('ping', [], ['sig' => '']), 401, 'invalid_signature', 'D: an empty signature → 401');
refused(call('ping', [], ['headers' => ['X-QQS-Signature' => null]]), 401, 'invalid_signature', 'D: no signature header → 401');
refused(call('ping', [], ['headers' => ['X-QQS-Timestamp' => null]]), 401, 'invalid_signature', 'D: no timestamp header → 401');
refused(call('ping', [], ['headers' => ['X-QQS-Nonce' => null]]), 401, 'invalid_signature', 'D: no nonce header → 401');
refused(call('ping', [], ['keyId' => 'someone-else']), 401, 'invalid_signature', 'D: an unknown key id → 401 (same answer as a bad signature)');
refused(call('ping', [], ['headers' => ['X-QQS-Key-Id' => null]]), 401, 'invalid_signature', 'D: no key id → 401');
$good = json_encode(['actor' => ['sub' => 7, 'username' => 'exampleuser'], 'requestId' => 'req_T1', 'params' => (object)[]]);
$evil = json_encode(['actor' => ['sub' => 8, 'username' => 'seconduser'], 'requestId' => 'req_T1', 'params' => (object)[]]);
refused(call('ping', [], ['body' => $evil, 'signBody' => $good]), 401, 'invalid_signature', 'D: TAMPERED BODY (another acting user under the original signature) → 401');
refused(call('ping', [], ['body' => $good . ' ', 'signBody' => $good]), 401, 'invalid_signature', 'D: one byte appended to the body → 401');
refused(call('diameter_settings.get', [], ['signAction' => 'ping']), 401, 'invalid_signature', 'D: WRONG ACTION IN SIGNATURE (signed ping, sent diameter_settings.get) → 401');
refused(call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000001', 'chatKind' => 'individual'], ['signAction' => 'contacts.lookup']), 401,
        'invalid_signature', 'D: a lookup signature cannot be used to link');
$ts = (string)time(); $nn = bin2hex(random_bytes(16));
refused(call('ping', [], ['ts' => (string)($ts + 1), 'sig' => sign($KEY, 'ping', $ts, $nn, $good), 'nonce' => $nn, 'body' => $good]), 401, 'invalid_signature', 'D: timestamp changed after signing → 401');
refused(call('ping', [], ['ts' => $ts, 'sig' => sign($KEY, 'ping', $ts, $nn, $good), 'nonce' => bin2hex(random_bytes(16)), 'body' => $good]), 401, 'invalid_signature', 'D: nonce changed after signing → 401');
refused(call('ping', [], ['nonce' => strtoupper(bin2hex(random_bytes(16)))]), 401, 'invalid_signature', 'D: an upper-case nonce → 401');
refused(call('ping', [], ['nonce' => 'short']), 401, 'invalid_signature', 'D: a short nonce → 401');
refused(call('ping', [], ['ts' => (string)(time() * 1000)]), 401, 'invalid_signature', 'D: a millisecond timestamp → 401');
/* A signature made with the std (not url-safe) alphabet or padding is refused. */
$sigStd = base64_encode(hash_hmac('sha256', "qqs1\nPOST\nping\n$ts\n$nn\n" . hash('sha256', $good), $KEY, true));
refused(call('ping', [], ['ts' => $ts, 'nonce' => $nn, 'body' => $good, 'sig' => $sigStd]), 401, 'invalid_signature', 'D: a padded standard-base64 signature → 401');
eq($nonces(), $n0, 'D: no refused signature stored a nonce — the database is not written before authentication');
/* …and that last nonce is still free: a properly signed request with it works. */
eq(call('ping', [], ['ts' => $ts, 'nonce' => $nn, 'body' => $good])['status'], 200, 'D: the same nonce, correctly signed, is then accepted once');

// ══ E · timestamp ══════════════════════════════════════════════════════════
$n0 = $nonces();
refused(call('ping', [], ['ts' => time() - 120]), 401, 'timestamp_out_of_window', 'E: EXPIRED — a correctly signed request 120 s old → 401 timestamp_out_of_window');
refused(call('ping', [], ['ts' => time() - 3600]), 401, 'timestamp_out_of_window', 'E: an hour old → 401');
refused(call('ping', [], ['ts' => time() + 120]), 401, 'timestamp_out_of_window', 'E: FUTURE — 120 s ahead → 401');
refused(call('ping', [], ['ts' => time() + 86400]), 401, 'timestamp_out_of_window', 'E: a day ahead → 401');
eq($nonces(), $n0, 'E: no out-of-window request stored a nonce');
eq(call('ping', [], ['ts' => time() - 30])['status'], 200, 'E: 30 s old is accepted');
eq(call('ping', [], ['ts' => time() + 30])['status'], 200, 'E: 30 s ahead is accepted');

// ══ F · replay ═════════════════════════════════════════════════════════════
$ts = (string)time(); $nn = bin2hex(random_bytes(16));
$first = call('diameter_settings.get', [], ['ts' => $ts, 'nonce' => $nn, 'body' => $good]);
eq($first['status'], 200, 'F: first use of a nonce → 200');
$again = call('diameter_settings.get', [], ['ts' => $ts, 'nonce' => $nn, 'body' => $good]);
refused($again, 409, 'replayed', 'F: REPLAY — the identical request again → 409 replayed');
refused(call('ping', [], ['nonce' => $nn]), 409, 'replayed', 'F: the same nonce on a different, correctly signed request → 409 replayed');
eq((int)one($q, "SELECT COUNT(*) FROM service_request_nonces WHERE nonce='$nn'"), 1, 'F: one row for that nonce');
ok(!$q->query("INSERT INTO service_request_nonces (nonce, key_id) VALUES ('$nn', 'x')") && $q->errno === 1062, 'F: the database itself refuses the duplicate (1062, primary key)');
/* Without the replay table the door fails CLOSED. */
$q->query('RENAME TABLE service_request_nonces TO service_request_nonces_gone');
refused(call('ping'), 503, 'quo_unavailable', 'F: replay table missing → 503 quo_unavailable, never "ok"');
$q->query('RENAME TABLE service_request_nonces_gone TO service_request_nonces');
eq(call('ping')['status'], 200, 'F: and works again once it is back');

// ══ G · allow-list ═════════════════════════════════════════════════════════
preg_match('/const DC_MUTATING_ACTIONS = \[(.*?)\];/s', file_get_contents("$ROOT/api.php"), $mm);
preg_match_all("/'([a-z_]+)'/", $mm[1] ?? '', $mut);
ok(count($mut[1]) >= 16, 'G: every mutating action name read from api.php (' . count($mut[1]) . ')');
/* quotations.create is offered since Loop #7 (create-only, behind QQ_SERVICE_CREATE_ENABLED,
   tested in service_quotation_create.test.php); update and delete never are. */
$notOffered = array_merge($mut[1], ['quotations.update', 'quotations.delete', 'quotations_create', 'get_quotations', 'get_quotation',
    'get_companies', 'get_next_ref', 'get_diameter_settings', 'get_default_prices', 'get_whatsapp_template', 'export_diameter_settings',
    'companies.create', 'companies.update', 'companies.delete', 'contacts.unlink', 'contacts.delete', 'diameter_settings.save',
    'diameter_settings.get.', 'ping.', 'unknown', 'x']);
foreach ($notOffered as $a) {
    $r = call($a, ['id' => 901, 'company_id' => 901, 'name' => 'Injected Fake Co', 'items' => [['qty' => 1]], 'total_amount' => 1]);
    eq([$r['status'], code_of($r)], [404, 'unknown_action'], "G: $a → 404 unknown_action (correctly signed, valid user)");
}
foreach (['PING', 'Ping', 'contacts.link ', '../api', 'ping;x', ''] as $a) {
    $r = call($a);
    ok(in_array($r['status'], [401, 404], true) && ($r['json']['ok'] ?? null) === false, 'G: malformed action ' . var_export($a, true) . ' → refused');
}
eq([$snapshot('companies'), $checksum('companies')], $COMPANIES_BEFORE, 'G: companies untouched after every write-shaped attempt');
eq([$snapshot('quotations'), $checksum('quotations')], $QUOTES_BEFORE, 'G: quotations untouched');
eq([$snapshot('diameter_settings'), $checksum('diameter_settings')], $DIAM_BEFORE, 'G: diameter_settings untouched');

// ══ H · body envelope and acting user ══════════════════════════════════════
foreach ([
    'empty body'          => '',
    'not JSON'            => 'actor=7',
    'a JSON list'         => '[]',
    'no actor'            => '{"params":{}}',
    'sub as a string'     => '{"actor":{"sub":"7","username":"exampleuser"}}',
    'sub zero'            => '{"actor":{"sub":0,"username":"exampleuser"}}',
    'no username'         => '{"actor":{"sub":7}}',
    'params a list'       => '{"actor":{"sub":7,"username":"exampleuser"},"params":[1]}',
] as $what => $raw) {
    refused(call('ping', [], ['body' => $raw]), 400, 'invalid_body', "H: $what (correctly signed) → 400 invalid_body");
}
foreach ([
    'unknown user id'                 => ['sub' => 999, 'username' => 'exampleuser'],
    'INACTIVE user'                   => ['sub' => 44, 'username' => 'formeruser'],
    'legacy placeholder user'         => ['sub' => 45, 'username' => 'legacyuser'],
    'user who must change password'   => ['sub' => 46, 'username' => 'newuser'],
    'right id, wrong username'        => ['sub' => 7, 'username' => 'seconduser'],
    'right id, username in other case' => ['sub' => 7, 'username' => 'ExampleUser'],
] as $what => $actor) {
    foreach (['ping', 'diameter_settings.get', 'contacts.link'] as $a) {
        $r = call($a, ['companyId' => 901, 'waPhone' => '60000000001', 'chatKind' => 'individual'], ['actor' => $actor]);
        eq([$r['status'], code_of($r)], [403, 'actor_refused'], "H: $what → $a is 403 actor_refused");
    }
}
eq((int)one($q, 'SELECT COUNT(*) FROM company_whatsapp_contacts'), 0, 'H: no refused user wrote a link');
eq(call('ping', [], ['actor' => ['sub' => 8, 'username' => 'seconduser']])['status'], 200, 'H: a second active user is accepted');
/* The user is re-read on EVERY request: disabling them takes effect at once. */
$root->query("UPDATE {$UDB}.users SET is_active = 0 WHERE id = 8");
refused(call('ping', [], ['actor' => ['sub' => 8, 'username' => 'seconduser']]), 403, 'actor_refused', 'H: disabled in the canonical table → refused on the very next request');
$root->query("UPDATE {$UDB}.users SET is_active = 1 WHERE id = 8");
eq(call('ping', [], ['actor' => ['sub' => 8, 'username' => 'seconduser']])['status'], 200, 'H: and accepted again when re-enabled');
/* Cannot check the user → refuse (503), never let through. */
$writeDnc(['DNC_USERS_DB_PASSWORD' => 'wrong-' . bin2hex(random_bytes(4))]);
refused(call('ping'), 503, 'actor_check_unavailable', 'H: canonical users database unreachable → 503 actor_check_unavailable');
refused(call('diameter_settings.get'), 503, 'actor_check_unavailable', 'H: …for a business action too: no data without a checked user');
$writeDnc(['DNC_USERS_DB_HOST' => '']);
refused(call('ping'), 503, 'actor_check_unavailable', 'H: canonical users database not configured → 503');
$writeDnc();
eq(call('ping')['status'], 200, 'H: back to normal');

// ══ I · diameter_settings.get ══════════════════════════════════════════════
/* api.php's OWN block, lifted from the shipped file and executed here against
   the same table, with the two helpers it calls stubbed to their essentials. */
function require_table($db, $table) { }
function query_or_fail($db, $sql, $label = '') { $res = $db->query($sql); if (!$res) throw new RuntimeException('query failed'); return $res; }
preg_match('/\} elseif \(\$action === \'get_diameter_settings\'\) \{(.*?)\n\} elseif/s', file_get_contents("$ROOT/api.php"), $blk);
ok(!empty($blk[1]) && strpos($blk[1], 'echo json_encode') !== false, 'I: api.php get_diameter_settings block lifted');
$apiOutput = function () use ($blk, $q) { $db = $q; ob_start(); eval($blk[1]); return ob_get_clean(); };
$apiJson = $apiOutput();
$apiData = json_decode($apiJson, true)['data'] ?? null;
ok(is_array($apiData) && count($apiData) === 4, 'I: api.php returns the 4 active rows (' . count((array)$apiData) . ')');
$apiRowsJson = substr($apiJson, strlen('{"ok":true,"data":'), -1);
eq(json_decode($apiRowsJson, true), $apiData, 'I: (the raw rows JSON was cut out of api.php\'s output correctly)');

$r = call('diameter_settings.get');
eq($r['status'], 200, 'I: diameter_settings.get → 200');
$d = $r['json']['data'] ?? [];
eq(array_keys($d), ['rules', 'version', 'ruleCount', 'fetchedAt'], 'I: data keys');
ok(($d['rules'] ?? null) === $apiData, 'I: rules are IDENTICAL to what get_diameter_settings gives: same rows, keys, types and order');
ok(strpos($r['body'], '"rules":' . $apiRowsJson . ',') !== false, 'I: …byte for byte in the JSON itself');
eq(array_keys($d['rules'][0] ?? []), ['id', 'type', 'product_type', 'material', 'sizeType', 'size_type', 'size', 'diameter', 'active', 'is_active'], 'I: row keys, in api.php\'s order');
eq(array_column($d['rules'] ?? [], 'id'), [7, 5, 4, 3], 'I: ordered by product_type, material, size_type, size; the inactive row is absent');
$row3 = array_values(array_filter($d['rules'] ?? [], fn ($x) => $x['id'] === 3))[0] ?? [];
ok(($row3['diameter'] ?? null) === 10.9 && ($row3['active'] ?? null) === '1' && ($row3['is_active'] ?? null) === 1 && ($row3['sizeType'] ?? null) === 'UNDERSIZE',
   'I: types as the page receives them (float diameter, string active, int is_active)');
$row4 = array_values(array_filter($d['rules'] ?? [], fn ($x) => $x['id'] === 4))[0] ?? [];
ok(($row4['sizeType'] ?? null) === '' && ($row4['size_type'] ?? null) === '', 'I: a NULL size_type is the empty string, as in api.php');
eq($d['ruleCount'] ?? null, 4, 'I: ruleCount');
$V1 = $d['version'] ?? '';
eq($V1, 'ds1-' . substr(hash('sha256', $apiRowsJson), 0, 16), 'I: version = "ds1-" + first 16 hex of SHA-256 over the rows JSON (recomputed here from api.php\'s output)');
ok(preg_match('/^ds1-[0-9a-f]{16}$/', $V1) === 1, 'I: version format');
eq(call('diameter_settings.get')['json']['data']['version'] ?? null, $V1, 'I: version is STABLE across calls');
eq(call('diameter_settings.get', [], ['actor' => ['sub' => 8, 'username' => 'seconduser']])['json']['data']['version'] ?? null, $V1, 'I: …and across users');
eq([$snapshot('diameter_settings'), $checksum('diameter_settings')], $DIAM_BEFORE, 'I: reading changed nothing');

$q->query('UPDATE diameter_settings SET diameter = 10.850 WHERE id = 3');
$r2 = call('diameter_settings.get');
$V2 = $r2['json']['data']['version'] ?? '';
ok($V2 !== '' && $V2 !== $V1, 'I: version CHANGES when a row\'s diameter changes');
ok(($r2['json']['data']['rules'] ?? null) === json_decode($apiOutput(), true)['data'], 'I: and the rows still equal api.php\'s');
$q->query('UPDATE diameter_settings SET diameter = 10.900 WHERE id = 3');
eq(call('diameter_settings.get')['json']['data']['version'] ?? null, $V1, 'I: version returns to the first value when the row is put back (it is a content hash)');
$q->query('UPDATE diameter_settings SET is_active = 1 WHERE id = 6');
$r3 = call('diameter_settings.get');
ok(($r3['json']['data']['version'] ?? $V1) !== $V1 && ($r3['json']['data']['ruleCount'] ?? 0) === 5, 'I: activating a rule changes the version and the count');
$q->query('UPDATE diameter_settings SET is_active = 0 WHERE id = 6');
$q->query("INSERT INTO diameter_settings (id, product_type, material, size_type, size, diameter, is_active) VALUES (8, 'zrod', 'MS', 'FULL', 'M8', 8.000, 1)");
ok((call('diameter_settings.get')['json']['data']['version'] ?? $V1) !== $V1, 'I: adding a rule changes the version');
$q->query('DELETE FROM diameter_settings WHERE id = 8');
$q->query('ALTER TABLE diameter_settings AUTO_INCREMENT = 8');
eq(call('diameter_settings.get')['json']['data']['version'] ?? null, $V1, 'I: and removing it restores the version');
/* An empty table is a valid answer; a missing table is not. */
$q->query('RENAME TABLE diameter_settings TO diameter_settings_gone');
refused(call('diameter_settings.get'), 503, 'quo_unavailable', 'I: table missing → 503 quo_unavailable (never an empty rule list)');
$q->query('RENAME TABLE diameter_settings_gone TO diameter_settings');

// ══ J · companies.search ═══════════════════════════════════════════════════
$search = fn ($p) => call('companies.search', $p);
$names = fn ($r) => array_column($r['json']['data']['companies'] ?? [], 'name');
$r = $search(['q' => 'example']);
eq($r['status'], 200, 'J: companies.search → 200');
eq($names($r), ['Example Steel Works', 'Example Trading Sdn Bhd'], 'J: MATCH by name, case-insensitive, "contains", ordered by name');
eq($r['json']['data']['companies'][1] ?? null,
   ['id' => 901, 'name' => 'Example Trading Sdn Bhd', 'shortCode' => 'EXT', 'quotationCount' => 3, 'lastQuotationDate' => '2099-02-10'],
   'J: fields are exactly id, name, shortCode, quotationCount, lastQuotationDate (counters as get_companies computes them)');
eq($r['json']['data']['companies'][0] ?? null,
   ['id' => 902, 'name' => 'Example Steel Works', 'shortCode' => null, 'quotationCount' => 0, 'lastQuotationDate' => null],
   'J: a company with no quotations and no short code');
eq($r['json']['data']['truncated'] ?? null, false, 'J: not truncated');
ok(strpos($r['body'], 'phone') === false && strpos($r['body'], 'address') === false && strpos($r['body'], '60000000091') === false && strpos($r['body'], 'Fake Street') === false,
   'J: NO phone and NO address in the response');
eq($names($search(['q' => 'EXZ'])), ['Zeta Fasteners'], 'J: match by short code');
eq($names($search(['q' => 'ex'])), ['Example Steel Works', 'Example Trading Sdn Bhd', 'Zeta Fasteners'], 'J: name OR short code');
eq($names($search(['q' => '  steel  '])), ['Example Steel Works'], 'J: the query is trimmed');
$r = $search(['q' => 'no such company anywhere']);
eq([$r['status'], $r['json']['data'] ?? null], [200, ['companies' => [], 'truncated' => false]], 'J: NO MATCH → 200 with an empty list');
/* LIKE wildcards are literal. */
eq($names($search(['q' => '100%'])), ['Sample 100% Hardware'], 'J: "%" is a literal percent sign');
eq($names($search(['q' => '%%'])), [], 'J: "%%" matches nothing — it is not "everything"');
eq($names($search(['q' => '__'])), [], 'J: "__" matches nothing — it is not "any two characters"');
eq($names($search(['q' => 'e_Under'])), ['Sample_Underscore Co'], 'J: "_" is a literal underscore');
eq($names($search(['q' => 'Sample%Hardware'])), [], 'J: "%" in the middle does not act as a wildcard');
eq($names($search(['q' => 'e|B'])), ['Pipe|Bar Fixtures'], 'J: the escape character itself is literal');
eq($names($search(['q' => "' OR '1'='1"])), [], 'J: a quote-laden query is just text (bound parameter)');
eq($names($search(['q' => 'x\\'])), [], 'J: a trailing backslash is just text');
/* limit */
$r = $search(['q' => 'Bulk Fake']);
eq([count($names($r)), $r['json']['data']['truncated'] ?? null], [20, true], 'J: LIMIT defaults to 20; 30 matches → truncated');
eq($names($r)[0] ?? null, 'Bulk Fake Customer 01', 'J: …in name order');
$r = $search(['q' => 'Bulk Fake', 'limit' => 5]);
eq([count($names($r)), $r['json']['data']['truncated'] ?? null], [5, true], 'J: limit 5 → 5 rows, truncated');
$r = $search(['q' => 'Bulk Fake', 'limit' => 50]);
eq([count($names($r)), $r['json']['data']['truncated'] ?? null], [30, false], 'J: limit 50 → all 30, not truncated');
$r = $search(['q' => 'Bulk Fake', 'limit' => 30]);
eq([count($names($r)), $r['json']['data']['truncated'] ?? null], [30, false], 'J: limit exactly the number of matches → not truncated');
foreach ([['q' => 'e'], ['q' => ' e '], ['q' => ''], ['q' => str_repeat('a', 101)], ['q' => 7], ['q' => ['a', 'b']], []] as $bad) {
    $r = $search($bad);
    eq([$r['status'], code_of($r), $r['json']['error']['field'] ?? null], [422, 'validation_failed', 'q'], 'J: q ' . json_encode($bad) . ' → 422 validation_failed (field q)');
}
foreach ([0, 51, -1, '5', 5.5, 1000000] as $bad) {
    $r = $search(['q' => 'Bulk', 'limit' => $bad]);
    eq([$r['status'], code_of($r), $r['json']['error']['field'] ?? null], [422, 'validation_failed', 'limit'], 'J: limit ' . json_encode($bad) . ' → 422 (field limit)');
}
eq([$snapshot('companies'), $checksum('companies')], $COMPANIES_BEFORE, 'J: searching changed nothing in companies');

// ══ K · contacts.lookup, empty ═════════════════════════════════════════════
$lookup = fn ($p) => call('contacts.lookup', $p);
$r = $lookup(['waPhone' => '60000000001', 'waChatId' => null, 'chatKind' => 'individual']);
eq([$r['status'], $r['json']['data'] ?? null], [200, ['status' => 'none']], 'K: lookup with no link → status none (ZERO)');

// ══ L · contacts.link ══════════════════════════════════════════════════════
$link = fn ($p, $o = []) => call('contacts.link', $p, $o);
$cc = fn () => (int)one($q, 'SELECT COUNT(*) FROM company_whatsapp_contacts');
$r = $link(['companyId' => 901, 'waPhone' => '+60 00-000 0001', 'waChatId' => null, 'chatKind' => 'individual', 'displayName' => 'Example Buyer']);
eq($r['status'], 200, 'L: HAPPY PATH → 200');
eq($r['json']['data'] ?? null, ['contactId' => 1, 'created' => true, 'company' => ['id' => 901, 'name' => 'Example Trading Sdn Bhd', 'shortCode' => 'EXT']],
   'L: contactId, created:true and the company (id, name, shortCode only)');
$row = $q->query('SELECT * FROM company_whatsapp_contacts WHERE id = 1')->fetch_assoc();
eq([$row['company_id'], $row['wa_phone'], $row['wa_chat_id'], $row['display_name'], $row['is_active'], $row['source'], $row['linked_by_user_id'], $row['linked_by_username'], $row['last_matched_at']],
   ['901', '60000000001', null, 'Example Buyer', '1', 'qq', '7', 'exampleuser', null],
   'L: the row: normalized phone, who linked it (canonical user id + username), source qq');
ok(abs(strtotime($row['created_at'] . ' +08:00') - time()) < 120, 'L: …and when (created_at, Malaysia time like every other QUO row)');

$r = $link(['companyId' => 901, 'waPhone' => '60000000001', 'chatKind' => 'individual', 'displayName' => 'A Different Label']);
eq([$r['status'], $r['json']['data'] ?? null], [200, ['contactId' => 1, 'created' => false, 'company' => ['id' => 901, 'name' => 'Example Trading Sdn Bhd', 'shortCode' => 'EXT']]],
   'L: IDEMPOTENT REPEAT → 200, the same contactId, created:false');
eq($cc(), 1, 'L: no duplicate row');
eq($q->query('SELECT * FROM company_whatsapp_contacts WHERE id = 1')->fetch_assoc(), $row, 'L: and the existing row is untouched (label, linker and timestamps included)');
$r = $link(['companyId' => 901, 'waPhone' => '60000000001', 'chatKind' => 'individual'], ['actor' => ['sub' => 8, 'username' => 'seconduser']]);
eq([$r['json']['data']['created'] ?? null, $cc()], [false, 1], 'L: repeated by another user → still one row');
eq($q->query('SELECT linked_by_user_id FROM company_whatsapp_contacts WHERE id = 1')->fetch_row()[0], '7', 'L: …and the original linker is kept');

$r = $link(['companyId' => 902, 'waPhone' => '60000000001', 'chatKind' => 'individual'], ['actor' => ['sub' => 8, 'username' => 'seconduser']]);
eq([$r['status'], $r['json']['data']['created'] ?? null, $r['json']['data']['company'] ?? null], [200, true, ['id' => 902, 'name' => 'Example Steel Works', 'shortCode' => null]],
   'L: SAME CONTACT TO A SECOND COMPANY → allowed, a new row');
eq($cc(), 2, 'L: two rows now');
eq($q->query('SELECT linked_by_user_id, linked_by_username FROM company_whatsapp_contacts WHERE company_id = 902')->fetch_row(), ['8', 'seconduser'], 'L: recorded under the user who made it');
$r = $link(['companyId' => 901, 'waPhone' => '60000000002', 'chatKind' => 'individual']);
eq([$r['json']['data']['created'] ?? null, $cc()], [true, 3], 'L: a second contact for the same company → allowed (one company, many contacts)');
$r = $link(['companyId' => 903, 'waPhone' => null, 'waChatId' => '000000000000001@lid', 'chatKind' => 'individual']);
eq([$r['status'], $r['json']['data']['created'] ?? null], [200, true], 'L: a hidden-number chat links by its stable chat id alone');
$r = $link(['companyId' => 903, 'waChatId' => '000000000000001@lid', 'chatKind' => 'individual']);
eq([$r['json']['data']['created'] ?? null, $cc()], [false, 4], 'L: …idempotently');

$n = $cc();
foreach ([
    'NAME ONLY (display name, no phone, no chat id)' => [['companyId' => 901, 'displayName' => 'Example Buyer', 'chatKind' => 'individual'], 'waPhone'],
    'name only with explicit nulls'                  => [['companyId' => 901, 'waPhone' => null, 'waChatId' => null, 'displayName' => 'Example Buyer', 'chatKind' => 'individual'], 'waPhone'],
    'GROUP chat (chatKind group)'                    => [['companyId' => 901, 'waPhone' => '60000000003', 'chatKind' => 'group'], 'chatKind'],
    'GROUP chat (an @g.us id sent as individual)'    => [['companyId' => 901, 'waChatId' => '000000000000000001@g.us', 'chatKind' => 'individual'], 'chatKind'],
    'chatKind unknown'                               => [['companyId' => 901, 'waPhone' => '60000000003', 'chatKind' => 'unknown'], 'chatKind'],
    'chatKind missing'                               => [['companyId' => 901, 'waPhone' => '60000000003'], 'chatKind'],
    'a display name sent as the phone'               => [['companyId' => 901, 'waPhone' => 'Example Buyer', 'chatKind' => 'individual'], 'waPhone'],
    'a local number with a leading zero'             => [['companyId' => 901, 'waPhone' => '0123456789', 'chatKind' => 'individual'], 'waPhone'],
    'a display name sent as the chat id'             => [['companyId' => 901, 'waChatId' => 'Example Buyer', 'chatKind' => 'individual'], 'waChatId'],
    'companyId missing'                              => [['waPhone' => '60000000003', 'chatKind' => 'individual'], 'companyId'],
    'companyId as a string'                          => [['companyId' => '901', 'waPhone' => '60000000003', 'chatKind' => 'individual'], 'companyId'],
    'companyId zero'                                 => [['companyId' => 0, 'waPhone' => '60000000003', 'chatKind' => 'individual'], 'companyId'],
    'displayName not a string'                       => [['companyId' => 901, 'waPhone' => '60000000003', 'chatKind' => 'individual', 'displayName' => ['x']], 'displayName'],
] as $what => [$params, $field]) {
    $r = $link($params);
    eq([$r['status'], code_of($r), $r['json']['error']['field'] ?? null], [422, 'validation_failed', $field], "L: $what → 422 validation_failed (field $field)");
}
$r = $link(['companyId' => 99999, 'waPhone' => '60000000003', 'chatKind' => 'individual']);
eq([$r['status'], code_of($r)], [404, 'not_found'], 'L: UNKNOWN COMPANY → 404 not_found');
eq($cc(), $n, 'L: none of the refused requests wrote a row');

/* A stored identifier is never replaced. */
$r = $link(['companyId' => 903, 'waPhone' => '60000000004', 'waChatId' => '000000000000001@lid', 'chatKind' => 'individual']);
eq([$r['status'], $r['json']['data']['created'] ?? null, $cc()], [200, false, $n], 'L: an existing chat-id link sent again with a phone → confirmed; nothing written, nothing filled in');
eq($q->query("SELECT wa_phone FROM company_whatsapp_contacts WHERE company_id = 903")->fetch_row()[0], null, 'L: …the stored row keeps its NULL phone (no UPDATE exists)');
$q->query("INSERT INTO company_whatsapp_contacts (company_id, wa_phone, wa_chat_id) VALUES (904, '60000000005', '000000000000005@lid')");
$r = $link(['companyId' => 904, 'waPhone' => '60000000005', 'waChatId' => '000000000000009@lid', 'chatKind' => 'individual']);
eq([$r['status'], code_of($r), $r['json']['error']['reason'] ?? null], [409, 'contact_conflict', 'identifier_mismatch'],
   'L: same phone but a DIFFERENT chat id than stored → 409 contact_conflict, nothing written');
$q->query("INSERT INTO company_whatsapp_contacts (company_id, wa_phone, is_active) VALUES (905, '60000000006', 0)");
$r = $link(['companyId' => 905, 'waPhone' => '60000000006', 'chatKind' => 'individual']);
eq([$r['status'], code_of($r), $r['json']['error']['reason'] ?? null], [409, 'contact_conflict', 'inactive'], 'L: a deactivated link is not silently re-activated → 409 contact_conflict (inactive)');
eq((int)one($q, 'SELECT is_active FROM company_whatsapp_contacts WHERE company_id = 905'), 0, 'L: …and stays deactivated');
eq($cc(), $n + 2, 'L: only the two rows this test inserted directly were added');

eq([$snapshot('companies'), $checksum('companies')], $COMPANIES_BEFORE,
   'L: PROOF — every companies row is byte-identical before and after all linking (SHA-256 of all rows incl. phone and updated_at, row count, CHECKSUM TABLE)');
eq([$snapshot('quotations'), $checksum('quotations')], $QUOTES_BEFORE, 'L: quotations byte-identical too');

// ══ K2 · contacts.lookup, one and many ═════════════════════════════════════
$r = $lookup(['waPhone' => '60000000002', 'chatKind' => 'individual']);
eq([$r['status'], $r['json']['data'] ?? null], [200, ['status' => 'single', 'contactId' => 3, 'company' => ['id' => 901, 'name' => 'Example Trading Sdn Bhd', 'shortCode' => 'EXT']]],
   'K: one link → status single (ONE) with contactId and company');
$r = $lookup(['waPhone' => '+60 00 000 0001', 'chatKind' => 'individual']);
eq($r['json']['data']['status'] ?? null, 'ambiguous', 'K: a contact linked to two companies → status ambiguous (MANY)');
eq($r['json']['data']['candidates'] ?? null, [
    ['contactId' => 1, 'company' => ['id' => 901, 'name' => 'Example Trading Sdn Bhd', 'shortCode' => 'EXT'], 'lastUsedAt' => null],
    ['contactId' => 2, 'company' => ['id' => 902, 'name' => 'Example Steel Works', 'shortCode' => null], 'lastUsedAt' => null],
], 'K: both candidates, each with contactId, company and lastUsedAt');
ok(strpos($r['body'], '60000000091') === false && strpos($r['body'], 'address') === false, 'K: no company phone or address in a lookup');
eq($lookup(['waChatId' => '000000000000001@lid', 'chatKind' => 'individual'])['json']['data']['company']['id'] ?? null, 903, 'K: lookup by chat id alone');
eq($lookup(['waPhone' => '60000000007', 'waChatId' => '000000000000001@lid', 'chatKind' => 'unknown'])['json']['data']['status'] ?? null, 'single', 'K: either identifier may match');
eq($lookup(['waPhone' => '60000000001', 'chatKind' => 'group'])['json']['data'] ?? null, ['status' => 'none'], 'K: a group chat is always none, even for a linked number');
eq($lookup(['waPhone' => null, 'waChatId' => null, 'chatKind' => 'individual'])['json']['data'] ?? null, ['status' => 'none'], 'K: no identifier → none');
eq($lookup(['chatKind' => 'individual', 'displayName' => 'Example Buyer'])['json']['data'] ?? null, ['status' => 'none'], 'K: a display name is never an identity → none');
eq($lookup(['waPhone' => '60000000006', 'chatKind' => 'individual'])['json']['data'] ?? null, ['status' => 'none'], 'K: a deactivated link does not match');
$r = $lookup(['waPhone' => 'not a phone', 'chatKind' => 'individual']);
eq([$r['status'], code_of($r)], [422, 'validation_failed'], 'K: a malformed phone → 422');
/* A link whose company is gone never matches (no foreign key; the JOIN does it). */
$q->query("INSERT INTO company_whatsapp_contacts (company_id, wa_phone) VALUES (777777, '60000000008')");
eq($lookup(['waPhone' => '60000000008', 'chatKind' => 'individual'])['json']['data'] ?? null, ['status' => 'none'], 'K: an orphaned link (company deleted) never matches');
/* Most recently used first, when something has set last_matched_at. */
$q->query("UPDATE company_whatsapp_contacts SET last_matched_at = '2099-05-01 12:00:00' WHERE id = 2");
$r = $lookup(['waPhone' => '60000000001', 'chatKind' => 'individual']);
eq(array_column($r['json']['data']['candidates'] ?? [], 'contactId'), [2, 1], 'K: candidates are ordered most recently used first');
eq($r['json']['data']['candidates'][0]['lastUsedAt'] ?? null, '2099-05-01T04:00:00Z', 'K: lastUsedAt is ISO 8601 UTC (stored as Malaysia time)');
/* PURE READ. */
$contactsBefore = $snapshot('company_whatsapp_contacts');
$lookup(['waPhone' => '60000000001', 'chatKind' => 'individual']);
$lookup(['waPhone' => '60000000002', 'waChatId' => '000000000000777@lid', 'chatKind' => 'individual']);
eq($snapshot('company_whatsapp_contacts'), $contactsBefore, 'K: lookup is a PURE READ — no identifier filled in, last_matched_at untouched, no row changed');
eq([$snapshot('companies'), $checksum('companies')], $COMPANIES_BEFORE, 'K: companies byte-identical after lookups');

// ══ N · containment: nothing leaks when the layer underneath fails ═════════
file_put_contents("$SB/db.php", $dbPhp($QDB, 1));      // nothing listens on port 1: getDB() prints the driver text and die()s
$r = call('ping');
refused($r, 503, 'quo_unavailable', 'N: Quotation database unreachable (legacy getDB() die()s) → 503 quo_unavailable');
ok(stripos($r['body'], 'connection') === false && stripos($r['body'], 'mysqli') === false && stripos($r['body'], 'Warning') === false && strpos($r['body'], $U . '@') === false,
   'N: …and none of the driver\'s text, PHP warnings or the DB user reaches the caller');
eq(array_keys($r['json'] ?? []), ['ok', 'error', 'meta'], 'N: the body is the one generic envelope and nothing else');
file_put_contents("$SB/db.php", $dbPhp($QDB, $P));
eq(call('ping')['status'], 200, 'N: back to normal');

// ══ O · key rotation and the off switch ════════════════════════════════════
$writeConf(array_merge($CONF, ['QQ_SERVICE_SECRET' => $OLDSECRET === $SECRET ? $SECRET : 'base64:' . base64_encode($NEWKEY = random_bytes(32)), 'QQ_SERVICE_SECRET_PREVIOUS' => $SECRET]));
eq(call('ping')['status'], 200, 'O: during a rotation a request signed with the PREVIOUS key is accepted');
eq(call('ping', [], ['key' => $NEWKEY])['status'], 200, 'O: …and one signed with the new current key');
$writeConf(array_merge($CONF, ['QQ_SERVICE_SECRET' => 'base64:' . base64_encode($NEWKEY)]));
refused(call('ping'), 401, 'invalid_signature', 'O: once the previous key is removed, the old key is refused');
$writeConf(array_merge($CONF, ['QQ_SERVICE_ENABLED' => 'false']));
refused(call('ping'), 404, 'not_available', 'O: QQ_SERVICE_ENABLED=false turns the door off at once');
refused(call('contacts.link', ['companyId' => 901, 'waPhone' => '60000000009', 'chatKind' => 'individual']), 404, 'not_available', 'O: …for every action');
$writeConf(null);
refused(call('ping'), 404, 'not_available', 'O: and so does deleting service_config.php');
$writeConf($CONF);
eq(call('ping')['status'], 200, 'O: on again');

// ══ P · nothing secret, nothing browser-ish, in any response or log line ════
$all = implode("\n", $SEEN);
ok(count($SEEN) > 150, 'P: ' . count($SEEN) . ' responses examined');
$needles = [$SECRET, substr($SECRET, 7), $KEY, bin2hex($KEY), rtrim(strtr(substr($SECRET, 7), '+/', '-_'), '='),
            'base64:' . base64_encode($NEWKEY), $NEWKEY, bin2hex($NEWKEY), $DNC['DNC_HANDOFF_SECRET'], $RO_PASS, $RO_USER];
$leaks = []; foreach ($needles as $i => $s) if ($s !== '' && strpos($all, $s) !== false) $leaks[] = "needle #$i";
eq($leaks, [], 'P: NO RESPONSE CONTAINS THE SECRET (any encoding), the previous key, the handoff secret or the users-DB credentials');
$sigLeaks = 0; foreach (array_unique($SIGS) as $s) if (strlen($s) >= 20 && strpos($all, $s) !== false) $sigLeaks++;
eq($sigLeaks, 0, 'P: no response echoes a signature');
ok(stripos($all, 'Set-Cookie') === false, 'P: no response sets a cookie');
ok(stripos($all, 'Access-Control-') === false, 'P: no response carries a CORS header');
ok(stripos($all, 'PHPSESSID') === false && stripos($all, 'DCQUOSESS') === false, 'P: no session of any kind');
ok(preg_match('/SELECT |INSERT |FROM companies|mysqli|Stack trace|Fatal error|Warning:|Notice:|Deprecated:|\.php on line/i', $all) === 0, 'P: no SQL, driver text or PHP diagnostics in any response');
ok(strpos($all, 'Injected Fake Co') === false, 'P: request content is never echoed back');
$bad = 0; foreach ($SEEN as $raw) { $b = explode("\r\n\r\n", $raw, 2)[1] ?? ''; if ($b !== '') { $j = json_decode($b, true); if (!is_array($j) || !isset($j['ok'], $j['meta'])) $bad++; } }
eq($bad, 0, 'P: every non-empty response body is the JSON envelope {ok, data|error, meta}');

$log = is_file($LOGFILE) ? (string)file_get_contents($LOGFILE) : '';
$svcLines = array_values(array_filter(array_map(fn ($l) => preg_replace('/^\[[^\]]+\] /', '', $l), explode("\n", $log)), fn ($l) => strpos($l, '[service]') === 0));
ok(count($svcLines) > 100, 'P: the server log has service lines (' . count($svcLines) . ')');
ok(count(array_filter($svcLines, fn ($l) => !preg_match('/^\[service\] [a-z_.]+( [a-z]+=[A-Za-z0-9_.:\-\\\\]+)*$/', rtrim($l)))) === 0, 'P: every service log line is an event plus key=code pairs');
$logLeaks = []; foreach (array_merge($needles, ['60000000001', 'Example Buyer', 'exampleuser', 'Example Trading']) as $i => $s) if ($s !== '' && strpos($log, $s) !== false) $logLeaks[] = "needle #$i";
eq($logLeaks, [], 'P: no secret, credential, phone number, user name or company name in the server log');
$sigLeaks = 0; foreach (array_unique($SIGS) as $s) if (strlen($s) >= 20 && strpos($log, $s) !== false) $sigLeaks++;
eq($sigLeaks, 0, 'P: no signature in the server log');
ok(preg_match('/PHP (Warning|Notice|Deprecated|Fatal)/', preg_replace('/^.*mysqli::__construct\(\).*$/m', '', $log)) === 0,
   'P: the service code raised no PHP warning, notice or deprecation (the test db.php\'s own failed connect aside)');

/* Final state of the tables this door may never change. */
eq([$snapshot('companies'), $checksum('companies')], $COMPANIES_BEFORE, 'P: FINAL — companies byte-identical to the start of the run');
eq([$snapshot('quotations'), $checksum('quotations')], $QUOTES_BEFORE, 'P: FINAL — quotations byte-identical');
eq([$snapshot('diameter_settings'), $checksum('diameter_settings')], $DIAM_BEFORE, 'P: FINAL — diameter_settings byte-identical');
eq((int)one($q, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='{$QDB}'"), 5, 'P: FINAL — still exactly five tables; the service created none');

}   // if ($up)

// ── report ──────────────────────────────────────────────────────────────────
if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    $label  ($asserts assertions)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
