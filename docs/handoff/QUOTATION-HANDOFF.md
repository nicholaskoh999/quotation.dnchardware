# Quotation — DNC Workspace handoff (target side, contract v2)

**Round:** DNC WORKSPACE V1 — SESSION C: QUOTATION HANDOFF · branch `round/r5-c-portal-handoff`
**Contract:** `nicholaskoh999/dnc-portal` `docs/HANDOFF-CONTRACT.md` at `bab1b67e8e52bc8ce63d6e196281f4f82acdd55d`
(branch `round/a-portal-foundation`). This file describes how Quotation implements it; it does not change it.
**Status:** built and tested, **ships switched OFF**, **not deployed**.

---

## 1. What it does

`portal.dnchardware.com` → "Open Quotation" → `GET quo…/auth/handoff/start` → 303 to the Portal with a state only
this browser's Quotation session knows the hash of → the Portal signs a 60-second `v2.` token bound to that state →
`GET quo…/auth/handoff/callback?token=v2.…` → Quotation verifies it, re-reads the canonical user, and creates **its
own** session → 303 `/`.

Portal session ≠ PO session ≠ Quotation session. No cookie is shared and none is set on `.dnchardware.com`.

## 2. Files

| File | Role |
| --- | --- |
| `app/Handoff/Contract/HandoffToken.php` | the Portal's contract code, **byte for byte** (git blob `9544a1b…`) |
| `app/Handoff/Contract/InvalidHandoffToken.php` | the Portal's refusal reasons, **byte for byte** (blob `abeb104…`) |
| `dnc_handoff.php` | Quotation's target controller: `/start`, `/callback` (§6.4 order), read-only users connection, replay, rate limit |
| `handoff.php` | entry point the two paths are rewritten to; dispatches on the request **path** only |
| `auth.php` | `__Host-` cookie in production, host-only; DNC identity in `dc_current_user()`; per-request recheck |
| `login.php` | the one generic failure message (EN / 中文) |
| `index.php`, `companies.php` | "DNC Workspace" link → `https://portal.dnchardware.com` |
| `dnc_config.sample.php` | the settings, as a server-only fallback file |
| `migrations/2026-10-20-create-handoff-tables.sql` | `handoff_consumed_tokens`, `handoff_rate_limits` (Quotation's own DB) |
| `tests/php/handoff_contract.test.php` | the Portal's contract test, unchanged, plus Quotation's audience |
| `tests/php/handoff_flow.test.php` | every flow, against real MySQL, in-process and over HTTP |
| `tests/suites/44-dnc-workspace-link.test.js` | the link, desktop and phone |

## 3. Identity

- **Canonical user:** Internal PO's `users` table, matched by `users.id == sub` **only**.
- **Read:** `id, username, name, role, is_active, is_legacy_placeholder, must_change_password` —
  `SELECT … FROM users WHERE id = ? LIMIT 1`. `name` is used for display only. Never email, never by name.
- **Refused:** missing, `is_active = 0`, `is_legacy_placeholder = 1`, `must_change_password = 1`; at the callback also
  `username ≠ token.username` or `role ≠ token.role` (cross-check only — access never comes from the token).
- **No Quotation users table** for DNC identities; no Quotation-local user records; no last-sign-in write.
- **Session (DNC):** `dc_auth`, `dc_auth_source = 'dnc'`, `dc_dnc_user_id` (canonical id), `dc_username`,
  `dc_display_name`, `dc_dnc_role`, `dc_login_time` (+ the `dc_user` alias). No `dc_user_id`.
- **`dc_current_user()`** for a DNC session: `['id' => null, 'username', 'display_name', 'source' => 'dnc',
  'dnc_user_id']`. For an app_users session it is unchanged.
- **History:** `api.php` is unchanged; because `id` is NULL, `quotation_revisions.actor_user_id` is **NULL** for DNC
  sessions, `actor_username` = canonical username, `actor_display_name` = canonical `name` (trimmed, cut to the
  column's 100 characters), else the username. A canonical id is never written where an app_users id belongs. A
  future round may add `actor_source` / `canonical_user_id`.
- **Password sign-in (app_users) is unchanged** and keeps working with the handoff on or off. Same functional access
  for every active DNC user; no Quotation role model.

## 4. Configuration

Read from the **environment first**; `dnc_config.php` (copied from `dnc_config.sample.php`, server-only, git-ignored,
never overwritten by the deploy) is the fallback.

| Name | Default | |
| --- | --- | --- |
| `DNC_HANDOFF_ENABLED` | `false` | `true` serves the two endpoints |
| `DNC_HANDOFF_SECRET` | empty | `base64:` + 32 random bytes; **same value as the Portal's `DNC_HANDOFF_SECRET_QUOTATION`**; must differ from the PO key |
| `DNC_HANDOFF_SECRET_PREVIOUS` | empty | old key during a rotation only |
| `DNC_PORTAL_URL` | `https://portal.dnchardware.com` | plain `https://host` origin, else `/start` refuses |
| `DNC_USERS_DB_HOST` / `_PORT` / `_DATABASE` / `_USERNAME` / `_PASSWORD` | empty / `3306` | read-only canonical users connection |

Generate the key: `php -r 'echo "base64:".base64_encode(random_bytes(32)), PHP_EOL;'`

## 5. Routing (host rewrite) — required, applied by hand

The two URLs are fixed by the contract and have no file of their own. Add to the live `.htaccess` in
`/home5/dnchardw/quo.dnchardware.com/` (keep everything already there; cPanel may manage parts of it):

```apache
RewriteEngine On
RewriteRule ^auth/handoff/(start|callback)$ handoff.php [L,QSA]
```

`.htaccess` is on the deploy's PROTECTED list: it is never shipped or overwritten.

## 6. Database

1. **Quotation DB** (the one `db.php` opens): run `migrations/2026-10-20-create-handoff-tables.sql` sections 1–3.
2. **Canonical users DB:** a MySQL user that can **only read** `users`:

   ```sql
   GRANT SELECT ON <canonical_schema>.users TO '<quotation_users_ro>'@'localhost';
   ```

   If cPanel cannot grant per table, SELECT on the schema. Never INSERT/UPDATE/DELETE. The application additionally
   puts the connection into `SET SESSION TRANSACTION READ ONLY`.

## 7. Session cookie

Production (HTTPS): `__Host-DCQUOSESS`; `Secure; Path=/; HttpOnly; SameSite=Lax`; **no Domain** (forced empty even if
the host sets `session.cookie_domain`). Plain HTTP (local only) keeps `DCQUOSESS`. **Deploying the rename signs
everyone out once.** No remember-me exists or is added; the 7-day lifetime is unchanged.

## 8. Per-request enforcement

Every protected request (`index.php`, `companies.php` via `dc_require_login`; `api.php`, `ai_extract.php` via
`dc_require_api_login`) re-reads the canonical row for a DNC session: inactive, legacy placeholder,
must-change-password or a changed username **ends the Quotation session** on that request. If the canonical DB
cannot be reached, the request is refused (fail closed) and the session is kept. app_users sessions do not touch the
canonical DB.

## 9. Failures

Browser: 303 `/login.php`, one message ("That sign-in link is invalid or has expired. Please sign in." /
「登录链接无效或已过期，请重新登录。」). Server log (`error_log`): `[handoff] auth.handoff_failed reason=… ip=…`
(+ `jti`, `sub` once the signature verified). Every handoff response: 303 (429 when throttled, 404/405 for other
paths/methods), empty body, `Referrer-Policy: no-referrer`, `Cache-Control: no-store, private`. Never logged: token,
state, secret, password, session id.

## 10. Where Quotation differs from the reference controller (mechanics only, not protocol)

| Contract (Laravel reference) | Quotation |
| --- | --- |
| `throttle` middleware 30/min/IP | `handoff_rate_limits` table, atomic upsert, 30/min per IP per endpoint, IP stored as SHA-256 |
| `/login`, home `/` | `/login.php`, home `/` |
| `session()->flash()` | `$_SESSION['dc_flash']`, read once by `login.php` |
| `invalidate → login → regenerate → regenerateToken` | `$_SESSION = []` → `session_regenerate_id(true)` (old session file deleted) → identity; Quotation has **no CSRF token** yet (CSRF is a deferred round), so there is none to regenerate |
| refuse a key equal to `APP_KEY` | Quotation has no `APP_KEY`; the Portal refuses PO key = Quotation key |
| `.env` | environment, else `dnc_config.php` |

## 11. Go-live (not done in this round)

1. Owner confirms §12. 2. Apply §6.1, create the §6.2 user. 3. Deploy; merge §5 into `.htaccess`. 4. Set
`DNC_HANDOFF_SECRET` + `DNC_USERS_DB_*`, `DNC_HANDOFF_ENABLED=true`. 5. Portal: same secret in
`DNC_HANDOFF_SECRET_QUOTATION`, `DNC_HANDOFF_QUOTATION_ENABLED=true`. 6. A staff member opens the card.
**Rollback:** Portal switch `false` (the card becomes a plain link); or Quotation `DNC_HANDOFF_ENABLED=false`.

## 12. Production facts still required (never guessed here)

- Canonical schema name (`dnchardw_dnc_po_v2` per Internal PO's deployment docs vs `dncdata.dnc_po_v2` per an
  earlier brief), host (expected `localhost` on the same cPanel account) and port.
- A SELECT-only MySQL user for Quotation on that `users` table, and its password.
- The Quotation handoff key (generated once, set on Portal and Quotation only, different from the PO key).
- The live `.htaccess` content and that `mod_rewrite` (or LiteSpeed rewrite) is active.
- Production PHP ≥ 8.1 (contract code uses `readonly`, `array_is_list`; production is recorded as 8.4).
- Whether `X-Forwarded-Proto`/`HTTPS` reaches PHP on the live host (decides `__Host-` + `Secure`).
