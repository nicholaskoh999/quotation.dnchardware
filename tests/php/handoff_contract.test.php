<?php
/**
 * ── DNC handoff contract v2 — the shared code, as the Portal tests it ───────
 *
 * Run:  php tests/php/handoff_contract.test.php
 *
 * 1. The two contract files and the contract test are the Portal's, byte for
 *    byte (dnc-portal bab1b67). Their git blob ids are pinned below: a single
 *    changed byte in any of the three fails this file before anything runs.
 * 2. HandoffTokenTest.php then runs unchanged under tests/php/handoff/pest-shim.php,
 *    which includes the published fixed vector (§13.1) byte for byte.
 * 3. Quotation's own audience: the same vector re-signed for "quotation", and
 *    a token for "internal-po" refused here.
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }

// ── 1 · byte-for-byte copies ────────────────────────────────────────────────
/* git hash-object of each file at dnc-portal bab1b67e8e52bc8ce63d6e196281f4f82acdd55d */
$PINNED = [
    'app/Handoff/Contract/HandoffToken.php'        => '9544a1bb1e500323a3985fd9983051601ccb989e',
    'app/Handoff/Contract/InvalidHandoffToken.php' => 'abeb10419a1c4832fc9f5adcc4fddb1d292d4376',
    'tests/php/handoff/HandoffTokenTest.php'       => 'c08e2f3ed22ad7eebf6619c60e5adb97b1e7cfaf',
];
foreach ($PINNED as $file => $blob) {
    $bytes = (string) @file_get_contents("$ROOT/$file");
    ok(sha1('blob ' . strlen($bytes) . "\0" . $bytes) === $blob, "1: $file is the Portal's file byte for byte (blob $blob)");
}

require_once "$ROOT/app/Handoff/Contract/InvalidHandoffToken.php";
require_once "$ROOT/app/Handoff/Contract/HandoffToken.php";
require_once __DIR__ . '/handoff/pest-shim.php';

use App\Handoff\Contract\HandoffToken;
use App\Handoff\Contract\InvalidHandoffToken;

// ── 2 · the Portal's own contract test, unchanged ───────────────────────────
require __DIR__ . '/handoff/HandoffTokenTest.php';
[$cases, $pestFailures] = dc_pest_run();
ok($cases >= 60, "2: the copied contract test ran its cases ($cases)");
foreach ($pestFailures as $f) ok(false, "2: $f");
$asserts += $cases - 1;

// ── 3 · Quotation's audience ────────────────────────────────────────────────
function q_refusal(callable $fn): ?string
{
    try { $fn(); } catch (InvalidHandoffToken $e) { return $e->reason; }
    return null;
}
$key     = HandoffToken::parseSecret(VECTOR_SECRET);
$pending = [VECTOR_STATE_HASH => VECTOR_IAT + 120];
$claims  = HandoffToken::claims('quotation', 42, 'alson', 'member', VECTOR_STATE, VECTOR_IAT, '0123456789abcdef0123456789abcdef');
$qToken  = HandoffToken::encode($claims, $key);

ok(HandoffToken::AUDIENCE_QUOTATION === 'quotation', '3: the Quotation audience constant is "quotation"');
ok(HandoffToken::ISSUER === 'dnc-workspace',         '3: the issuer is "dnc-workspace"');
ok(str_starts_with($qToken, 'v2.'),                  '3: a quotation token is v2');
ok(HandoffToken::verify($qToken, 'quotation', [$key], VECTOR_IAT + 1, $pending) === $claims,
   '3: a quotation token verifies for audience quotation in the browser holding its state');
ok(q_refusal(fn () => HandoffToken::verify(VECTOR_TOKEN, 'quotation', [$key], VECTOR_IAT + 1, $pending)) === 'wrong_audience',
   '3: the published internal-po vector is refused here as wrong_audience');
ok(q_refusal(fn () => HandoffToken::verify($qToken, 'quotation', [str_repeat("\x42", 32)], VECTOR_IAT + 1, $pending)) === 'bad_signature',
   '3: a quotation token is refused under another target\'s key');
ok(q_refusal(fn () => HandoffToken::verify('v1.' . substr($qToken, 3), 'quotation', [$key], VECTOR_IAT + 1, $pending)) === 'unsupported_version',
   '3: the withdrawn v1 is refused');
ok(q_refusal(fn () => HandoffToken::verify($qToken, 'quotation', [$key], VECTOR_IAT + 65, [VECTOR_STATE_HASH => VECTOR_IAT + 3600])) === 'expired',
   '3: expired after exp + 5 s');

// ── report ──────────────────────────────────────────────────────────────────
$label = 'handoff contract v2 — the Portal\'s code and vector, byte for byte';
if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    exit(1);
}
echo "\n  ok    $label  ($asserts assertions)\n\n";
