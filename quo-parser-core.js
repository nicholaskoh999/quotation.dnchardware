/* ════════════════════════════════════════════════════════════════════════════
   QUO PARSER CORE — the Quick Add text parser, shared.

   This file is the single source of the rules that turn a pasted inquiry into
   quotation rows: text normalisation, heading detection, product / material /
   finish / size type recognition, diameter, length, width and thread length
   parsing, quantity, heading-to-row inheritance and missing-field detection.

   WHO LOADS IT
     1. index.php, as a classic <script> placed before the page script. Every
        declaration below is a plain top-level declaration, exactly as it was
        when it lived inside index.php, so the page keeps using the same names.
     2. Node (tests): require('./quo-parser-core.js').
     3. DNC Quick Quote: copied at build time from a pinned commit of this
        repository. It is never re-implemented there.

   RULES FOR EDITING
     - No DOM, no window, no network, no storage. Only standard JavaScript.
       tests/core/parser-core.test.js fails if this is broken.
     - No pricing arithmetic and no WhatsApp formatting here.
     - Any change alters the file's SHA-256: update the ?v= value on the
       <script src> line in index.php (the same test checks it) and bump
       QUO_PARSER_CORE_VERSION at the bottom of this file.
     - .cpanel.yml lists this file in APPFILES. Without it the editor breaks.

   The code between this banner and the HOST INTERFACE banner was moved out of
   index.php without editing a character.
   ════════════════════════════════════════════════════════════════════════════ */
let dsRulesCache=[];
const DIA_FULLSIZE={M8:8,M10:10,M12:12,M13:13,M16:16,M18:18,M20:20,M22:22,M24:24,M25:25,M27:27,M30:30,M32:32,M33:33,M36:36,M38:38,M39:39,M40:40,M42:42,M45:45,M48:48,M50:50,M52:52,M55:55,M60:60,M65:65,'1/2':12.7,'5/8':15.875,'3/4':19.05,'7/8':22.225,'1"':25.4,'1-1/8':28.575,'1-1/4':31.75,'1-1/2':38.1};
const DIA_FULLSIZE_SPECIAL={M12:13};
const DIA_UNDERSIZE={M6:5.2,M8:7,M10:8.8,M12:10.6,M14:12.5,M16:14.5,M20:18,M22:20,M25:23};
const DIA_UNDERSIZE_INCH={'1/4':5.3,'5/16':6.8,'3/8':8.2,'1/2':10.9,'5/8':14.2,'3/4':17.1,'7/8':20,'1"':23};
/* ── Hard business rules ────────────────────────────────────────────────────
   Not heuristics and not defaults: these two are always true of a quotation,
   whatever the customer wrote, whatever a drawing shows and whatever an older
   saved item happens to contain. They live here, above every screen that needs
   them, so the calculator, Quick Add, the saved-quotation loader and the print
   sheet all get the same answer.

     · A STUD has no size type. Fullsize and Undersize describe a rod turned to
       a diameter; a stud is bought as it is. Independent of material — a 4140
       QT stud is not fullsize, an SS304 stud is not fullsize.
     · STAINLESS has no finish. PL, ZP and HDG are coatings for carbon steel,
       and we do not quote a coated SS304 or SS316. Independent of product.

   Both are written as "give me the correct value" rather than as checks, so
   there is no way to read them and then forget to apply the answer. */
const DC_NO_SIZE_TYPE_PRODUCTS=['stud'];
const DC_NO_FINISH_MATERIALS=['SS304','SS316'];
function dcProductHasSizeType(product){ return DC_NO_SIZE_TYPE_PRODUCTS.indexOf(String(product||''))<0; }
function dcMaterialHasFinish(material){ return DC_NO_FINISH_MATERIALS.indexOf(String(material||''))<0; }
function dcFinishFor(material,finish){ return dcMaterialHasFinish(material) ? String(finish||'') : ''; }
function materialLabel(material){
  const labels={
    S45C_HARDEN_G8_8:'S45C + HARDEN = G8.8',
    '4140':'4140 QT',
    '4340':'4340 QT',
    '4140_HARDEN_G10_9':'4140 QT + HARDEN = G10.9',
    /* "4140" and "Y BAR" are separate materials from "4140 QT" (internal value 4140).
       They carry their own internal values so historical 4140 QT data is untouched. */
    '4140_PLAIN':'4140',
    'Y_BAR':'Y BAR'
  };
  return labels[material] || String(material||'');
}
/* ── What has to be TYPED, and when ────────────────────────────────────────
   These products have no automatic pricing at all: the form says so on its own
   face — "Cost Rate must be entered manually for this product type" — and their
   add paths insist on a rate AND a surcharge, not one or the other.

   Kept as one list because it was written out three times: on the form, in the
   warning, and inside each add function. Quick Add now asks the same question
   the add path asks, and it can only do that by asking the same list. */
const DC_TYPED_RATE_PRODUCTS=['ubolt','squbolt','lbolt','lbolt45','jbolt'];
function dcNeedsTypedAddCost(type){ return DC_TYPED_RATE_PRODUCTS.indexOf(String(type||''))>=0; }
/* ── Reading a size, and approving one ──────────────────────────────────────
   Two different jobs, deliberately separated. Normalising says what the person
   WROTE — 22, m22, M 22 and 22mm are all M22, and 23 is M23 whether or not we
   stock it. Validating says whether we recognise it. A parser that quietly
   turned an unrecognised M23 back into the raw string, or into the nearest size
   it did know, would be answering a question nobody asked. */
function normalizeSizeValue(raw){
  const v=String(raw||'').trim().toUpperCase();
  if(!v) return '';
  /* A bare number in a SIZE box is a metric nominal size. Applied only here —
     Length, TL, ID, S and W are plain millimetres and never gain an M.
     Except a small WHOLE number written without an M: the smallest metric size
     this shop quotes is M6 (DIA_UNDERSIZE), so a bare 1 to 5 is never M1–M5 —
     it is 1" to 5", the whole-inch sizes written the way staff write them. An
     M typed explicitly is always metric; 6 and above stay metric as before. */
  let m=v.match(/^([1-5])$/);
  if(m) return m[1]+'"';
  m=v.match(/^M?\s*(\d+(?:\.\d+)?)\s*(?:MM)?$/);
  if(m) return 'M'+String(Number(m[1])).replace(/\.0$/,'');
  /* An inch size may be written with its mark or without it, and 1/2 and 1/2"
     are the same rod. ONE canonical spelling — the one the diameter tables,
     the Diameter Settings rules and every saved quotation already use — so
     both spellings resolve to the same diameter, weigh the same and find the
     same previous price. A WHOLE number of inches keeps its mark, because
     without it a bare 1 is M1. */
  m=v.match(/^(\d+\s*[-\s]\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)\s*(?:"|”|″|IN|INCH(?:ES)?)?$/);
  if(m) return m[1].replace(/\s*\/\s*/,'/').replace(/\s*[-\s]\s*/,'-');
  /* ── A whole number of inches, however the mark was written ──────────────
     The rule above canonicalises FRACTIONS only, so 1/2" and 1/2 have always
     been one size. A whole number keeps its mark — a bare 1 is M1 — but the
     mark may be typed as ", ”, ″, IN or INCH, and only the straight quote was
     being canonicalised. So "1 INCH" stayed "1 INCH", which is:

       · not a size isKnownSize recognises (it looks for / " or ');
       · still worth 25.4mm as a FULLSIZE bar, because the inch reader that
         resolves the diameter DOES understand the word;
       · worth nothing at all as an UNDERSIZE one, because that table is keyed
         1" and nothing rewrote the spelling to match.

     One rod, three spellings, three different answers. The inch reader has
     always treated all of them as the same size (see wqaInchKey); this makes
     the size box say so too, so the diameter, the weight and the previous
     price are the same whichever way it was typed. */
  m=v.match(/^(\d+)\s*(?:"|”|″|IN|INCH(?:ES)?)$/);
  if(m) return m[1]+'"';
  return v;
}
/* ── Thread Reference — reference metadata, and nothing else ────────────────
   A pitch and a thread series describe the THREAD. They do not describe the
   bar: an M12 x 1.75P is an M12, and a 1/2" UNC and a 1/2" BSW are cut from
   the same 12.7mm rod and weigh the same. So a thread reference is carried
   beside the item as a note and read by nothing that computes:

     size / cleanSize · diameter · weight · price · price mode · product ·
     material · finish · size type · previous-price identity · history ranking

   all stay exactly what they were. The one thing that must never happen is a
   pitch reaching the size box — "M12 x 1.75P" as a SIZE is not a size we
   recognise, so it has no diameter, so the row cannot be weighed. It is split
   the moment it is read, and the size that comes out is plain M12.

   Only 1/2" carries an approved UNC/BSW distinction, so only 1/2" gets one
   READ for it. Nothing is inferred for 3/8, 5/8, 3/4 or 7/8 — a person may
   still type one, because typing is not inferring. */
const DC_THREAD_SERIES=['UNC','BSW'];
const DC_THREAD_SERIES_SIZES=['1/2'];
/* Does a size the parser READ get a series attached to it? Only the one the
   business has approved. */
function dcSizeTakesSeries(size){
  return DC_THREAD_SERIES_SIZES.indexOf(normalizeSizeValue(size))>=0;
}
/* One spelling for what is shown and stored: a pitch always ends in P, a series
   is upper case. Anything else a person types is kept as they typed it, trimmed
   — it is a note, and a note nobody can write is not a note. */
function dcNormThreadRef(raw){
  const v=String(raw==null?'':raw).trim();
  if(!v) return '';
  const up=v.toUpperCase();
  if(DC_THREAD_SERIES.indexOf(up)>=0) return up;
  /* 1.75, 1.75P, P1.75, PITCH 1.75 — all the one pitch. */
  const m=up.match(/^(?:P\s*[:=]?\s*)?(\d+(?:\.\d+)?)\s*(?:P|PITCH)?$/)
        || up.match(/^PITCH\s*[:=]?\s*(\d+(?:\.\d+)?)$/);
  if(m){
    const n=Number(m[1]);
    if(isFinite(n) && n>0 && n<=12) return String(n)+'P';
    return v;                      /* not a pitch; kept as written, not coerced */
  }
  return up;
}
/* What the parser read, turned into the one reference the row carries. The raw
   evidence (r.pitch, r.series) is left exactly as it was — this only decides
   what is SHOWN, and a series is shown only where one is approved. */
function dcThreadRefFrom(pitch,series,size){
  const p=String(pitch==null?'':pitch).trim();
  if(p) return dcNormThreadRef(p);
  const sv=String(series==null?'':series).trim().toUpperCase();
  if(sv && DC_THREAD_SERIES.indexOf(sv)>=0 && dcSizeTakesSeries(size)) return sv;
  return '';
}
function isKnownSize(size){
  const s=String(size||'').trim();
  if(!s) return false;
  if(DIA_FULLSIZE[s]!==undefined || DIA_UNDERSIZE[s]!==undefined) return true;
  if(DIA_UNDERSIZE_INCH[s]!==undefined) return true;
  const up=s.toUpperCase();
  if(DIA_FULLSIZE[up]!==undefined || DIA_UNDERSIZE[up]!==undefined) return true;
  /* An inch notation the imperial reader understands — 3/4, 1-1/4", 7/8". */
  if(/[\/"']/.test(s) && wqaImperialDia(s)) return true;
  return false;
}

/* ── diameter / rate auto-fill ── */
/* ── Imperial calculation diameter ─────────────────────────────────────────
   The quotation says 1/2" BSW because that is what the customer buys. The
   weight formula cannot multiply by a fraction of an inch, so it needs the
   millimetres behind it — 12.7 — and until now a size with a suffix had no
   entry in the table, so the diameter box stayed empty and Add refused the item
   with "Enter Diameter" and no explanation.

   This resolves the NUMBER only. The Size the customer sees, and the Size
   written on the quotation, are untouched, and no metric size is substituted:
   1/2" never becomes M12. */
const WQA_INCH_DIA={'1/2':12.7,'5/8':15.875,'3/4':19.05,'7/8':22.225,'1':25.4,
                    '1-1/8':28.575,'1-1/4':31.75,'1-3/8':34.925,'1-1/2':38.1,
                    '1/4':6.35,'5/16':7.9375,'3/8':9.525};
/* The inch size on a line, reduced to the key the diameter tables are written
   in. ONE reader, so a size typed with its mark, without it, or with a thread
   standard after it — 3/4, 3/4", 3/4" BSW — resolves to the same 3/4, and
   therefore to the same diameter whichever table is asked. */
function wqaInchKey(size){
  const s=String(size||'').trim().toUpperCase();
  /* A fraction is unambiguous on its own — nothing metric is written 3/4 — so
     1/2 and 1-1/4 resolve with or without the inch mark. A WHOLE number does
     need the mark: a bare 1 could be anything, and guessing an inch there
     would put 25.4mm behind a size nobody wrote. Any thread-standard suffix
     (BSW, UNC, BSP) is ignored for the number and kept on the quotation. */
  const mark='(?:\\s*(?:"|\u201d|\u2033|IN\\b|INCH(?:ES)?\\b))';
  const m=new RegExp('^(\\d+\\s*[-\\s]\\s*\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+)'+mark+'?'
                     +'|^(\\d+)'+mark).exec(s);
  if(!m) return '';
  return String(m[1]!==undefined?m[1]:m[2]).replace(/\s*\/\s*/,'/').replace(/\s*[-\s]\s*/,'-');
}
/* The FULLSIZE inch diameter, and only ever that — WQA_INCH_DIA is the
   fullsize table. There is no undersize answer in it; see autoFillDiameter. */
function wqaImperialDia(size){
  const key=wqaInchKey(size);
  return (key && WQA_INCH_DIA[key]!==undefined) ? String(WQA_INCH_DIA[key]) : '';
}
/* ── The effective diameter ─────────────────────────────────────────────────
   Weight is diameter squared. So the ONE question that matters about a size is
   what bar it is actually cut from, and there must be exactly one answer to
   it — the one Diameter Settings is showing.

   The built-in tables are the answer only where the settings do not override
   them, and the settings screen renders THESE functions rather than a second
   list of its own, so what is displayed cannot drift from what is weighed.
   Change the number in Diameter Settings and the weight changes with it; that
   is the whole contract, and there is no other place a diameter comes from. */
function dcBuiltInDiameter(type,material,sizeType,size){
  const s=String(size||'').trim();
  if(!s) return '';
  /* Undersize is a DIFFERENT bar, not a differently-spelled one: an undersized
     1/2" rod is 10.9mm where a fullsize one is 12.7. The undersize inch table
     is keyed 1/2, and a person may type 1/2" or 3/4" BSW, so the key is read
     through the one inch reader — and where that table has no entry, the
     answer is that there IS no undersize diameter for this size. Falling
     through to the FULLSIZE inch table is how an undersized 1/2" rod came back
     12.7mm: 36% too heavy, and priced on it. No diameter, no weight, no price,
     and the row says why. */
  const ik=wqaInchKey(s);
  // Stud always uses undersize diameter regardless of size type
  if(type==='stud' || sizeType==='UNDERSIZE'){
    return DIA_UNDERSIZE_INCH[s]!==undefined ? DIA_UNDERSIZE_INCH[s]
         : (ik && DIA_UNDERSIZE_INCH[ik]!==undefined) ? DIA_UNDERSIZE_INCH[ik]
         : (DIA_UNDERSIZE[s]!==undefined ? DIA_UNDERSIZE[s] : '');
  }
  let dia='';
  if((material==='4140'||material==='4340')&&DIA_FULLSIZE_SPECIAL[s]!==undefined) dia=DIA_FULLSIZE_SPECIAL[s];
  else dia=DIA_FULLSIZE[s]!==undefined?DIA_FULLSIZE[s]:'';
  /* Nothing in the metric table matched. If the size is written in inches —
     1/2", 3/4" BSW — the calculation diameter is the millimetres behind that
     fraction. Only ever a fallback, so no size that already resolves changes. */
  if(dia==='') dia=wqaImperialDia(s);
  return dia;
}

/* ═══════════════════════════════════════════════════════════════
   DIAMETER SETTINGS — MySQL/API
   Rules: {id, type, material, sizeType ('' for stud), size, diameter}
═══════════════════════════════════════════════════════════════ */
const DS_TYPES_NO_SIZETYPE=['stud'];

function normalizeDSRule(r){
  return {
    id:String(r.id||''),
    type:r.type||r.product_type||'sagrod',
    material:r.material||'MS',
    sizeType:r.sizeType!==undefined ? (r.sizeType||'') : (r.size_type||''),
    size:(r.size||'').toUpperCase(),
    diameter:parseFloat(r.diameter)||0,
    source:r.source||'custom',
    active:String(r.active!==undefined?r.active:(r.is_active!==undefined?r.is_active:1))
  };
}
function loadDSRules(){ return dsRulesCache; }

function dsKey(r){
  const type=r.type||'';
  const noST=DS_TYPES_NO_SIZETYPE.includes(type);
  return [type,r.material||'',noST?'':(r.sizeType||''),(r.size||'').toUpperCase()].join('|');
}
function makeSystemDSRule(type,material,sizeType,size,diameter){
  return normalizeDSRule({id:'sys-ds:'+[type,material,sizeType,size].join(':'),type,material,sizeType,size,diameter,source:'system',active:'1'});
}
/* Materials whose built-in answer can differ from mild steel's. Listed so the
   settings screen can show the difference rather than leaving it hidden. */
const DS_SPECIAL_MATERIALS=['4140','4340'];
function getSystemDSRules(){
  const rows=[];
  const sizedTypes=['sagrod','anchorbolt','ubolt','squbolt','lbolt','lbolt45','jbolt'];
  const metric=Object.keys(DIA_FULLSIZE);
  const under =Object.keys(DIA_UNDERSIZE).concat(Object.keys(DIA_UNDERSIZE_INCH));
  /* Every row is what dcBuiltInDiameter ACTUALLY returns for that combination.
     The list used to be assembled from the raw tables plus a rates table the
     calculator never consulted, so Diameter Settings advertised 10.7mm for an
     undersize 4140 M12 that was in fact weighed on 10.6. A screen that states
     a diameter must state the one in force. */
  const add=(type,material,sizeType,size)=>{
    const d=dcBuiltInDiameter(type,material,sizeType,size);
    if(d!=='' && d!=null && parseFloat(d)>0) rows.push(makeSystemDSRule(type,material,sizeType,size,d));
  };
  sizedTypes.forEach(type=>{
    metric.forEach(size=>add(type,'MS','FULLSIZE',size));
    under.forEach(size=>add(type,'MS','UNDERSIZE',size));
    /* Only where the special material's answer differs from mild steel's —
       otherwise the list doubles in length and says nothing new. */
    DS_SPECIAL_MATERIALS.forEach(mat=>{
      metric.forEach(size=>{
        if(String(dcBuiltInDiameter(type,mat,'FULLSIZE',size))!==String(dcBuiltInDiameter(type,'MS','FULLSIZE',size)))
          add(type,mat,'FULLSIZE',size);
      });
      under.forEach(size=>{
        if(String(dcBuiltInDiameter(type,mat,'UNDERSIZE',size))!==String(dcBuiltInDiameter(type,'MS','UNDERSIZE',size)))
          add(type,mat,'UNDERSIZE',size);
      });
    });
  });
  under.forEach(size=>add('stud','MS','',size));
  return rows;
}
function getDSDisplayRules(){
  const merged=new Map();
  getSystemDSRules().forEach(r=>merged.set(dsKey(r),r));
  loadDSRules().forEach(r=>merged.set(dsKey(r),normalizeDSRule({...r,source:'custom'})));
  return Array.from(merged.values());
}

/* ── init ── */
/* ═══════════════ WHATSAPP QUICK ADD (V1) ═══════════════════════════════════
   Paste customer text -> deterministic parse -> CONFIRM -> add.
   Nothing is ever added without the confirmation step.

   Everything downstream is the existing engine: each confirmed row is written
   into the REAL product form and handed to the REAL add function
   (addSagRod / addStud / addAnchorBolt), so calculation, item construction,
   accessories, desc building and the save structure are shared, never copied.

   V1 products: sagrod, stud, anchorbolt. The parser is table-driven so more
   product types slot in by adding a WQA_PRODUCTS entry.
   No AI, no API for parsing — pure deterministic string work.            */

const WQA_PRODUCTS=[
  /* longest aliases first so "anchor bolt" wins before "bolt" style prefixes.
       token       the name this product carries in the shared extraction
                   schema — the ONE place the AI's SAG_ROD and our sagrod are
                   tied together
       threadEnds  how many thread lengths the product HAS. This is what decides
                   whether a single value shared by a list means both ends (Sag
                   Rod: 75 -> 75/75) or stays exactly as written (Anchor Bolt:
                   100 -> 100), and whether a thread is required at all. */
  {type:'anchorbolt', token:'ANCHOR_BOLT', label:'Anchor Bolt', aliases:['anchor bolt','anchorbolt','anchor-bolt'],
   dims:['size','length','threadLen'], map:{length:'l'}, threadEnds:1, needSizeType:true},
  {type:'sagrod', token:'SAG_ROD', label:'Sag Rod', aliases:['sag rod','sagrod','sag-rod'],
   dims:['size','length','threadLen'], map:{length:'length'}, threadEnds:2, needSizeType:true},
  /* std  a STANDARD number that names the product on its own. DIN 937 is a
          stud/stud-bolt standard, so a drawing headed "DIN 937" has said which
          product it is without writing the word. It says nothing about the
          MATERIAL — that still has to be stated. The DIN wording is required:
          a bare 937 is a quantity or a job number, never a product. */
  {type:'stud', token:'STUD', label:'Stud', aliases:['stud bolt','studbolt','stud'],
   std:/\bdin[\s.\-]*937\b/i,
   dims:['size','length'], map:{length:'l'}, threadEnds:0, needSizeType:false},
  /* An L Bolt is a straight leg with a 90-degree return: M, the long leg L, the
     short leg W, and one threaded end. A J Bolt is the curved cousin: M, the
     overall height H, the inside diameter ID of the hook, the return height S,
     and one threaded end. Both already have their own calculator — dimensions,
     weight, price, accessories — so Quick Add reads them and hands each row to
     the calculator that owns it. No second engine. */
  {type:'lbolt', token:'L_BOLT', label:'L Bolt',
   /* A foundation bolt with a 90-degree bend IS an L Bolt, whatever the
      customer called the family it belongs to. */
   aliases:['l bolt','lbolt','l-bolt','hook bolt','hookbolt',
            'l type foundation bolt','l-type foundation bolt','l type bolt'],
   dims:['size','length','w','threadLen'], map:{length:'l', w:'w'},
   threadEnds:1, needSizeType:true},
  {type:'jbolt', token:'J_BOLT', label:'J Bolt',
   aliases:['j bolt','jbolt','j-bolt',
            'j type foundation bolt','j-type foundation bolt','j type bolt','j type'],
   dims:['size','h','id','s','threadLen'], map:{h:'h', id:'id', s:'s'},
   threadEnds:1, needSizeType:true},
];
/* Every standard number we recognise, for stripping off a line before its
   numbers are read: "DIN 937" is not a 937 mm rod. */
const WQA_STD_RE=new RegExp(WQA_PRODUCTS.filter(p=>p.std).map(p=>p.std.source).join('|'),'gi');

/* A document may legitimately not say which product it is (a handwritten list
   of lengths and counts). The review still opens so the user can see the rows
   and choose; this stand-in keeps every renderer safe until they do. */
const WQA_NO_PRODUCT={type:'',token:'',label:'—',dims:['size','length'],map:{},threadEnds:0,needSizeType:false};

/* A grade number and a measurement can be the same number. What tells them
   apart is the word in front of it, so this is tested against the text
   IMMEDIATELY BEFORE a candidate match — "length 10.9" is a length, "grade
   10.9" is a grade, and both can appear in the same message. A vetoed
   occurrence is skipped; the rule itself keeps looking. */
const WQA_MEASURED_RE=/\b(?:qty|quantity|length|width|height|weight|thick(?:ness)?|dia|diameter|size|overall)\s*[:=]?\s*$/i;

/* A2 and A4 also name a paper size, and an engineering drawing is exactly the
   place that word appears. Where one of these sits beside the token, it is the
   sheet, not the fastener class. */
const WQA_PAPER_RE=/\b(?:sheet|paper|size\s*of\s*sheet|scale|format|drawing\s*size|print(?:ed)?\s*on)\b/i;
/* Material aliases -> the system's EXISTING internal values. Order matters:
   the more specific spellings must be tested before the bare "4140". */
const WQA_MATERIALS=[
  /* Written as our own material name, so it is that material and not a grade
     reading of it: "4140 QT + HARDEN = G10.9" selects exactly that. */
  {re:/\b4140\s*(qt)?\s*\+?\s*harden\b/i,                value:'4140_HARDEN_G10_9'},
  {re:/\bs45c\s*\+?\s*harden\b/i,                        value:'S45C_HARDEN_G8_8'},
  /* ── STAINLESS IDENTITY, ahead of every strength grade ──────────────────
     SS304, SS 304, S/S304, S.S 304, SUS304, AISI 304, STAINLESS STEEL 304,
     304 SS — and ISO 3506's property classes A2 and A4, which is how an
     engineering specification usually writes them: A2-50, A2-70, A4-80.

     The GRADE is what makes it a material. A bare "S/S", "SS" or "Stainless"
     with no number stays null and Review asks, because 304 and 316 are
     different materials and choosing one would be a guess. A bare 304 or 316
     is just a number — "304 pcs" is a quantity, "Length 316mm" is a length.

     Tested FIRST, before the strength families below, because an explicit base
     material outranks a strength written beside it: "SUS304 GRADE 8.8" is
     stainless, and A2-70's 70 is a property class and not grade 8.8. The loop
     stops at the first match, so putting identity first IS the precedence
     rule.

     The guard is for drawings: A2 and A4 are also sheet sizes, so the paper
     words disqualify them. Nothing else about the token is guessed. */
  {re:/\bs\s*[\/.]?\s*s\s*[\s\/.-]*304\b|\bsus[\s-]*304\b|\baisi[\s-]*304\b|\bstainless(?:\s*steel)?[\s-]*304\b|\b304[\s-]*(?:ss|s\s*\/\s*s|stainless(?:\s*steel)?)\b/i,
   value:'SS304'},
  {re:/\bs\s*[\/.]?\s*s\s*[\s\/.-]*316\b|\bsus[\s-]*316\b|\baisi[\s-]*316\b|\bstainless(?:\s*steel)?[\s-]*316\b|\b316[\s-]*(?:ss|s\s*\/\s*s|stainless(?:\s*steel)?)\b/i,
   value:'SS316'},
  {re:/\ba2(?:[\s-]*\d{2})?\b/i, notAfter:WQA_MEASURED_RE, notNear:WQA_PAPER_RE,
   value:'SS304', from:'A2'},
  {re:/\ba4(?:[\s-]*\d{2})?\b/i, notAfter:WQA_MEASURED_RE, notNear:WQA_PAPER_RE,
   value:'SS316', from:'A4'},
  /* 10.9 is the other established strength mapping, and it is 4340 QT — never
     a harder 4140. It has to be tested BEFORE the 8.8/HT family below, because
     "HT 10.9" contains the generic HT and must not be answered by it: the more
     specific grade always wins. 10.9 is uncommon and customers state it, often
     as "gr10.9 or near material" — the "or near material" says they would
     accept an equivalent, it does not name a second material, so it maps to
     4340 QT exactly as a bare grade 10.9 does.
     notAfter keeps a grade apart from a measurement that happens to read the
     same: "qty 10.9" and "length 10.9" are numbers, not materials. */
  {re:/\bgrade[\s-]*10\.?9\b|\bgr\.?[\s-]*10\.?9\b|\bg[\s-]*10\.?9\b|\bclass[\s-]*10\.?9\b|\bcl\.?[\s-]*10\.?9\b|\bh\.?\s*t\.?[\s-]*10\.?9\b|\bhigh[\s-]*tensile[\s-]*(?:grade[\s-]*)?10\.?9\b|\baisi[\s-]*4340(?:[\s-]*q\s*&?\s*t)?\b|\b4340\s*q\s*&\s*t\b|\b10\.9\b(?!\s*(?:mm|cm|kg|m\b))/i,
   notAfter:WQA_MEASURED_RE, value:'4340', defaulted:true, strength:true, from:'G10.9'},
  /* 8.8 is the company's other established mapping, and it is 4140 QT. Grade,
     Class, GR, G, HT and High Tensile all name the same family as long as the
     NUMBER is with them, and a DIN 975 standard beside it changes nothing.

     A bare HT or HIGH TENSILE names no material. Both 8.8 and 10.9 are high
     tensile, so the wording on its own does not say which of the two steels the
     company would buy — it stays null and Review asks. It used to answer 4140
     QT, which is a guess between two real and different materials.

     Longest wording first, because the first alternative that matches is also
     the wording shown back to the customer: "GRADE 8.8 → 4140 QT", not
     "8.8 → 4140 QT". */
  {re:/\bgrade[\s-]*8\.?8\b|\bgr\.?[\s-]*8\.?8\b|\bg[\s-]*8\.?8\b|\bclass[\s-]*8\.?8\b|\bcl\.?[\s-]*8\.?8\b|\bh\.?\s*t\.?[\s-]*8\.?8\b|\bhigh[\s-]*tensile[\s-]*(?:grade[\s-]*)?8\.?8\b|\baisi[\s-]*4140(?:[\s-]*q\s*&?\s*t)?\b|\b4140\s*q\s*&\s*t\b|\b8\.8\b(?!\s*mm)/i,
   notAfter:WQA_MEASURED_RE, value:'4140', defaulted:true, strength:true, from:'G8.8'},
  {re:/\b4140\s*(?:qt|q\s*&\s*t)\b/i,                       value:'4140'},
  {re:/\b4140\s*(plain|non[\s-]*qt|not[\s-]*qt)\b|\b(plain|non[\s-]*qt)\s*4140\b/i, value:'4140_PLAIN'},
  {re:/\b4140\b/i,                                        value:'4140', defaulted:true},
  {re:/\b4340\s*(?:qt|q\s*&\s*t)?\b/i,                      value:'4340'},
  {re:/\by\s*bar\b|\bybar\b/i,                            value:'Y_BAR'},
  {re:/\bs45c\b/i,                                        value:'S45C'},
  {re:/\bms\b|\bm\s*\/\s*s\b|\bmild\s*steel\b/i,          value:'MS'},
];
/* Finish -> existing finish values only. "plain" reads as the PL finish; it is
   NOT treated as plain-4140 material, which needs explicit non-QT wording. */
const WQA_FINISHES=[
  {re:/\bhdg\b|\bhot[\s-]*dip\b|\bgalvani[sz]ed\b/i, value:'HDG'},
  /* Zinc plating is written a dozen ways by hand and comes back from OCR with
     whatever punctuation was on the paper: ZP, Z/P, Z(P), Z[P], z p. They all
     mean the one finish we quote. */
  {re:/\bzp\b|\bz\s*[\/(\[]\s*p\s*[)\]]?|\bz\s+p\b|\bzinc\b/i, value:'ZP'},
  /* Black is what the trade calls an uncoated rod, and PL is what we quote it
     as. Matched as a whole word only. */
  {re:/\bpl\b|\bplain\b|\bblack\b|\bself[\s-]*colou?r\b/i, value:'PL'},
];

const wqa={raw:'',product:null,common:{},commonItem:null,commonAcc:null,commonPrice:null,
           commonFix:null,
           panels:{fix:false,item:false,price:false,acc:false},applyScope:'all',
           /* Which record's menu is open, and which record's picker — one of
              each at a time, and neither of them changes a row by existing. */
           histMenu:'',histPick:null,bulkOpen:false,
           view:'compact',rows:[],busy:false,
           /* The extraction stopped early, and whether somebody has said out
              loud that they checked the source anyway. */
           truncated:false,truncAck:false,covMissing:[]};

/* Accessory shape is the EXISTING one used by getAccessories() /
   loadAccIntoForm() / accAddon(). Nothing here re-prices anything: the row is
   handed to loadAccIntoForm() and the normal engine does the sums. */
const WQA_ACC_FINISHES=['','PL','ZP','HDG','SS'];
function wqaEmptyAcc(){
  return {nut:{enabled:false,qty:2,finish:'',unitPrice:0},
          fw:{enabled:false,qty:1,finish:'',unitPrice:0},
          custom:{enabled:false,text:'',unitPrice:0}};
}
function wqaAccNeedsQty(a){
  return !!a && ['nut','fw','custom'].some(k=>a[k] && a[k].enabled && (k==='custom' ? a[k].qtyNeed && !(parseFloat(a[k].qty)>0) : !(parseFloat(a[k].qty)>0)));
}

/* ── Row-level material, finish and size type ───────────────────────────────
   A real inquiry is not one document-wide specification. A drawing routinely
   carries one product, two materials and a finish that applies to only half the
   table. So every row carries its OWN material, finish and size type, resolved
   when it was read, and the selector above the list became a SUMMARY of them
   rather than their source: where the rows agree it shows the value, where they
   do not it says Mixed and each row keeps what it actually has.

   Product stays one per session: the calculator is switched to a product to
   price a row, and the compact table has one dimension-column layout, so a
   mixed-product session is a bigger change than this one. Review still asks for
   the product once, by name. */
const WQA_MIXED='\u2014mixed\u2014';
const WQA_ROW_SPEC=['material','finish','sizeType'];
/* ── Size Type defaults ─────────────────────────────────────────────────────
   Two, both confirmed, both overridden the moment the customer says otherwise:
     · 4140, 4140 QT and 4340 QT are bought fullsize
     · MS at M12 (and its imperial twin 1/2") is bought undersize
   Nothing else has a default. MS at M16 or M20 stays blank and Review asks —
   inventing a third rule here would be exactly the guess the whole review
   screen exists to avoid. A defaulted value is marked as defaulted, so the
   screen can say it was ours and not the customer's. */
/* ── Company size-type defaults ─────────────────────────────────────────────
   THE one place a size type nobody stated may be filled in, and the only one.
   The distinction the business draws is not "never guess" — it is:

       a company rule is an answer; anything else is a guess.

   So a rule states its material, the sizes it covers, the answer, and WHY,
   and the row carries the why so staff can see the value did not come from
   the customer. Adding a rule is editing this list; nothing anywhere else
   invents a size type.

   The M12 exception is real and deliberate. 4140 QT and 4340 are ordinarily
   fullsize, but M12 is the size where that stops being reliable, so the rules
   below decline it and the answer is looked for in what the company has
   actually configured — a Diameter Settings entry for this product, material
   and size exists for exactly one size type, and that is the established
   rule. If the settings are silent too, the row asks. */
const DC_SIZE_TYPE_RULES=[
  /* Mild steel is drawn undersize at M12 and at the half inch. */
  {materials:['MS'], sizes:['M12','1/2','1/2"'], sizeType:'UNDERSIZE',
   why:'companyDefault'},
  /* The quenched-and-tempered grades are fullsize — except at M12, where the
     company's own settings decide. */
  {materials:['4140','4140_PLAIN','4340'], notSizes:['M12','1/2','1/2"'],
   sizeType:'FULLSIZE', why:'companyDefault'},
];
/* Which size types the company has actually configured a diameter for, on this
   product / material / size. One answer is an established rule; none or two is
   not, and the row asks rather than being told. */
function dcConfiguredSizeTypes(product,material,size){
  const want=String(size||'').trim().toUpperCase();
  const seen=new Set();
  (typeof getDSDisplayRules==='function' ? getDSDisplayRules() : []).forEach(r=>{
    if(product && r.type && r.type!==product) return;
    if(material && r.material && r.material!==material) return;
    if(!r.size || String(r.size).trim().toUpperCase()!==want) return;
    if(!r.sizeType) return;
    if(!(parseFloat(r.diameter)>0)) return;
    seen.add(r.sizeType);
  });
  return [...seen];
}
/* {sizeType, why} — why is '' when nothing answers, and the row asks.

   The settings are consulted ONLY where a rule covers the material and
   deliberately declines the size: that is the M12 exception, and it is the one
   place the business said to look at what is actually configured. Everywhere
   else, no rule means no answer. A diameter table that happens to hold one
   size type for a size is not a company rule about it — reading it as one
   would answer a question nobody has established the answer to, on every size
   in the table, which is the guessing this exists to prevent. */
function dcCompanySizeType(product,material,size){
  const m=String(material||''), s=String(size||'').trim().toUpperCase();
  const has=(list)=>(list||[]).some(x=>String(x).toUpperCase()===s);
  for(const rule of DC_SIZE_TYPE_RULES){
    if(rule.materials.indexOf(m)<0) continue;
    if(rule.sizes && !has(rule.sizes)) continue;
    if(rule.notSizes && has(rule.notSizes)){
      const configured=dcConfiguredSizeTypes(product,m,s);
      return configured.length===1 ? {sizeType:configured[0], why:'configured'}
                                   : {sizeType:'', why:''};
    }
    return {sizeType:rule.sizeType, why:rule.why};
  }
  return {sizeType:'', why:''};
}
function wqaFinishFor(material,finish){ return dcFinishFor(material,finish); }
/* Same question, asked of a row list that is not yet on screen. */
function wqaRowsCommonValueOf(rows,k){
  const live=(rows||[]).filter(r=>!r.removed);
  if(!live.length) return '';
  const first=String(live[0][k]||'');
  return live.every(r=>String(r[k]||'')===first) ? first : WQA_MIXED;
}
/* The one place anything downstream asks a row what it is made of. */
function wqaRowSpec(r,k){ return String((r&&r[k])||''); }
/* What Review calls each dimension when it is missing. */
const WQA_DIM_LABEL={length:'Length', w:'W', h:'H', id:'ID', s:'S'};
/* And what it IS. A row carries its own product, so an Anchor Bolt and a Sag
   Rod in one document are each validated, weighed and priced as themselves.
   Falls back to the session product only while a row has none of its own —
   which is what happens when staff choose the product for the whole list. */
function wqaRowProduct(r){ return String((r&&r.product)||'') || String(wqa.product||''); }

function wqaProductByType(t){ return WQA_PRODUCTS.find(p=>p.type===t)||null; }
function wqaProductByToken(k){ return WQA_PRODUCTS.find(p=>p.token===k)||null; }
/* ── The one product resolver ───────────────────────────────────────────────
   Our two straight-rod products differ by ONE thing: how many ends carry a
   thread. So where a source states the arrangement, that outranks whatever the
   customer called it — "one end thread sag rod" is our Anchor Bolt, and "anchor
   bolt, thread both ends" is our Sag Rod. Every source resolves here; there is
   no second product map anywhere. A Stud has no thread and is left alone. */
function wqaResolveProduct(product,threadEnds){
  const p=wqaProductByToken(String(product||''))||wqaProductByType(String(product||''));
  const type=p?p.type:'';
  if(!type || !p.threadEnds) return type;
  if(threadEnds!==1 && threadEnds!==2) return type;
  if(p.threadEnds===threadEnds) return type;
  const swap=WQA_PRODUCTS.find(x=>x.threadEnds===threadEnds);
  return swap ? swap.type : type;
}
/* How many thread lengths this product has. 0 = no thread field at all. */
function wqaThreadEnds(t){ const p=wqaProductByType(t); return p?p.threadEnds:0; }

/* ── Thread representation ──────────────────────────────────────────────────
   Thread lives in ONE field, written "75", "75/75" or "50/110". These are the
   only two places that field is taken apart or put together. */
function wqaSplitThread(tl){
  const s=String(tl==null?'':tl).trim();
  if(!s) return {a:'',b:''};
  const p=s.split('/');
  return {a:String(p[0]||'').trim(), b:p.length>1?String(p[1]||'').trim():''};
}
/* A single value stated ONCE for a whole list. Only a product that HAS two
   thread ends can mean "the same at each end", so only that product doubles it:
   a Sag Rod's shared 75 is 75/75, an Anchor Bolt's 100 stays 100. Never applied
   to a value a row states for itself — that is already written as it is meant. */
function wqaPairThread(v,productType){
  const s=String(v==null?'':v).trim();
  if(!s) return {a:'',b:''};
  if(s.indexOf('/')>=0) return wqaSplitThread(s);
  return wqaThreadEnds(productType)===2 ? {a:s,b:s} : {a:s,b:''};
}
/* A drawing writes an undersized rod's nominal diameter as R12. The R is the
   draughtsman's round-bar notation, not a different size, and the quotation
   speaks in M sizes. ONE definition of the notation, read both off a pasted
   line and out of an extraction. */
const WQA_ROD_R_RE=/\br\s*(\d+(?:\.\d+)?)\b/i;
/* "12", "m12", "M12.0", an extracted "M12" and — on a rod — "R12" all mean M12.
   ONE normaliser, so a typed size, a parsed one and an extracted one land
   identically. rodSize is the context that licences the R form; without it an
   R number is left exactly as written rather than guessed at. */
function wqaNormM(v,rodSize){
  const s=String(v==null?'':v).trim();
  if(!s) return '';
  let m=s.match(/^m?\s*(\d+(?:\.\d+)?)\s*$/i) || s.match(/\bm\s*(\d+(?:\.\d+)?)\b/i);
  if(!m && rodSize) m=s.match(WQA_ROD_R_RE);
  /* Anything that is not a metric size goes through the SAME canonicaliser a
     typed size does, so an extracted 3/8" and a typed 3/8 are one size and not
     two spellings of it — one diameter, one weight, one previous-price match. */
  return m ? 'M'+m[1].replace(/\.0$/,'') : normalizeSizeValue(s);
}

/* ── A thousands separator is not a separator between values ────────────────
   "qty - 15,000 pcs" is fifteen thousand pieces and "M24 x 1,000" is a rod a
   metre long. Every reader below asked for `\d+`, so the comma ended each
   number early: the order went out at 15, and the rod — silently, with a
   plausible-looking row on screen — at 1mm with a quantity of 0.

   This is not a new rule. The calculator's own number boxes have always read
   "1,200" as twelve hundred (see the numeric input handler), so a message and
   a typed figure now agree instead of disagreeing. It lives HERE because every
   line reaches the parser through this one function, so there is no second
   place for it to drift out of step with.

   A group is a separator only when it is exactly three digits, which is what
   makes "1,000" a number and leaves "1,2" alone. And a line that is NOTHING
   BUT comma-separated numbers is the one place a comma really does separate
   values — a bare length list, "100,200,300" — so that line is left exactly as
   it was written rather than fused into one impossible dimension. */
const WQA_THOUSANDS_RE=/\b\d{1,3}(?:,\d{3})+\b/g;
const WQA_NUM_LIST_LINE_RE=/^\d+(?:\s*,\s*\d+)+$/;
/* Normalise separators so x / X / × / * / spaces all behave the same. */
function wqaNorm(s){
  const out=String(s||'')
    .replace(/[×✕✖]/g,'x')
    .replace(/\*/g,'x')
    .replace(/[–—]/g,'-')
    .replace(/\s+/g,' ')
    .trim();
  return WQA_NUM_LIST_LINE_RE.test(out) ? out
       : out.replace(WQA_THOUSANDS_RE,m=>m.replace(/,/g,''));
}

/* A line is an item line when it carries a dimension run: at least two numbers
   separated by x, optionally with a leading size token. */
/* ── Parser: token recognition -> field extraction -> inheritance -> confidence
   ───────────────────────────────────────────────────────────────────────────
   There is deliberately NO per-customer format branch. Every line goes through
   the same field extractors, so "M12 x 1000 x 100 - 2pcs", "4pcs - M12 x 853 x
   70/70mm" and a bare "405 - 8pcs" under a header are all the same code path —
   they simply resolve different subsets of fields and inherit the rest.

   Each resolved field carries a confidence:
     detected   read straight off the line
     inherited  taken from a header / earlier context line
     defaulted  a documented default was applied (e.g. bare 4140 -> 4140 QT)
     uncertain  recognised but not safely resolvable -> never silently used  */

const WQA_CONF={DETECTED:'detected',INHERITED:'inherited',DEFAULTED:'defaulted',UNCERTAIN:'uncertain'};
/* A row that cannot be committed: something is missing, or the evidence about
   what it IS disagrees with itself. Both stop the Add button; only the second
   needs a person rather than a value. */
function wqaRowBlocked(r){ return wqaRowMissing(r).length>0 || !!r.productConflict; }

/* ── An alias is a WORD, not a run of letters inside one ────────────────────
   "SPECIAL BOLT" contains the letters of "l bolt" — specia|l bolt — and was
   therefore read as an L Bolt: an L Bolt's dimension schema, an L Bolt's
   computed total length and an L Bolt's price, for the product the app calls
   Others / Special Bolt. "STEEL BOLT" and "FULL BOLT" read the same way.

   The two word-bounded tests were already here and already right; the bare
   substring test beside them defeated both. It was there for punctuation —
   "(sag rod)" and "sag-rod," have no space around the alias — so punctuation
   is still a boundary here. Only a letter or a digit is not. */
function wqaSaysWord(hay,word){
  const w=String(word||'').toLowerCase();
  if(!w) return false;
  const open=c=>!c||!/[a-z0-9]/.test(c);
  for(let i=hay.indexOf(w); i>=0; i=hay.indexOf(w,i+1)){
    if(!open(hay[i-1])) continue;
    const after=hay[i+w.length];
    if(open(after)) return true;
    /* "sag rods", "studs" — a plural is the same word. */
    if(after==='s' && open(hay[i+w.length+1])) return true;
  }
  return false;
}
/* "L BOLT 45 DEG", "L-BOLT 45°", "45 DEGREE L BOLT" — the wording that names
   the OTHER L Bolt product. */
const WQA_L45_RE=/\b45\s*(?:deg(?:ree)?s?\b|°)|°45\b/i;

/* Layer 1 — whole-message scan for the fields that are stated once and apply to
   every row. Aliases resolve to the SAME value, so "MS UNDERSIZE SAG ROD (ZP)"
   and "m/s zp sag rod (undersize)" produce one consistent set, not a conflict. */
/* The first occurrence of a material's wording that is NOT a measurement of the
   same number. Skipping the occurrence rather than the rule matters: a message
   can say "length 10.9mm" in one line and "grade 10.9" in another, and only the
   second one is the material. */
function wqaMatchMaterial(m,said){
  if(!m.notAfter && !m.notNear) return m.re.exec(said);
  const re=new RegExp(m.re.source,'gi');
  let x;
  while((x=re.exec(said))!==null){
    const before=said.slice(0,x.index);
    /* notAfter: the token is a measurement's value, not a material.
       notNear:  a word within a few of it disqualifies it — A2 and A4 are
                 sheet sizes as well as stainless classes. */
    const ok = (!m.notAfter || !m.notAfter.test(before))
            && (!m.notNear  || !(m.notNear.test(before.slice(-28))
                              || m.notNear.test(said.slice(x.index, x.index+x[0].length+22))));
    if(ok) return x;
    if(re.lastIndex<=x.index) re.lastIndex=x.index+1;
  }
  return null;
}
/* ── One mapping, whatever the source ──────────────────────────────────────
   "Grade 8.8" means the same thing on a drawing as it does in a WhatsApp
   message: the company buys 4140 QT for it, and 4340 QT for 10.9. Those are
   defined company mappings, not guesses, so a row carrying one is priced and
   not held open — and the wording that produced it is shown back beside the
   answer, so nobody has to wonder where 4140 QT came from.

   This deliberately replaced a split where a document's grade was kept as a
   strength class with no material while a typed one resolved. Two answers for
   one specification is worse than either answer: the same stud came out of a
   photograph unpriceable and out of a pasted line priced. */
function wqaDetectCommon(text,opts){
  const hay=' '+wqaNorm(text).toLowerCase()+' ';
  const out={product:null,material:'',materialDefaulted:false,finish:'',sizeType:'',strengthGrade:''};
  /* Every product the wording names, not the first one. A document that says
     "SAG ROD / ANCHOR BOLT" has not said which, and choosing for the customer
     is exactly the confident-and-wrong answer we refuse to give: product stays
     null and Review asks. A drawing that genuinely CONTAINS both is the same
     answer at document level — each row then says what it is. */
  const named=[];
  for(const p of WQA_PRODUCTS){
    if((p.std && p.std.test(hay)) || p.aliases.some(a=>wqaSaysWord(hay,a))){
      named.push(p.type); }
  }
  out.product = named.length===1 ? named[0] : null;
  out.productAmbiguous = named.length>1;
  /* ── A 45-degree L Bolt is a different product ───────────────────────────
     The application has one: L Bolt 45DEG, with its own entry form, its own
     default prices and its own diameter rules. What makes it different is the
     one thing that matters here — a plain L Bolt's total length is COMPUTED
     from its legs (l + w - d x 1.5, the 90-degree bend deduction) and a 45
     DEG one's is not, because the bend develops differently. Quick Add does
     not read that product, so a message that says 45DEG was being read as a
     plain L Bolt: same legs, the 90-degree deduction applied to them, and a
     weight and a price worked out from a bend the customer did not order.

     Nothing here guesses the geometry. The product is simply left unsettled,
     which is what Review already exists to ask about. */
  if(out.product==='lbolt' && WQA_L45_RE.test(hay)){ out.product=null; out.productUnsupported='lbolt45'; }
  /* A stated 90-degree bend is geometry, and geometry outranks the family the
     customer filed it under: "ANCHOR BOLT 90 DEG BEND" is an L Bolt. The same
     doctrine the parser already applies when a W or an ID and an S appear.

     Only where this wording is about ONE product. Read over a whole mixed
     message the bend belongs to one section of it, and claiming the document
     is an L Bolt because section 4 mentions a bend is exactly the confident
     wrong answer the ambiguity test above exists to refuse. */
  if(named.length<=1 && WQA_BEND90_RE.test(hay)){ out.product='lbolt'; out.productAmbiguous=false; }
  /* Matched against the text as WRITTEN, not the lower-cased copy, so the note
     can show the customer's own wording back to them: HT, High Tensile, G8.8. */
  const said=' '+wqaNorm(text)+' ';
  for(const m of WQA_MATERIALS){
    const hit=wqaMatchMaterial(m,said);
    if(!hit) continue;
    const wording=String(hit[0]).replace(/\s+/g,' ').trim()||m.from||'';
    /* The class the answer came from, kept beside it as the evidence it is. */
    if(m.strength) out.strengthGrade=wording;
    out.material=m.value; out.materialDefaulted=!!m.defaulted;
    out.materialDefaultedFrom=wording||'4140';
    break;
  }
  for(const f of WQA_FINISHES){ if(f.re.test(hay)){ out.finish=f.value; break; } }
  /* "undersized" is as common as "undersize" on a handwritten drawing. */
  if(/\bfull\s*sized?\b|\bf\/s\b/i.test(hay))       out.sizeType='FULLSIZE';
  else if(/\bunder\s*sized?\b|\bu\/s\b/i.test(hay)) out.sizeType='UNDERSIZE';
  return out;
}

/* "M20, M24" is two sizes, not M20 x 24. Written as a header it says which
   diameters this enquiry covers, and the rows underneath say which is which —
   so the line is read, consumed, and produces NO item of its own. Two or more
   M-prefixed tokens are what makes it a list: "M20 x 24" has one, so the 24
   stays a dimension and is left alone. Nor does the list choose a size for a
   row that has none — with two candidates and no way to tell, that would be a
   guess, and Review asks instead. */
const WQA_SIZE_LIST_RE=/^m\s*\d+(?:\.\d+)?(?:\s*(?:,|\/|&|\+|and)\s*m\s*\d+(?:\.\d+)?)+\s*[,.]?\s*$/i;
function wqaSizeList(n){
  const s=String(n||'').trim();
  if(!WQA_SIZE_LIST_RE.test(s)) return null;
  const out=(s.match(/m\s*\d+(?:\.\d+)?/ig)||[]).map(x=>'M'+x.replace(/[^\d.]/g,''));
  return out.length>1 ? out : null;
}

/* The sizes a NOTE names, read from a line that says other things too:
   "M20 / M24 UNDER SIZE". One size is not a list — "M12 UNDER SIZE" written
   over a block of M12 rows is an ordinary heading and scoping it would change
   nothing — so two is the smallest thing this answers. */
function wqaSizeScope(n){
  const out=(String(n||'').match(/\bm\s*\d+(?:\.\d+)?\b/ig)||[])
              .map(x=>'M'+x.replace(/[^\d.]/g,''));
  return out.length>1 ? out : null;
}

/* Section markers carry no data; they must not count as unread lines. */
const WQA_SECTION_RE=/^(lengths?|sizes?|items?|list)\s*[:：]?\s*$/i;
/* "1." or "1)" at the head of a numbered list — but NOT the "4." of a line
   that simply begins with a decimal. Customers write both, without a space:
   "1.1000 - 1NOS" is item 1, one metre; "4.5 x 100" is a 4.5 mm rod. What
   tells them apart is what follows the dot — a LENGTH (three digits or more,
   or a space before it) rather than a fraction. Stripping "4." turned a 4.5
   into a 5 silently, which the review screen cannot catch. */
const WQA_LIST_NUM_RE=/^\s*\d+\s*(?:\)|\.(?=\s|\d{3}))\s*/;
/* ── An item number written as a word ─────────────────────────────────────
   "3." and "3)" were recognised as list numbering and dropped. "NO3", "NO.3",
   "NO 3", "#3" and "ITEM 3" were not, so the number was left on the line for
   the dimension readers to find:

       NO3 M12 L=1000 TL 70/70 - 3pcs   ->   length 3

   A thousand-millimetre rod quoted as three millimetres, with no warning,
   because the item's own numbering was read as its geometry.

   Kept deliberately narrow. The marker WORD must be there — a bare leading
   number is still handled by the rule above, with its existing guards — and
   there must be something after it, so a line that is nothing but "NO. 3" is
   left alone rather than emptied. */
const WQA_ITEM_NO_RE=/^\s*(?:no|item|#)\s*[.:]?\s*\d+\s*[-.:)]?\s+(?=\S)/i;

/* A nominal diameter is a lookup in the existing size table, not a guess. */
function wqaIsNominal(n){ return DIA_FULLSIZE['M'+String(n).replace(/\.0$/,'')]!==undefined; }

/* Several material and finish names carry digits — 4140, 4340, S45C, SS304,
   SS316, G10.9, G8.8 — so a header line like "S45C STUD" would otherwise be read
   as a 45mm item. They are already detected for the whole message, so they are
   removed from a line before any number is taken from it. */
/* "M10 X 40mm X 2end 20/12mm Thread": the 2 counts THREADED ENDS. It is a
   description of the rod, not a dimension and not a quantity, so it leaves with
   the spec words rather than becoming a stray number. */
const WQA_END_COUNT_RE=/\b(?:1|2|one|two|both|single)\s*[\s-]*ends?\b/i;
function wqaStripSpecWords(str){
  let out=' '+String(str)+' ';
  /* Same veto as the detector: a number that was MEASURED stays on the line as
     a number. Removing it would delete a dimension the review can never ask
     back, which is worse than any grade we might miss. */
  WQA_MATERIALS.forEach(m=>{
    const re=new RegExp(m.re.source,'gi');
    out=out.replace(re,(w,...a)=>{
      const at=a[a.length-2];
      return (m.notAfter && m.notAfter.test(out.slice(0,at))) ? w : ' ';
    });
  });
  WQA_FINISHES.forEach(f=>{ out=out.replace(new RegExp(f.re.source,'gi'),' '); });
  out=out.replace(new RegExp(WQA_END_COUNT_RE.source,'gi'),' ');
  /* "DIN 937" is a standard, not a 937 mm length. */
  WQA_STD_RE.lastIndex=0; out=out.replace(WQA_STD_RE,' ');
  return out.replace(/\s+/g,' ').trim();   // keep the line anchored for "4 - M12 …"
}

/* ── Units ──────────────────────────────────────────────────────────────────
   Every DIMENSION is millimetres inside this system, so a customer who writes
   4 metres gets 4000 and not 4. Only a written unit converts: a bare 500 is
   already millimetres and a bare 4 is a bare 4 — never "obviously metres
   because it is small", which would turn a 4mm dimension into a four-metre rod.

   The nominal SIZE is untouched by all of this. 1/2" is a size, not a length,
   and it stays 1/2" (see the imperial section below). */
const WQA_UNIT_MM={mm:1, millimeter:1, millimetre:1, millimeters:1, millimetres:1,
                   cm:10, centimeter:10, centimetre:10, centimeters:10, centimetres:10,
                   m:1000, meter:1000, metre:1000, meters:1000, metres:1000,
                   'in':25.4, inch:25.4, inches:25.4, ft:304.8, foot:304.8, feet:304.8};
/* Longest names first so "millimetre" is never read as "m". */
const WQA_UNIT_WORDS=Object.keys(WQA_UNIT_MM).sort((a,b)=>b.length-a.length).join('|');
/* A number and its unit, optionally followed by a second number and unit — the
   feet-and-inches form: 2ft 6in, 2' 6", 1ft 3-1/2in. */
const WQA_UNIT_RE=new RegExp(
  '(\\d+(?:\\.\\d+)?)\\s*(?:(' + WQA_UNIT_WORDS + ')\\b|(\'))'
  + '(?:\\s*(\\d+(?:\\.\\d+)?)(?:\\s*[-\\s]\\s*(\\d+)\\s*\\/\\s*(\\d+))?\\s*(?:(in|inch|inches)\\b|("|\u201d|\u2033)))?','ig');
function wqaUnitMm(n,unit){
  const f=unit==="'" ? 304.8 : (WQA_UNIT_MM[String(unit||'').toLowerCase()]||0);
  return f ? Math.round(Number(n)*f*1000)/1000 : null;
}

/* ── Imperial ───────────────────────────────────────────────────────────────
   A customer who quotes in inches writes the nominal size in inches too, and
   our diameter table already speaks that vocabulary — 1/2, 5/8, 3/4, 1", 1-1/4.
   So on an item line the FIRST inch token is the size and keeps its notation
   (1/2" is not M12 and never becomes M12), and every inch token after it is a
   measurement, converted at 25.4 mm to the inch.

   An inch MARK is required. A bare 4.5 has no unit and no context, so it stays
   a bare 4.5 and Review asks — guessing inches there would silently multiply a
   dimension by twenty-five. */
const WQA_IN_MM=25.4;
const WQA_VULGAR={'\u00bc':0.25,'\u00bd':0.5,'\u00be':0.75,
                  '\u215b':0.125,'\u215c':0.375,'\u215d':0.625,'\u215e':0.875};
const WQA_INCH_MARK='(?:\\s*(?:"|\u201d|\u2033)|\\s*\\b(?:in|inch|inches)\\b)';
/* whole+fraction, whole+vulgar, fraction, vulgar, or a plain number — each of
   them only when an inch mark follows. "1\" 3/4" and "1-3/4\"" are the same rod. */
const WQA_INCH_RE=new RegExp(
  '(?:(\\d+)' + WQA_INCH_MARK + '?\\s*[-\\s]\\s*)?(\\d+)\\s*\\/\\s*(\\d+)' + WQA_INCH_MARK
  + '|(\\d+)\\s*([\u00bc\u00bd\u00be\u215b\u215c\u215d\u215e])' + WQA_INCH_MARK
  + '|([\u00bc\u00bd\u00be\u215b\u215c\u215d\u215e])' + WQA_INCH_MARK
  + '|(\\d+(?:\\.\\d+)?)' + WQA_INCH_MARK, 'g');

/* Every inch token on a line, in the order written, with what it measures. */
function wqaInchScan(s){
  const out=[]; let m;
  WQA_INCH_RE.lastIndex=0;
  while((m=WQA_INCH_RE.exec(s))!==null){
    let whole=0, frac=0, isFrac=false;
    if(m[2]!==undefined && m[3]!==undefined){
      whole=m[1]?parseInt(m[1],10):0; frac=parseInt(m[2],10)/parseInt(m[3],10); isFrac=true;
    } else if(m[5]!==undefined){
      whole=parseInt(m[4],10); frac=WQA_VULGAR[m[5]]||0; isFrac=true;
    } else if(m[6]!==undefined){
      frac=WQA_VULGAR[m[6]]||0; isFrac=true;
    } else if(m[7]!==undefined){
      whole=parseFloat(m[7]);
    } else continue;
    const inches=whole+frac;
    if(!(inches>0)) continue;
    out.push({inches, isFrac, raw:m[0].trim(), index:m.index, len:m[0].length,
              whole, fracStr:(m[2]!==undefined?m[2]+'/'+m[3]:'')});
  }
  return out;
}
/* Back into the vocabulary the diameter table already uses: 1/2, 5/8, 1", 1-1/4. */
function wqaInchSize(t){
  if(!t.isFrac) return t.whole===1 ? '1"' : String(t.whole);
  const f=t.fracStr || (()=>{ const q=Math.round(t.inches%1*8);
    return q===2?'1/4':q===4?'1/2':q===6?'3/4':q===1?'1/8':q===3?'3/8':q===5?'5/8':q===7?'7/8':''; })();
  if(!f) return String(t.inches);
  return t.whole ? t.whole+'-'+f : f;
}
function wqaInchMm(t){ return String(Math.round(t.inches*WQA_IN_MM*1000)/1000); }

/* ── L Bolt / J Bolt dimensions ─────────────────────────────────────────────
   These letters mean different things to different products, so they are read
   ONLY inside a product that has them: W is an L Bolt's short leg, ID and S
   belong to a J Bolt, and for a J Bolt the customer's "L"/"Length" IS the
   overall height H. Reading them globally would turn every "x 100 W" in a sag
   rod message into something it is not.

   Both the "ID70" and the "70 ID" forms are written by customers, so both are
   read. A radius — R25, "bend radius 25" — is kept as evidence and is not a
   quotation dimension: it never becomes ID, S, H or W. */
/* The words that mark an inch measurement as a DIMENSION rather than as the
   bolt's nominal size. DIA is deliberately absent: DIA marks the size. */
const WQA_INCH_DIM_AFTER=/^\s*(?:i\.?d\.?|o\.?d\.?|tl|thd|thread|bend|hook|long|lg|[lwhsr])\b/i;
const WQA_DIM_WORDS={
  L:  'overall\\s*length|long\\s*leg|main\\s*length|long\\s*length|length|l',
  W:  'bend\\s*width|short\\s*leg|short\\s*length|bend|width|hook\\s*length|hook|leg|w|b',
  H:  'overall\\s*height|overall\\s*length|height|length|h|l',
  ID: 'inside\\s*dia(?:meter)?|internal\\s*dia(?:meter)?|inner\\s*dia(?:meter)?|inside\\s*width|inner\\s*width|i\\.?d\\.?|id',
  S:  'bend\\s*high|bend\\s*height|hook\\s*height|return\\s*height|short\\s*height|bend|s',
  R:  'bend\\s*radius|radius|r',
};
/* Which of them a product actually owns. */
const WQA_PROD_DIMS={lbolt:['TL','L','W','R'], jbolt:['TL','ID','S','H','R']};
/* Both forms are written — "ID 70mm" and "70mm ID" — so both are read, but as
   TWO patterns rather than one alternation, because which of them matches
   first decides what the number means.

   "OVERALL LENGTH 480 ID 100" contains both: "480 ID" reading backwards, and
   "ID 100" reading forwards. An alternation takes whichever starts further
   left, which was the 480 — a number the line had already given to OVERALL
   LENGTH. Everything then shifted down the line: ID took 480, the hook height
   took the 100 meant for ID, and the overall height took the 120 meant for the
   hook. Three wrong dimensions, a wrong developed length, a wrong weight and a
   wrong price, from one line that said exactly what it meant.

   A label reaches FORWARD to the number written after it first, and only looks
   backwards when nothing follows it. */
const WQA_DIM_RE=(function(){
  const out={};
  Object.keys(WQA_DIM_WORDS).forEach(k=>{
    const w=WQA_DIM_WORDS[k];
    out[k]={
      after:new RegExp('\\b(?:'+w+')\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:mm\\b)?','i'),
      before:new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:mm\\b)?\\s*(?:'+w+')\\b','i'),
    };
  });
  return out;
})();
/* The thread, in the wording all three of these products share. */
const WQA_TL_WORDS='\\bt\\.?l\\.?|thread(?:ed)?(?:\\s*(?:length|portion|part|section))?';
const WQA_TL_DIM_RE={
  after:new RegExp('(?:'+WQA_TL_WORDS+')\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:mm\\b)?','i'),
  before:new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:mm\\b)?\\s*(?:'+WQA_TL_WORDS+')\\b','i'),
};
function wqaDimLabelled(s,key){
  const re = key==='TL' ? WQA_TL_DIM_RE : WQA_DIM_RE[key];
  if(!re) return null;
  const hit=(rx,g)=>{
    const m=rx.exec(s);
    if(!m) return null;
    const v=m[g];
    return (v!=null && Number(v)>0) ? {v:String(Number(v)), at:m.index, len:m[0].length} : null;
  };
  return hit(re.after,1) || hit(re.before,1);
}
/* Every labelled dimension THIS product owns, taken out of the line so what is
   left is positional. Longest/most specific keys first: ID before S before H,
   because "inside dia" contains a d and an i that a one-letter rule would eat. */
function wqaProductDims(s,type){
  const keys=WQA_PROD_DIMS[type];
  if(!keys) return null;
  const out={}; let rest=' '+String(s)+' ';
  /* A radius in drawing notation — "R25 BEND" — is read before anything else.
     BEND on its own is also how a bend width and a bend height are written, and
     whichever of those the product asks for first would otherwise take the
     radius's number and quote it as a measurement of the bolt. */
  if(keys.indexOf('R')>=0){
    const rm=/(^|[\s(,])r\s*(\d+(?:\.\d+)?)\s*(?:mm)?(?=[\s),]|$)/i.exec(rest);
    if(rm){
      out.R=rm[2];
      const at=rm.index+rm[1].length;
      rest=rest.slice(0,at)+' '+rest.slice(rm.index+rm[0].length);
    }
  }
  keys.forEach(k=>{
    if(k==='R' && out.R!==undefined) return;
    const hit=wqaDimLabelled(rest,k);
    if(!hit) return;
    out[k]=hit.v;
    rest=rest.slice(0,hit.at)+' '+rest.slice(hit.at+hit.len);
  });
  return {dims:out, rest:rest.replace(/\s+/g,' ').trim()};
}

/* The one wording that names a quantity and nothing else. "pcs", "sets" and
   "nos" are counted words too, but they only ever appear WITH their number —
   so a line carrying this word and no readable figure is a customer who meant
   to state a count and did not, which is not the same as never mentioning one.
   See f.qtyOpen at the foot of wqaExtractFields. */
const WQA_QTY_WORD_RE=/\b(?:qty|quantity)\b/i;
/* A quantity stated twice, and differently: "qty 100 / 200", "qty 100 or 200",
   "qty 100 - 200", "quantity 50 to 80". The wording has to be there and the
   line has to be nothing else, because a slash between two numbers is a thread
   pair everywhere else in this trade. No semantics are invented for it — the
   line is refused, not interpreted. See wqaExtractFields. */
const WQA_QTY_AMBIG_RE=new RegExp(
  '^\\s*(?:qty|quantity)\\s*[:=]?\\s*'
  + '\\d+(?:\\.\\d+)?\\s*(?:\\/|\\bor\\b|\\bto\\b|~|-|–)\\s*\\d+(?:\\.\\d+)?'
  + '\\s*(?:pcs?|nos?|no\\.|sets?|units?|items?)?\\s*[.,]?\\s*$','i');
/* ── The same ambiguity, written on the item's own line ──────────────────
   "M24 x 300 x tl 65/65 qty 100 / 200" is the identical statement — a count
   given twice, differently — and it was silently resolved to 100 while the
   own-line form was correctly refused. A rule that holds in one position and
   not the other is not a rule; it is a place the customer happened not to
   press.

   Anchoring the original to the whole line was deliberate and stays: a slash
   between two numbers is a THREAD PAIR everywhere else in this trade, and
   "M24 x 300 x 100/200" must never be read as a quantity. What makes the
   inline form safe to detect is the same thing that makes the own-line form
   safe — the word. The quantity marker must sit immediately in front of the
   two numbers, so a thread pair, a length range and a dimension chain are all
   untouched because none of them is preceded by "qty".

   The difference from the own-line case is what happens next. There, the
   whole line was nothing but the unreadable count, so it is emptied. Here the
   line is a real item that also carries an unreadable count: only the phrase
   is consumed, the geometry is read as normal, and the row asks for its
   quantity instead of inventing one. */
const WQA_QTY_AMBIG_INLINE_RE=new RegExp(
  '(?:^|[\\s,;(])(?:qty|quantity)\\s*[:=]?\\s*'
  + '\\d+(?:\\.\\d+)?\\s*(?:\\/|\\bor\\b|\\bto\\b|~|-|–)\\s*\\d+(?:\\.\\d+)?'
  + '\\s*(?:pcs?|nos?|no\\.|sets?|units?|items?)?','i');

/* ── Field recognisers ──────────────────────────────────────────────────────
   Each one consumes what it matches, so a consumed qty token can never be
   re-read as part of a diameter ("4pcs - M12" never becomes 4PCSM12).      */
/* opts.product lets a line be read with ITS product's vocabulary — see
   wqaProductDims. Without one, none of those letters mean anything. */
function wqaExtractFields(rawLine,opts){
  let s=wqaNorm(rawLine).replace(WQA_ITEM_NO_RE,'').replace(WQA_LIST_NUM_RE,'');
  /* The line as it arrived, kept whole: every reader below CONSUMES what it
     matches, so by the end there is nothing left to ask what the line said. */
  const s0=s;
  const f={qty:null,size:null,threadLen:null,threadLen2:null,nums:[],mm:[],bodyDia:null,
           dims:null, hadX:/\sx\s|\dx\d/i.test(s), threadEnds:null, fullyThreaded:false,
           /* The line used the word and gave no number any reader here could
              take. See wqaQtyOpen below. */
           qtyOpen:false};
  /* Read the threading off the line AS WRITTEN — the spec-word strip below
     removes the very words that say how many ends there are. */
  const ev=wqaThreadEvidence(s);
  f.threadEnds=ev.explicitEndCount;
  f.fullyThreaded=ev.fullyThreaded;
  s=wqaStripSpecWords(s);
  /* ── Two numbers is not a quantity ───────────────────────────────────────
     "qty 100 / 200" states a count and then states a different one. There is
     no reading of that which is not a guess, so nothing is read.

     It has to be settled HERE, before any reader below touches the line,
     because every one of them would take the first number and leave the
     second behind. That is what used to happen: the marker took 100, the
     leftover 200 became a phantom item carrying a length — and the REAL item,
     never told anything was wrong, took the absent-quantity default and went
     out at ONE PIECE. An ambiguous count silently became 1, which is the
     exact substitution the absent-quantity rule exists to keep separate.

     The whole line must be the wording and the two numbers, so a rod that
     happens to carry a thread pair — "M24 x 300 x 100/200" — is untouched:
     the ambiguity is in the QUANTITY wording and nowhere else. The line is
     then emptied, so it is not an item, carries no dimensions, and reaches
     the continuation reader as what it is: an unanswered count belonging to
     the row above it. */
  if(WQA_QTY_AMBIG_RE.test(s)){ f.qtyOpen=true; s=''; }
  else {
    /* Same statement, mid-line. Only the phrase goes, so the item keeps its
       size, its length and its thread and loses only the count nobody can
       read — which is exactly what the row is then asked for. */
    const amb=WQA_QTY_AMBIG_INLINE_RE.exec(s);
    if(amb){
      f.qtyOpen=true;
      s=s.slice(0,amb.index)+' '+s.slice(amb.index+amb[0].length);
    }
  }
  /* "2k pcs" is two thousand pieces. Taken out first so the 2 never becomes a
     dimension, and only ever where the count context is written. */
  const qk=WQA_QTY_K_RE.exec(s);
  if(qk){
    f.qty=Math.round(Number(qk[1]!==undefined?qk[1]:qk[2])*1000);
    s=s.slice(0,qk.index)+' '+s.slice(qk.index+qk[0].length);
  }
  /* A "2k" with no count word beside it is a number whose role nobody has
     established: it is certainly not a 2mm dimension, and it is not a quantity
     either until the message says so. It leaves the line unread, and Review
     asks — which is the whole rule in one number. */
  s=s.replace(/\b\d+(?:\.\d+)?\s*k\b/gi,' ');
  /* Metres, centimetres and feet become millimetres here, once, so everything
     downstream — weight, price, the printed dimension — speaks one unit. The
     feet-and-inches pair is one measurement: 2ft 6in is 762mm, not 2 and 6. */
  s=s.replace(WQA_UNIT_RE,(w,n1,u1,ft,n2,wh,fr,u2,mark)=>{
    let mm=wqaUnitMm(n1, u1||ft);
    if(mm==null) return w;
    if(n2!=null){                        // "2ft 6in" / "1ft 3-1/2in"
      let inch=Number(n2);
      if(wh!=null&&fr!=null&&Number(fr)>0) inch=Number(n2)+Number(wh)/Number(fr);
      mm=Math.round((mm+inch*WQA_IN_MM)*1000)/1000;
    }
    return ' '+mm+'mm ';
  });
  /* "SS304 (body 38.1) Sag Rod M32 x 1000" states the body diameter in the
     middle of a real item line, so it is taken out here — before any number is
     read — exactly as an inch token is. Left in, the 38.1 would win the length. */
  if(!WQA_CENTER_RE.test(s))
    s=s.replace(WQA_BODY_NUM_RE,(w,v)=>{ if(f.bodyDia==null) f.bodyDia=String(Number(v)); return ' '; });

  /* Inch tokens are read and REMOVED before anything else looks at the line, so
     the fraction in 3/4" can never be mistaken for a 3/4 thread pair. */
  /* A pitch is taken out before any dimension reader sees it: "M12 x 1.75P" is
     a size and a pitch, and the 1.75 is neither a length nor a thread nor an
     inside diameter. */
  f.pitch=wqaPitchValue(s);
  if(f.pitch!==null) s=s.replace(WQA_PITCH_RE,' ');
  /* And the form that carries no marker at all: "M12 x 1.75". It is read ONLY
     in the one shape that cannot be anything else — directly after a metric
     size, written as a fraction of a millimetre, in the range a pitch actually
     occupies. "M12 x 300" is a length and stays one; "M12 x 30.5" is not a
     pitch either. Where it does fire, the number is taken out of the line, so
     "M12 x 1.75 x 300" keeps its 300 as the length it is. */
  if(f.pitch===null){
    const bare=WQA_BARE_PITCH_RE.exec(s);
    if(bare && Number(bare[1])>0 && Number(bare[1])<=WQA_BARE_PITCH_MAX){
      f.pitch=String(Number(bare[1]));
      s=s.slice(0,bare.index)+bare[0].replace(bare[1],' ')+s.slice(bare.index+bare[0].length);
    }
  }
  /* And the series word comes out for the same reason the pitch does. It is a
     WORD, so no dimension reader was ever going to misread it — but it stood
     BETWEEN the size and the separator, and the unmarked-inch reader below
     needs the size to be followed by its x. "1/2 UNC x 1020 x 100/100" left
     the 1/2 on the line for the thread reader, which read it as the pair 1 and
     2 and returned an empty size box. Read here, removed here. */
  f.series=wqaSeriesValue(s);
  if(f.series) s=s.replace(WQA_SERIES_RE,' ').replace(/\s+/g,' ').trim();
  const inch=wqaInchScan(s);
  let inchNums=null;
  if(inch.length){
    const threadLine=WQA_THREAD_WORD_RE.test(wqaNorm(rawLine));
    if(threadLine && inch.length<=2){
      for(let k=inch.length-1;k>=0;k--) s=s.slice(0,inch[k].index)+' '+s.slice(inch[k].index+inch[k].len);
      /* "TL 3/4\" / 1\"" — both ends, in inches, in the order written. */
      f.threadLen=wqaInchMm(inch[0]);
      if(inch.length>1) f.threadLen2=wqaInchMm(inch[1]);
      inchNums=[];
    } else {
      /* The first inch token is the nominal size — UNLESS the word beside it
         says it is a dimension. A one-inch bolt is written DIA; an inside
         diameter of three inches is written ID, on a bolt whose size was stated
         a line earlier. Reading the second as a size is how one J Bolt became
         two rows, the second of them an invented M3. */
      const sizeFirst=!WQA_INCH_DIM_AFTER.test(s.slice(inch[0].index+inch[0].len));
      /* Measurements are written BACK where they stood, in millimetres, because
         the word beside them is what says which dimension they are. Deleting
         them first is what left BEND with nothing to attach to. */
      for(let k=inch.length-1;k>=(sizeFirst?1:0);k--)
        s=s.slice(0,inch[k].index)+' '+wqaInchMm(inch[k])+'mm '+s.slice(inch[k].index+inch[k].len);
      if(sizeFirst){
        f.size=wqaInchSize(inch[0]);
        s=s.slice(0,inch[0].index)+' '+s.slice(inch[0].index+inch[0].len);
      }
      inchNums=[];                     // they are in the line now, in order
    }
    s=s.replace(/\s+/g,' ').trim();
  }

  /* qty — an explicit marker wins wherever it sits on the line */
  let m=s.match(/\bqty\s*[:=]?\s*(\d+)\b|@\s*(\d+)\b/i);
  if(m && m[2]!==undefined) m=[m[0],m[2]];
  if(m){ f.qty=parseInt(m[1],10); s=s.replace(m[0],' '); }
  if(f.qty===null){
    m=s.match(/(?:^|[\s\-])(\d+)\s*(?:pcs|pc|nos|no|units|unit|sets|set)\b/i);
    if(m){ f.qty=parseInt(m[1],10); s=s.replace(m[0],' '); }
  }
  /* qty written first with only a dash to mark it ("4 - M12 x 853 x 70/70mm").
     Accepted ONLY when what follows still carries a full spec — an explicit
     M-size or two or more numbers — so a length list row like "405 - 8" is not
     misread as qty 405. Consumed here, before any dimension parsing, so the
     number can never fuse into the diameter. */
  if(f.qty===null){
    m=s.match(/^(\d+)\s*-\s*(?=\S)/);
    if(m){
      const rest=s.slice(m[0].length);
      if(/\bm\s*\d/i.test(rest)||(rest.match(/\d+(?:\.\d+)?/g)||[]).length>=2){
        f.qty=parseInt(m[1],10); s=rest;
      }
    }
  }
  /* diameter — M12 / m 12 */
  /* The size ends at a separator as well as at a word boundary: in the compact
     shorthand "M20x500x100x100" there is no space after the 20, and a size that
     failed to match here left its M behind and its 20 in the number pile. */
  m=s.match(/\bm\s*(\d+(?:\.\d+)?)(?=\s*[x*×]|\b)/i);
  if(m){ f.size='M'+m[1].replace(/\.0$/,''); s=s.replace(m[0],' '); }
  /* "10mm Dia" / "Dia 10mm" is the rod's nominal size when the table knows it.
     Never after inside / inner / body: those are other diameters. */
  if(!f.size){
    m=s.match(/(?<!(?:inside|internal|inner|body|hole)\s*)\b(\d+(?:\.\d+)?)\s*mm\s*(?:dia(?:meter)?|ø)(?![a-z])|(?<!(?:inside|internal|inner|body|hole)\s*)\b(?:dia(?:meter)?|ø)\s*[:.]?\s*(\d+(?:\.\d+)?)\s*mm\b/i);
    const dv=m && (m[1]||m[2]);
    if(dv && wqaIsNominal(dv)){ f.size='M'+String(Number(dv)); s=s.replace(m[0],' '); }
  }
  /* A drawing writes an undersized rod's nominal diameter as R12. The R is the
     draughtsman's notation for the round bar it is cut from, not a different
     size, and the quotation speaks in M sizes — so it is read as M12 and the
     undersize meaning travels where it belongs, in Size Type. Read ONLY where
     the message itself shows that context (see wqaParseText); an R12 in an
     unrelated note is never guessed at. */
  /* R12 is draughtsman's notation for an undersized rod — but R25 next to the
     word BEND is a bend radius, and reading it as a nominal size would change
     the diameter, the weight and the price. */
  if(!f.size && opts && opts.rodSize && !/\bbend|radius|hook\b/i.test(s)){
    m=s.match(WQA_ROD_R_RE);
    if(m){ f.size='M'+m[1].replace(/\.0$/,''); s=s.replace(m[0],' '); }
  }
  /* ── An inch size written without its mark ─────────────────────────────────
     "1/2 x 100 x 100/100" is a half-inch rod, 100 long, threaded 100 at each
     end. The mark is optional in practice and was mandatory here, so the line
     reached the thread reader with its diameter still on it — and a thread pair
     is exactly "number slash number", so 1/2 became thread 1 and thread 2 and
     the size box came back empty.

     The run is read POSITIONALLY, in the order this trade writes it:
     [SIZE] x [LENGTH] x [THREAD]. So the first token of a dimension run is a
     candidate SIZE before it is anything else, and only what is left of the run
     goes to the thread and length readers.

     A fraction at the head of a run is always the size: nothing writes a thread
     as 1/2, because a thread is a length in millimetres. It is taken whether or
     not the diameter table knows it — an unrecognised 9/16 is shown, flagged
     Needs Valid Size and never weighed, which is the honest answer where a
     mis-assigned thread is not.

     A WHOLE number is genuinely ambiguous — "1000 x 100" is a length and a
     thread — so it is read as inches only for a size the diameter table
     actually holds, and only when two further numbers follow it. Never over a
     metric size the line already stated: "M20 x 500 x 100/100" never reaches
     here. */
  if(!f.size && f.hadX){
    const hm=/^\s*(\d+\s*[-\s]\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+)\s*x\s/i.exec(s);
    if(hm){
      const key=hm[1].replace(/\s*\/\s*/,'/').replace(/\s*[-\s]\s*/,'-');
      const isFrac=key.indexOf('/')>=0;
      const after=(s.slice(hm[0].length).match(/\d+(?:\.\d+)?/g)||[]).length;
      if(isFrac ? after>=1 : (WQA_INCH_DIA[key]!==undefined && after>=2)){
        /* The vocabulary the diameter table already speaks — 1/2, 5/16, 1-1/4,
           1" — so an inch size read off an unmarked line and one read off a
           marked one are the same string and weigh the same. It is NEVER
           turned into a metric size: 1/2" is not M12. */
        f.size = isFrac ? key : key+'"';
        s=s.slice(hm[0].length);
      }
    }
  }
  /* Two-side thread "50/110mm": BOTH ends are kept. The calculator's threadLen
     is a free-text field and already reads the pair form (its MS/UNDERSIZE/PL
     special price keys on "100/100"), so nothing is discarded or invented. */
  m=s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:mm)?/);
  if(m){ f.threadLen=String(Number(m[1])); f.threadLen2=String(Number(m[2])); s=s.replace(m[0],' '); }
  /* ── The thread this line stated in words ───────────────────────────────
     "both end thread 80mm" and "thread 80 one side, thread 120 other side"
     name their values as plainly as "80/120" does; without this they were left
     in the pile of loose numbers and read as a length, or dropped as extra.
     Applied only where the line is a full item that has not already written a
     pair, and only when every value claimed can be taken back out of the line
     — a number that cannot be found is a number that was already read as
     something else, and a half-applied reading is worse than none.

     A line carrying inch measurements contributes its END COUNT only: its
     numbers are converted further down and must not be read twice. */
  if(f.threadLen===null && ev.cut.length && !inch.length && f.size){
    let t=s, ok=true;
    ev.cut.forEach(v=>{ const c=ok?wqaCutNum(t,v):null; if(c===null) ok=false; else t=c; });
    if(ok){
      s=t;
      f.threadLen=ev.firstEnd;
      f.threadLen2=(ev.secondEnd!=null && ev.secondEnd!==ev.firstEnd) ? ev.secondEnd
                 : (ev.explicitEndCount===2 ? ev.firstEnd : null);
    }
  }
  /* qty as a bare trailing "- 4" once the markers above found nothing */
  if(f.qty===null){ m=s.match(/-\s*(\d+)\s*$/); if(m){ f.qty=parseInt(m[1],10); s=s.slice(0,m.index); } }
  /* ── A row's own thread, labelled and with no ends named ─────────────────
     "821mm - 4 pcs thread length 50mm" under a heading that says THREAD
     LENGTH 70MM is a 50 thread for THIS row. Left in the pile, the 50 was an
     extra number and the row quietly took the heading's 70 instead.

     Bounded: the line must already be an item — a quantity and a number still
     standing for its length — so a heading or a thread line of its own is
     still read by the header plan exactly as before. Never where the ends were
     named (that reader above owns those), never over an inch line, and never
     for an L Bolt or J Bolt, whose TL is read by its own labelled schema. */
  if(f.threadLen===null && f.qty!==null && !ev.found.length && !inch.length &&
     !/^(?:lbolt|jbolt)$/.test((opts&&opts.product)||'')){
    m=WQA_ROW_TL_RE.exec(s);
    const v=m ? Number(m[1]) : NaN;
    const rest=m ? s.slice(0,m.index)+' '+s.slice(m.index+m[0].length) : '';
    if(v>0 && v<=WQA_THREAD_MAX && /\d/.test(rest)){
      f.threadLen=String(v);
      s=rest.replace(/\s+/g,' ').trim();
    }
  }
  /* Whatever numbers remain, in the order written. "mm" is kept as a per-number
     flag: an explicitly dimensional value next to a bare one is a strong clue
     that the bare one is a count, not another dimension. Leading zeros are
     normalised, so "0487mm" is length 487. */
  /* An L Bolt or a J Bolt names its dimensions, and they are taken out before
     the positional read so "TL150" is a thread and not a length. */
  const pd=wqaProductDims(s,(opts&&opts.product)||'');
  if(pd && Object.keys(pd.dims).length){ f.dims=pd.dims; s=pd.rest; }
  const raw=(s.match(/\d+(?:\.\d+)?\s*mm\b|\d+(?:\.\d+)?/gi)||[]);
  f.nums=raw.map(t=>{ const n=Number(String(t).replace(/\s*mm$/i,'')); return isFinite(n)?String(n):String(t); });
  f.mm  =raw.map(t=>/mm\s*$/i.test(t));
  /* Converted inch measurements lead, in the order the customer wrote them:
     they are the dimensions, and any bare number left over comes after. */
  if(inchNums && inchNums.length){
    f.nums=inchNums.concat(f.nums);
    f.mm=inchNums.map(()=>true).concat(f.mm);
  }
  /* ── The line asked for a quantity and did not give one ──────────────────
     "qty ?", "qty tbc", "qty:" with nothing after it. Every reader above has
     had its turn and none of them found a number, and the word is explicit
     enough that this cannot be an oversight: the customer meant to state a
     count. That is the opposite of an ABSENT quantity, which is one piece —
     so it is recorded here and the row asks, rather than quietly becoming 1.

     Only the explicit words. A count read from "pcs" or from a bare trailing
     "- 4" always resolves, so it can never reach this line unresolved. */
  if(f.qty===null && WQA_QTY_WORD_RE.test(s0)) f.qtyOpen=true;
  return f;
}

/* Resolve one line's fields against the running context. Explicit values on the
   line always beat the context. */
/* An L Bolt / J Bolt row, built from what the line actually named. It shares
   the row shape with every other product — size, qty, thread — and adds only
   the dimensions that product has. */
function wqaBoltItem(f,type){
  const item={M:f.size||null, L:null, W:null, H:null, ID:null, S:null, R:null,
              TL:null, qty:(f.qty==null?null:String(f.qty)),
              qtyOpen: f.qty==null && !!f.qtyOpen,
              product:type, threadEnds:1,
              conf:{}, issues:[], defaulted:{}};
  if(f.threadLen!==null) item.TL=f.threadLen2 ? f.threadLen+'/'+f.threadLen2 : f.threadLen;
  if(f.bodyDia!=null) item.bodyDia=f.bodyDia;
  if(f.pitch) item.pitch=f.pitch;
  if(f.series) item.series=f.series;
  wqaPlaceProductDims(item,f,type);
  ['M','L','W','H','ID','S','TL','qty'].forEach(k=>{ if(item[k]) item.conf[k==='M'?'size':k]=WQA_CONF.DETECTED; });
  return item;
}
/* An L Bolt's and a J Bolt's dimensions, placed by name where the customer
   labelled them and by position only where this product's grammar makes the
   position unambiguous:
     L Bolt   M x L x W        — two positional numbers, in that order
     J Bolt   M x H            — ONE positional number; anything else has to be
                                 labelled, because a bare third number could be
                                 ID, S or the thread and guessing which would be
                                 a quotation-sized mistake.
   Whatever is left over is left over: unplaced numbers are not fields. */
function wqaPlaceProductDims(item,f,type){
  const d=(f.dims)||{};
  const pos=(f.nums||[]).slice();
  const take=()=>pos.length?String(Number(pos.shift())):'';
  if(d.R) item.R=d.R;
  if(type==='lbolt'){
    item.L = d.L || (item.L!=null?item.L:'') || take();
    item.W = d.W || take();
    /* "M20x500x100x100" is the compact shorthand a customer types on a phone:
       size, long leg, short leg, thread — in that order, and only in that
       order. A third positional number is the thread ONLY when the first two
       filled L and W from the same line; anything less certain is left over. */
    if(d.TL) item.TL=d.TL;
    else if(!item.TL && item.L && item.W && pos.length===1) item.TL=take();
    return true;
  }
  if(type==='jbolt'){
    item.H = d.H || take();
    item.ID = d.ID || '';
    item.S  = d.S  || '';
    if(d.TL) item.TL=d.TL;
    item.L=null;                 // a J Bolt has no separate length
    return true;
  }
  return false;
}
function wqaResolveLine(f,ctx,productType){
  /* A message whose ROWS say what they are — "thread one end 100" — reaches
     here before any product is settled, so the general shape stands in and the
     row's own product is resolved a step later, in the normaliser. */
  const prod=wqaProductByType(productType)||WQA_NO_PRODUCT;
  const wantsThread=prod.dims.includes('threadLen');
  const issues=[], defaulted={}, conf={};
  let seen=null;                       // thread evidence this product cannot hold
  const row={size:'',length:'',threadLen:'',threadLen2:'',qty:''};
  const nums=f.nums.slice();

  if(f.size){ row.size=f.size; conf.size=WQA_CONF.DETECTED; }
  if(f.threadLen!==null && wantsThread){
    row.threadLen=f.threadLen; conf.threadLen=WQA_CONF.DETECTED;
    if(f.threadLen2!==null) row.threadLen2=f.threadLen2;
  } else if(f.threadLen!==null && !wantsThread){
    /* The product this line names has no thread — a Stud with "one end thread
       75mm" on it. The 75 is not written into the row (a Stud has no such
       field) and it is not thrown away either: it is kept beside the row, so
       that when a person settles the product the system does not ask them to
       retype something it had already read. */
    seen=f.threadLen2!==null ? f.threadLen+'/'+f.threadLen2 : f.threadLen;
    issues.push('extra');
  }

  if(f.qty!==null){ row.qty=String(f.qty); conf.qty=WQA_CONF.DETECTED; }

  /* ── Which fields do the leftover numbers still have to fill? ─────────────
     Work out what is ALREADY satisfied — by the row itself or by inherited
     context — and only offer the unresolved fields as targets. This is what
     stops "1300mm x 6" from spending its 6 on a thread that the header already
     supplied: with diameter and thread both known, the open targets are Length
     and Qty, so it reads 1300 / 6.

     Thread stays open when the row restates its own diameter, because a row
     writing "M16 x 1000 x 100" is a full spec and means to override the header.

     Two clues close the thread slot early:
       · context already carries a thread and this row is not a full restatement
       · an explicitly dimensional number ("1300mm") sits beside a bare one,
         which reads as a count rather than a second dimension            */
  const rowRestatesDiameter=!!f.size;
  const mmMixed=(f.mm||[]).some(Boolean) && (f.mm||[]).some(v=>!v);
  let threadOpen = wantsThread && f.threadLen===null;
  if(threadOpen && ctx.threadLen && !rowRestatesDiameter) threadOpen=false;
  if(threadOpen && mmMixed && f.qty===null)               threadOpen=false;

  const targets=[];
  if(!row.size && !ctx.size && nums.length>=2 && wqaIsNominal(nums[0])) targets.push('size');
  targets.push('length');
  if(threadOpen) targets.push('thread');
  if(f.qty===null) targets.push('qty');

  targets.forEach(t=>{
    if(!nums.length) return;
    if(t==='qty' && !/^\d+$/.test(nums[0])) return;      // a count is a whole number
    const v=nums.shift();
    if(t==='size')        { row.size='M'+v;   conf.size=WQA_CONF.DETECTED; }
    else if(t==='length') { row.length=v;     conf.length=WQA_CONF.DETECTED; }
    else if(t==='thread') { row.threadLen=v;  conf.threadLen=WQA_CONF.DETECTED; }
    else if(t==='qty')    { row.qty=v;        conf.qty=WQA_CONF.DETECTED; }
  });
  /* A third dimension number is the thread on the second end, written the long
     way ("m12 x 1000 x 100 x 120"). Both ends are kept, same as the "100/120"
     form — neither is dropped. */
  if(nums.length && row.threadLen && !row.threadLen2 && wantsThread){
    row.threadLen2=nums.shift();
    if(row.threadLen2===row.threadLen) defaulted.threadLen2=true;   // simply repeated
  }
  if(nums.length) issues.push('extra');

  /* Inheritance fills only what the line left empty. */
  if(!row.size && ctx.size){ row.size=ctx.size; conf.size=WQA_CONF.INHERITED; }
  if(wantsThread && !row.threadLen && ctx.threadLen){
    row.threadLen=ctx.threadLen; conf.threadLen=WQA_CONF.INHERITED;
    if(ctx.threadLen2) row.threadLen2=ctx.threadLen2;
  }
  if(row.qty==='') conf.qty=WQA_CONF.UNCERTAIN;   // optional: recorded, not an issue

  /* Out as ONE extracted item, in the same shape a photo or a PDF produces.
     What each number MEANS was this function's job; how it is represented,
     validated and flagged is wqaNormalizeExtraction's — for every source. */
  /* Two values written on one row are two ends — the same reading a "both
     ends" phrase gets, and the reason "M24 x 1500 x thread 100/120" is a Sag
     Rod without anyone having written the words. A repeat of the same number
     from the positional read is not evidence of anything and stays out of it. */
  const statedPair=!!(row.threadLen && row.threadLen2 && !defaulted.threadLen2);
  return {item:{M:row.size, L:row.length,
                TL:row.threadLen ? (row.threadLen2?row.threadLen+'/'+row.threadLen2:row.threadLen) : null,
                TLseen:seen,
                threadEnds: statedPair ? 2 : undefined,
                qty:row.qty===''?null:row.qty,
                /* Only where the box is still empty: a line that wrote "qty"
                   and then had its count filled by the positional read has a
                   quantity, and nothing is open about it. */
                qtyOpen: row.qty==='' && !!f.qtyOpen,
                conf, issues, defaulted}};
}

/* True when a line carries nothing we recognise — greetings, thanks, notes. */
/* ── Thread series and pitch ────────────────────────────────────────────────
   UNC, UNF and BSW name a thread SERIES; "M12 x 1.75P" names a pitch. The
   quotation schema has a field for neither, so neither is turned into one — a
   pitch that became a length or an ID would be a quotation-sized mistake. They
   are read so the line is not counted as unread noise, kept beside the row as
   evidence the way a body diameter and a bend radius are, and shown in Review.
   Nothing downstream prices from them. */
const WQA_SERIES_RE=/\b(unc|unf|unef|bsw|bsf|bspt?|npt)\b/i;
/* "1.75P", "P1.75", "pitch 1.75" — a pitch always carries its own marker. A
   bare second number never becomes one: "M12 x 280" is a length. */
const WQA_PITCH_RE=/\b(?:p\s*[:=]?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*p|pitch\s*[:=]?\s*(\d+(?:\.\d+)?))\b/i;
/* An UNMARKED pitch, and only where the shape settles it: a metric size, the
   separator, and a number with a decimal fraction no larger than a real coarse
   pitch. A length is written in whole millimetres and is two or three digits;
   the two shapes do not overlap, which is the only reason this is safe. */
const WQA_BARE_PITCH_RE=/\bM\s*\d+(?:\.\d+)?\s*[x\u00d7*]\s*(\d+\.\d+)(?![\d.])/i;
const WQA_BARE_PITCH_MAX=6;      /* the coarsest metric pitch in the tables */
function wqaPitchValue(s){
  const m=WQA_PITCH_RE.exec(String(s||''));
  if(!m) return null;
  const v=m[1]!==undefined?m[1]:(m[2]!==undefined?m[2]:m[3]);
  const n=Number(v);
  /* A thread pitch is a fraction of a millimetre to a few millimetres. Anything
     else wearing a P is not a pitch and is left alone. */
  return (isFinite(n) && n>0 && n<=12) ? String(n) : null;
}
function wqaSeriesValue(s){ const m=WQA_SERIES_RE.exec(String(s||'')); return m?m[1].toUpperCase():''; }
function wqaLineHasSignal(line,common){
  if(WQA_SERIES_RE.test(' '+wqaNorm(line)+' ')) return true;
  const n=' '+wqaNorm(line).toLowerCase()+' ';
  if(/\d/.test(n)) return true;
  /* "Qty tbc" carries no digit at all, so it read as noise and was thrown away
     with the greetings — and the row above it then looked like an item nobody
     had stated a count for, which is the one thing it is not. The word is the
     signal here; the missing number is the point. */
  if(WQA_QTY_WORD_RE.test(n)) return true;
  if(WQA_PRODUCTS.some(p=>p.aliases.some(a=>n.includes(a)))) return true;
  if(WQA_MATERIALS.some(m=>m.re.test(n))) return true;
  if(WQA_FINISHES.some(x=>x.re.test(n))) return true;
  if(/\bfull\s*size\b|\bf\/s\b|\bunder\s*size\b|\bu\/s\b/i.test(n)) return true;
  return false;
}

/* ── Shared spec headers ────────────────────────────────────────────────────
   A line that states the diameter and ONE short dimension, carries no quantity,
   and sits above a list of much longer rows is the shared specification for
   that list, not a row of its own: "M12 X 75MM" over 1000 and 2000 means M12
   with a 75mm thread, never a 75mm rod.

   The pair spelling ("M12 x 75/75") already reads as context, because the
   thread recogniser consumes both of its numbers. These are the single-value
   spellings the same messages use — 75MM, THREAD 75, TL 75, x thread 75mm.

   The judgement is structural, not a customer format. The line must carry a
   diameter, no quantity and exactly one leftover number, and what follows it
   must be quantities written against lengths several times larger. Where the
   wording says "thread" outright, the wording decides and no ratio is needed.
   Where the evidence sits between the two, nothing is guessed: the row is kept
   but the parse is reported as low confidence, which sends the message to the
   existing AI fallback rather than showing a thread length as an item.      */
const WQA_THREAD_WORD_RE=/\b(?:thread|threaded|thd|tl\d?|t\s*\/\s*l)\b/i;
/* "thread length 50mm", "THREAD 50", "TL 50", "TL50" — a label, then the value.
   "TL1 60" names an END and is left to the thread-line reader. */
const WQA_ROW_TL_RE=/\b(?:thread(?:ed)?(?:\s*(?:length|len|lg))?|thd|tl(?![12]\b)|t\s*\/\s*l)\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*(?:mm\b)?(?![\d.])(?!\s*(?:pcs?|nos?|no\.|sets?|units?|items?)\b)/i;
const WQA_THREAD_MAX=200;    /* beyond this a bare number is a length, not a
                                thread — the catalogue's longest is 150 */
const WQA_HEADER_RATIO=3;    // "much larger": the list is at least 3x the spec
const WQA_AMBIG_RATIO=1.5;   // between the two the structure cannot decide

/* A thread value stated on a line of its OWN — "thread 60", "TL1 60", "left
   thread 60", "top thread 250", "60 thread". Two of these in one block are the
   two ENDS of one rod, in the order written; they are never a repeat of the same
   end, so "thread 60 / thread 70" is 60/70 and never 60/60. */
const WQA_END_LABEL_RE=/\b(?:tl|t)[12]\b/ig;
function wqaThreadOnlyValue(e){
  if(!e || !e.f) return null;
  const f=e.f;
  if(f.size || f.qty!==null || f.threadLen!==null) return null;
  const n=e.n||'';
  /* "both end 100" names the ends without using the word thread; on a rod that
     is the only thing an end can be measuring. */
  if(!WQA_THREAD_WORD_RE.test(n) && !WQA_BOTH_END_RE.test(n) && !WQA_ONE_END_RE.test(n)
     && !WQA_OTHER_END_RE.test(n)) return null;
  /* In "TL1 60" the 1 names the END, not a measurement, so the label is taken
     off before the line's numbers are counted. Only the attached form is a
     label: "thread 12" really is a 12mm thread and is left alone. */
  /* ── And the grade is a material, not a measurement ──────────────────────
     "4140 sag rod, both thread 65mm, plain" is a spec header. The 4140 was
     already read as the material, but this reader counted it a second time as
     a number — two numbers meant "not a thread line", so the header was read
     as an ITEM and a phantom rod 65mm long appeared beside the real one.

     The line's own numbers are what wqaExtractFields already counts, through
     wqaStripSpecWords, and it gets this right. Using the same helper here
     removes the second, drifted answer rather than adding a third: 4140, 8.8,
     10.9, SS304 and a DIN standard are all vocabulary, and none of them is a
     thread length. */
  const nums=(wqaStripSpecWords(n).replace(WQA_END_LABEL_RE,' ').match(/\d+(?:\.\d+)?/g)||[]);
  if(nums.length!==1) return null;
  const v=Number(nums[0]);
  return v>0 ? String(v) : null;
}
/* The rod's own length stated on a line of its own — "overall 3850", "total
   length 3850", "OAL 3850" — the way a drawing gets written out in words. A
   counting line ("Total 6 items") is not a dimension, so it is excluded. */
const WQA_OVERALL_RE=/\b(?:overall|over\s*all|o\s*\/\s*a|oal|total\s*length|full\s*length|length|long)\b/i;
/* The rod's ACTUAL body: "body 33mm", "shank dia 33", "body Ø38.1". It is a
   diameter, not a length and not a nominal size — a customer who writes both
   ("M32 body 33mm") is telling us two different things, and putting the 33 in
   either of the other boxes quotes the wrong rod. Read as evidence, kept on the
   row, and used by nothing else: the weight and price still come from the
   nominal size exactly as before. */
const WQA_BODY_RE=/\b(?:actual\s*)?(?:rod\s*)?(?:body|shank)\s*(?:bar\s*)?(?:dia(?:meter)?|\u00f8|size)?\b/i;
const WQA_BODY_NUM_RE=new RegExp(WQA_BODY_RE.source+'\\s*[:=]?\\s*\\u00f8?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:mm\\b)?','ig');

/* The plain middle of a sag rod, named. Every one of these is an explicit
   label — that is the whole point: an unlabelled number is never a centre, and
   nothing is ever derived from one. "Centre length 50" is NOT an overall
   length, which is what this used to be read as: the rod then went out at
   50mm instead of 250mm, with nothing on screen to say so. */
const WQA_CENTER_RE=/\b(?:cent(?:er|re)\s*(?:length|body|section)?|middle\s*(?:length|section)|body\s*length|unthreaded\s*(?:length|section)|plain\s*(?:section\s*)?length)\b/i;
const WQA_COUNT_WORD_RE=/\b(?:items?|qty|quantity|pcs?|nos?|sets?|units?)\b/i;
/* "2k pcs", "qty 1.5k", "@2k", "2.5K NOS" — the k is a thousand, but ONLY where
   the number is plainly a count. A bare "M20 x 2k" says nothing about quantity,
   so it stays unresolved rather than becoming two thousand of something. */
const WQA_QTY_K_RE=new RegExp(
  '(?:\\bqty\\b|\\bquantity\\b|@)\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*k\\b'
  + '|(\\d+(?:\\.\\d+)?)\\s*k\\s*(?:pcs?|nos?|no\\.|sets?|units?|items?)\\b','i');
/* The wording that makes a quantity everyone's rather than the row above it. */
const WQA_ALL_QTY_RE=/\b(?:all|each|every|per)\b/i;
function wqaOverallLengthValue(e){
  if(!e || !e.f) return null;
  const f=e.f;
  if(f.size || f.qty!==null || f.threadLen!==null || f.nums.length!==1) return null;
  const n=e.n||'';
  if(!WQA_OVERALL_RE.test(n) || WQA_COUNT_WORD_RE.test(n)) return null;
  if(WQA_THREAD_WORD_RE.test(n)) return null;        // "thread length 60" is a thread
  if(WQA_CENTER_RE.test(n))      return null;        // "centre length 50" is the middle
  if(WQA_BODY_RE.test(n))        return null;        // "body 33mm" is a diameter
  const v=Number(f.nums[0]);
  return v>0 ? String(v) : null;
}
/* The body diameter stated on a line of its own. Same shape again. */
function wqaBodyDiaValue(e){
  if(!e || !e.f) return null;
  const f=e.f;
  /* The line states a body diameter AND NOTHING ELSE dimensional: it is a
     specification line, not an item. A line that also carries a length is an
     item, and keeps its body diameter as evidence beside the length. */
  if(f.bodyDia==null) return null;
  if(f.qty!==null || f.threadLen!==null || f.nums.length) return null;
  if(WQA_COUNT_WORD_RE.test(e.n||'')) return null;
  /* "centre body 50" names the MIDDLE — the word body is doing different work
     there, and the centre reader owns that line. */
  if(WQA_CENTER_RE.test(e.n||'')) return null;
  return f.bodyDia;
}
/* The centre segment stated on a line of its own, and only when it is LABELLED
   as one. Same shape as the overall reader above, deliberately. */
function wqaCenterLengthValue(e){
  if(!e || !e.f) return null;
  const f=e.f;
  if(f.size || f.qty!==null || f.threadLen!==null || f.nums.length!==1) return null;
  const n=e.n||'';
  if(!WQA_CENTER_RE.test(n) || WQA_COUNT_WORD_RE.test(n)) return null;
  if(WQA_THREAD_WORD_RE.test(n)) return null;        // a threaded part, not the plain one
  const v=Number(f.nums[0]);
  return v>0 ? String(v) : null;
}
/* Thread ends arrive one line at a time. The first value fills the pair the way
   the PRODUCT means it; a second value replaces the second end, in the order it
   was written. A pair written on one line is already complete. */
function wqaCtxAddThread(ctx,v,productType){
  if(v==null) return;
  if(!ctx.tlCount){
    const p=wqaPairThread(v,productType);
    ctx.threadLen=p.a; ctx.threadLen2=p.b; ctx.tlCount=1;
  } else if(ctx.tlCount===1 && wqaThreadEnds(productType)===2){
    ctx.threadLen2=v; ctx.tlCount=2;
  }
}

/* A right-angle bend, however it is written. */
const WQA_BEND90_RE=/\b90\s*(?:deg(?:ree)?s?)?\.?\s*(?:bend|bent|hook)\b|\bbend\s*90\b|\b90\s*deg(?:ree)?s?\b/i;
/* ── How many ends are threaded ─────────────────────────────────────────────
   Evidence, not a product name. A customer calls the same straight rod a "sag
   rod", an "anchor bolt" or a "bolt" interchangeably, but they are precise
   about the threading, and the threading is what our two products actually
   differ by. Read the arrangement and let the shared resolver decide.

   Ends actually GIVEN outrank ends described: "thread one side 150 / thread
   other side 100" states two, whatever the words "one side" suggest. */
/* The words a customer uses for threading, as fragments, so every reading of
   them below is built from the SAME vocabulary and there is no second list to
   drift. "each"/"ea"/"every" are here with "both": one value for every end is
   the same statement as one value for both ends. */
const WQA_TH_W    ='(?:thread(?:ed|ing|s)?|thd|tl)';
const WQA_BOTH_W  ='(?:both|two|2|each|ea|every)\\s*(?:end|side)s?';
const WQA_ONE_W   ='(?:one|1|single)\\s*(?:end|side)s?';
const WQA_OTHER_W ='(?:other|opposite|2nd|second)\\s*(?:end|side)s?';
const WQA_LEFT_W  ='(?:left|top|first|1st)\\s*(?:end|side)?';
const WQA_RIGHT_W ='(?:right|bottom)\\s*(?:end|side)?';
const WQA_ONE_END_RE=new RegExp('\\b(?:'+WQA_ONE_W+'\\s*(?:only\\s*)?(?:'+WQA_TH_W+')?|'
  +WQA_TH_W+'\\s*(?:on\\s*)?'+WQA_ONE_W+'|one\\s*threaded\\s*end)\\b','i');
const WQA_BOTH_END_RE=new RegExp('\\b(?:'+WQA_BOTH_W+'\\s*(?:'+WQA_TH_W+')?|'
  +WQA_TH_W+'\\s*(?:on\\s*)?'+WQA_BOTH_W+'|two\\s*threaded\\s*ends?)\\b','i');
/* "other side 20" after "left thread 68" is the SECOND end, said the way a
   person says it. On a rod, an end that carries a measurement is a thread. */
const WQA_OTHER_END_RE=new RegExp('\\b(?:other|opposite)\\s*(?:side|end)\\b','i');
/* "fully threaded" is a Stud: the thread is the whole rod, so there is no end
   length to state and none must ever be manufactured from the length. */
const WQA_FULL_THREAD_RE=/\b(?:fully|full)\s*[-\s]*thread(?:ed)?\b/i;

/* ── Thread evidence ────────────────────────────────────────────────────────
   Everything ONE line says about threading, collected before anything decides
   what the line is. This layer exists because the parser used to decide as it
   read: it saw "thread 80 one side", concluded Anchor Bolt, and never reached
   the "thread 80 other side" three words later. Nothing here chooses a product.
   It reads the line to the end, records what it found, and hands that over.

     firstEnd / secondEnd  the values, in the order the customer wrote them
     symmetric             one value the wording gives to both ends
     explicitEndCount      how many ends the line actually shows
     fullyThreaded         "fully threaded" — a Stud, and no thread length
     cut                   the number tokens this reading has claimed

   Each form is tried in order and claims its span, so a later, looser form can
   never re-read a number an earlier one already explained: in "M16 x 900mm,
   thread both side 75" the form that reads "thread both side 75" runs first,
   which is what stops the 900 being read as the thread. */
const WQA_TH_FORMS=(function(){
  const T='(?:'+WQA_TH_W+')';
  /* A number, with any unit it was written with. It is not an end length when a
     counting word follows it — "both ends, 48pcs" states a quantity. */
  const N='(\\d+(?:\\.\\d+)?)\\s*(?:mm|cm|m|in|inch(?:es)?|"|\'\')?'
         +'(?!\\s*(?:pcs?|nos?|no\\.|sets?|units?|items?)\\b)';
  const S1='[\\s,;:=\\-]{0,3}';   // a thread word anchors it, so a comma is fine
  const S2='[\\s:=\\-]{0,2}';     // no thread word: the number must sit right there
  const out=[];
  const add=(kind,body)=>out.push({kind, re:new RegExp(body,'ig')});
  [['both',WQA_BOTH_W],['other',WQA_OTHER_W],['one',WQA_ONE_W]].forEach(function(p){
    const kind=p[0], W=p[1];
    add(kind,'\\b'+W +S1+T +S1+N);      // both end thread 80 / one end thread 75
    add(kind,'\\b'+T +S1+W +S1+N);      // thread both side 75 / thread one end 75
    add(kind,'\\b'+W +S2+N);            // both ends 80
    add(kind,'\\b'+T +S1+N +S1+W);      // thread 80 each end / TL75 one end
    add(kind,'\\b'+N +S1+T +S1+W);      // 80 thd ea end / 80mm thread each side
  });
  [['first',WQA_LEFT_W],['second',WQA_RIGHT_W]].forEach(function(p){
    add(p[0],'\\b'+p[1]+S1+T+S1+N);     // left thread 80
    add(p[0],'\\b'+T+S1+N+S1+p[1]);     // thread 80 right
  });
  return out;
})();
function wqaThreadEvidence(text){
  const s=' '+String(text||'')+' ';
  const ev={firstEnd:null, secondEnd:null, symmetric:null, explicitEndCount:null,
            fullyThreaded:WQA_FULL_THREAD_RE.test(s), found:[], cut:[]};
  const taken=[];
  WQA_TH_FORMS.forEach(function(form){
    form.re.lastIndex=0;
    let m;
    while((m=form.re.exec(s))!==null){
      if(m[1]==null) continue;
      const a=m.index, b=a+m[0].length;
      if(taken.some(r=>a<r[1] && b>r[0])) continue;   // already explained
      taken.push([a,b]);
      ev.found.push({kind:form.kind, value:String(Number(m[1])), index:a});
    }
  });
  ev.found.sort((x,y)=>x.index-y.index);
  const both=ev.found.find(x=>x.kind==='both');
  const firsts=ev.found.filter(x=>x.kind==='one'||x.kind==='first');
  const seconds=ev.found.filter(x=>x.kind==='other'||x.kind==='second');
  if(both){
    ev.firstEnd=ev.secondEnd=both.value; ev.symmetric=true;
    ev.explicitEndCount=2; ev.cut=[both.value];
  } else {
    if(firsts.length){  ev.firstEnd=firsts[0].value;  ev.cut.push(firsts[0].value); }
    if(seconds.length){ ev.secondEnd=seconds[0].value; ev.cut.push(seconds[0].value); }
    /* One value for this end and one for that end is TWO ends, whatever either
       phrase said on its own. This is the reading the old parser never reached.

       "top thread 250" on a line of its own is the exception: left / top /
       right / bottom say WHICH end, not how many there are. The value is read,
       the count is not claimed — the two lines together are what states it, and
       that pairing is the caller's job, not this line's. */
    if(ev.firstEnd!=null && ev.secondEnd!=null)      ev.explicitEndCount=2;
    else if(firsts.length>1){ ev.secondEnd=firsts[1].value; ev.cut.push(firsts[1].value);
                              ev.explicitEndCount=2; }
    else if(ev.found.some(x=>x.kind==='one'))        ev.explicitEndCount=1;
    else if(ev.found.some(x=>x.kind==='other'))      ev.explicitEndCount=2;
    ev.symmetric=(ev.firstEnd!=null && ev.firstEnd===ev.secondEnd);
  }
  /* Wording with no number of its own still says how many ends there are. */
  if(ev.explicitEndCount===null){
    if(WQA_BOTH_END_RE.test(s))      ev.explicitEndCount=2;
    else if(WQA_ONE_END_RE.test(s))  ev.explicitEndCount=WQA_OTHER_END_RE.test(s)?2:1;
    else if(WQA_OTHER_END_RE.test(s))ev.explicitEndCount=2;
  } else if(ev.explicitEndCount===1 && WQA_OTHER_END_RE.test(s)){
    ev.explicitEndCount=2;                      // the other end was named, unmeasured
  }
  return ev;
}
/* Take one number token back out of the line, so a value already explained as a
   thread cannot also be counted as a length. Written without a lookbehind: an
   older phone browser has to run this too. */
function wqaCutNum(s,v){
  const esc=String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('(^|[^\\d.])'+esc+'(?![\\d.])\\s*(?:mm\\b)?','i');
  return re.test(s) ? s.replace(re,'$1 ') : null;
}
/* Ends alone name a product when the document did not: one threaded end is an
   Anchor Bolt, two are a Sag Rod. The same mapping the whole app already uses,
   read off the row instead of off the message. */
/* How many ends one LINE names, if it says. Row evidence: it decides what that
   row is, whatever the document called itself. */
function wqaLineEnds(n){
  return wqaThreadEvidence(String(n||'')).explicitEndCount;
}
/* Ends alone name a product when the document did not: one threaded end is an
   Anchor Bolt, two are a Sag Rod. The same mapping the whole app already uses,
   read off the row instead of off the message. */
function wqaProductFromEnds(ends){
  const p=WQA_PRODUCTS.find(x=>x.threadEnds===ends);
  return p ? p.type : '';
}
/* A thread stated UNDER a row belongs to that row — the same way a bare
   quantity does — and never to the rows after it. Two values make a pair, and
   a pair is two ends whatever the wording said. */
function wqaRowAddThread(it,v,ends,docProduct){
  if(it==null || v==null) return false;
  if(ends===1||ends===2) it.threadEnds=ends;
  const list=it._tl || (it._tl = it.TL ? String(it.TL).split('/').filter(Boolean) : []);
  if(list.length>=2) return false;                 // both ends already stated
  list.push(String(v));
  if(list.length===2) it.threadEnds=2;
  const want=it.threadEnds || wqaThreadEnds(docProduct);
  /* One value on a two-end rod means both ends; on a one-end rod it stays
     single; and where nothing says which, it is not assigned to an end at all
     — an unplaced number is not a thread length. */
  it.TL = list.length===2 ? list.join('/')
        : (want===2 ? list[0]+'/'+list[0] : (want===1 ? list[0] : null));
  if(it.TL!=null) it.conf.threadLen=WQA_CONF.DETECTED;
  return true;
}
function wqaThreadEndEvidence(text,entries){
  let stated=0, pair=false;
  (entries||[]).forEach(e=>{
    if(wqaThreadOnlyValue(e)!=null) stated++;
    if(e.f && e.f.threadLen!==null && e.f.threadLen2) pair=true;
  });
  if(stated>=2 || pair) return 2;
  return wqaThreadEvidence(' '+wqaNorm(text).toLowerCase()+' ').explicitEndCount;
}
const WQA_ACC_TAIL_RE=/^\s*(?:each|ea\.?|per\s*(?:pc|pcs|set|rod|item|piece))\b/i;
const WQA_ACC_PLAIN_MODS=/^(?:hex|hexagon|hexagonal|flat|plain|normal|std|standard|m\d+(?:\.\d+)?)$/i;
/* ── 2026-10-27: read ENTITIES and QUANTITIES, not sentences ──────────────
   An accessory statement is a run of accessory words — Nut / Flat Washer, or
   a named other kind kept as Custom — each with the count written next to
   it, before ("4 nuts", "4N", "4pcs FW") or after ("nut x4", "NUT 4PCS",
   "nuts 4"), joined by "&", "+", ",", "/", "and". A count beside a word that
   is not in front of another word belongs to it; nothing further away is
   ever borrowed, so "20pcs c/w 4 nuts" keeps the 20 for the rod.

   Per item unless it reads as a total: a lead ("c/w", "with", "complete
   with") or a short count (12 or under) is per item; a larger count with no
   lead ("Nut 100pcs") is detected but its quantity is asked for. A word with
   no count ("with nuts and washers") is detected and asked for too. A kind we
   do not quote as Nut / FW (spring, lock, rubber, plate, nyloc …) is never
   read as one: it becomes Custom with its own wording. */
const WQA_ACC_ENTITY_RE=/(?<![a-z])(?:((?:spring|lock|rubber|plate|square|taper|bevel|epdm|nylon|nyloc|wing|dome|cap|flange|serrated|star|tab|heavy|thick)\s+(?:washers?|nuts?))|(nyloc)|(flat\s+washers?|f\s*\/\s*w|f\s*\.\s*w\s*\.?|fw|washers?)|(nuts?)|(n)(?=\s*(?:x\s*)?\d)|(?<=\d\s?)(n))(?![a-z])/ig;
const WQA_ACC_LEAD2_RE=/(?<![a-z])(?:c\s*\/\s*w|c\s*\.\s*w\s*\.?|cw|complete\s+with|comes?\s+with|with|w\/)(?![a-z])\s*[:\-]?\s*/ig;
const WQA_ACC_QTY_BEFORE_RE=/(?<![\w.\/])(\d{1,4})\s*(?:nos?\.?|pcs?\.?|x)?\s*((?:[a-z]+\s+){0,2}?)$/i;
const WQA_ACC_QTY_AFTER_RE=/^\s*(?:x|qty|:|=|-)?\s*(\d{1,4})\s*(?:nos?\.?|pcs?\.?)?(?![\w])/i;
const WQA_ACC_GLUE_RE=/^\s*(?:&|and|\+|,|\/|;|\.)?\s*$/i;
function wqaAccTitle(t){ return String(t||'').trim().replace(/\s+/g,' ').toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()); }
function wqaAccScan(line){
  const s=String(line||'');
  const ents=[];
  const re=new RegExp(WQA_ACC_ENTITY_RE.source,'ig');
  let m;
  while((m=re.exec(s))!==null){
    const type=m[1]||m[2] ? 'custom' : m[3] ? 'fw' : 'nut';
    ents.push({at:m.index, end:m.index+m[0].length, type, word:m[0],
               text: type==='custom' ? wqaAccTitle(m[1]||m[2]) : ''});
  }
  if(!ents.length) return null;
  /* Counts: first the one written directly in front of each word, then —
     only for a word that has none — one written directly after it. */
  const isFin=w=>WQA_FINISHES.some(x=>x.re.test(' '+w+' '));
  let floor=0;
  ents.forEach((e,k)=>{
    const gap=s.slice(floor,e.at);
    const b=WQA_ACC_QTY_BEFORE_RE.exec(gap);
    if(b){
      const words=b[2]?b[2].trim().split(/\s+/):[];
      const odd=words.filter(w=>!WQA_ACC_PLAIN_MODS.test(w) && !isFin(w));
      if(!odd.length){
        e.qty=parseInt(b[1],10); e.from=floor+b.index;
        const fin=WQA_FINISHES.find(x=>words.some(w=>x.re.test(' '+w+' ')));
        if(fin) e.finish=fin.value;
      }
    }
    if(e.from===undefined) e.from=e.at;
    floor=e.end;
  });
  ents.forEach((e,k)=>{
    if(e.qty!==undefined) return;
    const lim=k+1<ents.length ? ents[k+1].from : s.length;
    const a=WQA_ACC_QTY_AFTER_RE.exec(s.slice(e.end,lim));
    if(a){ e.qty=parseInt(a[1],10); e.end+=a[0].length; }
  });
  /* A statement is a run of words joined by glue — or by a count that
     belongs to the next word. */
  const runs=[]; let cur=[ents[0]];
  for(let k=1;k<ents.length;k++){
    const gap=s.slice(cur[cur.length-1].end,ents[k].from);
    if(WQA_ACC_GLUE_RE.test(gap)) cur.push(ents[k]); else { runs.push(cur); cur=[ents[k]]; }
  }
  runs.push(cur);
  const out={nut:null, fw:null, custom:null, finish:'', unsure:[], need:[], total:[]};
  const cuts=[];
  runs.forEach(run=>{
    const before=s.slice(0,run[0].from);
    const leads=[...before.matchAll(new RegExp(WQA_ACC_LEAD2_RE.source,'ig'))];
    const lead=leads.length && leads[leads.length-1].index+leads[leads.length-1][0].length>=before.replace(/\s+$/,'').length ? leads[leads.length-1] : null;
    let from=lead ? lead.index : run[0].from, to=run[run.length-1].end;
    const tail=WQA_ACC_TAIL_RE.exec(s.slice(to));
    if(tail) to+=tail[0].length;
    const restOfLine=(s.slice(0,from)+' '+s.slice(to)).replace(/[\s,;:.\-]+/g,'');
    /* One lonely word with a big count and nothing else on the line may be
       an order FOR nuts; one inside a rod line with no lead is not ours. */
    const accepted = lead || run.length>=2 || !restOfLine || tail;
    if(!accepted) return;
    cuts.push([from,to]);
    run.forEach(p=>{
      if((p.type!=='custom' && out[p.type]!==null) || out.need.indexOf(p.type)>=0){ out.unsure.push(s.slice(p.from,p.end).trim()); return; }
      let q=p.qty;
      const perItem = !!(lead || tail);
      if(q!==undefined && (q<1 || q>50 || (!perItem && q>12))){
        /* A count we cannot call per item: detected, quantity asked for. */
        out.total.push({type:p.type, qty:q, text:s.slice(p.from,p.end).trim()});
        q=undefined;
      }
      if(p.finish) out.finish=p.finish;
      if(p.type==='custom'){
        if(out.custom){ out.unsure.push(s.slice(p.from,p.end).trim()); return; }
        out.custom={text:p.text, qty:q===undefined?null:q};
        if(q===undefined) out.need.push('custom');
        return;
      }
      if(q===undefined){ out.need.push(p.type); return; }
      out[p.type]=q;
    });
  });
  if(!cuts.length) return null;
  let rest=s;
  for(let k=cuts.length-1;k>=0;k--) rest=rest.slice(0,cuts[k][0])+' '+rest.slice(cuts[k][1]);
  out.rest=rest.replace(/\s+/g,' ').replace(/^[\s,;&+\/\-]+|[\s,;&+\/\-]+$/g,'').trim();
  out.found=out.nut!==null || out.fw!==null || !!out.custom || out.need.length>0;
  return out;
}
/* The accessory panel's own object, finished like the rod unless the clause
   named a finish of its own. Unit prices stay at the panel's default. */
function wqaAccFromSpec(a,rowFinish){
  const need=(a&&a.need)||[];
  if(!a || (a.nut==null && a.fw==null && !a.custom && !need.length)) return null;
  const acc=wqaEmptyAcc();
  /* The main product's finish is only the starting suggestion: a finish the
     statement itself names is the accessory's own from the start. */
  const fin=a.finish || wqaAccFinishFor(rowFinish);
  const inherit=!a.finish;
  ['nut','fw'].forEach(k=>{
    if(a[k]==null && need.indexOf(k)<0) return;
    Object.assign(acc[k],{enabled:true, qty:a[k]==null?'':a[k], finish:fin, finishInherit:inherit, qtyNeed:a[k]==null});
  });
  if(a.custom){ Object.assign(acc.custom,{enabled:true, text:a.custom.text, qty:a.custom.qty==null?'':a.custom.qty, qtyNeed:a.custom.qty==null}); }
  return acc;
}
/* The accessory finish a main finish suggests ('' is N/A). */
function wqaAccFinishFor(rowFinish){ return WQA_ACC_FINISHES.indexOf(rowFinish||'')>=0 ? (rowFinish||'') : ''; }

function wqaSpecCandidate(f){
  return !!f && !!f.size && f.qty===null && f.threadLen===null && f.nums.length===1 &&
         /^\d+(?:\.\d+)?$/.test(f.nums[0]);
}

/* Which lines are spec headers, decided across the whole message: a candidate
   is only readable from the rows underneath it, so this cannot be settled line
   by line inside the row loop. Returns index -> 'header' | 'risky'. */
function wqaSpecHeaderPlan(entries){
  const plan={};
  entries.forEach((e,i)=>{
    if(wqaThreadOnlyValue(e)!=null){ plan[i]='thread'; return; }
    if(!wqaSpecCandidate(e.f)) return;
    const n=Number(e.f.nums[0]);
    if(!(n>0)) return;
    if(WQA_THREAD_WORD_RE.test(e.n||'')){ plan[i]='header'; return; }
    if(n>WQA_THREAD_MAX) return;
    /* The list underneath: quantities written against lengths. A second
       candidate ends the block — it opens one of its own, which is what keeps a
       plain short-item list ("M12 x 100 / M12 x 150") reading as items. */
    const below=[];
    for(let j=i+1;j<entries.length;j++){
      const g=entries[j].f;
      if(!g) continue;
      if(wqaSpecCandidate(g)) break;
      if(g.qty!==null && g.nums.length){
        const v=Number(g.nums[0]);
        if(v>0) below.push(v);
      }
    }
    if(!below.length) return;            // nothing under it: read it as an item
    const smallest=Math.min.apply(null,below);
    if(smallest>=n*WQA_HEADER_RATIO)     plan[i]='header';
    else if(smallest>=n*WQA_AMBIG_RATIO) plan[i]='risky';
  });
  return plan;
}

function wqaParseText(text,forceProduct){
  const common=wqaDetectCommon(text);
  if(forceProduct) common.product=forceProduct;   // "change product" re-parse
  const lines=String(text||'').split(/\r?\n/);
  const items=[], skipped=[];
  /* Running context: a header line updates it, later lines inherit from it. A
     ROW never writes back into it — a value stated on a row applies to that row
     only, and the shared context carries on unchanged for the rows after it. */
  const ctx={size:'',threadLen:'',threadLen2:'',tlCount:0,length:'',qty:'',center:'',
             sizeList:null, bodyDia:'', product:'', series:'',
             material:'',finish:'',sizeType:'',matFrom:'',matDefaulted:false};
  /* Once a line has stated a material, finish or size type for a GROUP, the
     document-wide reading of that field stops being a fallback — it was only
     ever an echo of that same line, and letting it through is exactly how an
     HDG stated for rows 1-2 ends up on the SS304 rows below. */
  const sawGroup={material:false,finish:false,sizeType:false};
  /* After a "Length:" heading, once context already carries the identity
     (product, material, finish, size type, diameter), a bare number IS a
     length. This is context-driven — no customer-specific format. */
  let inList=false;
  /* Set when a short spec line could not be told apart from an item. Nothing
     wrong is produced from it — the diameter it states is kept as context and no
     item is invented from the number — but the parse is reported as low
     confidence, so the message goes to the AI fallback. */
  let risky=false;
  /* How much of the message the parser actually used. Counted per line rather
     than per row, because a line that becomes shared context — a diameter, a
     thread end, an overall length — has been read just as truly as one that
     becomes an item. */
  let numeric=0, unread=0;
  /* End-count evidence stated ABOVE the rows: shared, like a header thread. */
  let ctxEnds=null;
  /* A size type written against a NAMED list of sizes, and the sizes it names.
     Null while no such line has been read — the ordinary case, where a size
     type stated anywhere is about the whole message. */
  let stScope=null;
  /* ── Section boundary ─────────────────────────────────────────────────────
     Where the CURRENT section's rows begin. A numbered heading that names a
     product — "5) J TYPE FOUNDATION BOLT" — starts a new one, and nothing
     written under it may attach to a row belonging to the section above: the
     J Bolt's "threaded portion 120" was landing on the L Bolt two sections
     earlier and taking that section's last row with it. */
  let secFrom=0;
  const lastItem=()=>items.length>secFrom ? items[items.length-1] : null;

  /* R12 is drawing notation for an undersized rod's nominal diameter, so it is
     read as a size only where the message actually shows that context: an
     undersize note, or a rod product. Never a blanket rule. */
  const rodSize = common.sizeType==='UNDERSIZE' || /\bunder\s*sized?\b|\bu\/s\b/i.test(String(text||''))
                  || wqaThreadEnds(common.product)>0;

  /* Every line's fields are read first. A spec header is only recognisable from
     the rows below it, so the classification has to precede the row loop. */
  /* ── The section's product is the reading context for the lines under it ──
     A heading names the product once and the measurements follow underneath in
     words, so the schema has to survive from the heading down to them. Only a
     HEADING may set it: a line that names a product and states no measurement
     of its own. One L Bolt line inside a Sag Rod message therefore still speaks
     for itself and for nothing after it. */
  let secProd='';
  const accUnsure=[];
  const entries=lines.map(raw=>{
    const t0=raw.trim();
    if(!t0) return {blank:true};
    /* Accessory wording leaves the line before anything reads it. */
    const acc=wqaAccScan(t0);
    if(acc && acc.unsure.length) accUnsure.push.apply(accUnsure,acc.unsure);
    const t=acc ? acc.rest : t0;
    if(acc && acc.total.length) accUnsure.push.apply(accUnsure,acc.total.map(x=>x.text));
    const accSpec=acc && acc.found ? {nut:acc.nut, fw:acc.fw, finish:acc.finish, custom:acc.custom, need:acc.need} : null;
    if(acc && !t) return accSpec ? {t:t0,n:'',accOnly:true,accSpec} : {blank:true};
    const n=wqaNorm(t);
    if(WQA_SECTION_RE.test(n)) return {t,n,section:true};          // "Length:" — structural
    const sl=wqaSizeList(n);
    if(sl) return {t,n,sizeList:sl};                                // "M20, M24"
    if(!wqaLineHasSignal(t,common)) return {t,n,noise:true};
    /* The same whole-message rules, run over ONE line, so a line can state its
       own material or finish exactly as the document can. */
    /* The line's own product word wins over the document's, so one L Bolt line
       inside a Sag Rod message is read with L Bolt eyes. */
    const dd=wqaDetectCommon(t);
    const ef=wqaExtractFields(t,{rodSize,product:forceProduct||dd.product||secProd||common.product});
    if(!forceProduct && dd.product && !ef.size && ef.qty==null && !(ef.dims&&Object.keys(ef.dims).length))
      secProd=dd.product;
    return {t,n,f:ef,d:dd,src:t0,accSpec};
  });
  /* Thread arrangement beats the customer's product word, decided before
     anything is read as a row — the dimension columns depend on it. Resolved by
     the SAME function the AI extraction goes through. */
  const threadEnds=forceProduct ? null : wqaThreadEndEvidence(text,entries);
  if(!forceProduct) common.product=wqaResolveProduct(common.product,threadEnds);
  const plan=wqaSpecHeaderPlan(entries);
  /* A message that never names a product can still SHOW what its rows are:
     "thread one end 100" under one row and "thread both ends 80" under the next
     is an Anchor Bolt and a Sag Rod, whatever the heading said. Where that
     evidence exists the rows are read and each carries its own product; where
     it does not, nothing is read without a product, exactly as before. */
  /* A row can show what it is without naming it: the ends it threads, a thread
     written for each end ("100/120" is two), or the words "fully threaded". */
  const selfProduct=entries.some(e=>(e.n && wqaLineEnds(e.n))
                                 || (e.f && e.f.fullyThreaded)
                                 || (e.f && e.f.threadLen!==null && e.f.threadLen2!==null)
                                 || (e.d && e.d.product));

  entries.forEach((e,i)=>{
    if(e.blank) return;
    /* A digit that belongs to a material or a finish — 4140, GR8.8, SS304 — is
       not dimensional content, and the line carrying it was read the moment the
       whole-message scan picked the material up. Only digits that survive the
       spec-word strip count as something the parser still owes an answer for. */
    const counts=/\d/.test(wqaStripSpecWords(e.n||''));
    if(counts) numeric++;
    if(e.section){ inList=true; return; }
    /* Read and understood — it just does not produce a row, and does not put a
       diameter into the context either. */
    if(e.sizeList){ ctx.sizeList=e.sizeList; return; }
    /* "c/w 2 nuts" on a line of its own: shared, like a quantity for all. */
    if(e.accOnly){ ctx.acc=e.accSpec; return; }
    /* "UNC" on a line of its own is the thread series of the item above it —
       read, attached, and no longer reported as something we could not read. */
    if(e.noise && WQA_SERIES_RE.test(' '+(e.n||'')+' ')){
      const prevS=lastItem();
      if(prevS && !prevS.series) prevS.series=wqaSeriesValue(e.n);
      else if(!ctx.series) ctx.series=wqaSeriesValue(e.n);
      return;
    }
    if(e.noise){ if(e.accSpec) ctx.acc=e.accSpec; skipped.push(e.t); if(counts) unread++; return; }
    if(!common.product && !selfProduct){ if(counts) unread++; return; }

    const f=e.f;
    /* A thread end stated on a line of its own belongs to the row ABOVE it,
       exactly as a bare quantity does — "M16 x 1000 / TL60/80 / 10pcs" is one
       item, and the 60/80 is that item's, not the next block's. Only a thread
       written BEFORE any row is a shared header for the rows below. Without
       this an independent block silently inherited the previous block's
       thread. */
    if(plan[i]==='thread'){
      const v=wqaThreadOnlyValue(e), ends=wqaLineEnds(e.n||'');
      const prev=lastItem();
      if(prev){ if(!wqaRowAddThread(prev,v,ends,common.product) && counts) unread++; }
      else {
        wqaCtxAddThread(ctx,v,common.product);
        if(ends) ctxEnds=ends;
      }
      return;
    }
    /* ── Continuation, not a new item ─────────────────────────────────────
       A line whose every number is bound to a label of the ACTIVE product's own
       schema, and which states no nominal size, is more of the item above it.
       A number at the start of a line is not evidence of a new item; a size is.
       Without this, the second line of a J Bolt drawing started a second row
       and took its first measurement with it as that row's bolt size. */
    const contProd=(e.d&&e.d.product)||ctx.product||common.product||'';
    const prevItem=lastItem();
    if(prevItem && !f.size && f.dims && Object.keys(f.dims).length &&
       (contProd==='lbolt'||contProd==='jbolt') && prevItem.product===contProd){
      Object.entries(f.dims).forEach(([k,v])=>{
        if(prevItem[k]==null || prevItem[k]===''){ prevItem[k]=v; prevItem.conf[k]=WQA_CONF.DETECTED; }
      });
      if(f.threadLen!==null && !prevItem.TL){
        prevItem.TL = f.threadLen2 ? f.threadLen+'/'+f.threadLen2 : f.threadLen;
        prevItem.conf.TL=WQA_CONF.DETECTED;
      }
      if(f.qty!=null && (prevItem.qty==null||prevItem.qty==='')){
        prevItem.qty=String(f.qty); prevItem.conf.qty=WQA_CONF.DETECTED;
      }
      return;
    }
    /* A LABELLED dimension is read before anything can mistake it for an item:
       "body 33mm" carries an mm suffix and would otherwise be read as a 33mm
       rod, which is how a 1000mm rod came to be quoted at 33. The label says
       what the number is; nothing else on the line is thrown away. */
    const bdv=wqaBodyDiaValue(e);
    if(bdv!=null){
      if(f.size) ctx.size=f.size;              // "M32 body 33mm" states both
      const prev=lastItem();
      if(prev && !prev.bodyDia) prev.bodyDia=bdv; else ctx.bodyDia=bdv;
      return;
    }
    const cvv=wqaCenterLengthValue(e);
    if(cvv!=null){ ctx.center=cvv; return; }
    /* Numbers alone are not enough — "Total 6 items" is not a 6mm bolt. An item
       needs a dimensional signal: an M-size, a thread, an x separator or an mm
       suffix, or an explicit quantity. */
    /* A line whose numbers were all LABELLED — "M24 x 500L x 100W x TL150" —
       has no loose numbers left to count, and it is still an item: the labels
       are the strongest dimensional signal there is. */
    const dimSignal = !!f.size || f.threadLen!==null || f.hadX || (f.mm||[]).some(Boolean) ||
                      !!f.dims || (inList && !!ctx.size);   // a length list under a header
    const isItem = !plan[i] &&
                   ((f.qty!==null && (dimSignal || f.nums.length>0)) ||
                    (dimSignal && (f.nums.length>0 || !!f.dims)));
    if(!isItem){
      /* No length and no qty: this is context, not an item. It may still carry
         a diameter and a thread for the rows below it. */
      let used=false;
      /* "UNC" on a line of its own is the thread series of the item above it —
         read and attached rather than reported as something we could not read.
         Before any row exists it is the series for the rows that follow. */
      if(e.n && WQA_SERIES_RE.test(' '+e.n+' ')){
        const sv=wqaSeriesValue(e.n);
        const prevS=lastItem();
        if(prevS && !prevS.series) prevS.series=sv; else if(!ctx.series) ctx.series=sv;
        used=true;
      }
      /* A bare material line opens a new block: "SS304" under a finished group
         means these rows are stainless AND that the finish above it was for the
         rows above it. Whatever else the same line states is applied after. */
      const d=e.d||{};
      /* "L BOLT" on a line of its own is the product of the rows under it —
         the same grouping a bare material line makes, and what lets one drawing
         hold an L Bolt block above a Sag Rod block. */
      if(d.product){
        /* "Change product" is a person overruling the whole message, so while
           it is in force a heading inside the message no longer speaks for its
           rows — it is still READ, it just does not decide anything. */
        if(!forceProduct){
          /* Thread arrangement outranks the product word for a heading exactly
             as it does for the whole message: "SAG ROD ONE END THREAD" is a
             heading for Anchor Bolts, and the rows under it are Anchor Bolts.
             Resolved here, once, because from here the heading IS the row's
             product. */
          const hp=wqaResolveProduct(d.product,wqaLineEnds(e.n||''))||d.product;
          /* A product heading closes the section above it. */
          if(hp!==ctx.product){
            secFrom=items.length;
            /* And it closes that section's THREAD too. "BOTH END THREAD 75"
               under the Sag Rod heading was still in force three headings
               later: every Stud under the Stud heading was stamped with a
               two-end thread it had never been given, flagged as
               contradicting itself, and blocked from the quotation. A thread
               is a property of the product it was written under — 75/75 on a
               Sag Rod says nothing about the Studs below it. */
            ctxEnds=null;
            ctx.threadLen=''; ctx.threadLen2=''; ctx.tlCount=0;
            ctx.acc=null;
          }
          ctx.product=hp;
        }
        used=true;
      }
      if(d.material){
        ctx.material=d.material; ctx.matFrom=d.materialDefaultedFrom||'';
        ctx.matDefaulted=!!d.materialDefaulted;
        ctx.finish=''; ctx.sizeType='';
        sawGroup.material=true; used=true;
      }
      if(d.finish){   ctx.finish=d.finish;     sawGroup.finish=true;   used=true; }
      if(d.sizeType){
        /* A size type written against NAMED sizes is a note about those sizes,
           not a heading for everything under it. Left out of the group so the
           rows it names still reach it through the document reading, and the
           rows it does not name are left alone. */
        const scope=wqaSizeScope(e.n||'');
        if(scope) stScope={st:d.sizeType,sizes:scope};
        else { ctx.sizeType=d.sizeType; sawGroup.sizeType=true; }
        used=true;
      }
      if(f.size){ ctx.size=f.size; used=true; }
      /* A heading's accessories are every row's under it, per rod. */
      if(e.accSpec){ ctx.acc=e.accSpec; used=true; }
      if(f.threadLen!==null){
        /* "TL60/80" written under a row is that row's pair — the same rule as a
           single value, and the reason an independent block below no longer
           inherits it. Only a thread written before any row is shared. */
        const prevT=f.size ? null : lastItem();
        if(prevT){
          prevT.TL=f.threadLen2 ? f.threadLen+'/'+f.threadLen2 : f.threadLen;
          prevT._tl=String(prevT.TL).split('/');
          if(f.threadLen2) prevT.threadEnds=2;
          const le=wqaLineEnds(e.n||''); if(le) prevT.threadEnds=le;
          prevT.conf.threadLen=WQA_CONF.DETECTED;
          used=true;
        } else {
          ctx.threadLen=f.threadLen; ctx.threadLen2=f.threadLen2||''; ctx.tlCount=2; used=true;
          /* "M12 TL100/100" over a list states two ends for every row under it,
             the same as writing the words — so the rows can be read as the rods
             they are even though nothing names a product. */
          const le=wqaLineEnds(e.n||'') || (f.threadLen2?2:null); if(le) ctxEnds=le;
        }
      } else if(plan[i]==='header'){
        /* One thread value shared by the whole list, read the way THIS product
           means it: a Sag Rod's 75 is 75/75, an Anchor Bolt's 100 stays 100. */
        const p=wqaPairThread(f.nums[0],common.product);
        ctx.threadLen=p.a; ctx.threadLen2=p.b; ctx.tlCount=2; used=true;
      } else if(plan[i]==='risky'){
        /* The short number could not be told apart from a length. The diameter
           beside it is plainly stated, so it is kept as context — throwing away
           what the message clearly shows would be worse — while the number
           itself becomes neither a thread nor an item. */
        risky=true;
      } else {
        /* The centre and the body were read above, before the item test. */
        const ov=wqaOverallLengthValue(e);
        if(ov!=null){ ctx.length=ov; used=true; }
        /* A quantity on a line of its own belongs to the row above it, which is
           how a single-item message is written ("M12 x 1000 x TL100" / "10pcs").
           It only ever fills a row that has none; it never overwrites one. */
        /* Unless it says otherwise. "All Qty 20 pcs/each size" is a quantity
           for every row, and it stays that whether it was written above the
           list or under it — so it becomes shared context and the end of the
           message hands it to every row that has none. */
        if(f.qty!==null && !f.size && f.threadLen===null && !f.nums.length){
          const prev=lastItem();
          if(!WQA_ALL_QTY_RE.test(e.t) && prev && (prev.qty==null||prev.qty==='')){
            prev.qty=String(f.qty); prev.conf.qty=WQA_CONF.DETECTED; used=true;
          } else if(!ctx.qty){ ctx.qty=String(f.qty); used=true; }
        }
        /* "Qty tbc" on a line of its own is the same continuation line with an
           unreadable value, and it belongs to the same row. Carried across so
           that row asks for its count instead of taking the default of one —
           the whole point of telling ABSENT apart from UNREADABLE. */
        else if(f.qtyOpen && !f.size && f.threadLen===null && !f.nums.length){
          const prev=lastItem();
          if(prev && (prev.qty==null||prev.qty==='')){ prev.qtyOpen=true; used=true; }
          else if(!ctx.qty){ ctx.qtyOpen=true; used=true; }
        }
      }
      if(counts && !used) unread++;
      return;
    }
    /* Which product this LINE is, for reading its dimensions: its own word,
       then the group it sits under, then the document. */
    const lineProd=forceProduct||(e.d&&e.d.product)||ctx.product||common.product||'';
    /* The line's fields were read before the group was known, so an L Bolt or
       J Bolt block re-reads its rows with that product's vocabulary. */
    const lf=((lineProd==='lbolt'||lineProd==='jbolt') && !f.dims)
      ? wqaExtractFields(e.t,{rodSize,product:lineProd}) : f;
    /* "M20 x 1000 thread one end 100" says on the row itself how many ends it
       has, and that is what the row IS — an Anchor Bolt beside a Sag Rod in the
       same message is an ordinary enquiry. Read BEFORE the line's numbers are
       placed into columns, because which columns exist depends on it: a line
       whose threading says Sag Rod has a thread column to put 80 into, and the
       same line read as "no product yet" has nowhere to put it and drops it. */
    const pairEnds=(lineProd!=='lbolt' && lineProd!=='jbolt' &&
                    f.threadLen!==null && f.threadLen2!==null) ? 2 : null;
    const lineEnds=wqaLineEnds(e.n||'') || pairEnds;
    const useEnds=lineEnds || ctxEnds || null;
    const readProd=wqaResolveProduct(lineProd,useEnds)
                   || (useEnds ? wqaProductFromEnds(useEnds) : '')
                   || lineProd;
    const r=(lineProd==='lbolt'||lineProd==='jbolt')
      ? {item:wqaBoltItem(lf,lineProd)}
      : wqaResolveLine(f,ctx,readProd);
    if(lineEnds) r.item.threadEnds=lineEnds;
    else if(ctxEnds && !r.item.threadEnds) r.item.threadEnds=ctxEnds;
    /* "Fully threaded" is the whole rod: it names a Stud, and it names it
       without any thread length — nothing is manufactured from the length. */
    if(f.fullyThreaded && !useEnds && !lineProd) r.item.product='stud';
    if(f.bodyDia!=null) r.item.bodyDia=f.bodyDia;
    if(!r.item.bodyDia && ctx.bodyDia) r.item.bodyDia=ctx.bodyDia;
    if(f.pitch)  r.item.pitch=f.pitch;
    if(f.series) r.item.series=f.series;
    else if(ctx.series) r.item.series=ctx.series;
    /* Row explicit > group > document > null, decided HERE, while the group in
       force is still known. A field some group has claimed never falls back to
       the document reading of it. */
    const d=e.d||{};
    const pick=(k)=> d[k] || ctx[k] || (sawGroup[k] ? '' : (common[k]||''));
    /* ── The section this row is in ───────────────────────────────────────
       A numbered heading — "3) ANCHOR BOLT" — is the product of the rows under
       it. Without this the row arrived at the normaliser with no product of its
       own, and in a mixed document there is no document-wide product to fall
       back on: the rows came out unclassified AND lost their thread, because a
       thread on a row that does not know what it is cannot be placed at an end.
       A row that names its own product still wins; nothing here overwrites one. */
    if(!r.item.product && readProd) r.item.product=readProd;
    /* An L or J Bolt whose size was stated on its own line above it — "M16"
       over "overall length 480" — takes that size. wqaBoltItem reads only its
       own line, so the inheritance the rod path gets in wqaResolveLine has to
       be applied here for the bent products too. */
    if(!r.item.M && ctx.size) r.item.M=ctx.size;
    /* Scoped only where the row itself and its group are silent: a size type
       this row or its block stated is that row's own answer and outranks any
       note written above it. */
    const stPick=(()=>{
      const v=pick('sizeType');
      if(!v || d.sizeType || ctx.sizeType || !stScope || stScope.st!==v) return v;
      const m=String(r.item.M||'').trim().toUpperCase();
      return (m && stScope.sizes.indexOf(m)<0) ? '' : v;
    })();
    /* The row's own accessories win, per kind, over the heading's. */
    const accRow=(e.accSpec||ctx.acc) ? {...(ctx.acc||{}),
      ...Object.fromEntries(Object.entries(e.accSpec||{}).filter(([k,v])=>v!==null&&v!==''))} : null;
    items.push({...r.item, raw:e.src||e.t, specResolved:true, accSpec:accRow,
                materialValue:pick('material'), finishValue:pick('finish'),
                sizeTypeValue:stPick,
                matFrom: d.material ? (d.materialDefaultedFrom||'') : (ctx.material?ctx.matFrom:common.materialDefaultedFrom||''),
                matDefaulted: d.material ? !!d.materialDefaulted
                            : (ctx.material ? ctx.matDefaulted : !!common.materialDefaulted)});
  });

  /* A shared spec written UNDER the rows is still shared: "M24 x 1330 / thread
     one side 150 / thread other side 100 / 936 pcs" states the rod once and its
     two ends after it. Reading inherits forward, so when the message is finished
     whatever the context ended up carrying fills the gaps it never reached.
     ONLY gaps — a row that stated its own value keeps it, exactly as a row above
     the context would. */
  if(ctx.acc) items.forEach((it,k)=>{ if(k>=secFrom && !it.accSpec) it.accSpec=ctx.acc; });
  if(ctx.size || ctx.threadLen || ctx.qty){
    const wantsThread=wqaThreadEnds(common.product)>0;
    const ctxTL=ctx.threadLen ? (ctx.threadLen2?ctx.threadLen+'/'+ctx.threadLen2:ctx.threadLen) : '';
    items.forEach(it=>{
      if(!it.M && ctx.size){ it.M=ctx.size; it.conf.size=WQA_CONF.INHERITED; }
      if(!it.TL && ctxTL && wantsThread){ it.TL=ctxTL; it.conf.threadLen=WQA_CONF.INHERITED; }
      /* "All Qty 20 pcs/each size" is one quantity for every row, exactly as a
         diameter or a thread stated once is. */
      if((it.qty==null||it.qty==='') && ctx.qty){ it.qty=ctx.qty; it.conf.qty=WQA_CONF.INHERITED; }
      /* And a quantity the message asked for and never gave is shared the same
         way: every row it reaches asks, rather than defaulting to one piece. */
      else if((it.qty==null||it.qty==='') && ctx.qtyOpen) it.qtyOpen=true;
      /* A material or finish written UNDER the rows is theirs too, as long as
         no group had already answered for them. */
      WQA_ROW_SPEC.forEach(k=>{
        const v=k==='material'?'materialValue':(k==='finish'?'finishValue':'sizeTypeValue');
        if(!it[v] && ctx[k]) it[v]=ctx[k];
      });
    });
  }

  /* ── Derived overall length ───────────────────────────────────────────────
     A sag rod is a threaded end, a plain middle and a threaded end, so when the
     customer labels all three the overall length is arithmetic, not a guess:
     100 + 50 + 100 = 250. A DEFINED business rule, and it needs the labels —
     "M16 / 50 / 100 / 100" is three bare numbers and nothing is derived from
     them, because deciding which one is the middle would be the guess.

     Where the customer ALSO states the overall, theirs is the length and the
     arithmetic only checks it. A disagreement is shown to the reviewer, never
     resolved silently and never added to anything. */
  let derivedL=0, lenClash=false;
  if(ctx.center && ctx.threadLen && wqaThreadEnds(common.product)===2){
    const a=Number(ctx.threadLen), c=Number(ctx.threadLen2||ctx.threadLen), mid=Number(ctx.center);
    if(isFinite(a)&&isFinite(c)&&isFinite(mid)&&(a+mid+c)>0) derivedL=a+mid+c;
    const stated=ctx.length!=='' ? Number(ctx.length) : null;
    lenClash = derivedL>0 && stated!=null && isFinite(stated) && Math.abs(stated-derivedL)>0.5;
    if(derivedL>0){
      items.forEach(it=>{
        if(it.L==null||it.L===''){
          /* The customer's own overall wins; the arithmetic fills only where
             they did not state one. */
          it.L=String(stated!=null&&isFinite(stated) ? stated : derivedL);
          it.conf.length=WQA_CONF.INHERITED;
        }
        if(lenClash) it.Bbad=true;    // shown as "segments vs length" in Review
      });
    }
  }

  /* A message that describes ONE rod instead of listing several — a drawing
     written out in words — leaves the whole specification in the context with no
     row to hang it on. Only when nothing else was read at all does that context
     become the single item it describes. Nothing is invented: every field here
     came from a line the customer actually wrote. */
  /* A quantity is evidence of a rod too: "M16 / 50 / 100 / 100 / Qty 10" gives
     a diameter and a count and no length anyone can trust, and that INCOMPLETE
     row — with Review asking for the length — is a truer answer than no row at
     all. Nothing is invented: L stays null, and the parse still reports itself
     low-confidence, so the message goes on to the AI exactly as before. */
  if(!items.length && common.product && (ctx.size||ctx.length||derivedL||ctx.bodyDia)
     && (ctx.length||derivedL||ctx.qty)){
    const L = ctx.length ? ctx.length : (derivedL ? String(derivedL) : null);
    items.push({M:ctx.size, L, bodyDia:ctx.bodyDia||null, threadEnds:ctxEnds||null,
                TL:ctx.threadLen?(ctx.threadLen2?ctx.threadLen+'/'+ctx.threadLen2:ctx.threadLen):null,
                qty:ctx.qty||null, raw:lines.map(l=>l.trim()).filter(Boolean).join(' · '),
                Bbad:lenClash,
                conf:{size:WQA_CONF.INHERITED,length:WQA_CONF.INHERITED,threadLen:WQA_CONF.INHERITED},
                issues:[], defaulted:{}});
  }

  /* The SAME normaliser the photo and PDF extraction goes through. Everything
     from this line downwards is shared by every source. */
  const norm=wqaNormalizeExtraction({product:common.product,threadEnds,items},{wording:text});
  norm.rows.forEach((r,k)=>{ const a=items[k]&&wqaAccFromSpec(items[k].accSpec,r.finish); if(a) r.accParsed=a; });
  return {common:norm.common, rows:norm.rows, skipped, risky, numeric, unread, accUnsure};
}
/* ── L-Bolt dimension references → canonical TO END ────────────────────────
   Customers dimension L (shank) and W (short leg) TO the top of the bent bar, TO its
   centre line or TO its end; the system's canonical L and W are TO END. TOP adds D,
   CENTER adds D/2, END adds nothing. Nominal diameter only — no bend radius. Pure:
   returns the source untouched alongside the normalized value so the review can show both. */
function normalizeBentDimension(value,reference,diameter){
  const src=Number(value), ref=String(reference||'').toUpperCase(), d=Number(diameter);
  const out={source_value:src,source_reference:ref||null,normalized_value:src,normalized_reference:'END',converted:false,resolved:true};
  if(!(src>0)) { out.resolved=false; return out; }
  if(ref==='END'||ref==='') return out;                       // already TO END, or the document names no reference
  if((ref==='TOP'||ref==='CENTER') && d>0){
    out.normalized_value=Math.round((src+(ref==='TOP'?d:d/2))*100)/100; out.converted=true; return out;
  }
  out.resolved=false; return out;                              // UNCLEAR, or no diameter to convert with: never guess
}
/* ══ THE ONE SHARED NORMALISER ══════════════════════════════════════════════
   Every input source — the deterministic text parser, the AI text fallback and
   the AI photo / PDF extraction — produces the SAME compact extraction:

     {product, material, finish, sizeType, note,
      items:[{M, L, TL, qty, W, Bmid, Bbad}]}

   and hands it to this function. Product mapping, the material / finish / size
   type rules, diameter and thread representation, the required-field flags and
   the Quick Add row shape all live here, once. Nothing downstream of it knows
   or cares which source a quotation came from, so the source cannot change the
   business outcome.

   The two options describe what the EXTRACTOR already did — never which source
   it was:
     wording      raw text the common fields are read from. The text parser
                  passes the whole message; without it the wording is rebuilt
                  from material / finish / sizeType, the way a photo's is.
     inheritGaps  the extractor has no running context of its own, so a value
                  stated once for a whole list may arrive on the first item
                  only. A gap on a LATER item is then filled from the value
                  stated earlier — never backwards, and never over a value the
                  item states for itself.

   d.threadEnds (1 or 2, else null) is the source's evidence about how many ends
   of the rod are threaded. It is read here, not by the caller, so text, photo
   and PDF all resolve the product identically.                              */
function wqaNormalizeExtraction(d, opts){
  d=d||{}; opts=opts||{};
  const word={SAG_ROD:'SAG ROD',STUD:'STUD',ANCHOR_BOLT:'ANCHOR BOLT',L_BOLT:'L BOLT',J_BOLT:'J BOLT'};

  /* Product: an extraction token (SAG_ROD) or an internal type (sagrod). Both
     resolve through the same table, so there is no second mapping to drift. */
  let prod='', prodErr=null;
  const src=String(d.product||'');
  if(src){
    const p=wqaProductByToken(src)||wqaProductByType(src);
    if(p)                    prod=p.type;
    else if(src==='OTHER')   prodErr={code:'no_product'};
    else                     prodErr={code:'unsupported', word:word[src]||src};
  }
  /* Thread arrangement outranks the product word, for every source alike. */
  prod=wqaResolveProduct(prod, d.threadEnds);

  /* Common fields: ONE rule set, whatever the wording came from. */
  let st=String(d.sizeType||'').trim();
  if(/^und(er)?\.?$/i.test(st))   st='under size';     // "under" on a scribbled note
  else if(/^full?\.?$/i.test(st)) st='full size';
  const wording=(opts.wording!=null)
    ? opts.wording
    : [d.material,d.finish,st,word[src]||''].filter(Boolean).join(' ');
  /* An extracted document's own words go through the same vocabulary a pasted
     message does, and reach the same answer. See wqaDetectCommon. */
  const common=wqaDetectCommon(wording);
  common.product=prod;

  const ends=wqaThreadEnds(prod);
  /* The same context that licences R12 -> M12 when a line is read: a rod
     product, or an undersize note. Owned here so a photo and a paste
     standardise identically. */
  const rodSize=ends>0 || common.sizeType==='UNDERSIZE';
  const inh={M:'',TL:'',material:'',finish:'',sizeType:'',grade:'',
             matFrom:'',matDefaulted:false,
             raw:{material:'',finish:'',sizeType:''}};
  const rows=(d.items||[]).map(it=>{
    const conf={...(it.conf||{})};
    const issues=(it.issues||[]).filter(x=>x!=='size'&&x!=='length');
    const defaulted={...(it.defaulted||{})};

    /* A row that says it could not be read is not completed from its
       neighbours. Filling the gap would turn "I could not tell M20 from M30"
       into a confident M20 off the row above — the exact substitution this
       flag exists to prevent. It stays null and Review asks. */
    const unread=!!it.unclear;
    /* ── This row's product ──────────────────────────────────────────────
       Row evidence first: the ends this row states are what this row IS, so an
       Anchor Bolt sits beside a Sag Rod in one document and each is priced as
       itself. Then whatever the row was labelled, then the document. Null when
       nothing says — never the product of the row above. */
    const rowEnds=(it.threadEnds===1||it.threadEnds===2) ? it.threadEnds : null;
    const ownProd=it.product ? (wqaProductByToken(String(it.product))||wqaProductByType(String(it.product))) : null;
    const base=ownProd ? ownProd.type : prod;
    let rowProd = base ? wqaResolveProduct(base,rowEnds)
                       : (rowEnds ? wqaProductFromEnds(rowEnds) : '');
    /* A bend is geometry, and geometry outranks the title: a drawing headed
       "Anchor Bolt" that shows a long leg and a perpendicular short one is an
       L Bolt, and a hook with an inside diameter and a return height is a
       J Bolt. Only where the shape is actually stated — a W, or an ID and an S
       — never from the word alone. */
    /* ── A hook is a J Bolt ────────────────────────────────────────────────
       S is the hook's return height, and no other product in this system has
       one: a Sag Rod, a Stud, an Anchor Bolt and an L Bolt are all described
       without it. So a row that states an S is describing a hook, whatever the
       drawing's title block filed it under.

       This used to require an ID as well, and a drawing that dimensions the
       hook by its RADIUS instead — R 25 — states no inside diameter at all.
       The row was left as the Anchor Bolt the title said, its S dropped for
       having nowhere to go, and its overall height with it. One dimension is
       enough to know the shape; the ID is a separate question, and it stays
       unanswered rather than being computed from the radius. */
    if(it.S!=null&&it.S!==''&&rowProd!=='jbolt') rowProd='jbolt';
    else if(it.ID!=null&&it.ID!==''&&it.S!=null&&it.S!==''&&rowProd!=='jbolt') rowProd='jbolt';
    else if(it.W!=null&&it.W!==''&&(rowProd==='anchorbolt'||rowProd==='sagrod'||!rowProd)) rowProd='lbolt';

    /* ── An overall height that the drawing calls L ───────────────────────
       A J Bolt is described M · H · ID · S · TL. H is the overall height of
       the part, and the schema has no plain length at all — so a J Bolt row
       carrying a length has a dimension with nowhere to go, and the height
       it should have filled is asked for as missing.

       Drawings do not use our letter. The one in front of me dimensions the
       same measurement L 280, running the full height of the bolt beside the
       S and the hook. That is our H under another name, so it is reported as
       H.

       This is a mapping between two names for ONE dimension, not a rule that
       L becomes H: it applies only where the geometry has already proved the
       row is a J Bolt, only where no height was stated, and nowhere else in
       the system. A J Bolt that states both keeps the stated H and leaves the
       L where it is for a person to look at. */
    let srcH=(it.H==null||it.H==='')?'':String(it.H);
    let srcL=(it.L==null||it.L==='')?'':String(it.L);
    let hFromL=false;
    if(rowProd==='jbolt' && !srcH && srcL){ srcH=srcL; srcL=''; hFromL=true; }

    /* ── Wording against geometry ─────────────────────────────────────────
       A one-end thread under a Sag Rod title is an Anchor Bolt, and a bend
       under an Anchor Bolt title is an L Bolt: those are DEFINED mappings and
       they stay. This is the case with no defined answer — the customer wrote
       STUD BOLT and the same message shows a threaded end, and a Stud has no
       thread at all. There is no rule that turns one into the other, so
       nothing is chosen: the row keeps the word the customer used, says the
       two disagree, and cannot be added until a person settles it. */
    /* The evidence may be on the row ("thread one end 100") or stated once for
       the whole message ("one end thread stud bolts"); both contradict a Stud.

       The whole-message reading counts only while the whole message is about
       ONE product. A five-part enquiry that says "both end" under its Sag Rod
       heading has said nothing about the Studs three headings later, and
       holding it against them flagged every one of them as contradicting
       itself. Where the document names no single product, a row is judged on
       what its own section stated. */
    const mixedDoc=!prod && !!it.product;
    const docEnds=(!mixedDoc && (d.threadEnds===1||d.threadEnds===2)) ? d.threadEnds : null;
    const seenEnds=rowEnds||docEnds;
    const sawThread=(seenEnds===1||seenEnds===2) ||
                    (it.TL!=null && it.TL!=='' && String(it.TL)!=='0') ||
                    (it.TLseen!=null && it.TLseen!=='');
    const conflict=(rowProd && wqaThreadEnds(rowProd)===0 && sawThread)
      ? {said:(wqaProductByType(rowProd)||{label:rowProd}).label,
         saw:(seenEnds===1?'one-end thread':(seenEnds===2?'two-end thread':'a thread length'))}
      : null;
    /* A row the drawing DOES classify but Quick Add cannot price — a bent
       L-bolt among straight rods. It is named rather than quietly turned into
       a Sag Rod: the row asks for a product a Quick Add can price, and says
       why. Nothing about it is guessed and nothing about it is sold. */
    const unsupported=(!rowProd && it.product && !ownProd) ? word[String(it.product)]||String(it.product) : '';
    const rEnds=wqaThreadEnds(rowProd);

    let M=wqaNormM(it.M,rodSize);
    if(M) inh.M=M;
    else if(opts.inheritGaps && inh.M && !unread){ M=inh.M; conf.size=WQA_CONF.INHERITED; }

    /* An item may carry its own material and finish. The deterministic parser
       hands over values it has already resolved (materialValue); a photo or a
       PDF hands over the customer's raw wording (material), which goes through
       the SAME wqaDetectCommon rules the document wording does. Neither source
       gets its own normalisation engine. */
    const own=(it.material||it.finish||it.sizeType)
      ? wqaDetectCommon([it.material,it.finish,it.sizeType].filter(Boolean).join(' '))
      : null;
    /* specResolved means the extractor has ALREADY applied row > group >
       document for this item, so an empty value is an answer — "no finish was
       stated for this group" — and must not be refilled from the document.
       That distinction is the whole reason an HDG stated for the first two rows
       stays off the stainless rows below them. */
    /* ── A merged specification cell covers the rows it spans ─────────────
       The extractor reports a block's specification on the FIRST row the merge
       covers and leaves it null on the rest, because that is what the cell
       looks like on the paper. Carrying it down the rest of the block is this
       code's job, and until now nothing did it: every row after the first fell
       back to the document, which on a sheet whose blocks differ says nothing
       at all. A six-row table specified in two merged cells arrived with four
       of its rows blank.

       Silence and a statement are different things. A row that states
       specification wording REPLACES what is being carried — even where our
       vocabulary resolves that wording to no material, which is exactly what
       "DIN 975 GRADE 8.8" does: a strength class is not a material, so the
       material goes empty for the rows that cell covers and the stainless
       block above them stops dead where the merge stops.

       And only where the sheet itself is silent. A document-wide material
       applies to every row that does not speak, so one row's own value can
       never start a block underneath it. */
    const rawIn={material:String(it.material||'').trim(),
                 finish:String(it.finish||'').trim(),
                 sizeType:String(it.sizeType||'').trim()};
    const said={material:rawIn.material!=='', finish:rawIn.finish!=='',
                sizeType:rawIn.sizeType!==''};
    /* The document's own words, kept beside the value they became. "A2-70"
       and SS304 are the same fact written twice, and a person checking a row
       against the paper needs to see both — the normalised value is what is
       quoted, the wording is what was read. Carried down a block exactly as
       the value is, so row 4 of a merged cell can say where its HDG came
       from. Never invented: a row the document did not speak for has none. */
    const rawSeen={material:'',finish:'',sizeType:''};
    let matInherited=false;
    const carry=(k,v)=>{
      if(v||said[k]){
        inh[k]=v; inh.raw[k]=rawIn[k]; rawSeen[k]=rawIn[k];
        /* A material's provenance travels with it: the class it was read from
           and whether it was our mapping rather than the customer's own word.
           Without this, row 4 of a merged cell showed 4140 QT with nothing
           saying it came from the block's GRADE 8.8. */
        if(k==='material'){
          inh.grade=(own&&own.strengthGrade)||'';
          inh.matFrom=(own&&own.materialDefaulted)?own.materialDefaultedFrom:'';
          inh.matDefaulted=!!(own&&own.materialDefaulted);
        }
        return v;
      }
      if(opts.inheritGaps && !common[k] && !unread){
        rawSeen[k]=inh.raw[k];
        if(k==='material') matInherited=true;
        return inh[k];
      }
      return v;
    };
    const spec = it.specResolved ? {
      material:String(it.materialValue||''), finish:String(it.finishValue||''),
      sizeType:String(it.sizeTypeValue||''),
    } : {
      material: carry('material', (own&&own.material) || common.material || ''),
      finish:   carry('finish',   (own&&own.finish)   || common.finish   || ''),
      sizeType: carry('sizeType', (own&&own.sizeType) || common.sizeType || ''),
    };
    /* The strength class travels with the material it stands in place of. */
    const gradeVal = it.specResolved
      ? String(it.grade||'')
      : ((own&&own.strengthGrade) || (said.material ? '' : inh.grade)
         || it.grade || common.strengthGrade || '');
    /* What the document actually said, kept before the rule below runs. A
       stainless specification that says "Plain" HAS said something, and the row
       should show that it was read rather than look as though the word was
       missed on the way in. */
    const finishSeen=spec.finish;
    /* Whatever the finish resolved to, stainless has none. Applied HERE, in the
       normaliser every source runs through, so a pasted message, a photo and a
       PDF all agree. */
    spec.finish=wqaFinishFor(spec.material,spec.finish);
    let tl=wqaSplitThread(it.TL);
    if(tl.a) inh.TL=it.TL;
    else if(opts.inheritGaps && inh.TL && !unread){ tl=wqaSplitThread(inh.TL); conf.threadLen=WQA_CONF.INHERITED; }

    /* A single thread value read as this ROW's product means: both ends on a
       Sag Rod, one on an Anchor Bolt, and nothing at all where the product is
       still unknown — an unplaced number is not a thread length. */
    if(tl.a && !tl.b && rEnds===2){ tl={a:tl.a,b:tl.a}; }
    else if(tl.a && !rowProd && !tl.b){ tl={a:'',b:''}; }

    /* Ours, not the customer's — and said so, including WHERE it came from. */
    let stDefaulted=false, stWhy='';
    if(!spec.sizeType){
      const def=dcCompanySizeType(rowProd,spec.material,M);
      if(def.sizeType){ spec.sizeType=def.sizeType; stDefaulted=true; stWhy=def.why; }
    }
    /* And then the hard rule, over both the customer's wording and our own
       default: a Stud has no size type at all. A 4140 QT stud does not become
       fullsize because 4140 usually is. */
    if(!dcProductHasSizeType(rowProd)){ spec.sizeType=''; stDefaulted=false; stWhy=''; }

    /* Kept beside the row and used by nothing else until a person picks the
       product this thread belongs to. */
    const threadSeen=(it.TLseen==null||it.TLseen==='')?'':String(it.TLseen);
    const row={size:M, product:rowProd, unsupported, productConflict:conflict, threadSeen,
               /* Evidence, kept beside the row and used by nothing else: the
                  weight and the price still come from the nominal size. */
               bodyDia:(it.bodyDia==null||it.bodyDia==='')?'':String(it.bodyDia),
               /* Evidence only, and never a quotation field: a bend radius is
                  not an inside diameter and not a return height. */
               radius:(it.R==null||it.R==='')?'':String(it.R),
               /* Evidence only: an anchor plate belongs to the assembly, not the
                  rod. Never W, never an item, never priced. */
               plate:(it.plate==null||it.plate==='')?'':String(it.plate),
               /* Read from the customer, priced from by nothing: the schema has
                  no pitch and no thread-series field, and inventing one from
                  these would be worse than showing them as what they are. */
               pitch:(it.pitch==null||it.pitch==='')?'':String(it.pitch),
               series:(it.series==null||it.series==='')?'':String(it.series),
               /* The same two, as the one note the row shows and carries. The
                  size beside it is untouched: M12 stays M12, 1/2" stays 1/2".
                  Nothing downstream reads this. */
               threadRef:dcThreadRefFrom(it.pitch,it.series,M),
               length:srcL,
               w:(it.W==null||it.W==='')?'':String(it.W),
               /* The value the drawing wrote, and the name it wrote it under,
                  kept apart: hFromL says the height came in as an L so the
                  review can show the reading rather than hide it. */
               h:srcH, hFromL,
               id:(it.ID==null||it.ID==='')?'':String(it.ID),
               s:(it.S==null||it.S==='')?'':String(it.S),
               threadLen:tl.a, threadLen2:tl.b,
               qty:(it.qty==null||it.qty==='')?'':String(it.qty),
               material:spec.material, finish:spec.finish, sizeType:spec.sizeType,
               finishSeen:(finishSeen!==spec.finish?finishSeen:''),
               specRaw:(it.specResolved?{material:'',finish:'',sizeType:''}:rawSeen),
               stDefaulted, stWhy,
               matFrom: it.matFrom || ((own&&own.materialDefaulted)?own.materialDefaultedFrom:'')
                        || (matInherited ? inh.matFrom : '')
                        || (spec.material===common.material ? (common.materialDefaultedFrom||'') : ''),
               matDefaulted: it.matDefaulted!==undefined ? !!it.matDefaulted
                            : ((own&&own.materialDefaulted) || (matInherited && inh.matDefaulted)
                               || (spec.material===common.material && !!common.materialDefaulted)),
               /* Read off the document and kept as the fact it is: a strength
                  class, not a material. The row shows it and asks for the
                  material rather than choosing an alloy nobody wrote. */
               grade:String(gradeVal||''),
               issues, defaulted, conf, aiUncertain:[],
               raw: it.raw!=null ? String(it.raw)
                    : [it.M,it.L,it.TL,(it.qty!=null?it.qty+'pcs':null)].filter(v=>v!=null).join(' x ')};

    if(row.size   && conf.size===undefined)      conf.size=WQA_CONF.DETECTED;
    if(row.length && conf.length===undefined)    conf.length=WQA_CONF.DETECTED;
    if(row.threadLen && conf.threadLen===undefined) conf.threadLen=WQA_CONF.DETECTED;
    if(row.qty)   { if(conf.qty===undefined) conf.qty=WQA_CONF.DETECTED; }
    else          conf.qty=WQA_CONF.UNCERTAIN;   // optional: recorded, not an issue

    /* ── No count at all is one piece ────────────────────────────────────────
       An approved rule, and it lives HERE because this is the one funnel every
       source runs through: a pasted message, a photograph, a PDF and a drawing
       all reach the same answer instead of three of them reaching it and one
       not. "M12 x 500" on its own is a customer asking for a rod, and one rod
       is what they asked for.

       It is applied ONLY to a genuinely absent count, and the distinction is
       the whole rule:

         nothing said about quantity      -> 1, shown as a default
         quantity asked for, not readable -> blank, and the row asks

       So "qty tbc" and a photograph whose count could not be made out are
       never quietly turned into one piece — that would be the parser inventing
       an order size. A stated 0 is a stated value and is left alone: it is not
       absent, and the existing checks refuse it in the ordinary way. */
    /* Two ways a source can say it: a pasted line that used the word and gave
       no figure, and an extraction whose own "could not read" note names the
       count ("qty unreadable"). A row that is unclear about something ELSE —
       "size M20 or M30" — has a genuinely absent quantity and is not punished
       for it; it is already asking about its size. */
    const qtyUnreadable=!!it.qtyOpen || WQA_COUNT_WORD_RE.test(String(it.unclear||''));
    row.qtyUnreadable=qtyUnreadable;
    if(row.qty==='' && !qtyUnreadable){
      row.qty='1';
      conf.qty=WQA_CONF.DEFAULTED;
      defaulted.qty=true;
    }

    /* A + B + C did not reconcile with the overall length: surfaced for a human
       look, never silently corrected and never dropped. */
    if(it.Bbad) row.aiUncertain.push('segments vs length');
    /* The extractor could not read something on this row and said so. It is a
       note for a person, never a value: whatever it names is null, and the row
       asks for it in the ordinary way. */
    if(it.unclear){
      row.aiUncertain.push(String(it.unclear).slice(0,40));
      /* The badge is trimmed to fit a pill; the note itself is kept whole.
         Reading candidate dimensions out of the TRIMMED text could cut "1000"
         down to "100" and hand the row a length nobody wrote. */
      row.unclearRaw=String(it.unclear);
    }
    /* L Bolt only: bring L and W to the canonical TO END, and keep what the drawing said.
       Unresolved (reference unclear / no diameter) is never converted and never assumed TO END:
       the value is held back as evidence and the row asks for it. */
    if(rowProd==='lbolt'){
      const dm=/^M\s*(\d+(?:\.\d+)?)/i.exec(String(row.size||'')), dia=dm?Number(dm[1]):0;
      /* R3 FAST Loop #6: a drawing's references are read twice (ai_refcheck_run).
         Only two readings that agree convert on their own; a conflict, an
         unclear first reading, a bolt the check did not report or a check that
         never answered holds the value back as evidence, and the row asks a
         person to choose the reference (wqaRefChoose). No check field at all
         (pasted text) keeps the earlier behaviour exactly. */
      const chk={L:it.Lchk,W:it.Wchk}, alt={L:it.Lalt,W:it.Walt};
      const norm=[['length','L',it.Lref],['w','W',it.Wref]].map(([k,lab,ref])=>{
        if(row[k]==='') return null;
        const c=chk[lab];
        if((c==='conflict'||c==='unclear'||c==='unmatched'||c==='failed') && dia>0){
          const eff=x=>{ const u=String(x==null?'':x).toUpperCase(); return u===''?'END':u; };
          const reads=[...new Set([ref,(c==='conflict'||c==='unclear')?alt[lab]:undefined]
            .filter(x=>x!==undefined).map(eff).filter(x=>x==='TOP'||x==='CENTER'||x==='END'))];
          const src=Number(row[k]);
          (row.refAsk||(row.refAsk={}))[k]={dim:lab, src, dia, reads, why:c};
          row[k]='';
          return {k:lab, source_value:src, source_reference:ref==null?null:String(ref).toUpperCase(),
                  normalized_value:src, normalized_reference:'END', converted:false, resolved:false, ask:true};
        }
        if(ref==null||ref==='') return null;
        const n=normalizeBentDimension(row[k],ref,dia);
        if(n.resolved){ if(n.converted) row[k]=String(n.normalized_value); if(c==='agree') n.checked=true; }
        else { row[k]=''; row.aiUncertain.push((lab+' '+n.source_value+': '+(String(ref).toUpperCase()==='UNCLEAR'?'reference unclear':'needs diameter')).slice(0,40)); }
        return Object.assign({k:lab},n);
      }).filter(Boolean);
      if(norm.length) row.dimNorm=norm;
    }
    /* Product-aware, per ROW: only a product that HAS a thread can be missing
       one, and which product this is was decided a few lines above. */
    if(rEnds>0 && !row.threadLen && row.length) defaulted.threadMissing=true;
    if(!row.size)   issues.push('size');
    /* Each product's own dimensions, by name — a J Bolt has no length to be
       missing, and an L Bolt is short of something quite different. */
    ((wqaProductByType(rowProd)||WQA_NO_PRODUCT).dims||['length']).forEach(d=>{
      if(d==='size'||d==='threadLen') return;
      if(!row[d]) issues.push(d);
    });
    return row;
  });

  /* An overall dimension belongs to ONE part. Where the extractor read two
     candidates for a row and one of them is already another row's length, the
     answer is forced — see wqaResolveAmbiguousLengths. */
  wqaResolveAmbiguousLengths(rows);

  /* The rows have been resolved, so the header can now say what they ARE:
     the shared value where they agree, Mixed where they do not. Done here, in
     the one normaliser every source runs through, so a pasted message and a
     photograph of the same specification produce the same header. */
  WQA_ROW_SPEC.forEach(k=>{ const v=wqaRowsCommonValueOf(rows,k);
                            if(v!==WQA_MIXED) common[k]=v; });
  /* Product is a row field now, so the header says what the rows say: the
     shared product, or nothing at all while they differ. Mixed is read from
     the rows themselves (wqaIsMixed), never stored as if it were a product. */
  const cp=wqaRowsCommonValueOf(rows,'product');
  common.product = cp===WQA_MIXED ? '' : cp;
  common.productMixed = cp===WQA_MIXED;

  /* Same precedence the AI path has always had: nothing usable outranks an
     unsupported product, because the review screen can ask for a product but
     cannot invent rows. */
  if(!rows.length) return {ok:false, common, rows:[], error:{code:'no_rows'}};
  /* An unsupported document word is still fatal — unless the rows themselves
     resolved to products we can price, which is the mixed-drawing case. */
  if(prodErr && !rows.some(r=>r.product)) return {ok:false, common, rows, error:prodErr};
  return {ok:true, common, rows};
}

/* ── An overall dimension belongs to one part ───────────────────────────────
   A sheet of stacked parts carries one overall dimension line per part. When
   the extractor cannot tell which of two of them belongs to a row, it says so
   —— "check length 865 or 1000" —— and the row asks for its length. On the HAB
   sheet that left two of five rows unpriced over a question with only one
   possible answer: 865 is the row above's length, and an overall dimension
   line belongs to one part, so this row's is the 1000.

   So the choice is closed by ELIMINATION, and only by elimination:

     * the row must have no length of its own;
     * the extractor must have named two or more candidates for it;
     * every candidate but one must already be the length of ANOTHER row;
     * no other ambiguous row may want that same remaining value.

   Nothing is inferred from proximity, from the order of the rows, or from what
   a length usually is. Where two candidates are still free, or two rows want
   the same one, nothing is decided and both rows go on asking — uncertainty is
   preserved exactly as it was. A row resolved this way says so on its face, so
   a value that came from reasoning is never mistaken for one that was read.

   The reverse case is handled by the same rule: if the row really is the 865
   and another part has claimed the 1000, then 865 is what is left, and 865 is
   what the row gets. */
function wqaAmbiguousLengthCandidates(r){
  if(!r || r.length) return [];
  const out=[];
  /* The note as it was written, never the pill it was trimmed into. */
  const notes=r.unclearRaw ? [r.unclearRaw] : (r.aiUncertain||[]);
  notes.forEach(t=>{
    const s=String(t||'');
    /* A note about the LENGTH, offering a choice. "size M20 or M30" is a
       different doubt about a different field and is left alone. */
    if(!/length|overall|\blong\b/i.test(s)) return;
    if(!/\bor\b|\/|,/.test(s)) return;
    (s.match(/\d+(?:\.\d+)?/g)||[]).forEach(n=>{
      const v=Number(n);
      if(v>0 && out.indexOf(v)<0) out.push(v);
    });
  });
  return out.length>=2 ? out : [];
}
function wqaResolveAmbiguousLengths(rows){
  if(!rows || rows.length<2) return;
  /* Read BEFORE anything is resolved, so the outcome cannot depend on the
     order the rows happen to be in. */
  const taken=new Set();
  rows.forEach(r=>{ const v=Number(r.length); if(v>0) taken.add(v); });

  const claims=new Map();
  rows.forEach(r=>{
    const cands=wqaAmbiguousLengthCandidates(r);
    if(!cands.length) return;
    const free=cands.filter(v=>!taken.has(v));
    if(free.length!==1) return;              // still a choice: the row asks
    const list=claims.get(free[0])||[];
    list.push(r);
    claims.set(free[0],list);
  });
  claims.forEach((list,v)=>{
    if(list.length!==1) return;              // two rows, one value: forced for neither
    const r=list[0];
    r.length=String(v);
    r.lengthResolved=String(v);
    r.conf=r.conf||{};
    r.conf.length=WQA_CONF.DEFAULTED;
    r.issues=(r.issues||[]).filter(x=>x!=='length');
    /* The doubt is answered, so the note that carried it goes. Any other
       uncertainty on the row stays exactly where it was. */
    r.aiUncertain=(r.aiUncertain||[]).filter(t=>!/length|overall|\blong\b/i.test(String(t)));
  });
}

/* ── Deterministic-first quality gate ───────────────────────────────────────
   Decides whether the parser genuinely understood the message. Deliberately
   NOT a completeness check: a blank Qty, Size Type, Finish, Material or even
   Product is a legitimate staff-review state and never triggers AI on its own.

   Three things do:
     * no row carries a usable length at all,
     * a shared spec header could not be told apart from an item row, so a
       thread length may be sitting in the list as a 75mm rod, or
     * too much of the message went unread — the shape of a free-form sentence
       the parser skimmed rather than read.

   "Unread" is per line and counts only lines the parser did nothing with. A
   line that became shared context — a diameter, a thread end, an overall length
   — was read just as truly as one that became an item, so a message that is
   mostly context still scores as fully read. Measured against the real parser:
   every list shape and every context-and-rows shape leaves nothing unread,
   while the free-form "left thread 68 / center 12 / other side 20" message
   leaves half its numeric lines unused. */
function wqaParseQuality(parsed, text){
  /* A row is usable when it carries the FIRST dimension its own product needs:
     a length for a rod, a long leg for an L Bolt, an overall height for a
     J Bolt. Measuring every product by "length" would send every J Bolt message
     to the AI for want of a field a J Bolt does not have. */
  const usable = (parsed.rows||[]).filter(r=>{
    const p=wqaProductByType(r.product||'')||null;
    const key=(p && (p.dims||[]).filter(d=>d!=='size'&&d!=='threadLen')[0]) || 'length';
    return parseFloat(r[key])>0;
  });
  if(!usable.length) return {ok:false, why:'no-usable-rows'};
  /* A short spec line the structure could not separate from an item: the row we
     would show may be a thread length wearing a length's clothes. Hand the
     message to the AI rather than accept it. */
  if(parsed.risky) return {ok:false, why:'spec-header-ambiguous'};
  const lines = parsed.numeric!=null ? parsed.numeric
              : String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(l=>l && /\d/.test(l)).length;
  const unread = parsed.unread!=null ? parsed.unread : Math.max(0, lines-usable.length);
  /* More than a third of the numeric lines meaning nothing to the parser is the
     signature of prose, not of a list with a header. */
  if(unread*3 > lines){
    return {ok:false, why:'low-coverage', rows:usable.length, lines, unread};
  }
  return {ok:true, rows:usable.length};
}

/* ── Accuracy before completeness ───────────────────────────────────────────
   A field is never filled because it is required. It is filled when the source
   states it, or when a defined business rule turns what the source states into
   our vocabulary — R12 on an undersized rod is M12, one threaded end is an
   Anchor Bolt, a Sag Rod's shared 75 is 75/75. Everything else stays null and
   is asked for HERE, by name, on the row that needs it. Needs Size, Needs
   Thread, Needs Material and Needs Size Type are the system working, not
   failing: a blank field costs a question, a guessed one costs a wrong
   quotation. */
/* The one question a row cannot answer anything else without. A product that
   has a size type and has not been given one has no diameter, so it has no
   weight, no rate and no price — and every one of those would otherwise be
   reported as a separate thing to fix. */
function wqaSizeTypeOpen(r){
  const t=wqaRowProduct(r);
  const prod=wqaProductByType(t)||WQA_NO_PRODUCT;
  return !!(prod.needSizeType && dcProductHasSizeType(t) && !wqaRowSpec(r,'sizeType'));
}
/* R3 FAST Loop #1: a metric size the diameter tables do not hold (M56, M64)
   is still a size — what it lacks is a bar. Once a PERSON has typed the actual
   diameter, the row is weighed on that bar exactly as any manual Ø is. Only a
   well-formed metric nominal qualifies, so a misread "M2O" is still refused, and
   nothing is written to Diameter Settings. */
function wqaManualDia(r){ return (r && r.diaManual) ? parseFloat(String(r.diaMm||'').trim()) : NaN; }
function wqaMetricNominal(s){ return /^M\d{1,3}(?:\.\d+)?$/i.test(String(s||'').trim()); }
function wqaSizeWeighable(r, size){
  const s=size===undefined ? r.size : size;
  return isKnownSize(s) || (wqaMetricNominal(s) && wqaManualDia(r) > 0);
}
function wqaRowMissing(r){
  /* THIS row's product decides what this row needs: an Anchor Bolt wants one
     thread value, a Sag Rod a pair, a Stud none at all. A document showing
     "Mixed" at the top validates every row by its own rules, never by the
     summary. */
  const t=wqaRowProduct(r);
  const prod=wqaProductByType(t)||WQA_NO_PRODUCT;
  const miss=[];
  if(!t)                       miss.push('Product');
  if(!String(r.size).trim())   miss.push('Size');
  /* Read, kept, shown — and not accepted. A size we do not recognise may be a
     typo on the customer's order or a misread digit on a photograph; either way
     it has no diameter, so it has no weight, so it must not reach a price. */
  else if(!wqaSizeWeighable(r))miss.push('Valid Size');
  /* Read, recognised — and no diameter AS ASKED FOR. There is no undersize M24,
     so an undersized M24 rod cannot be weighed and must not be priced. Skipped
     while the size type itself is still an open question, because THAT is the
     question and a row should only ever be asked one thing at a time. */
  /* The size is fine; the BAR is the problem. "Needs Valid Size" was the
     wrong sentence for an M14 whose fullsize bar we do not stock — the size
     is one we recognise, and what is missing is a diameter. */
  else if(r.noDia && !wqaSizeTypeOpen(r))
                               miss.push('Diameter');
  /* Each product asks for its own dimensions, by name: an L Bolt wants L and
     W, a J Bolt wants H, ID and S, and nothing is invented for the ones it
     does not have. */
  /* Present and positive. A length of 0 is not a length: it weighs nothing, so
     the row's price becomes the Additional Cost standing alone — RM 0.60 for a
     rod with no steel in it — and the row was not blocked because the box was
     not empty. Blank and zero are the same answer here: the drawing has not
     said how long it is. */
  (prod.dims||[]).forEach(d=>{
    if(d==='size'||d==='threadLen') return;
    const v=String(r[d]==null?'':r[d]).trim();
    if(!v || !(parseFloat(v)>0)) miss.push(WQA_DIM_LABEL[d]||d);
  });
  /* ── Quantity ────────────────────────────────────────────────────────────
     A count that was never mentioned is one piece, and the normaliser has
     already put it in the box — so an ordinary "M12 x 500" arrives here with a
     quantity and is not asked for one.

     What IS asked for is the other case: the customer wrote "qty" and the
     value could not be read. That row is short of a real answer, and it says
     so here by name rather than being discovered at the click. */
  if(r.qtyUnreadable && !String(r.qty||'').trim()) miss.push('Qty');
  /* The customer's material or nothing. Every rod is made of something, so a
     blank one means "not stated" — never "mild steel". Asked for only once the
     product is known, since Product is already the blocker until then. */
  if(t && !wqaRowSpec(r,'material')) miss.push('Material');
  if(wqaSizeTypeOpen(r)) miss.push('Size Type');
  /* A product that HAS a thread needs one: a Sag Rod as the pair 75/75 or
     50/110, an Anchor Bolt as the single value 100. Product-specific, never one
     rule for all — a Stud has no thread and is never asked for one. */
  if(prod.threadEnds>0 && !wqaThreadValue(r)) miss.push('Thread');
  /* ── The same two boxes the ADD path insists on ────────────────────────
     A row is priced one of two ways, and each way has its own requirement.

     COMPUTED (Auto Round, No Round): the price comes out of weight x cost
     rate + additional cost, so the rate has to be there — and on a product
     with no automatic pricing the surcharge has to be there too. Both are
     asked for HERE, on the row, where a person can answer them, instead of
     being discovered at the click. This is the half of the live blocker the
     screen was hiding: an L Bolt with a rate typed and no surcharge showed a
     price, said nothing was missing, and was then refused by the calculator.

     STATED (Manual Price, and the price reused from a previous quotation):
     the figure IS the price. Nothing is computed from a rate, so neither box
     is required — asking for them was the other half of the blocker. */
  /* And not while THE question is still open. With no size type there is no
     diameter, so there is no rate to look up and no price to compute: asking
     for either would put two more questions on a row whose single real answer
     is the one above, and hide it. Same rule as Valid Size, three lines up. */
  let rateMissing=false;
  if(wqaSizeTypeOpen(r)) return miss;
  /* A row nobody has priced yet is not short of a rate: it is NOT PRICED,
     which RM/pc says ("Set price") and the footer counts. The rate and price
     questions start once a person has set pricing on it. */
  const priced=wqaRowHasPricing(r);
  if(t && priced && (r.priceMode||'auto')!=='manual'){
    if(!String((r.calc&&r.calc.costRate)||'').trim()){ miss.push('Cost Rate'); rateMissing=true; }
    if(dcNeedsTypedAddCost(t) && !String((r.calc&&r.calc.addCost)||'').trim()){
      miss.push('Additional Cost'); rateMissing=true; }
  }
  /* A blank rate ALREADY explains a price of zero. Saying both would ask the
     same question twice and hide which one to answer. */
  if(priced && !rateMissing && !(parseFloat(r.calc&&r.calc.finalUnitPrice)>0)) miss.push('Price');
  /* An accessory the message named without a count it could be read from:
     detected, kept, and asked for — never guessed. */
  if(wqaAccNeedsQty(r.acc)) miss.push('Accessory Qty');
  return miss;
}

/* The calculator holds thread length in ONE free-text field, and already reads
   the "100/100" pair form. So both ends travel as written: a pair stays a pair,
   a single value stays single. Nothing is invented and nothing is lost. */
function wqaThreadValue(r){
  const a=String(r.threadLen||'').trim(), b=String(r.threadLen2||'').trim();
  if(!a) return '';
  return b ? a+'/'+b : a;
}
/* Has a person set any pricing on this row at all? Until then the row is
   simply not priced yet — not short of a Cost Rate. */
function wqaRowHasPricing(r){
  return !!r && ((r.priceMode||'auto')==='manual'
    || ['costRate','addCost','markup'].some(k=>r.priceOverride && r.priceOverride[k]!==undefined));
}

/* ════════════════════════════════════════════════════════════════════════════
   HOST INTERFACE — the only part of this file that did not come from index.php.
   ════════════════════════════════════════════════════════════════════════════ */
/* Bump on every change to this file. MAJOR when a caller would have to change. */
const QUO_PARSER_CORE_VERSION = '1.0.0';
/* The shape of the interface below. Changes only when a name is removed or its
   meaning changes; a consumer built against another number must refuse to run. */
const QUO_PARSER_CORE_CONTRACT = 1;

/* Custom Diameter Settings rows, as api.php?action=get_diameter_settings returns
   them. index.php assigns dsRulesCache itself and does not need this; a host
   that cannot reach that variable (Node, a bundled module) hands the rows in
   here. Same normalisation the page applies. */
function quoParserCoreSetDiameterRules(rules){
  dsRulesCache=(Array.isArray(rules)?rules:[]).map(normalizeDSRule);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    QUO_PARSER_CORE_VERSION: QUO_PARSER_CORE_VERSION,
    QUO_PARSER_CORE_CONTRACT: QUO_PARSER_CORE_CONTRACT,
    quoParserCoreSetDiameterRules: quoParserCoreSetDiameterRules,
    wqaParseText: wqaParseText,
    wqaParseQuality: wqaParseQuality,
    wqaNormalizeExtraction: wqaNormalizeExtraction,
    wqaRowMissing: wqaRowMissing,
    wqaRowBlocked: wqaRowBlocked,
    wqaRowProduct: wqaRowProduct,
    wqaRowSpec: wqaRowSpec,
    wqaRowHasPricing: wqaRowHasPricing,
    wqaThreadValue: wqaThreadValue,
    wqaThreadEnds: wqaThreadEnds,
    wqaPairThread: wqaPairThread,
    wqaSplitThread: wqaSplitThread,
    wqaProductByType: wqaProductByType,
    wqaProductByToken: wqaProductByToken,
    wqaSizeTypeOpen: wqaSizeTypeOpen,
    isKnownSize: isKnownSize,
    dcBuiltInDiameter: dcBuiltInDiameter,
    getDSDisplayRules: getDSDisplayRules,
    normalizeDSRule: normalizeDSRule,
    WQA_PRODUCTS: WQA_PRODUCTS,
    WQA_MATERIALS: WQA_MATERIALS,
    WQA_FINISHES: WQA_FINISHES,
    WQA_CONF: WQA_CONF,
    WQA_DIM_LABEL: WQA_DIM_LABEL,
    DC_SIZE_TYPE_RULES: DC_SIZE_TYPE_RULES,
    wqa: wqa,
    materialLabel: materialLabel,
  };
}
