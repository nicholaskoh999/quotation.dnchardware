# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**QUICK ADD / UNIT CONVERTER HOTFIX CHAIN — CLOSING**

The fast-deployed hotfix chain that production runs today, being closed. This
document records where the close stands. It does **not** declare the round
closed, and it does not move the accepted application commit.

| | |
|---|---|
| Production candidate | `hotfix/quickadd-integration` `91f0c0b905ef402378aaeef896c80a4e6229c442` |
| Round status | **CLOSING — FULL SUITE RE-RUN IN PROGRESS** |
| Owner production smoke | **PASS** |
| DEPLOY = NO | no NEW deployment belongs to this closing round; production already runs `91f0c0b` |
| STAGE 2 = NOT STARTED | the Stage 2 deferrals in PROJECT-GUARDRAILS stay deferred |
| CANONICAL-STATE | **STALE — RECONCILIATION DEFERRED TO SOURCE SYNC STAGE** |
| Production DB change | **NO** |
| `quotation_revisions` migration | **NOT APPLIED** — not part of this round |

---

## WHY CANONICAL-STATE IS LEFT STALE

`CANONICAL-STATE.md` / `.json` on this branch still describe the Actor Identity
acceptance (`e76bb85d663f96fdce3ed6c0c70b72c49d84000a`) and name it as the
deployed application. That is no longer what production runs. They are
deliberately **not** rewritten in this round:

- production runs this branch, `hotfix/quickadd-integration` at `91f0c0b`;
- `main` carries four accepted rounds that were never deployed — transaction
  foundation, snapshot revision writer, no-op suppression and the history
  reader — and its own CANONICAL-STATE names a different deployed commit;
- those rounds depend on `quotation_revisions`, which is **not applied** in
  production.

Writing a new canonical lineage on either branch now would record one that is
not yet true. The control state is reconciled at the **Source Sync** stage,
after Full Suite, Security and Production Verify have passed, and not before.
Until then, this file is the record of the closing round, and CANONICAL-STATE
is the record of the last accepted round on this branch, nothing more.

---

## SHIPPED SCOPE — ALREADY IN PRODUCTION

- Unit Converter enhancements
- direct fill into the visible dimension fields (TL as n/n for Sag Rod and U-Bolt)
- inline converter panel under the Dimension Entry heading
- Auto / INCH / FT / mm selector
- Quick Add multi-image upload
- Ctrl+V screenshot paste
- max 5 images
- one-request multi-image analysis (`files[]`, one Responses request)
- shared heading inheritance
- Sag Rod TL normalization
- Nut / FW extraction
- phantom heading row fix
- staff multi-image guidance

Earlier in the same chain, also live: WhatsApp copy order and `1)` numbering,
quotation list card polish, the single header language toggle, responsive
mobile / tablet keyboard work, Copy with unit weight, Sag Rod entry order,
U-Bolt max thread helper and pipe-size presets, L-Bolt dimension references.

---

## ACCEPTED BEHAVIOUR — OWNER DECISIONS, 2026-10-19

These are intentional production behaviour. The tests that expected the old
behaviour were stale and have been aligned; the application was not changed.

| Behaviour | Test / checker alignment |
|---|---|
| WhatsApp items are numbered `1)` `2)` `3)`, not `1.` | suites 12 and 38 expect `)` |
| The language toggle's aria-label is `Language / 语言` | one exact phrase in `tests/lib/dom-i18n.js`; one anchored rule in `check-translations.js` |
| The Unit Converter selector reads `Auto` / `INCH` / `FT` / `mm` in BOTH languages | `UNIVERSAL_KEYS` = `ucUnitAuto`, `ucUnitIn`, `ucUnitFt` in `check-translations.js` |
| `DN20` / `DN25` / … on the U-Bolt pipe-size selector are technical trade codes | one code pattern `^dn\d+$` in `tests/lib/dom-i18n.js` |

Checker false positives fixed in the checker only, each verified first:

- attribute values are read as HTML: `&quot;` / `&#39;` / `&amp;` are decoded,
  so `placeholder="1 1/8&quot;"` reads as the inch value it is;
- the markup-in-string scan reads a copy of the source with regex literal bodies
  blanked (same length, same lines). A backtick inside the converter's
  character class had opened a phantom template literal and turned three
  unrelated lines into "markup";
- `#wqaFileInfo` with exactly `No file selected` is exempt by element id AND
  text: the renderer replaces it with `dcT('wqaNoFile')` (未选择文件) when Quick
  Add opens, and the modal is closed until then. Checked in the browser.

Every exception is named, anchored and single-purpose. A mutation run planted a
bare `Language` label, `No file selected` in another element, an unhooked
entity placeholder, markup prose right after the converter regex and a new
identical en / zh pair; the checker reported every one.

---

## KNOWN FAILURES — EXACTLY THESE EIGHT

`38-mobile-ui`, Windows Chromium font metrics. Present at `649f80a`, identical to
the failure list in `main`'s recorded browser evidence, and not an application
fault. Not edited, not hidden:

```
companies 1440px: the modal × is still 24 tall, as accepted
companies 1440px: and still 17 wide — the phone rule has not leaked onto the desk
companies 980px: the modal × is still 24 tall, as accepted
companies 980px: and still 17 wide — the phone rule has not leaked onto the desk
companies 700px: the modal × is still 24 tall, as accepted
companies 700px: and still 17 wide — the phone rule has not leaked onto the desk
companies 600px: the modal × is still 24 tall, as accepted
companies 600px: and still 17 wide — the phone rule has not leaked onto the desk
```

---

## DEFERRED

- **Parser: per-row "thread length 50mm".** A row written as
  `3) 763mm thread length 50mm - 4 pcs` under a shared heading that states
  `THREAD LENGTH 70MM` keeps 70/70; the row's own phrase does not override the
  shared Sag Rod TL. Reproduced on `4878b02` and `0a14902`, before the current
  round, so it is a pre-existing limitation and not a closing regression. The
  working override form `x 50/50` (`3) 763mm x 50/50 - 4 pcs`) does override.
  A parser task for a later round; not changed here.
- **Main / production lineage and CANONICAL-STATE** — Source Sync stage, above.

---

## CLOSING GATES

| Gate | State |
|---|---|
| Full Suite | **RE-RUN IN PROGRESS** — after test / checker alignment |
| Security | not started in this round |
| Production Verify | not started in this round (owner smoke PASS is supporting evidence) |
| Source Sync | not started — `main` is not merged, reset or forced |
| Close | not started |

---

## ALLOWED TO DIFFER FROM THE LAST ACCEPTED COMMIT

`e76bb85` is the last commit CANONICAL-STATE on this branch accepts. These are
the files that differ from it on this branch, by name: the Item Identity work
this branch was cut from (`649f80a`), the hotfix chain's application files, and
the closing test / checker alignment.

```candidate-files
ai_extract.php
api.php
companies.php
index.php
migrations/2026-08-27-backfill-item-uids.php
tests/php/item_identity.test.php
tests/suites/40-item-identity.test.js
tests/suites/12-quick-add-safety.test.js
tests/suites/38-mobile-ui.test.js
tests/lib/dom-i18n.js
tests/tools/check-translations.js
```

`api.php` has not changed since `649f80a`. The hotfix chain changed
`index.php`, `ai_extract.php` and `companies.php`.

---

## MUST NOT CHANGE IN THIS CLOSE

Application behaviour of any kind: `index.php`, `ai_extract.php`, `api.php`,
`companies.php`, `auth.php`, `login.php`, `logout.php`, `pricing_history.php`;
Quick Add parsing; the Unit Converter; WhatsApp formatting; the language toggle;
pricing; weight; save; the database; migrations. `CANONICAL-STATE.md` /
`.json` and `authoritative.js` are not touched until Source Sync.
