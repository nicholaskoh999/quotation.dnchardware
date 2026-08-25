<?php
/**
 * ── save_quotation: one retry, for one error number ────────────────────────
 *
 * Run:  php tests/php/save_retry.test.php
 *
 * quotations.ref_no carries a UNIQUE index in production, so a collision is
 * refused with MySQL error 1062 rather than becoming a silent duplicate. The
 * number is the server's to choose, so that one error the application can
 * answer by itself — and only that one.
 *
 * api.php cannot be included here: it requires auth.php and db.php and opens a
 * connection on the first line. So the function under test is EXTRACTED FROM
 * THE SHIPPED FILE by name and evaluated — the same principle the browser
 * harness uses when it serves the real index.php with one require stripped
 * rather than testing a copy. If the source changes, this test runs the change.
 */

$asserts = 0; $failures = [];
function ok($cond, $msg) {
    global $asserts, $failures;
    $asserts++;
    if (!$cond) $failures[] = $msg;
}
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

/* ── the shipped function, lifted out of api.php by brace matching ───────── */
$src = file_get_contents(__DIR__ . '/../../api.php');
$at  = strpos($src, 'function dc_save_quotation_insert');
ok($at !== false, 'dc_save_quotation_insert is present in the shipped api.php');
if ($at === false) { echo "  cannot continue\n"; exit(1); }
$i = strpos($src, '{', $at); $depth = 0; $end = null;
for ($k = $i; $k < strlen($src); $k++) {
    if ($src[$k] === '{') $depth++;
    elseif ($src[$k] === '}') { $depth--; if ($depth === 0) { $end = $k; break; } }
}
ok($end !== null, 'and its body is balanced');
eval(substr($src, $at, $end - $at + 1));
ok(function_exists('dc_save_quotation_insert'), 'and it evaluates into this scope');

/* ── a statement that answers the way mysqli does ─────────────────────────── */
class FakeStmt {
    public $errno = 0;
    public $error = '';
    public $runs  = 0;
    private $script;                      // one entry per execute(): true, or an errno
    public $sentRefNo = [];               // what each attempt would have sent
    private $ref;
    public function __construct(array $script, &$ref) { $this->script = $script; $this->ref = &$ref; }
    public function execute() {
        $this->sentRefNo[] = $this->ref;  // bind_param binds by reference; this mirrors that
        $step = $this->script[$this->runs] ?? true;
        $this->runs++;
        if ($step === true) { $this->errno = 0; $this->error = ''; return true; }
        $this->errno = $step;
        $this->error = $step === 1062
            ? "Duplicate entry '{$this->ref}' for key 'uq_quotations_ref'"
            : 'Some other database failure';
        return false;
    }
}

// ══ 1 · the ordinary save is untouched ═══════════════════════════════════════
{
    $ref = 'Q-2026-0431';
    $st  = new FakeStmt([true], $ref);
    $realloc = 0;
    $out = dc_save_quotation_insert($st, $ref, function () use (&$realloc) { $realloc++; return 'NEVER'; });
    eq($out, true,          '1: a save that succeeds returns true');
    eq($st->runs, 1,        '1: with exactly one execute');
    eq($realloc, 0,         '1: and the allocator is never called');
    eq($ref, 'Q-2026-0431', '1: the reference number is untouched');
}

// ══ 2 · a 1062 is re-allocated once and succeeds ═════════════════════════════
{
    $ref = 'Q-2026-0431';
    $st  = new FakeStmt([1062, true], $ref);
    $realloc = 0;
    $out = dc_save_quotation_insert($st, $ref, function () use (&$realloc) { $realloc++; return 'Q-2026-0432'; });
    eq($out, true,          '2: a duplicate is retried and the save succeeds');
    eq($st->runs, 2,        '2: with exactly two executes — one retry, never a loop');
    eq($realloc, 1,         '2: the allocator ran once');
    eq($ref, 'Q-2026-0432', '2: and $ref_no now holds the NEW number, by reference');
    eq($st->sentRefNo, ['Q-2026-0431', 'Q-2026-0432'],
                            '2: the second attempt really sent the re-allocated number');
}

// ══ 3 · a second 1062 is not retried again ═══════════════════════════════════
{
    $ref = 'Q-2026-0431';
    $st  = new FakeStmt([1062, 1062], $ref);
    $realloc = 0;
    $out = dc_save_quotation_insert($st, $ref, function () use (&$realloc) { $realloc++; return 'Q-2026-0432'; });
    eq($out, false,   '3: a second duplicate fails rather than looping');
    eq($st->runs, 2,  '3: MAXIMUM RETRY = 1, enforced by there being no loop');
    eq($realloc, 1,   '3: and the allocator is not called a second time');
    ok(strpos($st->error, 'Duplicate entry') !== false,
                      '3: the caller is left the statement error to report, unchanged');
}

// ══ 4 · every other SQL error is left alone ══════════════════════════════════
/* The whole point of the round is that ONE error is answerable. A lost
   connection, a prepare failure, a constraint that is not this one — retrying
   any of those is how a hard failure becomes a silent double-write. */
foreach ([2006 => 'server has gone away', 1146 => 'table does not exist',
          1452 => 'foreign key constraint', 1406 => 'data too long'] as $errno => $what) {
    $ref = 'Q-2026-0431';
    $st  = new FakeStmt([$errno, true], $ref);   // a retry WOULD have succeeded
    $realloc = 0;
    $out = dc_save_quotation_insert($st, $ref, function () use (&$realloc) { $realloc++; return 'Q-2026-0432'; });
    eq($out, false,   "4: errno $errno ($what) is not caught");
    eq($st->runs, 1,  "4: errno $errno is NOT retried, even though a retry would have worked");
    eq($realloc, 0,   "4: errno $errno never reaches the allocator");
    eq($ref, 'Q-2026-0431', "4: errno $errno leaves the reference number alone");
}

// ══ 5 · the call site in api.php ═════════════════════════════════════════════
{
    $save = substr($src, strpos($src, "elseif (\$action === 'save_quotation')"));
    $save = substr($save, 0, strpos($save, "elseif (\$action === 'update_quotation')"));
    ok(strpos($save, 'dc_save_quotation_insert($stmt, $ref_no,') !== false,
        '5: save_quotation commits through the retry, by reference');
    ok(strpos($save, 'next_free_ref_no($db)') !== false,
        '5: and re-allocates with the EXISTING allocation logic, not a new one');
    ok(strpos($save, "fail_json('Quotation save failed: ' . \$stmt->error)") !== false,
        '5: a failure still reports the same message it always did');
    ok(strpos($save, 'acquire_ref_lock($db)') !== false,
        '5: GET_LOCK is still acquired — the retry does not replace the lock');
    ok(strpos($save, 'release_ref_lock($db)') !== false, '5: and still released');
    ok(strpos($save, 'execute_or_fail($stmt') === false,
        '5: the INSERT no longer goes through the blanket execute_or_fail');
    ok(substr_count($save, 'dc_save_quotation_insert') === 1,
        '5: wrapped exactly once — the INSERT, and no other statement');
}

// ══ 6 · nothing else in api.php was wrapped ══════════════════════════════════
{
    eq(substr_count($src, 'dc_save_quotation_insert'), 2,
        '6: the function is defined exactly once and called from exactly one place');
    ok(strpos($src, 'UPDATE quotations SET company_id') !== false,
        '6: update_quotation is still there');
    $upd = substr($src, strpos($src, "elseif (\$action === 'update_quotation')"));
    $upd = substr($upd, 0, 2000);
    ok(strpos($upd, 'ref_no') === false || strpos($upd, 'ref_no is deliberately NOT') !== false,
        '6: and still does not write ref_no');
}

echo "\n";
if ($failures) {
    echo "  FAIL  save quotation — one retry, for one error number  ({$asserts} assertions, "
       . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "  ok    save quotation — one retry, for one error number  ({$asserts} assertions)\n\n";
