# CSRF design and audit — 2026-10-20

Round **QUICK ADD TL OVERRIDE + HARDENING AUDIT**, session C.
Branch `round/quo-c-error-escape-csrf`, base `main` `076e2ae`.

**This is a design and audit document only. No token, header or check is
implemented in this round.** The CORS change in §5 is a recommendation only.

---

## 1. Summary

- **Today's protection is the session cookie's `SameSite=Lax` and nothing
  else.** No endpoint checks a token, `Origin`, `Referer`, `Sec-Fetch-Site`, the
  request method or the request `Content-Type`.
- Lax blocks the usual attack: a **cross-site** POST from another domain does
  not carry the cookie. It leaves three real gaps:
  1. **State changes reachable by GET.** A top-level GET navigation from any
     site *does* carry a Lax cookie. `api.php` never checks the method, and
     `reset_whatsapp_template` needs no body. So
     `https://quo.dnchardware.com/api.php?action=reset_whatsapp_template`,
     opened as a link or redirect from any site, overwrites the template.
     `logout.php` also signs the user out on a GET, which is a nuisance only.
  2. **Same-site, cross-origin requests.** SameSite works per *site*
     (`dnchardware.com`), not per origin. Any page on a sibling host, such as
     the main `dnchardware.com` site or another cPanel subdomain, counts as
     same-site and its requests carry the cookie. A cookie-carrying
     `text/plain` form POST from such a page skips CORS preflight. `api.php`
     runs `json_decode` on the raw body whatever its `Content-Type`, so a body
     like `{"id":5,"x":"="}` is accepted. Every mutating action is reachable
     this way. A compromise or XSS on any sibling host therefore becomes write
     access to quotations.
  3. **Browser variance.** Lax enforcement relies on the browser. Old or
     embedded browsers that ignore `SameSite` fall back to sending the cookie
     everywhere.
- **Recommendation: layered.** First, make the API refuse what it never needs:
  wrong method, non-JSON body, and cross-site / same-site `Sec-Fetch-Site` or a
  mismatched `Origin`. Then add a per-session synchronizer token sent as a
  request header, rolled out report-only first. Drop the
  `Access-Control-Allow-Origin: *` header, which the app does not use.

---

## 2. Endpoint inventory

The app's own client calls api.php through one helper in each page:
`api()` in index.php (9454) and in companies.php (1130). Both send GET with no
body, or POST with `Content-Type: application/json` and a JSON body. The server
does **not** enforce either.

### 2.1 `api.php` — state-changing actions (all need login)

| Action | Writes | Reads input from | Reachable by bodyless GET? |
|---|---|---|---|
| `add_company` | INSERT companies | JSON body | no (fails on empty name) |
| `update_company` | UPDATE companies | JSON body | no (missing id) |
| `delete_company` | DELETE companies | JSON body | no-op (id 0) |
| `save_quotation` | INSERT quotations + revision | JSON body | no (no items) |
| `update_quotation` | UPDATE quotations + revision | JSON body | no (missing id) |
| `delete_quotation` | DELETE quotations | JSON body | no-op (id 0) |
| `save_default_price` / `update_default_price` | INSERT / UPDATE default_prices | JSON body | no (missing data) |
| `delete_default_price` | DELETE default_prices | JSON body | no-op |
| `save_diameter_setting` / `update_diameter_setting` | INSERT / UPDATE diameter_settings | JSON body | no |
| `delete_diameter_setting` | DELETE diameter_settings | JSON body | no-op |
| `save_whatsapp_template` | UPDATE + INSERT whatsapp_templates | JSON body | no (template required) |
| **`reset_whatsapp_template`** | UPDATE + INSERT whatsapp_templates | nothing | **YES — exploitable today** |
| `import_diameter_settings` (`mode=confirm`) | INSERT diameter_settings | JSON body | no (preview only) |
| `import_default_prices` (`mode=confirm`) | INSERT default_prices | JSON body | no (preview only) |

Read-only actions are `get_next_ref`, `get_companies`, `get_quotations`,
`find_quotation`, `search_items`, `get_quotation`, `get_quotation_history`,
`get_price_history`, `get_pricing_history`, `get_default_prices`,
`get_diameter_settings`, `get_whatsapp_template`, the two `*_template` CSV
downloads and the two `export_*` downloads. They change nothing. A cross-origin
read is blocked separately: `Access-Control-Allow-Origin: *` cannot be combined
with credentials, so the browser withholds the response from the attacker.

### 2.2 Other endpoints

| Endpoint | Method | Body | State it changes | Login |
|---|---|---|---|---|
| `ai_extract.php` | POST only (enforced, 405 otherwise) | `multipart/form-data` (CORS-simple) | no DB write, but **spends OpenAI quota** | yes (`dc_require_api_login`) |
| `login.php` | POST form | `application/x-www-form-urlencoded` (CORS-simple) | creates a session | — |
| `logout.php` | **GET** (any method) | none | destroys this browser's session | — |
| `companies.php`, `index.php` | GET pages | — | none (they call api.php) | yes |
| `pricing_history.php` | library only, never requested | — | — | — |

---

## 3. Current protection, assessed

| Control | Present? | Notes |
|---|---|---|
| Authenticated session | yes | `DCQUOSESS`, HttpOnly, Secure on HTTPS, 7-day, strict mode, regenerated at login (auth.php 64–90, 223). |
| `SameSite=Lax` | yes | Blocks cross-**site** POST/fetch/XHR and subresource requests. Does **not** block top-level GET navigation or same-site requests. Set explicitly, so Chrome's "Lax-by-default, 2-minute POST" exception does not apply. |
| Method check | **no** in api.php, **yes** in ai_extract.php | api.php dispatches on `?action=` whatever the method. |
| Content-Type check | **no** | api.php `json_decode`s `php://input` whatever the content type. A `text/plain` form can produce valid JSON. This is what turns a CORS-simple request into a working write. |
| CORS | `Access-Control-Allow-Origin: *`, methods GET/POST/PUT/DELETE, header Content-Type | Grants nothing to a credentialed cross-origin call (browsers refuse `*` with credentials). A cross-origin `application/json` POST is preflighted, and the preflight OPTIONS has no cookie, so it gets a 401 from `dc_require_api_login()` and fails. The header protects nothing and is not needed by a same-origin app. |
| `Origin` / `Referer` | not checked | Current browsers send `Origin` on every non-GET fetch, same-origin included, and on cross-origin form POSTs. `Sec-Fetch-Site` is sent by all current engines. `Referer` can be stripped by policy or extensions, so it is a fallback, not a primary check. |
| Token | no | — |

**Exposure, in order:**
1. `reset_whatsapp_template` by GET from anywhere. Low impact (a template is
   reset to its default), but exploitable today with a link.
2. Every mutating api.php action from any same-site sibling host, using a
   `text/plain` POST. High impact (delete or alter quotations and prices). It
   needs a foothold on a `*.dnchardware.com` host.
3. Logout CSRF by GET. Nuisance only.
4. `ai_extract.php` from same-site hosts, with multipart. Cost only.
5. Login CSRF. Low with a shared staff account, but the attacker could sign a
   victim into an account the attacker controls.

---

## 4. Recommended design — layered

### Layer 1 — refuse what the app never sends (no client change)

One gate in `api.php`, immediately after `dc_require_api_login()`:

- An allowlist `DC_MUTATING_ACTIONS` lists the actions in §2.1.
- For those actions, **require `POST`** (405 otherwise) and **require
  `Content-Type: application/json`** (415 otherwise). A cross-origin request
  with that type is always preflighted, and the preflight fails as described in
  §3. The `text/plain` trick stops working.
- **Fetch-metadata / Origin check:** reject when `Sec-Fetch-Site` is present
  and is not `same-origin`, or when `Origin` is present and is not this site's
  own origin, built from the configured host and never from `Host` alone. When
  both are absent (very old clients), allow and log during migration, then
  decide.
- `logout.php`: accept POST only. The Sign Out links in index.php (3129, 3146)
  and companies.php (762) become small forms.
- `ai_extract.php`: apply the same `Sec-Fetch-Site` / `Origin` check. Its POST
  check already exists.

This layer alone closes gaps 1, 2 and 3 for every current browser, with no
change to the client's request shape.

### Layer 2 — synchronizer token (defence in depth)

- `auth.php`: `dc_csrf_token()` mints `bin2hex(random_bytes(32))` into
  `$_SESSION['dc_csrf']` on first use and rotates it at login, where
  `session_regenerate_id` already runs. `dc_csrf_verify($sent)` uses
  `hash_equals`.
- Pages: index.php and companies.php print it once as
  `<meta name="dc-csrf" content="…">`.
- Client: both `api()` helpers add `X-DC-CSRF: <token>` to POST. The two
  `fetch('ai_extract.php')` calls (index.php 15780 and 16432, in the Quick Add
  region, so coordinate with Session A's owner of that region) add the same
  header. A custom header also forces a cross-origin preflight on its own.
- Server: the api.php gate and ai_extract.php check the header on mutating
  requests. On mismatch they answer `{"ok":false,"error":"csrf","auth":true}`
  with 403. The client tells the user to reload, or refetches the token once.
  It never retries in a loop.
- `login.php`: a pre-session token in a hidden field (the session already
  starts on GET), checked on POST.

### Why layered rather than one or the other

- **Origin/fetch-metadata only** is cheap and needs no client change. But it
  depends on headers that some proxies, extensions or old WebViews drop, and on
  the "header absent" policy being right.
- **Token only** is robust but is the larger change. It touches every client
  call site and the test harness's API stubs. On its own it still leaves the
  method and content-type looseness in place.
- **Layered:** Layer 1 lands first, cheaply, and closes today's real gaps.
  Layer 2 covers what Layer 1 cannot see.

---

## 5. CORS — recommendation only

Remove these three lines from api.php (lines 3–5):

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type
```

The app is same-origin: both pages call `api.php` by a relative URL. The
header grants nothing useful today and invites a future "fix" to
`Allow-Credentials: true` with a reflected origin, which would turn every CSRF
into a cross-origin read as well. `PUT` and `DELETE` are never used. If a
cross-origin consumer appears later, allow that one origin explicitly.

---

## 6. Touch points

| File | Change |
|---|---|
| `auth.php` | `dc_csrf_token()`, `dc_csrf_verify()`, `dc_request_is_same_origin()` (Sec-Fetch-Site / Origin / configured host), token rotation in `dc_login()` |
| `api.php` | `DC_MUTATING_ACTIONS` allowlist, gate after `dc_require_api_login()` (method, content type, origin, token), CORS header removal |
| `ai_extract.php` | origin + token gate after `dc_require_api_login()` |
| `login.php` | hidden token field + check |
| `logout.php` | POST only (+ token) |
| `index.php` | `<meta name="dc-csrf">`; `api()` (9454) header; `fetch('ai_extract.php')` at 15780 and 16432; Sign Out links (3129, 3146) → forms; 403 `csrf` handling in `api()` |
| `companies.php` | `<meta name="dc-csrf">`; `api()` (1130) header; Sign Out link (762) → form |
| `tests/lib/harness.js` | API stubs accept or ignore the header; a fixture token in the served page |
| tests | a PHP gate test (method, content type, Sec-Fetch-Site, Origin, token present/absent/wrong, report-only vs enforce) on the sandbox pattern used by `tests/php/error_leakage.test.php`; a browser suite asserting every POST carries the header |

---

## 7. Migration

1. **Report-only (one deploy).** Ship Layer 1 and Layer 2 with a
   `DC_CSRF_MODE = 'report'` constant. Every check runs and every would-be
   rejection is written to `error_log` (`[csrf] would-reject action=… reason=…
   sfs=… origin=…`). Nothing is refused. Pages start sending the token at the
   same time.
2. **Watch the log for a few working days.** Expect zero would-rejects from
   staff. Any that appear, such as a stale tab from before the deploy or a
   browser that omits headers, show which policy needs adjusting before
   enforcement.
3. **Enforce Layer 1** (`DC_CSRF_MODE = 'enforce-origin'`): method, content
   type and fetch-metadata/Origin refusals go live. The token stays report-only.
4. **Enforce the token** (`'enforce'`). Pages loaded before step 1 have no
   token. The 403 `csrf` answer makes them reload, and a reload fixes it.
5. **Remove CORS** (§5) in the same deploy as step 3 or earlier. It has no
   client dependency.

Each step can be rolled back by flipping the constant back. None of the steps
needs a DB change.

---

## 8. Not done here

- No token, gate or header is implemented. Per ROUND-SCOPE, token
  implementation is deferred to a later round.
- The CORS header is unchanged.
- Whether production sends `Sec-Fetch-*` / `Origin` through LiteSpeed
  unchanged was not measured. That needs a read-only production check before
  step 3.
