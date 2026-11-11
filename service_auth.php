<?php
/**
 * Der-Cheng Quotation — service API: configuration, signing, replay and actor
 * checks. FUNCTIONS AND CONSTANTS ONLY; including this file does nothing.
 *
 * Contract and operator notes: docs/SERVICE-API.md
 *
 * service.php is the only entry point. It is a server-to-server door for the
 * DNC Quick Quote backend, separate from the browser door (api.php + auth.php
 * sessions), which is left exactly as it is. This file never starts a session,
 * never reads or sets a cookie and never sends a CORS header.
 *
 * NEVER LOGGED, NEVER RETURNED: the secret, a signature, the request body or
 * any SQL / driver text. A refusal logs a reason code; the caller gets a
 * stable machine code and a fixed, generic message.
 *
 * The acting user is checked with QUO's OWN per-request rule for Portal users
 * — dc_dnc_session_check() in dnc_handoff.php — not a second copy of it.
 * dnc_handoff.php (and auth.php, which it loads) only define functions and
 * constants; nothing here calls any session function from them.
 */

require_once __DIR__ . '/dnc_handoff.php';

/** First line of every signing string. Changes only with the wire contract. */
const DC_SERVICE_SCHEME        = 'qqs1';
const DC_SERVICE_NAME          = 'quo-service';
/** Bumped when a request or response shape changes incompatibly. */
const DC_SERVICE_CONTRACT      = 1;
const DC_SERVICE_DEFAULT_KEYID = 'qq-backend-1';
/** Seconds either side of the server clock a timestamp may be. */
const DC_SERVICE_WINDOW        = 60;
/** Largest request body read, in bytes. */
const DC_SERVICE_MAX_BODY      = 524288;
/** Smallest accepted key, in bytes after base64 decoding. */
const DC_SERVICE_MIN_KEY_BYTES = 32;
const DC_SERVICE_NONCE_TABLE   = 'service_request_nonces';

/** The whole allow-list. Anything else is unknown_action. */
const DC_SERVICE_ACTIONS = [
    'ping',
    'diameter_settings.get',
    'companies.search',
    'contacts.lookup',
    'contacts.link',
    'whatsapp_template.get',
    'quotations.create',
    'quotations.lookup_by_key',
];

/** code => [HTTP status, fixed message]. The only errors this door can send. */
const DC_SERVICE_ERRORS = [
    'not_available'           => [404, 'Not available'],
    'method_not_allowed'      => [405, 'Method not allowed'],
    'unsupported_media_type'  => [415, 'Content-Type must be application/json'],
    'payload_too_large'       => [413, 'Request body too large'],
    'browser_request_refused' => [403, 'Request refused'],
    'invalid_signature'       => [401, 'Request could not be authenticated'],
    'timestamp_out_of_window' => [401, 'Request timestamp is outside the accepted window'],
    'replayed'                => [409, 'Request was already received'],
    'unknown_action'          => [404, 'Unknown action'],
    'invalid_body'            => [400, 'Request body is not valid'],
    'actor_refused'           => [403, 'Acting user is not allowed'],
    'actor_check_unavailable' => [503, 'Acting user could not be checked'],
    'validation_failed'       => [422, 'Request parameters are not valid'],
    'not_found'               => [404, 'Not found'],
    'contact_conflict'        => [409, 'Contact conflicts with an existing link'],
    'quo_unavailable'         => [503, 'Service temporarily unavailable'],
    'core_not_accepted'       => [412, 'Client core version is not accepted'],
    // quotations.create (docs/SERVICE-API.md 4.8)
    'create_disabled'         => [403, 'Quotation create is not enabled'],
    'settings_changed'        => [409, 'Diameter Settings have changed; reload them and price again'],
    'totals_mismatch'         => [422, 'Quotation total does not match its items'],
    'key_reused_with_different_payload' => [409, 'Idempotency key was already used for a different quotation'],
    'in_progress'             => [409, 'Another save is in progress; retry with the same key'],
];

// ── Nonce housekeeping (docs/SERVICE-API.md §6.1) ───────────────────────────
/** Extra clock disagreement allowed for on top of the ±60 s window. */
const DC_SERVICE_NONCE_SKEW           = 60;
/**
 * The youngest a pruned nonce can ever be. A nonce stored at server time t can
 * only be replayed by a request whose timestamp is within ±WINDOW of a later
 * server time, and that request's own timestamp was within ±WINDOW of t: so
 * nothing older than t + 2·WINDOW can replay it. Floor = 2·WINDOW + SKEW +
 * 60 s margin = 240 s. No configuration can go below it.
 */
const DC_SERVICE_NONCE_KEEP_FLOOR     = 2 * DC_SERVICE_WINDOW + DC_SERVICE_NONCE_SKEW + 60;
/** Default age after which a nonce row may be pruned (10 minutes). */
const DC_SERVICE_NONCE_KEEP_DEFAULT   = 600;
const DC_SERVICE_NONCE_KEEP_MAX       = 86400;
/** Default: one accepted request in 50 runs the prune. 0 = never. */
const DC_SERVICE_NONCE_PRUNE_EVERY    = 50;
const DC_SERVICE_NONCE_PRUNE_EVERY_MAX = 10000;
/** Default and largest number of rows one prune may delete. */
const DC_SERVICE_NONCE_PRUNE_BATCH    = 500;
const DC_SERVICE_NONCE_PRUNE_BATCH_MAX = 5000;

// ── Core-version gate (docs/SERVICE-API.md §3.7) ────────────────────────────
/** core name => [file beside service.php, contract constant in it, contract this service supports]. */
const DC_SERVICE_CORES = [
    'parser'  => ['quo-parser-core.js',  'QUO_PARSER_CORE_CONTRACT',  1],
    'pricing' => ['quo-pricing-core.js', 'QUO_PRICING_CORE_CONTRACT', 1],
    'quote'   => ['quo-quote-core.js',   'QUO_QUOTE_CORE_CONTRACT',   1],
];
/** Actions that change data and therefore require all three cores accepted. */
const DC_SERVICE_CORE_GATED_ACTIONS = ['contacts.link', 'quotations.create'];

// ── quotations.create limits (docs/SERVICE-API.md §4.8) ─────────────────────
const DC_SERVICE_CREATE_MAX_ITEMS      = 100;
/** Largest JSON encoding of the items list accepted for one create, in bytes. */
const DC_SERVICE_CREATE_MAX_ITEMS_JSON = 262144;

// ── Configuration: the server-only file, and nothing else ────────────────────

/**
 * service_config.php (from service_config.sample.php; never in Git, on the
 * deploy's PROTECTED list). Deliberately NOT read from the environment: the
 * door opens only when that file exists on the server and says so.
 *
 * $path is for tests; production always uses the file beside this one.
 *
 * @return array  [] when the file is missing or does not return an array
 */
function dc_service_config_file($path = null) {
    $path = $path ?? (__DIR__ . '/service_config.php');
    if (!is_file($path)) return [];
    try {
        $loaded = include $path;
    } catch (Throwable $e) {
        return [];
    }
    return is_array($loaded) ? $loaded : [];
}

/**
 * Raw key bytes from "base64:<base64 of at least 32 bytes>", or null. The
 * same format the handoff secret uses.
 */
function dc_service_parse_secret($value) {
    if (!is_string($value)) return null;
    $value = trim($value);
    if (strncmp($value, 'base64:', 7) !== 0) return null;
    $raw = base64_decode(substr($value, 7), true);
    if ($raw === false || strlen($raw) < DC_SERVICE_MIN_KEY_BYTES) return null;
    return $raw;
}

/**
 * The usable configuration, or null = DISABLED. Disabled when: no file,
 * QQ_SERVICE_ENABLED is not an explicit true, the key id is malformed, the
 * secret is missing / malformed / shorter than 32 bytes, a non-empty previous
 * secret is malformed, or the secret equals the handoff secret (one key must
 * never do two jobs).
 *
 * @return array{key_id:string, keys:list<string>}|null
 */
function dc_service_settings(?array $config = null) {
    $c = $config ?? dc_service_config_file();
    $enabled = $c['QQ_SERVICE_ENABLED'] ?? false;
    if ($enabled !== true
        && !(is_string($enabled) && in_array(strtolower(trim($enabled)), ['true', '1', 'on', 'yes'], true))) {
        return null;
    }
    $keyId = $c['QQ_SERVICE_KEY_ID'] ?? DC_SERVICE_DEFAULT_KEYID;
    if (!is_string($keyId) || preg_match('/^[A-Za-z0-9_-]{1,32}$/D', $keyId) !== 1) return null;

    $current = dc_service_parse_secret($c['QQ_SERVICE_SECRET'] ?? null);
    if ($current === null) return null;
    $keys = [$current];

    $previous = $c['QQ_SERVICE_SECRET_PREVIOUS'] ?? '';
    if (is_string($previous) && trim($previous) !== '') {
        $p = dc_service_parse_secret($previous);
        if ($p === null) return null;
        $keys[] = $p;
    } elseif (!is_string($previous) && $previous !== null) {
        return null;
    }

    foreach (['DNC_HANDOFF_SECRET', 'DNC_HANDOFF_SECRET_PREVIOUS'] as $name) {
        $h = dc_service_parse_secret(dc_dnc_config($name));
        if ($h === null) continue;
        foreach ($keys as $k) if (hash_equals($h, $k)) return null;
    }
    return ['key_id' => $keyId, 'keys' => $keys,
            'core_allow' => dc_service_core_allow_list($c['QQ_SERVICE_ACCEPTED_CORES'] ?? []),
            'create_enabled' => dc_service_create_enabled($c),
            'nonce'      => dc_service_nonce_policy($c)];
}

/** An integer setting clamped to [min, max]; $default when absent or not an integer. */
function dc_service_int_setting($v, $default, $min, $max) {
    if (is_string($v) && preg_match('/^\s*-?[0-9]{1,9}\s*$/D', $v) === 1) $v = (int)$v;
    if (!is_int($v)) return $default;
    return max($min, min($max, $v));
}

/**
 * Nonce housekeeping settings. keep never goes below DC_SERVICE_NONCE_KEEP_FLOOR,
 * whatever the file says.
 *
 * @return array{keep:int, every:int, batch:int}
 */
function dc_service_nonce_policy(array $c) {
    return [
        'keep'  => dc_service_int_setting($c['QQ_SERVICE_NONCE_KEEP_SECONDS'] ?? null, DC_SERVICE_NONCE_KEEP_DEFAULT, DC_SERVICE_NONCE_KEEP_FLOOR, DC_SERVICE_NONCE_KEEP_MAX),
        'every' => dc_service_int_setting($c['QQ_SERVICE_NONCE_PRUNE_EVERY'] ?? null, DC_SERVICE_NONCE_PRUNE_EVERY, 0, DC_SERVICE_NONCE_PRUNE_EVERY_MAX),
        'batch' => dc_service_int_setting($c['QQ_SERVICE_NONCE_PRUNE_BATCH'] ?? null, DC_SERVICE_NONCE_PRUNE_BATCH, 1, DC_SERVICE_NONCE_PRUNE_BATCH_MAX),
    ];
}

/**
 * The operator's list of additionally accepted (older) core COMBINATIONS, from
 * QQ_SERVICE_ACCEPTED_CORES['combinations']. An older core is accepted ONLY as
 * part of an exact listed parser + pricing + quote combination (hash and
 * contract of all three). Every entry also needs a non-empty reason and a
 * YYYY-MM-DD date; an entry that lacks one is ignored (never "accepted by
 * default"). Empty by default. The Loop #6 keys `parser`, `pricing` and
 * `pairs` are no longer read: a two-core listing cannot vouch for three.
 *
 * @return array{combinations:list<array>}
 */
function dc_service_core_allow_list($raw) {
    $out = ['combinations' => []];
    if (!is_array($raw)) return $out;
    $documented = function ($e) {
        return is_array($e)
            && is_string($e['reason'] ?? null) && trim($e['reason']) !== ''
            && is_string($e['date'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $e['date']) === 1;
    };
    $hash = function ($e) {
        if (!is_array($e)) return null;
        $sha = $e['sha256'] ?? null; $contract = $e['contract'] ?? null;
        if (!is_string($sha) || preg_match('/^[0-9a-f]{64}$/D', $sha) !== 1) return null;
        if (!is_int($contract) || $contract < 1) return null;
        return ['sha256' => $sha, 'contract' => $contract];
    };
    foreach ((is_array($raw['combinations'] ?? null) ? $raw['combinations'] : []) as $e) {
        if (!$documented($e)) continue;
        $c = [];
        foreach (array_keys(DC_SERVICE_CORES) as $core) {
            $h = $hash($e[$core] ?? null);
            if ($h === null) { $c = null; break; }
            $c[$core] = $h;
        }
        if ($c !== null) $out['combinations'][] = $c;
    }
    return $out;
}

/** QQ_SERVICE_CREATE_ENABLED: quotations.create is refused unless this is an explicit true. Default false. */
function dc_service_create_enabled(array $c) {
    $v = $c['QQ_SERVICE_CREATE_ENABLED'] ?? false;
    return $v === true || (is_string($v) && in_array(strtolower(trim($v)), ['true', '1', 'on', 'yes'], true));
}

// ── Core-version gate ────────────────────────────────────────────────────────

/**
 * This server's own deployed cores: SHA-256 of each file's exact bytes, and
 * the contract number read from its `const QUO_…_CORE_CONTRACT = <n>;` line
 * (parsed as text; the JavaScript is never run). A core is `null` (unknown)
 * when its file is missing or unreadable, the constant is absent, appears more
 * than once, or names a contract this service does not support.
 * Computed once per request per directory.
 *
 * @return array{parser:?array, pricing:?array, quote:?array}
 */
function dc_service_server_cores($dir = null) {
    static $cache = [];
    $dir = $dir ?? __DIR__;
    if (isset($cache[$dir])) return $cache[$dir];
    $out = [];
    foreach (DC_SERVICE_CORES as $core => [$file, $constant, $supported]) {
        $out[$core] = null;
        $path = $dir . '/' . $file;
        $src = is_file($path) && is_readable($path) ? @file_get_contents($path) : false;
        if (!is_string($src) || $src === '') continue;
        $n = preg_match_all('/^[ \t]*const[ \t]+' . $constant . '[ \t]*=[ \t]*([0-9]{1,6})[ \t]*;/m', $src, $m);
        if ($n !== 1 || (int)$m[1][0] !== $supported) continue;
        $out[$core] = ['sha256' => hash('sha256', $src), 'contract' => (int)$m[1][0]];
    }
    return $cache[$dir] = $out;
}

/**
 * The client's core claims, read from the SIGNED body only:
 *   {"client":{"cores":{"parser":{version,contract,sha256},"pricing":{…},"quote":{…}}}}
 * Headers, the query string and anything outside client.cores are never read.
 *
 * @return null|false|array  null = no claim; false = malformed;
 *                           else ['parser' => claim|null, 'pricing' => claim|null, 'quote' => claim|null]
 */
function dc_service_core_claims($raw) {
    $d = is_string($raw) ? json_decode($raw, true, 32) : null;
    if (!is_array($d) || !array_key_exists('client', $d) || $d['client'] === null) return null;
    $client = $d['client'];
    if (!is_array($client) || ($client !== [] && array_is_list($client))) return false;
    if (!array_key_exists('cores', $client) || $client['cores'] === null) return null;
    $cores = $client['cores'];
    if (!is_array($cores) || ($cores !== [] && array_is_list($cores))) return false;
    $out = [];
    foreach (array_keys(DC_SERVICE_CORES) as $core) {
        $c = $cores[$core] ?? null;
        if ($c === null) { $out[$core] = null; continue; }
        if (!is_array($c)) return false;
        $v = $c['version'] ?? null; $k = $c['contract'] ?? null; $s = $c['sha256'] ?? null;
        if (!is_string($v) || preg_match('/^\d{1,5}(\.\d{1,5}){0,3}$/D', $v) !== 1) return false;
        if (!is_int($k) || $k < 1 || $k > 999999) return false;
        if (!is_string($s) || preg_match('/^[0-9a-f]{64}$/D', $s) !== 1) return false;
        $out[$core] = ['version' => $v, 'contract' => $k, 'sha256' => $s];
    }
    if (count(array_filter($out)) === 0) return null;
    return $out;
}

/**
 * The verdict on a claim. Pure: the server cores and the operator list are
 * passed in.
 *
 *   accepted  true   all three cores are this server's own (current), or the
 *                    exact three-core combination is operator-listed;
 *             false  anything else, including a server core that is unknown;
 *             null   the client sent no claim at all.
 *   <core>.status    current | unknown_hash | contract_mismatch | server_unknown | missing | absent | malformed
 *   reason  accepted | combination_listed | no_claim | claim_malformed | claim_incomplete |
 *           server_core_unknown | contract_mismatch | mixed_versions | not_accepted
 */
function dc_service_core_evaluate($claims, array $server, array $allow) {
    $allow += ['combinations' => []];
    $names = array_keys(DC_SERVICE_CORES);
    if ($claims === null || $claims === false) {
        $st = $claims === null ? 'absent' : 'malformed';
        $r = ['accepted' => $claims === null ? null : false];
        foreach ($names as $core) $r[$core] = ['status' => $st];
        return $r + ['reason' => $claims === null ? 'no_claim' : 'claim_malformed'];
    }
    $status = []; $current = [];
    foreach ($names as $core) {
        $claim = $claims[$core] ?? null;
        $mine = $server[$core] ?? null;
        if ($mine === null)              $s = 'server_unknown';
        elseif ($claim === null)         $s = 'missing';
        elseif ($claim['contract'] !== DC_SERVICE_CORES[$core][2]) $s = 'contract_mismatch';
        elseif (hash_equals($mine['sha256'], $claim['sha256'])) $s = 'current';
        else $s = 'unknown_hash';
        $status[$core] = ['status' => $s];
        if ($claim !== null) $status[$core]['version'] = $claim['version'];
        $current[$core] = $s === 'current';
    }
    $result = ['accepted' => false] + $status;
    $has = fn ($s) => in_array($s, array_column($status, 'status'), true);

    /* A core this server cannot read is never vouched for, listed or not. */
    if ($has('server_unknown')) return $result + ['reason' => 'server_core_unknown'];
    if ($has('missing'))        return $result + ['reason' => 'claim_incomplete'];
    if (!in_array(false, $current, true)) {
        $result['accepted'] = true;
        return $result + ['reason' => 'accepted'];
    }
    foreach ($allow['combinations'] as $combo) {
        $match = true;
        foreach ($names as $core) {
            $match = $match && $combo[$core]['contract'] === $claims[$core]['contract']
                            && hash_equals($combo[$core]['sha256'], $claims[$core]['sha256']);
        }
        if ($match) { $result['accepted'] = true; return $result + ['reason' => 'combination_listed']; }
    }
    if ($has('contract_mismatch')) return $result + ['reason' => 'contract_mismatch'];
    return $result + ['reason' => in_array(true, $current, true) ? 'mixed_versions' : 'not_accepted'];
}

/**
 * THE GUARD. Every action that changes data calls this first and returns its
 * refusal unchanged. Only `accepted === true` passes; false and null (no claim)
 * are both refused.
 *
 * @param  mixed  $claims  dc_service_core_claims() of the signed body
 * @return array|null  null = may proceed; else ['error' => 'core_not_accepted', 'reason' => …]
 */
function dc_service_require_accepted_core($claims, array $allow = [], $dir = null) {
    $v = dc_service_core_evaluate($claims, dc_service_server_cores($dir), $allow);
    if ($v['accepted'] === true) return null;
    return ['error' => 'core_not_accepted', 'reason' => $v['reason']];
}

// ── Logging: a reason code, never a secret, signature, body or SQL ───────────

function dc_service_log($event, array $fields = []) {
    $line = '[service] ' . $event;
    foreach ($fields as $k => $v) {
        if ($v === null || $v === '') continue;
        /* Reason codes, action names, decimal ids and errnos only. Anything
           else is dropped rather than written. */
        $v = (string)$v;
        if (preg_match('/^[A-Za-z0-9_.:\-]{1,64}$/D', $v) !== 1) continue;
        $line .= ' ' . $k . '=' . $v;
    }
    $sink = $GLOBALS['DC_SERVICE_LOG_SINK'] ?? null;   // tests capture here
    if (is_callable($sink)) { $sink($line); return; }
    error_log($line);
}

// ── Signing (docs/SERVICE-API.md §3) ─────────────────────────────────────────

function dc_service_b64url($bytes) {
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

/**
 * The exact bytes that are signed: six lines joined by "\n", no trailing
 * newline. The acting user and the request id are inside the body, so the
 * body hash covers them.
 */
function dc_service_signing_string($action, $timestamp, $nonce, $body) {
    return implode("\n", [
        DC_SERVICE_SCHEME,
        'POST',
        (string)$action,
        (string)$timestamp,
        (string)$nonce,
        hash('sha256', (string)$body),
    ]);
}

/** base64url, unpadded, of HMAC-SHA256(key bytes, signing string). */
function dc_service_sign($keyBytes, $action, $timestamp, $nonce, $body) {
    return dc_service_b64url(hash_hmac('sha256', dc_service_signing_string($action, $timestamp, $nonce, $body), $keyBytes, true));
}

/**
 * Constant-time check against the current key, then the previous one. Every
 * configured key is tried on every call so the time taken does not say which
 * (or whether) one matched.
 */
function dc_service_signature_ok(array $keys, $action, $timestamp, $nonce, $body, $provided) {
    if (!is_string($provided) || $provided === '') return false;
    $ok = false;
    foreach ($keys as $k) {
        if (hash_equals(dc_service_sign($k, $action, $timestamp, $nonce, $body), $provided)) $ok = true;
    }
    return $ok;
}

/** Shape checks for the signed header values. A bad shape is a bad signature. */
function dc_service_timestamp_shape_ok($ts) { return is_string($ts) && preg_match('/^[1-9][0-9]{9,10}$/D', $ts) === 1; }
function dc_service_nonce_shape_ok($n)      { return is_string($n) && preg_match('/^[0-9a-f]{32}$/D', $n) === 1; }

function dc_service_timestamp_in_window($ts, $now) {
    return abs((int)$now - (int)$ts) <= DC_SERVICE_WINDOW;
}

// ── Replay: the nonce primary key lets exactly one request through ──────────

/**
 * Records the nonce. Of two requests carrying the same nonce exactly one
 * INSERT succeeds; the other gets error 1062 from the primary key.
 *
 * @return string|null  null when stored now; 'replayed'; 'nonce_store_failed'
 */
function dc_service_consume_nonce($db, $nonce, $keyId, $now) {
    if (!($db instanceof mysqli)) return 'nonce_store_failed';
    $stmt = $db->prepare('INSERT INTO ' . DC_SERVICE_NONCE_TABLE . ' (nonce, key_id, received_at) VALUES (?, ?, FROM_UNIXTIME(?))');
    if (!$stmt) return 'nonce_store_failed';
    $ok = $stmt->bind_param('ssi', $nonce, $keyId, $now) && $stmt->execute();
    $errno = (int)$stmt->errno;
    $stmt->close();
    if ($ok) return null;
    return $errno === 1062 ? 'replayed' : 'nonce_store_failed';
}

/**
 * Deletes at most $batch nonce rows older than $keep seconds (never less than
 * DC_SERVICE_NONCE_KEEP_FLOOR), oldest first. Uses idx_srn_received. A row
 * younger than the floor can never be deleted, so a nonce that could still be
 * replayed inside the timestamp window always stays in the table.
 *
 * @param  int  $errno  set to the driver's error number on failure (0 otherwise)
 * @return int|null  rows deleted, or null when the statement failed
 */
function dc_service_prune_nonces($db, $now, $keep, $batch, &$errno = 0) {
    $errno = 0;
    if (!($db instanceof mysqli)) return null;
    $keep   = max(DC_SERVICE_NONCE_KEEP_FLOOR, (int)$keep);
    $batch  = max(1, min(DC_SERVICE_NONCE_PRUNE_BATCH_MAX, (int)$batch));
    $cutoff = (int)$now - $keep;
    $stmt = $db->prepare('DELETE FROM ' . DC_SERVICE_NONCE_TABLE . ' WHERE received_at < FROM_UNIXTIME(?) ORDER BY received_at LIMIT ?');
    if (!$stmt) { $errno = (int)$db->errno; return null; }
    $ok = $stmt->bind_param('ii', $cutoff, $batch) && $stmt->execute();
    $n = $ok ? (int)$stmt->affected_rows : null;
    if (!$ok) $errno = (int)$stmt->errno;
    $stmt->close();
    return $n;
}

/**
 * Opportunistic housekeeping, called only AFTER this request's own nonce is
 * stored. Runs on about one accepted request in `every` (random_int; no marker
 * file, no extra table). Any failure is logged and swallowed: it can neither
 * fail the request nor un-store a nonce, so replay protection is unaffected.
 *
 * @param  callable|null  $roll  tests only: replaces random_int(1, every) === 1
 * @return string  'skipped' | 'pruned' | 'failed'
 */
function dc_service_maybe_prune_nonces($db, $now, array $policy, ?callable $roll = null) {
    try {
        $every = (int)($policy['every'] ?? 0);
        if ($every < 1) return 'skipped';
        $hit = $roll ? (bool)$roll($every) : random_int(1, $every) === 1;
        if (!$hit) return 'skipped';
        $errno = 0;
        $n = dc_service_prune_nonces($db, $now, $policy['keep'] ?? DC_SERVICE_NONCE_KEEP_DEFAULT, $policy['batch'] ?? DC_SERVICE_NONCE_PRUNE_BATCH, $errno);
        if ($n === null) {
            dc_service_log('nonce.prune_failed', ['errno' => $errno ?: null]);
            return 'failed';
        }
        if ($n > 0) dc_service_log('nonce.pruned', ['rows' => $n]);
        return 'pruned';
    } catch (Throwable $e) {
        dc_service_log('nonce.prune_failed', ['type' => preg_replace('/[^A-Za-z0-9_]/', '', get_class($e))]);
        return 'failed';
    }
}

// ── Body and acting user ─────────────────────────────────────────────────────

/**
 * The decoded request envelope, or null. Must be a JSON object with
 * actor.sub (a positive JSON integer) and actor.username (a non-empty string);
 * params, when present, must be a JSON object.
 *
 * @return array{sub:int, username:string, params:array, request_id:?string}|null
 */
function dc_service_parse_body($raw) {
    if (!is_string($raw) || $raw === '') return null;
    $d = json_decode($raw, true, 32);
    if (!is_array($d) || ($d !== [] && array_is_list($d))) return null;
    $actor = $d['actor'] ?? null;
    if (!is_array($actor)) return null;
    $sub = $actor['sub'] ?? null;
    $username = $actor['username'] ?? null;
    if (!is_int($sub) || $sub <= 0) return null;
    if (!is_string($username) || $username === '' || strlen($username) > 255) return null;
    $params = $d['params'] ?? [];
    if (!is_array($params) || ($params !== [] && array_is_list($params))) return null;
    $rid = $d['requestId'] ?? null;
    /* Echoed back in meta for correlation, so only a plain token is kept. */
    if (!is_string($rid) || preg_match('/^[A-Za-z0-9_.:\-]{1,64}$/D', $rid) !== 1) $rid = null;
    return ['sub' => $sub, 'username' => $username, 'params' => $params, 'request_id' => $rid];
}

/**
 * QUO's own per-request rule for a Portal user, unchanged: the canonical row
 * is read fresh by users.id through the read-only connection, and refused
 * when missing, inactive, a legacy placeholder, must-change-password, or when
 * the username differs.
 *
 * @return string  'ok', 'unavailable', or a refusal reason code
 */
function dc_service_actor_check($sub, $username) {
    return dc_dnc_session_check(['dnc_user_id' => $sub, 'username' => $username]);
}
