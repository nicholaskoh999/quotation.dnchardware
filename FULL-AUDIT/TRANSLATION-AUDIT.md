# TRANSLATION AUDIT — English / 中文

Baseline `f96714e33795e80b581b1d03deb9d04db1d94b8d` → final `3696f59d684392914f58e6ac2ad44422c1f3f3df`.
Tooling: `tests/tools/check-translations.js`
(static, reads the shipped source) and `tests/suites/30-language.test.js`
(browser, switches the language the way the button does and reads the SCREEN).

> **On SHAs.** `40e56d6951d7832a19e5b7fd121877faecf7f54a` is the last commit that changed the
> application or its tests — it is what the numbers in this package were
> measured against. The commits after it write this package, and a report
> cannot name the commit it is inside without changing it. The exact HEAD
> the archive was built from is recorded in `ZIP-MANIFEST.txt`, which is
> generated at build time and is not committed.

---

## Coverage

| File | Keys | Translated | Missing zh | Undefined | Identical (non-code) | Bypassing dcT |
|---|---:|---:|---:|---:|---:|---:|
| index.php | 629 | 100% | 0 | 0 | 0 | 0 |
| companies.php | 116 | 100% | 0 | 0 | 0 | 0 |
| login.php | 11 | 100% | 0 | 0 | 0 | 0 |
| **Total** | **756** | **100%** | **0** | **0** | **0** | **0** |

Regenerated from the final SHA. The overnight figure of 658 is superseded and
should not be quoted.

At baseline the dictionary already read 100% translated. That number was not
false, but it was not the whole picture: **a string with no key is not a missing
translation, it is not a translation at all**, and 129 of those were on screen.

| | baseline | overnight | final |
|---|---:|---:|---:|
| dictionary keys | 512 | 658 | **756** |
| dictionary coverage | 100% | 100% | **100%** |
| strings bypassing `dcT`, as the checker then saw it | 129 | 0 | **0** |
| strings bypassing `dcT`, as the CURRENT checker sees it | — | **~210** | **0** |

That last row is the important one. **The overnight checker was false-green.**
It reported zero while the Quick Add column headers, its row buttons, its panel
labels, the accessory panels, the pricing-history record card, Quick Open and
almost the whole Companies page were still English in 中文. See §"What the
checker could not see" below.

---

## What was actually wrong

### 1 · Validation messages — the largest group

Almost every refusal path in the application wrote its message straight into
`showToast`. A person working in 中文 pressed Add and was told, in English:

> Enter Diameter · Cost Rate is blank. Enter price before adding. · Total Length
> is 0 — check H, ID, S, Diameter · Click Edit Saved Quotation first · Unable to
> get quotation number. Please check API/database.

122 replacements in `index.php`, 5 in `companies.php`. Suite 30 §2 now presses
the real buttons and reads the real toast in 中文.

### 2 · The Pricing Guide — a whole page

Written in English in the markup, so it was the one screen that did not change
when the language did. Every explanation of Cost Rate, Additional Cost, Auto
Round, No Round and Manual Price. The worked examples keep their RM figures.

### 3 · Plate and Welding Anchor Set — the pre-switch style

Both forms were built before the language switch existed and still carried the
older side-by-side pattern:

```html
<label>Material <span class="gl-zh field-zh">材料</span></label>
```

Both languages at once, in either mode — which is precisely the mixed labelling
the switch was introduced to replace, and which the v2.24.0 release notes say
was replaced. 32 labels, plus:

* a **guide box in Chinese only**, so an English reader was handed a paragraph
  they could not read at all;
* a **cost note in Chinese with "Additional Cost" embedded** in the middle of
  the sentence, which reads as neither language cleanly.

### 4 · Empty states and error states

`No rules saved yet…`, `No custom diameter rules yet…`, `Lookup failed. Please
try again. / 查询失败，请重试。` (the old both-at-once style), `Could not load
pricing history…`, `No pricing history for this exact specification`, import
warning and error counts, and the Companies page's helper lines.

These are most of what a new install shows in its first week.

### 5 · Short labels

A scan looking for sentences walks straight past "Add Cost", "Weight Mode",
"Add Custom", "Load more", "Show Debug", "Reference Total", "Last Updated" —
two words each, every one a control.

### 6 · The dynamic renderers *(morning repair)*

This is the group the overnight checker could not see at all, and it is the
largest one left:

* **Quick Add's review screen** — the column headers (`#`, Size, TL, Qty,
  Weight, Price, Actions), the row buttons (Edit, History, Close), the
  common-fields labels (Product, Material, Finish, Size Type), the expanded
  row's own Size and Qty, the accessory panels, the weight and accessory bars,
  the history panel and every tag on a pricing-history record card.
* **The Companies page** — its loading line, all four status badges (Active,
  No Quotes, Recent, Has Remarks), the buttons under every quotation (Load,
  Duplicate, Delete, View), the card meta (Saved quotes / Latest / Contact /
  Last Updated / Latest Product / Reference Total), the detail panel, the
  end-of-list line, one more side-by-side bilingual heading, and four inline
  English strings including two `confirm()` dialogs.
* **The quotation's own item cards** — which read **"Edit / 编辑"** and
  **"Delete / 删除"**, both languages at once, because nothing re-rendered them
  on a switch.
* Quick Open, the import result lines, the Others form and the Pricing Guide's
  worked examples.

---

## What the checker could not see

The overnight checker reported **0 hard-coded** while everything in §6 was on
screen. Three blind spots, all now closed:

1. **Interpolations.** It refused any run containing `$` or `{`, so
   `<label>Product${req?' *':''}</label>` and `>${open?'Close':'Edit'}<` matched
   nothing at all. Interpolations are now stripped and the English AROUND them
   is read.
2. **One-word labels.** The threshold was two words for label-ish tags and four
   for everything else, so "Size", "Qty", "Price", "Edit" and "History" all
   walked through. It is one word everywhere now — workable only because
   `isCode()` already knows the trade's vocabulary.
3. **Markup built inside a string.** `Saved quotes: <b>${n}</b> · Latest: …` is
   assigned to a variable and injected later, so the English sits before and
   after a tag rather than between two of them. A fifth pass reads those.

It also now **verifies each finding against the source** before reporting it.
That is not a nicety: it is what stopped me dismissing a genuine leak — a
side-by-side "Saved Quotations 报价记录" heading — as a false positive.

And one lesson about hooks: `data-i18n` only works for markup that exists when
the switch happens. Markup rendered afterwards must call `dcT()` at render
time, and its renderer must be registered with `dcOnRelabel`. Both mistakes
were present and both are fixed.

---

## What is deliberately NOT translated

This list is held in `check-translations.js` itself, so it stays visible as a
decision rather than becoming an oversight. To change any of it, delete the
matching rule and the checker will start reporting it again.

| | Why |
|---|---|
| M12, 1/2", SS304, SS316, 4140 QT, 4340 QT, **4140 QT + HARDEN = G10.9**, S45C, MS, Y BAR, PL, ZP, HDG, UNC, BSW, TL, RM, kg, mm | The brief names these outright as values never to be machine-translated. |
| Sag Rod, Stud, Anchor Bolt, U-Bolt, SQ U-Bolt, L Bolt, L Bolt 45DEG, J Bolt, Plate, Welding Anchor Set, Others / Special Bolt, Base Plate, Triangle Plate, Nut, FW | Product and part names. The trade uses the same words in either language. |
| Fullsize / Undersize | Size-type vocabulary, same reasoning. |
| DER-CHENG FASTENER SDN. BHD., DNC HARDWARE SDN. BHD., EVERTOP HARDWARE TRADING, the postal address | Registered entities and an address. A translated address is one the post office cannot read. |
| The Version Updates page | A record of what shipped and when, written at the time. Rewriting it in another language rewrites history. The brief also says not to manufacture version history. |
| The printed quotation and the WhatsApp text | The customer's document, not the operator's screen. **Open question — see BUSINESS-DECISIONS-NEEDED.md §1.** |
| The example WhatsApp message in the paste box | Trade shorthand showing the FORMAT a customer writes in. Translating it would show a format nobody sends. |
| The page `<title>` | Carries the brand. |

---

## What the audit does NOT claim

It does not judge the Chinese **wording**. Whether 螺纹参考 is the right phrase
for Thread Reference, or 每公斤成本 for Cost Rate, is a native speaker's call and
should be reviewed by one. What is asserted is narrower and checkable:

* every string a person can see has somewhere to be translated;
* that somewhere is filled in, in both languages;
* the screen actually changes when the button is pressed — proved by reading the
  rendered DOM, not the dictionary;
* the trade's vocabulary survives the switch unchanged.

New Chinese strings written during this audit (the toasts, the Pricing Guide,
the two product forms, the empty states) are **first-pass translations and should
be read by a native speaker before release.** They are functionally correct and
consistent with the wording the application already used; that is a different
claim from being well written.

---

## Regression

* `tests/tools/check-translations.js` — 12 assertions, run as part of the test
  matrix. Reports all four failure modes and the deliberate exclusions.
* `tests/suites/30-language.test.js` — 165 assertions. Switches the language,
  reads the rendered screen, presses real buttons and reads real toasts,
  confirms trade vocabulary survives, and asserts no key name is ever shown raw.
  Since the morning repair it also holds the item count across 0, 1, 2 and 4
  rows in both directions and with the same language button pressed twice; the
  saved quotation's Edit/Delete controls in one language at a time; and the
  whole Companies page in 中文.

## Evidence

`screenshots/25-main-page-english.png` · `26-main-page-chinese.png` ·
`27-quickadd-chinese.png` · `28-companies-chinese.png` ·
`29-calculator-chinese.png` · `30-validation-message-chinese.png`

Morning repair: `after-fix/35-quickadd-chinese-item-count.png` (2 项 on the
header and the footer, 添加 2 项到报价单 on the button, every dynamic header
translated) · `after-fix/36-saved-quote-english.png` and
`after-fix/37-saved-quote-chinese.png` (Edit/Delete, then 编辑/删除, never both)
· `after-fix/38-companies-chinese-dynamic.png`.

Before: `before-fix/30-validation-message-chinese.png` (the same refusal, in
English, with the interface in 中文) and
`before-fix/B-welding-anchor-set-english.png`.
