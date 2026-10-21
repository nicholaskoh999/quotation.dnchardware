# QUOTATION NEXT — WAVE 1 ACCEPTANCE + W1 INTEGRATION

| | |
|---|---|
| Branch | `round/w1-integration` |
| Base | R1 `98d949a9872d342423f7d9af732f0ef830c3d07e` |
| Merged | B → D → C → A (`--no-ff`), then integration glue |
| Deployed | **NO** (preview and production) |
| State | **W1 PREVIEW CANDIDATE / DEPLOYMENT READY / OWNER PRE-DEPLOY REVIEW** |

## 1. Phase SHAs

| phase | branch | SHA |
|---|---|---|
| R0 owner handoff | `round/r0-owner-handoff` | `bfbebcebf502da84e310b7218544e637a5659d33` |
| R0b | `round/r0b-characterisation` | `ae443f8cdd4fd9221e8dc66cbbc38ff699aaa853` |
| R1 | `round/r1-foundation` | `98d949a9872d342423f7d9af732f0ef830c3d07e` |
| Session A | `session/a-app-shell` | `3b49c441224dc44ff1b3c62f0e2cd38400af732c` |
| Session B | `session/b-domain-engine` | `0fb72c10b3c42e34999673b18e14a35fd371c91b` |
| Session C | `session/c-auth-workspace` | `87619988960e213264e5951e192b449a89cc9770` |
| Session D | `session/d-data-read` | `c856dff00ee23d6f4d50cfd2cea3d8175a60e22a` |

## 2. Wave 1 branch acceptance (before integration)

Each branch was verified independently: local == origin, R1 is an ancestor,
zero files changed outside `next/`, zero migrations, clean worktree, no
business formula (`0.0000061654`, `round05`, `roundCustom10`, diameter tables,
`1.57`) outside `resources/js/domain` (`git grep` on A, C, D: none). Re-run
locally by the integrator:

| branch | typecheck | Vitest | Pest | Playwright (session's own run) |
|---|---|---|---|---|
| A app shell | 0 errors | 35 / 35 | 31 / 31 | 17 passed, 11 project-skips |
| B domain engine | 0 errors | 673 / 673 | 12 / 12 | 6 passed |
| C auth / workspace | 0 errors | 18 / 18 | 171 / 171 | 18 passed |
| D legacy read | 0 errors | 26 / 26 | 116 / 116 | 12 passed + 10 seeded-leg passed |

**A** — shell, nav from one config (retired items absent), logo → Home,
phone bottom nav + / More sheets, Mobile Home v1, tablet nav sheet,
placeholder pages, UI primitives, toasts above the bottom nav. **B** —
framework-free engine; 537 golden cases asserted (A 472 · B 19 · C 46);
WhatsApp preview ≡ sent. **C** — `app_users` sign-in (read-only provider,
legacy username normalisation, `password_verify`, disabled + `admin` refused,
dummy-hash timing reduction), CSRF, session regen, `CurrentActor`,
`PreparedBy`, `EditorStamp`; Workspace handoff contract v2 ported, **OFF**,
contract files byte-identical. **D** — `LegacyReader` (single SELECT only;
DB session `READ ONLY`), companies (Short Code hidden, search alias),
quotations (raw JSON preserved, three pricing vintages, malformed handled),
revisions metadata, price history port matching `history.json`, read pages
with honest "not connected" states.

## 3. Integration — what was resolved / glued (no Wave 2 scope)

- Conflicts: `routes/web.php` (one `auth` group: Home, D's read routes, A's
  placeholder routes; `/health`, `/login`, `/logout`, handoff public),
  `tests/Pest.php`, `input` / `label` (kept C's focus-ring versions), A deleted
  `foundation-layout` → C's user menu and D's pages moved onto A's
  `AppLayout`; `foundation.spec.ts`.
- Contracts: `ShellUser` / `ShellSharedProps` now alias C's `AuthUser` /
  `SharedProps` (one shared-prop shape).
- Home: new `HomeController` feeds **Recent Quotations** (5 newest) from D's
  `QuotationReader`; when the data source is absent the prop is omitted and the
  page shows its honest "not connected" state.
- Desktop / tablet **Sign out** button in the shell (A had deferred it to C;
  C's button lived in the layout A replaced).
- Tests: A's and D's page tests sign in (`actingAs(namedUser())`); e2e uses ONE
  throwaway local-MySQL schema (`dnc_next_e2e`: D's fixture + C's test users),
  shell / read specs sign in; D's "no database" e2e leg is skipped because
  Pest covers those states.
- Deployability: `public/.htaccess` pins **ea-php84** (ServerFreak/LiteSpeed
  falls back to PHP 8.0 without it — Pest-guarded); per-page code splitting
  (largest chunk 376 kB, no Vite size warning); proposed preview deploy
  scripts `next/deploy/preview/` (PROPOSED ONLY — NOT EXECUTED; Pest-guarded:
  POSIX sh, no process substitution, production host / docroot denied);
  next-ci gains a MySQL 8.0 service for D's MySQL test leg.

## 4. Measured on the integrated candidate (local)

| check | result |
|---|---|
| `npm run typecheck` | 0 errors |
| Vitest | 23 files, **698 / 698** |
| `vite build` | ok, no warnings |
| Pest | **298 / 298** (MySQL 8.0.46 legs included) |
| Playwright (desktop 1440 + phone 393 + tablet 768) | **39 passed, 0 failed**, 19 skipped (11 single-project specs, 8 "no database" legs covered by Pest) |
| legacy golden oracle `--check` | 14 / 14, no drift |
| legacy `check-control.js` | 0 disagreements |

## 5. Open gates (carried; none blocks Preview #1)

| gate | from | safe default in force |
|---|---|---|
| OG-1 M12 UNDERSIZE 10.6 vs 10.7 (scope) | R0b | 10.6 |
| DG-1 §15 diameter candidates need the read-only export | R0b | legacy table |
| OG-2 Eye Bolt with S: J Bolt formula with H := L, suggestion only | R0b / B | editable suggestion |
| OG-B1 rounding rule for J Hook / Eye Bolt | B | money2 |
| OG-B2 hardened 4140 QT (`4140_HARDEN_G10_9`) M12 FULLSIZE: legacy Ø12 vs the QT Ø13 rule | B | Ø12 (legacy) |
| C-1 a Workspace user literally named `admin` is not refused (as legacy branch) | C | not refused |
| C-2 disabling an `app_users` account takes effect at next sign-in | C | legacy behaviour |
| C-3 no login rate limit beyond a 400 ms failure floor (legacy has none) | C | recommend before production |
| C-5 idle session timeout 480 min vs legacy ~7 days | C | 480 min idle, 7-day cap |
| D-1 issuer is not persisted server-side in legacy | D | "Not recorded" |
| D-2 legacy readers disagree on the bolt split of old accessory items (internal only) | D | `pricing_history.php` reading |
| D-3 two WhatsApp fallback texts (api.php has a Valid Until line) | D | `index.php` text |

## 6. Not in Wave 1 (deliberately)

Builder, write path, output (print / WhatsApp send), Quick Add, Smart Search /
Price Lookup UX, Quotation → PO handoff, admin role model, preview deployment.
