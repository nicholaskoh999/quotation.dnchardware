# QUOTATION NEXT — W1 OWNER SMOKE LOOP #1

| | |
|---|---|
| Branch | `round/w1-owner-smoke-loop1` |
| Base | W1 preview candidate `93bd869f7c76c33d4d8bac8fd92360d6bbc8b847` |
| Scope | Owner Smoke #1 visual / UX / responsive feedback + the two Preview #1 deploy-tooling defects |
| Not in scope | Builder, Manual Add, Save / write path, accessories UI, pricing UI, Smart Search / Groups, Price Lookup, Quick Add, Print, WhatsApp, Quotation → PO, System Health detail, Wave 2, migrations, production |
| Production | **FORBIDDEN** — no instruction contains `PRODUCTION APPROVED BY OWNER` |

## Owner feedback → change

| # | feedback | change |
|---|---|---|
| §2 | desktop too narrow / centred | one token `--shell-content-max: 83rem` on `<main>` (≈1264 px of content at ≥1600 px wide); sidebar unchanged; tablet / phone unchanged |
| §3A | developer text under Issued By | `Not recorded` + info button (tooltip / accessible name `Legacy quotation — issuer was not stored.`); `QuotationReader::ISSUER_NOTE` shortened, so the page payload no longer carries the old wording |
| §3B | material repeated in title and chip | `itemTitle()` drops the leading material wording **only** when the material is shown as a chip (`4140 QT FULLSIZE L BOLT` → `FULLSIZE L BOLT` + `4140 QT` · `PL`); hardened items keep material, `Hardened`, `G10.9` chips; unrecognised materials keep the full description |
| §3C | dimension text | shared `formatDimensions()` (`components/legacy/format.ts`): `M20 x L 900 x W 70 x TL 150mm` → `M20 × L900 × W70 × TL150`; `TL 100/100mm` → `TL100/100`; a line with anything but plain labelled dimensions (holes, `45deg`, free text) is shown exactly as stored; stored numbers never change |
| §3D | detail density | 4-column header on desktop, item cards one row (identity left, Qty / Unit price / Amount right), tighter spacing, `Quotation Total` |
| locked | Prepared By | shown as stored, else `Not recorded`; never inferred from the revision creator (DOM-tested) |
| §4 | desktop Overview | main column + fixed 21–23 rem side column; Recent Quotations as one table-like list (customer · quotation · date · total); one primary New Quotation (header) — the draft card's button is secondary and Quick Actions are compact rows with muted icons; Frequently Used Products as compact chips |
| §5 | mobile Home polish | recent cards: customer (semibold) over quotation no. (medium) · date; bottom-nav labels single-line / truncating, active tab also bold; smaller empty draft card |
| §6 | Companies directory | wider padded table, fixed Phone / Quotations / Last quoted columns, row hover, search capped at 2xl and 40 px tall; Short Code still hidden; no delete |
| §7A | company Overview empty | facts (Phone, Quotations, Last quoted, Latest quotation, Address) + the latest 5 quotations with "View all" — existing read-only data only |
| §7B | Prepared By column mostly `—` | no Prepared By column in quotation lists; when a row has one it is a quiet "by …" line; `Valid until` (stored) takes the column |
| §7C | tab clarity | active tab: accent underline + accent text + semibold (not colour only), hover underline on the others |
| §7D | Price History | calmer "coming soon" empty state; no feature added |

## Deploy tooling (Preview #1 defects)

`next/deploy/preview/quo-preview-lib.sh` (sourced by both scripts, POSIX sh):

- **9A** `qp_resolve_base`: the Office script reads the remote `$HOME` over SSH
  (read-only) and resolves `PREVIEW_BASE` to an absolute path **before** `scp`;
  the resolved path is re-checked against `DENY_HOSTS` / `DENY_PATHS`.
- **9B** `qp_classify_current` / `qp_park_stub`: a real `current/` directory is
  moved aside to `stubs/current.stub-<run>` only when every entry is a known
  cPanel / AutoSSL stub entry (`public/`, `public/cgi-bin/`,
  `public/.well-known/acme-challenge/*`, cPanel-generated `.htaccess` /
  `php.ini` / `.user.ini`); anything else stops the deploy with nothing moved.
  Nothing is deleted.
- **9C** `qp_link_acme`: each release's `public/.well-known` links to
  `shared/well-known`, so AutoSSL HTTP validation lands in one stable directory
  whatever release is current (ACME files from a parked stub are copied there,
  never overwriting).
- `--dry-run` now also probes (read-only) the remote base and the `current`
  slot and prints the exact upload destination.
- **9D** `tests/Deploy/quo-preview-lib.test.sh` (run by Pest
  `DeployToolingTest`): base resolution, production deny, exact SHA, stub
  detection / parking, shared ACME link, no migrations, no remote
  Node / Composer, no rsync / process substitution. Symlink cases run on Linux
  (CI, WSL); Windows without Developer Mode reports them as skipped.
