# Auth / Workspace / Named identity — Wave 1 Session C notes

Authority: `docs/quotation-next/OWNER-APPROVED-REWRITE-HANDOFF.md` §5 (named users, Prepared By), §4 (Back to
DNC Workspace), §27 (contract reuse). Legacy oracle: `auth.php`, `login.php`, `logout.php`,
`migrations/2026-08-26-create-app-users.sql`, `docs/control/PROJECT-GUARDRAILS.md` "ACCEPTED — WHO IS ASKING".
Handoff source: `origin/round/r5-c-portal-handoff` (`dnc_handoff.php`, `app/Handoff/Contract/*`,
`docs/handoff/QUOTATION-HANDOFF.md`) — ported, not merged.

## 1. Identity rules

- **Source:** the legacy `app_users` table, read through the `legacy` connection, **SELECT only**
  (`App\Auth\LegacyAppUserProvider`). Nothing here writes to it: no rehash-on-login, no remember token, no
  last-login column. `App\Auth\AppUser` is a plain `Authenticatable`, not an Eloquent model, so it cannot be saved.
- **Username:** `Username::normalize()` is an exact port of `dc_normalize_username()` —
  `strtolower(trim((string) $raw))`. `display_name` keeps its own casing. The password is never trimmed or folded.
- **Check (legacy `dc_login()`):** lookup by normalised username, `LIMIT 1`; `password_verify()` (the PHP function,
  so production bcrypt hashes verify unchanged); `enabled = 0` refused; a row without id / username / display name
  refused. An unknown user verifies against the legacy dummy bcrypt hash (`DC_AUTH_DUMMY_HASH`) — this
  **reduces the username-enumeration timing signal; it is not a claim of identical end-to-end timing**. A 400 ms
  floor sits under every failure (`QUO_AUTH_FAILURE_DELAY_MS`, legacy `usleep(400000)`). Database errors fail
  closed with the same generic message and a log reason code only.
- **`admin` is refused** even if someone re-enabled the row (`quotation.auth.refused_usernames`). Defence in depth:
  the owner disabled the row and it stays disabled; `admin` is a role, never a shared login. There is **no
  shared-admin fallback** and none may be added. The old `users` table is never touched.
- **Messages:** exactly the legacy two — "Please enter both username and password." and "Wrong username or
  password." (the same message for wrong password, unknown user, disabled user and `admin`).
- **Session facts** (`IdentityGuard::SESSION_KEY = quo_identity`), read from the verified row, never from input:
  app_users → `source, user_id, username, display_name, login_time`; DNC → `source, dnc_user_id, username,
  display_name, dnc_role, login_time`. Malformed or partial facts (including the legacy shared-admin shape) are
  treated as signed out — never a partial actor.
- **An ordinary signed-in request does not query `app_users`** (legacy rule, tested). Consequence, same as legacy:
  setting `enabled = 0` takes effect at that person's next sign-in (or at the absolute cap). DNC sessions are the
  exception: their canonical row is re-read on every request (§4).
- **Two id spaces never mix.** `Actor::$id` is an app_users id, or `null` for a DNC session; the canonical
  `users.id` is only ever `dncUserId` (and `AppUser::getAuthIdentifier()` answers `"dnc:<id>"`). This mirrors the
  legacy branch: revision history records `actor_user_id NULL` for DNC sessions.

### Current actor, Prepared By, editor

- `App\Services\Identity\CurrentActor` — THE one server-side accessor (`get(): ?Actor`, `require(): Actor`), the
  Laravel equivalent of `dc_current_user()`. Future write paths read this, never the session or request input.
- `App\Services\Identity\PreparedBy::forNewQuotation()` — the authenticated display name. System-filled and
  read-only; it takes no request, so it cannot come from input (tested with a hostile `prepared_by` field).
- **Original creator preserved:** on save, Prepared By stays with the quotation; a later edit by another user must
  not replace it. `prepared_by` is document data, not the actor.
- **Editor tracked separately:** `App\Services\Identity\EditorStamp {actorId, username, displayName, at, source}`
  is groundwork only (value object). **No database write in Wave 1** — Wave 2 (write path) decides persistence.
- Shared Inertia props: `auth.user = {id, username, displayName, source: 'app_users'|'dnc'} | null` and
  `workspace.url` (TS: `resources/js/types/index.ts`). No role, hash or canonical id is ever shared.

## 2. Routes

| route | access | notes |
|---|---|---|
| `GET /health` | public | unchanged |
| `GET /login`, `POST /login` | guests (`guest` → `/` when signed in) | legacy `?next=` honoured if a same-origin path |
| `POST /logout` | anyone | not behind `auth`, so it always clears this browser |
| `GET /auth/handoff/start`, `/callback` | public, **404 unless enabled** | §4 |
| everything else | `auth` → guest redirected to `/login` | put new pages inside the `auth` group in `routes/web.php` |

`tests/Feature/Auth/RouteProtectionTest.php` fails if any route outside the allowlist lacks `auth`. After sign-in
the browser returns to the intended page via `SafeNext` (port of `dc_safe_next()`: starts with `/`, not `//`, no
backslash, no control characters; an absolute intended URL is reduced to path + query only when its host is this
request's host).

## 3. Session / cookie / CSRF

| setting | value | env |
|---|---|---|
| driver | file (`storage/framework/sessions`) | `SESSION_DRIVER` |
| cookie name | `dcquo_next_session` — never legacy `DCQUOSESS` / `__Host-DCQUOSESS` | `SESSION_COOKIE` |
| domain | none (host-only); never `.dnchardware.com` | `SESSION_DOMAIN` (leave null) |
| Secure | local `false`; HTTPS preview `true` (or unset = automatic on HTTPS) | `SESSION_SECURE_COOKIE` |
| HttpOnly / SameSite | true / lax | `SESSION_HTTP_ONLY`, `SESSION_SAME_SITE` |
| idle lifetime | 480 min | `SESSION_LIFETIME` |
| absolute cap | 7 days per sign-in (legacy `DC_AUTH_LIFETIME`) | `QUO_AUTH_ABSOLUTE_LIFETIME` |
| remember-me | **none** — `$remember` ignored, `viaRemember()` false, provider has no token | — |

- Sign-in: `session()->migrate(true)` (new id, fixation) + CSRF token rotated. Sign-out: identity forgotten,
  session invalidated, CSRF rotated, 303 `/login` with "You have been signed out on this device."
- CSRF: Laravel 13 `PreventRequestForgery` in the `web` group covers `POST /login` and `POST /logout` (tested
  with the unit-test bypass switched off: JSON → 419). It also accepts a browser-sent `Sec-Fetch-Site:
  same-origin`, Laravel's default. A browser form post with a stale token is turned into the R1 "session expired"
  redirect by `bootstrap/app.php` and never signs anyone in.
- Optional on an HTTPS-only preview: `SESSION_COOKIE=__Host-dcquo_next_session` (browsers then enforce Secure,
  Path=/, no Domain). Not the default because it breaks plain-HTTP local runs.

## 4. DNC Workspace handoff (contract v2) — SHIPS OFF

- **Contract code:** `app/Handoff/Contract/HandoffToken.php` and `InvalidHandoffToken.php` are the Portal's files
  **byte for byte** (git blobs `9544a1b…`, `abeb104…`; `HandoffFlowTest` checks the blob ids). Their namespace
  `App\Handoff\Contract` already matches Laravel PSR-4 (`App\` → `app/`): no edit, no composer change. The Portal's
  contract test is copied unchanged as `tests/Feature/Handoff/HandoffTokenTest.php`.
- **Flow:** `App\Http\Controllers\Auth\HandoffController` — the legacy `dnc_handoff.php` order (§6.4): disabled →
  404; rate limit; token present; keys; `HandoffToken::verify()` (format, signature, iss, aud = `quotation`, claims,
  lifetime, time, state bound to this session); consume state; consume jti (replay); re-read the canonical row by
  `users.id` only; refuse inactive / legacy placeholder / must-change-password / username or role ≠ token;
  `session()->invalidate()` → DNC identity → CSRF rotated → other tabs' pending states kept; 303 `/`.
- **Responses:** 303 (429 when throttled), empty body, `Referrer-Policy: no-referrer`, `Cache-Control: no-store,
  private`. Every failure: 303 `/login` with the one message "That sign-in link is invalid or has expired. Please
  sign in." Any exception → `internal_error`, same response.
- **Per-request recheck:** a DNC session re-reads its canonical row on every request; inactive / placeholder /
  must-change-password / changed username ends the session; an unreachable users DB refuses the request but keeps
  the session (fail closed).
- **Logging:** `[handoff] <event> reason=… ip=… jti=… sub=…` via `App\Handoff\HandoffLog` (legacy sanitiser: only
  short codes, IPs, 32-hex jti, decimal ids). Never the token, state, secret, password or session id.
- **Mechanics that differ from the legacy branch (not protocol):** replay (`handoff:jti:<jti>`, atomic `add`,
  kept until exp + 3600 s) and rate limit (30/min per IP per endpoint, SHA-256 bucket) live in the **Laravel
  cache** (`file` store by default) — **no migration, no new table**. Disabled → **404** (legacy answered 303
  `/login`), per the Wave 1 brief. Login is `/login` (not `/login.php`). Laravel CSRF exists, so the token is
  rotated after a handoff sign-in.
- **Canonical users DB:** the `dnc_users` connection is registered at boot from `quotation.handoff.users_db`
  (not in `config/database.php`, to stay out of the read layer's file). It opens with
  `SET SESSION TRANSACTION READ ONLY` (MySQL init command) — tested against a throwaway local schema: an UPDATE
  fails even as root. Unset (default) → every callback refuses with `user_source_unavailable`.

| env | default | |
|---|---|---|
| `DNC_HANDOFF_ENABLED` | `false` | `true` serves the two endpoints |
| `DNC_HANDOFF_SECRET` | empty | `base64:` + 32 random bytes; same as the Portal's `DNC_HANDOFF_SECRET_QUOTATION`; must differ from the PO key |
| `DNC_HANDOFF_SECRET_PREVIOUS` | empty | old key during a rotation only |
| `DNC_HANDOFF_CACHE_STORE` | `file` | replay + rate-limit store |
| `DNC_PORTAL_URL` | `https://portal.dnchardware.com` | Workspace link and the only `/start` redirect origin (plain `https://host` else refused) |
| `DNC_USERS_DB_HOST` / `_PORT` / `_DATABASE` / `_USERNAME` / `_PASSWORD` | empty / `3306` | SELECT-only canonical users account |

## 5. Tests

- Pest: `tests/Feature/Auth/LoginTest.php`, `IdentityTest.php`, `RouteProtectionTest.php`,
  `tests/Feature/Handoff/HandoffTokenTest.php` (Portal contract, unchanged), `HandoffFlowTest.php` (flow port),
  `DncUsersReadOnlyTest.php` (local MySQL, skipped if absent). `app_users` / `users` tables are created **inside
  the tests** (sqlite in-memory, `tests/Support/Identity.php`) — never a migration file.
- Playwright: `tests/e2e/auth.spec.ts` (desktop + phone). `global-setup.ts` seeds a throwaway local-MySQL schema
  `quo_next_e2e_auth` (test-only accounts) that the e2e server signs in against; teardown drops it. Without a local
  MySQL the full sign-in specs skip and the guest/validation specs still run.

## 6. NOT done in Wave 1

- Quotation → Internal PO handoff (§27) — Wave 3 (Session J); it reuses this contract mechanism, not its payload.
- Admin role / permissions (§5: admin is a role) — no role model; every signed-in user has the same access. The
  DNC role is stored in the session for the cross-check only and grants nothing.
- Persisting Prepared By / EditorStamp / activity — Wave 2 write path. No DB writes here.
- Login throttling beyond the legacy 400 ms floor (legacy had none), password reset, user management, 2FA.
- A "Back to DNC Workspace" control in the navigation — Session A owns the shell; it reads `workspace.url`.
- Logo / bilingual (EN / 中文) login copy — the new app has no i18n layer yet.

## 7. Open gates

1. **`admin` username from the DNC Workspace.** The app_users `admin` login is refused; a canonical DNC user whose
   username is literally `admin` is *not* refused (the legacy branch did not refuse it, and the Portal decides who
   is active). Owner to confirm whether it should be.
2. **Disable takes effect at next sign-in** for app_users sessions (legacy behaviour, because no per-request
   query). If the owner wants immediate revocation, add a per-request re-read (one indexed SELECT per request).
3. **Login rate limiting** — not added (legacy has none; changing it is a security-policy decision). Recommended
   before production.
4. **Handoff go-live facts** (from the legacy branch §12, still required, never guessed): canonical schema name and
   host, a SELECT-only MySQL user, the Quotation handoff key, preview hostname/HTTPS (decides Secure / `__Host-`).
5. **Session idle lifetime** — 480 min (R1 default) vs the legacy "stays signed in about 7 days". The 7-day
   absolute cap is ported; whether staff should stay signed in for days without activity is an owner choice.
6. **Integration:** the e2e webServer now points `LEGACY_DB_*` at the throwaway schema; Session D's read-layer
   specs may need their own tables seeded there (or a different schema via `E2E_LEGACY_DB`).
