# QUOTATION NEXT — PREVIEW DEPLOYMENT READINESS (Preview #1)

| | |
|---|---|
| Status | **READ-ONLY PREPARATION — NOTHING DEPLOYED** |
| Candidate | `round/w1-integration` @ the SHA recorded in `W1-INTEGRATION.md` |
| Production | **FORBIDDEN** — no instruction contains `PRODUCTION APPROVED BY OWNER` |
| Next action | wait for the owner's separate `QUO PREVIEW DEPLOY #1` instruction |

Every command in this document is **PROPOSED ONLY — NOT EXECUTED**. No SSH
session, upload, `mkdir`, Composer, npm, migration, `.env`, symlink, permission,
cache, DNS or cron action was performed against any server. This build session
cannot reach `*.dnchardware.com` at all (the egress proxy refuses it) and holds
no SSH key, so remote read-only inspection was **not** performed.

## 1. Evidence used

| source | what it establishes |
|---|---|
| this repo `.cpanel.yml`, `php.ini`, `docs/audit/2026-10-20-upload-capacity.md` | account `dnchardw`, home `/home5/dnchardw`; production QUO docroot `/home5/dnchardw/quo.dnchardware.com/` (copy-deploy via cPanel Git); LiteSpeed; production web PHP **8.4.26**; no rsync |
| `nicholaskoh999/internal-po` `round/r4-l-deploy-cagefs-fix` `docs/R3-PRODUCTION.md`, `public/.htaccess` (verified on the server 2026-10-18) | CageFS / CloudLinux; SSH key auth works; bash, git, curl, tar, gzip, sha256sum, flock present; **no Node / npm**; Composer 2.10.2 at `~/bin/composer`; CLI PHP `/opt/alt/php84/usr/bin/php` 8.4.26; ea-php84 extensions incl. pdo_mysql, mbstring, intl, openssl, fileinfo, tokenizer, xml (no `zip`, `sodium`); MySQL 8.0.46; `mysqldump --no-tablespaces`; **web PHP picked by the `.htaccess` AddHandler** (vhosts mapped to ea-php80 → 500 without it); Laravel apps live as checkouts under `~/repositories/<app>` with the subdomain docroot on `public/`; LiteSpeed follows same-owner symlinks; AutoSSL (Let's Encrypt) per subdomain; host upload default 2M/8M; quota ~23.7 GB free |
| `nicholaskoh999/dnc-portal` `ops/portal-release` `deploy/portal-release/*` (rehearsed) | SSH alias `dnc-payroll-office` from the Office machine (Git Bash); **no `/dev/fd`** (process substitution fails: `/dev/fd/63: No such file`); umask 077 extraction leaves 600/700 which LiteSpeed refuses → normalise **755/644**; Office-side build + checksum + scp + server script pattern; `flock` locking; `.env` never copied |

## 2. Readiness answers

| # | item | answer |
|---|---|---|
| 1 | Preview hostname | **proposed** `quo-preview.dnchardware.com` — owner to confirm |
| 2 | exists today? | **unknown** (not reachable from this session); assume no |
| 3 | DNS | **unknown**. cPanel subdomains on this account resolve to the shared IP once created (evidence: po.) |
| 4 | HTTPS | **unknown**; AutoSSL issues per subdomain after creation (evidence: po.) |
| 5 | document root | **proposed** `~/quo-next-preview/current/public` (symlink-switched releases). Fallback per house pattern: `~/repositories/quotation-next-preview/next/public` |
| 6 | SSH | alias `dnc-payroll-office` (key auth) — verified for this account by dnc-portal; owner to confirm it may be used for QUO preview |
| 7 | remote PHP | CLI `/opt/alt/php84/usr/bin/php` 8.4.26; web ea-php84 8.4.26 **only with the handler line** (now in `next/public/.htaccess`, tested) |
| 8 | PHP extensions | Laravel 13 needs ctype, filter, hash, mbstring, openssl, pcre, session, tokenizer, pdo_mysql, fileinfo, dom/xml — all present on ea-php84 |
| 9 | Composer | `~/bin/composer` 2.10.2 exists but is **not needed**: the artefact ships production `vendor/` |
| 10 | remote Node | **no** |
| 11 | frontend build | **local / Office** (or CI): `scripts/build-release.sh` |
| 12 | filesystem limits | CageFS: no `/dev/fd`, no rsync, umask 077 on extraction → 755/644 normalisation; every script is POSIX `sh` (Pest-guarded) |
| 13 | writable paths | `shared/storage/{framework/{sessions,cache,views},logs,app/private}`; `bootstrap/cache` inside each release (written by `config:cache`) |
| 14 | Laravel public arrangement | docroot = `public/` only; `.env`, `vendor/`, `storage/` outside the web root |
| 15 | `.env` categories | APP_NAME, APP_ENV=production, APP_KEY (generated once on the server), APP_DEBUG=false, APP_URL=https://<preview host>, LOG_*, LEGACY_DB_HOST/PORT/DATABASE/USERNAME/PASSWORD (**copied/test DB**), HEALTH_CHECK_DATABASE, SESSION_DRIVER=file, SESSION_SECURE_COOKIE=true, SESSION_LIFETIME, CACHE_STORE=file, QUEUE_CONNECTION=sync, QUOTATION_PRODUCTION_APPROVED=**false**, DNC_HANDOFF_ENABLED=**false** (DNC_* left empty), TRUSTED_PROXIES |
| 16 | APP_URL | `https://quo-preview.dnchardware.com` (proposed) |
| 17 | session / cookie | file driver; cookie `dcquo_next_session`, host-only, Secure on HTTPS, SameSite=Lax; cannot collide with legacy `DCQUOSESS`; 7-day absolute cap, 480-min idle (owner choice, §H) |
| 18 | proxy / host | LiteSpeed is the web server (no proxy): `TRUSTED_PROXIES=127.0.0.1`; production host refused in code (503) |
| 19 | preview DB | **copied / test database**, read-only use (Wave 1 never writes; the `legacy` connection is `SET SESSION TRANSACTION READ ONLY`) |
| 20 | copied DB exists? | **unknown / assume no** → owner action |
| 21 | production read-only later | relevant for Preview #2+ only (handoff §2); not configured |
| 22 | migrations | **none** — the app ships no migrations (tested) |
| 23 | release directories | `~/quo-next-preview/releases/<sha12>/`, `shared/`, `runs/<run-id>/`, `current` symlink |
| 24 | symlink feasibility | LiteSpeed follows same-owner symlinks (verified for po.); if cPanel refuses a symlinked docroot, point it at `releases/<sha12>/public` and switch by editing the docroot (slower rollback) |
| 25 | rollback | repoint `current` at the previous release (`quo-preview-server.sh rollback <run>`); nothing is deleted; no DB state to roll back |
| 26 | upload | `scp` of artefact + `.sha256` + server script over the SSH alias |
| 27 | remote Composer | not used |
| 28 | sequence | §3 |
| 29 | smoke | §4 |
| 30 | production deny | §5 |

## 3. Proposed deploy sequence — PROPOSED ONLY, NOT EXECUTED

One-time, by the owner (cPanel):

1. Create subdomain `quo-preview.dnchardware.com`; let AutoSSL issue the certificate.
2. Create MySQL database + user for the preview copy (e.g. `dnchardw_quo_preview`,
   user with **SELECT only** on it), and import a copy of the production QUO
   database taken with `mysqldump --no-tablespaces --single-transaction`
   (separately authorised; the copy holds `app_users` so named staff can sign in).
3. On the server (SSH, once):
   ```sh
   mkdir -m 700 -p ~/quo-next-preview/shared ~/quo-next-preview/releases ~/quo-next-preview/runs
   # create ~/quo-next-preview/shared/.env (mode 600) from next/.env.example with the §2.15 values
   # APP_KEY, generated once on the server and never changed:
   /opt/alt/php84/usr/bin/php -r 'echo "base64:".base64_encode(random_bytes(32)), PHP_EOL;'
   ```

Each release, from a clean Office checkout of the approved SHA:

```sh
git fetch origin && git checkout --detach <CANDIDATE_SHA>
sh next/deploy/preview/quo-preview-deploy.sh --sha <CANDIDATE_SHA> --dry-run   # builds the artefact only
sh next/deploy/preview/quo-preview-deploy.sh --sha <CANDIDATE_SHA>
```

First release only, after it is in place: point the subdomain's document root
at `~/quo-next-preview/current/public` (the script's own `/health` check runs
against APP_URL, so on the very first run it reports failure until the docroot
points there — re-run the two curl checks of §4 after the docroot change).

What the server script does (`next/deploy/preview/quo-preview-server.sh deploy`):
lock → CLI PHP ≥ 8.4 → checksum → `.env` present with `APP_DEBUG=false`,
`QUOTATION_PRODUCTION_APPROVED=false` and an APP_URL that is not
`quo.dnchardware.com` → disk → extract to `releases/<sha12>` → `RELEASE.json`
names the SHA → `.htaccess` carries ea-php84 → link `shared/storage` and
`shared/.env` → 755/644 on `public/` → `config:cache`, `route:cache`,
`view:cache` → boot check → atomic `current` switch → `/health` must report
`app: up` **and the candidate SHA**, else it prints the rollback command.

## 4. Post-deploy smoke

1. `curl -s https://quo-preview.dnchardware.com/health` → 200, `app: up`, `sha` = candidate, `database: reachable`, no secret / path.
2. `https://quo.dnchardware.com/login.php` still serves the **legacy** app (untouched).
3. Sign in as a named user (`nicholas`); `admin` refused; wrong password shows a visible error.
4. Desktop: sidebar (no Default Prices / Diameter Settings / Pricing Guide / Version Updates); logo → Home.
5. Phone (393 px): bottom nav Home · Quotes · + · Companies · More; + and More sheets; no horizontal scroll.
6. Home shows 5 recent quotations from the copy; Companies directory (no Short Code), a company profile, Quotations list, a quotation detail (customer prices; no Cost Rate / Add Cost / Markup).
7. Sign out clears the session.

## 5. Production deny safeguards

- `DenyUnapprovedProductionHost`: 503 on `quo.dnchardware.com` unless `QUOTATION_PRODUCTION_APPROVED=true` (Pest-tested).
- Deploy config `DENY_HOSTS` / `DENY_PATHS` (production host, `/home5/dnchardw/quo.dnchardware.com`, `public_html`) checked before any build or SSH; the server script refuses a production APP_URL or a missing guard.
- No migrations in the app; Wave 1 legacy access is read-only at the DB session level; the preview DB user should be SELECT-only.
- The legacy `.cpanel.yml` copy-deploy names only legacy files and never `next/`.
