'use strict';
const { openApp } = require('../lib/harness');

module.exports = async (browser, A) => {
  const asked=[];
  const deduped=[
    {type:'Nut',size:'M12',finish:'',unitPrice:0.18,refNo:'Q-2026-1158',date:'2026-10-26'},
    {type:'Nut',size:'M12',finish:'',unitPrice:0.15,refNo:'Q-2026-1057',date:'2026-10-20'},
    {type:'Nut',size:'M12',finish:'ZP',unitPrice:0.20,refNo:'Q-2026-1057',date:'2026-10-20'},
    {type:'Nut',size:'M12',finish:'',unitPrice:0.20,refNo:'Q-2026-1057',date:'2026-10-20'},
  ];
  const long=Array.from({length:28},(_,n)=>({type:'Flat Washer',size:'M12',finish:'PL',unitPrice:0.10+n/100,refNo:'Q-2026-'+(1200-n),date:'2026-10-'+String(28-n).padStart(2,'0')}));
  const page=await openApp(browser,{api:{get_accessory_history:url=>{
    const q=Object.fromEntries(new URL(url).searchParams.entries()); asked.push(q);
    const records=q.type==='fw'?long:deduped;
    return {ok:true,data:{total:records.length,records}};
  }}});
  const S=A.suite('accessory history — restricted reference and explicit apply');
  await page.evaluate(()=>{ el('sagrod-size').value='M12'; el('sagrod-nutFinish').value='ZP'; el('sagrod-nutPrice').value='0.00'; });
  await page.evaluate(()=>accHistoryOpen('sagrod','nut'));
  await page.waitForTimeout(100);
  A.eq(asked[0].type,'nut','Nut lookup asks for type only');
  A.eq(asked[0].cleanSize,'M12','Nut lookup uses canonical size');
  A.eq(asked[0].finish,'ZP','Nut lookup uses finish');
  A.eq(await page.evaluate(()=>el('sagrod-nutPrice').value),'0.00','opening history does not change price');
  A.ok(await page.evaluate(()=>el('accHistoryBody').textContent.includes('Q-2026-1158')),'reference shows quotation number');
  await page.evaluate(()=>accHistoryApply(0));
  A.eq(await page.evaluate(()=>el('sagrod-nutPrice').value),'0.18','Use this price explicitly updates only the unit price');
  await page.evaluate(()=>{ el('sagrod-fwFinish').value='PL'; el('sagrod-fwPrice').value='0.00'; accHistoryOpen('sagrod','fw'); });
  await page.waitForTimeout(100);
  A.eq(asked[1].type,'fw','Flat Washer lookup asks for type');
  A.eq(await page.evaluate(()=>el('sagrod-fwPrice').value),'0.00','Flat Washer lookup remains reference-only');
  const longModal=await page.evaluate(()=>{
    const body=el('accHistoryBody'), modal=body.closest('.acc-history-modal');
    const cs=getComputedStyle(body);
    return {count:body.querySelectorAll('.ph-rec').length, scroll:body.scrollHeight>body.clientHeight,
      overflow:cs.overflowY, modalFits:modal.getBoundingClientRect().height<=innerHeight,
      pageOverflow:document.documentElement.scrollWidth-innerWidth};
  });
  A.eq(longModal.count,28,'long accessory history keeps every supplied reference card');
  A.ok(longModal.scroll&&longModal.overflow==='auto'&&longModal.modalFits,'long accessory history scrolls inside a viewport-fitting modal');
  A.ok(longModal.pageOverflow<=2,'long accessory history has no horizontal overflow');
  await page.evaluate(()=>{ closeModal('accHistoryModal'); dcSetLang('zh'); el('sagrod-nutPrice').value='0.00'; onAccChange('sagrod'); accHistoryOpen('sagrod','nut'); });
  await page.waitForTimeout(100);
  const zh=await page.evaluate(()=>{
    const b=document.querySelector('#sagrod-accPanel .acc-history-btn');
    return {label:b&&b.textContent, wrapped:b&&b.scrollHeight>b.clientHeight,
      cards:document.querySelectorAll('#accHistoryBody .ph-rec').length,
      refs:[...document.querySelectorAll('#accHistoryBody .ph-rec-ref')].map(n=>n.textContent),
      secure:Object.keys(accHistoryState.records[0]).every(k=>['type','size','finish','unitPrice','refNo','date'].includes(k))};
  });
  A.eq(zh.label,'历史价格','Chinese accessory History label is retained');
  A.ok(!zh.wrapped,'Chinese accessory History button stays on one line');
  A.eq(zh.cards,4,'duplicate-free accessory records render once each');
  /* 2026-10-27: the current finish (ZP) is the stronger reference and is listed
     first; newest first within each finish. */
  A.eq(JSON.stringify(zh.refs),JSON.stringify(['Q-2026-1057','Q-2026-1158','Q-2026-1057','Q-2026-1057']),'same-finish reference first, then newest first');
  A.ok(zh.secure,'client receives only the restricted accessory history fields');
  await page.evaluate(()=>{ dcSetLang('en'); closeModal('accHistoryModal'); onAccChange('sagrod'); });
  const en=await page.evaluate(()=>{ const b=document.querySelector('#sagrod-accPanel .acc-history-btn'); return {label:b&&b.textContent,wrapped:b&&b.scrollHeight>b.clientHeight}; });
  A.eq(en.label,'History','English accessory History label is retained');
  A.ok(!en.wrapped,'English accessory History button stays on one line');
};
