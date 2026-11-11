/* TEST-ONLY. Prints, as JSON, quotation items built by QUO's OWN quote core
   (quo-quote-core.js, loaded with the parser and pricing cores through
   tests/lib/core-node.js) for Manual Price setups — the one price source a
   QQ client can know exactly (docs/SERVICE-API.md §4.8.1). Used by
   tests/php/service_quotation_create.test.php. All data is synthetic.

   Run:  node tests/php/quotation_create/build-items.js            */
'use strict';
const { loadCores } = require('../../lib/core-node');
const { api } = loadCores();

/* acceptance {source:'manual'}: what the editor's dcSuggestSource() answers for
   priceMode 'manual' before it looks at any recommendation. */
function build(type, fields) {
  const res = api.quoBuildItem({ type, fields, finish: 'ZP', accessories: api.quoNoAccessories(),
                                 acceptance: { source: 'manual', at: '2026-11-11T02:00:00.000Z' } });
  if (!res.ok) throw new Error(type + ': ' + res.code + ' ' + res.field);
  return res.item;
}
const items = [
  build('sagrod', { material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', diameter: '10.9', length: '1000', threadLen: '70/70',
                    costRate: '', addCost: '', markup: '', qty: '10', priceMode: 'manual', manualUnitPrice: '3.68' }),
  build('stud',   { material: 'MS', size: 'M16', diameter: '16', l: '300', costRate: '', addCost: '', markup: '',
                    qty: '24', priceMode: 'manual', manualUnitPrice: '2.15' }),
];
/* `node build-items.js recipe` (QQ R1 Loop #7, official save): items priced
   from a typed Cost Rate / Add Cost / Markup, each with the source QUO's own
   shared functions name — quoPriceSource({priceMode, setup, rec:
   quoRecommend(...)}) — against the Default Price rules in the environment
   variable DP_RULES (the rows default_prices.get returns; JSON). */
function buildRecipe(type, fields, finish, rules) {
  const rec = api.quoRecommend({ type, material: fields.material, sizeType: fields.sizeType, size: fields.size, finish,
                                 threadLen: fields.threadLen, dpRules: rules });
  const source = api.quoPriceSource({ priceMode: fields.priceMode, setup: { costRate: fields.costRate, addCost: fields.addCost, markup: fields.markup }, rec });
  const res = api.quoBuildItem({ type, fields, finish, accessories: api.quoNoAccessories(), acceptance: { source, at: '2026-11-11T02:00:00.000Z' } });
  if (!res.ok) throw new Error(type + ': ' + res.code + ' ' + res.field);
  return res.item;
}
if (process.argv[2] === 'recipe') {
  const rules = JSON.parse(process.env.DP_RULES || '[]');
  process.stdout.write(JSON.stringify([
    /* = the built-in MS Sag Rod recommendation (ZP 4.20, TL band 30–120 → +0.60) → built_in */
    buildRecipe('sagrod', { material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', diameter: '10.9', length: '1000', threadLen: '70/70',
                            costRate: '4.20', addCost: '0.60', markup: '0', qty: '10', priceMode: 'auto', manualUnitPrice: '' }, 'ZP', rules),
    /* = the custom Default Price rule for Stud MS M16 HDG → default_rule */
    buildRecipe('stud', { material: 'MS', size: 'M16', diameter: '16', l: '300', costRate: '7.25', addCost: '0', markup: '0',
                          qty: '24', priceMode: 'no_round', manualUnitPrice: '' }, 'HDG', rules),
    /* a person's own numbers → manual_recipe */
    buildRecipe('sagrod', { material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', diameter: '10.9', length: '1000', threadLen: '70/70',
                            costRate: '4.50', addCost: '0.60', markup: '0', qty: '5', priceMode: 'auto', manualUnitPrice: '' }, 'ZP', rules),
  ]));
} else {
  process.stdout.write(JSON.stringify(items));
}
