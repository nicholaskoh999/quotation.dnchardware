/* ════════════════════════════════════════════════════════════════════════════
   QUO PRICING CORE — weight, price and rounding arithmetic, shared.

   This file is the single source of the arithmetic that turns a recognised
   item and a pricing setup (Cost Rate, Additional Cost, Markup, Price Mode)
   into a unit price: the diameter in force (built-in table or a Diameter
   Settings rule), bar weight, bent total length, base and raw price, the two
   Auto Round rules, No Round, Manual Price, and the checks that decide whether
   a Quick Add row has a usable price.

   WHO LOADS IT
     1. index.php, as a classic <script> placed after quo-parser-core.js and
        before the page script. The calculators in index.php (calcSagRod,
        calcLBolt, ... and resolvePriceMode) call the functions below; they
        hold no arithmetic of their own.
     2. Node (tests): tests/lib/core-node.js loads quo-parser-core.js and this
        file into one scope, the way the page does.
     3. DNC Quick Quote: copied at build time, together with
        quo-parser-core.js, from a pinned commit of this repository. It is
        never re-implemented there.

   IT NEEDS quo-parser-core.js. Names such as dcBuiltInDiameter, loadDSRules and
   wqaRowBlocked are that file's, and are not repeated here.

   RULES FOR EDITING
     - No DOM, no window, no network, no storage. Only standard JavaScript.
       tests/core/pricing-core.test.js fails if this is broken.
     - Changing a formula or a rounding rule here changes every quotation.
       tests/suites/79-pricing-core-parity.test.js prices the same rows through
       the product forms and through quoPriceRow and fails on any difference.
     - Any change alters the file's SHA-256: update the ?v= value on the
       <script src> line in index.php (the core test checks it) and bump
       QUO_PRICING_CORE_VERSION at the bottom of this file.
     - .cpanel.yml lists this file in APPFILES. Without it the editor breaks.

   PART 1, between this banner and the SHARED ARITHMETIC banner, was moved out
   of index.php without editing a character.
   ════════════════════════════════════════════════════════════════════════════ */
function dcSizeTypeFor(product,sizeType){ return dcProductHasSizeType(product) ? String(sizeType||'') : ''; }
function evalExpr(raw){
  if(!raw||!raw.trim())return 0;
  let t=String(raw).trim();
  /* A thousands separator is a way of writing a number, not an operator:
     1,200 is twelve hundred. */
  if(/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(t)) t=t.replace(/,/g,'');
  if(/^[\d\s.+\-*/]+$/.test(t)){ try{return parseFloat(Function('"use strict";return('+t+')')())||0}catch(e){} }
  /* Otherwise it is a number only if the WHOLE of it is one. parseFloat used to
     stop at the first character it did not like, so "1,200" became 1 and "2,80"
     became 2 — a rate a hundredth of what was typed, past every guard, on the
     quotation. Reading half of what somebody wrote is worse than reading none
     of it: 0 here is what validateRateEntry reports as "not a valid number". */
  const n=Number(t);
  return isFinite(n) ? n : 0;
}
/* Does this text read as a number at all? Shared by the rate guard above and by
   the manual-price guard, so an entry one of them refuses is not silently
   accepted as zero by the other. */
function isReadableAmount(raw){
  const t=String(raw||'').trim();
  if(t==='') return false;
  return !(evalExpr(t)===0 && !/^[0\s.+\-*/,]*$/.test(t));
}
function round05(v){
  return roundMoney2(Math.round((Number(v)||0)*20)/20);
}
/* Non-Sag Auto Round (owner-locked): RM0.10 bands. Inside each 10-sen band
   x.x0–x.x3 rounds down to the band, x.x4–x.x9 rounds up to the next band.
   Worked in whole cents so 10.04 cannot become 10.0399… on the way. */
function roundCustom10(v){
  const cents=Math.round((Number(v)||0)*100), band=Math.floor(cents/10)*10;
  return roundMoney2(((cents-band)<=3 ? band : band+10)/100);
}
function roundMoney2(v){return Math.round((Number(v)||0)*100)/100}
/* THE Auto Round engine — the two owner-locked rules above, in one place:
   Sag Rod nearest RM0.05, every other family the RM0.10 band rule. */
function dcAutoRound(type,v){ return type==='sagrod' ? round05(v) : roundCustom10(v); }
/* R2.3 OWNER CONTRACT OVERRIDE (2026-11-04): with accessories and Auto Round,
   the engine rounds the COMBINED raw price, bolt + accessories, once at the
   final stage — Round(Base + Accessories), superseding Round(Base) +
   Accessories. Items priced this way carry autoRoundStage:'final'; an item
   without it was priced under the earlier rule and is never re-priced. */
const DC_AUTO_ROUND_STAGE='final';
/* The Price Mode a genuinely NEW item starts on. Owner rule (2026-10-29):
   a new Sag Rod starts on No Round so L1070 and L1072 keep their own prices
   instead of collapsing to one RM0.05 step; every other product starts on
   Auto Round. Creation-time only — restore, History, Apply-setup and the
   legacy 'auto' fallbacks never consult it. */
function dcDefaultPriceMode(type){ return type==='sagrod'?'no_round':'auto'; }
/* What this item will actually be weighed on. A Diameter Settings rule the
   user configured outranks the built-in table, always. */
function dcEffectiveDiameter(type,material,sizeType,size){
  const custom=findDSRule(type,material,sizeType,size);
  if(custom!==null) return custom;
  return dcBuiltInDiameter(type,material,sizeType,size);
}
function findDSRule(type,material,sizeType,size){
  const rules=loadDSRules();
  const noST=DS_TYPES_NO_SIZETYPE.includes(type);
  const rule=rules.find(r=>{
    if(r.type!==type) return false;
    if(r.material && r.material!==material) return false;
    if(!noST && r.sizeType && r.sizeType!==sizeType) return false;
    if(r.size && r.size.toUpperCase()!==size.toUpperCase()) return false;
    return true;
  });
  return rule ? parseFloat(rule.diameter) : null;
}
function accAddon(acc){
  if(!acc) return 0;
  let addon=0;
  if(acc.nut&&acc.nut.enabled) addon+=(acc.nut.qty||0)*(acc.nut.unitPrice||0);
  if(acc.fw&&acc.fw.enabled) addon+=(acc.fw.qty||0)*(acc.fw.unitPrice||0);
  if(acc.custom&&acc.custom.enabled) addon+=(acc.custom.unitPrice||0);
  return addon;
}
/* A price worked out from a material nobody chose is not this item's price, and
   a number on screen reads as an answer. So the money waits for the material.
   The weight beside it does not: it comes from diameter and length alone and is
   true whatever the rod is made of. */
function wqaShownPrice(r){
  if(wqaRowProduct(r) && !wqaRowSpec(r,'material')) return 0;
  return (r.calc||{}).finalUnitPrice;
}
/* A setup that can price: a Cost Rate above zero, or a stated Manual Price. */
function wqaRowSetupOk(r){
  if(!r||!r.calc) return false;
  if((r.priceMode||'auto')==='manual'){
    const m=String(r.manualPrice||'').trim();
    return !!m && isReadableAmount(m) && evalExpr(m)>0;
  }
  return Number(evalExpr(String(r.calc.costRate||'').trim()||'0'))>0;
}
function wqaRowPriceable(r){
  return !!r && !r.removed && !r.added && !wqaRowBlocked(r) && !!r.calc && Number(wqaShownPrice(r))>0;
}
function wqaRowPa(r){
  if(!wqaRowPriceable(r) || !wqaRowSetupOk(r)) return {state:'none'};
  return {state:'accepted',v:roundMoney2(r.calc.finalUnitPrice),src:r.calc.src||'manual_recipe',ref:r.usedHistoryRef||''};
}
function wqaRowAccepted(r){ return wqaRowPa(r).state==='accepted'; }
function wqaMarkEdited(r,k){ if(r){ (r.edited||(r.edited={}))[k]=true; } }
/* The rows' side of applying pricing: every writer (the common panel, Bulk
   Adjust, a group heading) goes through here, so a blank field is "leave it"
   everywhere and a reused record is superseded by the same rule everywhere.
   Returns how many rows let go of a reused record. */
function wqaApplyPriceTo(targets,c,modeSet){
  let droppedLast=0;
  targets.forEach(r=>{
    wqaMarkEdited(r,'price');
    const histMode=r.priceMode||'auto';
    if(c.costRate!=='') r.priceOverride.costRate=c.costRate;
    if(c.addCost!=='')  r.priceOverride.addCost=c.addCost;
    if(c.markup!=='')   r.priceOverride.markup=c.markup;
    /* The rates are applied only where the panel states one; the price mode
       was applied unconditionally, so opening this panel to put a cost rate on
       the list silently took row 3 off the Manual Price of RM 50 somebody had
       set for it and re-priced it from the formula. It follows the same rule
       as the fields beside it: stated, or left alone. */
    if(modeSet) r.priceMode=c.priceMode||'auto';
    /* A row priced from a historical record keeps that provenance until this
       panel actually SUPERSEDES it — which it does by stating any component of
       the pricing, or by moving the row to a different mode. A reused recipe
       leaves the row on Auto Round, so "not manual" is no longer the test:
       it would have quietly dropped the reference off every recipe row this
       panel merely passed over. */
    const supersedes=(c.costRate!=='')||(c.addCost!=='')||(c.markup!=='')
                   ||(modeSet && (c.priceMode||'auto')!==histMode);
    if(r.usedHistoryRef && supersedes){
      r.usedHistoryRef=''; r.usedHistoryRecipe=false; r.manualPrice='';
      /* Only what the record put there and this write did not just state:
         deleting every key wiped the values written three lines above. */
      (r.histApplied||[]).forEach(k=>{ if(c[k]===''||c[k]===undefined) delete r.priceOverride[k]; });
      r.histApplied=[];
      droppedLast++;
    }
  });
  return droppedLast;
}

/* ════════════════════════════════════════════════════════════════════════════
   SHARED ARITHMETIC — PART 2. The expressions below stood inline in the
   calculators of index.php (calcSagRod, addSagRod, calcLBolt, ... and
   resolvePriceMode). They are the same expressions, in the same order of
   evaluation, given names so the page and any other host run one copy.
   ════════════════════════════════════════════════════════════════════════════ */
/* Round bar: diameter² x length x the steel constant (mm, mm -> kg). */
function dcBarWeight(diameter,length){ return diameter*diameter*length*0.0000061654; }
/* Material at the cost rate, plus the per-piece Additional Cost. */
function dcBasePrice(weight,costRate,addCost){ return weight*costRate+addCost; }
/* The base with the markup on it — before any rounding. */
function dcRawPrice(base,markup){ return base*(1+markup/100); }
/* The bar length of a bent product, from its drawing dimensions, in whole
   millimetres. Each line is the product's own rule as its calculator had it. */
function dcLBoltTotalLength(d,l,w){ return Math.ceil(l+w-d*1.5); }
function dcJBoltTotalLength(d,h,id,s){
  const upper=h-s, lower=(d+id)*1.57+(s-d)+(s-d)-id;
  return Math.ceil(upper+lower);
}
function dcUBoltTotalLength(d,id,ih){ return Math.ceil((d+id)*1.57+(2*ih)-id); }
function dcSQUBoltTotalLength(d,oh,w){ return Math.ceil(((w/2+oh)-d*1.5)*2); }

/* ── Price Mode ────────────────────────────────────────────────────────────
   What resolvePriceMode in index.php computes, without the form: the mode and
   the Manual Price text are handed in, and the result is returned instead of
   being stored. index.php stores it in priceCalcState[type] exactly as before.

   Where the accessory charge lands, per price mode. The Final Unit Price is
   what the customer pays for one piece, accessories included, in every mode.
   What differs is which end is known:

     Auto Round / No Round   the BOLT is calculated, and the accessories are
                             added to reach the customer's price.
     Manual Price            the CUSTOMER'S price is typed — that is what a
                             person means when they write RM10 on a quotation
                             — so the accessories come OUT of it to leave the
                             bolt component. Typing RM10 with RM2 of nuts
                             quotes RM10, not RM12.

   Both ends are recorded either way, because Previous Price compares bolts
   against bolts and staff still need to see what the RM2.00 was.

   Owner model: Sag Rod rounds to nearest 5 sen; every other family uses the
   RM0.10 band rule (x.x3 down, x.x4 up). No Round is currency only. R2.3: with
   accessories, Auto Round rounds raw bolt + accessories ONCE (the bolt is
   never rounded first); the bolt component is what is left after the
   accessories, so final = bolt + accessories still holds. */
function dcResolvePrice(type,mode,manualRaw,rawUnitPrice,accessoriesCost,weight){
  const manualUnitPrice=evalExpr(manualRaw);
  const accUnit=roundMoney2(Number(accessoriesCost)||0);
  let boltUnitPrice,finalUnitPrice;
  if(mode==='manual'){
    finalUnitPrice=roundMoney2(manualUnitPrice);
    boltUnitPrice=roundMoney2(finalUnitPrice-accUnit);
  }else{
    const raw=Number(rawUnitPrice)||0;
    if(mode==='no_round'){
      boltUnitPrice=roundMoney2(raw);
      finalUnitPrice=roundMoney2(boltUnitPrice+accUnit);
    }else if(accUnit>0){
      finalUnitPrice=dcAutoRound(type,raw+accUnit);
      boltUnitPrice=roundMoney2(finalUnitPrice-accUnit);
    }else{
      boltUnitPrice=dcAutoRound(type,raw);
      finalUnitPrice=boltUnitPrice;
    }
  }
  return {
    weight:Number(weight)||0,
    priceMode:mode,manualUnitPrice:manualRaw,rawUnitPrice:Number(rawUnitPrice)||0,
    roundedUnitPrice:Number(dcAutoRound(type,rawUnitPrice))||0,accessoriesCost:accUnit,
    /* What Auto Round makes of the whole piece — the figure a Manual Price is
       compared with on the card. */
    autoFinalUnitPrice:Number(accUnit>0?dcAutoRound(type,(Number(rawUnitPrice)||0)+accUnit):dcAutoRound(type,rawUnitPrice))||0,
    boltUnitPrice:Number(boltUnitPrice)||0,
    finalUnitPrice:Number(finalUnitPrice)||0,
    /* One number under two names: what the customer pays for a piece IS the
       line's unit price now. Kept so nothing that reads the old name breaks. */
    lineUnitPrice:Number(finalUnitPrice)||0
  };
}
/* What is wrong with a typed Cost Rate / Additional Cost, if anything. The two
   refusals validateRateEntry in index.php has always made: a negative result,
   and text that only reads as zero because it is not a number ("abc", "2,80").
   Blank is not a problem here; the blank-rate guards say that themselves. */
function dcRateEntryProblem(raw){
  const t=String(raw==null?'':raw).trim();
  if(t==='') return '';
  const v=evalExpr(t);
  if(v<0) return 'negative';
  if(v===0 && !/^[0\s.+\-*/,]*$/.test(t)) return 'unreadable';
  return '';
}

/* ════════════════════════════════════════════════════════════════════════════
   HOST INTERFACE — PART 3. For a host with no product form (Node, DNC Quick
   Quote). index.php does not call anything below this line.
   ════════════════════════════════════════════════════════════════════════════ */
/* Bump on every change to this file. MAJOR when a caller would have to change. */
const QUO_PRICING_CORE_VERSION = '1.0.0';
/* The shape of the interface. Changes only when a name is removed or its
   meaning changes; a consumer built against another number must refuse to run. */
const QUO_PRICING_CORE_CONTRACT = 1;

/* What an <input type="number"> keeps of a value written into it: the text if
   it is a plain number, otherwise nothing. The product forms hold lengths, the
   diameter, the markup and the Manual Price in such boxes, so a row priced
   without the form has to read its values the same way. */
function quoNumberBoxText(v){
  const t=String(v==null?'':v);
  return /^-?(?:\d+|\d*\.\d+)(?:[eE][-+]?\d+)?$/.test(t) ? t : '';
}
function quoNumberBox(v){ return parseFloat(quoNumberBoxText(v))||0; }
/* The per-piece accessory charge of a Quick Add row, read the way the form
   reads it after the row's accessories are loaded into it. */
function quoRowAccessoryCost(acc){
  if(!acc) return 0;
  const on=k=>!!(acc[k]&&acc[k].enabled);
  const num=(v,d)=>parseFloat(quoNumberBoxText(v)||d)||d;
  return accAddon({
    nut:{enabled:on('nut'),qty:acc.nut?num(acc.nut.qty||2,2):2,unitPrice:acc.nut?num(acc.nut.unitPrice||0,0):0},
    fw:{enabled:on('fw'),qty:acc.fw?num(acc.fw.qty||1,1):1,unitPrice:acc.fw?num(acc.fw.unitPrice||0,0):0},
    custom:{enabled:on('custom'),unitPrice:acc.custom?num(acc.custom.unitPrice||0,0):0}
  });
}
/* The rows of a fresh parse, as the review step holds them. index.php does this
   in wqaEnterReview; the fields pricing reads are set the same way here: the
   parsed accessories copied onto the row, the product's own starting Price
   Mode (Sag Rod: No Round), and no pricing yet. As on the review screen, the
   document's product and common values become the fallback for a row that
   states none (wqa.product, wqa.common). */
function quoReviewRows(parsed){
  const common=(parsed&&parsed.common)||{};
  wqa.product=common.product||''; wqa.common={...common};
  return ((parsed&&parsed.rows)||[]).map(r=>({...r,acc:r.accParsed?JSON.parse(JSON.stringify(r.accParsed)):null,
    priceMode:dcDefaultPriceMode(wqaRowProduct(r)),usedHistoryRef:'',manualPrice:'',
    priceOverride:{},removed:false,edited:{}}));
}
/* ── Price one Quick Add row without a form ────────────────────────────────
   index.php prices a review row by writing it into the product form, running
   that product's calculator and reading the result back (wqaRecomputeAll).
   This does the same steps on the row alone and leaves the same three fields
   on it:

     r.calc    {costRate, addCost, markup, weight, boltUnitPrice,
                accessoriesCost, finalUnitPrice}, or null when the row cannot
                be weighed
     r.noDia   true when the size has no diameter at the size type asked for
     r.diaMm   the diameter the weight was made of (kept when a person typed it)

   `common` is the document's own material / size type, used where the row has
   none, as on the review screen. Returns the intermediate figures (diameter,
   total length, weight, base, raw price, the resolved price state) for a row
   that was priced, or null. The row's pricing is read from where the review
   keeps it: r.priceOverride.{costRate,addCost,markup}, r.priceMode,
   r.manualPrice.

   Not done here, because it is not arithmetic: the recommended rates and the
   price-source label (r.rec, r.calc.src). A host that needs them asks QUO. */
function quoPriceRow(r,common){
  const c=common||{};
  const t=wqaRowProduct(r);
  if(!t){ r.calc=null; return null; }
  if(!wqaSizeWeighable(r)){ r.calc=null; r.noDia=false; if(!r.diaManual) r.diaMm=''; return null; }
  const prod=wqaProductByType(t)||WQA_NO_PRODUCT;
  const dimsOk=(prod.dims||[]).every(d=>(d==='size'||d==='threadLen')
    ? true : parseFloat(String(r[d]==null?'':r[d]))>0);
  if(!dimsOk){ r.calc=null; r.noDia=false; return null; }
  /* The specification the form would hold. */
  const material=wqaRowSpec(r,'material')||c.material||'MS';
  const asks=dcProductHasSizeType(t);
  const stRaw=asks ? dcSizeTypeFor(t,wqaRowSpec(r,'sizeType')||c.sizeType) : '';
  const sizeType=(stRaw==='FULLSIZE'||stRaw==='UNDERSIZE') ? stRaw : '';
  const size=normalizeSizeValue(r.size);
  /* The diameter: none while the size type is still an open question, a
     Diameter Settings rule before the built-in table, and a bar a person
     typed for this row before either. */
  const table=(asks && !sizeType) ? '' : dcEffectiveDiameter(t,material,sizeType,size);
  let d=quoNumberBox(table!==''&&table!=null?String(table):'');
  const manualDia=r.diaManual ? parseFloat(String(r.diaMm||'').trim()) : NaN;
  if(manualDia>0){
    d=quoNumberBox(String(r.diaMm).trim());
    if(!(d>0)) d=manualDia;
    r.noDia=false;
  }else{
    r.noDia=!(d>0);
  }
  if(!r.diaManual) r.diaMm=r.noDia ? '' : String(d);
  if(r.noDia){ r.calc=null; return null; }
  /* The bar length the weight is made of. */
  const box=k=>quoNumberBox(r[k]==null?'':r[k]);
  let totalLength;
  if(t==='lbolt'){ const a=dcLBoltTotalLength(d,box('length'),box('w')); totalLength=a>0?a:0; }
  else if(t==='jbolt'){ const a=dcJBoltTotalLength(d,box('h'),box('id'),box('s')); totalLength=a>0?a:0; }
  else totalLength=box('length');
  /* The pricing setup, as the form's boxes would hold it. */
  const po=r.priceOverride||{};
  const costRateText=po.costRate===undefined ? '' : String(po.costRate==null?'':po.costRate);
  const addCostText=po.addCost===undefined ? '' : String(po.addCost==null?'':po.addCost);
  const markupText=po.markup===undefined ? '' : quoNumberBoxText(po.markup);
  const rowMode=r.priceMode||'auto';
  const mode=['auto','no_round','manual'].includes(rowMode) ? rowMode : 'auto';
  const manualRaw=(rowMode==='manual' ? quoNumberBoxText(r.manualPrice||'') : '').trim();
  const costRate=evalExpr(costRateText), addCost=evalExpr(addCostText), markup=parseFloat(markupText)||0;
  const weight=dcBarWeight(d,totalLength);
  const base=dcBasePrice(weight,costRate,addCost);
  const raw=dcRawPrice(base,markup);
  const state=dcResolvePrice(t,mode,manualRaw,raw,quoRowAccessoryCost(r.acc),weight);
  r.calc={costRate:costRateText,addCost:addCostText,markup:markupText,
          finalUnitPrice:Number(state.finalUnitPrice)||0,
          boltUnitPrice:Number(state.boltUnitPrice)||0, accessoriesCost:Number(state.accessoriesCost)||0,
          weight:Number(state.weight)||0};
  return {type:t,material:material,sizeType:sizeType,size:size,diameter:d,totalLength:totalLength,
          weight:weight,costRate:costRate,addCost:addCost,markup:markup,base:base,rawUnitPrice:raw,state:state};
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    QUO_PRICING_CORE_VERSION: QUO_PRICING_CORE_VERSION,
    QUO_PRICING_CORE_CONTRACT: QUO_PRICING_CORE_CONTRACT,
    quoPriceRow: quoPriceRow,
    quoNumberBox: quoNumberBox,
    quoNumberBoxText: quoNumberBoxText,
    quoRowAccessoryCost: quoRowAccessoryCost,
    dcBarWeight: dcBarWeight,
    dcBasePrice: dcBasePrice,
    dcRawPrice: dcRawPrice,
    dcLBoltTotalLength: dcLBoltTotalLength,
    dcJBoltTotalLength: dcJBoltTotalLength,
    dcUBoltTotalLength: dcUBoltTotalLength,
    dcSQUBoltTotalLength: dcSQUBoltTotalLength,
    dcResolvePrice: dcResolvePrice,
    dcRateEntryProblem: dcRateEntryProblem,
    evalExpr: evalExpr,
    isReadableAmount: isReadableAmount,
    round05: round05,
    roundCustom10: roundCustom10,
    roundMoney2: roundMoney2,
    dcAutoRound: dcAutoRound,
    DC_AUTO_ROUND_STAGE: DC_AUTO_ROUND_STAGE,
    dcDefaultPriceMode: dcDefaultPriceMode,
    findDSRule: findDSRule,
    dcEffectiveDiameter: dcEffectiveDiameter,
    accAddon: accAddon,
    wqaRowSetupOk: wqaRowSetupOk,
    wqaShownPrice: wqaShownPrice,
    wqaRowPriceable: wqaRowPriceable,
    wqaRowPa: wqaRowPa,
    wqaRowAccepted: wqaRowAccepted,
    wqaApplyPriceTo: wqaApplyPriceTo,
    wqaMarkEdited: wqaMarkEdited,
    quoReviewRows: quoReviewRows,
    dcSizeTypeFor: dcSizeTypeFor,
  };
}
