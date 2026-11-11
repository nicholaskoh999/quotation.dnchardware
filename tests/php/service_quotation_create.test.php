<?php
/**
 * ── Service API — whatsapp_template.get, quotations.create, quotations.lookup_by_key
 *    over REAL HTTP against REAL MySQL (QQ R1 Loop #7) ──────────────────────
 *
 *   DC_SERVICE_TEST_DB_HOST=127.0.0.1 DC_SERVICE_TEST_DB_PORT=33191 \
 *   DC_SERVICE_TEST_DB_USER=root DC_SERVICE_TEST_DB_PASS= \
 *   php tests/php/service_quotation_create.test.php
 *
 * SKIPPED (exit 0, "SKIP") without DC_SERVICE_TEST_DB_HOST/PORT — a skip is not
 * a pass. THROWAWAY MySQL only: it creates and drops two schemas and one user.
 * Needs node (items are built by QUO's own quote core: quotation_create/build-items.js).
 *
 * The shipped service files are copied byte for byte into a sandbox and served
 * by FOUR PHP built-in servers on 127.0.0.1 (php -S handles one request at a
 * time; four servers make the parallel same-key test truly parallel). Requests
 * are signed here with PHP primitives (docs/SERVICE-API.md §3).
 *
 *   M  the three Loop #5/#6 migrations: forward, again, rollback, forward
 *   T  whatsapp_template.get: no table, no row, saved, empty body; parity with api.php
 *   C  quotations.create: switch, happy path, read-back, actor on the revision, replay,
 *      same key other payload, 4 parallel same key, 2 keys → consecutive numbers,
 *      stale settings, core mismatch, unknown company, client ref_no / item_uid,
 *      totals mismatch, price source, omitted lines, lock timeout, forced failure
 *      before commit, disabled user
 *   L  quotations.lookup_by_key: found, not found, another user's key
 * ALL DATA IS SYNTHETIC.
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);
$label = 'service API — quotation create, template, lookup over HTTP, real MySQL';
$H = getenv('DC_SERVICE_TEST_DB_HOST'); $P = getenv('DC_SERVICE_TEST_DB_PORT');
if ($H === false || $H === '' || $P === false || $P === '') {
    echo "\n  SKIP  $label\n\n   - NOT RUN: DC_SERVICE_TEST_DB_HOST and DC_SERVICE_TEST_DB_PORT are not set. A skip is not a pass.\n\n";
    exit(0);
}
$P = (int)$P; $U = getenv('DC_SERVICE_TEST_DB_USER') ?: 'root'; $W = getenv('DC_SERVICE_TEST_DB_PASS'); if ($W === false) $W = '';

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true) . "\n      actual:   " . var_export($actual, true));
}

mysqli_report(MYSQLI_REPORT_OFF);
$root = @new mysqli($H, $U, $W, null, $P);
if (!$root || $root->connect_errno) { echo "\n  FAIL  $label — database unreachable\n\n"; exit(1); }
$server = $root->query('SELECT VERSION()')->fetch_row()[0];
$PID = getmypid(); $QDB = "dc_qc_q_{$PID}"; $UDB = "dc_qc_u_{$PID}"; $RO_USER = "dc_qc_ro_{$PID}"; $RO_PASS = bin2hex(random_bytes(12));
foreach ([$QDB, $UDB] as $d) { $ex = $root->query("SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$d}'"); if ($ex && $ex->num_rows) { echo "\n  FAIL  {$d} exists\n\n"; exit(1); } }
$SB = sys_get_temp_dir() . "/dc-qc-sb-{$PID}";
$SRV = [];
register_shutdown_function(function () use ($root, $QDB, $UDB, $RO_USER, $SB, &$SRV) {
    foreach ($SRV as $s) if (is_resource($s)) { proc_terminate($s); proc_close($s); }
    usleep(300000);
    $root->query("DROP DATABASE IF EXISTS {$QDB}"); $root->query("DROP DATABASE IF EXISTS {$UDB}"); $root->query("DROP USER IF EXISTS '{$RO_USER}'@'%'");
    if (is_dir($SB)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($SB, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        @rmdir($SB);
    }
});
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
function one(mysqli $db, string $sql) { $r = $db->query($sql); if (!$r) return null; $row = $r->fetch_row(); return $row[0] ?? null; }

// ══ schema ═════════════════════════════════════════════════════════════════
foreach ([$QDB, $UDB] as $d) $root->query("CREATE DATABASE {$d} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
$q = new mysqli($H, $U, $W, $QDB, $P); $q->set_charset('utf8mb4'); $q->query("SET time_zone = '+08:00'");
$q->query("CREATE TABLE companies (id int NOT NULL AUTO_INCREMENT, name varchar(200) NOT NULL, short_code varchar(50) DEFAULT NULL, phone varchar(100) DEFAULT NULL,
           address text, created_at datetime DEFAULT CURRENT_TIMESTAMP, updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB");
/* The columns save_quotation writes (as tests/php/quotation_store_db.test.php builds them). */
$q->query("CREATE TABLE quotations (id INT NOT NULL AUTO_INCREMENT, company_id INT NULL,
    ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    quote_date DATE NULL, valid_until DATE NULL, prepared_by VARCHAR(100) NULL, remarks TEXT NULL,
    customer_name VARCHAR(200) NULL, customer_phone VARCHAR(50) NULL, items LONGTEXT NULL, total_amount DECIMAL(12,2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
$q->query("CREATE TABLE diameter_settings (id int NOT NULL AUTO_INCREMENT, product_type varchar(50) NOT NULL, material varchar(50) NOT NULL, size_type varchar(50) DEFAULT NULL,
           size varchar(50) NOT NULL, diameter decimal(10,3) NOT NULL, is_active tinyint(1) NOT NULL DEFAULT '1', PRIMARY KEY (id)) ENGINE=InnoDB");
$section = function ($file, $name = 'SECTION 2') use ($ROOT) {
    preg_match('/-- >>> ' . $name . ' BEGIN\s*(.*?)\s*-- <<< ' . $name . ' END/s', (string)file_get_contents("$ROOT/migrations/$file"), $m); return $m[1] ?? '';
};
eq(run_script($q, $section('2026-08-28-create-quotation-revisions.sql')), [0, ''], 'schema: quotation_revisions from its shipped migration');

// ══ M · the three migrations: forward, again, rollback, forward ════════════
$MIGS = ['2026-11-10-create-service-request-nonces' => 'service_request_nonces', '2026-11-10-create-company-whatsapp-contacts' => 'company_whatsapp_contacts',
         '2026-11-11-create-quotation-create-requests' => 'quotation_create_requests'];
$ddl = fn ($t) => ($r = $q->query("SHOW CREATE TABLE $t")) ? $r->fetch_row()[1] : null;
$first = [];
foreach ($MIGS as $m => $t) { eq(run_script($q, $section("$m.sql")), [0, ''], "M: $m forward"); $first[$t] = $ddl($t); ok($first[$t] !== null, "M: …$t exists"); }
foreach ($MIGS as $m => $t) { eq(run_script($q, $section("$m.sql")), [0, ''], "M: $m again (no-op)"); eq($ddl($t), $first[$t], "M: …$t unchanged"); }
foreach ($MIGS as $m => $t) {
    $rb = $section("$m.rollback.sql", 'ROLLBACK');
    ok($rb !== '', "M: $m rollback block found");
    eq(run_script($q, $rb)[0], 0, "M: $m rollback (empty table)");
    eq((int)one($q, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='{$QDB}' AND TABLE_NAME='{$t}'"), 0, "M: …$t dropped");
}
foreach ($MIGS as $m => $t) { eq(run_script($q, $section("$m.sql")), [0, ''], "M: $m forward again"); eq($ddl($t), $first[$t], "M: …$t identical to the first time"); }

// ══ data ═══════════════════════════════════════════════════════════════════
$q->query("INSERT INTO companies (id, name, short_code, phone, address) VALUES (901, 'Example Trading Sdn Bhd', 'EXT', '+60000000091', '1 Fake Street'),
           (902, 'Example Steel Works', NULL, NULL, NULL)");
$q->query("INSERT INTO diameter_settings (id, product_type, material, size_type, size, diameter, is_active) VALUES (3, 'sagrod', 'MS', 'UNDERSIZE', 'M12', 10.900, 1), (4, 'stud', 'MS', NULL, 'M16', 16.000, 1)");
$q->query("INSERT INTO company_whatsapp_contacts (company_id, wa_phone, source) VALUES (901, '60000000001', 'qq'), (902, '60000000002', 'qq')");
$root->query("CREATE TABLE {$UDB}.users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(255) NOT NULL, username VARCHAR(20) NOT NULL, role VARCHAR(16) NOT NULL DEFAULT 'member',
    password VARCHAR(255) NOT NULL, must_change_password TINYINT(1) NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1, is_legacy_placeholder TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id), UNIQUE KEY users_username_unique (username)) ENGINE=InnoDB");
$root->query("INSERT INTO {$UDB}.users (id, name, username, password) VALUES (7, 'Example User', 'exampleuser', 'x'), (8, 'Second Example', 'seconduser', 'x')");
$root->query("CREATE USER '{$RO_USER}'@'%' IDENTIFIED BY '{$RO_PASS}'");
$root->query("GRANT SELECT ON {$UDB}.users TO '{$RO_USER}'@'%'");

/* Items built by QUO's own quote core (Manual Price). */
$ITEMS = json_decode((string)shell_exec('node ' . escapeshellarg("$ROOT/tests/php/quotation_create/build-items.js")), true);
ok(is_array($ITEMS) && count($ITEMS) === 2, 'data: two items built by quo-quote-core.js (node)');
$TOTAL = round(array_sum(array_column($ITEMS, 'totalAmount')), 2);

// ══ sandbox + four servers ═════════════════════════════════════════════════
@mkdir("$SB/app/Handoff/Contract", 0777, true);
$SHIPPED = ['service.php', 'service_auth.php', 'service_actions.php', 'service_quotations.php', 'quotation_store.php', 'dnc_handoff.php', 'auth.php',
            'quo-parser-core.js', 'quo-pricing-core.js', 'quo-quote-core.js', 'app/Handoff/Contract/HandoffToken.php', 'app/Handoff/Contract/InvalidHandoffToken.php'];
foreach ($SHIPPED as $f) copy("$ROOT/$f", "$SB/$f");
file_put_contents("$SB/db.php", "<?php function getDB(){ \$d = new mysqli(" . var_export($H, true) . ',' . var_export($U, true) . ',' . var_export($W, true) . ','
    . var_export($QDB, true) . ",{$P}); if (\$d->connect_error) { die('x'); } \$d->set_charset('utf8mb4'); return \$d; }\n");
file_put_contents("$SB/dnc_config.php", '<?php return ' . var_export(['DNC_HANDOFF_ENABLED' => 'false', 'DNC_HANDOFF_SECRET' => 'base64:' . base64_encode(random_bytes(32)),
    'DNC_USERS_DB_HOST' => $H, 'DNC_USERS_DB_PORT' => (string)$P, 'DNC_USERS_DB_DATABASE' => $UDB, 'DNC_USERS_DB_USERNAME' => $RO_USER, 'DNC_USERS_DB_PASSWORD' => $RO_PASS], true) . ';');
$KEY = random_bytes(32);
$CONF = ['QQ_SERVICE_ENABLED' => 'true', 'QQ_SERVICE_KEY_ID' => 'qq-backend-1', 'QQ_SERVICE_SECRET' => 'base64:' . base64_encode($KEY), 'QQ_SERVICE_NONCE_PRUNE_EVERY' => 0];
$writeConf = function (array $extra = []) use ($SB, $CONF) { file_put_contents("$SB/service_config.php", '<?php return ' . var_export($extra + $CONF, true) . ';'); };
$writeConf();
$PORTS = []; $base = 39000 + ($PID % 800) * 4;
$env = []; foreach (getenv() as $k => $vv) if (strpos($k, 'DNC_') !== 0 && strpos($k, 'QQ_') !== 0) $env[$k] = $vv;
for ($i = 0; $i < 4; $i++) {
    $port = $base + $i; $PORTS[] = $port;
    $SRV[] = proc_open([PHP_BINARY, '-d', "error_log=$SB/php-error-$i.log", '-d', 'log_errors=1', '-d', 'display_errors=0', '-d', 'opcache.enable_cli=0', '-S', "127.0.0.1:$port", '-t', $SB],
                       [1 => ['file', "$SB/server$i.out", 'w'], 2 => ['file', "$SB/server$i.err", 'w']], $pp, $SB, $env);
}
$up = 0;
foreach ($PORTS as $port) for ($i = 0; $i < 60; $i++) { $fp = @fsockopen('127.0.0.1', $port, $e1, $e2, 0.3); if ($fp) { fclose($fp); $up++; break; } usleep(200000); }
eq($up, 4, 'sandbox: four servers listening');

function cores(array $over = []) {
    global $SB;
    $out = [];
    foreach (['parser' => 'quo-parser-core.js', 'pricing' => 'quo-pricing-core.js', 'quote' => 'quo-quote-core.js'] as $c => $f) {
        $src = (string)file_get_contents("$SB/$f"); $Uc = strtoupper($c);
        preg_match("/const QUO_{$Uc}_CORE_VERSION\\s*=\\s*'([0-9.]+)'/", $src, $v); preg_match("/const QUO_{$Uc}_CORE_CONTRACT\\s*=\\s*(\\d+);/", $src, $k);
        $out[$c] = ['version' => $v[1] ?? '0', 'contract' => (int)($k[1] ?? 0), 'sha256' => hash('sha256', $src)];
    }
    return array_merge($out, $over);
}
/** Builds one signed raw HTTP request; returns [port, bytes]. */
function req(string $action, array $params, array $o = []) {
    global $KEY, $PORTS;
    $env = ['actor' => $o['actor'] ?? ['sub' => 7, 'username' => 'exampleuser'], 'requestId' => 'req_' . bin2hex(random_bytes(4)), 'params' => (object)$params];
    $cores = array_key_exists('cores', $o) ? $o['cores'] : cores();
    if ($cores !== null) $env['client'] = ['cores' => $cores];
    $body = json_encode($env, JSON_PRESERVE_ZERO_FRACTION);
    $ts = (string)time(); $nonce = bin2hex(random_bytes(16));
    $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', "qqs1\nPOST\n$action\n$ts\n$nonce\n" . hash('sha256', $body), $KEY, true)), '+/', '-_'), '=');
    $raw = "POST /service.php?action=" . rawurlencode($action) . " HTTP/1.1\r\nHost: quo.test.invalid\r\nConnection: close\r\nContent-Type: application/json\r\n"
         . "X-QQS-Key-Id: qq-backend-1\r\nX-QQS-Timestamp: $ts\r\nX-QQS-Nonce: $nonce\r\nX-QQS-Signature: $sig\r\nContent-Length: " . strlen($body) . "\r\n\r\n" . $body;
    return [$PORTS[$o['server'] ?? 0], $raw];
}
function parse_resp(string $raw) {
    [$head, $content] = array_pad(explode("\r\n\r\n", $raw, 2), 2, '');
    preg_match('#^HTTP/\S+ (\d+)#', $head, $m);
    return ['status' => (int)($m[1] ?? 0), 'json' => json_decode($content, true), 'body' => $content];
}
function call(string $action, array $params = [], array $o = []) {
    [$port, $raw] = req($action, $params, $o);
    $s = fsockopen('127.0.0.1', $port, $en, $es, 30); stream_set_timeout($s, 60);
    fwrite($s, $raw); $r = ''; while (!feof($s)) $r .= fread($s, 65536); fclose($s);
    return parse_resp($r);
}
function code_of($r) { return $r['json']['error']['code'] ?? (($r['json']['ok'] ?? null) ? 'OK' : null); }
function uuid4() { $b = random_bytes(16); $b[6] = chr((ord($b[6]) & 0x0F) | 0x40); $b[8] = chr((ord($b[8]) & 0x3F) | 0x80); return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4)); }
$count = fn ($t) => (int)one($q, "SELECT COUNT(*) FROM $t");
$state = fn () => [$count('quotations'), $count('quotation_revisions'), $count('quotation_create_requests')];
$settingsVersion = fn () => call('diameter_settings.get')['json']['data']['version'] ?? null;

// ══ T · whatsapp_template.get ══════════════════════════════════════════════
/* api.php's own block, lifted and run against the same table. */
function require_table($db, $table) { $r = $db->query("SHOW TABLES LIKE '" . $db->real_escape_string($table) . "'"); if (!$r || !$r->num_rows) throw new RuntimeException('missing'); }
function query_or_fail($db, $sql, $label = '') { $res = $db->query($sql); if (!$res) throw new RuntimeException('q'); return $res; }
preg_match('/\} elseif \(\$action === \'get_whatsapp_template\'\) \{(.*?)\n\} elseif/s', file_get_contents("$ROOT/api.php"), $blk);
ok(!empty($blk[1]), 'T: api.php get_whatsapp_template block lifted');
preg_match('/const WA_DEFAULT_TPL=`(.*?)`;/s', file_get_contents("$ROOT/quo-quote-core.js"), $dt);
$WA_DEFAULT = str_replace('\n', "\n", $dt[1] ?? '');
ok($WA_DEFAULT !== '', 'T: WA_DEFAULT_TPL read from quo-quote-core.js');
/* What the PAGE ends up using (index.php loadWATemplate + getWATemplate): data.template_body if
   truthy, else WA_DEFAULT_TPL; then sanitizeWATemplate (validUntil lines removed). */
$sanitize = fn ($t) => preg_replace('/\n{3,}/', "\n\n", str_ireplace('{validUntil}', '', preg_replace('/^[^\r\n]*\{validUntil\}[^\r\n]*(?:\r?\n|$)/mi', '', (string)$t)));
$pageUses = function () use ($blk, $q, $WA_DEFAULT, $sanitize) {
    $db = $q;
    try { ob_start(); eval($blk[1]); $j = json_decode(ob_get_clean(), true); } catch (Throwable $e) { ob_end_clean(); $j = ['ok' => false]; }
    $b = ($j['ok'] ?? false) && !empty($j['data']['template_body']) ? $j['data']['template_body'] : $WA_DEFAULT;
    return $sanitize($b);
};
$svcUses = function () use ($WA_DEFAULT, $sanitize) {
    $r = call('whatsapp_template.get');
    $d = $r['json']['data'] ?? [];
    return [$r, $sanitize(($d['template'] ?? '') !== '' ? $d['template'] : $WA_DEFAULT)];
};
[$r, $svc] = $svcUses();
eq([$r['status'], $r['json']['data']['template'] ?? null, $r['json']['data']['isDefault'] ?? null], [200, '', true], 'T: no whatsapp_templates table → template "" (QUO default applies), isDefault true');
eq($svc, $pageUses(), 'T: …the text the page would use is the same (api.php errors, page falls back to WA_DEFAULT_TPL)');
$q->query("CREATE TABLE whatsapp_templates (id INT NOT NULL AUTO_INCREMENT, template_name VARCHAR(100) NULL, template_body TEXT NULL, is_default TINYINT(1) NOT NULL DEFAULT 0,
           created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB");   // RECONSTRUCTED from api.php's columns
[$r, $svc] = $svcUses();
eq($r['json']['data']['template'] ?? null, '', 'T: table but NO ROW → template "" (QUO default applies)');
/* KNOWN DIFFERENCE, line endings only: api.php is committed with CRLF, so its hard-coded
   no-row fallback body carries \r\n and the page sends that; WA_DEFAULT_TPL uses \n. */
eq(str_replace("\r\n", "\n", $svc), str_replace("\r\n", "\n", $pageUses()), 'T: …api.php\'s hard-coded fallback sanitises to the same TEXT the page uses (line endings aside)');
ok(strpos($pageUses(), "\r\n") !== false && strpos($svc, "\r") === false, 'T: …the page\'s no-row fallback uses CRLF where WA_DEFAULT_TPL uses LF (documented in SERVICE-API.md 4.6)');
$V0 = $r['json']['data']['version'] ?? '';
ok(preg_match('/^wt1-[0-9a-f]{16}$/', $V0) === 1, 'T: version wt1-<16 hex>');
$CUSTOM = "Dear {customer},\nYour quotation {quotationNo}:\n{items}\nTotal RM{total}\nValid Until: {validUntil}\n— Example Office";
$st = $q->prepare("INSERT INTO whatsapp_templates (template_name, template_body, is_default) VALUES ('Custom', ?, 1)"); $st->bind_param('s', $CUSTOM); $st->execute();
[$r, $svc] = $svcUses();
eq([$r['json']['data']['template'] ?? null, $r['json']['data']['isDefault'] ?? null], [$CUSTOM, false], 'T: a CUSTOM saved template → its body, byte for byte, isDefault false');
eq($svc, $pageUses(), 'T: …PARITY: the text equals what api.php gives the page');
ok(($r['json']['data']['version'] ?? '') !== $V0, 'T: …and the version changed');
eq(call('whatsapp_template.get')['json']['data']['version'] ?? null, $r['json']['data']['version'] ?? 'x', 'T: version is stable across calls');
$q->query("UPDATE whatsapp_templates SET is_default = 0"); $q->query("INSERT INTO whatsapp_templates (template_name, template_body, is_default) VALUES ('Blank', '', 1)");
[$r, $svc] = $svcUses();
eq([$r['json']['data']['template'] ?? null, $svc], ['', $pageUses()], 'T: a saved EMPTY body → "" (the page uses WA_DEFAULT_TPL for it too)');
$q->query("DELETE FROM whatsapp_templates WHERE template_name = 'Blank'"); $q->query("UPDATE whatsapp_templates SET is_default = 1");
eq(call('whatsapp_template.get', [], ['cores' => null])['status'], 200, 'T: a read: answers without a core claim');

// ══ C · quotations.create ══════════════════════════════════════════════════
$req = function (array $over = []) use ($ITEMS, $TOTAL, $settingsVersion) {
    return array_merge(['idempotencyKey' => uuid4(), 'companyId' => 901, 'items' => $ITEMS, 'claimedTotal' => $TOTAL,
                        'settingsVersion' => $settingsVersion(), 'parse' => ['omittedCount' => 0, 'acknowledged' => false]], $over);
};
$p = $req();
$r = call('quotations.create', $p);
eq([$r['status'], code_of($r)], [403, 'create_disabled'], 'C: QQ_SERVICE_CREATE_ENABLED absent → 403 create_disabled');
eq($state(), [0, 0, 0], 'C: …nothing written');
eq(call('ping')['json']['data']['createEnabled'] ?? null, false, 'C: ping reports createEnabled false');
$writeConf(['QQ_SERVICE_CREATE_ENABLED' => 'true']);
eq(call('ping')['json']['data']['createEnabled'] ?? null, true, 'C: switched on → ping reports createEnabled true');

$YEAR = date('Y');
$r = call('quotations.create', $p);
$d = $r['json']['data'] ?? [];
eq([$r['status'], $d['replayed'] ?? null], [200, false], 'C: HAPPY PATH → 200, replayed false');
eq($state(), [1, 1, 1], 'C: one quotation, one revision, one request row');
$row = $q->query('SELECT * FROM quotations WHERE id = ' . (int)($d['quotationId'] ?? 0))->fetch_assoc();
eq([$d['refNo'] ?? null, $row['ref_no'] ?? null], ["Q-$YEAR-0001", "Q-$YEAR-0001"], 'C: QUO allocated the number');
eq([$row['company_id'], $row['customer_name'], $row['customer_phone'], $row['prepared_by'], $row['remarks'], $row['valid_until']],
   ['901', 'Example Trading Sdn Bhd', '+60000000091', '', '', null], 'C: customer name + phone from QUO\'s companies row (as the editor stores them); prepared_by/remarks empty');
eq([$row['quote_date'], $row['total_amount']], [date('Y-m-d'), number_format($TOTAL, 2, '.', '')], 'C: quote date defaulted server-side (Malaysia), total stored');
$stored = json_decode($row['items'], true);
ok(count($stored) === 2 && preg_match('/^itm_[0-9a-f]{32}$/', $stored[0]['item_uid'] ?? '') && preg_match('/^itm_[0-9a-f]{32}$/', $stored[1]['item_uid'] ?? ''), 'C: the server minted both item_uids');
$noUid = array_map(function ($i) { unset($i['item_uid']); return $i; }, $stored);
eq($noUid, $ITEMS, 'C: every item stored exactly as QUO\'s quote core built it (priceAcceptance {accepted, manual} included)');
eq($d['items'] ?? null, $stored, 'C: response items are the PERSISTED items (read back after commit)');
eq([$d['customer'] ?? null, $d['totalAmount'] ?? null, $d['quoteDate'] ?? null], [['companyId' => 901, 'name' => 'Example Trading Sdn Bhd'], $row['total_amount'], $row['quote_date']], 'C: response customer, total, date = stored');
ok(strpos($r['body'], '60000000091') === false && strpos($r['body'], 'Fake Street') === false, 'C: no company phone or address in the response');
$rev = $q->query('SELECT * FROM quotation_revisions WHERE quotation_id = ' . (int)$d['quotationId'])->fetch_assoc();
eq([$rev['revision_no'], $rev['event_type'], $rev['actor_user_id'], $rev['actor_username'], $rev['actor_display_name']], ['1', 'create', null, 'exampleuser', 'Example User'],
   'C: ACTOR on the revision row: id NULL (a DNC user, as for a Portal browser session), canonical username and display name');
eq([$d['revision']['no'] ?? null, $d['revision']['actorUsername'] ?? null, $d['revision']['actorDisplayName'] ?? null], [1, 'exampleuser', 'Example User'], 'C: …reported in the response');
$rq = $q->query("SELECT * FROM quotation_create_requests")->fetch_assoc();
eq([$rq['source'], $rq['idempotency_key'], $rq['actor_user_id'], $rq['actor_username'], $rq['quotation_id'], $rq['ref_no'], $rq['settings_version'], $rq['parser_core_sha256']],
   ['qq', $p['idempotencyKey'], '7', 'exampleuser', (string)$d['quotationId'], "Q-$YEAR-0001", $p['settingsVersion'], cores()['parser']['sha256']], 'C: request row: key, actor, quotation, number, settings and core provenance');
eq($d['open'] ?? null, ['path' => 'companies.php?openId=' . $d['quotationId']], 'C: open path = QUO\'s existing companies.php?openId=<id>');
$Q1 = $d;

$r = call('quotations.create', $p);
eq([$r['status'], $r['json']['data']['replayed'] ?? null, $r['json']['data']['quotationId'] ?? null, $r['json']['data']['refNo'] ?? null], [200, true, $Q1['quotationId'], $Q1['refNo']],
   'C: REPLAY same key + same payload → the same quotation, replayed true');
eq($r['json']['data']['items'] ?? null, $Q1['items'], 'C: …same persisted items');
eq($state(), [1, 1, 1], 'C: …nothing new written');
$p2 = $p; $p2['items'][0]['qty'] = 11; $p2['items'][0]['totalAmount'] = round(11 * $p2['items'][0]['finalUnitPrice'], 2); $p2['claimedTotal'] = round($TOTAL + $p2['items'][0]['finalUnitPrice'], 2);
$r = call('quotations.create', $p2);
eq([$r['status'], code_of($r)], [409, 'key_reused_with_different_payload'], 'C: same key, DIFFERENT payload → 409 key_reused_with_different_payload');
eq($state(), [1, 1, 1], 'C: …nothing written');
$r = call('quotations.create', $p, ['actor' => ['sub' => 8, 'username' => 'seconduser']]);
eq([$r['status'], $r['json']['data']['replayed'] ?? null, $r['json']['data']['refNo'] ?? null], [200, false, "Q-$YEAR-0002"], 'C: the same key from ANOTHER user is independent (its own quotation)');

// parallel: 4 servers, same key
$pp = $req();
$socks = [];
for ($i = 0; $i < 4; $i++) { [$port, $raw] = req('quotations.create', $pp, ['server' => $i]); $s = fsockopen('127.0.0.1', $port, $en, $es, 30); stream_set_timeout($s, 60); $socks[] = [$s, $raw]; }
foreach ($socks as [$s, $raw]) fwrite($s, $raw);
$res = [];
foreach ($socks as [$s]) { $o = ''; while (!feof($s)) $o .= fread($s, 65536); fclose($s); $res[] = parse_resp($o); }
eq(array_column($res, 'status'), [200, 200, 200, 200], 'C: 4 PARALLEL same-key creates (four servers) → all 200');
eq(count(array_unique(array_map(fn ($x) => $x['json']['data']['quotationId'] ?? null, $res))), 1, 'C: …all name ONE quotation');
eq(count(array_filter($res, fn ($x) => ($x['json']['data']['replayed'] ?? null) === false)), 1, 'C: …exactly one created it, three replayed');
eq((int)one($q, "SELECT COUNT(*) FROM quotation_create_requests WHERE idempotency_key = '{$pp['idempotencyKey']}'"), 1, 'C: …one request row');
$r1 = call('quotations.create', $req()); $r2 = call('quotations.create', $req());
$n1 = (int)substr($r1['json']['data']['refNo'] ?? '0', -4); $n2 = (int)substr($r2['json']['data']['refNo'] ?? '0', -4);
eq([$r1['status'], $r2['status'], $n2 - $n1], [200, 200, 1], 'C: two DIFFERENT keys → two quotations with consecutive numbers');

$s0 = $state();
$stale = $req();
$q->query('UPDATE diameter_settings SET diameter = 10.950 WHERE id = 3');
$r = call('quotations.create', $stale);
eq([$r['status'], code_of($r)], [409, 'settings_changed'], 'C: Diameter Settings changed after pricing → 409 settings_changed');
eq($state(), $s0, 'C: …nothing written');
$q->query('UPDATE diameter_settings SET diameter = 10.900 WHERE id = 3');
$r = call('quotations.create', $req(), ['cores' => cores(['quote' => ['version' => '0.9.0', 'contract' => 1, 'sha256' => str_repeat('a', 64)]])]);
eq([$r['status'], code_of($r), $r['json']['error']['reason'] ?? null], [412, 'core_not_accepted', 'mixed_versions'], 'C: quote core mismatch → 412 core_not_accepted');
$r = call('quotations.create', $req(), ['cores' => cores(['quote' => null])]);
eq([$r['status'], $r['json']['error']['reason'] ?? null], [412, 'claim_incomplete'], 'C: a two-core (Loop #6) claim → 412 claim_incomplete');
eq($state(), $s0, 'C: …nothing written');
$r = call('quotations.create', $req(['companyId' => 99999]));
eq([$r['status'], code_of($r), $r['json']['error']['field'] ?? null], [404, 'not_found', 'companyId'], 'C: unknown company → 404 not_found (companyId)');
$r = call('quotations.create', $req(['refNo' => 'Q-2099-9999']));
eq([$r['status'], $r['json']['error']['field'] ?? null, $r['json']['error']['reason'] ?? null], [422, 'refNo', 'not_allowed'], 'C: a client-sent refNo → 422 REFUSED');
$bad = $ITEMS; $bad[1]['item_uid'] = 'itm_' . str_repeat('0', 32);
$r = call('quotations.create', $req(['items' => $bad]));
eq([$r['status'], $r['json']['error']['field'] ?? null, $r['json']['error']['index'] ?? null, $r['json']['error']['reason'] ?? null], [422, 'items', 1, 'item_uid_not_allowed'], 'C: a client-sent item_uid → 422 REFUSED, index 1');
$r = call('quotations.create', $req(['claimedTotal' => $TOTAL + 1]));
eq([$r['status'], code_of($r)], [422, 'totals_mismatch'], 'C: claimed total ≠ the server\'s sum of the items → 422 totals_mismatch');
$auto = $ITEMS; $auto[0]['priceMode'] = 'auto'; $auto[0]['priceAcceptance']['source'] = 'manual_recipe';
$r = call('quotations.create', $req(['items' => $auto]));
eq([$r['status'], $r['json']['error']['index'] ?? null, $r['json']['error']['reason'] ?? null], [422, 0, 'price_source_unsupported'], 'C: an auto-priced item (source QQ cannot know) → refused');
$r = call('quotations.create', $req(['parse' => ['omittedCount' => 1, 'acknowledged' => false]]));
eq([$r['status'], $r['json']['error']['field'] ?? null, $r['json']['error']['reason'] ?? null], [422, 'parse', 'omitted_not_acknowledged'], 'C: parser omitted lines not acknowledged → refused');
$r = call('quotations.create', $req(['parse' => ['omittedCount' => 1, 'acknowledged' => true]]));
eq($r['status'], 200, 'C: …acknowledged → created');
$r = call('quotations.create', $req(['waContactId' => 2]));
eq([$r['status'], $r['json']['error']['field'] ?? null], [422, 'waContactId'], 'C: a contact linked to ANOTHER company → refused');
$s0 = $state();
$r = call('quotations.create', $req(['waContactId' => 1]));
eq([$r['status'], $r['json']['data']['request']['waContactId'] ?? null], [200, 1], 'C: the company\'s own contact → recorded on the request row');
$s0 = $state();

/* Lock timeout: another connection holds the numbering lock. */
$q->query("SELECT GET_LOCK('dc_quotation_ref_alloc', 0)");
$t = microtime(true);
$lockKey = $req();
$r = call('quotations.create', $lockKey);
eq([$r['status'], code_of($r)], [409, 'in_progress'], 'C: numbering lock held elsewhere → 409 in_progress after the store\'s 10 s wait (' . round(microtime(true) - $t, 1) . ' s)');
eq($state(), $s0, 'C: …nothing written');
$q->query("SELECT RELEASE_LOCK('dc_quotation_ref_alloc')");
eq(call('quotations.create', $lockKey)['status'], 200, 'C: …the SAME key afterwards creates it');
$s0 = $state();

/* A failure before COMMIT: the revision table is gone, so the revision write fails. */
$q->query('RENAME TABLE quotation_revisions TO quotation_revisions_gone');
$failKey = $req();
$r = call('quotations.create', $failKey);
eq([$r['status'], code_of($r)], [503, 'quo_unavailable'], 'C: forced failure before commit → 503 quo_unavailable (result unknown to the caller)');
$q->query('RENAME TABLE quotation_revisions_gone TO quotation_revisions');
eq($state(), $s0, 'C: …NOTHING survived: no quotation, no revision, no request row');
eq((int)one($q, "SELECT IS_FREE_LOCK('dc_quotation_ref_alloc')"), 1, 'C: …and the numbering lock was released');
$r = call('quotations.lookup_by_key', ['idempotencyKey' => $failKey['idempotencyKey']]);
eq($r['json']['data'] ?? null, ['found' => false], 'C: …lookup_by_key says the key produced nothing');
$r = call('quotations.create', $failKey);
eq([$r['status'], $r['json']['data']['replayed'] ?? null], [200, false], 'C: …the same key then creates it once');
$FK = $r['json']['data'];

/* A user disabled in the canonical table. */
$root->query("UPDATE {$UDB}.users SET is_active = 0 WHERE id = 7");
$s0 = $state();
eq([call('quotations.create', $req())['status'], $state()], [403, $s0], 'C: disabled user → 403 actor_refused, nothing written');
$root->query("UPDATE {$UDB}.users SET is_active = 1 WHERE id = 7");
$writeConf();
eq(code_of(call('quotations.create', $req())), 'create_disabled', 'C: switched off again → create_disabled at once');
$writeConf(['QQ_SERVICE_CREATE_ENABLED' => 'true']);

// ══ L · lookup_by_key ══════════════════════════════════════════════════════
$r = call('quotations.lookup_by_key', ['idempotencyKey' => $failKey['idempotencyKey']]);
eq([$r['json']['data']['found'] ?? null, $r['json']['data']['quotationId'] ?? null, $r['json']['data']['refNo'] ?? null], [true, $FK['quotationId'], $FK['refNo']], 'L: a used key → found, the same quotation');
eq(array_diff_key($r['json']['data'], ['found' => 1]), array_diff_key($FK, ['replayed' => 1]), 'L: …the same read-back as the create answer');
eq(call('quotations.lookup_by_key', ['idempotencyKey' => uuid4()])['json']['data'] ?? null, ['found' => false], 'L: an unused key → found false');
eq(call('quotations.lookup_by_key', ['idempotencyKey' => $failKey['idempotencyKey']], ['actor' => ['sub' => 8, 'username' => 'seconduser']])['json']['data'] ?? null,
   ['found' => false], 'L: another user\'s key → found false (actor-scoped)');
eq(call('quotations.lookup_by_key', ['idempotencyKey' => 'nope'])['status'], 422, 'L: a malformed key → 422');
$s0 = $state();
call('quotations.lookup_by_key', ['idempotencyKey' => uuid4()], ['cores' => null]);
eq($state(), $s0, 'L: a pure read, ungated');

// ══ logs ═══════════════════════════════════════════════════════════════════
$log = '';
for ($i = 0; $i < 4; $i++) $log .= (string)@file_get_contents("$SB/php-error-$i.log");
ok(strpos($log, 'Example Trading') === false && strpos($log, '60000000091') === false && strpos($log, 'MS UNDERSIZE') === false, 'logs: no company name, phone or item text in the service log');
ok(preg_match('/PHP (Warning|Notice|Deprecated|Fatal)/', $log) === 0, 'logs: no PHP warning, notice or fatal');

if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n"; exit(1);
}
echo "\n  ok    $label  ($asserts assertions)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
