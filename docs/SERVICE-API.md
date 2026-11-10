# QUO service API (`service.php`)

Status: built in QQ R1 Loop #5 on branch `round/quo-qq-r1-loop5-service-read`
(base: production `ca5f0a5`); core-version gate and nonce housekeeping added
in Loop #6 (`round/quo-qq-r1-loop6-save-foundation`). **Not deployed. Not
enabled anywhere.**

Every name, phone number, id and key in this document is invented.

---

## 1. Purpose

A narrow, server-to-server entry point for the DNC Quick Quote (QQ) backend:

- read the Diameter Settings exactly as QUO's own page receives them;
- search companies by name or short code;
- look up which companies a WhatsApp identity is linked to;
- link one company to one WhatsApp identity (the only write).

It is a separate door from the browser door (`api.php` + login session).
The browser door, the QUO login, `index.php`, `api.php`, `auth.php`,
`handoff.php`, `dnc_handoff.php`, `companies.php`, pricing and parsing are
**unchanged**.

| File | Role |
|---|---|
| `service.php` | The only entry point. Runs the checks in order, then one action. |
| `service_auth.php` | Config, signing, nonce and acting-user functions. Functions only. |
| `service_actions.php` | The five handlers. Functions only. |
| `service_config.sample.php` | Sample for the server-only `service_config.php`. |
| `quo-parser-core.js`, `quo-pricing-core.js` | Not part of the service, but **read** by it (never run) for the core gate, §3.7. Already deployed for `index.php`. |
| `migrations/2026-11-10-create-service-request-nonces.sql` (+ `.rollback.sql`) | Replay table. |
| `migrations/2026-11-10-create-company-whatsapp-contacts.sql` (+ `.rollback.sql`) | Contact links. |

`service_auth.php` includes `dnc_handoff.php` to reuse the canonical-user
functions (`dc_dnc_users_db`, `dc_dnc_user_row`, `dc_dnc_user_refusal`,
`dc_dnc_session_check`) and the guarded database opener. `dnc_handoff.php`
in turn loads `auth.php`. Both only define functions and constants; the
service calls no session, cookie, login or CSRF function from them.

---

## 2. Disabled by default — how it is enabled, how it is turned off

`service.php` answers **every** request (any method, any action, signed or
not) with

```
HTTP 404
{"ok":false,"error":{"code":"not_available","message":"Not available"},"meta":{…}}
```

unless a file named `service_config.php` exists **on the server**, beside
`service.php`, and returns an array with:

| Key | Required value |
|---|---|
| `QQ_SERVICE_ENABLED` | `'true'` (also accepted: `true`, `'1'`, `'on'`, `'yes'`). Anything else, or absent: disabled. |
| `QQ_SERVICE_KEY_ID` | The key id the caller sends. Letters, digits, `_`, `-`; 1–32 characters. Default `qq-backend-1`. |
| `QQ_SERVICE_SECRET` | `base64:` + base64 of **at least 32 random bytes**. Missing, malformed or shorter: disabled. |
| `QQ_SERVICE_SECRET_PREVIOUS` | Empty, or the old key in the same format during a rotation. Malformed: disabled. |

Also disabled when the secret equals `DNC_HANDOFF_SECRET` or
`DNC_HANDOFF_SECRET_PREVIOUS` (one key must never do two jobs).

Optional keys (same file; absent = the default):

| Key | Default | Meaning |
|---|---|---|
| `QQ_SERVICE_ACCEPTED_CORES` | empty | Older parser / pricing cores, or exact pairs, accepted in addition to the deployed ones. §3.7. |
| `QQ_SERVICE_NONCE_KEEP_SECONDS` | `600` | Age after which a nonce row may be pruned. Never below **240** (lower values are raised to it), at most 86 400. §6.1. |
| `QQ_SERVICE_NONCE_PRUNE_EVERY` | `50` | About one accepted request in this many prunes. `0` = never. At most 10 000. |
| `QQ_SERVICE_NONCE_PRUNE_BATCH` | `500` | Most rows one prune deletes. 1 to 5 000. |

These settings are read from the **file only**. Environment variables
cannot enable the service.

`service_config.php` is never in Git and is on the deploy's `PROTECTED` list
(`.cpanel.yml`), so a deploy can neither create nor overwrite it. Only
`service_config.sample.php` ships, with `QQ_SERVICE_ENABLED => 'false'` and an
empty secret.

### Operator steps to enable (production, later, with Owner approval)

1. Take the backup described in `docs/SERVICE-API-MIGRATIONS.md`.
2. Deploy the branch (the four new PHP files are in `APPFILES`). The service
   is still off: no config file exists.
3. Run the two migrations as that runbook says (preflight, create, verify).
4. Confirm `dnc_config.php` on the server already holds working
   `DNC_USERS_DB_*` values (it does if Portal sign-in to QUO works). The
   service uses that same read-only connection to check the acting user.
5. On the server, copy `service_config.sample.php` to `service_config.php`.
   Generate the secret **on the server**:
   `php -r 'echo "base64:".base64_encode(random_bytes(32)), PHP_EOL;'`
   Put it in `QQ_SERVICE_SECRET`. Put the same value in the QQ backend's own
   server-only configuration. Never in Git, chat or a document.
6. Set `QQ_SERVICE_ENABLED` to `'true'`.
7. From the QQ backend, send a signed `ping`. Expect HTTP 200.

### Turning it off

Set `QQ_SERVICE_ENABLED` to `'false'` in `service_config.php`, or delete the
file. It takes effect on the next request. Nothing else needs to change; both
tables can stay.

### Rotating the key

1. Move the current value to `QQ_SERVICE_SECRET_PREVIOUS`, put the new value in
   `QQ_SERVICE_SECRET`. Both are now accepted.
2. Switch the QQ backend to the new value.
3. Empty `QQ_SERVICE_SECRET_PREVIOUS`.

---

## 3. The wire contract

### 3.1 Request

```
POST https://<quo host>/service.php?action=<action>
Content-Type: application/json
X-QQS-Key-Id: qq-backend-1
X-QQS-Timestamp: 1794300000
X-QQS-Nonce: 0f1e2d3c4b5a69788796a5b4c3d2e1f0
X-QQS-Signature: li432ntmPBNQu3yEZ4CoD0CKrvALTZIXB1RYsMXX-og

{"actor":{"sub":7,"username":"exampleuser"},"requestId":"req_EXAMPLE0001","params":{}}
```

| Part | Rule |
|---|---|
| Method | `POST` only. |
| `action` | In the query string. Lower-case; one of the five in section 4. |
| `Content-Type` | `application/json` (a `; charset=utf-8` suffix is accepted). |
| `X-QQS-Key-Id` | Must equal `QQ_SERVICE_KEY_ID`. |
| `X-QQS-Timestamp` | Unix time in **seconds**, decimal digits (10 or 11 digits). Must be within **±60 seconds** of the QUO server clock. |
| `X-QQS-Nonce` | Exactly 32 **lower-case** hex characters (16 random bytes). Single use. |
| `X-QQS-Signature` | base64url **without padding** (43 characters) of the 32-byte HMAC, see 3.2. |
| Body | A JSON object, at most 524 288 bytes. The exact bytes sent are the bytes hashed. |
| Forbidden headers | `Origin`, `Cookie`, `Sec-Fetch-Site`. A request carrying any of them is refused. |

Body envelope (every action):

```json
{
  "actor":     { "sub": 7, "username": "exampleuser" },
  "requestId": "req_EXAMPLE0001",
  "params":    { }
}
```

- `actor.sub` — the canonical DNC `users.id` of the person the QQ backend is
  acting for. A JSON **integer** greater than 0 (not a string).
- `actor.username` — that user's canonical username, exact case.
- `requestId` — optional. Echoed in `meta.requestId` only when it matches
  `^[A-Za-z0-9_.:-]{1,64}$`; otherwise `meta.requestId` is `null`.
- `params` — a JSON object (may be `{}` or omitted). Per action, section 4.
- `client` — optional; see below. Any other top-level key is ignored.

Optional core claims (§3.7), inside the signed body:

```json
"client": {
  "cores": {
    "parser":  { "version": "1.0.0", "contract": 1, "sha256": "<64 lower-case hex>" },
    "pricing": { "version": "1.0.0", "contract": 1, "sha256": "<64 lower-case hex>" }
  }
}
```

`version` — 1 to 4 dot-separated integers (echoed back, not used to decide).
`contract` — JSON integer >= 1. `sha256` — SHA-256 of the core file's exact
bytes, 64 lower-case hex. No `client`, `client: {}` or `cores: null` means
**no claim**. The QQ backend copies these from the extension's
`X-QQ-Parser-Core` / `X-QQ-Pricing-Core` headers. QUO reads them **only from
the signed body**; a header or query parameter of that name is ignored.

The acting user is identified **only** by the body. Because the body hash is
part of the signing string, the actor is covered by the signature.

### 3.2 Signing

Signing string — six lines joined by a single `\n` (0x0A), no trailing newline:

```
qqs1
POST
<action>
<X-QQS-Timestamp>
<X-QQS-Nonce>
<lower-case hex SHA-256 of the exact request body bytes>
```

```
key       = base64-decode( the part of QQ_SERVICE_SECRET after "base64:" )   (raw bytes)
signature = base64url_no_padding( HMAC-SHA256( key, signing string ) )
```

`base64url_no_padding`: standard base64, then `+`→`-`, `/`→`_`, strip `=`.

### 3.3 Worked example (FAKE secret — never use it)

```
QQ_SERVICE_SECRET = base64:RkFLRS1URVNULVNFQ1JFVC1OT1QtQS1SRUFMLUtFWSE=
key bytes         = the 32 ASCII bytes  FAKE-TEST-SECRET-NOT-A-REAL-KEY!
action            = ping
timestamp         = 1794300000
nonce             = 0f1e2d3c4b5a69788796a5b4c3d2e1f0
body (86 bytes)   = {"actor":{"sub":7,"username":"exampleuser"},"requestId":"req_EXAMPLE0001","params":{}}
SHA-256(body)     = 6b9833e8807acba4cd91c4460ba463b340ae7c7199819ff648c0c163b7df28f8
```

Signing string:

```
qqs1
POST
ping
1794300000
0f1e2d3c4b5a69788796a5b4c3d2e1f0
6b9833e8807acba4cd91c4460ba463b340ae7c7199819ff648c0c163b7df28f8
```

```
X-QQS-Signature = li432ntmPBNQu3yEZ4CoD0CKrvALTZIXB1RYsMXX-og
```

`tests/php/service_static.test.php` recomputes this vector with PHP's own
`hash` / `hash_hmac` and fails if this document disagrees.

PHP caller:

```php
$body  = json_encode(['actor' => ['sub' => $id, 'username' => $username], 'requestId' => $rid, 'params' => (object)$params]);
$ts    = (string)time();
$nonce = bin2hex(random_bytes(16));
$sig   = rtrim(strtr(base64_encode(hash_hmac('sha256',
            "qqs1\nPOST\n$action\n$ts\n$nonce\n" . hash('sha256', $body), $keyBytes, true)), '+/', '-_'), '=');
```

### 3.4 Order of checks

Each failure stops the request. Nothing later runs.

| # | Check | On failure |
|---|---|---|
| 1 | Service enabled | 404 `not_available` |
| 1 | Method is POST | 405 `method_not_allowed` |
| 1 | Content-Type is `application/json` | 415 `unsupported_media_type` |
| 1 | Body ≤ 524 288 bytes | 413 `payload_too_large` |
| 2 | No `Origin`, `Cookie`, `Sec-Fetch-Site` | 403 `browser_request_refused` |
| 3 | Key id known; timestamp, nonce and action well-formed; signature equal in constant time (`hash_equals`) against the current key, then the previous | 401 `invalid_signature` |
| 4 | Timestamp within ±60 s | 401 `timestamp_out_of_window` |
| 5 | Nonce inserted into `service_request_nonces` (primary key) | 409 `replayed`; 503 `quo_unavailable` if it cannot be stored |
| 6 | Action on the allow-list | 404 `unknown_action` |
| 7 | Body envelope valid | 400 `invalid_body` |
| 7 | Acting user re-read from the canonical users table | 403 `actor_refused`; 503 `actor_check_unavailable` |
| 7 | Core verdict computed from `client.cores` (§3.7). Never a refusal here. | — |
| 8 | Write actions only (`contacts.link`): the core guard, before anything else | 412 `core_not_accepted` |
| 8 | The action's own query | per action |

Notes:

- Nothing is written to the database before the signature and timestamp pass.
- Right after check 5 stores the nonce, the service occasionally prunes old
  nonce rows (§6.1). That can never fail the request.
- A nonce is consumed by any request that reaches check 5, including one then
  refused at 6, 7 or 8. **Always use a fresh nonce, also for a retry.**
- The acting-user rule is QUO's own per-request rule for Portal users
  (`dc_dnc_session_check()` in `dnc_handoff.php`): the row is read fresh by
  `users.id` through the read-only connection, and refused when missing,
  inactive, a legacy placeholder, must-change-password, or the username
  differs. Which of these applied is written to the server log only.

### 3.5 Responses

Always JSON, `Content-Type: application/json; charset=utf-8`,
`Cache-Control: no-store`. No cookie. No CORS header.

Success:

```json
{ "ok": true, "data": { … },
  "core": { "accepted": true, "parser": { "status": "current", "version": "1.0.0" },
            "pricing": { "status": "current", "version": "1.0.0" }, "reason": "accepted" },
  "meta": { "requestId": "req_EXAMPLE0001", "serverTime": "2026-11-10T03:00:00Z" } }
```

`core` (§3.7) is on **every answer once check 7 has passed**: every success,
and every refusal from check 8 (validation, not found, conflict,
`core_not_accepted`, an action's `quo_unavailable`). Refusals at checks 1–7
carry no `core`: the body was not yet trusted.

Error:

```json
{ "ok": false, "error": { "code": "validation_failed", "message": "Request parameters are not valid", "field": "q" },
  "meta": { "requestId": "req_EXAMPLE0001", "serverTime": "2026-11-10T03:00:00Z" } }
```

`error.code` is stable; `error.message` is a fixed English sentence per code.
`error.field` (with `validation_failed` and `not_found`) and `error.reason`
(with `contact_conflict` and `core_not_accepted`) are fixed words from the code, never request
content. `meta.requestId` is `null` on every refusal before check 7.

### 3.6 All error codes

| Code | HTTP | Meaning |
|---|---|---|
| `not_available` | 404 | Service disabled. |
| `method_not_allowed` | 405 | Not POST. |
| `unsupported_media_type` | 415 | Content-Type is not `application/json`. |
| `payload_too_large` | 413 | Body over 524 288 bytes. |
| `browser_request_refused` | 403 | `Origin`, `Cookie` or `Sec-Fetch-Site` present. |
| `invalid_signature` | 401 | Unknown key id, missing or malformed signing header, or wrong signature. |
| `timestamp_out_of_window` | 401 | More than 60 s from the server clock. Check the caller's clock. |
| `replayed` | 409 | Nonce already used. |
| `unknown_action` | 404 | Not one of the five actions. |
| `invalid_body` | 400 | Envelope wrong (not an object, bad `actor`, `params` not an object). |
| `actor_refused` | 403 | Acting user missing, inactive, placeholder, must change password, or username differs. |
| `actor_check_unavailable` | 503 | Canonical users database could not be read. Retry later. |
| `validation_failed` | 422 | A parameter is wrong; see `error.field`. |
| `not_found` | 404 | `contacts.link`: the company does not exist. |
| `contact_conflict` | 409 | `contacts.link`: see `error.reason`. |
| `core_not_accepted` | 412 | A write action (`contacts.link`) while `core.accepted` is not `true`. `error.reason` = `core.reason`. Nothing was read or written. |
| `quo_unavailable` | 503 | QUO database or a needed table is unavailable, or an internal failure. Retry later. |

### 3.7 Core-version gate

The service vouches for the parser and pricing cores the client parsed and
priced with. **This server's own cores** are the files deployed beside
`service.php`: `quo-parser-core.js` and `quo-pricing-core.js`. For each it
computes the SHA-256 of the file's exact bytes and reads the contract number
from the file's `const QUO_PARSER_CORE_CONTRACT = <n>;` /
`const QUO_PRICING_CORE_CONTRACT = <n>;` line (a text match that must occur
exactly once; the JavaScript is never run). Once per request.

A server core is **unknown** when its file is missing, empty or unreadable,
when the constant is absent or appears twice, or when it names a contract
this service does not support (today: parser 1, pricing 1). An unknown server
core makes the verdict `accepted: false` (`server_core_unknown`) whatever the
operator has listed.

Per core, `status`:

| status | meaning |
|---|---|
| `current` | the claim equals this server's deployed core (hash; contract = supported). |
| `listed` | an older core the operator listed under `QQ_SERVICE_ACCEPTED_CORES` `parser` / `pricing` (hash and contract equal; contract must be the supported one). |
| `unknown_hash` | supported contract, hash neither current nor listed. |
| `contract_mismatch` | the claimed contract is not the supported one. |
| `server_unknown` | this server's own file is unknown (above). |
| `missing` | the other core was claimed, this one was not. |
| `absent` / `malformed` | no claim at all / the claim did not parse. |

`version` is echoed beside `status` when that core was claimed.

`accepted` and `reason` (checked in this order):

| accepted | reason | when |
|---|---|---|
| `null` | `no_claim` | the body has no core claim. **Not verified — never treat as true.** |
| `false` | `claim_malformed` | `client`, `cores` or a claim has the wrong shape. |
| `false` | `server_core_unknown` | either server core is unknown. |
| `false` | `claim_incomplete` | only one core was claimed. |
| `true` | `accepted` | both cores are `current` or `listed`. |
| `true` | `pair_listed` | not both acceptable on their own, but this exact parser + pricing pair (hashes and contracts) is listed under `pairs`. |
| `false` | `contract_mismatch` | a contract differs and the pair is not listed. |
| `false` | `mixed_versions` | one core acceptable, the other not, and the pair is not listed. |
| `false` | `not_accepted` | neither core acceptable. |

**Read-only actions** (`ping`, `diameter_settings.get`, `companies.search`,
`contacts.lookup`) report `core` and are **never blocked** by it.

**Write actions** call the one guard, `dc_service_require_accepted_core()`
in `service_auth.php`, before any validation or query; only `accepted: true`
passes (`null` does not). Today that is `contacts.link`: it is not a quotation
write, but a stale client could otherwise link a chat to a company from a
wrong parse. Every future write action — a quotation save included — must
call it first; `tests/php/service_static.test.php` fails if a handler holding
an `INSERT` / `DELETE` does not, or is not listed in
`DC_SERVICE_CORE_GATED_ACTIONS`.

Operator list (`service_config.php`), **empty by default**:

```php
'QQ_SERVICE_ACCEPTED_CORES' => [
    'parser'  => [ ['sha256' => '<64 hex>', 'contract' => 1, 'reason' => 'QQ 0.2.0 still in use', 'date' => '2026-11-11'] ],
    'pricing' => [],
    'pairs'   => [ ['parser'  => ['sha256' => '<64 hex>', 'contract' => 1],
                    'pricing' => ['sha256' => '<64 hex>', 'contract' => 1],
                    'reason'  => 'pilot build', 'date' => '2026-11-11'] ],
],
```

Every entry needs `sha256`, `contract` (integer), a non-empty `reason` and a
`date` (`YYYY-MM-DD`); an entry missing any of them is ignored. Removing an
entry refuses that core again on the next request. Deploying new core files
changes "current" at once: list the previous hashes first if older
extensions must keep linking during a rollout.

---

## 4. Actions

Only `params` and `data` are shown. The envelope and `meta` are as in section 3.

### 4.1 `ping`

Proves signing, clock, nonce store and acting-user check. Reads no business table.
Like every answer after check 7 it carries `core` (§3.7); this is how the QQ
backend learns `coreAccepted`.

`params`: `{}`

```json
{ "service": "quo-service", "contract": 1, "scheme": "qqs1",
  "actions": ["ping", "diameter_settings.get", "companies.search", "contacts.lookup", "contacts.link"],
  "serverTime": "2026-11-10T03:00:00Z", "serverTimeUnix": 1794279600 }
```

Errors: only those of section 3.4.

### 4.2 `diameter_settings.get` — read only

`params`: `{}`

```json
{ "rules": [
    { "id": 3, "type": "sagrod", "product_type": "sagrod", "material": "MS",
      "sizeType": "UNDERSIZE", "size_type": "UNDERSIZE", "size": "M12",
      "diameter": 10.9, "active": "1", "is_active": 1 }
  ],
  "version": "ds1-9f2c4e6a8b0d1f3a",
  "ruleCount": 1,
  "fetchedAt": "2026-11-10T03:00:00Z" }
```

- `rules` is exactly the `data` array of `api.php?action=get_diameter_settings`:
  same SQL (`is_active=1`, ordered by `product_type, material, size_type,
  size`), same row mapping, same keys, types and order. A test runs both
  against the same table and requires byte-identical JSON.
- `version` = `ds1-` + first 16 hex of SHA-256 over the JSON encoding of
  `rules`. It is a content hash: stable across calls and users, changes when
  any returned row changes, is added, removed, activated or deactivated, and
  returns to its old value if the rows return to their old content. No
  `updated_at` column is used (none is verified to exist).
- An empty table gives `rules: []`, `ruleCount: 0`.

Errors: `quo_unavailable` (table missing or unreadable).

### 4.3 `companies.search` — read only

`params`:

```json
{ "q": "example", "limit": 20 }
```

- `q` — string, 2 to 100 characters after trimming. Matches `companies.name`
  **or** `companies.short_code`, "contains", case-insensitive (the columns'
  own collation). `%`, `_` and `|` in `q` are literal, never wildcards.
- `limit` — JSON integer 1–50. Default 20.

```json
{ "companies": [
    { "id": 902, "name": "Example Steel Works", "shortCode": null, "quotationCount": 0, "lastQuotationDate": null },
    { "id": 901, "name": "Example Trading Sdn Bhd", "shortCode": "EXT", "quotationCount": 12, "lastQuotationDate": "2026-10-02" }
  ],
  "truncated": false }
```

- Ordered by name (as `get_companies`), then id.
- `quotationCount` and `lastQuotationDate` are computed exactly as
  `get_companies` computes `quotation_count` and `latest_quotation_date`.
- `shortCode` is `null` when the stored value is NULL or empty.
- `truncated` is `true` when more rows matched than `limit`.
- **Never returned:** `phone`, `address`, timestamps.

Errors: `validation_failed` (`field`: `q` or `limit`), `quo_unavailable`.

### 4.4 `contacts.lookup` — read only

`params`:

```json
{ "waPhone": "60000000001", "waChatId": null, "chatKind": "individual" }
```

- `chatKind` — required: `individual`, `group` or `unknown`.
- `waPhone` — string or null. Digits with country code. A leading `+` and
  spaces, hyphens, dots and brackets are removed; the result must match
  `^[1-9][0-9]{7,14}$`.
- `waChatId` — string or null. WhatsApp's own stable identifier,
  `^[A-Za-z0-9@._:-]{3,64}$`.
- A display name is not a parameter and is never used to match.

Three result shapes:

```json
{ "status": "none" }
```
```json
{ "status": "single", "contactId": 55,
  "company": { "id": 901, "name": "Example Trading Sdn Bhd", "shortCode": "EXT" } }
```
```json
{ "status": "ambiguous", "candidates": [
    { "contactId": 55, "company": { "id": 901, "name": "Example Trading Sdn Bhd", "shortCode": "EXT" }, "lastUsedAt": "2026-11-01T04:10:00Z" },
    { "contactId": 71, "company": { "id": 902, "name": "Example Steel Works", "shortCode": null }, "lastUsedAt": null }
  ] }
```

- Matches **active** links where `wa_phone` or `wa_chat_id` equals the value
  sent, joined to `companies`: a link whose company no longer exists never
  matches.
- One candidate per company. Ordered most recently used first, then by
  contact id. (`lastUsedAt` is always `null` today: nothing writes
  `last_matched_at` yet.)
- `chatKind: "group"`, a `waChatId` ending in `@g.us`, or both identifiers
  null → always `none`.
- Pure read: no identifier is filled in, `last_matched_at` is not touched.

Errors: `validation_failed` (`field`: `chatKind`, `waPhone` or `waChatId`), `quo_unavailable`.

### 4.5 `contacts.link` — the only write (core-gated)

Refused with 412 `core_not_accepted` (nothing read, nothing written) unless
`core.accepted` is `true` (§3.7). A request without a core claim is refused.


`params`:

```json
{ "companyId": 901, "waPhone": "60000000001", "waChatId": null, "chatKind": "individual", "displayName": "Example Buyer" }
```

- `companyId` — JSON integer; must be an existing `companies.id`.
- `waPhone`, `waChatId` — as in 4.4. **At least one must be non-null.**
- `chatKind` — must be `individual`.
- `displayName` — optional label, at most 200 characters kept. Never an identity.

```json
{ "contactId": 55, "created": true,
  "company": { "id": 901, "name": "Example Trading Sdn Bhd", "shortCode": "EXT" } }
```

| Situation | Result |
|---|---|
| New link | One `INSERT`. `created: true`. Stores normalized phone / chat id, label, `source='qq'`, `linked_by_user_id` = `actor.sub`, `linked_by_username`, `created_at`. |
| Same company + same identity again (any user) | `created: false`, the existing `contactId`. Nothing written; the stored row is not touched. |
| Same identity, another company | Allowed. A new row. Lookup then answers `ambiguous`. |
| Another identity, same company | Allowed. A new row. |
| Existing link holds only one identifier and the request brings the other too | `created: false`. **The missing identifier is NOT filled in** (the service has no UPDATE). |
| Request identifier differs from a stored one on the same link (same phone, other chat id, or the reverse) | 409 `contact_conflict`, `reason: "identifier_mismatch"`. Nothing written. |
| Matching link exists but is deactivated | 409 `contact_conflict`, `reason: "inactive"`. Not re-activated. |
| Neither phone nor chat id (a display name alone) | 422 `validation_failed`, `field: "waPhone"`. |
| `chatKind` is `group`, or `waChatId` ends in `@g.us` | 422 `validation_failed`, `field: "chatKind"`. |
| `chatKind` is `unknown` or missing | 422 `validation_failed`, `field: "chatKind"`. |
| Company does not exist | 404 `not_found`, `field: "companyId"`. |
| Core claim not accepted, or none sent | 412 `core_not_accepted`, `reason` = `core.reason`. Checked first. |

`companies` is only read. No column of it, in particular `companies.phone`,
is ever written.

Errors: `core_not_accepted`, `validation_failed` (`field`: `companyId`,
`chatKind`, `waPhone`, `waChatId`, `displayName`), `not_found`,
`contact_conflict`, `quo_unavailable`.

---

## 5. Deliberately not offered

- `quotations.create`, and any quotation read, update or delete.
- Company create, edit or delete.
- Any settings write (Diameter Settings, default prices, WhatsApp template), imports, exports.
- Unlinking or deactivating a contact; editing a contact; filling in a missing identifier.
- Price history, AI extraction, next reference number.
- Any GET endpoint, any browser use, CORS.

Every `api.php` action name, and anything else not in section 4, answers
`unknown_action`.

---

## 6. Tables

Created by the two migrations; see `docs/SERVICE-API-MIGRATIONS.md`.

```sql
CREATE TABLE service_request_nonces (
  nonce        CHAR(32)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  key_id       VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  received_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (nonce),
  KEY idx_srn_received (received_at)
) ENGINE=InnoDB;

CREATE TABLE company_whatsapp_contacts (
  id                  INT             NOT NULL AUTO_INCREMENT,
  company_id          INT             NOT NULL,
  wa_phone            VARCHAR(15)     CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  wa_chat_id          VARCHAR(64)     CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  display_name        VARCHAR(200)    DEFAULT NULL,
  is_active           TINYINT(1)      NOT NULL DEFAULT 1,
  source              VARCHAR(20)     NOT NULL DEFAULT 'qq',
  linked_by_user_id   BIGINT UNSIGNED DEFAULT NULL,
  linked_by_username  VARCHAR(64)     DEFAULT NULL,
  last_matched_at     DATETIME        DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cwc_company_phone (company_id, wa_phone),
  UNIQUE KEY uq_cwc_company_chat  (company_id, wa_chat_id),
  KEY idx_cwc_phone (wa_phone),
  KEY idx_cwc_chat  (wa_chat_id),
  CONSTRAINT chk_cwc_has_identity CHECK (wa_phone IS NOT NULL OR wa_chat_id IS NOT NULL),
  CONSTRAINT chk_cwc_phone_format CHECK (wa_phone IS NULL OR wa_phone REGEXP '^[1-9][0-9]{7,14}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

- No foreign key. `company_id` is checked in code at link time, and lookups
  join `companies`.
- `linked_by_user_id` is a canonical DNC `users.id` (bigint) from another
  database.
- `service.php` holds exactly three data-changing statements: the nonce
  `INSERT`, the contact-link `INSERT` and the bounded nonce-prune `DELETE`
  (§6.1, Owner-approved in Loop #6). It has no `UPDATE`. A test enforces the
  exact list.

### 6.1 Nonce housekeeping

cPanel shared hosting has no worker or scheduler here, so the service prunes
opportunistically:

- **When:** only after the current request's own nonce is stored (check 5),
  on about one request in `QQ_SERVICE_NONCE_PRUNE_EVERY` (default 50, drawn
  with `random_int`; `0` = never). A random draw needs no marker: a marker
  file would need a writable path the service otherwise never writes to (and
  that the host may share or clean), a marker row would need a migration.
  Expected cost: one indexed `DELETE` per 50 requests.
- **What:** `DELETE FROM service_request_nonces WHERE received_at < FROM_UNIXTIME(now − keep) ORDER BY received_at LIMIT batch`
  — oldest first, on `idx_srn_received`, at most `batch` (default 500) rows.
  At one prune per 50 requests the table drains far faster than it fills.
- **Never a recent nonce:** a nonce stored at server time *t* can only be
  replayed by a request whose timestamp is within ±60 s of a later server
  time *and* within ±60 s of *t*, so nothing after *t* + 120 s can replay it.
  `keep` defaults to 600 s and is clamped to at least
  `DC_SERVICE_NONCE_KEEP_FLOOR` = 2 × 60 s window + 60 s skew + 60 s margin =
  **240 s**; the file cannot set it lower. `received_at` and the cutoff both
  come from PHP's clock.
- **Failure:** a failed `DELETE` (or any exception) is logged as
  `[service] nonce.prune_failed errno=<n>` and swallowed. The request goes on
  normally; the nonce already stored stays stored, so replay protection is
  unaffected. A prune that removed rows logs `[service] nonce.pruned rows=<n>`.
- **Concurrency:** the `PRIMARY KEY` still decides replays. A concurrent prune
  holding InnoDB range locks can at most make a nonce `INSERT` wait; if that
  wait failed, the request is refused with 503 (fail closed), never accepted
  twice.

---

## 7. Security notes

- **Public repository.** Security rests on the secret and the checks, not on
  hidden code. No real secret, customer or phone number is in Git; tests
  generate a random key per run and use invented data.
- **Secret leak.** Whoever holds the secret can call the five actions as any
  active user: read Diameter Settings, company names and short codes, read
  and add contact links. They cannot create, change or delete a quotation, a
  company or a setting, and cannot reach `api.php`. Response: switch off
  (section 2), rotate.
- **Replay.** HTTPS, ±60 s window, single-use nonce enforced by a primary key,
  action and body hash inside the signature. Pruning never removes a nonce
  younger than 240 s (§6.1).
- **Stale clients.** Core claims travel inside the signed body; a write needs
  an accepted core pair (§3.7). This protects against stale clients, not
  against a stolen key: whoever holds the secret can claim any hashes.
- **Tampering.** Changing the action, timestamp, nonce or one byte of the body
  (including the acting user) invalidates the signature.
- **Browsers.** No session, no cookie, no CORS; requests with `Origin`,
  `Cookie` or `Sec-Fetch-Site` are refused; GET is refused.
- **Disabled employee.** The acting user is re-read on every request; a user
  disabled in the canonical table is refused on the next call.
- **Fail closed.** No config, no nonce table, users database unreachable, QUO
  database unreachable: the answer is a refusal, never data.
- **Errors.** Fixed code + fixed message. Never the secret, a signature, the
  request body, SQL or driver text. The legacy `getDB()` in `db.php` prints
  the driver error and `die()`s; `service.php` buffers and discards that and
  answers `quo_unavailable`.
- **Logs.** `[service] <event> key=code …` in the PHP error log: reason codes,
  action names, numeric ids. No phone number, name, body, signature or secret.
- **Personal data in URLs.** Only the action name is in the URL. Names, phone
  numbers and chat ids travel in the POST body.
- **Crypto.** `hash_hmac('sha256')`, `hash_equals`, `random_bytes` only. The
  `sodium` extension is not needed.
- **Not implemented:** rate limiting and IP allow-listing. The caller is one
  trusted backend; consider both before production.

---

## 8. Tests

```
php tests/php/service_static.test.php
```

No database. Disabled-by-default matrix, the signing vector of 3.3, envelope
and identity rules, the static guarantees (include graph, no session, exactly
three write statements, the prune's shape and floor, the core guard in front
of every writing handler, same Diameter Settings SQL and mapping as
`api.php`), the deploy allow-list.

```
php tests/php/service_core_gate.test.php
```

The core gate (§3.7). Part 1 needs no database; part 2 (over HTTP) runs with
the same `DC_SERVICE_TEST_DB_*` variables as below and is skipped without
them.

```
DC_SERVICE_TEST_DB_HOST=127.0.0.1 DC_SERVICE_TEST_DB_PORT=<port> \
DC_SERVICE_TEST_DB_USER=root DC_SERVICE_TEST_DB_PASS= \
php tests/php/service_nonce_cleanup.test.php
```

Nonce housekeeping (§6.1) against real MySQL and over HTTP. Skipped (exit 0,
`SKIP`) without a database.

```
DC_SERVICE_TEST_DB_HOST=127.0.0.1 DC_SERVICE_TEST_DB_PORT=<port> \
DC_SERVICE_TEST_DB_USER=root DC_SERVICE_TEST_DB_PASS= \
php tests/php/service_api.test.php
```

The shipped files over real HTTP (PHP built-in server on 127.0.0.1) against a
real MySQL 8. **Without `DC_SERVICE_TEST_DB_HOST` and
`DC_SERVICE_TEST_DB_PORT` it prints `SKIP` and exits 0 — a skip, not a pass.**
There is no default host or port. Use a throwaway MySQL instance only: the
suite creates and drops three schemas and one MySQL user.
