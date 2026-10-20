<?php
/**
 * ── A Pest-compatible runner for ONE file ──────────────────────────────────
 *
 * tests/php/handoff/HandoffTokenTest.php is the DNC Portal's contract test,
 * copied BYTE FOR BYTE from dnc-portal bab1b67 (tests/Unit/HandoffTokenTest.php).
 * It is written for Pest. This application has no Composer, no vendor/ and no
 * framework, and gains none for one test file, so this shim implements exactly
 * the part of Pest's surface that file uses — it(), ->with(), expect() and the
 * matchers below — with Pest's semantics:
 *
 *   toBe        assertSame (===; arrays compare keys, order and types)
 *   toContain   strings: substring; arrays: strict in_array
 *   toMatch     preg_match
 *   toHaveCount count()          toHaveKey  array_key_exists
 *   toBeNull    === null
 *   not         negates the NEXT matcher only
 *   and($v)     a new expectation on $v
 *
 * A dataset value that is a Closure is called and its array result spread as
 * the arguments; any other non-array value is the single argument.
 *
 * Anything the file uses that this shim does not know throws, so the copy can
 * never silently pass on an unimplemented matcher.
 */

final class DcPestFailure extends RuntimeException {}

final class DcPestCase
{
    public ?array $dataset = null;
    public function __construct(public string $name, public Closure $fn) {}
    public function with(array $dataset): self { $this->dataset = $dataset; return $this; }
}

final class DcPestExpectation
{
    private bool $negate = false;
    public function __construct(private mixed $value) {}

    public function __get(string $name): mixed
    {
        if ($name === 'not') { $this->negate = !$this->negate; return $this; }
        if ($name === 'and') { throw new LogicException('use and($value)'); }
        throw new LogicException("pest-shim: unknown property ->$name");
    }

    public function and(mixed $value): self { return new self($value); }

    public function __call(string $name, array $args): self
    {
        $v = $this->value;
        switch ($name) {
            case 'toBe':       $pass = $v === $args[0]; break;
            case 'toBeNull':   $pass = $v === null; break;
            case 'toMatch':    $pass = is_string($v) && preg_match($args[0], $v) === 1; break;
            case 'toHaveCount': $pass = (is_array($v) || $v instanceof Countable) && count($v) === $args[0]; break;
            case 'toHaveKey':  $pass = is_array($v) && array_key_exists($args[0], $v); break;
            case 'toContain':
                if (is_string($v))      $pass = str_contains($v, (string) $args[0]);
                elseif (is_array($v))   $pass = in_array($args[0], $v, true);
                else throw new LogicException('pest-shim: toContain on ' . get_debug_type($v));
                break;
            default: throw new LogicException("pest-shim: unknown matcher $name()");
        }
        $neg = $this->negate;
        $this->negate = false;
        if ($pass === $neg) {
            throw new DcPestFailure(($neg ? 'not ' : '') . $name . '(' . self::show($args[0] ?? null) . ') failed on ' . self::show($v));
        }
        return $this;
    }

    private static function show(mixed $v): string
    {
        $s = var_export($v, true);
        return strlen($s) > 300 ? substr($s, 0, 300) . '…' : $s;
    }
}

/** @var list<DcPestCase> */
$GLOBALS['DC_PEST_CASES'] = [];

function it(string $name, Closure $fn): DcPestCase
{
    return $GLOBALS['DC_PEST_CASES'][] = new DcPestCase($name, $fn);
}

function expect(mixed $value): DcPestExpectation
{
    return new DcPestExpectation($value);
}

/**
 * Run every registered case. Returns [cases run, failure messages].
 *
 * @return array{0: int, 1: list<string>}
 */
function dc_pest_run(): array
{
    $runs = 0; $failures = [];
    foreach ($GLOBALS['DC_PEST_CASES'] as $case) {
        $sets = $case->dataset === null ? ['' => []] : $case->dataset;
        foreach ($sets as $label => $data) {
            if ($data instanceof Closure) $data = $data();
            $args = is_array($data) ? array_values($data) : [$data];
            $title = $case->name . ($case->dataset === null ? '' : ' with ' . (is_int($label) ? var_export($sets[$label], true) : $label));
            $runs++;
            try {
                ($case->fn)(...$args);
            } catch (Throwable $e) {
                $failures[] = $title . "\n      " . get_class($e) . ': ' . $e->getMessage();
            }
        }
    }
    return [$runs, $failures];
}
