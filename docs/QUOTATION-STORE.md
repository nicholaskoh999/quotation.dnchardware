# QUOTATION-STORE — quotation persistence as an include

QQ R1 Loop #6 (save foundation). Resolves blocker B3 of
`dnc-quick-quote/docs/backend/r1-loop4-backend-foundation-plan.md` (§5.5: move the
save functions into an include; Owner approved).

**Loop #6:** nothing new was reachable; the only production change was that
`api.php` loads its persistence functions from a second file.

**Loop #7:** `service_quotations.php` (service action `quotations.create`, behind
`QQ_SERVICE_CREATE_ENABLED`, default off) is the second caller. It calls
`dc_store_create_quotation()` once, always with an idempotency key, and reaches
no update-path function (docs/SERVICE-API.md §4.8; call-graph test in
`tests/php/service_static_create.inc.php`). This file is unchanged by Loop #7;
the browser still never sends a key.

## 1. What moved

`quotation_store.php` holds these, moved **verbatim** from `api.php` (same
names, same signatures, same comments, same SQL, same lock name, same retry):

| Group | Functions / constants |
|---|---|
| Transaction scope | `dc_txn_begin`, `dc_txn_commit`, `dc_txn_rollback`, `dc_txn_note_lock`, `dc_txn_cleanup` |
| DB helpers | `query_or_fail`, `prepare_or_fail`, `execute_or_fail` |
| Validation | `DC_PRICE_SOURCES`, `dc_price_acceptance_ok`, `validate_quotation_payload` |
| Item identity | `DC_ITEM_UID_RE`, `dc_new_item_uid`, `dc_is_item_uid`, `dc_item_uid_absent`, `dc_mint_item_uid`, `dc_assign_item_uids`, `dc_reconcile_item_uids` |
| Locked read + snapshot | `dc_lock_quotation_for_update`, `DC_SNAPSHOT_SCHEMA_VERSION`, `dc_read_quotation_snapshot_row`, `dc_build_quotation_snapshot` |
| No-op suppression | `dc_ksort_deep`, `dc_business_items`, `dc_business_state` |
| Revision writer | `dc_next_revision_no`, `dc_write_revision` (split, below) |
| Numbering | `DC_REF_LOCK`, `acquire_ref_lock`, `release_ref_lock`, `ref_no_in_use`, `dc_save_quotation_insert`, `next_free_ref_no` |

**Stayed in `api.php`:** the login gate, CSRF, `mysqli_report(OFF)`, `db.php`,
the timezone, request parsing, `$GLOBALS['DC_TXN']` initialisation,
`fail_json`, `dc_db_fail` (the response channel), `table_exists`,
`require_table`, `column_exists`, the CSV helpers, the read-time history
functions, and all dispatch.

**The one split.** `dc_write_revision($db, $id, $event)` is now a one-line
wrapper that passes `dc_current_user()` to `dc_write_revision_as($db, $id,
$event, $actor)`, which is the production body with the actor passed in. Same
SQL, same columns, same failure labels.

**The save action.** `save_quotation` now calls `dc_store_create_quotation($db,
$input, dc_current_user(), null)` and prints the same `{ok, id, ref_no,
reassigned, items}` / `{ok:false, error}` it always did. The create's steps run
in the same order with the same SQL; `tests/php/quotation_store_parity.test.php`
proves the responses and the stored rows are byte-identical to production
`ca5f0a5` for 32 scripted calls (creates, reassignments, every validation
refusal, lock busy, a missing revision table, a 1062 retry, and updates).
`update_quotation` is unchanged and still calls the moved functions directly.

### The include contract

Including `quotation_store.php` prints nothing, starts no session, sends no
header, opens no connection and exits nothing; its top level is definitions
only. The including script must provide, before calling anything:

- `fail_json($error)` and `dc_db_fail($label, $handle = null)`: they must call
  `dc_txn_cleanup()` first and **must not return** (api.php echoes and exits).
- `$GLOBALS['DC_TXN']` (set by api.php; the create function sets it if absent).
- `dc_current_user()`, only for the `dc_write_revision()` wrapper.
- `mysqli_report(MYSQLI_REPORT_OFF)` and `Asia/Kuala_Lumpur`, as api.php sets them.

## 2. The create function

```php
dc_store_create_quotation($db, $payload, $actor, $idempotency = null): array
```

| Input | Meaning |
|---|---|
| `$db` | mysqli handle |
| `$payload` | the same body `save_quotation` reads: `company_id, ref_no, quote_date, valid_until, prepared_by, remarks, customer_name, customer_phone, items, total_amount` |
| `$actor` | recorded on the `create` revision: `['id' => app_users.id or null, 'username', 'display_name']`; for a keyed create also `'dnc_user_id'` (canonical users.id, int > 0) |
| `$idempotency` | `null` (browser) or `['key' => uuid-v4, 'source' => 'qq', 'ext_version'?, 'parser_core_sha256'?, 'pricing_core_sha256'?, 'settings_version'?, 'wa_contact_id'?]` |

Success: `['ok' => true, 'id' => int, 'ref_no' => string, 'reassigned' => bool,
'items' => array|null, 'replayed' => bool]`. `items` are the persisted items
with their server-minted `item_uid`s (`null` only on a replay whose quotation
was later deleted).

Refusal (nothing written, lock not held): `['ok' => false, 'code', 'error']`.

| code | when |
|---|---|
| `validation_failed` | `validate_quotation_payload` refused (same message as today), or the payload cannot be JSON-encoded for hashing |
| `in_progress` | the numbering lock was not obtained in 10 s (same message as today) |
| `idempotency_key_invalid` | key is not a lowercase hyphenated UUID v4 |
| `idempotency_actor_invalid` | keyed create without a positive int `dnc_user_id` and a 1–64 char `username` |
| `idempotency_options_invalid` | bad `source` / provenance value |
| `key_reused_with_different_payload` | same user + key already used with another payload hash |

Database failures are **not** returned: they go through `dc_db_fail()` /
`fail_json()` with the existing labels (plus three new ones on the keyed path:
`Quotation request lookup …`, `Quotation request record failed`, `Quotation
request link failed`), which roll back, release the lock and do not return.

## 3. Idempotency rules

- Scope: `(actor_user_id, idempotency_key)`, with `actor_user_id` the canonical
  DNC `users.id`. Another user's identical key is independent.
- `payload_sha256` = SHA-256 of the canonical JSON of the whole `$payload`:
  keys sorted at every level (`dc_ksort_deep`), list order kept (reordering
  items is a different payload), `JSON_UNESCAPED_UNICODE | UNESCAPED_SLASHES |
  PRESERVE_ZERO_FRACTION` (`5`, `5.0` and `"5"` all differ). Provenance fields
  are not part of the hash.
- Order: validate → check key/actor/options → take `DC_REF_LOCK` → begin (READ
  COMMITTED) → look the key up → if found: roll back, release, answer (same hash
  → the stored quotation with `replayed: true`; other hash → refusal) → else
  INSERT the request row → allocate → INSERT quotation (one 1062 retry) → write
  the `create` revision → UPDATE the request row with `quotation_id`, `ref_no`
  → COMMIT → release.
- The request row, the quotation and its revision are one transaction. A
  failure anywhere before COMMIT leaves none of them.
- Concurrency: the lookup runs under `DC_REF_LOCK`, so a second submit waits
  for the first to commit and then replays it. `UNIQUE (actor_user_id,
  idempotency_key)` is the backstop: a 1062 on the request row is answered
  from the existing row; if there is none, the create fails closed.
- No new numbering: the existing lock, allocator and retry are used unchanged.
- A replay writes nothing (no row, no AUTO_INCREMENT consumed).

## 4. Table

`migrations/2026-11-11-create-quotation-create-requests.sql`:

```sql
CREATE TABLE IF NOT EXISTS quotation_create_requests (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source              VARCHAR(20)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  idempotency_key     CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload_sha256      CHAR(64)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_user_id       BIGINT UNSIGNED NOT NULL,
  actor_username      VARCHAR(64)  COLLATE utf8mb4_general_ci NOT NULL,
  ext_version         VARCHAR(20)  CHARACTER SET ascii COLLATE ascii_bin NULL,
  parser_core_sha256  CHAR(64)     CHARACTER SET ascii COLLATE ascii_bin NULL,
  pricing_core_sha256 CHAR(64)     CHARACTER SET ascii COLLATE ascii_bin NULL,
  settings_version    VARCHAR(40)  CHARACTER SET ascii COLLATE ascii_bin NULL,
  wa_contact_id       INT          NULL,
  quotation_id        INT          NULL,
  ref_no              VARCHAR(100) COLLATE utf8mb4_general_ci NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_qcr_actor_key (actor_user_id, idempotency_key),
  KEY idx_qcr_quotation (quotation_id),
  KEY idx_qcr_contact (wa_contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

Differences from the plan's §7.2 sketch: the unique key is per user
(`actor_user_id, idempotency_key`) as required, and the provenance columns are
nullable so the table can exist before the service checks are built.

## 5. Runbook

The table is **not needed** to deploy this change: the browser path never
touches it. Apply it before any keyed create is exposed.

1. **Backup first.** phpMyAdmin → Quotation's database → Export → Custom →
   all tables, structure and data → SQL. Check the file opens and is not empty.
2. Run **section 1** of the migration (read-only) and read it: 3 rows in 1a,
   0 rows in 1b, `int` in 1c. Anything else: stop.
3. Run **section 2**. It is re-runnable; an existing table of another shape
   stops it at the guard (error 1242) before anything is created.
4. Run **section 3** and check `uq_qcr_actor_key` is unique on
   `actor_user_id, idempotency_key`, and 0 rows.

**Rollback** (`…rollback.sql`): it refuses (error 1242) while rows exist unless
the table was exported and `SET @qcr_export_verified := 'YES';` is un-commented.
Quotations are never touched. Rolling back the *code* to `ca5f0a5` needs no
database step; the leftover `quotation_store.php` is unused by the old
`api.php` and harmless.

**Deploy order.** `quotation_store.php` must be copied **before** `api.php`
(add it to `.cpanel.yml` APPFILES ahead of `api.php`; `version.php` stays
last), so there is never a moment where the new `api.php` is live without it.

## 6. Tests

| Suite | Needs | Proves |
|---|---|---|
| `quotation_store_static` | git + `ca5f0a5` | include is side-effect free; every moved function byte-identical to production; nothing lost or duplicated; nothing exposed; key/hash/options rules |
| `quotation_store_db` | `DC_TEST_DB_*` (skips without) | migration forward / again / rollback (refused, then confirmed) / forward, wrong-shape refusal; create; replay writes nothing; conflict; per-user scope; malformed keys; rollback on three failure points; 1062 retry and second-1062 failure; 8 parallel creates get 8 consecutive refs; 4 parallel same-key submits → one quotation (released together and queued on the lock); same key different payload in parallel → one created, one refused |
| `quotation_store_parity` | `DC_TEST_DB_*` (skips without) + git | production vs extracted, byte-identical responses, statuses and stored rows |

Test-only code (`tests/php/quotation_store/harness.php`, `create_child.php`)
lives under `tests/` and is not in the deploy allow-list.
