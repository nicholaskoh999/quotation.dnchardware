<?php

use App\Legacy\PriceHistory\PriceHistoryRepository;
use App\Legacy\PriceHistory\PricingHistory;
use Tests\Support\LegacyFixtureDatabase;

/*
 * The PHP port of pricing_history.php must answer exactly as the shipped
 * legacy file does — first against the R0b golden (fixtures/golden/history.json),
 * then differentially against the legacy file itself over extra edge records.
 */

afterEach(fn () => LegacyFixtureDatabase::downAll());

function historyGolden(): array
{
    return json_decode((string) file_get_contents(base_path('../fixtures/golden/history.json')), true, 512, JSON_THROW_ON_ERROR);
}

function historyInputs(): array
{
    return json_decode((string) file_get_contents(base_path('tests/Fixtures/legacy/history-records.json')), true, 512, JSON_THROW_ON_ERROR);
}

const GOLDEN_RESULT_KEYS = ['own', 'finishMatch', 'exactDims', 'dimDistance', 'lineUnitPrice', 'boltUnitPrice', 'accessoryCost',
    'accessoryAmbiguous', 'priceModeLabel', 'costRate', 'addCost', 'markup', 'legacy'];

it('matches the golden matched set and the per-vintage split, record by record', function () {
    $golden = historyGolden()['cases'];
    $case = collect($golden)->firstWhere('topic', 'record matching + pricing vintage split');
    $inputs = historyInputs();
    expect($inputs['want'])->toBe($case['want']);

    $expected = $case['expected'];
    expect($inputs['records'])->toHaveCount(count($expected));

    foreach ($inputs['records'] as $i => $r) {
        $rec = PricingHistory::historyRecord($r['item'], $inputs['want'], $r['meta']);
        $exp = $expected[$i];
        expect($r['label'])->toBe($exp['label'])
            ->and($rec !== null)->toBe($exp['matched'], $exp['label']);
        if ($rec !== null) {
            $got = array_intersect_key($rec, array_flip(GOLDEN_RESULT_KEYS));
            // JSON cannot tell 0 from 0.0; compare numerically where the golden is numeric.
            foreach (GOLDEN_RESULT_KEYS as $k) {
                $e = $exp['result'][$k];
                is_int($e) || is_float($e)
                    ? expect((float) $got[$k])->toBe((float) $e, $exp['label'].' · '.$k)
                    : expect($got[$k])->toBe($e, $exp['label'].' · '.$k);
            }
        }
    }
});

it('ranks the matched records in the golden order', function () {
    $case = collect(historyGolden()['cases'])->firstWhere('topic', 'ranking order');
    $inputs = historyInputs();
    $matched = [];
    foreach ($inputs['records'] as $r) {
        if ($rec = PricingHistory::historyRecord($r['item'], $inputs['want'], $r['meta'])) {
            $matched[] = $rec;
        }
    }
    PricingHistory::sort($matched);

    expect(array_column($matched, 'quotationId'))->toBe($case['expected']);
});

it('reproduces the imperial LIKE prefilter golden (json-escaped slash)', function () {
    $case = collect(historyGolden()['cases'])->firstWhere('topic', 'imperial LIKE prefilter (json-escaped slash)');
    foreach ($case['expected'] as $row) {
        expect(json_encode([['cleanSize' => $row['cleanSize']]]))->toBe($row['storedBlob'])
            ->and(PricingHistory::blobMatches($row['storedBlob'], ['cleanSize' => $row['cleanSize']]))->toBe($row['prefilterMatches']);
    }
});

it('answers identically to the shipped legacy pricing_history.php (differential)', function () {
    require_once base_path('../pricing_history.php');

    $inputs = historyInputs();
    $wants = [
        $inputs['want'],
        [...$inputs['want'], 'companyId' => 0],
        [...$inputs['want'], 'finish' => 'PL', 'dimensionPreview' => ''],
        ['productType' => 'sagrod', 'material' => 'SS304', 'sizeType' => 'UNDERSIZE', 'finish' => '', 'cleanSize' => '1/2', 'dimensionPreview' => 'L 600', 'companyId' => 7],
        ['productType' => 'L Bolt', 'material' => '4140', 'sizeType' => 'FULLSIZE', 'finish' => 'HDG', 'cleanSize' => 'M20', 'dimensionPreview' => 'L 1000 x W 100 x TL 150mm', 'companyId' => 1],
    ];
    $extra = [
        ['item' => ['desc' => '4140 QT FULLSIZE L BOLT (HDG)', 'size' => 'Ø21-M20 x L 1000 x W 100 x TL 150mm', 'qty' => 2, 'finalUnitPrice' => 30, 'finish' => 'HDG'], 'meta' => ['quotationId' => 9, 'refNo' => 'Q-2024-0009', 'date' => '2024-01-01', 'customer' => 'X', 'companyId' => 1]],
        ['item' => ['productType' => 'SAG ROD', 'material' => 'SS304', 'sizeType' => 'UNDERSIZE', 'cleanSize' => '1/2', 'finish' => 'HDG', 'dimensionPreview' => 'L 600', 'finalUnitPrice' => 8, 'accessories' => ['custom' => ['enabled' => true, 'text' => 'washer', 'unitPrice' => 0.5]], 'priceMode' => 'manual'], 'meta' => ['quotationId' => 10, 'refNo' => 'Q-2026-0010', 'date' => '2026-01-01', 'customer' => 'Y', 'companyId' => 7]],
        ['item' => ['productType' => 'SAG ROD', 'material' => 'SS304', 'sizeType' => 'UNDERSIZE', 'cleanSize' => '1/2', 'finish' => '', 'dimensionPreview' => 'nothing measurable', 'finalUnitPrice' => '7.5', 'accessories' => ['fw' => ['enabled' => 1, 'qty' => '3', 'unitPrice' => '0.2']], 'formData' => ['priceMode' => 'no_round', 'costRate' => ''], 'markup' => '15'], 'meta' => ['quotationId' => 11, 'refNo' => 'Q-2026-0011', 'date' => '2026-01-01', 'customer' => 'Y', 'companyId' => 3]],
        ['item' => ['productType' => 'L BOLT', 'material' => '4140', 'sizeType' => 'FULLSIZE', 'cleanSize' => 'M20', 'finish' => 'HDG', 'dimensionPreview' => 'L 1000 x W 100 x TL 150mm', 'finalUnitPrice' => 33.4, 'pricingModel' => 'accessory-inclusive', 'boltUnitPrice' => '', 'accessoryUnitPrice' => 2.3], 'meta' => ['quotationId' => 12, 'refNo' => 'Q-2026-0012', 'date' => '2026-02-01', 'customer' => 'Z', 'companyId' => 1]],
        ['item' => 'not an array', 'meta' => ['quotationId' => 13]],
        ['item' => ['desc' => 'NO SIZE TYPE HERE', 'size' => 'M12'], 'meta' => ['quotationId' => 14]],
    ];
    $records = [...$inputs['records'], ...$extra];

    foreach ($wants as $want) {
        $port = [];
        $legacy = [];
        foreach ($records as $r) {
            $a = PricingHistory::historyRecord($r['item'], $want, $r['meta']);
            $b = dc_history_record($r['item'], $want, $r['meta']);
            expect($a)->toBe($b);
            if ($a !== null) {
                $port[] = $a;
                $legacy[] = $b;
            }
        }
        PricingHistory::sort($port);
        dc_history_sort($legacy);
        expect($port)->toBe($legacy);
        expect(PricingHistory::sqlWhere($want))->toBe(dc_history_sql_where($want));
    }

    foreach (['M12', '1/2', '1-1/4', '1"', 'M10_%'] as $size) {
        $blob = json_encode([['cleanSize' => $size, 'size' => $size.' x L 100']]);
        expect(PricingHistory::blobMatches($blob, ['cleanSize' => $size]))->toBe(dc_history_blob_matches($blob, ['cleanSize' => $size]));
    }
    foreach (['4140 QT', '4340  qt', '4140 QT + HARDEN = G10.9', 's45c + harden = g8.8', 'Y BAR', '4140', 'MS'] as $label) {
        expect(PricingHistory::materialCode($label))->toBe(dc_material_code($label));
    }
});

it('looks pricing history up through the database with the legacy prefilter, imperial sizes included', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $repo = app(PriceHistoryRepository::class);

    $m12 = $repo->lookup(['productType' => 'SAG ROD', 'material' => 'MS', 'sizeType' => 'UNDERSIZE', 'finish' => 'ZP',
        'cleanSize' => 'M12', 'dimensionPreview' => 'L 1000 x TL 100/100mm', 'companyId' => 2]);
    // Q-2026-0001 (company 1, modern) and Q-2026-0003's description-only legacy line (company 2, own).
    expect($m12['total'])->toBe(2)
        ->and($m12['ownTotal'])->toBe(1)
        ->and(array_column($m12['records'], 'refNo'))->toBe(['Q-2026-0003', 'Q-2026-0001'])
        ->and($m12['records'][0]['legacy'])->toBeTrue();

    // "1\/2" in the blob — the LIKE backslash trap — must still be found.
    $inch = $repo->lookup(['productType' => 'SAG ROD', 'material' => 'MS', 'sizeType' => 'UNDERSIZE', 'finish' => 'ZP', 'cleanSize' => '1/2']);
    expect($inch['total'])->toBe(1)
        ->and($inch['records'][0]['refNo'])->toBe('Q-2026-0003')
        ->and($inch['records'][0]['lineUnitPrice'])->toBe(2.6);

    expect($repo->lookup(['productType' => '', 'cleanSize' => 'M12'])['total'])->toBe(0);
})->with('legacy drivers');
