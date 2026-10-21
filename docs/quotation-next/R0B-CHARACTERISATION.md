# QUOTATION NEXT — R0b CHARACTERISATION / GOLDEN FIXTURES / CI BASELINE

| | |
|---|---|
| Round | **R0b** — characterisation only |
| Branch | `round/r0b-characterisation` |
| Base | `round/r0-owner-handoff` `bfbebcebf502da84e310b7218544e637a5659d33` (R0 FINAL) |
| Legacy oracle | the shipped PHP application, byte-identical to `main` `664c0d8` |
| Authority | `OWNER-APPROVED-REWRITE-HANDOFF.md` (§ references below are to it) |
| Application change | **NONE** — no legacy application byte, schema, config or deployment touched |

R0b builds the oracle the rewrite is measured against. It does not redesign,
migrate, normalise or deploy anything.

---

## 1. What was built

| artefact | purpose |
|---|---|
| `tests/characterisation/cases.js` | the inputs of the oracle and the A / B / C classification of each case |
| `tests/characterisation/run.js` | drives the **shipped** `index.php` in Chromium (via `tests/lib/harness.js`) and writes `fixtures/golden/*.json`; `--check` fails on any drift |
| `tests/characterisation/history.php` | runs the shipped, DB-free `pricing_history.php` over fixed records |
| `fixtures/golden/*.json` | **560 cases in 14 families** — reusable by the framework-free TS engine (Wave 1 B) |
| `.github/workflows/legacy-ci.yml` | CI baseline: static sanity · PHP suites on MySQL 8.0 · golden `--check` · browser matrix |
| `tests/tools/ci-browser-gate.js` | reports the documented pre-existing browser failures as KNOWN, fails on anything new |

No value in a golden file was typed by hand. Where the expected value differs
from the legacy value, the case is classified **B** (owner-approved
replacement) or **C** (owner / data gate) and names the handoff section.

| family | cases | family | cases |
|---|---:|---|---:|
| rounding | 71 | defaultPrice | 42 |
| size | 26 | tlSurcharge | 12 |
| diameter | 325 | sagrodTL | 5 |
| weight | 17 | material | 11 |
| pricing | 18 | output | 1 (6-item quotation) |
| was | 2 | quickAdd | 18 |
| accessories | 8 | history | 4 topics / 13 records |

---

## 2. Legacy behaviour pinned (class A — preserve)

**Weight.** `d² × developed length × 0.0000061654` (= π/4 × 7.85e-6) for every
rod; plate `L × W × T × 0.00000785`; triangle plate `L × H × T × 0.00000785`
(no ½ — characterised, not judged). Developed length, always `ceil()`ed:

| product | developed length |
|---|---|
| Sag Rod / Stud / Anchor Bolt | L |
| U-Bolt | `ceil((d+ID)×1.57 + 2·IH − ID)` |
| SQ U-Bolt | `ceil(((W/2+OH) − 1.5d) × 2)` |
| L Bolt | `ceil(L + W − 1.5d)` |
| **L Bolt 45°** | **no auto formula** — manual developed length; blank ⇒ 0 kg |
| J Bolt | `ceil((H−S) + (d+ID)×1.57 + 2(S−d) − ID)` |

**Rounding — product mapping.** `round05`: Sag Rod, Stud, Anchor Bolt, Plate,
WAS. `roundCustom10`: U, SQ-U, L, L45, J Bolt. `roundMoney2`: Others and every
stored money figure. `round05` is *not* "round to 5 sen": it rounds to 2 dp,
then moves a last digit of 9 up and a last digit of 1 down (`1.09→1.1`,
`1.11→1.1`, `1.15→1.15`). `roundCustom10` rounds sen 0–3 down and 4–9 up to the
next 10 sen. Boundaries (incl. float edges like `2.675`, `1.0349`, `3.0049`) are
in `rounding.json`.

**Pricing.** `base = weight × Cost Rate + Additional Cost`; `raw = base ×
(1 + Markup/100)`; rounded per product; **Final Unit Price = rounded bolt +
Σ accessories** (accessory-inclusive, PROJECT-GUARDRAILS). No Round stores
`money2(raw)`. **Manual Price is the customer's price** — accessories come out
of it to leave the bolt (RM10 typed with RM2 of nuts ⇒ bolt RM8, final RM10).
MS UNDERSIZE M12 PL TL 100/100 has a price list (L1000 RM4.00, L1200 RM4.20)
that also survives No Round.

**WAS exception.** `(base + add + ACCESSORIES) × (1+markup)` → `round05` — the
only product whose accessories are marked up.

**Default price.** Production `default_prices` has 0 rows; every default is a
code built-in. MS Sag Rod (FULLSIZE and UNDERSIZE): PL 2.80 · ZP 4.20 · HDG 6.00
(+1.60 add cost). 4140 QT Sag Rod M12/M16 from `RATES_4140` (+ZP 1.50, +HDG 3.20
and +1.00 brushing). Thread-length add cost: max end 30–120 ⇒ 0.60, >120–200 ⇒
1.00, else 0 (not applied to HDG or non-MS materials).

**Size.** `12`/`m12`/`M 12`/`12mm` ⇒ `M12`; `1/2`, `1/2"`, `1 1/4`, `5/8 in`,
`3/4”` ⇒ canonical fraction without mark (display adds `"`); a whole inch keeps
its mark (`1 INCH` ⇒ `1"`); bare `6` ⇒ `M6` (known). Unknown sizes are read but
never weighed.

**Diameter.** Built-in tables; Stud always uses the undersize bar; UNDERSIZE
inch never falls back to the fullsize inch table; 4140 QT / 4340 QT M12
FULLSIZE ⇒ Ø13; label shows `Ø<bar>-<size>` only when the bar differs from the
nominal by > 0.2 mm (never for UNDERSIZE).

**Material.** `8.8`/`G8.8`/`HT8.8` ⇒ 4140 QT and `10.9` ⇒ 4340 QT in Quick Add
(§34 C-1 — kept as the oracle). SS304/SS316 ⇒ finish N/A. Legacy `4140` reads
as 4140 QT; `4140_PLAIN` is plain 4140; Y BAR is a material.

**History.** Identity = product · material · size type · exact clean size
(M12 never matches M10/M14); a different finish is kept but flagged; qty is not
identity. Ranking: same customer → exact finish → nearest dimensions → newest
date → highest id. Bolt / line split per pricing vintage (inclusive,
bolt-separate, legacy-ambiguous). Imperial sizes survive the JSON `\/` LIKE trap.

**Ref / write contract.** `Q-YYYY-NNNN`, `Asia/Kuala_Lumpur`, `GET_LOCK` +
`MAX+1`, READ COMMITTED on create, exactly one 1062 retry, server-owned
`item_uid`, one revision per mutation inside the transaction, no-op
suppression (a reorder is a change), saved-quotation lock. These are already
pinned against a real MySQL by `tests/php/{save_retry, item_identity,
transaction_foundation, revision_writer, noop_suppression, history_read}` —
R0b re-ran them (§5) instead of duplicating them. No production write.

**Output.** Customer output is English, carries one inclusive price per item,
accessories as wording only (`cw 2nut & 1fw`), and **no Cost Rate /
Additional Cost / Markup** (`output.json` `checks.noCostAddMarkupLeak = true`).
Print numbers in insertion order; WhatsApp groups by material + finish with
each row carrying its own item number (§34 C-4, kept). Issuer is a name-only
select (three hard-coded names, not persisted server-side), with no per-issuer
letterhead — §26 redesigns this.

**Quick Add.** 18 patterns pinned, incl. shared-heading TL with a per-row
override, inch size with thread series, c/w accessories, stainless, grade ⇒
material. Known failures are flagged `knownFailure` (U-bolt with an inch size,
pipe-size wording, a bare `6`/`72` read as length).

---

## 3. Owner-approved deliberate changes pinned (class B — replace, NOT a regression)

| # | behaviour | legacy (evidence) | new engine | ref |
|---|---|---|---|---|
| B-1 | explicit accessory qty **0** | `parseFloat("0")||2` ⇒ **2** nuts / **1** FW | **0 stays 0**; blank ⇒ default | §18, C-5 |
| B-2 | MS FULLSIZE Sag Rod default Cost Rate | PL 2.80 · ZP 4.20 · HDG 6.00 | **PL 3.50 · ZP 5.00 · HDG 6.50** (one number; 6.50–7.00 may be shown as text only) | §16 |
| B-3 | 4140 **plain** M12 FULLSIZE diameter | 12 (special Ø13 gated on QT/4340) | **Ø13** | §15 LOCKED |
| B-4 | bare `72` as a size | `M72`, then "unknown" | **Needs Review**, not normalised | §12 |
| B-5 | Sag Rod single TL `100` in manual entry | label `TL 100mm` | **`100/100`** (Quick Add already does this) | §21 |
| B-6 | hardened material | combined enum `4140_HARDEN_G10_9` / `S45C_HARDEN_G8_8` | **Material · Treatment · Property Class**; legacy values stay readable | §13, C-7 |
| B-7 | Property Class **12.9** | no legacy value (never observed) | **allowed** | §13, §30 |
| B-8 | hardened customer wording | `S45C + HARDEN = G8.8 STUD (PL)` | `S45C STUD · HARDENED TO G8.8 (PL)` | §14 |
| B-9 | WhatsApp preview vs sent | preview merges identical rows (`1, 3)`) and regroups; sent text does not (`checks.previewEqualsSent = false`) | **preview ≡ sent** | §26, C-4 |
| B-10 | J Hook / Eye Bolt | not products; parser returns no rows | official products (fields in §19 / §20) | §19, §20 |

---

## 4. Diameter findings and the M12 UNDERSIZE conclusion

**The historical export is not in the repository.** The handoff's §30
inventory (1,314 quotations, 3,691 lines) came from a read-only production
export that was never committed, so the "generated canonical diameter master"
can only be generated as far as repository evidence goes.

| candidate (§15) | legacy | status |
|---|---|---|
| 4140 plain M12 FULLSIZE ⇒ Ø13 | 12 | **B-3, applied** (LOCKED) |
| 4140 QT / 4340 QT M12 FULLSIZE ⇒ Ø13 | 13 | A (already legacy) |
| FULLSIZE M33 ⇒ Ø32 | 33 | **C / DG-1** — scope unproven |
| FULLSIZE M24 ⇒ Ø25 | 24 | **C / DG-1** |
| 1" ⇒ Ø25 | 25.4 | **C / DG-1** |
| UNDERSIZE M10 ⇒ Ø8.9 / 9.0 | 8.8 | **C / DG-1** — two values in the evidence |
| scoped 4140 QT L Bolt M27 ⇒ Ø28 | 27 | **C / DG-1** |
| UNDERSIZE M12 ⇒ Ø10.7 | 10.6 | **C / OG-1** — see below |

**M12 UNDERSIZE 10.6 vs 10.7 — conclusion: OPEN OWNER GATE OG-1; 10.6 kept.**

Repository evidence found:

1. The built-in table has always weighed UNDERSIZE M12 at **10.6** (and
   PROJECT-GUARDRAILS pins it).
2. Before the repository's first commit, the `RATES_4140` table carried a
   `dia` of **10.7** for **`4140 UNDERSIZE SAG ROD` M12**, which Diameter
   Settings displayed while the calculator weighed 10.6
   (`quotation-dnc-final/final-report-rounds-1-6.md` §2; the comment above
   `RATES_4140` in `index.php`: "if the business wants an undersize 4140 M12
   weighed on 10.7mm, that is a rule they add there").
3. Production `diameter_settings` holds one row, redundant with the built-in
   behaviour — i.e. **no 10.7 rule was ever configured**.

So the only *scoped* evidence ties 10.7 to **4140 QT · UNDERSIZE · Sag Rod ·
M12**; the handoff's repeated historical 10.7 cannot be scoped further (MS? all
products? a period? a customer?) without the export. A global change moves the
weight — and therefore the price — of the most common item line in the
business (MS UNDERSIZE Sag Rod M12 — 1,166 lines in the ZP finish alone, §23) by ~1.9 %, which is exactly
§34 C-2's "Yes, if global" case. The engine keeps **10.6**, tests pin it, and
the gate is recorded rather than guessed.

---

## 5. CI / baseline results (measured in this round)

| suite | result | note |
|---|---|---|
| golden oracle `run.js --check` | **14 / 14 files, no drift** | deterministic across runs |
| PHP (12 files, MySQL **8.0.46** — the production engine, PHP 8.3.6) | **1,825 assertions; 1 failed** | the one is `auth_identity` F1 decoy bcrypt cost (10 vs 12) — the runtime-relative artefact already recorded in CANONICAL-STATE for PHP 8.3; CI runs PHP 8.4 |
| `mysqli_compat` | 97 / 0 **with** CLI `error_log` configured | without it the CLI echoes `dc_db_fail`'s log line into the captured output (12 env failures) — environment, not code; CI sets `error_log` |
| browser matrix (43 suites, Linux Chromium 1194) | **4,202 assertions; 4 failed — all KNOWN, 0 new** | the 4 are `38-mobile-ui` "still 17 wide" at 1440/980/700/600 (measured 16.8): the width half of CANONICAL-STATE's documented eight font-metric failures; the height half passes on Linux fonts. The 35-edit-mode flake did not fire. Classified by `ci-browser-gate.js` |

Pre-existing failures are reported as such and are not attributed to R0b — R0b
changed no file the suites execute.

Control validators: `check-control.js` passes apart from "working tree clean"
while uncommitted; `check-reports.js` reports 2 disagreements (`COMMIT-INFO.txt`
header stale) that reproduce identically on the R0 handoff commit `bfbebce` —
pre-existing packaging bookkeeping, untouched here because `FULL-AUDIT/` is
historical evidence.

---

## 6. Gates left open (do not block R1 / Wave 1)

| gate | question | safe default in force |
|---|---|---|
| **OG-1** | M12 UNDERSIZE: is 10.7 (a) 4140 QT UNDERSIZE Sag Rod only, (b) every UNDERSIZE M12, or (c) not canonical? | 10.6 everywhere |
| **DG-1** | provide the read-only historical export (or confirm each scope) so the §15 candidates (M33→32, M24→25, 1"→25, UNDERSIZE M10→8.9/9.0, 4140 QT L Bolt M27→28) can be scoped | legacy table |
| OG-2 (minor) | Eye Bolt with S: J Bolt geometry needs H; the Eye Bolt's only length is **L**. The engine maps L→H and offers the result as an **editable suggested** developed length | suggestion only, never locked |
| note | MS FULLSIZE HDG Sag Rod Additional Cost: legacy 1.60 is kept — §16 restates only the Cost Rate | 1.60 |
| note | §34 C-1 bare `10.9` ⇒ 4340 QT is kept as the oracle | legacy mapping |

---

## 7. Verdict

```
R0b CHARACTERISATION:   COMPLETE — oracle established, CI baseline established
APPLICATION CHANGE:     NONE
OWNER GATES OPEN:       OG-1, DG-1 (non-blocking; safe legacy defaults pinned)
NEXT:                   R1 FOUNDATION
```
