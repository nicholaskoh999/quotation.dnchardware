# TRANSLATION AUDIT — English / 中文

Baseline `f96714e` → final. Tooling: `tests/tools/check-translations.js`
(static, reads the shipped source) and `tests/suites/30-language.test.js`
(browser, switches the language the way the button does and reads the SCREEN).

---

## Coverage

| File | Keys | Translated | Missing zh | Undefined | Identical (non-code) | Bypassing dcT |
|---|---:|---:|---:|---:|---:|---:|
| index.php | 564 | 100% | 0 | 0 | 0 | 0 |
| companies.php | 83 | 100% | 0 | 0 | 0 | 0 |
| login.php | 11 | 100% | 0 | 0 | 0 | 0 |
| **Total** | **658** | **100%** | **0** | **0** | **0** | **0** |

At baseline the dictionary already read 100% translated. That number was not
false, but it was not the whole picture: **a string with no key is not a missing
translation, it is not a translation at all**, and 129 of those were on screen.

| | baseline | final |
|---|---:|---:|
| dictionary keys | 512 | 658 |
| dictionary coverage | 100% | 100% |
| strings bypassing `dcT` | **129** | **0** |

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
two words each, every one a control. The checker now holds label-bearing tags
(`label`, `h1`–`h6`, `button`, `option`, `th`, and `*-label` / `ref-tab`
classes) to two words and everything else to four.

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
* `tests/suites/30-language.test.js` — 82 assertions. Switches the language,
  reads the rendered screen, presses real buttons and reads real toasts,
  confirms trade vocabulary survives, and asserts no key name is ever shown raw.

## Evidence

`screenshots/25-main-page-english.png` · `26-main-page-chinese.png` ·
`27-quickadd-chinese.png` · `28-companies-chinese.png` ·
`29-calculator-chinese.png` · `30-validation-message-chinese.png`
and `before-fix/30-validation-message-chinese.png` (the same refusal, in
English, with the interface in 中文) and `before-fix/B-welding-anchor-set-english.png`.
