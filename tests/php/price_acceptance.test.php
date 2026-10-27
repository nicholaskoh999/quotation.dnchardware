<?php
/**
 * ── Suggested / Accepted price — the server's half of the rule ───────────────
 *
 * Run:  php tests/php/price_acceptance.test.php
 *
 * The browser commits an item only once its price was accepted, and writes
 * priceAcceptance on it. The save path refuses an item that carries the key
 * but was not accepted, or whose accepted value is not the price being saved.
 * An item without the key is a legacy item and must still save.
 *
 * validate_quotation_payload and dc_price_acceptance_ok are lifted out of the
 * shipped api.php by brace matching, as item_identity.test.php does.
 */
$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }

$API = file_get_contents(dirname(__DIR__, 2) . '/api.php');
function lift($src, $name) {
    $at = strpos($src, "function {$name}(");
    if ($at === false) return null;
    $i = strpos($src, '{', $at); $depth = 0;
    for ($k = $i, $n = strlen($src); $k < $n; $k++) {
        if ($src[$k] === '{') $depth++;
        elseif ($src[$k] === '}') { $depth--; if ($depth === 0) return substr($src, $at, $k - $at + 1); }
    }
    return null;
}
ok(preg_match('/const DC_PRICE_SOURCES = \[[^\]]+\];/', $API, $m) === 1, 'api.php states the price sources');
$code = $m[0] . "\n";
foreach (['dc_price_acceptance_ok', 'validate_quotation_payload'] as $fn) {
    $body = lift($API, $fn);
    ok($body !== null, "{$fn}() is present in the shipped api.php");
    if ($body === null) { echo "cannot continue\n"; exit(1); }
    $code .= $body . "\n";
}
eval($code);

$save = function (array $item) {
    $err = '';
    $ok = validate_quotation_payload(['items' => [$item], 'total_amount' => 10], $err);
    return [$ok, $err];
};
$base = ['qty' => 4, 'finalUnitPrice' => 2.75, 'totalAmount' => 11];

[$ok] = $save($base);
ok($ok, 'a legacy item without priceAcceptance still saves');

[$ok] = $save($base + ['priceAcceptance' => ['state' => 'accepted', 'value' => 2.75, 'source' => 'built_in']]);
ok($ok, 'an accepted item at its accepted price saves');

[$ok] = $save($base + ['priceAcceptance' => ['state' => 'accepted', 'value' => 2.75, 'source' => 'history_manual', 'historyRef' => 'Q-2026-1365']]);
ok($ok, 'a history-accepted item saves with its reference');

[$ok, $err] = $save($base + ['priceAcceptance' => ['state' => 'suggested', 'value' => 2.75]]);
ok(!$ok && strpos($err, 'not been accepted') !== false, 'a suggested-only price is refused, with the reason');

[$ok, $err] = $save($base + ['priceAcceptance' => ['state' => 'accepted', 'value' => 2.80, 'source' => 'built_in']]);
ok(!$ok && strpos($err, 'differs from the accepted') !== false, 'a price that moved after acceptance is refused');

[$ok] = $save($base + ['priceAcceptance' => ['state' => 'accepted', 'value' => 2.754, 'source' => 'manual']]);
ok($ok, 'sub-cent float noise is not a different price');

[$ok] = $save($base + ['priceAcceptance' => ['state' => 'accepted', 'value' => 2.75, 'source' => 'made_up']]);
ok(!$ok, 'an unknown source is refused');

[$ok] = $save($base + ['priceAcceptance' => 'yes']);
ok(!$ok, 'a malformed acceptance is refused');

echo "price_acceptance: {$asserts} asserts, " . count($failures) . " failures\n";
foreach ($failures as $f) echo "  FAIL: {$f}\n";
exit($failures ? 1 : 0);
