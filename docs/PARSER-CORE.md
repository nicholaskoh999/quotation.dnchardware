# Parser core (`quo-parser-core.js`)

Branch `round/quo-qq-r1-loop2-shared-parser`, based on production `round/quo-r3-fast` at `ca5f0a5`. Not deployed.

The Quick Add text parser used to live inside the page script of `index.php`. It now lives in its own file,
`quo-parser-core.js`, so the same rules can be used outside the editor. Nothing about how the parser behaves was
changed: the code was moved, not rewritten.

## What moved

174 top-level declarations (86 functions, 87 constants, 1 variable), about 190 KB with their comments. They are
everything `wqaParseText`, `wqaParseQuality`, `wqaNormalizeExtraction`, `wqaRowMissing`, `wqaRowBlocked`,
`wqaPairThread`, `wqaThreadValue` and `materialLabel` need, and nothing else:

- text normalisation and heading detection
- product, material, finish and size type recognition, with their lookup tables
- diameter, length, width, thread length and quantity reading
- heading-to-row inheritance
- missing-field detection
- the built-in diameter tables and the Diameter Settings rule reader

The list was produced by a dependency analysis of the script, not by hand. The moved code references no `document`,
`window`, storage or network API.

Two things came along because the parser reaches them, and are worth knowing about:

- `let dsRulesCache` — the custom Diameter Settings rows. The page still assigns it after `get_diameter_settings`.
- `const wqa` — the Quick Add session object. `wqaRowProduct` falls back to `wqa.product` when a row has no product
  of its own. Only its declaration moved; every use of it in the page is untouched.

## What did not move

Pricing (`calcSagRod`, rounding, price modes, rates), the WhatsApp message builder, the review screen, Bulk Edit,
and everything that touches the form or the DOM. They are still in `index.php`.

## How it is loaded

```html
<script src="quo-parser-core.js?v=<first 12 hex of the file's SHA-256>"></script>
<script> … the page script … </script>
```

Both are classic scripts, so the core's top-level functions and constants are visible to the page script under the
same names as before. The relative URL works at `/` and under the Portal mount at `/quo/`.

The `?v=` value stops a browser from running a cached core against a newer page. It must be updated whenever the core
file changes; `tests/core/parser-core.test.js` fails if it does not match.

## The added interface

The end of the file is the only part that is new:

- `QUO_PARSER_CORE_VERSION` (`1.0.0`) and `QUO_PARSER_CORE_CONTRACT` (`1`).
- `quoParserCoreSetDiameterRules(rules)` — for a host that cannot assign `dsRulesCache` directly.
- `module.exports = { … }`, guarded by `typeof module`, so the browser ignores it and Node can `require` the file.

## Deployment

`quo-parser-core.js` is added to `APPFILES` in `.cpanel.yml`, so it is copied, verified and fingerprinted in the
deployment stamp like every other application file.

**The page cannot work without this file.** Before this branch is deployed anywhere, confirm on Preview that the server
returns it as JavaScript (HTTP 200, a JavaScript content type). The live `.htaccess` is not in this repository, so
that could not be checked from here.

## Tests

| Command | What it proves |
|---|---|
| `node tests/core/parser-core.test.js` | The core runs with no browser at all; it is wired into `index.php` once with the right fingerprint; no moved name is declared twice; it is on the deploy list; it contains no pricing or formatting. |
| `node tests/run.js` | The browser suites, run against the shipped `index.php` and the shipped core file. `tests/lib/harness.js` now serves the core file to the test page. |

Every inquiry in `tests/core/` is made up. This repository is public; real customer messages are not stored in it.

## Used by DNC Quick Quote

Quick Quote copies this file at build time from a pinned commit of this repository and records the commit and the
file's SHA-256. It does not re-implement any rule in it. Changing parser behaviour is done here, and reaches Quick
Quote only when it is re-copied and rebuilt.
