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
process.stdout.write(JSON.stringify(items));
