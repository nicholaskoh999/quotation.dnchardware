<?php

namespace App\Handoff;

use Illuminate\Support\Facades\Log;

/**
 * Handoff log lines: an event and reason codes, NEVER a token, state, secret,
 * password or session id. Port of legacy dc_handoff_log(): every value must
 * be a short code, an IP, a 32-hex jti or a decimal id; anything else is
 * dropped rather than written.
 */
class HandoffLog
{
    /** @param  array<string, mixed>  $fields */
    public function write(string $event, array $fields = []): void
    {
        $line = '[handoff] '.$event;
        foreach ($fields as $key => $value) {
            if ($value === null || $value === '' || ! is_scalar($value)) {
                continue;
            }
            $value = (string) $value;
            if (preg_match('/^[A-Za-z0-9_.:\-]{1,64}$/', $value) !== 1) {
                continue;
            }
            $line .= ' '.$key.'='.$value;
        }
        $this->emit($line);
    }

    protected function emit(string $line): void
    {
        Log::warning($line);
    }
}
