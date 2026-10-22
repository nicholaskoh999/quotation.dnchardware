<?php

use App\Legacy\Quotations\ItemReader;
use App\Legacy\Quotations\QuotationPresenter;
use App\Legacy\Quotations\QuotationReader;
use Tests\Support\LegacyFixtureDatabase;

afterEach(fn () => LegacyFixtureDatabase::downAll());

function legacyQuote(int $id): array
{
    $q = app(QuotationReader::class)->find($id);
    expect($q)->not->toBeNull();

    return $q;
}

it('lists quotations recent first, paginated, filterable by company and text', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $reader = app(QuotationReader::class);

    $all = $reader->list();
    expect($all['total'])->toBe(6)
        ->and(array_column($all['rows'], 'refNo'))->toBe(['Q-2026-0005', 'Q-2026-0004', 'Q-2026-0002', 'Q-2026-0003', 'Q-2026-0001', 'Q-2025-0100']);

    $page2 = $reader->list(null, 2, 4);
    expect($page2['lastPage'])->toBe(2)
        ->and(array_column($page2['rows'], 'refNo'))->toBe(['Q-2026-0001', 'Q-2025-0100']);

    expect(array_column($reader->list(2)['rows'], 'refNo'))->toBe(['Q-2026-0005', 'Q-2026-0003'])
        ->and(array_column($reader->list(null, 1, 25, 'walk-in')['rows'], 'refNo'))->toBe(['Q-2026-0004'])
        ->and(array_column($reader->list(null, 1, 25, '2026-000')['rows'], 'id'))->toHaveCount(5)
        ->and($reader->list(null, 1, 25, '100%')['total'])->toBe(0);

    $walkIn = collect($all['rows'])->firstWhere('refNo', 'Q-2026-0004');
    expect($walkIn['companyId'])->toBeNull()
        ->and($walkIn['companyName'])->toBeNull()
        ->and($walkIn['customerDisplay'])->toBe('WALK-IN CUSTOMER')
        ->and($walkIn['totalAmount'])->toBe('50.00');

    // Blank customer name falls back to the company's, as the legacy screens do.
    expect(collect($all['rows'])->firstWhere('refNo', 'Q-2026-0002')['customerDisplay'])->toBe('ACME ENGINEERING SDN BHD');
})->with('legacy drivers');

it('reads the header, and notes briefly that the issuer was not stored', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $q = legacyQuote(101);

    expect($q)->toMatchArray([
        'id' => 101, 'refNo' => 'Q-2026-0001', 'quoteDate' => '2026-03-01', 'validUntil' => '2026-03-31',
        'preparedBy' => 'Nicholas', 'customerName' => 'ACME ENGINEERING SDN BHD', 'customerPhone' => '012-345 6789',
        'remarks' => 'Price subject to change without prior notice', 'companyId' => 1, 'totalAmount' => '158.60',
        'issuer' => null, 'itemsState' => 'ok', 'itemCount' => 2,
    ])->and($q['issuerNote'])->toBe('Legacy quotation — issuer was not stored.');
})->with('legacy drivers');

it('preserves the raw items JSON byte for byte, and the raw object per item', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $q = legacyQuote(103);
    $fixture = collect(LegacyFixtureDatabase::dataset()['quotations'])->firstWhere('id', 103);

    expect($q['rawItems'])->toBe(json_encode($fixture['items']))
        ->and($q['rawItems'])->toContain('"cleanSize":"1\/2"');
    foreach ($q['items'] as $i => $item) {
        expect($item['raw'])->toBe($fixture['items'][$i]);
    }
})->with('legacy drivers');

it('reads each pricing vintage as it was written', function (string $driver) {
    LegacyFixtureDatabase::for($driver);

    // accessory-inclusive with nuts + washer: the saved figure IS the customer price.
    $lbolt = legacyQuote(101)['items'][1]['pricing'];
    expect($lbolt)->toMatchArray(['model' => 'accessory-inclusive', 'customerUnitPrice' => 33.4, 'boltUnitPrice' => 31.1,
        'accessoryUnitPrice' => 2.3, 'ambiguous' => false, 'total' => 133.6, 'totalSource' => 'stored']);

    // bolt-separate: finalUnitPrice was the BOLT; the customer line is lineUnitPrice.
    $stud = legacyQuote(102)['items'][0]['pricing'];
    expect($stud)->toMatchArray(['model' => 'bolt-separate', 'customerUnitPrice' => 4.8, 'boltUnitPrice' => 4.1,
        'accessoryUnitPrice' => 0.7, 'ambiguous' => false, 'total' => 96.0]);

    $legacy = legacyQuote(103)['items'];
    // legacy, no accessories: one figure, bolt = customer price.
    expect($legacy[0]['pricing'])->toMatchArray(['model' => 'legacy', 'customerUnitPrice' => 2.2, 'boltUnitPrice' => 2.2, 'accessoryUnitPrice' => 0.0]);
    // legacy, accessories, NO recorded price mode: ambiguous — the separation is not invented.
    expect($legacy[1]['pricing'])->toMatchArray(['model' => 'legacy', 'customerUnitPrice' => 3.5, 'boltUnitPrice' => null,
        'accessoryUnitPrice' => null, 'ambiguous' => true])
        ->and($legacy[1]['pricing']['note'])->toContain('cannot be separated');
    // legacy, accessories, Auto Round recorded: the charge was added on top, so it comes out.
    expect($legacy[2]['pricing'])->toMatchArray(['customerUnitPrice' => 5.0, 'boltUnitPrice' => 4.7, 'accessoryUnitPrice' => 0.3, 'ambiguous' => false]);
    // Welding Anchor Set: per set, accessories marked up inside — no split reported.
    expect($legacy[3]['pricing'])->toMatchArray(['customerUnitPrice' => 85.5, 'boltUnitPrice' => null, 'accessoryUnitPrice' => null, 'total' => 171.0])
        ->and($legacy[3]['unitSuffix'])->toBe('/set');
})->with('legacy drivers');

it('normalises items: product, structured material, size, finish, qty, weight, accessories, uid', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $first = legacyQuote(101)['items'][0];
    expect($first)->toMatchArray([
        'state' => 'ok', 'position' => 1, 'itemUid' => 'itm_0123456789abcdef0123456789abcdef', 'fieldsSource' => 'stored',
        'itemType' => 'sagrod', 'productType' => 'SAG ROD', 'productKey' => 'SAG ROD', 'sizeType' => 'UNDERSIZE',
        'finish' => 'ZP', 'finishLabel' => 'ZP', 'sizeLabel' => 'M12 x L 1000 x TL 100/100mm', 'cleanSize' => 'M12',
        'sizeSystem' => 'metric', 'qty' => 10, 'weight' => 0.6928, 'accessories' => null,
    ]);

    $lbolt = legacyQuote(101)['items'][1];
    expect($lbolt['material'])->toMatchArray(['code' => '4140', 'key' => '4140_QT', 'label' => '4140 QT', 'treatment' => null])
        ->and($lbolt['accessories']['summary'])->toBe('2 Nut HDG + 1 FW HDG')
        ->and($lbolt['accessories']['nut'])->toMatchArray(['enabled' => true, 'qty' => 2.0, 'unitPrice' => 1.0]);

    $hard = legacyQuote(102)['items'];
    expect($hard[0]['material'])->toMatchArray(['code' => 'S45C_HARDEN_G8_8', 'key' => 'S45C', 'label' => 'S45C',
        'treatment' => 'HARDEN', 'propertyClass' => '8.8', 'legacyLabel' => 'S45C + HARDEN = G8.8', 'recognised' => true])
        ->and($hard[0]['sizeType'])->toBeNull()
        ->and($hard[1]['material'])->toMatchArray(['key' => '4140_QT', 'label' => '4140 QT', 'treatment' => 'HARDEN', 'propertyClass' => '10.9'])
        // a very old desc carrying the raw combined code reads the legacy way
        ->and($hard[1]['displayDescription'])->toBe('4140 QT + HARDEN = G10.9 STUD');

    $q103 = legacyQuote(103)['items'];
    // description-only legacy item: identity read out of desc + size (pricing_history rule)
    expect($q103[0])->toMatchArray(['fieldsSource' => 'legacy-description', 'productType' => 'SAG ROD', 'sizeType' => 'UNDERSIZE',
        'cleanSize' => 'M12', 'dimensionPreview' => 'L 1000 x TL 100/100mm', 'itemType' => null])
        ->and($q103[0]['material']['code'])->toBe('MS');
    // inch size survives the JSON escape
    expect($q103[4])->toMatchArray(['cleanSize' => '1/2', 'sizeSystem' => 'imperial', 'sizeLabel' => '1/2" x L 1000 x TL 100/100mm']);
    // 4140 plain is NOT 4140 QT; Y BAR is a genuine material
    expect($q103[5]['material'])->toMatchArray(['key' => '4140_PLAIN', 'label' => '4140'])
        ->and($q103[5]['displayDescription'])->toBe('4140 STUD')
        ->and($q103[6]['material'])->toMatchArray(['key' => 'Y_BAR', 'label' => 'Y BAR']);
    // WAS: triangle plate line dropped when the set carries none (wasDisplayData)
    expect($q103[3]['sizeLabel'])->toBe("M20 x L 600 x TL 100mm\nBase Plate: 200 x 200 x 12mm");

    expect(legacyQuote(105)['items'][1]['material'])->toMatchArray(['code' => '4340', 'key' => '4340_QT', 'label' => '4340 QT']);
})->with('legacy drivers');

it('turns malformed JSON into a safe unreadable state, never an exception', function (string $driver) {
    LegacyFixtureDatabase::for($driver);

    $broken = legacyQuote(104);
    expect($broken['itemsState'])->toBe('unreadable')
        ->and($broken['items'])->toBe([])
        ->and($broken['rawItems'])->toStartWith('[{"desc":"MS UNDERSIZE SAG ROD"')
        ->and($broken['totalAmount'])->toBe('50.00');

    // One bad element does not sink the others.
    $mixed = legacyQuote(105);
    expect($mixed['itemsState'])->toBe('ok')
        ->and(array_column($mixed['items'], 'state'))->toBe(['unreadable', 'ok', 'unreadable'])
        ->and($mixed['unreadableItemCount'])->toBe(2)
        ->and($mixed['items'][0]['raw'])->toBe('a bare string where an item object belongs');

    expect(legacyQuote(106))->toMatchArray(['itemsState' => 'empty', 'itemCount' => 0, 'totalAmount' => '0.00']);
    expect(app(QuotationReader::class)->find(424242))->toBeNull();
})->with('legacy drivers');

it('reports the stored total as the authority, never a recomputation', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    // Q-2026-0005's one readable line totals 49.50 but the quotation was saved at 99.90.
    expect(legacyQuote(105)['totalAmount'])->toBe('99.90');
})->with('legacy drivers');

it('strips raw JSON and the internal pricing recipe from the page payload', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $full = legacyQuote(101);
    expect($full['items'][0]['internal'])->toMatchArray(['costRate' => 4.2, 'addCost' => 0.6, 'markup' => 0.0, 'priceMode' => 'auto']);

    $page = QuotationPresenter::forPage($full);
    $json = json_encode($page);
    expect($page)->not->toHaveKey('rawItems')
        ->and($page['items'][0])->not->toHaveKey('raw')
        ->and($page['items'][0])->not->toHaveKey('internal');
    foreach (['costRate', 'addCost', 'formData', 'priceMode', '"markup"', 'manualUnitPrice'] as $leak) {
        expect($json)->not->toContain($leak);
    }
    // Owner Smoke Loop #2: only the derived markup badge facts reach the internal detail.
    expect($page['items'][0]['pricing'])->toMatchArray(['markupPercent' => null, 'manual' => false]);
})->with('legacy drivers');

it('derives the markup badge: shown when > 0 on a calculated price, "manual" instead of a percentage', function () {
    $item = fn (array $over) => ItemReader::read([
        'itemType' => 'stud', 'productType' => 'STUD', 'material' => 'MS', 'sizeType' => '', 'cleanSize' => 'M12',
        'finalUnitPrice' => 4.2, 'totalAmount' => 42, 'qty' => 10, 'pricingModel' => 'accessory-inclusive', ...$over,
    ], 1);
    $page = fn (array $over) => QuotationPresenter::item($item($over))['pricing'];

    expect($page(['markup' => 5, 'priceMode' => 'auto']))->toMatchArray(['markupPercent' => 5.0, 'manual' => false])
        ->and($page(['formData' => ['markup' => '25', 'costRate' => '6.5', 'priceMode' => 'auto']]))->toMatchArray(['markupPercent' => 25.0, 'manual' => false])
        ->and($page(['markup' => 0]))->toMatchArray(['markupPercent' => null, 'manual' => false])
        ->and($page(['markup' => 15, 'priceMode' => 'manual']))->toMatchArray(['markupPercent' => null, 'manual' => true])
        ->and(json_encode(QuotationPresenter::item($item(['formData' => ['costRate' => '6.5', 'addCost' => '1.2']]))))->not->toContain('6.5')->not->toContain('costRate');
});

it('gives each list row a compact item summary, never the raw items', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $rows = app(QuotationReader::class)->list(1)['rows'];
    $byRef = array_column($rows, null, 'refNo');

    expect($byRef['Q-2026-0001']['itemSummary'])->toBe([
        'count' => 2,
        'first' => ['displayDescription' => 'MS UNDERSIZE SAG ROD', 'productType' => 'SAG ROD', 'sizeType' => 'UNDERSIZE', 'material' => 'MS', 'finish' => 'ZP'],
    ]);
    $json = json_encode($rows);
    foreach (['formData', 'costRate', 'finalUnitPrice', 'items"', 'size"', 'weight'] as $leak) {
        expect($json)->not->toContain($leak);
    }
})->with('legacy drivers');

it('sorts the list newest or oldest first without changing any row', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $reader = app(QuotationReader::class);
    $newest = array_column($reader->list(null, 1, 25)['rows'], 'refNo');
    $oldest = array_column($reader->list(null, 1, 25, null, QuotationReader::SORT_OLDEST)['rows'], 'refNo');

    expect($oldest)->toBe(array_reverse($newest))
        ->and($reader->list(null, 1, 25, null, 'anything-else')['rows'][0]['refNo'])->toBe($newest[0]);
})->with('legacy drivers');
