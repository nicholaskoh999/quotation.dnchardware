<?php

namespace App\Legacy\Quotations;

/**
 * Reads a stored legacy material code into the structured model the owner
 * locked in handoff §13 — Material · Treatment · Property Class — WITHOUT
 * changing what was stored. The stored code is always returned beside the
 * reading (`code`), so nothing is lost and nothing is rewritten.
 *
 *   stored               material   treatment  property class
 *   4140                 4140 QT    —          —        (legacy 4140 reads as QT)
 *   4140_PLAIN           4140       —          —        (non-QT / plain)
 *   4340                 4340 QT    —          —
 *   4140_HARDEN_G10_9    4140 QT    HARDEN     10.9
 *   S45C_HARDEN_G8_8     S45C       HARDEN     8.8
 *   Y_BAR                Y BAR      —          —        (Y BAR is a genuine material)
 *
 * An unknown code is returned as written with recognised = false — it is
 * never guessed into one of the canonical materials.
 */
final class MaterialMap
{
    /** code => [key, label, treatment, propertyClass] */
    private const MAP = [
        'MS' => ['MS', 'MS', null, null],
        'S45C' => ['S45C', 'S45C', null, null],
        'S45C_HARDEN_G8_8' => ['S45C', 'S45C', 'HARDEN', '8.8'],
        '4140' => ['4140_QT', '4140 QT', null, null],
        '4140_PLAIN' => ['4140_PLAIN', '4140', null, null],
        '4140_HARDEN_G10_9' => ['4140_QT', '4140 QT', 'HARDEN', '10.9'],
        '4340' => ['4340_QT', '4340 QT', null, null],
        'SS304' => ['SS304', 'SS304', null, null],
        'SS316' => ['SS316', 'SS316', null, null],
        'Y_BAR' => ['Y_BAR', 'Y BAR', null, null],
    ];

    /** Materials quoted without a finish (legacy DC_NO_FINISH_MATERIALS). */
    private const NO_FINISH = ['SS304', 'SS316'];

    /**
     * @return array{code: string|null, key: string|null, label: string, legacyLabel: string, treatment: string|null, propertyClass: string|null, hasFinish: bool, recognised: bool}|null
     */
    public static function read(mixed $code): ?array
    {
        if ($code === null || ! is_scalar($code)) {
            return null;
        }
        $code = trim((string) $code);
        if ($code === '') {
            return null;
        }
        $hit = self::MAP[strtoupper($code)] ?? null;

        return [
            'code' => $code,
            'key' => $hit[0] ?? null,
            'label' => $hit[1] ?? $code,
            'legacyLabel' => LegacyItemText::materialLabel($code),
            'treatment' => $hit[2] ?? null,
            'propertyClass' => $hit[3] ?? null,
            'hasFinish' => ! in_array($hit[0] ?? strtoupper($code), self::NO_FINISH, true),
            'recognised' => $hit !== null,
        ];
    }
}
