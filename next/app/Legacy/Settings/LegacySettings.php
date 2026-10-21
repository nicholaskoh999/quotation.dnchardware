<?php

namespace App\Legacy\Settings;

use App\Legacy\DataSource;
use App\Legacy\LegacyNotConfigured;
use App\Legacy\LegacyReader;
use App\Legacy\LegacyUnavailable;

/**
 * Settings the read presentation needs, read only. No UI for default prices or
 * diameter settings (handoff §29 retires both screens; production holds 0 and
 * 1 rows respectively, §30) — accessors only.
 */
final class LegacySettings
{
    /** index.php WA_DEFAULT_TPL, byte for byte — what the legacy page falls back to. */
    public const WA_DEFAULT_TPL = "Hi {customer},\nQuotation {quotationNo} is ready.\nDate: {date}\n\nItems:\n{items}\n\nTotal: RM{total}\n\nPrepared by: {preparedBy}\nThank you.";

    public function __construct(private readonly LegacyReader $reader) {}

    /**
     * The default WhatsApp template (whatsapp_templates.is_default = 1, lowest
     * id), else the legacy built-in. `effectiveBody` is what the legacy page
     * actually uses: index.php sanitizeWATemplate() drops any {validUntil}
     * line.
     *
     * @return array{state: string, source: string, name: string, body: string, effectiveBody: string}
     */
    public function whatsappTemplate(): array
    {
        $state = DataSource::CONNECTED;
        $row = null;
        try {
            $row = $this->reader->selectOne(
                'SELECT id, template_name, template_body FROM whatsapp_templates WHERE is_default = 1 ORDER BY id ASC LIMIT 1',
            );
        } catch (LegacyNotConfigured|LegacyUnavailable $e) {
            $state = DataSource::fromThrowable($e);
        }
        $body = is_array($row) && is_string($row['template_body'] ?? null) && $row['template_body'] !== ''
            ? $row['template_body'] : null;

        return [
            'state' => $state,
            'source' => $body === null ? 'default' : 'database',
            'name' => $body === null ? 'Default' : (string) ($row['template_name'] ?? 'Default'),
            'body' => $body ?? self::WA_DEFAULT_TPL,
            'effectiveBody' => self::sanitizeWaTemplate($body ?? self::WA_DEFAULT_TPL),
        ];
    }

    /** index.php sanitizeWATemplate(). */
    public static function sanitizeWaTemplate(string $template): string
    {
        $t = (string) preg_replace('/^[^\r\n]*\{validUntil\}[^\r\n]*(?:\r?\n|$)/mi', '', $template);
        $t = (string) preg_replace('/\{validUntil\}/i', '', $t);

        return (string) preg_replace('/\n{3,}/', "\n\n", $t);
    }

    /** @return array{names: list<string>, note: string, persisted: bool} */
    public function issuers(): array
    {
        return LegacyIssuers::all();
    }

    /**
     * default_prices, shaped as api.php get_default_prices (snake_case keys
     * only). Production holds 0 rows; every default is a code built-in.
     *
     * @return list<array<string, mixed>>
     */
    public function defaultPrices(): array
    {
        return array_map(fn (array $r) => [
            'id' => (int) $r['id'],
            'product_type' => $r['product_type'],
            'material' => $r['material'],
            'size_type' => $r['size_type'] ?? '',
            'size' => $r['size'],
            'finish' => $r['finish'] ?? '',
            'cost_rate' => (float) $r['cost_rate'],
            'additional_cost' => (float) $r['additional_cost'],
            'markup' => (float) $r['markup'],
            'is_active' => (int) $r['is_active'],
        ], $this->reader->select('SELECT * FROM default_prices ORDER BY product_type, material, size_type, size, finish'));
    }

    /**
     * Active diameter_settings rows, shaped as api.php get_diameter_settings.
     * Production holds 1 row, redundant with the built-in tables.
     *
     * @return list<array<string, mixed>>
     */
    public function diameterSettings(): array
    {
        return array_map(fn (array $r) => [
            'id' => (int) $r['id'],
            'product_type' => $r['product_type'],
            'material' => $r['material'],
            'size_type' => $r['size_type'] ?? '',
            'size' => $r['size'],
            'diameter' => (float) $r['diameter'],
            'is_active' => (int) $r['is_active'],
        ], $this->reader->select('SELECT * FROM diameter_settings WHERE is_active = 1 ORDER BY product_type, material, size_type, size'));
    }
}
