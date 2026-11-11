/* ════════════════════════════════════════════════════════════════════════════
   QUO QUOTE CORE — the saved quotation item and the WhatsApp quotation text.

   This file is the single source of two things every quotation is made of:
     · the item object Add to Quotation puts into the quotation (quoBuildItem),
       for the eight bolt products: Sag Rod, Stud, Anchor Bolt, U Bolt,
       SQ U Bolt, L Bolt, L Bolt 45DEG, J Bolt;
     · the WhatsApp quotation text the copy buttons put on the clipboard
       (quoQuoteText, quoWAItemsText).

   WHO LOADS IT
     1. index.php, as a classic <script> placed after quo-parser-core.js and
        quo-pricing-core.js and before the page script. The add functions
        (addSagRod ... addJBolt) read the form and hand it to quoBuildItem; the
        copy buttons hand the quotation to quoQuoteText. Neither holds a second
        copy of the rules.
     2. Node (tests): tests/lib/core-node.js loads the three cores into one
        scope, the way the page does.
     3. DNC Quick Quote: copied at build time, together with the two other
        cores, from a pinned commit of this repository. Never re-implemented.

   IT NEEDS quo-parser-core.js AND quo-pricing-core.js (normalizeSizeValue,
   materialLabel, dcFinishFor, evalExpr, dcResolvePrice, roundMoney2, accAddon,
   wqaRowProduct, ...). Their names are not repeated here.

   RULES FOR EDITING
     - No DOM, no window, no network, no storage. Only standard JavaScript.
       tests/core/quote-core.test.js fails if this is broken.
     - A changed item field or a changed character of WhatsApp text is a change
       to every quotation. tests/fixtures/quote-baseline-ca5f0a5.json holds what
       production produced; do not regenerate it to make a test pass.
     - Any change alters the file's SHA-256: update the ?v= value on the
       <script src> line in index.php (the core test checks it) and bump
       QUO_QUOTE_CORE_VERSION at the bottom of this file.
     - .cpanel.yml lists this file in APPFILES. Without it the editor breaks.

   PART 1, between this banner and the FORM-FREE BUILDERS banner, was moved out
   of index.php without editing a character.
   ════════════════════════════════════════════════════════════════════════════ */
/* Trimmed; a row the user opened and never filled in is not an entry. This is
   also the deep copy — every item leaves here with its own array and its own
   objects, so editing item 2 can never reach item 1. */
function dcNormalizeCustomDims(list){
  if(!Array.isArray(list)) return [];
  return list.map(e=>({label:String((e&&e.label)!=null?e.label:'').trim(),
                       value:String((e&&e.value)!=null?e.value:'').trim()}))
             .filter(e=>e.label!=='' || e.value!=='');
}
/* Read-only views: "H2 530 · A 120", in the order staff entered them. */
function dcCustomDimsText(list){
  return dcNormalizeCustomDims(list).map(e=>[e.label,e.value].filter(Boolean).join(' ')).join(' · ');
}
const ITEM_TYPES={sagrod:'SAG ROD',stud:'STUD',anchorbolt:'ANCHOR BOLT',ubolt:'U BOLT',squbolt:'SQ U BOLT',lbolt:'L BOLT',lbolt45:'L BOLT 45DEG',jbolt:'J BOLT',plate:'PLATE',was:'WELDING ANCHOR SET',others:'OTHERS / SPECIAL BOLT'};
function cleanNum(v){const n=parseFloat(v);if(isNaN(n))return v;return Number.isInteger(n)?String(n):String(parseFloat(n.toFixed(2)))}
function withMm(v){return String(v).trim()?String(v).trim()+'mm':''}
function isMaterialOptionText(text){
  const value=String(text||'').trim().toUpperCase();
  if(!value) return false;
  const labels=['MS','S45C','S45C + HARDEN = G8.8','4140 QT','4140 QT + HARDEN = G10.9','4140','4340 QT','SS304','SS316','Y BAR'];
  return labels.some(label=>label.toUpperCase()===value);
}
/* ── An item's price (owner rule, Pricing Control Reset + owner smoke) ────
   A new item starts at Cost 0 / Add 0 / Markup 0 — no price. What a person
   types (Cost Rate, Additional Cost, Markup, Price Mode, Manual Price) IS the
   pricing: once there is a valid setup, the calculated RM/pc is the item's
   price immediately, with no separate confirmation. Recommendations are
   never written into the boxes by themselves.

   A SAVED item opened for edit keeps its saved price while nothing
   price-affecting moves (dcPaKeepSaved) — the full fingerprint of the form
   and the price itself (dcFormPaSig). Qty is never part of it.            */
const DC_PRICE_SOURCES=['built_in','default_rule','manual_recipe','history_recipe','history_manual','manual','legacy_saved'];
function dcPaMeta(src,ref,v){
  const m={state:'accepted',value:roundMoney2(v),source:DC_PRICE_SOURCES.indexOf(src)>=0?src:'built_in',at:new Date().toISOString()};
  if(ref) m.historyRef=String(ref);
  return m;
}
/* Update Item with nothing price-affecting changed, on an item whose saved
   price today's calculation would not reproduce (an older rate, an older
   rounding rule, no recipe at all): the saved price and the recipe it was
   saved with stand. Only what is not price — qty, notes — moves. */
const DC_PA_KEEP_FD=['costRate','addCost','markup','priceMode','manualUnitPrice','rawUnitPrice','roundedUnitPrice',
  'anchorCostRate','basePlateCostRate','trianglePlateCostRate'];
function dcPaKeepSaved(item,orig){
  const qty=parseInt(item.qty,10)||0, v=dcItemFinalUnit(orig);
  if(item.pricingModel) Object.assign(item,dcLineMoney(v,item.accessories,qty));
  else { item.finalUnitPrice=v; item.totalAmount=roundMoney2(v*qty); }
  /* the rounding rule the saved price was made under travels with it */
  ['priceMode','manualUnitPrice','rawUnitPrice','roundedUnitPrice','markup','autoFinalUnitPrice','autoRoundStage'].forEach(k=>{
    if(Object.prototype.hasOwnProperty.call(orig,k)) item[k]=orig[k]; else delete item[k];
  });
  const ofd=orig.formData||{};
  if(item.formData) DC_PA_KEEP_FD.forEach(k=>{
    if(Object.prototype.hasOwnProperty.call(ofd,k)) item.formData[k]=ofd[k]; else delete item.formData[k];
  });
  return item;
}
function getNominalDiameter(size){
  if(DIA_FULLSIZE[size]!==undefined) return DIA_FULLSIZE[size];
  const m=(size||'').match(/^M(\d+(?:\.\d+)?)$/i);
  if(m) return parseFloat(m[1]);
  return null;
}
/* What the CUSTOMER reads. An inch size is written with its mark — 1/2", 7/8"
   — for the same reason a length is written 1000mm: without the unit the
   number is ambiguous, and 1/2 next to M20 on the same quotation invites the
   reader to supply the wrong one. The canonical size the app looks diameters,
   Diameter Settings rules and previous prices up by is untouched: this is the
   unit on the label, exactly as withMm() is the unit on a length. */
function sizeDisplay(size){
  const s=String(size||'').trim();
  return /^\d+(?:-\d+)?\/\d+$/.test(s) ? s+'"' : s;
}
/* A saved size LABEL ("3/8 x ID 274 x IH 320 x TL 75mm", "Ø28.6-1-1/8 x L 1000")
   written before inch sizes carried their mark: the size token at its start
   gets the mark at render time, so an old quotation reads like a new one. Only
   that token, only a fraction, never a second mark; the stored item is untouched. */
function dcSizeLabelDisplay(label){
  return String(label==null?'':label).replace(/^(\s*(?:Ø[\d.]+-)?)(\d+-\d+\/\d+|\d+\/\d+)(?=\s+x\s|\s*$|\n)/,'$1$2"');
}
function formatSizeLabel(size,diameter,sizeType){
  const shown=sizeDisplay(size);
  const d=parseFloat(diameter);
  if(!size||!d) return shown;
  if((sizeType||'FULLSIZE')==='UNDERSIZE') return shown;
  const bar=cleanNum(Math.round(d*10)/10);
  const nominal=getNominalDiameter(size);
  if(nominal===null) return 'Ø'+bar+'-'+shown;
  return Math.abs(d-nominal)>0.2 ? 'Ø'+bar+'-'+shown : shown;
}
/* ── The accessories are part of what the customer pays ─────────────────────
   ONE price reaches the customer, and everything bolted to the item is inside
   it. A rod at RM5.76 with two nuts at RM2.00 is quoted at RM7.76 — not at
   RM5.76 with a second charge beside it — because RM7.76 is the number the
   customer says back to us, the number on the printed row, and the number the
   line total is made of.

   The breakdown is NOT thrown away, it stops being a customer-facing charge.
   Every item saved from here carries its bolt component and its accessory
   component separately, so Previous Price can still compare a bolt against a
   bolt and staff can still see what the RM2.00 was for.

   THREE VINTAGES read back, and each is read as it was written:

     accessory-inclusive   finalUnitPrice IS the customer's price; the bolt
                           component is beside it.
     bolt-separate         finalUnitPrice was the BOLT and lineUnitPrice was
                           the customer's line. Migrated on load, so the
                           customer total does not move and re-saving cannot
                           charge the accessories a second time.
     legacy (no model)     one figure with the charge already inside it — which
                           is what this rule now asks for, so it is already
                           right. No separation is invented for it. */
const DC_PRICING_MODEL='accessory-inclusive';
const DC_PRICING_MODEL_SEPARATE='bolt-separate';
function dcItemIsInclusive(item){ return !!item && item.pricingModel===DC_PRICING_MODEL; }
function dcItemIsSeparated(item){ return !!item && item.pricingModel===DC_PRICING_MODEL_SEPARATE; }
/* The accessory total carried inside the parent item's price, per piece. Zero
   for a legacy item — not because it had none, but because what it had cannot
   be told apart from the figure it was folded into. */
function dcItemAccUnit(item){
  return (dcItemIsInclusive(item)||dcItemIsSeparated(item)) ? (Number(item.accessoryUnitPrice)||0) : 0;
}
/* What the customer is charged for one piece, whatever vintage the item is. */
function dcItemFinalUnit(item){
  if(!item) return 0;
  if(dcItemIsSeparated(item)){
    /* Its finalUnitPrice was the bolt; its LINE was the customer's price. */
    const line=Number(item.lineUnitPrice);
    return isFinite(line)&&line>0 ? roundMoney2(line)
         : roundMoney2((Number(item.finalUnitPrice)||0)+(Number(item.accessoryUnitPrice)||0));
  }
  return roundMoney2(Number(item.finalUnitPrice)||0);
}
/* The internal bolt/base component — never shown as the customer's unit price,
   and the figure Previous Price compares and reuses. */
function dcItemBoltUnit(item){
  if(!item) return 0;
  if(dcItemIsSeparated(item)) return roundMoney2(Number(item.finalUnitPrice)||0);
  if(dcItemIsInclusive(item)){
    const bolt=Number(item.boltUnitPrice);
    return isFinite(bolt) ? roundMoney2(bolt)
         : roundMoney2((Number(item.finalUnitPrice)||0)-(Number(item.accessoryUnitPrice)||0));
  }
  /* Legacy: the one figure it has. Its accessory share is not separable, which
     is exactly what dcItemAccUnit already reports by returning zero. */
  return roundMoney2(Number(item.finalUnitPrice)||0);
}
/* One place where a line's money is settled, so the entry form, Quick Add and
   the plate path cannot come to disagree about what a line costs. It is handed
   the CUSTOMER-FACING unit price — resolvePriceMode has already applied the
   price mode's rule, including the manual one — and separates the bolt back
   out of it for the record. */
function dcLineMoney(finalUnitPrice,acc,qty){
  const accUnit=roundMoney2(accAddon(acc));
  const final=roundMoney2(Number(finalUnitPrice)||0);
  const bolt=roundMoney2(final-accUnit);
  const n=parseInt(qty,10)||0;
  return {boltUnitPrice:bolt, accessoryUnitPrice:accUnit,
          finalUnitPrice:final,
          /* Kept, and kept equal: older code and older records read the line
             price from here, and under this rule the two are one number. */
          lineUnitPrice:final,
          accessoryTotal:roundMoney2(accUnit*n),
          totalAmount:roundMoney2(final*n),
          pricingModel:DC_PRICING_MODEL};
}
function accCWLines(acc){
  if(!acc) return [];
  const lines=[], parts=[];
  if(acc.nut&&acc.nut.enabled) parts.push(`${acc.nut.qty||2}nut`);
  if(acc.fw&&acc.fw.enabled) parts.push(`${acc.fw.qty||1}fw`);
  if(parts.length) lines.push('cw '+parts.join(' & '));
  const customText=(acc.custom&&acc.custom.text?String(acc.custom.text).trim():'');
  if(acc.custom&&acc.custom.enabled&&customText&&!isMaterialOptionText(customText)) lines.push('cw '+customText);
  return lines;
}
function accCWLabel(acc){
  return accCWLines(acc).join('\n');
}
function wasCWLabel(acc){
  if(!acc) return '';
  const parts=[];
  if(acc.nut&&acc.nut.enabled) parts.push(`${acc.nut.qty||2}nut`);
  if(acc.fw&&acc.fw.enabled) parts.push(`${acc.fw.qty||1}fw`);
  let line=parts.length?'cw '+parts.join(' & '):'';
  const custom=(acc.custom&&acc.custom.enabled&&acc.custom.text?String(acc.custom.text).trim():'');
  if(custom&&!isMaterialOptionText(custom)) line+=(line?' + ':'cw ')+custom;
  return line;
}
function wasDisplayData(item){
  const raw=String(item&&item.size||'');
  const rawLines=raw.split('\n');
  const abLine=String(item?.wasData?.abLine||item?.dimensionPreview||rawLines[0]||'').trim();
  let compLines=String(item?.wasData?.compLines||rawLines.slice(1).join('\n')||'');
  const fd=item?.formData||{};
  const tpQty=fd.trianglePlateQtyPerSet??fd.tpQty;
  if(Number(tpQty)===0) compLines=compLines.split('\n').filter(line=>!line.includes('Triangle Plate:')).join('\n');
  return {abLine,compLines,size:[abLine,compLines].filter(Boolean).join('\n')};
}
/* ── Customer-facing reference ─────────────────────────────────────────────
   The quotation's identity is its number, always: Q-2026-1349 is what is saved,
   searched, opened and recorded in history. What a CUSTOMER reads also has to
   say which version it is, because most quotations go out as a WhatsApp
   message and the next message for the same quotation must be told apart from
   the last. So every customer-facing output (print, PDF, Copy, WhatsApp) uses

       quotationDisplayRef(number, revision)
         revision 0  → Q-2026-1349          (never "-R0")
         revision 2  → Q-2026-1349-R2

   and nothing else builds the suffix. The revision is the server's: the
   quotation_revisions history, read back through get_quotation_history. Its
   first row is the create (the original, revision 0), so the customer-facing
   revision is the latest revision_no minus one — or every recorded row, for a
   quotation saved before history existed, whose first row is an update. */
function quotationDisplayRef(number,revision){
  const n=String(number==null?'':number).trim();
  const r=parseInt(revision,10)||0;
  return n && r>0 ? n+'-R'+r : n;
}
/* ── WhatsApp Message Template ── */
const WA_DEFAULT_TPL=`Hi {customer},\nQuotation {quotationNo} is ready.\nDate: {date}\n\nItems:\n{items}\n\nTotal: RM{total}\n\nPrepared by: {preparedBy}\nThank you.`;
function sanitizeWATemplate(template){
  return String(template||'')
    .replace(/^[^\r\n]*\{validUntil\}[^\r\n]*(?:\r?\n|$)/gmi,'')
    .replace(/{validUntil}/gi,'')
    .replace(/\n{3,}/g,'\n\n');
}
function fmtWAUnitPrice(value){
  return 'RM'+(parseFloat(value)||0).toFixed(2);
}
function getWAGroupTitle(item){
  const itemType=item.itemType||'';
  if(itemType==='plate'){
    const plateType=item.plateType||item.formData?.plateType||'ms_plate';
    const desc=plateType==='triangle_plate'?'TRIANGLE PLATE':'MS PLATE';
    const finish=(item.finish||'').trim();
    return finish?`${desc} (${finish})`:desc;
  }
  if(itemType==='was'){
    const finish=(item.finish||'').trim();
    /* Title follows the selected Anchor Bolt material. WAS items saved before
       this change stored material:'MS', so they still read "MS WELDING ANCHOR SET". */
    const title=materialLabel(item.material||'MS')+' WELDING ANCHOR SET';
    return finish?`${title} (${finish})`:title;
  }
  const material=materialLabel(item.material).trim();
  const product=(item.productType||ITEM_TYPES[itemType]||'').trim();
  const sizeType=itemType==='stud' ? '' : (item.sizeType||'').trim();
  const finish=(item.finish||'').trim();
  let title=[material,sizeType,product].filter(Boolean).join(' ');
  if(!title) title=(item.desc||'Item').replace(/\s+\([^)]*\)\s*$/,'').trim();
  return finish ? `${title} (${finish})` : title;
}
/* The size box shows what the customer will read: 1-1/8", 3/8", 1" — the inch
   mark on, never twice. What it SAYS is still the canonical size: every reader
   of the box goes through normalizeSizeValue, which takes the mark off a
   fraction again, so diameters, Diameter Settings, default prices and previous
   prices are looked up exactly as before. Anything that is not an inch size
   (M12, free text) is left as it is. */
function dcSizeBoxText(value){
  const n=normalizeSizeValue(value);
  return (/^\d+(?:-\d+)?\/\d+$/.test(n) || /^\d+"$/.test(n)) ? sizeDisplay(n) : value;
}
function dcCanonicalFormSize(v){ return String(v==null?'':v).replace(/^(\s*\d+(?:-\d+)?\/\d+)\s*"\s*$/,'$1'); }
/* What the entry form is handed: the same object, with a Custom's own count
   written into its wording ("4 Spring Washer") — the form has one Custom line
   and one per-item charge, and nothing about how it is priced changes. */
function wqaAccForForm(a){
  if(!a) return a;
  const c=wqaCloneAcc(a);
  const q=parseFloat(c.custom&&c.custom.qty);
  if(c.custom && c.custom.enabled && q>0 && !/^\s*\d/.test(c.custom.text||'')) c.custom.text=q+' '+String(c.custom.text||'').trim();
  return c;
}
/* Deep clone — Apply to All is a ONE-TIME COPY. Every row must own its object
   so editing one item can never reach into another. */
function wqaCloneAcc(a){ return a?JSON.parse(JSON.stringify(a)):null; }

/* ════════════════════════════════════════════════════════════════════════════
   FORM-FREE BUILDERS
   What index.php's add functions, pushItem, captureItemFormData, buildDesc,
   buildWAItemsText and buildQuoteText did with the form, written against
   plain data. Same steps, same order, same refusals; where the form read a
   box, these read the same value out of `fields`.
   ════════════════════════════════════════════════════════════════════════════ */

/* Every field captureItemFormData looks for, in the order it records them. */
const QUO_FORM_CAPTURE_FIELDS=['material','sizeType','size','diameter','length','threadLen','l','id','ih','oh','w','h','s','productName','dimensionText','weightMode','unitWeight','costRate','addCost','markup','qty','priceMode','manualUnitPrice',
  'plateType','t','hd','nh',
  'tri-l','tri-h','tri-cl','tri-ch','tri-t'];
/* The boxes each bolt product's entry form has (read off the page; the parity
   suite checks the page still has exactly these). A host builds `fields` with
   these keys; a key the form does not have must not be sent. */
const QUO_ITEM_FORM_FIELDS={
  sagrod:['material','sizeType','size','diameter','length','threadLen','costRate','addCost','markup','qty','priceMode','manualUnitPrice'],
  stud:['material','size','diameter','l','costRate','addCost','markup','qty','priceMode','manualUnitPrice'],
  anchorbolt:['material','sizeType','size','diameter','threadLen','l','costRate','addCost','markup','qty','priceMode','manualUnitPrice'],
  ubolt:['material','sizeType','size','diameter','length','threadLen','id','ih','costRate','addCost','markup','qty','priceMode','manualUnitPrice'],
  squbolt:['material','sizeType','size','diameter','length','threadLen','oh','w','costRate','addCost','markup','qty','priceMode','manualUnitPrice'],
  lbolt:['material','sizeType','size','diameter','length','threadLen','l','w','costRate','addCost','markup','qty','priceMode','manualUnitPrice'],
  lbolt45:['material','sizeType','size','diameter','length','threadLen','l','w','costRate','addCost','markup','qty','priceMode','manualUnitPrice'],
  jbolt:['material','sizeType','size','diameter','length','threadLen','id','h','s','costRate','addCost','markup','qty','priceMode','manualUnitPrice'],
};
/* Products whose rate-blank refusal is the sentence ending in a full stop. */
const QUO_RATE_ONLY_PRODUCTS=['sagrod','stud','anchorbolt'];

function quoHas(o,k){ return !!o && Object.prototype.hasOwnProperty.call(o,k); }
/* An accessory set nobody touched, exactly as pushItem writes it. */
function quoNoAccessories(){
  return {nut:{enabled:false,qty:2,finish:'',unitPrice:0},fw:{enabled:false,qty:1,finish:'',unitPrice:0},custom:{enabled:false,text:'',unitPrice:0}};
}

/* buildDesc, without the form. */
function quoItemDesc(type,material,sizeType,productName){
  const mat=materialLabel(material||'');
  if(type==='others') return [mat,sizeType||'',String(productName||'').trim()].filter(Boolean).join(' ');
  if(type==='stud') return mat+' '+ITEM_TYPES[type];
  return mat+' '+(sizeType||'')+' '+ITEM_TYPES[type];
}

/* captureItemFormData, without the form. `fields` holds the boxes the form
   has (and only those), as text; `finish` is the checked finish radio,
   `accessories` the accessory panel, `priceData` getPriceModeSaveData's. */
function quoItemFormData(type,fields,finish,accessories,priceData){
  const F=fields||{};
  const fv=f=>(quoHas(F,f)&&F[f]!=null)?String(F[f]):'';
  const data={itemType:type,productType:ITEM_TYPES[type]||type,finish:finish,accessories:accessories};
  QUO_FORM_CAPTURE_FIELDS.forEach(field=>{
    if(quoHas(F,field)) data[field]=field==='size' ? dcCanonicalFormSize(F[field]) : F[field];
  });
  if(quoHas(F,'length')) data.totalLength=F.length;
  data.dimensions={
    diameter:fv('diameter'),
    length:fv('length'),
    l:fv('l'),
    id:fv('id'),
    ih:fv('ih'),
    oh:fv('oh'),
    w:fv('w'),
    h:fv('h'),
    s:fv('s'),
    threadLen:fv('threadLen'),
    totalLength:quoHas(F,'length') ? F.length : ''
  };
  Object.assign(data,priceData);
  return data;
}

/* The acceptance a host with no entry form states for itself (the page uses
   its own, dcPaCommit, passed in as a function). Forms accepted:
     {meta, keep}            already decided (an edit of a saved item);
     {grant:{v,src,ref}}     a priced Quick Add row (wqaRowPa);
     {source, historyRef}    the price the setup in `fields` calculates to.
   `at` (ISO text), when given, replaces the moment of acceptance. */
function quoAcceptPlain(a,type,final,ctx){
  a=a||{};
  if(a.meta) return {meta:a.meta, keep:a.keep||undefined};
  final=roundMoney2(final);
  const same=v=>Math.abs(roundMoney2(v)-final)<0.005;
  let meta;
  if(a.grant){
    if(!same(a.grant.v)) return {refuse:'price_changed'};
    meta=dcPaMeta(a.grant.src,a.grant.ref,final);
  } else {
    /* dcFormPaState: a usable price from a setup that can price. */
    const priced=Number(ctx.final)>0 && (ctx.mode==='manual' ? isReadableAmount(ctx.manualRaw) : Number(ctx.weight)>0);
    const setup=ctx.mode==='manual' ? priced : evalExpr(String(ctx.costRateRaw||'').trim()||'0')>0;
    if(!(priced && setup)) return {refuse:'price_not_accepted'};
    meta=dcPaMeta(a.source||(ctx.mode==='manual'?'manual':'manual_recipe'),a.historyRef||'',final);
  }
  if(typeof a.at==='string' && a.at) meta.at=a.at;
  return {meta};
}

/* ── quoBuildItem ────────────────────────────────────────────────────────
   The item Add to Quotation puts into the quotation, for one bolt product.

   input = {
     type,              'sagrod' | 'stud' | 'anchorbolt' | 'ubolt' | 'squbolt' |
                        'lbolt' | 'lbolt45' | 'jbolt'
     fields,            the form's boxes as text, keys from QUO_ITEM_FORM_FIELDS[type]:
                        material, sizeType, size, diameter, length (Total Length on
                        U / SQ U / L / J; the rod length on Sag Rod), threadLen, l, w,
                        h, id, ih, oh, s, costRate, addCost, markup, qty, priceMode,
                        manualUnitPrice
     finish,            the finish radio ('PL' | 'ZP' | 'HDG' | ''), default 'PL'
     accessories,       {nut:{enabled,qty,finish,unitPrice}, fw:{...}, custom:{enabled,text,unitPrice}}
     totalLengthSrc,    U Bolt only: 'auto' when Total Length is the formula's own
     customDimensions,  [{label,value}]           (default none)
     threadRef,         normalised thread reference (default '')
     rateRequired,      default: true unless Manual Price
     locked,            a saved quotation not unlocked for editing
     acceptance,        see quoAcceptPlain, or a function(type,final) -> {meta,keep}|null
     stateWeight,       the page's last preview weight (page only)
     hooks: { priceResolved(state) }   (page only)
   }
   returns {ok:true, item, state, keep} or {ok:false, code, field[, more]}.
   Refusal codes, in the order the form asks: size_missing, diameter_missing,
   length_missing, l_missing, lw_missing, hids_missing, ohw_missing,
   id_ih_negative, ubolt_geometry_incomplete, total_length_missing,
   dim_not_positive, rate_blank, add_cost_blank, manual_price_invalid,
   rate_negative, rate_unreadable, qty_not_whole, qty_min, qty_too_large,
   locked, final_qty_invalid, unit_negative, line_negative,
   price_not_accepted, price_changed, unsupported_type.                   */
function quoBuildItem(input){
  const inp=input||{};
  const t=String(inp.type||'');
  if(!quoHas(QUO_ITEM_FORM_FIELDS,t)) return {ok:false,code:'unsupported_type',field:'type'};
  const F=inp.fields||{};
  const fv=f=>(quoHas(F,f)&&F[f]!=null)?String(F[f]):'';
  const fn=f=>parseFloat(fv(f))||0;
  const no=(code,field,more)=>{ const r={ok:false,code:code,field:field||''}; if(more&&more.length) r.more=more; return r; };
  const mode=['auto','no_round','manual'].includes(fv('priceMode')) ? fv('priceMode') : 'auto';
  const rateRequired=inp.rateRequired===undefined ? mode!=='manual' : !!inp.rateRequired;
  /* validateDims */
  const dims=d=>{ for(const label in d){ const n=parseFloat(d[label]); if(!isFinite(n)||n<=0) return no('dim_not_positive',label); } return null; };
  /* validatePriceMode */
  const pm=()=>{
    if(mode!=='manual') return null;
    const value=fv('manualUnitPrice').trim();
    if(!value||!isReadableAmount(value)) return no('manual_price_invalid','manualUnitPrice');
    if(evalExpr(value)<0) return no('manual_price_invalid','manualUnitPrice');
    return null;
  };
  /* The two validateRateEntry calls: both are asked, as the form asks both. */
  const rates=()=>{
    const probs=[], val={};
    [['costRate','Cost Rate'],['addCost','Additional Cost']].forEach(([f,label])=>{
      const raw=(fv(f)||'').trim();
      if(raw===''){ val[f]=0; return; }
      const problem=dcRateEntryProblem(raw);
      if(problem==='negative'){ probs.push({code:'rate_negative',field:label}); return; }
      if(problem==='unreadable'){ probs.push({code:'rate_unreadable',field:label}); return; }
      val[f]=evalExpr(raw);
    });
    if(probs.length) return {refuse:no(probs[0].code,probs[0].field,probs.slice(1))};
    return {costRate:val.costRate,addCost:val.addCost};
  };
  /* validateQtyEntry */
  const qtyEntry=()=>{
    const raw=(fv('qty')||'').trim();
    if(!/^\d+$/.test(raw)) return {refuse:no('qty_not_whole','qty')};
    const q=parseInt(raw,10);
    if(q<1) return {refuse:no('qty_min','qty')};
    if(q>1000000) return {refuse:no('qty_too_large','qty')};
    return {qty:q};
  };
  const rateBlank=both=>{
    if(rateRequired && !fv('costRate').trim()) return no('rate_blank','costRate');
    if(both && rateRequired && !fv('addCost').trim()) return no('add_cost_blank','addCost');
    return null;
  };
  let r, size, d, weight, raw, sizeStr, sizeCode, sizeTypeArg, markup, qty, costRate, addCost;
  const priceUp=(dia,len)=>{
    const rt=rates(); if(rt.refuse) return rt.refuse;
    costRate=rt.costRate; addCost=rt.addCost;
    markup=fn('markup');
    const q=qtyEntry(); if(q.refuse) return q.refuse;
    qty=q.qty;
    weight=dcBarWeight(dia,len);
    raw=dcRawPrice(dcBasePrice(weight,costRate,addCost),markup);
    return null;
  };
  if(t==='sagrod'){
    size=normalizeSizeValue(fv('size'));
    const diameter=fn('diameter'), length=fn('length');
    const threadLen=fv('threadLen').trim();
    if(!size) return no('size_missing','size');
    if(!diameter) return no('diameter_missing','diameter');
    if(!length) return no('length_missing','length');
    if((r=dims({'Diameter':diameter,'Length':length}))) return r;
    if((r=rateBlank(false))) return r;
    if((r=pm())) return r;
    if((r=priceUp(diameter,length))) return r;
    sizeStr=formatSizeLabel(size,diameter,fv('sizeType'))+' x L '+cleanNum(length)+(threadLen?' x TL '+withMm(threadLen):'');
    sizeCode=size; sizeTypeArg=fv('sizeType');
  } else if(t==='stud'){
    size=normalizeSizeValue(fv('size'));
    const diameter=fn('diameter'), length=fn('l');
    if(!size) return no('size_missing','size');
    if(!diameter) return no('diameter_missing','diameter');
    if(!length) return no('l_missing','l');
    if((r=dims({'Diameter':diameter,'L':length}))) return r;
    if((r=rateBlank(false))) return r;
    if((r=pm())) return r;
    if((r=priceUp(diameter,length))) return r;
    sizeStr=sizeDisplay(size)+' x L '+cleanNum(length)+'mm';
    sizeCode=size; sizeTypeArg='';
  } else if(t==='anchorbolt'){
    size=normalizeSizeValue(fv('size'));
    const diameter=fn('diameter'), length=fn('l');
    const threadLen=fv('threadLen').trim();
    if(!size) return no('size_missing','size');
    if(!diameter) return no('diameter_missing','diameter');
    if(!length) return no('l_missing','l');
    if((r=dims({'Diameter':diameter,'L':length}))) return r;
    if((r=rateBlank(false))) return r;
    if((r=pm())) return r;
    if((r=priceUp(diameter,length))) return r;
    sizeStr=formatSizeLabel(size,diameter,fv('sizeType'))+' x L '+cleanNum(length)+(threadLen?' x TL '+withMm(threadLen):'');
    sizeCode=size; sizeTypeArg=fv('sizeType');
  } else if(t==='ubolt'){
    size=normalizeSizeValue(fv('size')); d=fn('diameter');
    const id=fv('id'), ih=fv('ih'), tl=fv('threadLen');
    if(!size) return no('size_missing','size');
    if(!d) return no('diameter_missing','diameter');
    const totalLen=Math.ceil(parseFloat(fv('length'))||0);
    if((id&&parseFloat(id)<0)||(ih&&parseFloat(ih)<0)) return no('id_ih_negative','id');
    const ubMiss=[!(parseFloat(id)>0)?'ID':'',!(parseFloat(ih)>0)?'IH':''].filter(Boolean);
    if(ubMiss.length && (!totalLen || inp.totalLengthSrc==='auto')) return no('ubolt_geometry_incomplete',ubMiss.join(' / '));
    if(!totalLen) return no('total_length_missing','length');
    if((r=dims({'Diameter':d,'Total Length':totalLen}))) return r;
    if((r=rateBlank(true))) return r;
    if((r=pm())) return r;
    if((r=priceUp(d,totalLen))) return r;
    sizeStr=formatSizeLabel(size,d,fv('sizeType'))+(id?' x ID '+cleanNum(id):'')+(ih?' x IH '+cleanNum(ih):'')+(tl?' x TL '+withMm(tl):'');
    sizeCode=size; sizeTypeArg=fv('sizeType');
  } else if(t==='squbolt'){
    size=normalizeSizeValue(fv('size')); d=fn('diameter');
    const oh=fv('oh'), w=fv('w'), tl=fv('threadLen');
    if(!size) return no('size_missing','size');
    if(!d) return no('diameter_missing','diameter');
    if(!oh||!w) return no('ohw_missing',!oh?'oh':'w');
    const totalLen=Math.ceil(parseFloat(fv('length'))||0);
    if(!totalLen) return no('total_length_missing','length');
    if((r=dims({'Diameter':d,'OH':oh,'W':w,'Total Length':totalLen}))) return r;
    if((r=rateBlank(true))) return r;
    if((r=pm())) return r;
    if((r=priceUp(d,totalLen))) return r;
    sizeStr=formatSizeLabel(size,d,fv('sizeType'))+' x OH '+cleanNum(oh)+' x W '+cleanNum(w)+(tl?' x TL '+withMm(tl):'');
    sizeCode=size; sizeTypeArg=fv('sizeType');
  } else if(t==='lbolt'||t==='lbolt45'){
    size=normalizeSizeValue(fv('size')); d=fn('diameter');
    const l=fv('l'), w=fv('w'), tl=fv('threadLen');
    if(!size) return no('size_missing','size');
    if(!l||!w) return no('lw_missing',!l?'l':'w');
    if(!d) return no('diameter_missing','diameter');
    if((r=rateBlank(true))) return r;
    if((r=pm())) return r;
    const totalLen=Math.ceil(parseFloat(fv('length'))||0);
    if(!totalLen) return no('total_length_missing','length');
    if((r=dims({'Diameter':d,'L':l,'W':w,'Total Length':totalLen}))) return r;
    if((r=priceUp(d,totalLen))) return r;
    sizeStr=formatSizeLabel(size,d,fv('sizeType'))+' x L '+cleanNum(l)+' x W '+cleanNum(w)+(tl?' x TL '+withMm(tl):'')+(t==='lbolt45'?' 45deg':'');
    sizeCode=size; sizeTypeArg=fv('sizeType');
  } else {
    size=normalizeSizeValue(fv('size')); d=fn('diameter');
    const h=fv('h'), id=fv('id'), s=fv('s'), tl=fv('threadLen');
    if(!size) return no('size_missing','size');
    if(!d) return no('diameter_missing','diameter');
    if(!h||!id||!s) return no('hids_missing',!h?'h':!id?'id':'s');
    if((r=rateBlank(true))) return r;
    if((r=pm())) return r;
    const totalLen=Math.ceil(parseFloat(fv('length'))||0);
    if(!totalLen) return no('total_length_missing','length');
    if((r=dims({'Diameter':d,'H':h,'ID':id,'S':s,'Total Length':totalLen}))) return r;
    if((r=priceUp(d,totalLen))) return r;
    sizeStr=formatSizeLabel(size,d,fv('sizeType'))+' x H '+cleanNum(h)+' x ID '+cleanNum(id)+' x S '+cleanNum(s)+(tl?' x TL '+withMm(tl):'');
    sizeCode=size; sizeTypeArg=fv('sizeType');
  }
  /* resolvePriceMode */
  const acc=inp.accessories||quoNoAccessories();
  const manualRaw=fv('manualUnitPrice').trim();
  const state=dcResolvePrice(t,mode,manualRaw,raw,accAddon(acc),inp.stateWeight);
  if(inp.hooks && typeof inp.hooks.priceResolved==='function') inp.hooks.priceResolved(state);
  let finalUnitPrice=state.finalUnitPrice, totalAmount=finalUnitPrice*qty;
  /* pushItem */
  if(inp.locked) return no('locked','');
  const material=fv('material');
  const formFinish=inp.finish==null ? 'PL' : String(inp.finish);
  const finish=dcFinishFor(material,formFinish);
  const money=dcLineMoney(finalUnitPrice,acc,qty);
  finalUnitPrice=money.finalUnitPrice; totalAmount=money.totalAmount;
  /* validateFinalItem */
  if(!Number.isInteger(qty)||qty<1) return no('final_qty_invalid','qty');
  if(!isFinite(finalUnitPrice)||finalUnitPrice<0) return no('unit_negative','price');
  if(!isFinite(totalAmount)||totalAmount<0) return no('line_negative','price');
  let pa;
  if(typeof inp.acceptance==='function'){
    pa=inp.acceptance(t,finalUnitPrice);
    if(!pa) return Object.assign(no('price_not_accepted','price'),{reported:true});
  } else {
    pa=quoAcceptPlain(inp.acceptance,t,finalUnitPrice,{mode,manualRaw,final:state.finalUnitPrice,weight,costRateRaw:fv('costRate')});
    if(pa.refuse) return no(pa.refuse,'price');
  }
  const productType=ITEM_TYPES[t]||t;
  const priceData={
    priceMode:mode,manualUnitPrice:fv('manualUnitPrice'),
    rawUnitPrice:state.rawUnitPrice??0,roundedUnitPrice:state.roundedUnitPrice??0,
    autoFinalUnitPrice:state.autoFinalUnitPrice??0,autoRoundStage:DC_AUTO_ROUND_STAGE
  };
  const sizeType=sizeTypeArg||fv('sizeType');
  const item={itemType:t,desc:quoItemDesc(t,material,fv('sizeType'),fv('productName')),finish,size:sizeStr,qty,markup,material,
    sizeCode:sizeCode||'',sizeType,productType,cleanSize:sizeCode||'',
    dimensionPreview:sizeStr.includes(' x ')?sizeStr.substring(sizeStr.indexOf(' x ')+3):'',
    accessories:acc,weight:weight||0,customDimensions:dcNormalizeCustomDims(inp.customDimensions),
    threadRef:inp.threadRef==null?'':inp.threadRef,
    formData:quoItemFormData(t,F,formFinish,JSON.parse(JSON.stringify(acc)),Object.assign({},priceData)),
    ...priceData,...money,priceAcceptance:pa.meta};
  if(pa.keep) dcPaKeepSaved(item,pa.keep);
  return {ok:true,item,state,keep:!!pa.keep};
}

/* ── A Quick Add review row, as builder input ──────────────────────────────
   What wqaApplyRowToForm writes into the entry form for a row, written as
   `fields` instead. The pricing setup is the one the review screen priced the
   row with (row.calc: Cost Rate, Additional Cost and Markup as the form held
   them, Default Price rules and the thread-length surcharge included), so the
   row must have been priced first. Quick Add reads five products: Sag Rod,
   Stud, Anchor Bolt, L Bolt, J Bolt.
   Returns {ok:true, input} or {ok:false, code, field}: row_conflict,
   row_missing (field = the missing names joined by ' / '), qty_missing,
   price_not_accepted, unsupported_type. */
function quoItemInputFromRow(row,common){
  const r=row||{}, c=common||{};
  const t=wqaRowProduct(r);
  if(!quoHas(QUO_ITEM_FORM_FIELDS,t)) return {ok:false,code:'unsupported_type',field:'type'};
  if(r.productConflict) return {ok:false,code:'row_conflict',field:'product'};
  const miss=wqaRowMissing(r);
  if(miss.length) return {ok:false,code:'row_missing',field:miss.join(' / ')};
  if(!(parseInt(r.qty,10)>0)) return {ok:false,code:'qty_missing',field:'qty'};
  const pa=wqaRowPa(r);
  if(pa.state!=='accepted') return {ok:false,code:'price_not_accepted',field:'price'};
  const has=f=>QUO_ITEM_FORM_FIELDS[t].indexOf(f)>=0;
  const F={};
  QUO_ITEM_FORM_FIELDS[t].forEach(f=>{ F[f]=''; });
  const mat=wqaRowSpec(r,'material')||c.material||'MS';
  F.material=mat;
  let st='';
  if(has('sizeType')){ st=dcSizeTypeFor(t,wqaRowSpec(r,'sizeType')||c.sizeType); F.sizeType=st; }
  const size=normalizeSizeValue(r.size);
  F.size=dcSizeBoxText(size);
  const asks=has('sizeType') && dcProductHasSizeType(t);
  const dia=(asks && !String(st||'').trim()) ? '' : dcEffectiveDiameter(t,mat,st,size);
  F.diameter=(dia!==''&&dia!=null?String(dia):'');
  const map=(wqaProductByType(t)||WQA_NO_PRODUCT).map||{};
  Object.keys(map).forEach(k=>{ if(has(map[k])) F[map[k]]=String(r[k]==null?'':r[k]); });
  if(has('threadLen')) F.threadLen=String(wqaThreadValue(r));
  F.qty=String(r.qty||'');
  if(r.diaManual && parseFloat(String(r.diaMm||'').trim()) > 0) F.diameter=String(r.diaMm).trim();
  const calc=r.calc||{};
  F.costRate=String(calc.costRate==null?'':calc.costRate);
  F.addCost=String(calc.addCost==null?'':calc.addCost);
  F.markup=String(calc.markup==null?'':calc.markup);
  const rowMode=r.priceMode||'auto';
  F.priceMode=rowMode;
  F.manualUnitPrice=rowMode==='manual'?String(r.manualPrice||''):'';
  /* The L and J calculators write their own Total Length. */
  const n=k=>parseFloat(F[k])||0, d=n('diameter');
  if(t==='lbolt' && (n('l')>0||n('w')>0||d>0)){ const a=dcLBoltTotalLength(d,n('l'),n('w')); F.length=a>0?String(a):''; }
  if(t==='jbolt' && (d>0||n('h')>0||n('id')>0||n('s')>0)){ const a=dcJBoltTotalLength(d,n('h'),n('id'),n('s')); F.length=a>0?String(a):''; }
  /* The accessory panel, as loadAccIntoForm writes it and getAccessories reads it back. */
  const fa=r.acc ? wqaAccForForm(r.acc) : null;
  const num=(v,dflt)=>parseFloat(String(v===undefined||v===null?'':v)||dflt)||dflt;
  const accessories=fa ? {
    nut:{enabled:!!(fa.nut&&fa.nut.enabled),qty:num(fa.nut?(fa.nut.qty||2):2,2),finish:fa.nut?(fa.nut.finish||''):'',unitPrice:num(fa.nut?(fa.nut.unitPrice||0):0,0)},
    fw:{enabled:!!(fa.fw&&fa.fw.enabled),qty:num(fa.fw?(fa.fw.qty||1):1,1),finish:fa.fw?(fa.fw.finish||''):'',unitPrice:num(fa.fw?(fa.fw.unitPrice||0):0,0)},
    custom:{enabled:!!(fa.custom&&fa.custom.enabled),text:String(fa.custom?(fa.custom.text||''):'').trim(),unitPrice:num(fa.custom?(fa.custom.unitPrice||0):0,0)}
  } : quoNoAccessories();
  const finish=!dcMaterialHasFinish(mat) ? '' : (dcFinishFor(mat,wqaRowSpec(r,'finish')||'')||'PL');
  return {ok:true,input:{type:t,fields:F,finish,accessories,customDimensions:[],threadRef:dcNormThreadRef(r.threadRef),
                         acceptance:{grant:{v:pa.v,src:pa.src,ref:pa.ref}}}};
}
function quoBuildItemFromRow(row,common,opts){
  const o=quoItemInputFromRow(row,common);
  if(!o.ok) return o;
  if(opts && typeof opts.at==='string') o.input.acceptance.at=opts.at;
  return quoBuildItem(o.input);
}

/* ── WhatsApp ───────────────────────────────────────────────────────────── */
/* dcCustomDimsLine, with the prefix handed in (the page hands the UI
   language's own; a host with no language gives nothing and gets English). */
function quoCustomDimsLine(item,prefix){
  const t=dcCustomDimsText(item&&item.customDimensions);
  return t ? (prefix==null?'Custom:':prefix)+' '+t : '';
}
/* dcFillRefPlaceholders, with the revision and its heading handed in. */
function quoFillRefPlaceholders(tpl,refno,revision,revisedLabel){
  const rev=parseInt(revision,10)||0, ref=quotationDisplayRef(refno,rev);
  let out=String(tpl);
  if(rev>0) out=out.replace(/^([ \t]*)\{(quotationNo|no)\}[ \t]*$/gm,(m,ind)=>ind+(revisedLabel==null?'REVISED QUOTATION':revisedLabel)+'\n'+ind+ref);
  return out.replace(/{quotationNo}/g,ref).replace(/{no}/g,ref);
}
/* buildWAItemsText, over a list of stored items.
   opts = {emptyText='-', mergeIdentical=true, includeUnitWeight=false, customPrefix='Custom:'} */
function quoWAItemsText(items,opts){
  const o=opts||{};
  const emptyText=o.emptyText===undefined?'-':o.emptyText;
  const mergeIdentical=o.mergeIdentical===undefined?true:!!o.mergeIdentical;
  const includeUnitWeight=!!o.includeUnitWeight;
  const list=items||[];
  if(!list.length) return emptyText;
  const groups=[];
  const groupIndex=new Map();
  list.forEach((item,itemIndex)=>{
    const title=getWAGroupTitle(item);
    /* Copy mode (mergeIdentical=false) keeps the quotation's global order: a
       new heading block starts whenever the title differs from the PREVIOUS
       item's, so the same heading may legitimately repeat. */
    const lastGroup=groups[groups.length-1];
    const needNew=mergeIdentical ? !groupIndex.has(title) : !(lastGroup && lastGroup.title===title);
    if(needNew){
      groupIndex.set(title,groups.length);
      groups.push({title,rows:[],seen:new Map(),cwLabels:[]});
    }
    const group=mergeIdentical ? groups[groupIndex.get(title)] : groups[groups.length-1];
    // WAS: use abLine as size key; component lines appended after price line
    const wasItem=item.itemType==='was';
    const wasDisplay=wasItem?wasDisplayData(item):null;
    const size=wasItem?wasDisplay.abLine:dcSizeLabelDisplay((item.size||'').trim());
    /* ONE price reaches the customer, and the accessories are inside it. The
       message quotes M12 x L 1000 x TL 100/100mm at RM7.76 and then says
       "cw 2nut" — a description of what is included, with no second RM figure
       to add up, query or be charged twice for. */
    const price=fmtWAUnitPrice(wasItem?item.finalUnitPrice:dcItemFinalUnit(item));
    const cw=wasItem?wasCWLabel(item.accessories||null):accCWLabel(item.accessories||null);
    const wasComp=wasItem?wasDisplay.compLines:'';
    /* Two items are the same LINE only when everything the line shows is the
       same. The custom dimensions are part of what the line shows — the print
       sheet gives them a line of their own — so leaving them out of the key
       made an M20 x L1000 annotated "H2 530" a duplicate of the identical rod
       annotated "H2 700", and the second one vanished from the customer's
       message while the total still counted it. */
    const custom=quoCustomDimsLine(item,o.customPrefix)||'';
    const key=size+'|'+wasComp+'|'+price+'|'+cw+'|'+custom;
    /* ── The number the customer quotes back at us ─────────────────────────
       The message groups by material and finish, so its rows come out in a
       different order from the screen and the print sheet, which number by
       position in the quotation. A customer saying "increase item 2" and the
       member of staff looking at item 2 were talking about different products.

       So a row carries the quotation item's OWN number, not its position in
       the message. Where two identical items merge into one line — same size,
       same price, same accessories, same annotation, so there is nothing to
       tell them apart on the page — the line carries BOTH numbers rather than
       silently dropping one: "1, 4." is traceable, and a gap in the numbering
       is not. */
    if(mergeIdentical && group.seen.has(key)){
      const existing=group.rows[group.seen.get(key)];
      if(existing) existing.nos.push(itemIndex+1);
      return;
    }
    group.seen.set(key,group.rows.length);
    /* Copy + Weight only: the stored PER-PIECE weight (item.weight — the same value the
       list card multiplies by qty for its item total). Never qty-multiplied; omitted when
       there is no calculated weight rather than shown as a fake 0.000kg/pc. */
    const uw=(includeUnitWeight&&!wasItem&&parseFloat(item.weight)>0)?(parseFloat(item.weight).toFixed(3)+'kg/pc'):'';
    group.rows.push({size,price,cw,wasComp,wasItem,custom,uw,nos:[itemIndex+1]});
    group.cwLabels.push(cw);
  });
  return groups.map(group=>{
    const cwSet=new Set(group.cwLabels.filter(Boolean));
    const allRowsHaveSameCw=group.rows.length>0 && group.rows.every(row=>row.cw) && cwSet.size===1;
    const rows=group.rows.map(row=>{
      const no=row.nos.join(', ');
      if(row.wasItem){
        const compPart=row.wasComp?'\n'+row.wasComp:'';
        const cwPart=row.cw?'\n   '+row.cw:'';
        return `${no}) ${row.size}${compPart}${cwPart}\n   - ${row.price}/set`;
      }
      const line=`${no}) ${row.size}${row.uw?' - '+row.uw:''} - ${row.price}`;
      /* The print sheet carries the annotation on its own line; without it here
         two rods that differ only by it read as the same rod written twice. */
      const customPart=row.custom?'\n   '+row.custom:'';
      const cwPart=(!allRowsHaveSameCw&&row.cw)?'\n'+row.cw:'';
      return line+customPart+cwPart;
    }).join('\n');
    // Determine if all items in group share same c/w
    const hasWAS=group.rows.some(row=>row.wasItem);
    const cwSuffix=allRowsHaveSameCw&&!hasWAS ? '\n'+[...cwSet][0] : '';
    if(false){
      // All same — append once after group
      cwSuffix='\n'+[...cwSet][0];
    } else if(false){
      // Different — append per row
      return `${group.title}\n${rows}${cwSuffix}`;
    }
    return `${group.title}\n${rows}${cwSuffix}`;
  }).join('\n\n');
}
/* buildQuoteText: the text Copy WhatsApp (and Copy + Weight) puts on the
   clipboard. One line per item, never merged.
   q = { items,                      the quotation's items, as stored
         header: {customer, refno, date, prepby},
         template,                   the saved template body; empty -> the default
         revision,                   0 for the original quotation
         includeUnitWeight,
         labels: {customPrefix, revisedQuotation}   (default English) } */
function quoQuoteText(q){
  const o=q||{}, items=o.items||[], qi=o.header||{}, labels=o.labels||{};
  const grand=items.reduce((s,i)=>s+i.totalAmount,0);
  const itemLines=quoWAItemsText(items,{emptyText:'-',mergeIdentical:false,includeUnitWeight:!!o.includeUnitWeight,customPrefix:labels.customPrefix});
  const tpl=sanitizeWATemplate(o.template || WA_DEFAULT_TPL);
  return quoFillRefPlaceholders(tpl, qi.refno||'-', o.revision, labels.revisedQuotation)
    .replace(/{customer}/g, qi.customer||'-')
    .replace(/{date}/g, qi.date||'-')
    .replace(/{total}/g, grand.toFixed(2))
    .replace(/{items}/g, itemLines||'-')
    .replace(/{preparedBy}/g, qi.prepby||'-');
}

/* ════════════════════════════════════════════════════════════════════════════
   VERSION
   ════════════════════════════════════════════════════════════════════════════ */
const QUO_QUOTE_CORE_VERSION='1.0.0';
const QUO_QUOTE_CORE_CONTRACT=1;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    QUO_QUOTE_CORE_VERSION: QUO_QUOTE_CORE_VERSION,
    QUO_QUOTE_CORE_CONTRACT: QUO_QUOTE_CORE_CONTRACT,
    quoBuildItem: quoBuildItem,
    quoBuildItemFromRow: quoBuildItemFromRow,
    quoItemInputFromRow: quoItemInputFromRow,
    quoItemFormData: quoItemFormData,
    quoItemDesc: quoItemDesc,
    quoNoAccessories: quoNoAccessories,
    quoWAItemsText: quoWAItemsText,
    quoQuoteText: quoQuoteText,
    quoFillRefPlaceholders: quoFillRefPlaceholders,
    quoCustomDimsLine: quoCustomDimsLine,
    QUO_ITEM_FORM_FIELDS: QUO_ITEM_FORM_FIELDS,
    QUO_FORM_CAPTURE_FIELDS: QUO_FORM_CAPTURE_FIELDS,
    QUO_RATE_ONLY_PRODUCTS: QUO_RATE_ONLY_PRODUCTS,
    ITEM_TYPES: ITEM_TYPES,
    DC_PRICE_SOURCES: DC_PRICE_SOURCES,
    DC_PRICING_MODEL: DC_PRICING_MODEL,
    WA_DEFAULT_TPL: WA_DEFAULT_TPL,
    sanitizeWATemplate: sanitizeWATemplate,
    fmtWAUnitPrice: fmtWAUnitPrice,
    getWAGroupTitle: getWAGroupTitle,
    quotationDisplayRef: quotationDisplayRef,
    formatSizeLabel: formatSizeLabel,
    sizeDisplay: sizeDisplay,
    dcSizeLabelDisplay: dcSizeLabelDisplay,
    dcSizeBoxText: dcSizeBoxText,
    dcCanonicalFormSize: dcCanonicalFormSize,
    cleanNum: cleanNum,
    withMm: withMm,
    dcLineMoney: dcLineMoney,
    dcItemFinalUnit: dcItemFinalUnit,
    dcItemBoltUnit: dcItemBoltUnit,
    dcItemAccUnit: dcItemAccUnit,
    dcPaMeta: dcPaMeta,
    dcPaKeepSaved: dcPaKeepSaved,
    dcNormalizeCustomDims: dcNormalizeCustomDims,
    dcCustomDimsText: dcCustomDimsText,
    accCWLabel: accCWLabel,
    wasCWLabel: wasCWLabel,
    wasDisplayData: wasDisplayData,
  };
}
