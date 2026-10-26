'use strict';
const { openApp } = require('../lib/harness');

module.exports = async (browser, A) => {
  const asked=[];
  const page=await openApp(browser,{api:{get_accessory_history:url=>{
    const q=Object.fromEntries(new URL(url).searchParams.entries()); asked.push(q);
    return {ok:true,data:{total:1,records:[{type:q.type==='fw'?'Flat Washer':'Nut',size:'M12',finish:q.finish,unitPrice:q.type==='fw'?0.12:0.45,refNo:'Q-2026-0018',date:'2026-10-25'}]}};
  }}});
  const S=A.suite('accessory history — restricted reference and explicit apply');
  await page.evaluate(()=>{ el('sagrod-size').value='M12'; el('sagrod-nutFinish').value='ZP'; el('sagrod-nutPrice').value='0.00'; });
  await page.evaluate(()=>accHistoryOpen('sagrod','nut'));
  await page.waitForTimeout(100);
  A.eq(asked[0].type,'nut','Nut lookup asks for type only');
  A.eq(asked[0].cleanSize,'M12','Nut lookup uses canonical size');
  A.eq(asked[0].finish,'ZP','Nut lookup uses finish');
  A.eq(await page.evaluate(()=>el('sagrod-nutPrice').value),'0.00','opening history does not change price');
  A.ok(await page.evaluate(()=>el('accHistoryBody').textContent.includes('Q-2026-0018')),'reference shows quotation number');
  await page.evaluate(()=>accHistoryApply(0));
  A.eq(await page.evaluate(()=>el('sagrod-nutPrice').value),'0.45','Use this price explicitly updates only the unit price');
  await page.evaluate(()=>{ el('sagrod-fwFinish').value='PL'; el('sagrod-fwPrice').value='0.00'; accHistoryOpen('sagrod','fw'); });
  await page.waitForTimeout(100);
  A.eq(asked[1].type,'fw','Flat Washer lookup asks for type');
  A.eq(await page.evaluate(()=>el('sagrod-fwPrice').value),'0.00','Flat Washer lookup remains reference-only');
};
