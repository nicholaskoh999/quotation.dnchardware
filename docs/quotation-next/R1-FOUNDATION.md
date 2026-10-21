# QUOTATION NEXT — R1 FOUNDATION

| | |
|---|---|
| Round | **R1** — application foundation only |
| Branch | `round/r1-foundation` |
| Base | `round/r0b-characterisation` `ae443f8cdd4fd9221e8dc66cbbc38ff699aaa853` |
| Location | `next/` (the legacy PHP app at the repository root is untouched) |
| Deployed | **NO** |

## Stack (handoff §1)

| | version |
|---|---|
| Laravel | 13.38 (PHP ^8.3; production host runs PHP 8.4.26) |
| Inertia | inertia-laravel 2.x · @inertiajs/react 2.2.9 |
| React / TypeScript | 19.1.1 / 5.9.2 (`strict`, `noUncheckedIndexedAccess`) |
| Vite / Tailwind | 7.1.7 / 4.1.13 (`@tailwindcss/vite`) |
| Components | shadcn/ui-style primitives on Radix (`components.json`, `components/ui/`) · lucide-react 0.544 · sonner 2.0.7 |
| Tests | Pest 4 · Vitest 3.2.4 · Playwright 1.56.1 (desktop 1440 + phone 393 projects) |

All npm versions are pinned exactly.

## What R1 provides

- `/health` (public, `Cache-Control: no-store`): `status`, `app`, `release`,
  `sha`, `builtAt`, `database` = `reachable` / `unreachable` /
  `not_configured`, `time`. Never a driver message, host, user, schema, path or
  stack trace (Pest asserts it against a deliberately failing connection).
- Release identity: `scripts/release-stamp.mjs` writes `RELEASE.json`
  (version, full SHA, dirty flag, build time); `App\Support\Release` reads it
  (env `APP_RELEASE` / `APP_GIT_SHA` / `APP_BUILT_AT` may override, through
  config so `config:cache` works); only a well-formed SHA is ever reported.
- `Asia/Kuala_Lumpur` for PHP and the `legacy` MySQL session (`+08:00`).
- `legacy` DB connection (env `LEGACY_DB_*`) — read-only by policy in Wave 1;
  the default connection is kept off it.
- **No migrations** (a Pest test fails if one appears); sessions / cache on
  the **file** driver; `legacy_writes_enabled` hard `false`; framework storage
  route (incl. a public `PUT` upload) disabled.
- **Production guard**: `DenyUnapprovedProductionHost` answers 503 for
  `quo.dnchardware.com` unless `QUOTATION_PRODUCTION_APPROVED=true`.
- Error handling: outside local debug, HTTP errors render a calm Inertia
  `Error` page (status + short message + log reference), never exception text.
- Toast foundation (`sonner`, desktop top-right, phone above the bottom nav) and
  `lib/feedback.ts` (`notify.success / error / undoable / promise`).
- Architecture areas: `resources/js/domain/` (framework-free engine, boundary
  enforced by a Vitest), `pages/`, `components/`, `layouts/`, `types/`,
  `resources/views/` (Blade root; A4 print later), `app/Services` (later).
- `domain/golden.ts` loads the R0b oracle; a Vitest proves all 14 families load
  and are classified.
- `scripts/build-release.sh` — POSIX `sh`, no process substitution, no rsync:
  builds an exact-commit artefact **on the build machine** (production
  `vendor/`, built `public/build`, `RELEASE.json`), so the shared host needs PHP
  only. It never contacts a server.
- CI: `.github/workflows/next-ci.yml` (composer, npm ci, typecheck, Vitest,
  stamped build, Pest, Playwright).

## Measured (this round, local)

| check | result |
|---|---|
| `npm run typecheck` | 0 errors |
| Vitest | 3 files, 18 tests passed |
| `vite build` | ok (manifest + hashed assets) |
| Pest | 12 tests, 55 assertions passed |
| Playwright | 4 passed (health + home/logo, desktop and phone) |

## Not in R1

App shell, auth, domain engine, legacy read layer (Wave 1 A / C / B / D);
builder, write path, output, Quick Add (Waves 2–3). No preview deployment.
