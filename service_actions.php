<?php
/**
 * Der-Cheng Quotation — service API: the allow-listed actions.
 * FUNCTIONS ONLY; including this file does nothing. Contract: docs/SERVICE-API.md
 *
 * Every handler takes the open Quotation database handle, the request's
 * params object and the verified acting user, and RETURNS either
 *     ['data' => array]                                   success, or
 *     ['error' => code, 'field' => ?, 'reason' => ?]      a refusal
 * It never prints, never exits and never returns driver or SQL text.
 *
 * The 4th argument, $ctx, carries the signed body's core claims and the
 * operator's accepted-core list. EVERY handler that writes must call
 * dc_service_require_accepted_core() before anything else (a static test
 * enforces it); read-only handlers do not.
 *
 * WRITES. Exactly one statement in this file changes data: the INSERT into
 * company_whatsapp_contacts in dc_service_contacts_link(). Quotation creation
 * lives in service_quotations.php and goes through the shared quotation store only.
 * Nothing here edits or deletes a quotation, a company or a setting, and no
 * statement names `companies` except to read it.
 */

/** A company's short code as the contract reports it: null when empty. */
function dc_service_short_code($v) {
    $v = is_string($v) ? trim($v) : '';
    return $v === '' ? null : $v;
}

function dc_service_iso_utc($unix) {
    return gmdate('Y-m-d\TH:i:s\Z', (int)$unix);
}

// ── ping ─────────────────────────────────────────────────────────────────────

/** Proves the signature, clock, nonce store and actor check. No business table. */
function dc_service_ping($db, array $params, array $actor, array $ctx = []) {
    $now = time();
    return ['data' => [
        'service'        => DC_SERVICE_NAME,
        'contract'       => DC_SERVICE_CONTRACT,
        'scheme'         => DC_SERVICE_SCHEME,
        'actions'        => DC_SERVICE_ACTIONS,
        'serverTime'     => dc_service_iso_utc($now),
        'serverTimeUnix' => $now,
        // quotations.create is switched on (QQ_SERVICE_CREATE_ENABLED). Not a verdict on the core.
        'createEnabled'  => ($ctx['create_enabled'] ?? false) === true,
    ]];
}

// ── diameter_settings.get ────────────────────────────────────────────────────

/**
 * The rows QUO's own page receives. The query and the row mapping below are
 * the ones in api.php's get_diameter_settings, character for character;
 * tests/php/service_api.test.php runs api.php's block and this function
 * against the same table and requires identical output.
 *
 * @return list<array>|null  null when the table cannot be read
 */
function dc_service_diameter_rows($db) {
    $res = $db->query("SELECT * FROM diameter_settings WHERE is_active=1 ORDER BY product_type, material, size_type, size");
    if (!$res) return null;
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $rows[] = [
            'id'=>(int)$r['id'],'type'=>$r['product_type'],'product_type'=>$r['product_type'],
            'material'=>$r['material'],'sizeType'=>$r['size_type'] ?? '','size_type'=>$r['size_type'] ?? '',
            'size'=>$r['size'],'diameter'=>(float)$r['diameter'],
            'active'=>(string)$r['is_active'],'is_active'=>(int)$r['is_active']
        ];
    }
    return $rows;
}

/**
 * "ds1-" + the first 16 hex of SHA-256 over json_encode($rows) — the same
 * encoding api.php uses for its response. It changes exactly when a row the
 * page would receive changes (value, order, addition, removal, activation).
 */
function dc_service_diameter_version(array $rows) {
    return 'ds1-' . substr(hash('sha256', (string)json_encode($rows)), 0, 16);
}

function dc_service_diameter_settings_get($db, array $params, array $actor, array $ctx = []) {
    $rows = dc_service_diameter_rows($db);
    if ($rows === null) {
        dc_service_log('action.failed', ['action' => 'diameter_settings.get', 'reason' => 'read_failed', 'errno' => (int)$db->errno]);
        return ['error' => 'quo_unavailable'];
    }
    return ['data' => [
        'rules'     => $rows,
        'version'   => dc_service_diameter_version($rows),
        'ruleCount' => count($rows),
        'fetchedAt' => dc_service_iso_utc(time()),
    ]];
}

// ── companies.search ─────────────────────────────────────────────────────────

/** Makes %, _ and the escape character itself literal inside a LIKE pattern. */
function dc_service_like_escape($s) {
    return str_replace(['|', '%', '_'], ['||', '|%', '|_'], $s);
}

/**
 * "Contains" search on companies.name or companies.short_code. The counters
 * and the name ordering are get_companies' own (api.php); id is added as a
 * tie-breaker so a truncated list is stable. Phone and address are never
 * selected.
 */
function dc_service_companies_search($db, array $params, array $actor, array $ctx = []) {
    $q = $params['q'] ?? null;
    if (!is_string($q)) return ['error' => 'validation_failed', 'field' => 'q'];
    $q = trim($q);
    $len = mb_strlen($q, 'UTF-8');
    if ($len < 2 || $len > 100 || !mb_check_encoding($q, 'UTF-8')) return ['error' => 'validation_failed', 'field' => 'q'];

    $limit = $params['limit'] ?? 20;
    if (!is_int($limit) || $limit < 1 || $limit > 50) return ['error' => 'validation_failed', 'field' => 'limit'];

    $sql = "SELECT c.id, c.name, c.short_code,
        COALESCE(qs.quotation_count, 0) AS quotation_count,
        qs.latest_quotation_date
    FROM companies c
    LEFT JOIN (
        SELECT
            company_id,
            COUNT(*) AS quotation_count,
            MAX(COALESCE(quote_date, DATE(created_at))) AS latest_quotation_date,
            MAX(created_at) AS latest_quotation_created_at
        FROM quotations
        WHERE company_id IS NOT NULL
        GROUP BY company_id
    ) qs ON qs.company_id = c.id
    WHERE c.name LIKE ? ESCAPE '|' OR c.short_code LIKE ? ESCAPE '|'
    ORDER BY c.name ASC, c.id ASC
    LIMIT ?";
    $like = '%' . dc_service_like_escape($q) . '%';
    $fetch = $limit + 1;   // one extra row tells "truncated" without a COUNT
    $stmt = $db->prepare($sql);
    $res = null;
    if ($stmt && $stmt->bind_param('ssi', $like, $like, $fetch) && $stmt->execute()) $res = $stmt->get_result();
    if (!$res) {
        dc_service_log('action.failed', ['action' => 'companies.search', 'reason' => 'read_failed', 'errno' => (int)($stmt ? $stmt->errno : $db->errno)]);
        if ($stmt) $stmt->close();
        return ['error' => 'quo_unavailable'];
    }
    $out = [];
    while ($r = $res->fetch_assoc()) {
        $out[] = [
            'id'                => (int)$r['id'],
            'name'              => (string)$r['name'],
            'shortCode'         => dc_service_short_code($r['short_code']),
            'quotationCount'    => (int)$r['quotation_count'],
            'lastQuotationDate' => $r['latest_quotation_date'] === null ? null : (string)$r['latest_quotation_date'],
        ];
    }
    $stmt->close();
    $truncated = count($out) > $limit;
    if ($truncated) $out = array_slice($out, 0, $limit);
    return ['data' => ['companies' => $out, 'truncated' => $truncated]];
}

// ── WhatsApp identity ────────────────────────────────────────────────────────

/**
 * The identity a request carries, normalized. A display name is NEVER part of
 * it. waPhone: digits with country code, 8–15 digits, no leading zero; a
 * leading "+" and spaces, hyphens, dots and brackets are dropped first.
 * waChatId: WhatsApp's own identifier, 3–64 of [A-Za-z0-9@._:-].
 *
 * @return array{phone:?string, chat:?string, kind:string, group:bool}|array{error:string, field:string}
 */
function dc_service_identity(array $params) {
    $kind = $params['chatKind'] ?? null;
    if (!is_string($kind) || !in_array($kind, ['individual', 'group', 'unknown'], true)) {
        return ['error' => 'validation_failed', 'field' => 'chatKind'];
    }
    $phone = $params['waPhone'] ?? null;
    if ($phone !== null) {
        if (!is_string($phone)) return ['error' => 'validation_failed', 'field' => 'waPhone'];
        $phone = preg_replace('/[ ().\-]+/', '', $phone);
        if (is_string($phone) && strncmp($phone, '+', 1) === 0) $phone = substr($phone, 1);
        if (!is_string($phone) || preg_match('/^[1-9][0-9]{7,14}$/D', $phone) !== 1) {
            return ['error' => 'validation_failed', 'field' => 'waPhone'];
        }
    }
    $chat = $params['waChatId'] ?? null;
    if ($chat !== null) {
        if (!is_string($chat) || preg_match('/^[A-Za-z0-9@._:\-]{3,64}$/D', $chat) !== 1) {
            return ['error' => 'validation_failed', 'field' => 'waChatId'];
        }
    }
    /* A WhatsApp group identifier ends in @g.us whatever chatKind says. */
    $group = $kind === 'group' || ($chat !== null && preg_match('/@g\.us$/i', $chat) === 1);
    return ['phone' => $phone, 'chat' => $chat, 'kind' => $kind, 'group' => $group];
}

// ── contacts.lookup (pure read) ──────────────────────────────────────────────

/**
 * Which companies is this WhatsApp identity linked to? Active links only,
 * joined to companies so a link whose company is gone never matches. Reads
 * only: it does not fill a missing identifier and does not touch
 * last_matched_at.
 */
function dc_service_contacts_lookup($db, array $params, array $actor, array $ctx = []) {
    $idn = dc_service_identity($params);
    if (isset($idn['error'])) return $idn;
    if ($idn['group'] || ($idn['phone'] === null && $idn['chat'] === null)) {
        return ['data' => ['status' => 'none']];
    }
    $sql = "SELECT w.id, w.company_id, c.name, c.short_code, UNIX_TIMESTAMP(w.last_matched_at) AS last_used
            FROM company_whatsapp_contacts w
            JOIN companies c ON c.id = w.company_id
            WHERE w.is_active = 1 AND (w.wa_phone = ? OR w.wa_chat_id = ?)
            ORDER BY (w.last_matched_at IS NULL) ASC, w.last_matched_at DESC, w.id ASC
            LIMIT 200";
    $stmt = $db->prepare($sql);
    $res = null;
    if ($stmt && $stmt->bind_param('ss', $idn['phone'], $idn['chat']) && $stmt->execute()) $res = $stmt->get_result();
    if (!$res) {
        dc_service_log('action.failed', ['action' => 'contacts.lookup', 'reason' => 'read_failed', 'errno' => (int)($stmt ? $stmt->errno : $db->errno)]);
        if ($stmt) $stmt->close();
        return ['error' => 'quo_unavailable'];
    }
    /* One candidate per company: a company linked by phone in one row and by
       chat id in another is still one company. */
    $byCompany = [];
    while ($r = $res->fetch_assoc()) {
        $cid = (int)$r['company_id'];
        if (isset($byCompany[$cid])) continue;
        $byCompany[$cid] = [
            'contactId'  => (int)$r['id'],
            'company'    => ['id' => $cid, 'name' => (string)$r['name'], 'shortCode' => dc_service_short_code($r['short_code'])],
            'lastUsedAt' => $r['last_used'] === null ? null : dc_service_iso_utc((int)$r['last_used']),
        ];
    }
    $stmt->close();
    $list = array_values($byCompany);
    if (!$list) return ['data' => ['status' => 'none']];
    if (count($list) === 1) {
        return ['data' => ['status' => 'single', 'contactId' => $list[0]['contactId'], 'company' => $list[0]['company']]];
    }
    return ['data' => ['status' => 'ambiguous', 'candidates' => $list]];
}

// ── contacts.link (the only write; core-gated) ───────────────────────────────────────────

/** @return array|null|false  company row; null when absent; false on a read error */
function dc_service_company_row($db, $id) {
    $stmt = $db->prepare('SELECT id, name, short_code FROM companies WHERE id = ? LIMIT 1');
    if (!$stmt || !$stmt->bind_param('i', $id) || !$stmt->execute()) { if ($stmt) $stmt->close(); return false; }
    $res = $stmt->get_result();
    if (!$res) { $stmt->close(); return false; }
    $r = $res->fetch_assoc();
    $stmt->close();
    if (!$r) return null;
    return ['id' => (int)$r['id'], 'name' => (string)$r['name'], 'shortCode' => dc_service_short_code($r['short_code'])];
}

/** @return list<array>|false  this company's links that share either identifier */
function dc_service_contact_rows($db, $companyId, $phone, $chat) {
    $stmt = $db->prepare('SELECT id, wa_phone, wa_chat_id, is_active FROM company_whatsapp_contacts
                          WHERE company_id = ? AND (wa_phone = ? OR wa_chat_id = ?) ORDER BY id ASC');
    if (!$stmt || !$stmt->bind_param('iss', $companyId, $phone, $chat) || !$stmt->execute()) { if ($stmt) $stmt->close(); return false; }
    $res = $stmt->get_result();
    if (!$res) { $stmt->close(); return false; }
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    $stmt->close();
    return $rows;
}

/**
 * What the existing links say about this request.
 * @return array{0:string, 1:?int}  ['none'|'existing'|'conflict_identifier'|'conflict_inactive', contact id]
 */
function dc_service_contact_verdict(array $rows, $phone, $chat) {
    if (!$rows) return ['none', null];
    foreach ($rows as $r) {
        /* A stored identifier is never replaced: a different value sent for
           the same contact is a conflict, and nothing is written. */
        if ($phone !== null && $r['wa_phone'] !== null && $r['wa_phone'] !== $phone) return ['conflict_identifier', (int)$r['id']];
        if ($chat !== null && $r['wa_chat_id'] !== null && $r['wa_chat_id'] !== $chat) return ['conflict_identifier', (int)$r['id']];
    }
    /* A deactivated link is never switched back on from here. */
    foreach ($rows as $r) if ((int)$r['is_active'] !== 1) return ['conflict_inactive', (int)$r['id']];
    return ['existing', (int)$rows[0]['id']];
}

/**
 * Links one QUO company to one WhatsApp identity, or confirms the link is
 * already there. The QUO company id is the canonical identity; `companies`
 * is only read. One company may have many contacts and one contact may be
 * linked to several companies. Refused: a group chat, a chat that is not known
 * to be an individual, a request with neither a phone nor a chat id (a
 * display name alone identifies nobody), an unknown company.
 */
function dc_service_contacts_link($db, array $params, array $actor, array $ctx = []) {
    /* A write: refused unless the caller's parser + pricing cores are accepted
       (a stale client could otherwise link from a wrong parse). First, before
       any validation or read. */
    $gate = dc_service_require_accepted_core($ctx['claims'] ?? null, $ctx['core_allow'] ?? []);
    if ($gate !== null) return $gate;

    $companyId = $params['companyId'] ?? null;
    if (!is_int($companyId) || $companyId <= 0 || $companyId > 2147483647) return ['error' => 'validation_failed', 'field' => 'companyId'];

    $idn = dc_service_identity($params);
    if (isset($idn['error'])) return $idn;
    if ($idn['group'] || $idn['kind'] !== 'individual') return ['error' => 'validation_failed', 'field' => 'chatKind'];
    if ($idn['phone'] === null && $idn['chat'] === null) return ['error' => 'validation_failed', 'field' => 'waPhone'];
    $phone = $idn['phone']; $chat = $idn['chat'];

    $name = $params['displayName'] ?? null;
    if ($name !== null) {
        if (!is_string($name) || !mb_check_encoding($name, 'UTF-8')) return ['error' => 'validation_failed', 'field' => 'displayName'];
        $name = trim(preg_replace('/[\x00-\x1F\x7F]+/', ' ', $name) ?? '');
        $name = $name === '' ? null : mb_substr($name, 0, 200, 'UTF-8');
    }

    $fail = function ($reason, $errno = 0) {
        dc_service_log('action.failed', ['action' => 'contacts.link', 'reason' => $reason, 'errno' => $errno ?: null]);
        return ['error' => 'quo_unavailable'];
    };

    $company = dc_service_company_row($db, $companyId);
    if ($company === false) return $fail('company_read_failed', (int)$db->errno);
    if ($company === null)  return ['error' => 'not_found', 'field' => 'companyId'];

    for ($attempt = 0; $attempt < 2; $attempt++) {
        $rows = dc_service_contact_rows($db, $companyId, $phone, $chat);
        if ($rows === false) return $fail('contact_read_failed', (int)$db->errno);
        [$verdict, $contactId] = dc_service_contact_verdict($rows, $phone, $chat);
        if ($verdict === 'conflict_identifier') return ['error' => 'contact_conflict', 'reason' => 'identifier_mismatch'];
        if ($verdict === 'conflict_inactive')   return ['error' => 'contact_conflict', 'reason' => 'inactive'];
        if ($verdict === 'existing') {
            return ['data' => ['contactId' => $contactId, 'created' => false, 'company' => $company]];
        }

        $stmt = $db->prepare("INSERT INTO company_whatsapp_contacts
                (company_id, wa_phone, wa_chat_id, display_name, source, linked_by_user_id, linked_by_username)
              VALUES (?, ?, ?, ?, 'qq', ?, ?)");
        if (!$stmt) return $fail('link_prepare_failed', (int)$db->errno);
        $uid = (int)$actor['sub']; $uname = mb_substr((string)$actor['username'], 0, 64, 'UTF-8');
        $ok = $stmt->bind_param('isssis', $companyId, $phone, $chat, $name, $uid, $uname) && $stmt->execute();
        $errno = (int)$stmt->errno;
        $newId = (int)$stmt->insert_id;
        $stmt->close();
        if ($ok) {
            dc_service_log('contact.linked', ['contact' => $newId, 'company' => $companyId, 'actor' => $uid]);
            return ['data' => ['contactId' => $newId, 'created' => true, 'company' => $company]];
        }
        /* 1062: the same link was written by a concurrent request between the
           read and the insert. Read again and confirm it; never a duplicate. */
        if ($errno !== 1062) return $fail('link_write_failed', $errno);
    }
    return $fail('link_race_unresolved');
}

/** action name => handler. Must list exactly DC_SERVICE_ACTIONS. */
function dc_service_handlers() {
    return [
        'ping'                  => 'dc_service_ping',
        'diameter_settings.get' => 'dc_service_diameter_settings_get',
        'companies.search'      => 'dc_service_companies_search',
        'contacts.lookup'       => 'dc_service_contacts_lookup',
        'contacts.link'         => 'dc_service_contacts_link',
        'whatsapp_template.get' => 'dc_service_whatsapp_template_get',
        'quotations.create'     => 'dc_service_quotations_create',
        'quotations.lookup_by_key' => 'dc_service_quotations_lookup_by_key',
    ];
}
