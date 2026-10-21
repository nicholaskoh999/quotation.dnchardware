# QUOTATION NEXT — application (`next/`)

Laravel 13 · React 19 · TypeScript (strict) · Inertia 2 · Vite · Tailwind 4 ·
shadcn/ui-style components on Radix · Lucide · Pest · Vitest · Playwright.

One application deployment (Laravel serves the Inertia pages and the JSON it
needs). Owner authority: `../docs/quotation-next/OWNER-APPROVED-REWRITE-HANDOFF.md`.

## Layout

| path | what lives there | rule |
|---|---|---|
| `resources/js/domain/` | framework-free TS domain engine | no React / Inertia / DOM — enforced by `domain-boundary.test.ts` |
| `resources/js/pages/` | Inertia pages | presentation only |
| `resources/js/components/` | React presentation components (`ui/` = shadcn-style primitives) | no business rules |
| `resources/js/layouts/` | page frames | |
| `resources/js/types/` | shared server ↔ client contracts | |
| `resources/views/` | Blade root (+ later the customer A4 print) | |
| `app/Services/` | Laravel services (legacy read layer, auth, handoff) | |
| `../fixtures/golden/` | R0b behavioural oracle | engine tests load it via `domain/golden.ts` |

## Safety defaults

- **No migrations.** The legacy production schema is not normalised before
  cutover (handoff §1); `tests/Feature/FoundationTest.php` fails if a migration
  appears.
- Sessions / cache use the **file** driver — nothing is written to the legacy
  database.
- `DenyUnapprovedProductionHost` answers **503** on `quo.dnchardware.com`
  unless `QUOTATION_PRODUCTION_APPROVED=true` (handoff §2).
- `config('quotation.legacy_writes_enabled')` is hard `false` in Wave 1.

## Commands

```
composer install
npm ci
cp .env.example .env && php artisan key:generate
npm run typecheck        # tsc --noEmit
npm test                 # vitest (domain engine + golden fixtures)
npm run release:stamp    # writes RELEASE.json (version, SHA, build time)
npm run build:vite       # production assets → public/build (needs Node — build Office-side / CI)
php artisan test         # Pest
npm run e2e              # Playwright, against php artisan serve + built assets
```

`GET /health` → `{status, app, release, sha, builtAt, database, time}` — never
a secret, host, path or driver message.
