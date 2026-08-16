/* ── A stored value is not a description ───────────────────────────────────
   Phase 16.

   The quotation screen already rewrites a description saved under the older
   material vocabulary before showing it. The company/history screen — the one
   staff open to answer "what did we quote them last time?" — did not, so the
   same item read as "4140 QT + HARDEN = G10.9 FULLSIZE L BOLT" in one place and
   "4140_HARDEN_G10_9 FULLSIZE L BOLT" in the other.

   Both implementations are pulled out of the shipped files and run against the
   same table, so this fails if either one is changed alone.                  */
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

/* The function as it is written in the file, from `function name(` to its
   matching closing brace — no copy of it lives in this test. */
function extract(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return null;
  let depth = 0, i = src.indexOf('{', at);
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(at, i + 1);
}

module.exports = async (browser, A) => {
  const S = A.suite('company history — a legacy description reads as words, not as a stored value');

  const fromIndex     = extract('index.php', 'displayItemDesc');
  const fromCompanies = extract('companies.php', 'displayItemDesc');
  A.ok(!!fromIndex, 'index.php has the description normaliser');
  A.ok(!!fromCompanies, 'and companies.php now has one too');

  /* The function itself, lifted out of the shipped file and run — so what is
     asserted is the code that ships, not a copy of it. */
  const run = (code, name) => { const ctx = { out: null }; vm.createContext(ctx);
                                vm.runInContext(code + '\nout = ' + name + ';', ctx); return ctx.out; };
  const idx = run(fromIndex, 'displayItemDesc');
  const cmp = run(fromCompanies, 'displayItemDesc');

  const CASES = [
    [{ desc: '4140_HARDEN_G10_9 FULLSIZE L BOLT', material: '4140_HARDEN_G10_9' },
      '4140 QT + HARDEN = G10.9 FULLSIZE L BOLT',
      'a hardened 4140 reads as the material list writes it'],
    [{ desc: 'S45C_HARDEN_G8_8 UNDERSIZE SAG ROD', material: 'S45C_HARDEN_G8_8' },
      'S45C + HARDEN = G8.8 UNDERSIZE SAG ROD',
      'and a hardened S45C'],
    [{ desc: '4140 FULLSIZE ANCHOR BOLT', material: '4140' },
      '4140 QT FULLSIZE ANCHOR BOLT',
      'a very old desc that stored the internal value gains the QT it always meant'],
    [{ desc: '4340 FULLSIZE STUD', material: '4340' },
      '4340 QT FULLSIZE STUD',
      'the same for 4340'],
    [{ desc: '4140 FULLSIZE L BOLT', material: '4140_PLAIN' },
      '4140 FULLSIZE L BOLT',
      'while plain 4140 is its own material and never gains a QT it does not have'],
    [{ desc: 'Y BAR FULLSIZE SAG ROD', material: 'Y_BAR' },
      'Y BAR FULLSIZE SAG ROD',
      'and Y BAR is left exactly as it is'],
    [{ desc: '4140 QT FULLSIZE L BOLT', material: '4140' },
      '4140 QT FULLSIZE L BOLT',
      'a description that already reads correctly is not rewritten twice'],
    [{ desc: 'MS UNDERSIZE SAG ROD', material: 'MS' },
      'MS UNDERSIZE SAG ROD',
      'an ordinary description is untouched'],
    [{ desc: '', material: 'MS' }, '', 'and an empty one produces nothing, not "undefined"'],
    [{}, '', 'as does an item with no description at all'],
  ];

  for (const [item, expected, why] of CASES) {
    A.eq(cmp(item), expected, why);
    A.eq(cmp(item), idx(item), 'both screens read it identically: ' + JSON.stringify(item.desc || ''));
  }

  /* An underscore reaching a staff screen is the symptom; assert on it directly
     rather than only on the cases above. */
  for (const [item] of CASES) {
    A.ok(!/_[A-Z0-9]/.test(cmp(item)), 'no internal value reaches the screen: ' + JSON.stringify(item.desc || ''));
  }

  /* The render sites actually call it — a normaliser nothing uses fixes
     nothing. */
  const html = fs.readFileSync(path.join(ROOT, 'companies.php'), 'utf8');
  const raw  = html.match(/\$\{esc\((?:it|i|h)\.desc[^)]*\)\}/g) || [];
  A.eq(raw.join(' | '), '', 'no company screen prints a raw stored description any more');
  A.ok((html.match(/displayItemDesc\(/g) || []).length >= 6,
    'every description shown on the company screens goes through it');

  /* The item search sends the material along, because the plain-4140 rule
     cannot be applied without it. */
  const api = fs.readFileSync(path.join(ROOT, 'api.php'), 'utf8');
  A.includes(api, "'material'        => (string)($it['material'] ?? '')",
    'and the item search returns the material the rule needs');

  /* ── An item's price is the item's here too ──────────────────────────────
     The company screens print "QTY 10 × RM 12.00" beside a line total. Once
     the accessory charge left the unit price, those two figures stopped
     reconciling on any item that has accessories — unless the accessories are
     named here as well. */
  const accSplit = extract('companies.php', 'dcItemAccUnit');
  A.ok(!!accSplit, 'the company screens know what an accessory charge is');
  const accRun = run(accSplit, 'dcItemAccUnit');
  A.eq(accRun({ pricingModel: 'bolt-separate', accessoryUnitPrice: 0.7 }), 0.7,
    'a separately-priced item reports its accessory charge');
  A.eq(accRun({ accessoryUnitPrice: 0.7 }), 0,
    'while an item saved before the separation reports none — its charge is inside its unit price and cannot be told apart');
  A.eq(accRun({}), 0, 'and an item with no accessories reports nothing');
  A.eq((html.match(/esc\(dcAccNote\(/g) || []).length, 3,
    'all three places that print a unit price on the company screens say what is charged beside it');

  return S;
};
