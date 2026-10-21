<?php

namespace App\Legacy\Quotations;

/**
 * Ports of the legacy index.php readers that decide how a SAVED item is shown
 * (materialLabel, displayItemDesc, wasDisplayData). They only read; they never
 * produce new customer wording (the §14 hardened wording is the output wave's
 * job and is deliberately not applied here).
 */
final class LegacyItemText
{
    /** index.php materialLabel(). */
    public static function materialLabel(?string $material): string
    {
        $labels = [
            'S45C_HARDEN_G8_8' => 'S45C + HARDEN = G8.8',
            '4140' => '4140 QT',
            '4340' => '4340 QT',
            '4140_HARDEN_G10_9' => '4140 QT + HARDEN = G10.9',
            '4140_PLAIN' => '4140',
            'Y_BAR' => 'Y BAR',
        ];

        return $labels[(string) $material] ?? (string) $material;
    }

    /**
     * index.php displayItemDesc(): repairs very old descriptions that stored
     * the raw internal value ("4140" meaning 4140 QT) and the combined
     * hardened codes; never rewrites the newer 4140-plain / Y BAR items.
     *
     * @param  array<string, mixed>  $item
     */
    public static function displayDesc(array $item): string
    {
        $desc = is_scalar($item['desc'] ?? null) ? (string) $item['desc'] : '';
        if (str_contains($desc, '4140_HARDEN_G10_9')) {
            return str_replace('4140_HARDEN_G10_9', '4140 QT + HARDEN = G10.9', $desc);
        }
        if (str_contains($desc, 'S45C_HARDEN_G8_8')) {
            return str_replace('S45C_HARDEN_G8_8', 'S45C + HARDEN = G8.8', $desc);
        }
        $mat = is_scalar($item['material'] ?? null) ? (string) $item['material'] : '';
        if ($mat === '4140_PLAIN' || $mat === 'Y_BAR') {
            return $desc;
        }
        $desc = (string) preg_replace('/\b4140\b(?!\s+QT)/', '4140 QT', $desc);

        return (string) preg_replace('/\b4340\b(?!\s+QT)/', '4340 QT', $desc);
    }

    /**
     * index.php wasDisplayData(): the Welding Anchor Set's anchor line and
     * component lines, with the triangle-plate line dropped when the set
     * carries none.
     *
     * @param  array<string, mixed>  $item
     * @return array{abLine: string, compLines: string, size: string}
     */
    public static function wasDisplay(array $item): array
    {
        $raw = is_scalar($item['size'] ?? null) ? (string) $item['size'] : '';
        $rawLines = explode("\n", $raw);
        $was = is_array($item['wasData'] ?? null) ? $item['wasData'] : [];
        $abLine = trim(self::firstTruthy([$was['abLine'] ?? null, $item['dimensionPreview'] ?? null, $rawLines[0] ?? '']));
        $compLines = self::firstTruthy([$was['compLines'] ?? null, implode("\n", array_slice($rawLines, 1))]);
        $fd = is_array($item['formData'] ?? null) ? $item['formData'] : [];
        $tpQty = $fd['trianglePlateQtyPerSet'] ?? ($fd['tpQty'] ?? null);
        // JS Number(x) === 0 — true for 0, "0", "" and whitespace, false for null/undefined.
        $isZero = $tpQty === false
            || (is_string($tpQty) && trim($tpQty) === '')
            || (is_numeric($tpQty) && (float) $tpQty === 0.0);
        if ($tpQty !== null && $isZero) {
            $compLines = implode("\n", array_values(array_filter(
                explode("\n", $compLines),
                fn ($line) => ! str_contains($line, 'Triangle Plate:'),
            )));
        }

        return [
            'abLine' => $abLine,
            'compLines' => $compLines,
            'size' => implode("\n", array_values(array_filter([$abLine, $compLines], fn ($s) => $s !== ''))),
        ];
    }

    /** JS `a || b || c` over strings. */
    private static function firstTruthy(array $values): string
    {
        foreach ($values as $v) {
            if (is_scalar($v) && (string) $v !== '' && $v !== false) {
                return (string) $v;
            }
        }

        return '';
    }
}
