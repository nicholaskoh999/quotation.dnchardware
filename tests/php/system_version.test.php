<?php
/**
 * System version (docs/SYSTEM-VERSION.md): the deployment stamp written by
 * .cpanel.yml and GET /version.php that reads it.
 *
 * Runs the REAL .cpanel.yml tasks (DEPLOYPATH and STAMPDIR pointed at a
 * sandbox) from a throw-away clone, then serves the sandbox docroot with
 * php -S and checks the endpoint over raw HTTP. No database, no network.
 *
 *   php tests/php/system_version.test.php
 *
 * Needs bash, git, GNU date (%:z) and sha256sum on PATH: run it on Linux or
 * WSL, like the cPanel host.
 */

$ROOT = dirname(__DIR__, 2);
$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) { $failures[] = $msg; echo "  FAIL  $msg\n"; } else echo "  ok    $msg\n"; }
function eq($actual, $expected, $msg) { ok($actual === $expected, $msg . ($actual === $expected ? '' : ' (got ' . json_encode($actual) . ')')); }
function sh(string $cmd, ?string $cwd = null, ?int &$code = null): string {
    $p = proc_open(['bash', '-c', $cmd], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $cwd);
    $out = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    $code = proc_close($p);
    return $out;
}

$BASE = sys_get_temp_dir() . '/quo-version-' . getmypid();
$DOCROOT = "$BASE/quo.dnchardware.com";
$STAMPS = "$BASE/quotation-deploy";
$CLONE = "$BASE/clone";
@mkdir($DOCROOT, 0777, true);
register_shutdown_function(fn () => sh('rm -rf ' . escapeshellarg($BASE)));

// ══ A · the real .cpanel.yml, pointed at the sandbox ═══════════════════════
$tasks = [];
foreach (file("$ROOT/.cpanel.yml", FILE_IGNORE_NEW_LINES) as $line) {
    if (preg_match("/^\\s*- '(.*)'\\s*$/", $line, $m)) $tasks[] = str_replace("''", "'", $m[1]);
}
$deployLine = array_values(array_filter($tasks, fn ($t) => str_starts_with($t, 'export DEPLOYPATH=')))[0] ?? '';
$stampLine = array_values(array_filter($tasks, fn ($t) => str_starts_with($t, 'export STAMPDIR=')))[0] ?? '';
eq($deployLine, 'export DEPLOYPATH=/home5/dnchardw/quo.dnchardware.com/', 'A: production docroot unchanged');
eq($stampLine, 'export STAMPDIR=/home5/dnchardw/quotation-deploy/', 'A: the stamp lives beside the docroot, outside it');
eq(dirname(substr($deployLine, 18)) . '/quotation-deploy/', substr($stampLine, 16), 'A: version.php reads exactly where the deploy writes (dirname(docroot)/quotation-deploy)');
ok(str_contains(implode("\n", $tasks), 'version.php"'), 'A: version.php is in APPFILES');
$copyAt = array_search(true, array_map(fn ($t) => str_starts_with($t, 'for f in $APPFILES; do case'), $tasks), true);
$stampAt = array_search(true, array_map(fn ($t) => str_contains($t, 'version.json.tmp'), $tasks), true);
ok($copyAt !== false && $stampAt !== false && $stampAt > $copyAt, 'A: the stamp is written only after every copy');
$script = implode("\n", array_map(fn ($t) => match (true) {
    str_starts_with($t, 'export DEPLOYPATH=') => 'export DEPLOYPATH=' . escapeshellarg("$DOCROOT/"),
    str_starts_with($t, 'export STAMPDIR=') => 'export STAMPDIR=' . escapeshellarg("$STAMPS/"),
    default => $t,
}, $tasks));
file_put_contents("$BASE/deploy.sh", "set -u\n$script\n");

/** "Deploy HEAD Commit" in the clone: returns [exit code, output]. */
function deploy(): array { global $BASE, $CLONE; $out = sh('bash ' . escapeshellarg("$BASE/deploy.sh"), $CLONE, $code); return [$code, $out]; }
/** The stamp's release, telling a real null from a missing key. */
function release_of(?array $s): mixed { return is_array($s) && array_key_exists('release', $s) ? $s['release'] : 'missing'; }
function stamp(): ?array { global $STAMPS; return is_file("$STAMPS/version.json") ? json_decode(file_get_contents("$STAMPS/version.json"), true) : null; }

// A throw-away repository holding exactly what the deploy uses, from this working tree (commit C1).
// (Built by copying, not cloning: a git worktree's .git points at its parent by an absolute path.)
preg_match('/export APPFILES="([^"]+)"/', $script, $m);
$appfiles = preg_split('/\s+/', trim($m[1] ?? ''));
ok(count($appfiles) >= 17, 'A: APPFILES parsed (' . count($appfiles) . ' files)');
foreach (array_merge($appfiles, ['.cpanel.yml'], array_map(fn ($f) => 'assets/icons/' . basename($f), glob("$ROOT/assets/icons/*"))) as $f) {
    @mkdir(dirname("$CLONE/$f"), 0777, true);
    copy("$ROOT/$f", "$CLONE/$f");
}
sh('git init --quiet -b round/r5-system-version && git add -A && git -c user.name=t -c user.email=t@t commit --quiet -m C1', $CLONE);
$C1 = trim(sh('git rev-parse HEAD', $CLONE));

// ══ B · a deploy writes the stamp ═══════════════════════════════════════════
[$code, $out] = deploy();
eq($code, 0, 'B: the deploy succeeds');
$s = stamp();
eq(array_keys($s ?? []), ['system', 'environment', 'release', 'branch', 'commit', 'deployed_at', 'files'], 'B: stamp keys');
eq($s['commit'] ?? null, $C1, 'B: the stamp names the exact deployed commit (HEAD of the deployed checkout)');
eq($s['branch'] ?? null, 'round/r5-system-version', 'B: …and its branch');
eq(release_of($s), null, 'B: no release tag points at it, so release is null (never invented)');
eq($s['environment'] ?? null, 'production', 'B: environment production');
ok(preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/', $s['deployed_at'] ?? '') === 1, 'B: deployed_at is Malaysia time (+08:00)');
ok(isset($s['files']['version.php'], $s['files']['index.php']) && count($s['files']) >= 17, 'B: the stamp fingerprints every deployed file (' . count($s['files'] ?? []) . ')');
eq($s['files']['index.php'] ?? null, hash_file('sha256', "$DOCROOT/index.php"), 'B: …with the SHA-256 of the live copy');
ok(!is_file("$STAMPS/version.json.tmp"), 'B: no temporary stamp is left behind');
ok(!is_file("$DOCROOT/version.json") && !is_file("$DOCROOT/quotation-deploy/version.json"), 'B: nothing is stamped inside the docroot');
ok(str_contains($out, 'stamped:'), 'B: the deploy log says it stamped');

// ══ C · the endpoint over real HTTP ════════════════════════════════════════
file_put_contents("$DOCROOT/db.php", "<?php function getDB(){} \$secret = 'db-password-must-not-leak';\n");
file_put_contents("$DOCROOT/dnc_config.php", "<?php return ['DNC_HANDOFF_SECRET' => 'handoff-secret-must-not-leak'];\n");
$PORT = 37000 + (getmypid() % 900);
$srv = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-d', 'session.auto_start=0', '-S', "127.0.0.1:$PORT", '-t', $DOCROOT],
                 [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $srvPipes, $DOCROOT);
register_shutdown_function(function () use (&$srv, &$srvPipes) {
    if (is_resource($srv)) { proc_terminate($srv); foreach ($srvPipes as $p) if (is_resource($p)) fclose($p); proc_close($srv); }
});
$up = false;
for ($i = 0; $i < 60 && !$up; $i++) { $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3); if ($fp) { fclose($fp); $up = true; } else usleep(200000); }
ok($up, "C: sandbox server listening on 127.0.0.1:$PORT");

function http(string $method, string $path): array {
    global $PORT;
    $s = fsockopen('127.0.0.1', $PORT, $en, $es, 5);
    fwrite($s, "$method $path HTTP/1.1\r\nHost: quo.dnchardware.com\r\nConnection: close\r\nX-Forwarded-Proto: https\r\n\r\n");
    $raw = ''; while (!feof($s)) $raw .= fread($s, 65536);
    fclose($s);
    [$head, $body] = array_pad(explode("\r\n\r\n", $raw, 2), 2, '');
    $lines = explode("\r\n", $head);
    preg_match('#^HTTP/\S+ (\d+)#', array_shift($lines), $m);
    $h = []; $cookies = [];
    foreach ($lines as $l) {
        [$k, $v] = array_pad(explode(':', $l, 2), 2, '');
        $k = strtolower(trim($k)); $v = trim($v);
        if ($k === 'set-cookie') $cookies[] = $v; else $h[$k] = $v;
    }
    return ['status' => (int)($m[1] ?? 0), 'h' => $h, 'cookies' => $cookies, 'body' => $body];
}

if ($up) {
    $r = http('GET', '/version.php');
    eq($r['status'], 200, 'C: GET /version.php → 200');
    eq(json_decode($r['body'], true), [
        'system' => 'Quotation', 'environment' => 'production', 'release' => null,
        'branch' => 'round/r5-system-version', 'commit' => $C1, 'deployed_at' => $s['deployed_at'],
    ], 'C: exactly the six contract keys, release null, the exact deployed commit');
    eq($r['h']['content-type'] ?? null, 'application/json', 'C: Content-Type: application/json');
    eq($r['cookies'], [], 'C: no cookie is set (no session)');
    ok(str_contains($r['h']['cache-control'] ?? '', 'no-store'), 'C: Cache-Control: no-store');
    eq($r['h']['x-content-type-options'] ?? null, 'nosniff', 'C: X-Content-Type-Options: nosniff');
    ok(!str_contains($r['body'], 'files') && !str_contains($r['body'], $s['files']['index.php']), 'C: the file fingerprints stay private');
    foreach (['db-password-must-not-leak', 'handoff-secret-must-not-leak', $DOCROOT, $BASE, 'home5', 'Exception', 'Warning'] as $leak) {
        ok(!str_contains($r['body'] . implode("\n", $r['h']), $leak), "C: no leak of " . (strlen($leak) > 30 ? 'a path' : $leak));
    }
    foreach (['POST', 'PUT', 'DELETE'] as $m) {
        $x = http($m, '/version.php');
        eq($x['status'], 405, "C: $m → 405");
        eq($x['h']['allow'] ?? null, 'GET, HEAD', "C: $m names the allowed methods");
    }
    $hd = http('HEAD', '/version.php');
    ok($hd['status'] === 200 && $hd['body'] === '', 'C: HEAD → 200 with no body');
    $wc = http('GET', '/version.php?x=1');
    eq($wc['cookies'], [], 'C: still no cookie with a query string');

    $unavailable = fn (string $label) => (function () use ($label) {
        $x = http('GET', '/version.php');
        eq($x['status'], 503, "$label → 503");
        eq(json_decode($x['body'], true), ['system' => 'Quotation', 'environment' => 'production', 'error' => 'deployment_metadata_unavailable'],
           "$label: no deployment field is shown");
        eq($x['cookies'], [], "$label: no cookie");
    })();

    // ══ D · the stamp no longer describes what is live ══════════════════════
    $good = file_get_contents("$STAMPS/version.json");
    file_put_contents("$DOCROOT/index.php", file_get_contents("$DOCROOT/index.php") . "\n<?php /* older or hand-edited */ ?>\n");
    $unavailable('D: a live file changed after the stamp (older-commit deploy, half-failed deploy, hand edit)');

    // ══ E · malformed stamps fail safely ════════════════════════════════════
    $deploy = fn () => deploy();
    [$code] = deploy();
    eq($code, 0, 'E: redeploy restores a matching stamp');
    eq(http('GET', '/version.php')['status'], 200, 'E: …and the endpoint answers again');
    $valid = json_decode(file_get_contents("$STAMPS/version.json"), true);
    $bad = [
        'not JSON' => '{nope',
        'short commit' => json_encode(['commit' => substr($C1, 0, 7)] + $valid),
        'invented release' => json_encode(['release' => 'Spring Release'] + $valid),
        'branch with ..' => json_encode(['branch' => 'a/../b'] + $valid),
        'UTC time' => json_encode(['deployed_at' => '2026-10-23T08:30:00Z'] + $valid),
        'no fingerprints' => json_encode(['files' => []] + $valid),
        'fingerprint outside docroot' => json_encode(['files' => ['../x' => str_repeat('a', 64)] + $valid['files']] + $valid),
        'oversized' => str_repeat(' ', 70000) . json_encode($valid),
    ];
    foreach ($bad as $label => $content) {
        file_put_contents("$STAMPS/version.json", $content);
        $unavailable("E: $label");
    }
    unlink("$STAMPS/version.json");
    $unavailable('E: no stamp at all');
    file_put_contents("$STAMPS/version.json", json_encode($valid));
    eq(http('GET', '/version.php')['status'], 200, 'E: the valid stamp reads again');
}

// ══ F · release tags, and refusals that change nothing ═════════════════════
sh('git tag v9-backup', $CLONE);
deploy();
eq(release_of(stamp()), null, 'F: a tag that is not quo-r… is not a release');
sh('git tag quo-r1.0', $CLONE);
deploy();
eq(stamp()['release'] ?? null, 'quo-r1.0', 'F: a quo-r… tag on the deployed commit is the release');

$before = file_get_contents("$STAMPS/version.json");
$liveBefore = hash_file('sha256', "$DOCROOT/index.php");
sh('git checkout --quiet --detach HEAD', $CLONE);
[$code, $out] = deploy();
ok($code !== 0 && str_contains($out, 'not on a usable branch'), 'F: a detached checkout is refused');
eq(file_get_contents("$STAMPS/version.json"), $before, 'F: …before the stamp changes');
eq(hash_file('sha256', "$DOCROOT/index.php"), $liveBefore, 'F: …and before any file is copied');
sh('git checkout --quiet round/r5-system-version', $CLONE);

// ══ G · rollback: deploying the previous commit restores its metadata ═════
file_put_contents("$CLONE/index.php", file_get_contents("$CLONE/index.php") . "\n<?php /* C2 */ ?>\n");
sh('git -c user.name=t -c user.email=t@t commit --quiet -am C2', $CLONE);
$C2 = trim(sh('git rev-parse HEAD', $CLONE));
[$code] = deploy();
eq([$code, stamp()['commit'] ?? null, release_of(stamp())], [0, $C2, null], 'G: deploying C2 stamps C2 (the quo-r1.0 tag is on C1, so no release)');
eq(json_decode(file_get_contents("$STAMPS/version.previous.json"), true)['commit'] ?? null, $C1, 'G: the replaced C1 stamp is kept as version.previous.json');
if ($up) eq(json_decode(http('GET', '/version.php')['body'], true)['commit'] ?? null, $C2, 'G: the endpoint reports C2');
// cPanel rollback = point the clone at the older commit on a branch, then Deploy HEAD Commit.
sh('git checkout --quiet -B rollback ' . escapeshellarg($C1), $CLONE);
[$code] = deploy();
eq([$code, stamp()['commit'] ?? null, stamp()['branch'] ?? null, stamp()['release'] ?? null], [0, $C1, 'rollback', 'quo-r1.0'], 'G: rolling back to C1 restores C1, its branch and its release');
if ($up) eq(json_decode(http('GET', '/version.php')['body'], true)['commit'] ?? null, $C1, 'G: the endpoint reports C1 again, with no Portal change');

echo "\n$asserts assertions, " . count($failures) . " failed\n";
exit($failures === [] ? 0 : 1);
