<?php

use App\Legacy\Quotations\ItemReader;
use App\Legacy\Quotations\LegacyItemText;
use App\Legacy\Quotations\MaterialMap;
use App\Legacy\Quotations\QuotationReader;
use App\Legacy\Search\SearchKey;
use App\Legacy\Support\Money;

/* DB-free checks of the read model's small pure parts. */

it('rounds money exactly like the browser roundMoney2 (golden rounding.json)', function () {
    $golden = json_decode((string) file_get_contents(base_path('../fixtures/golden/rounding.json')), true, 512, JSON_THROW_ON_ERROR);
    $cases = array_values(array_filter($golden['cases'], fn ($c) => $c['fn'] === 'roundMoney2'));
    expect($cases)->not->toBeEmpty();
    foreach ($cases as $c) {
        expect(Money::round2((float) $c['input']))->toBe((float) $c['expected'], 'roundMoney2('.json_encode($c['input']).')');
    }
    // Values checked against node's Math.round(v * 100) / 100.
    expect(Money::round2(2.675))->toBe(2.68)
        ->and(Money::round2(1.005))->toBe(1.0)
        ->and(Money::round2(1.015))->toBe(1.01)
        ->and(Money::round2(-0.004))->toBe(0.0)
        ->and(Money::round2(-0.025))->toBe(-0.02); // Math.round(-2.5) = -2
});

it('reads stored DECIMAL values as 2-dp strings', function () {
    expect(Money::decimal('158.60'))->toBe('158.60')
        ->and(Money::decimal('158.6'))->toBe('158.60')
        ->and(Money::decimal('7'))->toBe('7.00')
        ->and(Money::decimal(12.5))->toBe('12.50')
        ->and(Money::decimal(0))->toBe('0.00')
        ->and(Money::decimal(null))->toBeNull()
        ->and(Money::decimal('abc'))->toBeNull();
});

it('maps every legacy material code into Material · Treatment · Property Class', function (string $code, ?string $key, string $label, ?string $treatment, ?string $class, bool $finish) {
    $m = MaterialMap::read($code);
    expect($m)->toMatchArray(['code' => $code, 'key' => $key, 'label' => $label, 'treatment' => $treatment,
        'propertyClass' => $class, 'hasFinish' => $finish, 'recognised' => true]);
})->with([
    ['MS', 'MS', 'MS', null, null, true],
    ['S45C', 'S45C', 'S45C', null, null, true],
    ['4140', '4140_QT', '4140 QT', null, null, true],
    ['4140_PLAIN', '4140_PLAIN', '4140', null, null, true],
    ['4340', '4340_QT', '4340 QT', null, null, true],
    ['4140_HARDEN_G10_9', '4140_QT', '4140 QT', 'HARDEN', '10.9', true],
    ['S45C_HARDEN_G8_8', 'S45C', 'S45C', 'HARDEN', '8.8', true],
    ['Y_BAR', 'Y_BAR', 'Y BAR', null, null, true],
    ['SS304', 'SS304', 'SS304', null, null, false],
    ['SS316', 'SS316', 'SS316', null, null, false],
]);

it('keeps an unknown material as written instead of guessing', function () {
    expect(MaterialMap::read('BRASS'))->toMatchArray(['code' => 'BRASS', 'key' => null, 'label' => 'BRASS', 'recognised' => false])
        ->and(MaterialMap::read(''))->toBeNull()
        ->and(MaterialMap::read(['x']))->toBeNull();
});

it('ports displayItemDesc and materialLabel', function () {
    expect(LegacyItemText::displayDesc(['desc' => '4140 FULLSIZE L BOLT', 'material' => '4140']))->toBe('4140 QT FULLSIZE L BOLT')
        ->and(LegacyItemText::displayDesc(['desc' => '4140 QT FULLSIZE L BOLT']))->toBe('4140 QT FULLSIZE L BOLT')
        ->and(LegacyItemText::displayDesc(['desc' => '4140 STUD', 'material' => '4140_PLAIN']))->toBe('4140 STUD')
        ->and(LegacyItemText::displayDesc(['desc' => '4340 FULLSIZE STUD']))->toBe('4340 QT FULLSIZE STUD')
        ->and(LegacyItemText::displayDesc(['desc' => 'S45C_HARDEN_G8_8 STUD']))->toBe('S45C + HARDEN = G8.8 STUD')
        ->and(LegacyItemText::materialLabel('4140_HARDEN_G10_9'))->toBe('4140 QT + HARDEN = G10.9')
        ->and(LegacyItemText::materialLabel('Y_BAR'))->toBe('Y BAR');
});

it('ports wasDisplayData, keeping the triangle plate when the set has one', function () {
    $item = ['size' => "M20 x L 600\nBase Plate: 1\nTriangle Plate: 2", 'formData' => ['trianglePlateQtyPerSet' => '2']];
    expect(LegacyItemText::wasDisplay($item))->toBe(['abLine' => 'M20 x L 600', 'compLines' => "Base Plate: 1\nTriangle Plate: 2",
        'size' => "M20 x L 600\nBase Plate: 1\nTriangle Plate: 2"]);
    $item['formData']['trianglePlateQtyPerSet'] = 0;
    expect(LegacyItemText::wasDisplay($item)['size'])->toBe("M20 x L 600\nBase Plate: 1");
});

it('reads a legacy manual-priced item with accessories without inventing an accessory share', function () {
    $item = ItemReader::read(['productType' => 'STUD', 'material' => 'MS', 'sizeType' => '', 'cleanSize' => 'M12',
        'finalUnitPrice' => 10, 'totalAmount' => 50, 'qty' => 5, 'priceMode' => 'manual',
        'accessories' => ['nut' => ['enabled' => true, 'qty' => 2, 'unitPrice' => 1]]], 1);
    expect($item['pricing'])->toMatchArray(['model' => 'legacy', 'customerUnitPrice' => 10.0, 'boltUnitPrice' => 10.0,
        'accessoryUnitPrice' => null, 'ambiguous' => false, 'total' => 50.0]);
});

it('derives a bolt-separate line only the way dcMigrateItemPricing does', function () {
    $item = ItemReader::read(['pricingModel' => 'bolt-separate', 'finalUnitPrice' => 4.1, 'accessoryUnitPrice' => 0.7, 'qty' => 3], 1);
    expect($item['pricing'])->toMatchArray(['customerUnitPrice' => 4.8, 'boltUnitPrice' => 4.1, 'total' => 14.4, 'totalSource' => 'derived-legacy-rule']);

    $noTotal = ItemReader::read(['pricingModel' => 'accessory-inclusive', 'finalUnitPrice' => 2], 1);
    expect($noTotal['pricing'])->toMatchArray(['total' => null, 'totalSource' => 'missing']);
});

it('never throws on hostile item shapes', function (mixed $raw) {
    $item = ItemReader::read($raw, 3);
    expect($item['position'])->toBe(3)->and($item['raw'])->toBe($raw);
})->with([
    'string' => 'oops', 'number' => 42, 'null' => null, 'list' => [[1, 2]],
    'array desc' => [['desc' => ['x'], 'size' => 'M12']],
    'array mode' => [['finalUnitPrice' => 'abc', 'priceMode' => ['auto'], 'accessories' => ['nut' => ['enabled' => true, 'qty' => 'x']]]],
]);

it('classifies the items column: missing, empty, unreadable, ok', function () {
    expect(QuotationReader::items(null)[0])->toBe('missing')
        ->and(QuotationReader::items('[]')[0])->toBe('empty')
        ->and(QuotationReader::items('')[0])->toBe('unreadable')
        ->and(QuotationReader::items('{"a":1}')[0])->toBe('unreadable')
        ->and(QuotationReader::items('"text"')[0])->toBe('unreadable')
        ->and(QuotationReader::items('[{"desc":"x"')[0])->toBe('unreadable')
        ->and(QuotationReader::items('[{"desc":"x"}]')[0])->toBe('ok');
});

it('builds normalised search keys (foundation only)', function () {
    expect(SearchKey::compact('Acme Eng. Sdn-Bhd'))->toBe('ACMEENGSDNBHD')
        ->and(SearchKey::compact('m12 sag-rod'))->toBe('M12SAGROD')
        ->and(SearchKey::tokens('ms under size  sag-rod, m12'))->toBe('MS UNDERSIZE SAG ROD M12')
        ->and(SearchKey::digits('012-345 6789'))->toBe('0123456789');
});
