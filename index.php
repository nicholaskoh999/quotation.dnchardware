<?php require_once __DIR__ . '/auth.php'; dc_require_login(); ?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<script>
/* Language boot. Runs before first paint so the page never flashes the wrong
   language on reload. Deliberately duplicates the few lines of dcLang() rather
   than waiting for the main script at the end of <body> — keep the storage key
   and the two language codes in step with the i18n runtime down there. */
(function(){try{
  var l=localStorage.getItem('dc_lang'); if(l!=='zh'&&l!=='en') l='en';
  var r=document.documentElement;
  r.setAttribute('data-lang',l);
  r.setAttribute('lang', l==='zh' ? 'zh-Hans' : 'en');
}catch(e){}})();
</script>
<title>Der-Cheng Quotation v2.24.0</title>
<!-- App icons / Home Screen -->
<link rel="icon" href="/assets/icons/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#5b7af5">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Quotation">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
/* ═══════════════ DESIGN TOKENS ═══════════════ */
:root{
  /* v2.24.1 brightness pass. The page and the sidebar sit on a cool tinted
     ground; cards stay pure white and now read as raised panels on top of it
     rather than as slightly-different white on white. Not a dark theme — every
     surface is still light, just no longer all within two points of #fff. */
  --bg:#e8ecf3; --surface:#ffffff; --surface2:#f3f5f8; --sidebar-bg:#e8edf4;
  /* Quick Add review table: a barely-there blue-grey for even rows, and one
     muted blue used for EVERY item number (never a colour per row). */
  --zebra:#fafbfd; --accent-num:#5a6ea8; --surface3:#eef0f4;
  /* Slightly deeper so an edge still reads against a tinted page. */
  --border:#d9dfe9; --border-focus:#3b5bdb;
  --text:#0d0f14; --text-2:#2a3040; --text-muted:#505868;
  --accent:#2547d0; --accent-2:#1c3faa; --accent-light:#eef1fd; --accent-mid:#c7d0f8;
  --green:#0e7a38; --green-2:#16a34a; --green-light:#e5f7ea;
  --wa:#25d366; --wa-hover:#1db954;
  --red:#dc2626; --red-light:#fef2f2; --red-mid:#fecaca;
  --amber:#b45309; --amber-light:#fffbeb; --amber-mid:#fde68a;
  /* Softer but deeper: a hairline to seat the edge, then a wider low-opacity
     spread so a white card lifts off the tinted page without a hard drop. */
  --shadow-sm:0 1px 2px rgba(20,25,40,.06), 0 2px 8px rgba(20,25,40,.07);
  --shadow:0 1px 3px rgba(20,25,40,.07), 0 8px 24px rgba(20,25,40,.09);
  --shadow-lg:0 12px 38px rgba(20,25,40,.18);
  --r:14px; --r-sm:10px; --r-xs:7px;
  /* one control height language, shared with companies.php */
  --control-h:40px; --control-h-lg:48px; --pill-r:999px;
  --banner-h:0px; --header-h:58px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-tap-highlight-color:transparent;scroll-behavior:smooth}
body{
  font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text);
  font-size:15px; line-height:1.5; min-height:100vh; -webkit-font-smoothing:antialiased;
  overflow-x:hidden; max-width:100vw;
}
img,svg{display:block}
button{font-family:inherit}
input,select,textarea{font-family:inherit}

/* ═══════════════ TEST BANNER — slim ═══════════════ */
.test-banner{
  position:sticky; top:0; z-index:300; height:26px;
  background:#92400e;
  color:#fde68a; display:flex; align-items:center; justify-content:center; gap:10px;
  font-size:11px; font-weight:700; letter-spacing:.02em; text-align:center;
  padding:0 12px; box-shadow:0 1px 4px rgba(0,0,0,.2);
}
.test-banner .tb-sub{font-weight:500; opacity:.85; letter-spacing:0}

/* ═══════════════ HEADER ═══════════════ */
.app-header{
  position:sticky; top:var(--banner-h); z-index:250; height:var(--header-h);
  background:linear-gradient(135deg,var(--accent-2),var(--accent));
  color:#fff; display:flex; align-items:center; gap:10px; padding:0 16px;
  box-shadow:0 2px 12px rgba(28,63,170,.3);
}
.hdr-burger{
  display:none; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.22);
  color:#fff; width:34px; height:34px; border-radius:var(--r-sm); font-size:16px; cursor:pointer; flex-shrink:0;
}
/* Brand block = app icon + title, the whole thing links home.
   Negative margin cancels the padding so the 44px tap target does not grow the header. */
.hdr-brand{
  flex:1; min-width:0; display:flex; align-items:center; gap:10px; min-height:44px;
  /* Horizontal padding only, so the hover plate never adds to the header height.
     min-height alone provides the 44px tap target. */
  color:inherit; text-decoration:none; border-radius:var(--r-sm); padding:0 6px; margin:0 -6px;
  transition:background .15s;
}
.hdr-brand:hover{background:rgba(255,255,255,.10)}
.hdr-brand:focus-visible{outline:2px solid rgba(255,255,255,.8);outline-offset:2px}
/* The app icon is a solid blue tile, so it would disappear into the blue header
   (contrast 1.04). A white plate with 2px padding makes it read as a brand mark. */
.hdr-logo{
  width:32px;height:32px;background:#fff;border:1px solid rgba(255,255,255,.55);
  border-radius:var(--r-sm);padding:2px;flex-shrink:0;display:block;object-fit:cover;
}
.hdr-text{flex:1;min-width:0}
.hdr-text h1{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hdr-text p{font-size:11px;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hdr-actions{display:flex;gap:6px;flex-shrink:0}
.hdr-btn{
  background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.24); color:#fff;
  border-radius:var(--pill-r); padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer;
  display:flex; align-items:center; gap:5px; white-space:nowrap; text-decoration:none;
  transition:background .15s;
}
.hdr-btn:hover{background:rgba(255,255,255,.26)}
.hdr-btn.icon-only{padding:6px 9px}
@media (max-width:820px){
  .hdr-burger{display:flex;align-items:center;justify-content:center}
  /* These buttons are label-only (no icons), so hiding the label used to leave
     five empty 14px-tall boxes between 641px and 820px. The burger is already
     visible at this width and the sidebar carries all five actions, so hide
     them outright instead. */
  .hdr-actions{display:none}
}
/* ── Mobile-only polish ≤640px ── */
@media (max-width:640px){
  /* Header action buttons are already hidden from 820px down */
  .app-header{gap:8px;padding:0 10px}

  /* Shell / main tighter padding */
  .app-shell{padding:0 6px}
  .main{padding:12px 0 120px; gap:10px}

  /* Cards: reduce padding, smaller radius */
  .card{padding:13px 12px!important; border-radius:var(--r-sm)!important}

  /* Customer meta: stack on mobile */
  .qi-compact-main .meta{display:flex; flex-direction:column; gap:2px}
  .qi-compact-main .meta span{display:block}

  /* Reduce stepper height */
  .stepper{padding:8px 10px}

  /* Type picker 2-col on narrow */
  .type-picker{grid-template-columns:repeat(2,1fr)}

  /* Finish pills: 2-col */
  .finish-pills{grid-template-columns:repeat(2,1fr)}
}

/* ═══════════════ SHELL / SIDEBAR ═══════════════ */
.app-shell{
  display:flex; align-items:flex-start;
  max-width:1440px; margin:0 auto; padding:0 12px;
}
.sidebar{
  /* Its own tone so the rail reads as chrome, distinct from the white cards. */
  background:var(--sidebar-bg); border-right:1px solid var(--border);
  width:196px; flex-shrink:0; padding:14px 8px 14px 4px; position:sticky;
  top:calc(var(--banner-h) + var(--header-h)); height:calc(100vh - var(--banner-h) - var(--header-h));
  overflow-y:auto;
}
.side-nav{display:flex;flex-direction:column;gap:4px;margin-bottom:14px}
.side-link{
  display:flex; align-items:center; padding:0 12px;
  height:40px; border-radius:var(--r-sm);
  color:var(--text-2); text-decoration:none;
  font-size:13.5px; font-weight:700; letter-spacing:.01em;
  border:1px solid var(--border); background:var(--surface);
  cursor:pointer; width:100%; text-align:left; line-height:1;
  box-shadow:var(--shadow-sm);
  transition:background .12s, border-color .12s, color .12s;
}
.side-link:hover{background:var(--accent-light); border-color:var(--accent-mid); color:var(--accent-2)}
.side-link.active{background:var(--accent-light); border-color:var(--accent); color:var(--accent-2); font-weight:800}
.side-section-title{
  font-size:10.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase;
  letter-spacing:.08em; padding:2px 10px 8px; margin-bottom:2px;
}
.side-demo-note{
  font-size:10.5px; color:var(--text-muted); padding:10px 10px 4px;
  opacity:.7; margin-top:auto; letter-spacing:.01em;
}
@media (max-width:900px){
  .sidebar{
    position:fixed; left:0; top:0; bottom:0; z-index:400; background:var(--surface);
    box-shadow:var(--shadow-lg); transform:translateX(-105%); transition:transform .2s ease;
    padding-top:calc(var(--banner-h) + var(--header-h) + 14px); width:240px; height:100vh;
  }
  .sidebar.open{transform:translateX(0)}
  /* opacity + visibility rather than display, so the scrim can fade with the drawer */
  .sidebar-backdrop{
    display:block; position:fixed; inset:0; background:rgba(10,12,20,.45); z-index:390;
    opacity:0; visibility:hidden; pointer-events:none;
    transition:opacity .18s ease, visibility 0s linear .18s;
  }
  .sidebar-backdrop.open{opacity:1; visibility:visible; pointer-events:auto; transition:opacity .18s ease, visibility 0s}
}

.main{
  flex:1; min-width:0; padding:16px 0 40px;
  display:flex; flex-direction:column; gap:14px;
}

/* ═══════════════ CARDS / LAYOUT ═══════════════ */
.card{
  background:var(--surface); border:1px solid var(--border); border-radius:var(--r);
  box-shadow:var(--shadow-sm); padding:18px;
}
.two-col{
  display:grid;
  grid-template-columns: minmax(480px,1.15fr) minmax(440px,1fr);
  gap:20px; align-items:start;
}
@media (max-width:1100px){ .two-col{grid-template-columns:1fr} }

.card-head{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px}
.card-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em}
.card-title .count-pill{background:var(--accent);color:#fff;border-radius:var(--pill-r);padding:1px 8px;font-size:11px;font-weight:700}

/* ═══════════════ BUTTONS ═══════════════ */
.btn{
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  border-radius:var(--r-sm); border:1px solid transparent; padding:10px 16px;
  font-size:13.5px; font-weight:700; cursor:pointer; white-space:nowrap; min-height:var(--control-h);
  transition:filter .12s,background .12s;
}
/* display:inline-flex above outranks the browser's own [hidden] rule, so a
   button marked hidden kept its space. Quick Add relies on it for the
   Parse / Analyze swap and for the upload-only Back control. */
.btn[hidden]{display:none}
.btn:active{filter:brightness(.95)}
.btn-primary{background:var(--accent); color:#fff}
.btn-primary:hover{background:var(--accent-2)}
.btn-outline{background:var(--surface); color:var(--accent); border-color:var(--accent-mid)}
.btn-outline:hover{background:var(--accent-light)}
.btn-ghost{background:var(--surface2); color:var(--text-2); border-color:var(--border)}
.btn-ghost:hover{background:var(--surface3)}
.btn-danger{background:var(--red-light); color:var(--red); border-color:var(--red-mid)}
.btn-danger:hover{background:var(--red-mid)}
.btn-wa{background:var(--wa); color:#fff}
.btn-wa:hover{background:var(--wa-hover)}
.btn-save{background:var(--green-2); color:#fff}
.btn-save:hover{background:var(--green)}
.btn-sm{padding:7px 12px;font-size:12.5px;min-height:36px}
.btn-block{width:100%}
.btn[disabled]{opacity:.45;cursor:not-allowed}

/* ═══════════════ FORM FIELDS ═══════════════ */
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:12px;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.04em}
.field label .hint{font-weight:500;text-transform:none;letter-spacing:0;color:var(--text-muted);opacity:.8}
.field input,.field select,.field textarea{
  border:1.5px solid var(--border); border-radius:var(--r-xs); background:var(--surface);
  padding:10px 11px; font-size:14.5px; color:var(--text); font-family:inherit; width:100%;
  transition:border-color .12s,box-shadow .12s;
}
.field input:focus,.field select:focus,.field textarea:focus{
  outline:none; border-color:var(--border-focus); box-shadow:0 0 0 3px var(--accent-light);
}
/* Native selects render ~2px taller than inputs at identical padding, which left
   every Material / Size Type control sitting proud of the fields beside it.
   Pin both to the shared control height; textarea keeps growing with its rows. */
.field input,.field select{min-height:var(--control-h)}
.field select{height:var(--control-h)}
.field input.hl{background:#fffef2; font-weight:700; color:var(--accent-2)}
.field input[readonly]{background:var(--surface2); color:var(--accent); font-weight:700}
/* v2.22.3 — Stage 7B-15: taller tap targets + more breathing room on touch devices */
@media (hover:none) and (pointer:coarse){
  .field{gap:7px}
  .field input,.field select,.field textarea{padding:12px 11px; min-height:46px}
  .field-grid{gap:16px}
}

/* Customer autocomplete */
.ac-dropdown{
  display:none; position:absolute; top:100%; left:0; right:0; margin-top:4px; z-index:60;
  background:var(--surface); border:1px solid var(--border); border-radius:var(--r-xs);
  box-shadow:var(--shadow); max-height:220px; overflow-y:auto;
}
.ac-dropdown.open{display:block}
.ac-item{padding:9px 12px; cursor:pointer; border-bottom:1px solid var(--border)}
.ac-item:last-child{border-bottom:none}
.ac-item .ac-name{font-size:13px; font-weight:700; color:var(--text)}
.ac-item .ac-meta{font-size:11px; color:var(--text-muted); font-weight:600; margin-top:1px}
.ac-item:hover, .ac-item.hl{background:var(--accent-light)}
.ac-empty{padding:9px 12px; font-size:12px; color:var(--text-muted)}
.field-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:12px}
.field-grid .full{grid-column:1/-1}
@media (max-width:640px){ .field-grid{grid-template-columns:repeat(2,1fr)} }
@media (max-width:420px){ .field-grid{grid-template-columns:1fr} }

.group-label{
  font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--accent-2);
  grid-column:1/-1; padding-top:6px; margin-top:2px; display:flex; align-items:center; gap:6px;
}.group-label:first-child{padding-top:0;margin-top:0}
.group-label::after{content:'';flex:1;height:1px;background:var(--border)}

/* ═══ FINISH SELECTOR ═══ */
/* ensure .full inside item-form spans all columns */
.item-form.active .field.full{grid-column:1/-1}

.finish-pills{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:8px;
  width:100%;
}
@media (max-width:540px){ .finish-pills{grid-template-columns:repeat(2,1fr)} }

.finish-pill{
  min-height:48px;
  min-width:0;
  border:2.5px solid var(--border);
  border-radius:var(--r-sm);
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  position:relative;
  background:var(--surface);
  transition:border-color .12s, background .12s, box-shadow .12s;
  width:100%;
  box-sizing:border-box;
}
.finish-pill input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.finish-pill .fp-code{
  font-size:14px;font-weight:800;
  color:var(--text-muted);
  user-select:none;
  line-height:1;
  text-align:center;
}
.finish-pill:hover:not(.pill-disabled){border-color:var(--accent-mid)}

/* Selected states */
.finish-pill.selected-NA{border-color:var(--text-2);background:var(--surface2);box-shadow:0 0 0 3px var(--border)}
.finish-pill.selected-NA .fp-code{color:var(--text-2)}

.finish-pill.selected-PL{border-color:var(--accent);background:var(--accent-light);box-shadow:0 0 0 3px var(--accent-mid)}
.finish-pill.selected-PL .fp-code{color:var(--accent-2)}

.finish-pill.selected-ZP{border-color:#0891b2;background:#ecfeff;box-shadow:0 0 0 3px #bae6fd}
.finish-pill.selected-ZP .fp-code{color:#0e7490}

.finish-pill.selected-HDG{border-color:var(--green-2);background:var(--green-light);box-shadow:0 0 0 3px #bbf7d0}
.finish-pill.selected-HDG .fp-code{color:var(--green)}

/* SS304/SS316: hide non-applicable pills, N/A goes full width */
.finish-pill.pill-ss-hide{display:none!important}
.finish-pills.ss-mode{grid-template-columns:1fr}
.finish-pill.pill-disabled{opacity:.3;cursor:not-allowed;pointer-events:none}


/* Product type picker */
.type-picker{display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:14px}
@media (max-width:700px){ .type-picker{grid-template-columns:repeat(3,1fr)} }
@media (max-width:420px){ .type-picker{grid-template-columns:repeat(2,1fr)} }
.type-btn{
  border:2px solid var(--border); background:var(--surface2); border-radius:var(--r-sm);
  min-height:44px; padding:8px 4px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:border-color .1s, background .1s;
}
.type-btn .t-name{font-size:12.5px;font-weight:700;color:var(--text-2);user-select:none;text-align:center;line-height:1.2}
.type-btn.active{border-color:var(--accent); background:var(--accent-light)}
.type-btn.active .t-name{color:var(--accent-2)}
.type-btn:hover:not(.active){border-color:var(--border-focus)}

.item-form{display:none}
.item-form.active{display:grid; grid-template-columns:repeat(3,1fr); gap:12px}
@media (max-width:640px){ .item-form.active{grid-template-columns:repeat(2,1fr)} }
@media (max-width:420px){ .item-form.active{grid-template-columns:1fr} }

/* Others / Special Bolt — Weight Mode sits on one row with whichever inputs that
   mode uses: Unit Weight for "Manual Weight", Diameter + Length for
   "Diameter x Length". Its own 3-column grid so the row survives the form's
   2-column breakpoint at 640px and only stacks below 768px. */
.item-form.active .others-weight-row{
  grid-column:1/-1; display:grid; grid-template-columns:repeat(3,1fr);
  gap:12px; align-items:end; min-width:0;
}
.others-weight-row>.field{min-width:0}
.others-weight-row>.field>select,.others-weight-row>.field>input{width:100%; min-width:0}
@media (max-width:767px){
  .item-form.active .others-weight-row{grid-template-columns:1fr}
  .others-weight-row>.field>select,.others-weight-row>.field>input{min-height:48px}
}

/* Custom Dimensions — a manual annotation layer, never a calculator input.
   Two text columns and a remove button; the block only grows once a dimension
   exists, so the normal entry form does not get visually heavier. */
.cdim-adv{margin-top:16px}
.cdim-adv .group-label{margin-bottom:8px}
.cdim-box{margin-top:0}
.cdim-panel{margin-top:9px}
.cdim-head{display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap}
.cdim-title{font-size:11px; font-weight:800; color:var(--text-2); text-transform:uppercase; letter-spacing:.04em}
.cdim-add{
  background:var(--surface); border:1.5px solid var(--border); border-radius:var(--r-xs);
  color:var(--accent-2); font-size:12.5px; font-weight:700; padding:7px 11px; cursor:pointer;
}
.cdim-add:hover{border-color:var(--accent)}
.cdim-rows{display:flex; flex-direction:column; gap:8px}
.cdim-rows:not(:empty){margin-top:10px}
.cdim-row{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) auto; gap:8px; align-items:center}
.cdim-row input{
  border:1.5px solid var(--border); border-radius:var(--r-xs); background:var(--surface);
  padding:9px 11px; font-size:14px; color:var(--text); font-family:inherit;
  width:100%; min-width:0; min-height:var(--control-h);
}
.cdim-row input:focus{outline:none; border-color:var(--border-focus); box-shadow:0 0 0 3px var(--accent-light)}
.cdim-del{
  min-width:38px; min-height:var(--control-h); border:1.5px solid var(--border);
  border-radius:var(--r-xs); background:var(--surface); color:var(--text-muted);
  font-size:14px; line-height:1; cursor:pointer;
}
.cdim-del:hover{border-color:var(--red); color:var(--red)}
.cdim-hint{margin-top:9px; font-size:11.5px; line-height:1.45; color:var(--text-muted)}
@media (max-width:560px){
  /* Two inputs side by side stop being readable on a phone, so the label takes
     its own line and a hairline keeps one dimension from running into the next. */
  .cdim-row{grid-template-columns:minmax(0,1fr) auto; gap:6px}
  .cdim-row .cdim-label-in{grid-column:1/-1}
  .cdim-row+.cdim-row{border-top:1px dashed var(--border); padding-top:9px}
}
@media (hover:none) and (pointer:coarse){
  .cdim-row input,.cdim-del{min-height:46px}
}

/* Calc preview */
.calc-preview{
  display:grid; grid-template-columns:1fr 1fr 1fr 1.2fr; gap:10px; margin-top:16px;
  background:var(--surface2); border:1px solid var(--border); border-radius:var(--r-sm); padding:12px;
}
@media (max-width:560px){ .calc-preview{grid-template-columns:1fr 1fr; }
  .calc-preview .cp-acc,.calc-preview .cp-final{grid-column:1/-1} }
.cp-item label{display:block; font-size:11px; font-weight:800; color:var(--text-2); text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px}
.cp-item span{font-size:15px; font-weight:700; color:var(--text-2)}
.cp-acc span{color:var(--accent-2)}
.cp-final span{font-size:20px; font-weight:800; color:var(--green)}
.calc-preview.flash{animation:flashbg .5s ease}
@keyframes flashbg{0%{background:var(--green-light)}100%{background:var(--surface2)}}

.entry-actions{display:flex; gap:8px; margin-top:14px; flex-wrap:wrap}
.entry-actions .btn{flex:1; min-width:150px}

/* Warning note */
.warn-note{
  background:var(--red-light); border:1px solid var(--red-mid); color:var(--red);
  border-radius:var(--r-xs); padding:8px 11px; font-size:12px; font-weight:600; margin-top:10px;
}

/* Quotation info compact bar */
.qi-compact{
  display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer;
}
.qi-compact-main{min-width:0;flex:1}
.qi-compact-main .nm{font-size:14px; font-weight:800; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.qi-compact-main .meta{font-size:11px; color:var(--text-muted); font-weight:600; margin-top:2px}
.qi-action-stack{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.qi-edit{display:none; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px}
.qi-edit.open{display:grid}
@media (max-width:560px){ .qi-edit{grid-template-columns:1fr} }
.qi-edit .full{grid-column:1/-1}
.locked-notice{
  display:none; margin-top:12px; background:var(--amber-light); border:1px solid var(--amber-mid);
  border-radius:var(--r-sm); padding:12px; color:var(--text-2);
}
.locked-notice.show{display:flex; align-items:center; justify-content:space-between; gap:12px}
.locked-notice-title{font-size:13px;font-weight:800;color:var(--amber)}
.locked-notice-text{font-size:12px;font-weight:600;color:var(--text-2);margin-top:2px;line-height:1.35}
.btn-unlock-primary{
  background:#d97706; color:#fff; border-color:#b45309; box-shadow:0 1px 2px rgba(146,64,14,.16);
}
.btn-unlock-primary:hover{background:#b45309}
@media (max-width:640px){
  .qi-compact{display:block}
  .qi-compact-main .nm::before{content:'Customer';display:block;font-size:10.5px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
  .qi-compact-main .meta{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
  .quote-status-row::before{content:'Status';display:block;width:100%;font-size:10.5px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
  .qi-action-stack{margin-top:12px;display:flex;flex-direction:column;align-items:stretch}
  .qi-action-stack .btn{width:100%;justify-content:center}
  .locked-notice.show{display:block}
  .locked-notice .btn{width:100%;margin-top:10px}
}

/* Quote table */
/* ── Quotation item cards (replaces table) ── */
.qi-list{display:flex;flex-direction:column;gap:10px}
.qi-item{
  border:1px solid var(--border); border-radius:var(--r-sm);
  background:var(--surface); padding:12px 14px;
  animation-fill-mode:both;
}
.qi-item.row-new{animation:rowflash 1s ease}
.qi-item.editing{
  border-color:var(--accent); background:var(--accent-light);
  box-shadow:0 0 0 2px rgba(37,71,208,.08);
}
@keyframes rowflash{0%{background:var(--green-light)}100%{background:var(--surface)}}
.qi-item-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.qi-item-left{display:flex;align-items:flex-start;gap:10px;min-width:0;flex:1}
.qi-num{
  min-width:24px;height:24px;background:var(--surface2);border:1px solid var(--border);
  border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:800;color:var(--text-muted);flex-shrink:0;margin-top:1px;
}
.qi-body{min-width:0;flex:1}
.qi-desc{font-size:14px;font-weight:800;color:var(--text)}
.qi-dim{
  font-family:'SFMono-Regular',Consolas,monospace;font-size:13px;
  color:var(--accent-2);margin-top:4px;word-break:break-word;line-height:1.4;
}
.qi-cdim{display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px;word-break:break-word}
.qi-item-bottom{
  display:flex;align-items:center;justify-content:space-between;
  gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);
  flex-wrap:wrap;
}
.qi-meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.qi-meta-pill{font-size:13px;color:var(--text-2);font-weight:600}
.qi-meta-pill strong{color:var(--text)}
.qi-price-group{display:flex;align-items:baseline;gap:8px}
.qi-unit{font-size:13px;color:var(--text-muted);font-weight:600}
.qi-total{font-size:18px;font-weight:800;color:var(--green)}
.qi-markup{
  display:inline-flex;align-items:center;gap:3px;
  font-size:11.5px;font-weight:900;color:#92400e;
  background:#fff7d6;border:1px solid #d97706;
  border-radius:var(--pill-r);padding:2px 8px;line-height:1.2;
}
.quote-status-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}
.quote-status-badge{
  display:inline-flex;align-items:center;gap:5px;border-radius:var(--pill-r);padding:4px 9px;
  font-size:11px;font-weight:800;border:1px solid var(--border);background:var(--surface2);color:var(--text-2);
}
.quote-status-badge.draft{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
.quote-status-badge.locked{background:#f1f5f9;color:#475569;border-color:#cbd5e1}
.quote-status-badge.editing{background:#fff7ed;color:#c2410c;border-color:#fed7aa}
.quote-status-badge.dirty{background:#fef2f2;color:#b91c1c;border-color:#fecaca}
.quote-status-badge.updated{background:#ecfdf5;color:#047857;border-color:#a7f3d0}
.locked-note{font-size:11px;color:var(--text-muted);font-weight:700}
#sagrod-markup,#stud-markup,#anchorbolt-markup,#ubolt-markup,#squbolt-markup,#lbolt-markup,#lbolt45-markup,#jbolt-markup,#dp-markup{
  background:#fff7d6!important;border-color:#d97706!important;color:#92400e!important;font-weight:800;
}
#sagrod-markup:focus,#stud-markup:focus,#anchorbolt-markup:focus,#ubolt-markup:focus,#squbolt-markup:focus,#lbolt-markup:focus,#lbolt45-markup:focus,#jbolt-markup:focus,#dp-markup:focus{
  border-color:#b45309!important;box-shadow:0 0 0 3px rgba(217,119,6,.16)!important;
}
.qi-del{
  background:none;border:none;cursor:pointer;color:var(--text-muted);
  font-size:17px;font-weight:700;line-height:1;padding:3px 5px;border-radius:var(--r-xs);flex-shrink:0;
}
.qi-del:hover{color:var(--red);background:var(--red-light)}
.qi-card-actions{display:flex;gap:6px;align-items:center;flex-shrink:0}
.qi-edit-btn{
  background:var(--surface);border:1px solid var(--accent-mid);color:var(--accent);
  border-radius:var(--r-xs);cursor:pointer;font-size:12px;font-weight:800;line-height:1;padding:7px 10px;
}
.qi-edit-btn:hover{background:var(--accent-light)}
.qi-edit-mode-note{
  display:none;margin-top:6px;color:var(--accent-2);font-size:12px;font-weight:800;
}
.qi-edit-mode-note.show{display:block}
.finish-chip{display:inline-block; font-size:10.5px; font-weight:800; border-radius:var(--pill-r); padding:2px 8px}
.chip-PL{background:var(--accent-light); color:var(--accent-2)}
.chip-ZP{background:#ecfeff; color:#0e7490}
.chip-HDG{background:var(--green-light); color:var(--green)}

.review-list-panel{
  background:var(--surface2); border:1px solid var(--border);
  border-radius:var(--r-sm); padding:12px; margin-top:10px;
}
.review-list-panel.locked{
  background:#eef0f4; border-color:#d7dce3;
}
.review-list-panel.locked .qi-item{
  background:#f1f3f6; border-color:#d7dce3; color:var(--text-2);
}
.review-list-panel.locked .qi-desc,
.review-list-panel.locked .qi-dim,
.review-list-panel.locked .qi-meta-pill,
.review-list-panel.locked .qi-unit{color:var(--text-muted)}
.review-list-panel.locked .qi-total{color:#64748b}
.review-list-panel.locked .qi-markup{
  background:#fef3c7;border-color:#d97706;color:#92400e;
}
.review-lock-label{
  display:none; margin-bottom:10px; width:max-content; max-width:100%;
  border:1px solid #cbd5e1; background:#e2e8f0; color:#475569;
  border-radius:var(--pill-r); padding:4px 9px; font-size:11px; font-weight:800;
}
.review-lock-label.show{display:inline-flex}
.review-action-panel{
  background:var(--surface3); border:1px solid var(--border);
  border-radius:var(--r-sm); padding:12px; margin-top:14px;
}
.empty-state{padding:34px 16px; text-align:center; color:var(--text-muted)}
.empty-state .icon{font-size:30px; margin-bottom:8px; opacity:.6}
.empty-state p{font-weight:700; font-size:13px; color:var(--text-2)}
.empty-state small{font-size:11.5px}

.quote-total-bar{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding-bottom:12px; margin-bottom:12px; border-bottom:1px dashed var(--border); flex-wrap:wrap;
}
.qt-label{font-size:12px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.05em}
.qt-amt{font-size:23px; font-weight:800; color:var(--green)}
.quote-actions{display:flex; gap:8px; flex-wrap:wrap}

/* Sticky mobile bar */
.mobile-bar{
  display:none; position:fixed; left:0; right:0; bottom:0; z-index:260;
  background:var(--surface); border-top:1px solid var(--border); box-shadow:0 -4px 16px rgba(0,0,0,.08);
  padding:10px 14px; align-items:center; justify-content:space-between; gap:10px;
}
.mobile-bar .mb-total{display:flex; flex-direction:column}
.mobile-bar .mb-total label{font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase}
.mobile-bar .mb-total span{font-size:17px; font-weight:800; color:var(--green)}
@media (max-width:900px){ .mobile-bar{display:flex} .main{padding-bottom:120px} }

/* ═══════════════ MODALS ═══════════════ */
.modal-overlay{
  display:none; position:fixed; inset:0; background:rgba(10,12,20,.5); z-index:500;
  align-items:flex-start; justify-content:center; padding:5vh 14px; overflow-y:auto;
}
.modal-overlay.open{display:flex}
.modal{
  background:var(--surface); border-radius:var(--r); box-shadow:var(--shadow-lg); width:100%; max-width:640px;
  padding:20px; margin-bottom:5vh;
}
.modal-title{display:flex; align-items:center; justify-content:space-between; font-size:15px; font-weight:800; margin-bottom:14px}
.modal-close{background:var(--surface2); border:none; width:30px; height:30px; border-radius:var(--r-sm); cursor:pointer; font-size:14px; color:var(--text-muted)}
.modal-grid{display:grid; grid-template-columns:1fr 1fr; gap:12px}
@media (max-width:480px){ .modal-grid{grid-template-columns:1fr} }
.modal-grid .full{grid-column:1/-1}
.modal-btns{display:flex; gap:8px; margin-top:16px; flex-wrap:wrap}
.modal-btns .btn{flex:1; min-width:130px}
.draft-recovery-copy{font-size:13px;line-height:1.55;color:var(--text-2)}
.draft-recovery-time{display:block;margin-top:8px;font-size:11.5px;color:var(--text-muted);font-weight:700}

/* Version Updates */
.version-updates-modal{max-width:760px;padding:0;overflow:hidden}
.version-updates-head{padding:18px 20px 14px;border-bottom:1px solid var(--border);margin:0}
.version-updates-list{display:grid;gap:10px;max-height:72vh;overflow-y:auto;padding:14px 20px 20px}
.version-card{border:1px solid var(--border);border-radius:var(--r-xs);background:var(--surface2);padding:13px 14px}
.version-card-title{font-size:14px;font-weight:800;color:var(--text);line-height:1.35;margin-bottom:9px}
.version-notes{display:grid;grid-template-columns:72px minmax(0,1fr);gap:6px 10px;font-size:12.5px;line-height:1.5}
.version-label{font-weight:800;color:var(--red)}
.version-copy{color:var(--text-2);min-width:0}
.version-copy span{display:block}
@media (max-width:520px){
  .version-updates-list{padding:12px;max-height:78vh}
  .version-updates-head{padding:14px 12px 12px}
  .version-card{padding:12px}
  .version-notes{grid-template-columns:1fr;gap:2px}
  .version-copy{margin-bottom:5px}
}

/* Reference modal tabs */
.ref-tabs{display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:10px}
.ref-tab{
  background:var(--surface2); border:1px solid var(--border); border-radius:var(--pill-r); padding:6px 12px;
  font-size:12px; font-weight:700; color:var(--text-2); cursor:pointer;
}
.ref-tab.active{background:var(--accent); border-color:var(--accent); color:#fff}
.ref-panel{display:none}
.ref-panel.active{display:block}
.ref-note{background:var(--surface2); border:1px solid var(--border); border-radius:var(--r-sm); padding:12px 14px; margin-bottom:10px}
.ref-note h4{font-size:12.5px; font-weight:800; margin-bottom:6px; color:var(--accent-2)}
.ref-note p{font-size:12.5px; margin-top:4px; line-height:1.55}
.ref-note .cn{color:var(--text-muted); font-size:11.5px}
.ref-mini{display:flex; gap:8px; flex-wrap:wrap; margin-top:8px}
.ref-mini span{background:var(--accent-light); color:var(--accent-2); font-weight:700; font-size:11.5px; padding:4px 9px; border-radius:var(--pill-r)}
.tip-list{list-style:none; display:grid; grid-template-columns:1fr 1fr; gap:8px}
@media (max-width:480px){ .tip-list{grid-template-columns:1fr} }
.tip-list li{display:flex; gap:8px; font-size:12px; background:var(--surface2); border-radius:var(--r-xs); padding:8px 10px; align-items:flex-start}

/* Price history */
.ph-list{display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto}
.ph-row{display:flex; justify-content:space-between; align-items:center; background:var(--surface2); border-radius:var(--r-xs); padding:9px 11px; font-size:12px}
.ph-row .ph-d{color:var(--text-muted); font-weight:600}
.ph-row .ph-p{font-weight:800; color:var(--accent-2)}

/* Toast */
.toast{
  position:fixed; left:50%; bottom:26px; transform:translateX(-50%) translateY(20px); z-index:600;
  background:var(--text); color:#fff; padding:11px 18px; border-radius:var(--pill-r); font-size:13px; font-weight:700;
  opacity:0; pointer-events:none; transition:opacity .2s,transform .2s; box-shadow:var(--shadow-lg); max-width:90vw; text-align:center;
}
.toast.show{opacity:1; transform:translateX(-50%) translateY(0)}
@media (max-width:900px){ .toast{bottom:96px} }

/* helper */
.pill-badge{background:var(--accent); color:#fff; border-radius:var(--pill-r); padding:1px 8px; font-size:11px; font-weight:700}

/* ═══════════════ WORKFLOW STEPPER ═══════════════ */
.stepper{
  display:flex; align-items:center; gap:0; background:var(--surface); border:1px solid var(--border);
  border-radius:var(--r); padding:12px 16px; box-shadow:var(--shadow-sm); overflow-x:auto;
}
.step-pill{
  display:flex; align-items:center; gap:8px; background:none; border:none; cursor:pointer;
  padding:6px 10px; border-radius:var(--pill-r); flex-shrink:0; font-family:inherit;
}
.step-pill .step-num{
  width:24px; height:24px; border-radius:50%; background:var(--surface3); color:var(--text-muted);
  display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; flex-shrink:0;
  border:2px solid var(--border);
}
.step-pill .step-label{font-size:12.5px; font-weight:700; color:var(--text-muted); white-space:normal; text-align:center; line-height:1.25}
.step-pill.current .step-num{background:var(--accent); border-color:var(--accent); color:#fff}
.step-pill.current .step-label{color:var(--accent-2)}
.step-pill.done .step-num{background:var(--green-2); border-color:var(--green-2); color:#fff}
.step-pill.done .step-num::before{content:'✓'}
.step-pill.done.current .step-num{background:var(--accent); border-color:var(--accent)}
.step-pill.done.current .step-num::before{content:''}
.step-pill.done .step-label{color:var(--green-2)}
.step-line{flex:1; height:2px; background:var(--border); min-width:16px; margin:0 2px}
@media (max-width:640px){ .step-pill .step-label{display:none} .stepper{justify-content:space-between; padding:10px 12px} .step-line{min-width:8px} }

.step-caption{font-size:10.5px; font-weight:800; color:var(--accent-2); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px}

/* ═══════════════ PRICE HISTORY MINI PANEL ═══════════════ */
.ph-mini{background:var(--surface2); border:1px solid var(--border); border-radius:var(--r-xs); padding:9px 10px; margin-top:9px; opacity:.92}
.ph-mini-head{display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap}
.ph-mini-head .ph-title{font-size:11.5px; font-weight:800; color:var(--text-2)}
.ph-mini-head .ph-title .ph-tag{font-weight:500; color:var(--text-muted); text-transform:none; letter-spacing:0; font-size:10.5px}
.ph-section{margin-top:7px}
.ph-section-title{font-size:10.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px}
.ph-stats{display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-top:7px}
@media (max-width:560px){ .ph-stats{grid-template-columns:repeat(2,1fr)} }
.ph-stat{background:var(--surface); border:1px solid var(--border); border-radius:var(--r-xs); padding:5px 6px; text-align:center}
.ph-stat label{display:block; font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em}
.ph-stat span{display:block; font-size:12.5px; font-weight:800; color:var(--text-2); margin-top:2px}
.ph-stat.hl span{color:var(--accent-2)}
.ph-empty-msg{font-size:11.5px; color:var(--text-muted); margin-top:8px}

/* ═══════════════ STRONG PRIMARY BUTTON ═══════════════ */
.btn-xl{
  padding:16px 20px; font-size:15px; font-weight:800; border-radius:var(--r-sm);
  min-height:48px; box-shadow:0 4px 14px rgba(37,71,208,.32); letter-spacing:.01em;
}
.btn-xl:hover{box-shadow:0 6px 18px rgba(37,71,208,.4)}

/* ═══════════════ DEFAULT PRICE SETTINGS ═══════════════ */
.dp-status{
  display:none; align-items:center; gap:6px; margin-top:8px;
  background:var(--green-light); border:1px solid var(--green-2); border-radius:var(--r-xs);
  padding:6px 10px; font-size:11.5px; font-weight:700; color:var(--green);
}
.dp-status.show{display:flex}
.dp-status .dp-edit{margin-left:auto; background:none; border:none; color:var(--green); cursor:pointer; font-size:11px; font-weight:700; text-decoration:underline; padding:0}

.dp-table-wrap{overflow-x:auto; border:1px solid var(--border); border-radius:var(--r-sm)}
table.dp-table{width:100%; border-collapse:collapse; min-width:560px; font-size:12.5px}
.dp-table th{background:var(--surface2); padding:8px 10px; text-align:left; font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); border-bottom:1px solid var(--border); white-space:nowrap}
.dp-table td{padding:8px 10px; border-bottom:1px solid var(--border); vertical-align:middle}
.dp-table tr:last-child td{border-bottom:none}
.dp-table tr:hover td{background:var(--surface2)}
.dp-badge{display:inline-block; padding:2px 8px; border-radius:var(--pill-r); font-size:10.5px; font-weight:700}
.dp-badge-on{background:var(--green-light); color:var(--green)}
.dp-badge-off{background:var(--surface3); color:var(--text-muted)}
.dp-badge-system{background:var(--accent-light); color:var(--accent)}
.dp-badge-custom{background:var(--amber-light); color:var(--amber)}
.dp-act{background:none; border:none; cursor:pointer; padding:3px 6px; border-radius:var(--r-xs); font-size:12px}
.dp-act:hover{background:var(--surface3)}
.dp-search-bar{display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap}
.dp-search-bar input, .dp-search-bar select{
  border:1.5px solid var(--border); border-radius:var(--r-xs); padding:7px 10px;
  font-size:13px; background:var(--surface); color:var(--text); font-family:inherit;
}
.dp-search-bar input{flex:1; min-width:160px}
.dp-search-bar input:focus,.dp-search-bar select:focus{outline:none; border-color:var(--border-focus)}
.settings-filter-grid{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:8px;margin-bottom:10px}
.settings-filter-grid .field{margin:0}
.settings-filter-grid .field label{font-size:10.5px}
.settings-mode-row{display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:10px}
.settings-mode-buttons{display:flex;gap:6px;flex-wrap:wrap}
.settings-mode-btn{border:1px solid var(--border);background:var(--surface);color:var(--text-2);border-radius:var(--pill-r);padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer}
.settings-mode-btn.active{border-color:var(--accent);background:var(--accent-light);color:var(--accent)}
.settings-count-text{font-size:11.5px;color:var(--text-muted);font-weight:700}
@media(max-width:560px){.settings-filter-grid{grid-template-columns:1fr}.settings-mode-row{align-items:stretch}.settings-count-text{width:100%}.settings-mode-buttons{width:100%}.settings-mode-btn{flex:1}}
.dp-empty{text-align:center; padding:28px; color:var(--text-muted); font-size:13px}

.dp-form-grid{display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px}
@media (max-width:560px){.dp-form-grid{grid-template-columns:1fr 1fr}}
.dp-form-grid .full{grid-column:1/-1}
.dp-section-label{font-size:10.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; padding-top:4px; grid-column:1/-1; border-top:1px solid var(--border); margin-top:4px}
.dp-section-label:first-child{border-top:none; margin-top:0}

/* ═══════════════ BILINGUAL HELPERS ═══════════════ */
.zh{
  display:block; font-size:11.5px; font-weight:600;
  color:var(--text-muted); line-height:1.2; margin-top:2px; letter-spacing:.01em;
}
.step-label .zh{font-size:10.5px; font-weight:600; color:inherit; opacity:.8; margin-top:1px}
/* Sidebar two-line button */
.side-link-inner{display:flex;flex-direction:column;line-height:1.25}
.side-link-inner .zh{margin-top:1px;font-size:11px;font-weight:600;color:var(--text-muted)}
.side-link:hover .side-link-inner .zh,.side-link.active .side-link-inner .zh{color:var(--accent-2)}
/* Step caption sub */
.step-caption-sub{display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-top:1px;text-transform:none;letter-spacing:0}
/* Bilingual button — stack on narrow */
.btn-bi{flex-direction:column;gap:1px;line-height:1.2}
.btn-bi .zh{font-size:11px;margin-top:0;color:inherit;opacity:.85}
/* group-label bilingual */
.gl-zh{font-size:10.5px;font-weight:600;color:var(--accent-2);opacity:.75;margin-left:4px;font-style:normal;text-transform:none;letter-spacing:0}

/* ═══════════════ QUICK ADD ═══════════════ */

/* ═══════════════ DIAMETER SETTINGS ═══════════════ */
.ds-form-grid{display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px}
@media (max-width:560px){.ds-form-grid{grid-template-columns:1fr 1fr}}
.ds-form-grid .full{grid-column:1/-1}

/* ── Accessories ── */
.acc-toggle-btn{
  display:flex;align-items:center;gap:8px;background:var(--surface2);
  border:1.5px dashed var(--border);border-radius:var(--r-xs);
  padding:8px 12px;font-size:12.5px;font-weight:800;color:var(--text-muted);
  cursor:pointer;width:100%;text-align:left;margin-top:2px;
  transition:border-color .12s,color .12s,background .12s;
}
.acc-toggle-btn:hover{border-color:var(--accent-mid);color:var(--accent-2);background:var(--accent-light)}
.acc-toggle-btn.open{border-style:solid;border-color:var(--accent-mid);color:var(--accent-2);background:var(--accent-light)}
.acc-toggle-btn .acc-arrow{transition:transform .15s;font-style:normal;font-size:11px}
.acc-toggle-btn.open .acc-arrow{transform:rotate(90deg)}
.acc-toggle-text{display:flex;flex-direction:column;gap:1px;line-height:1.15}
.acc-toggle-sub{font-size:11px;font-weight:600;color:inherit;opacity:.72}
.acc-panel{
  display:none;grid-template-columns:1fr;gap:12px;border:1.5px solid var(--accent-mid);
  border-radius:var(--r-xs);padding:14px;background:var(--surface);grid-column:1/-1
}
.acc-panel.open{display:grid}
.acc-panel-title{font-size:13.5px;font-weight:900;color:var(--accent-2);padding-bottom:2px}

/* Each accessory row: checkbox+name on top, 3 fields below */
.acc-item{
  border:1px solid var(--border);border-radius:var(--r-xs);padding:12px;
  background:var(--surface);transition:opacity .12s,background .12s,border-color .12s
}
.acc-item.is-disabled{opacity:.58;background:var(--surface2);border-color:var(--border)}
.acc-item:last-child{margin-bottom:0}
.acc-item-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
.acc-item-head input[type=checkbox]{width:16px;height:16px;cursor:pointer;accent-color:var(--accent);flex-shrink:0}
.acc-item-title{font-size:14px;font-weight:900;color:var(--text-2)}
.acc-enable{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;color:var(--text-muted);cursor:pointer}
.acc-item-fields{display:grid;grid-template-columns:.75fr 1fr 1.15fr;gap:8px;align-items:end}
.acc-item-fields.acc-custom{grid-template-columns:1.4fr 1fr}
.acc-item-fields .acc-field{}
.acc-item-fields .acc-field-label{display:block;font-size:10.5px;font-weight:700;color:var(--text-muted);
  text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
/* Quick Add's accessory editor is the same control set, so it shares this rule
   instead of restating it — one place to change accessory field styling. */
.acc-item-fields input[type=number],.acc-item-fields input[type=text],.acc-item-fields select,
.wqa-acc-f input[type=number],.wqa-acc-f input[type=text],.wqa-acc-f select{
  width:100%;border:1.5px solid var(--border);border-radius:var(--r-xs);
  padding:7px 9px;font-size:13.5px;background:var(--surface);color:var(--text)}
.acc-item-fields input:focus,.acc-item-fields select:focus,
.wqa-acc-f input:focus,.wqa-acc-f select:focus{outline:none;border-color:var(--border-focus)}
.acc-item-fields input:disabled,.acc-item-fields select:disabled,
.wqa-acc-f input:disabled,.wqa-acc-f select:disabled{opacity:.38;pointer-events:none}
.acc-divider{display:none}

@media (max-width:480px){
  .acc-item-head{align-items:flex-start;flex-direction:column}
  .acc-item-fields,.acc-item-fields.acc-custom{grid-template-columns:1fr 1fr}
  .acc-item-fields .acc-field:last-child{grid-column:1/-1}
}

@media print{
  @page{size:A4;margin:12mm}
  html,body{width:auto!important;min-height:0!important;background:#fff!important;color:#111!important}
  body>*:not(#printSummary){display:none!important}
  #printSummary{
    display:block!important;width:100%!important;margin:0!important;padding:0!important;
    border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important;
    color:#111!important;font-family:Arial,sans-serif!important;font-size:10pt!important;
  }
  .print-issuer{padding-bottom:8mm;border-bottom:1px solid #bbb;text-align:center}
  .print-issuer[hidden]{display:none!important}
  .print-issuer-name{font-size:16pt;font-weight:800;letter-spacing:.02em;margin-bottom:2mm}
  .print-issuer-line{font-size:9pt;line-height:1.45}
  .print-title{font-size:18pt;font-weight:800;letter-spacing:.08em;text-align:center;margin:8mm 0 6mm}
  .print-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm 8mm;margin-bottom:7mm}
  .print-meta-item{display:grid;grid-template-columns:30mm 1fr;gap:2mm;border-bottom:1px solid #ddd;padding:1.5mm 0}
  .print-meta-label{font-size:8.5pt;color:#555;font-weight:700}
  .print-meta-value{font-size:9.5pt;font-weight:700;overflow-wrap:anywhere}
  .print-items-table{width:100%;border-collapse:collapse;table-layout:fixed}
  .print-items-table th,.print-items-table td{border:1px solid #bbb;padding:2.2mm 2mm;vertical-align:top}
  .print-items-table th{background:#eee!important;color:#111!important;font-size:8.5pt;text-align:left;font-weight:800}
  .print-items-table td{font-size:8.8pt;line-height:1.35}
  .print-items-table .print-col-no{width:8mm;text-align:center}
  .print-items-table .print-col-desc{width:43mm}
  .print-items-table .print-col-qty{width:14mm;text-align:center}
  .print-items-table .print-col-money{width:25mm;text-align:right;white-space:nowrap}
  .print-item-size{white-space:pre-line;overflow-wrap:anywhere}
  .print-items-table tbody tr{break-inside:avoid;page-break-inside:avoid}
  .print-items-table tfoot td{font-size:10pt;font-weight:800;background:#f5f5f5!important}
  .print-grand-label{text-align:right}
  .print-remarks{margin-top:5mm;padding:3mm;border:1px solid #ccc;font-size:9pt;line-height:1.4;white-space:pre-line}
  .print-remarks[hidden]{display:none!important}
  .print-footer-note{margin-top:8mm;padding-top:4mm;border-top:1px solid #ccc;text-align:center;font-size:8.5pt;color:#555}
}

/* ═══════════════ STAGE 6A — UI POLISH v2.17.3 ═══════════════ */

/* Placeholder text: lighter, less distracting, consistent light/dark */
::placeholder{color:#9ca3af;opacity:.75}

/* Long material names / labels must never break layout */
.item-form.active{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:640px){ .item-form.active{grid-template-columns:repeat(2,minmax(0,1fr))} }
@media (max-width:420px){ .item-form.active{grid-template-columns:minmax(0,1fr)} }
.field select,.field input{min-width:0}
.t-name{overflow-wrap:break-word;word-break:break-word;hyphens:auto}
.qi-desc,.qi-dim{overflow-wrap:break-word;word-break:break-word}
.card-title,.step-label,.side-link-inner,.zh{overflow-wrap:break-word}

/* Type picker: slightly airier tap targets, clearer active state */
.type-btn{min-height:48px}
.type-btn.active{box-shadow:0 0 0 3px var(--accent-mid)}

/* Calc preview: Final Unit Price stands out as a highlighted total */
.calc-preview .cp-final{
  background:var(--green-light); border:1px solid var(--green-2);
  border-radius:var(--r-xs); padding:8px 10px; margin:-2px;
}
.calc-preview .cp-final label{color:var(--green-2)}

/* Primary action button: obvious + tactile */
.btn-primary.btn-xl{position:relative; transition:filter .12s,background .12s,transform .1s,box-shadow .12s}
.btn-primary.btn-xl:hover{transform:translateY(-1px)}
.btn-primary.btn-xl:active{transform:translateY(0)}

/* Status badges: small leading dot for faster scanning */
.quote-status-badge{position:relative; padding-left:16px}
.quote-status-badge::before{
  content:''; position:absolute; left:8px; top:50%; transform:translateY(-50%);
  width:6px; height:6px; border-radius:50%; background:currentColor; opacity:.8;
}

/* Quotation list card action row: never overlap, wraps cleanly on narrow screens */
.qi-card-actions{flex-wrap:wrap; justify-content:flex-end}
@media (max-width:480px){
  .qi-item-top{flex-wrap:wrap}
  .qi-card-actions{width:100%; justify-content:flex-start; margin-top:6px}
}

/* Accessories rows: consistent alignment on very narrow screens */
@media (max-width:480px){
  .acc-item-fields .acc-field{min-width:0}
}

/* ═══════════════ STAGE 6A-2 — UI POLISH v2.17.4 ═══════════════ */

/* ── 1. Customer bar ── */
.qi-compact-main .nm{font-size:16px;letter-spacing:-.01em;font-weight:900}
/* Meta row: horizontal chip layout */
.qi-compact-main .meta{
  display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:5px;
  font-size:11.5px;color:var(--text-muted);font-weight:700;
}
/* Status row: slightly bigger badges */
.quote-status-badge{font-size:11.5px;padding:5px 11px;font-weight:900;letter-spacing:.01em;padding-left:20px}
.quote-status-badge::before{left:10px;width:7px;height:7px}
/* Locked notice: amber left accent bar */
.locked-notice.show{border-left:4px solid var(--amber)}
/* Edit details / Unlock buttons on customer bar */
.qi-action-stack .btn{font-size:12px}

/* ── 2. Step card headings ── */
.card-head{margin-bottom:16px}
.card-title{font-size:14px;font-weight:900;letter-spacing:.04em}
.step-caption{font-size:10.5px;font-weight:900;letter-spacing:.09em;margin-bottom:1px}
.step-caption-sub{font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px}

/* ── 3. Group labels: stronger visual section dividers ── */
.group-label{
  font-size:10.5px;font-weight:900;letter-spacing:.1em;
  padding-top:16px;margin-top:8px;padding-bottom:3px;color:var(--accent-2);
}
.group-label:first-child{padding-top:4px;margin-top:0}
.group-label.full{grid-column:1/-1}

/* ── 4. Item form: breathe between fields ── */
.item-form.active{gap:14px 12px}
/* Field labels slightly larger / cleaner */
.field label{font-size:11.5px;letter-spacing:.05em;font-weight:900}

/* ── 5. Type picker: modern pill-style buttons ── */
.type-picker{gap:6px;margin-bottom:16px}
.type-btn{
  min-height:54px;border-radius:var(--r-sm);padding:10px 6px;
  border-width:1.5px;
  transition:border-color .12s,background .12s,box-shadow .12s,transform .1s;
  flex-direction:column;gap:3px;
}
.type-btn .t-name{font-size:13px;font-weight:800;line-height:1.25;letter-spacing:.01em}
.type-btn.active{
  border-width:2px;border-color:var(--accent);
  background:var(--accent-light);
  box-shadow:0 0 0 3px var(--accent-mid);
}
.type-btn.active .t-name{color:var(--accent-2);font-weight:900}
.type-btn:hover:not(.active){
  background:var(--surface);border-color:var(--border-focus);
}
@media (max-width:700px){.type-picker{grid-template-columns:repeat(3,1fr)}}
@media (max-width:500px){.type-picker{grid-template-columns:repeat(2,1fr);gap:6px}}

/* ── 6. Finish pills: slightly taller on desktop ── */
.finish-pill{min-height:50px}

/* ── 7. Accessories: cleaner collapsed / expanded ── */
.acc-toggle-btn{padding:10px 14px;border-radius:var(--r-sm);font-size:13px}
.acc-item{padding:12px 14px;border-radius:var(--r-sm)}
.acc-item-head{margin-bottom:10px}
.acc-item-title{font-size:14px;font-weight:900}
.acc-item-fields input,.acc-item-fields select{padding:8px 10px;font-size:14px}
.acc-panel{gap:10px;padding:16px;border-radius:var(--r-sm)}
.acc-panel-title{font-size:14px;font-weight:900;margin-bottom:2px}

/* ── 8. Calc preview: polished 2-tier layout ── */
.calc-preview{
  padding:14px 16px;gap:12px;
  border:1px solid var(--border);
  box-shadow:var(--shadow-sm);
}
.cp-item label{font-size:10.5px;font-weight:900;letter-spacing:.07em;margin-bottom:4px}
.cp-item span{font-size:15px;font-weight:700}
.cp-acc span{font-size:15px}
/* Final price box: larger, richer */
.calc-preview .cp-final{padding:10px 12px;margin:0}
.calc-preview .cp-final span{font-size:22px;font-weight:900}

/* ── 9. Entry actions: very clear edit-mode state ── */
.entry-actions{gap:10px;margin-top:16px}
/* Edit-mode note: amber banner */
.qi-edit-mode-note.show{
  width:100%;padding:9px 13px;
  background:var(--amber-light);border:1px solid var(--amber-mid);
  border-radius:var(--r-xs);color:var(--amber);
  font-size:13px;font-weight:900;display:flex;align-items:center;gap:7px;
}
.qi-edit-mode-note.show::before{content:'✎ ';font-size:15px}
/* Cancel Edit: amber-tinted when visible */
#cancelItemEditBtn:not([style*="none"]){
  background:var(--amber-light)!important;
  border-color:var(--amber-mid)!important;
  color:var(--amber)!important;
}
#cancelItemEditBtn:not([style*="none"]):hover{
  background:var(--amber-mid)!important;
}
/* Update Item button: amber brand when cancel is showing */
#cancelItemEditBtn:not([style*="none"]) ~ #addBtn{
  background:#d97706!important;
  box-shadow:0 4px 14px rgba(217,119,6,.3)!important;
}
#cancelItemEditBtn:not([style*="none"]) ~ #addBtn:hover{
  background:#b45309!important;
}
/* Mobile: stack buttons vertically */
@media (max-width:520px){
  .entry-actions{flex-direction:column}
  .entry-actions .btn{width:100%;min-width:unset}
}

/* ── 10. Quotation item cards: cleaner & more readable ── */
.qi-list{gap:8px}
.qi-item{
  padding:14px 16px;border-radius:var(--r-sm);
  transition:box-shadow .15s,border-color .15s;
}
.qi-item:hover:not(.editing){box-shadow:var(--shadow-sm)}
/* Editing: prominent left accent bar */
.qi-item.editing{
  border-left-width:4px;
  border-color:var(--accent);
  background:var(--accent-light);
  box-shadow:0 0 0 2px rgba(37,71,208,.1);
}
/* Number badge: slightly bigger */
.qi-num{min-width:28px;height:28px;font-size:12px}
/* Description: a hair larger */
.qi-desc{font-size:14.5px;font-weight:900;line-height:1.3}
/* Dimension: code-block style for readability */
.qi-dim{
  margin-top:6px;font-size:12.5px;line-height:1.45;
  background:var(--surface2);border-radius:var(--r-xs);
  padding:5px 8px;display:block;
}
/* Bottom row */
.qi-item-bottom{margin-top:12px;padding-top:10px}
.qi-total{font-size:20px;font-weight:900}
.qi-unit{font-size:12.5px}
/* Edit / Delete buttons: cleaner */
.qi-edit-btn{font-size:12px;padding:6px 11px;border-radius:var(--r-xs);font-weight:900}
.qi-del{
  font-size:13px;padding:5px 9px;border-radius:var(--r-xs);
  border:1px solid var(--border);color:var(--text-muted);background:var(--surface);
  font-weight:700;
}
.qi-del:hover{color:var(--red);background:var(--red-light);border-color:var(--red-mid)}
/* Card actions: right-aligned, consistent gap */
.qi-card-actions{gap:6px}

/* ── 11. Locked list: polished readability ── */
.review-lock-label.show{font-size:12px;padding:5px 12px;font-weight:900;margin-bottom:12px}

/* ── 12. Review / save action panel ── */
.review-action-panel{padding:14px 16px}
.qt-label{font-size:12.5px;letter-spacing:.06em}
.qt-amt{font-size:26px;font-weight:900}
.quote-actions{gap:10px}
.quote-actions .btn-save{font-size:14px}

/* ── 13. Mobile: no overflow, clean stacks ── */
@media (max-width:640px){
  .card{padding:14px 13px!important}
  .two-col{gap:12px}
  .calc-preview{padding:12px}
  .calc-preview .cp-final span{font-size:20px}
  .qi-total{font-size:18px}
  .qi-item{padding:12px 13px}
}
@media (max-width:420px){
  .type-btn{min-height:46px;padding:8px 4px}
  .type-btn .t-name{font-size:12px}
}

/* ═══════════════ STAGE 6A-3 — STRONG UI REDESIGN v2.17.5 ═══════════════ */

/* ── A. Customer summary card ── */
.summary-card{
  padding:0!important;overflow:hidden;
  border:1px solid var(--border);
}
.summary-card::before{
  content:'';display:block;height:4px;
  background:linear-gradient(90deg,var(--accent-2),var(--accent) 55%,#5b7af5);
}
.summary-topline{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:14px 18px 8px;
}
.summary-card .qi-compact{padding:6px 18px 16px}
.summary-card .locked-notice{margin:0 18px 16px}
.summary-card .qi-edit{margin:0;padding:0 18px 18px;border-top:1px dashed var(--border);padding-top:14px;margin-top:2px}
.summary-ava{
  width:46px;height:46px;flex-shrink:0;border-radius:var(--r-sm);
  background:linear-gradient(135deg,var(--accent-light),var(--surface2));
  border:1px solid var(--accent-mid);
  display:flex;align-items:center;justify-content:center;font-size:20px;
}
.summary-card .qi-compact{display:flex;align-items:center;gap:14px}
.summary-meta{margin-top:6px}
.sum-chip{
  display:inline-flex;align-items:center;
  background:var(--surface2);border:1px solid var(--border);
  border-radius:var(--r-xs);padding:3px 9px;
  font-size:11.5px;font-weight:800;color:var(--text-2);
  font-family:'SFMono-Regular',Consolas,monospace;letter-spacing:0;
}
@media (max-width:640px){
  .summary-card .qi-compact{display:flex;flex-wrap:wrap}
  .summary-ava{width:40px;height:40px;font-size:17px}
  .summary-card .qi-action-stack{width:100%}
}

/* ── B. Section blocks: group-label becomes a filled section band ── */
.item-form.active .group-label,
#step2Card > .group-label{
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:var(--r-xs);
  padding:8px 12px;margin-top:10px;margin-bottom:2px;
  font-size:10.5px;font-weight:900;letter-spacing:.1em;color:var(--accent-2);
}
.item-form.active .group-label::after,
#step2Card > .group-label::after{display:none}
.item-form.active .group-label:first-child,
#step2Card > .group-label:first-child{margin-top:0}
.type-btn{
  position:relative;min-height:58px;border-radius:var(--r-sm);
  padding:12px 8px 12px 8px;border:1.5px solid var(--border);
  background:var(--surface);box-shadow:var(--shadow-sm);
}
.type-btn::before{
  content:'';position:absolute;top:7px;right:7px;
  width:12px;height:12px;border-radius:50%;
  border:2px solid var(--border);background:var(--surface);
  transition:border-color .12s,background .12s,box-shadow .12s;
}
.type-btn:hover:not(.active){border-color:var(--accent-mid);box-shadow:var(--shadow)}
.type-btn.active{
  border-color:var(--accent);border-width:1.5px;
  background:linear-gradient(160deg,var(--accent-light),var(--surface));
  box-shadow:0 0 0 3px var(--accent-mid),var(--shadow-sm);
}
.type-btn.active::before{
  border-color:var(--accent);background:var(--accent);
  box-shadow:inset 0 0 0 2.5px var(--surface);
}
.type-btn .t-name{font-size:13px;font-weight:800;line-height:1.3}
.type-btn.active .t-name{color:var(--accent-2);font-weight:900}

/* ── D. Accessories mini-card ── */
.acc-panel{
  border:1px solid var(--accent-mid);
  background:var(--surface2);
  box-shadow:var(--shadow-sm);
  padding:0;overflow:hidden;gap:0;
}
.acc-panel-title{
  background:var(--accent-light);
  border-bottom:1px solid var(--accent-mid);
  padding:10px 14px;margin:0;font-size:13px;
}
.acc-panel .acc-item{
  border:none;border-bottom:1px solid var(--border);
  border-radius:0;margin:0;background:var(--surface);
}
.acc-panel .acc-item:last-child{border-bottom:none}

/* ── E. Calc preview → 4 KPI cards ── */
.calc-preview{
  background:transparent;border:none;box-shadow:none;
  padding:0;gap:10px;margin-top:18px;
}
.calc-preview .cp-item{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-sm);padding:12px 14px;
  box-shadow:var(--shadow-sm);min-width:0;
}
.calc-preview .cp-item label{font-size:10.5px;letter-spacing:.08em;margin-bottom:5px;color:var(--text-muted)}
.calc-preview .cp-item span{font-size:16px;font-weight:800;overflow-wrap:break-word}
.calc-preview .cp-acc{border-color:var(--accent-mid);background:var(--accent-light)}
.calc-preview .cp-acc label{color:var(--accent-2)}
.calc-preview .cp-acc span{color:var(--accent-2)}
/* Final Unit Price: hero KPI */
.calc-preview .cp-final{
  background:linear-gradient(150deg,var(--green-light),var(--surface));
  border:1.5px solid var(--green-2);
  box-shadow:0 2px 10px rgba(22,163,74,.14);
  padding:12px 14px;margin:0;
}
.calc-preview .cp-final label{color:var(--green-2);font-weight:900}
.calc-preview .cp-final span{font-size:24px;font-weight:900;color:var(--green)}
.calc-preview.flash{animation:none}
.calc-preview.flash .cp-final{animation:kpiflash .5s ease}
@keyframes kpiflash{0%{box-shadow:0 0 0 4px rgba(34,197,94,.35)}100%{box-shadow:0 2px 10px rgba(22,163,74,.14)}}

/* ── F. Add / Update primary action ── */
.entry-actions{
  margin-top:18px;padding-top:16px;
  border-top:1px dashed var(--border);
}
#addBtn{
  background:linear-gradient(135deg,var(--accent-2),var(--accent));
  font-size:15.5px;min-height:54px;border-radius:var(--r-sm);
  box-shadow:0 5px 16px rgba(37,71,208,.35);
}
#addBtn:hover{background:linear-gradient(135deg,#17348f,var(--accent-2))}
#cancelItemEditBtn{border-radius:var(--r-sm);min-height:54px}
/* Edit mode: amber override keeps 6A-2 behavior, add gradient */
#cancelItemEditBtn:not([style*="none"]) ~ #addBtn{
  background:linear-gradient(135deg,#b45309,#d97706)!important;
}
#cancelItemEditBtn:not([style*="none"]) ~ #addBtn:hover{
  background:linear-gradient(135deg,#92400e,#b45309)!important;
}

/* ═══════════════ v2.22.3 — STAGE 7B-15 TABLET INPUT UX POLISH ═══════════════ */
/* Touch devices: bigger targets + more spacing so Cancel/Add can't be mis-tapped */
@media (hover:none) and (pointer:coarse){
  .entry-actions{gap:14px}
  .entry-actions .btn{min-width:160px}
  #addBtn{min-height:60px;font-size:16.5px}
  #cancelItemEditBtn{min-height:60px}
}
/* Touch tablets/phones: keep Add to Quotation reachable without hunting for it,
   without depending on the on-screen keyboard's Enter/Done/Next behavior */
@media (hover:none) and (pointer:coarse) and (max-width:900px){
  .entry-actions{
    position:sticky; bottom:68px; z-index:120;
    background:var(--surface); padding:14px 0 6px;
    box-shadow:0 -6px 14px rgba(0,0,0,.06);
  }
}

/* Stage 7B-17: Quotation List sort control (display order only) */
.qi-sort-row{display:flex; align-items:center; gap:8px; margin:12px 0 2px}
.qi-sort-row label{font-size:11.5px; font-weight:800; color:var(--text-2); text-transform:uppercase; letter-spacing:.04em}
.qi-sort-row select{
  padding:6px 10px; font-size:12.5px; font-weight:700; color:var(--text);
  border:1.5px solid var(--border); border-radius:var(--r-xs); background:var(--surface);
}
.qi-meta-pill.qi-weight-pill{color:var(--text-2)}

/* v2.23.0 — Stage 7B-18A: Master Data Tools (Excel/CSV import-export) */
.mdt-box{background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px 14px;margin-bottom:14px}
.mdt-title{font-size:12px;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.mdt-title .mdt-sub{font-weight:600;text-transform:none;color:var(--text-muted);margin-left:6px;font-size:11px}
.mdt-actions{display:flex;gap:8px;flex-wrap:wrap}
.mdt-preview{margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)}
.mdt-preview-summary{font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px}
.mdt-preview-summary .warn{color:#b45309}
.mdt-preview-summary .err{color:#b91c1c}
.mdt-preview-list{max-height:160px;overflow-y:auto;font-size:12px;color:var(--text-2);background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xs);padding:8px;margin-bottom:10px}
.mdt-preview-list div{padding:2px 0}
.mdt-preview-actions{display:flex;gap:8px}

/* ── G. Quotation list: modern item cards ── */
.qi-item{
  border-radius:var(--r-sm);padding:0;overflow:hidden;
  box-shadow:var(--shadow-sm);
}
.qi-item-top{padding:13px 15px 0}
.qi-item-bottom{
  padding:10px 15px 12px;margin-top:10px;
  background:var(--surface2);border-top:1px solid var(--border);
}
.qi-num{
  min-width:28px;height:28px;border-radius:var(--r-sm);
  background:var(--accent-light);border:1px solid var(--accent-mid);
  color:var(--accent-2);font-weight:900;
}
.qi-item.editing{
  border-left-width:4px;border-color:var(--accent);
  box-shadow:0 0 0 3px var(--accent-mid),var(--shadow-sm);
}
.qi-item.editing .qi-item-bottom{background:var(--accent-light)}
.review-list-panel.locked .qi-item .qi-item-bottom{background:#e8ebf0}
/* Total price emphasis */
.qi-total{font-size:20px}
.qi-unit{text-transform:uppercase;font-size:10.5px;font-weight:800;letter-spacing:.05em}
/* Quotation total bar: hero */
.quote-total-bar{
  background:linear-gradient(150deg,var(--green-light),var(--surface));
  border:1.5px solid var(--green-2);border-radius:var(--r-sm);
  padding:12px 16px;margin-bottom:14px;border-bottom-style:solid;
}

/* ── H. Mobile hard-stops ── */
@media (max-width:640px){
  .summary-topline{padding:12px 14px 6px}
  .summary-card .qi-compact{padding:4px 14px 14px}
  .summary-card .qi-edit{padding:12px 14px 14px}
  .summary-card .locked-notice{margin:0 14px 14px}
  .calc-preview{grid-template-columns:1fr 1fr}
  .calc-preview .cp-acc,.calc-preview .cp-final{grid-column:1/-1}
  .calc-preview .cp-final span{font-size:21px}
  .qi-item-top{padding:11px 12px 0}
  .qi-item-bottom{padding:9px 12px 11px}
}
/* ═══════════════ v2.17.6 — ACCESSORIES UI POLISH ═══════════════ */
.acc-panel-sub{
  display:block;font-size:11px;font-weight:600;color:var(--text-muted);
  text-transform:none;letter-spacing:0;margin-top:2px;
}
.acc-panel{background:var(--surface2);padding:12px;gap:10px}
.acc-panel-title{background:none;border-bottom:none;padding:0 2px 4px;margin:0}
/* Mini cards */
.acc-panel .acc-item{
  border:1.5px solid var(--border);border-radius:var(--r-sm);
  background:var(--surface);padding:11px 13px;margin:0;
  transition:border-color .15s,background .15s,opacity .15s,box-shadow .15s;
}
.acc-panel .acc-item:last-child{border-bottom:1.5px solid var(--border)}
/* Unchecked: light grey, dimmed */
.acc-panel .acc-item.is-disabled{
  opacity:.65;background:var(--surface2);border-color:var(--border);
  border-style:dashed;box-shadow:none;
}
/* Checked: active card */
.acc-panel .acc-item:not(.is-disabled){
  border-color:var(--accent);background:var(--surface);
  box-shadow:0 0 0 3px var(--accent-mid),var(--shadow-sm);
}
/* Head: checkbox + title */
.acc-item-head{margin-bottom:9px}
.acc-enable{gap:9px;font-size:13.5px;font-weight:900;color:var(--text-2);width:100%}
.acc-item-head input[type=checkbox]{width:17px;height:17px}
.acc-title-txt{color:var(--text-2)}
.acc-item:not(.is-disabled) .acc-title-txt{color:var(--accent-2)}
.acc-title-zh{font-size:11px;font-weight:600;color:var(--text-muted);margin-left:4px}
/* Disabled card: keep fields visible and dimmed; controls remain disabled until selected. */
.acc-item.is-disabled .acc-item-fields{opacity:.55}
.acc-item.is-disabled .acc-item-head{margin-bottom:9px}
.acc-item-fields .acc-field-label{font-size:10.5px;letter-spacing:.06em;font-weight:800;margin-bottom:4px}
@media (max-width:480px){
  .acc-item-head{flex-direction:row;align-items:center}
  .acc-panel{padding:10px;gap:8px}
}
/* v2.20.3 — global full-width accessories section bar */
.acc-toggle-btn,.acc-panel{grid-column:1/-1;width:100%;min-width:0;box-sizing:border-box}
.acc-toggle-btn{min-height:52px;padding:8px 14px;align-items:center}
.acc-toggle-text{display:flex;flex:1;min-width:0;flex-direction:column;align-items:flex-start;gap:2px;line-height:1.2}
.acc-toggle-title{font-size:13px;font-weight:900;color:var(--text-2);overflow-wrap:anywhere}
.acc-toggle-sub{font-size:10.5px;font-weight:650;color:var(--text-muted);opacity:1;overflow-wrap:anywhere}
.acc-toggle-btn.open .acc-toggle-title{color:var(--accent-2)}
@media (max-width:480px){
  .acc-toggle-btn{min-height:48px;padding:8px 11px}
  .acc-toggle-title{font-size:12.5px}
  .acc-toggle-sub{font-size:10.5px}
}
/* ── v2.19.1 Plate layout ── */
.hole-pills{display:flex;gap:7px;flex-wrap:wrap;margin-top:4px}
.hole-pill{
  display:inline-flex;align-items:center;gap:6px;cursor:pointer;
  padding:7px 12px;border:1.5px solid var(--border);border-radius:var(--r-xs);
  background:var(--surface);font-size:12.5px;font-weight:700;color:var(--text-2);
  transition:border-color .12s,background .12s;user-select:none;
}
.hole-pill input[type=radio]{accent-color:var(--accent);width:14px;height:14px;flex-shrink:0}
.hole-pill:has(input:checked){border-color:var(--accent);background:var(--accent-light);color:var(--accent-2)}
/* Card-style plate type selector — stacks label + zh vertically */
.hole-pill-card{flex-direction:column;align-items:flex-start;gap:3px;padding:10px 14px}
.hole-pill-card input[type=radio]{margin-bottom:2px;align-self:flex-start}
.hole-pill-card.hole-pill{flex-direction:row;align-items:center;flex-wrap:wrap;gap:6px}
.hole-pill-main{font-size:13px;font-weight:800}
.hole-pill-zh{font-size:10.5px;font-weight:500;color:var(--text-muted);display:block;margin-top:1px}
.hole-pill:has(input:checked) .hole-pill-zh{color:var(--accent-2);opacity:.75}
/* Small Chinese field hint below label */
.field-zh{display:block;font-size:10.5px;font-weight:500;color:var(--text-muted);letter-spacing:0;text-transform:none;margin-top:1px}
.info-note{
  font-size:11.5px;color:var(--text-muted);font-weight:600;
  padding:7px 10px;background:var(--surface2);
  border:1px solid var(--border);border-radius:var(--r-xs);
  line-height:1.5;
}/* ── v2.20.2 Welding Anchor Set cost breakdown ── */
.was-guide{
  grid-column:1/-1;width:100%;box-sizing:border-box;
  font-size:12.5px;font-weight:600;color:var(--accent-2);line-height:1.6;
  background:var(--surface2);border:1px solid var(--border);
  border-radius:var(--r-xs);padding:9px 12px;
}
.type-btn[data-type="was"]{min-height:58px}
.type-btn[data-type="was"] .t-name{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;white-space:normal}
.was-type-zh{display:block;font-size:10.5px;color:var(--text-muted);font-weight:600;line-height:1.2}
.was-cost-note{grid-column:1/-1;width:100%;box-sizing:border-box;padding:8px 11px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-xs);font-size:11.5px;line-height:1.5;color:var(--text-muted);font-weight:600}
.was-cost-note strong{display:block;color:var(--text-2);font-size:11.5px;margin-bottom:1px}
.was-breakdown{
  display:none;width:100%;box-sizing:border-box;margin-top:10px;padding:10px 12px;
  background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-xs);
  color:var(--text-2);font-size:11.5px;line-height:1.45;
}
.was-breakdown.show{display:block}
.was-breakdown-title{font-size:12.5px;font-weight:900;margin-bottom:7px}
.was-breakdown-title .zh{font-size:10.5px;font-weight:600;color:var(--text-muted)}
.was-breakdown-row{display:grid;grid-template-columns:minmax(110px,.55fr) minmax(0,1fr);gap:10px;padding:4px 0;border-bottom:1px solid var(--border)}
.was-breakdown-row:last-child{border-bottom:0}
.was-breakdown-label{font-weight:700;color:var(--text-muted)}
.was-breakdown-value{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.was-breakdown-total{font-weight:900;color:var(--accent-2)}
@media (max-width:520px){
  .was-breakdown-row{grid-template-columns:1fr;gap:1px}
}

/* Product Entry compact symmetry polish */
#step2Card .card-head{margin-bottom:12px}
#step2Card > .group-label,
.item-form.active .group-label{
  min-height:32px;
  padding:6px 11px;
  margin-top:6px;
  margin-bottom:0;
  align-items:center;
  line-height:1.25;
}
#step2Card > .group-label{margin-bottom:7px!important}
.item-form.active{gap:11px 10px}
.type-picker{gap:7px;margin-bottom:14px}
.type-btn,
.type-btn[data-type="was"]{
  min-height:52px;
  padding:8px;
  border-radius:var(--r-sm);
}
.finish-pill{min-height:46px}
.acc-toggle-btn{
  min-height:46px;
  padding:6px 12px;
  border-radius:var(--r-xs);
}
@media (max-width:520px){
  #step2Card .card-head{margin-bottom:10px}
  #step2Card > .group-label,
  .item-form.active .group-label{min-height:30px;padding:5px 9px;margin-top:5px}
  .item-form.active{gap:10px 8px}
  .type-picker{gap:6px;margin-bottom:12px}
  .type-btn,
  .type-btn[data-type="was"]{min-height:48px;padding:6px}
  .finish-pill{min-height:44px}
  .acc-toggle-btn{min-height:44px;padding:6px 10px}
}

/* U-Bolt internal price debug — removable Stage 7B-11 block */
.ubolt-debug-wrap{display:none;margin-top:7px;border:1px solid var(--border);border-radius:var(--r-xs);background:var(--surface2);padding:6px 8px;opacity:.88}
.ubolt-debug-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ubolt-debug-title{font-size:10.5px;font-weight:700;color:var(--text-muted)}
.ubolt-debug-title span{font-size:10.5px;font-weight:600;color:var(--text-muted);margin-left:5px}
.ubolt-debug-toggle{border:1px solid var(--border);border-radius:var(--r-xs);background:var(--surface);color:var(--text-muted);padding:3px 7px;font-size:10.5px;font-weight:700;cursor:pointer}
.ubolt-debug-panel{display:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 8px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)}
.ubolt-debug-panel.show{display:grid}
.ubolt-debug-cell{min-width:0;font-size:10.5px;color:var(--text-muted)}
.ubolt-debug-cell strong{display:block;margin-top:1px;font-size:10.5px;color:var(--text-2);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.ubolt-card-debug{margin-top:5px;padding:5px 7px;border-left:3px solid var(--amber);background:var(--amber-light);color:var(--text-2);font-size:10.5px;line-height:1.45;white-space:normal}
@media (max-width:520px){.ubolt-debug-panel{grid-template-columns:repeat(2,minmax(0,1fr))}.ubolt-debug-head{align-items:flex-start}}
.price-mode-field,.manual-price-field{min-width:0}
.manual-price-guide{display:block;margin-top:5px;color:var(--text-muted);font-size:10.5px;font-weight:600;line-height:1.4}
.manual-price-guide span{display:block;margin-top:2px;color:var(--text-2);font-weight:500}
.price-mode-preview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-xs);background:var(--surface2)}
.price-mode-preview div{min-width:0;font-size:10.5px;font-weight:700;color:var(--text-muted)}
.price-mode-preview strong{display:block;margin-top:1px;font-size:11.5px;color:var(--text-2);overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.price-mode-badge{display:inline-flex;align-items:center;margin-left:4px;padding:1px 5px;border:1px solid var(--border);border-radius:var(--r-xs);background:var(--surface2);color:var(--text-muted);font-size:10.5px;font-weight:700;vertical-align:middle}
@media (max-width:520px){.price-mode-preview{grid-template-columns:1fr;gap:4px}}
/* ── Quick Open ─────────────────────────────────────────────── */
.qo-card{padding:14px 16px;margin-bottom:14px}
.qo-label{display:block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-muted);margin-bottom:8px}
.qo-label .zh{text-transform:none;letter-spacing:0;font-weight:600;margin-left:4px}
.qo-row{display:flex;gap:8px;align-items:stretch}
.qo-input{flex:1 1 auto;min-width:0;height:var(--control-h-lg);padding:0 13px;font-size:16px;font-family:inherit;
  /* A secondary surface, not the page ground — otherwise it darkens with the
     page and reads as a hole punched in the card. */
  font-weight:600;letter-spacing:.02em;color:var(--text);background:var(--surface2);
  border:1.5px solid var(--border);border-radius:var(--r-sm);outline:none;
  transition:border-color .15s,box-shadow .15s}
.qo-input::placeholder{color:var(--text-muted);font-weight:500;letter-spacing:0}
.qo-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(91,122,245,.16);background:var(--card)}
.qo-btn{flex:0 0 auto;height:var(--control-h-lg);padding:0 20px;font-size:14px;font-weight:700;border-radius:var(--r-sm)}
.qo-result{margin-top:10px;font-size:13px}
.qo-msg{padding:9px 12px;border-radius:var(--r-sm);font-weight:600;line-height:1.45}
.qo-msg.err{background:rgba(220,38,38,.08);color:var(--red);border:1px solid rgba(220,38,38,.22)}
.qo-msg.info{background:rgba(91,122,245,.09);color:var(--brand);border:1px solid rgba(91,122,245,.22)}
.qo-list{display:flex;flex-direction:column;gap:7px;margin-top:8px;max-height:320px;overflow-y:auto}
.qo-hit{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
  min-height:56px;padding:9px 12px;text-align:left;cursor:pointer;
  background:var(--card);border:1.5px solid var(--border);border-radius:var(--r-sm);
  font-family:inherit;color:var(--text);transition:border-color .12s,background .12s}
.qo-hit:hover,.qo-hit:focus-visible{border-color:var(--brand);background:rgba(91,122,245,.05);outline:none}
.qo-hit-main{min-width:0}
.qo-hit-ref{font-weight:800;font-size:13.5px;letter-spacing:.01em}
.qo-hit-sub{font-size:12px;color:var(--text-muted);margin-top:2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* "Formerly Q-…" — shown only on a hit found by its retired number */
.qo-hit-prev{display:block;font-size:11.5px;font-weight:700;margin-top:3px;color:var(--amber);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qo-hit-amt{flex:0 0 auto;font-weight:800;font-size:13.5px;color:var(--green);white-space:nowrap}
@media(max-width:600px){
  .qo-row{flex-wrap:wrap}
  .qo-input{flex:1 1 100%;width:100%}
  .qo-btn{flex:1 1 100%;width:100%}
  .qo-hit{min-height:60px}
}

/* ── Tap targets ──────────────────────────────────────────────────────────
   Last in the sheet on purpose: .btn-sm sets min-height:36px further up, and
   at equal specificity the later rule wins. Print / WhatsApp / Copy / Clear All
   are .btn-sm yet are primary actions on a phone. min-height only, so each
   button keeps its own font-size and padding. Applies down from 820px, the same
   breakpoint where the layout switches to the touch/burger arrangement. */
@media (max-width:820px){
  .btn,.btn-sm{min-height:44px}
}

/* ══════════════ MOTION ══════════════════════════════════════════════════════
   Restrained, business-tool motion: 140-220ms, ease-out, opacity + <=6px
   transform only. Transforms never affect layout, so nothing shifts. No bounce,
   no rotation, no page-wide stagger, and nothing animated on quotation figures.
   Last in the sheet so it wins over earlier equal-specificity rules. */
:root{ --mo-fast:140ms; --mo:180ms; --mo-slow:220ms; --mo-ease:cubic-bezier(.2,.7,.4,1); }

/* Buttons: colour/shadow on hover, a 1px press. */
.btn,.nav-btn,.hdr-btn,.mob-tab,.side-link,.modal-close{
  transition:background var(--mo) var(--mo-ease),
             border-color var(--mo) var(--mo-ease),
             color var(--mo) var(--mo-ease),
             box-shadow var(--mo) var(--mo-ease),
             transform var(--mo-fast) var(--mo-ease),
             filter var(--mo) var(--mo-ease);
}
.btn:active,.nav-btn:active,.hdr-btn:active,.mob-tab:active{transform:translateY(1px)}

/* Clickable cards: lift very slightly. */
.company-card,.company-card-compact,.q-card,.rq-card,.cp-hit,.qo-hit,.type-btn{
  transition:border-color var(--mo) var(--mo-ease),
             background var(--mo) var(--mo-ease),
             box-shadow var(--mo) var(--mo-ease),
             transform var(--mo) var(--mo-ease);
}
.company-card:hover,.company-card-compact:hover,.q-card:hover,.rq-card:hover,
.cp-hit:hover,.qo-hit:hover{transform:translateY(-1px)}
.company-card:active,.company-card-compact:active,.q-card:active,.rq-card:active,
.cp-hit:active,.qo-hit:active{transform:translateY(0)}

/* Inputs: focus ring fades in. */
input,select,textarea{
  transition:border-color var(--mo) var(--mo-ease),
             box-shadow var(--mo) var(--mo-ease),
             background-color var(--mo) var(--mo-ease);
}

/* Modals: fade the scrim, ease the panel up 6px. Kept out of the layout with
   visibility + pointer-events so an idle overlay can never intercept clicks. */
.modal-overlay{
  display:flex; opacity:0; visibility:hidden; pointer-events:none;
  transition:opacity var(--mo) var(--mo-ease), visibility 0s linear var(--mo);
}
.modal-overlay.open{
  opacity:1; visibility:visible; pointer-events:auto;
  transition:opacity var(--mo) var(--mo-ease), visibility 0s;
}
.modal-overlay > .modal{transition:transform var(--mo) var(--mo-ease); transform:translateY(6px)}
.modal-overlay.open > .modal{transform:none}

/* Toast already fades; just align it to the shared timing. */
.toast{transition:opacity var(--mo) var(--mo-ease), transform var(--mo) var(--mo-ease)}

@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:.001ms!important; animation-iteration-count:1!important;
    transition-duration:.001ms!important; scroll-behavior:auto!important;
  }
  .btn:active,.nav-btn:active,.hdr-btn:active,.mob-tab:active,
  .company-card:hover,.company-card-compact:hover,.q-card:hover,.rq-card:hover,
  .cp-hit:hover,.qo-hit:hover{transform:none}
  .modal-overlay > .modal,.modal-overlay.open > .modal{transform:none}
}

/* Sidebar + its scrim. */
.sidebar{transition:transform var(--mo-slow) var(--mo-ease)}
.sidebar-backdrop{transition:opacity var(--mo) var(--mo-ease)}
/* Quick Open results fade in without pushing the page around. */
.qo-result:not([hidden]){animation:mo-fade var(--mo) var(--mo-ease) both}
@keyframes mo-fade{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
  .qo-result:not([hidden]){animation:none}
}

/* Global nav states: active = current page, secondary = Sign Out. Subtle on the
   blue header — a slightly stronger fill plus weight, no colour invention. */
.hdr-btn.is-active{background:rgba(255,255,255,.28);border-color:rgba(255,255,255,.55);font-weight:800}
.hdr-btn.is-active:hover{background:rgba(255,255,255,.34)}
.hdr-btn.is-secondary{background:transparent;border-color:rgba(255,255,255,.3);opacity:.85;font-weight:600}
.hdr-btn.is-secondary:hover{background:rgba(255,255,255,.16);opacity:1}

/* Active-accessory badge on the collapsed panel toggle */
.acc-toggle-btn{position:relative}
.acc-active-badge{margin-left:auto;flex:0 0 auto;padding:2px 9px;border-radius:var(--pill-r);
  background:var(--amber-light);color:var(--amber);border:1px solid var(--amber-mid);
  font-size:11px;font-weight:800;white-space:nowrap}
.acc-toggle-btn.has-acc{border-color:var(--amber-mid)}

/* ── WhatsApp Quick Add ──────────────────────────────────────────────────── */
.wqa-open-btn{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:2px;
  margin-bottom:12px;padding:11px 14px;text-align:left;min-height:var(--control-h-lg)}
.wqa-open-ico{margin-right:6px}
.wqa-open-sub{font-size:11px;font-weight:600;color:var(--text-muted)}
.wqa-modal{max-width:900px;width:100%}
.wqa-hint{font-size:12.5px;color:var(--text-muted);margin-bottom:9px;line-height:1.45}
.wqa-input{width:100%;min-height:150px;padding:11px 12px;font-family:ui-monospace,Menlo,Consolas,monospace;
  font-size:13px;line-height:1.5;border:1.5px solid var(--border);border-radius:var(--r-sm);
  background:var(--surface);color:var(--text);resize:vertical}
.wqa-input:focus{outline:none;border-color:var(--border-focus);box-shadow:0 0 0 3px var(--accent-light)}
.wqa-msg{margin-top:9px;padding:9px 12px;border-radius:var(--r-sm);font-size:12.5px;font-weight:600;line-height:1.45;
  background:var(--accent-light);color:var(--accent-2);border:1px solid var(--accent-mid)}
.wqa-msg-warn{background:var(--amber-light);color:var(--amber);border-color:var(--amber-mid)}
.wqa-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:14px}
.wqa-actions .btn{min-width:132px}
.wqa-common{padding:11px 12px;border:1px solid var(--border);border-radius:var(--r-sm);
  background:var(--surface2);margin-bottom:var(--wqa-s3)}
.wqa-common-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
/* Three different things live on this bar, and they used to look alike: what
   the list IS (count, selection, AI), what you can DO (edit the message) and
   how you LOOK at it (Compact / Expanded). The count leads, the status sits
   quietly beside it, and the view control is labelled as one. */
.wqa-rows-head{display:flex;align-items:center;gap:var(--wqa-s2);
  margin:0 0 var(--wqa-s2);
  font-size:12.5px;font-weight:800;color:var(--text-2);flex-wrap:wrap}
/* On a phone the same bar can carry four things — the count, the AI badge, the
   view toggle and Back to upload — and the toggle was the one being squeezed to
   "Com". They wrap onto a second line instead; nothing is ever half-shown. */
.wqa-rows-head>*{flex:0 0 auto}
.wqa-rows-head>span:first-child{flex:1 1 auto;min-width:0}
/* the table surface itself */
.wqa-rows{display:flex;flex-direction:column;gap:0;min-width:0;
  border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface);overflow:hidden}
.wqa-rows.has-head{border-top:0;border-radius:0 0 var(--r-sm) var(--r-sm)}
.wqa-row{border:1.5px solid var(--border);border-radius:var(--r-sm);padding:11px 12px;background:var(--surface)}
.wqa-row-block{background:var(--amber-light)}
.wqa-row-no{font-size:12.5px;font-weight:800;flex:0 0 auto}
.wqa-row-raw{font-size:11.5px;color:var(--text-muted);font-family:ui-monospace,Menlo,Consolas,monospace;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.wqa-row-del{flex:0 0 auto;background:none;border:none;color:var(--text-muted);font-size:15px;cursor:pointer;
  padding:2px 6px;border-radius:var(--r-xs)}
.wqa-row-del:hover{color:var(--red);background:var(--red-light)}
.wqa-row-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
.wqa-price-grid{padding-top:var(--wqa-s2);border-top:1px solid var(--wqa-hair)}
.wqa-row-body .wqa-row-grid+.wqa-row-grid{margin-top:var(--wqa-s3)}
.wqa-final{display:flex;align-items:center;min-height:var(--control-h);font-size:15px;font-weight:800;color:var(--green)}
.wqa-final-tag{margin-left:6px;font-size:10.5px;font-weight:700;color:var(--text-muted)}
.wqa-acc-toggle{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--text-2);cursor:pointer}
.wqa-flag{display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:var(--pill-r);
  background:var(--surface2);color:var(--text-muted);border:1px solid var(--border)}
.wqa-flag-def{background:var(--accent-light);color:var(--accent-2);border-color:var(--accent-mid)}
.wqa-flag-req{background:var(--amber-light);color:var(--amber);border-color:var(--amber-mid)}
.wqa-req{color:var(--red)}
.wqa-needed{border-color:var(--amber-mid)!important;background:var(--amber-light)}
/* Exact / similar / none is a STATUS, and a status reads off one marked edge
   at least as well as off four. One tinted band with a coloured left edge, so
   an open row carries no more rectangles than it has to. */
.wqa-hist{margin-top:var(--wqa-s2);padding:9px 12px;border-radius:0 var(--r-xs) var(--r-xs) 0;
  font-size:12px;line-height:1.45;background:var(--surface2);
  border:0;border-left:3px solid var(--border);color:var(--wqa-quiet)}
.wqa-hist-exact{background:var(--green-light);border-left-color:var(--green)}
.wqa-hist-similar{background:var(--amber-light);border-left-color:var(--amber-mid)}
.wqa-hist-none{opacity:.9}
.wqa-hist-tag{font-weight:700;color:var(--text-2);margin-bottom:2px}
.wqa-hist-line{overflow-wrap:anywhere}
.wqa-hist-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-top:var(--wqa-s2);flex-wrap:wrap}
.wqa-hist-price{font-size:14px;font-weight:800;color:var(--green)}
@media (max-width:820px){
  .wqa-modal{max-width:100%}
  .wqa-common-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .wqa-row-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:640px){
  /* Full-screen sheet. It is EXACTLY the viewport — the old min-height:100vh
     fought the flex dialog's max-height and pushed the footer off-screen — so
     the body scrolls inside and the page behind never does. */
  .modal-overlay#wqaModal{padding:0}
  .wqa-modal{max-width:100%;height:100vh;max-height:100vh;min-height:0;
    margin-bottom:0;border-radius:0;padding:16px 14px}
  .wqa-actions .btn{flex:1;min-width:0}
  /* The review footer carries three things — the item count, Cancel and the
     wide "Add Items to Quotation" — and they do not fit one 390px line. Left
     on one line the label overflowed its button and dragged the whole dialog
     21px past the screen edge. Wrapping is the honest answer: the count takes
     its own line and the two buttons share the one below it, both fully on
     screen and both still thumb-sized. */
  .wqa-sticky-actions{flex-wrap:wrap;row-gap:8px}
  .wqa-sticky-actions .wqa-foot-count{flex:1 0 100%;margin-right:0}
}

/* The file a Review was built from: one line, on every screen size, because it
   is a label and not a document. */
.wqa-file-src{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:9px 12px}
.wqa-file-lbl{font-size:12.5px;font-weight:800;color:var(--text)}
.wqa-file-chip{font-size:11px;font-weight:800;padding:2px 8px;border-radius:var(--pill-r);
  background:var(--accent-light);border:1px solid var(--accent-mid);color:var(--accent-2)}
.wqa-file-name{font-size:12.5px;font-weight:700;color:var(--text-2);
  overflow-wrap:anywhere;min-width:0;flex:1 1 auto}
.wqa-file-src .btn{flex:0 0 auto}

/* Quick Add — accessories (common panel + per-item editor share this markup) */
.wqa-acc-common{background:var(--surface);margin-bottom:12px}
.wqa-acc-head{font-size:12.5px;font-weight:800;margin-bottom:8px}
/* Explanatory copy — LEVEL 3 everywhere it appears. Light, small, and it owns
   the gap under itself so no panel body needs a margin of its own. */
.wqa-acc-note{display:block;font-size:11px;font-weight:500;color:var(--wqa-quiet);
  line-height:1.5;margin:0 0 var(--wqa-s2)}
.wqa-acc-editor{display:flex;flex-direction:column;gap:7px}
.wqa-acc-line{display:grid;grid-template-columns:104px repeat(3,minmax(0,1fr));gap:8px;align-items:end}
.wqa-acc-en{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;min-height:var(--control-h)}
.wqa-acc-f{display:flex;flex-direction:column;gap:3px;min-width:0}
.wqa-acc-f>span{font-size:10.5px;font-weight:700;color:var(--text-muted)}
.wqa-acc-f input,.wqa-acc-f select{min-width:0}   /* look comes from the shared .acc-item-fields rule */
/* Native selects render ~2px taller than inputs at identical padding — the same
   fix .field select already uses, so the four columns line up. */
.wqa-acc-f input,.wqa-acc-f select{min-height:var(--control-h)}
.wqa-acc-f select{height:var(--control-h)}
.wqa-acc-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:var(--wqa-s3);
  padding-top:var(--wqa-s2);border-top:1px solid var(--wqa-hair)}
.wqa-acc-sum{font-size:11.5px;font-weight:600;color:var(--wqa-quiet)}
.wqa-row-acc{margin-top:var(--wqa-s2);padding-top:var(--wqa-s2);border-top:1px solid var(--wqa-hair)}
/* Same bar treatment as the main accessories toggle so the two read as one control. */
.wqa-acc-bar{display:flex;align-items:center;gap:8px;width:100%;padding:8px 11px;cursor:pointer;
  background:var(--surface2);border:1px solid var(--wqa-hair);border-radius:var(--r-xs);
  font-family:inherit;color:var(--text);text-align:left;min-height:var(--control-h-lg)}
.wqa-acc-bar:hover{border-color:var(--accent-mid)}
.wqa-acc-arrow{font-size:10px;color:var(--text-muted);flex:0 0 auto}
.wqa-acc-bar-lbl{font-size:12px;font-weight:800;flex:0 0 auto}
.wqa-acc-bar-sum{font-size:11.5px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;min-width:0;flex:1}
.wqa-acc-bar-sum.has{color:var(--accent-2);font-weight:700}
.wqa-row-acc .wqa-acc-editor{margin-top:var(--wqa-s1);padding:10px;background:var(--surface2);
  border:0;border-radius:var(--r-xs)}
@media (max-width:820px){
  .wqa-acc-line{grid-template-columns:1fr 1fr;gap:7px}
  .wqa-acc-en{grid-column:1/-1;min-height:0}
  .wqa-acc-wide{grid-column:1/-1}
}
/* Touch widths: same 48px floor the rest of the app uses. */
@media (max-width:820px){
  .wqa-acc-f input,.wqa-acc-f select{min-height:44px}   /* padding stays the shared accessory padding */
  .wqa-acc-f select{height:44px}
  .wqa-acc-en{min-height:44px}
  .wqa-acc-actions .btn{min-height:48px}
}
@media (max-width:480px){
  .wqa-acc-f input,.wqa-acc-f select{min-height:48px}
  .wqa-acc-f select{height:48px}
  .wqa-acc-bar{min-height:48px}
  .wqa-acc-actions .btn{flex:1 1 100%}
}

/* Quick Add — common pricing entry (same shell as the accessories panel) */
.wqa-price-common{background:var(--surface);margin-bottom:12px}
.wqa-price-line{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;align-items:end}
.wqa-price-line+.wqa-price-line{margin-top:7px}
.wqa-price-manual{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.wqa-price-warn{margin-top:var(--wqa-s2);padding:8px 11px;border-radius:0 var(--r-xs) var(--r-xs) 0;
  background:var(--amber-light);border:0;border-left:3px solid var(--amber-mid);
  font-size:11.5px;font-weight:600;color:var(--amber);line-height:1.45}
.wqa-row-mode{margin-top:7px}
/* The row's own material and finish, shown only while the list is mixed.
   LEVEL 3: it explains the line above it and must never be read first, so it
   is lighter, smaller, and separated by a real gap instead of sitting flush. */
.wqa-row-spec{padding:0 12px 9px 12px;font-size:10.5px;font-weight:600;color:var(--wqa-quiet);
  letter-spacing:.01em;overflow-wrap:anywhere}
@media (max-width:820px){
  .wqa-price-line{grid-template-columns:1fr 1fr;gap:7px}
  .wqa-price-manual{grid-template-columns:1fr}
}

/* Quick Add — collapsible common sections (collapsed at every width) */
.wqa-panel-head{display:flex;align-items:center;gap:9px;width:100%;padding:9px 11px;cursor:pointer;
  background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-xs);
  font-family:inherit;color:var(--text);text-align:left;min-height:var(--control-h-lg)}
.wqa-panel-head:hover{border-color:var(--accent-mid)}
.wqa-panel-head.open{border-color:var(--accent-mid);background:var(--surface)}
.wqa-panel-arrow{font-size:10px;color:var(--wqa-quiet);flex:0 0 auto}
.wqa-panel-text{display:flex;align-items:baseline;gap:var(--wqa-s2);min-width:0;flex:1;
  line-height:1.3;flex-wrap:wrap}
.wqa-panel-title{font-size:12.5px;font-weight:800;color:var(--text-2)}
.wqa-panel-sum{font-size:11px;font-weight:500;color:var(--wqa-quiet);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wqa-panel-head.open .wqa-panel-title{color:var(--accent-2)}
/* Where this section's Apply would land. It rode in the title as another five
   bold words on every head; it is the same fact, said quietly, once. */
.wqa-panel-scope{flex:0 0 auto;font-size:10px;font-weight:700;letter-spacing:.02em;
  color:var(--wqa-quiet);white-space:nowrap}
.wqa-panel-head.open .wqa-panel-scope{color:var(--accent-2)}
/* A count is metadata until it is a warning, and then it is amber — never a
   second blue accent competing with the section it belongs to. */
.wqa-panel-badge{flex:0 0 auto;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:var(--pill-r);
  background:var(--surface3);color:var(--wqa-quiet);white-space:nowrap}
.wqa-panel-badge.is-warn{background:var(--amber-light);color:var(--amber)}
.wqa-panel-body{margin-top:var(--wqa-s2)}

/* ── Bulk Edit — ONE container, four quiet rows ────────────────────────────
   These four sections were four bordered cards stacked down the dialog, each
   with its own outline, its own gap and its own bold heading — four rectangles
   for something that is one idea: change many items at once. They are one
   surface now, divided by hairlines. A CLOSED section is a quiet row; the OPEN
   one is the only part that gains a background, a marker and a body. */
.wqa-bulk{border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface);
  margin-bottom:var(--wqa-s3);overflow:hidden}
.wqa-bulk-head{display:flex;align-items:baseline;gap:var(--wqa-s2);flex-wrap:wrap;
  padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--wqa-hair)}
.wqa-bulk-title{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-2)}
.wqa-bulk-sub{font-size:11px;font-weight:500;color:var(--wqa-quiet)}
.wqa-bulk .wqa-common{margin-bottom:0}
.wqa-bulk .wqa-common+.wqa-common{border-top:1px solid var(--wqa-hair)}
.wqa-bulk .wqa-panel-head{border:0;border-radius:0;background:transparent;
  padding:10px 12px;min-height:44px}
.wqa-bulk .wqa-panel-head:hover{background:var(--surface2)}
.wqa-bulk .wqa-panel-head.open{background:var(--accent-light);
  box-shadow:inset 3px 0 0 var(--accent)}
.wqa-bulk .wqa-panel-body{margin-top:0;padding:12px 12px 14px;
  border-top:1px solid var(--wqa-hair)}
/* Quick Add — the customer's own message, kept beside the parsed rows so staff
   can compare the two without navigating away. ONE component: the same
   collapsible head every other section uses, over a scrolling text block. Only
   that block's height changes between desktop, tablet and phone. */
.wqa-source-common{background:var(--surface)}
.wqa-source-text{margin:0;max-height:108px;overflow:auto;overflow-wrap:anywhere;white-space:pre-wrap;
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;color:var(--text-2);
  padding:9px 11px;border:0;border-radius:var(--r-xs);background:var(--surface2)}
.wqa-source-actions{display:flex;justify-content:flex-end;margin-top:var(--wqa-s1)}
#wqaSource .wqa-panel-body{margin-top:var(--wqa-s1)}
/* The only thing that changes between screens is how tall that block may get.
   Declared here, after the base rule, so the breakpoints actually win. */
@media (max-width:820px){ .wqa-source-text{max-height:120px} }   /* tablet */
@media (max-width:640px){ .wqa-source-text{max-height:38vh} }    /* phone  */
/* Every collapsible section is a bare wrapper around the SAME head, so the
   arrow, title, summary, counter, height and padding line up down the column.
   Only what each one opens into differs. */
.wqa-source-common,.wqa-fix-common,.wqa-item-common,.wqa-price-common,.wqa-acc-common{
  padding:0;border:0;background:transparent}
.wqa-scope{margin-top:var(--wqa-s2)}
.wqa-item-grid-1{grid-template-columns:minmax(0,1fr)}
/* The tick box lives in the number cell, so switching scope moves no column. */
.wqa-pick{width:16px;height:16px;accent-color:var(--accent);cursor:pointer;margin:0}
.wqa-row.is-picked{background:var(--accent-light)}
.wqa-row.is-picked.wqa-row-block{background:var(--amber-light)}

/* Quick Add — discard confirmation (covers the modal, never the whole page) */
.wqa-confirm{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;
  padding:18px;background:rgba(15,23,42,.45);border-radius:inherit}
.wqa-confirm[hidden]{display:none}
.wqa-confirm-box{max-width:380px;width:100%;background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-md,12px);padding:18px;box-shadow:0 12px 34px rgba(15,23,42,.22)}
.wqa-confirm-title{font-size:15px;font-weight:900;margin-bottom:6px}
.wqa-confirm-sub{font-size:12.5px;font-weight:600;color:var(--text-muted);line-height:1.5;margin-bottom:14px}
.wqa-confirm-actions{display:flex;gap:9px;flex-wrap:wrap}
.wqa-confirm-actions .btn{flex:1 1 140px;min-height:44px}
.wqa-modal{position:relative}
@media (max-width:480px){ .wqa-confirm-actions .btn{flex:1 1 100%} }

/* Quick Add — unit / total weight beside the price, straight from the calculator */
/* Two labelled numbers. They were in a bordered strip, which made a third
   rectangle inside an open row for something the uppercase labels already
   separate perfectly well. */
.wqa-weight-line{display:flex;flex-wrap:wrap;align-items:center;gap:var(--wqa-s1) var(--wqa-s4);
  margin-top:var(--wqa-s2);padding:0;background:transparent;border:0}
.wqa-w-item{display:flex;flex-direction:column;gap:1px;min-width:0}
.wqa-w-lbl{font-size:10px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--text-muted)}
.wqa-w-val{font-size:12.5px;font-weight:700;color:var(--text-2);font-variant-numeric:tabular-nums}
.wqa-flag-asym{background:var(--amber-light);border-color:var(--amber-mid);color:var(--amber)}
@media (max-width:480px){ .wqa-weight-line{gap:7px 14px} }

/* Quick Add — compact review: one scannable line per item */
.wqa-view-toggle{display:inline-flex;border:1px solid var(--border);border-radius:var(--pill-r);overflow:hidden;background:var(--surface)}
.wqa-view-btn{border:0;background:transparent;font-family:inherit;font-size:11.5px;font-weight:700;
  padding:5px 12px;cursor:pointer;color:var(--wqa-quiet);min-height:30px}
.wqa-view-btn.is-on{background:var(--accent-light);color:var(--accent-2);font-weight:800}
/* The word in front of the pair, so it reads as a view control and not as two
   more buttons with the same weight as everything else on the bar. */
.wqa-view-lbl{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--wqa-quiet)}
/* Count and selection are one statement and stay side by side; this group is
   also the bar's first child, so it keeps the phone wrapping rule below. */
.wqa-rows-lead{display:flex;align-items:center;gap:var(--wqa-s2);min-width:0;flex-wrap:wrap}
/* ONE place says how many rows are ticked. The Apply buttons still name the
   scope they will act on; nothing else repeats the number. */
.wqa-sel-count{font-size:11px;font-weight:700;padding:3px 9px;border-radius:var(--pill-r);
  background:var(--accent-light);color:var(--accent-2);white-space:nowrap}
.wqa-sel-count.is-zero{background:var(--amber-light);color:var(--amber)}
.wqa-rows-count{font-size:12.5px;font-weight:800;color:var(--text-2)}
/* No card per row: just a divider. (overflow:hidden would let a flex item shrink
   below its own content, so the basis is pinned.) */
.wqa-row{padding:0;flex:0 0 auto;min-width:0;border:0;border-radius:0;background:transparent}
.wqa-row+.wqa-row{border-top:1px solid var(--wqa-hair)}
/* Zebra: it only has to be strong enough to carry the eye from Length across to
   Price, so it sits a couple of percent off white. Every state below is written
   at the same specificity or higher, and after it, so a blocked or open row is
   never repainted by the stripe. */
.wqa-row:nth-child(even){background:var(--zebra)}
.wqa-row.is-open{background:var(--surface2)}
.wqa-row.wqa-row-block{background:var(--amber-light)}
.wqa-row.is-open>.wqa-sum{border-bottom:1px solid var(--wqa-hair)}
/* ── One review table, not a stack of cards ────────────────────────────────
   The header and every row share one grid template, and the list is a single
   bordered surface with hairline dividers between rows.

   Every cell is centred in shared tracks. Cells STRETCH to their track (so
   ellipsis still works) and the text is centred inside them, which means a
   label and its values share one centre line no matter how long the word or
   how heavy the weight — nothing can drift. */
/* THE column geometry lives in custom properties and nowhere else. The header
   and every row read the SAME variable, so they cannot diverge; a breakpoint
   changes the variable, never the rule.

   It is written in three parts because the middle one repeats: a Stud list has
   one dimension column, a Sag Rod two, a J Bolt four. The breakpoint owns the
   three WIDTHS; wqaSetListGrid composes --wqa-cols from them once the column
   count is known, because CSS repeat() cannot take that count from a variable. */
.wqa-modal{
  --wqa-lead: 32px 62px;                                    /* #  Size        */
  --wqa-dim:  78px;                                         /* each dimension */
  --wqa-dim-spec: minmax(150px,1.4fr);   /* a mixed list's one whole-spec cell */
  --wqa-tail: 56px 104px 86px minmax(0,1fr) 46px 26px;      /* Qty W Price … */
  --wqa-cols: var(--wqa-lead) var(--wqa-dim) var(--wqa-tail);
  /* ONE spacing rhythm for the whole dialog. Four steps, nothing between them:
     s1 a label and its control, s2 a value and the metadata under it, s3 one
     section from the next, s4 a major block. Every gap below reads from these,
     so the dialog cannot drift back into 7px here and 11px there. */
  --wqa-s1: 6px; --wqa-s2: 10px; --wqa-s3: 16px; --wqa-s4: 22px;
  /* Two levels of line. A HAIRLINE separates rows inside one surface; the
     surface itself keeps the ordinary --border. Nothing else draws a box. */
  --wqa-hair: #e7ebf3;
  /* Level 3 — metadata and explanation. Readable, never competing. */
  --wqa-quiet: #6c7486;
}
.wqa-list-head,.wqa-sum{
  display:grid;align-items:center;gap:0 var(--wqa-s2);padding:0 12px;
  grid-template-columns:var(--wqa-cols)}
.wqa-list-head{position:sticky;top:0;z-index:3;background:var(--surface2);
  padding-top:8px;padding-bottom:8px;margin-bottom:0;
  border:1px solid var(--border);border-radius:var(--r-sm) var(--r-sm) 0 0}
.wqa-list-head[hidden]{display:none}
.wqa-h{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
.wqa-h-num,.wqa-h-act{text-align:center}
.wqa-sum{padding-top:7px;padding-bottom:7px;cursor:pointer;min-height:44px;
  background:transparent;font-size:12.5px}
/* A stale second :hover rule used to override this one with plain grey; there is
   now one hover, and it reads clearly above both stripes. */
.wqa-row>.wqa-sum:hover{background:var(--accent-light)}
.wqa-row.is-open>.wqa-sum{background:var(--surface2);border-bottom:1px solid var(--wqa-hair)}
.wqa-row.wqa-row-block>.wqa-sum:hover{background:var(--amber-mid)}
/* plain number, no pill. It says WHICH row, never how important the row is,
   so it sits at level 3 with the rest of the metadata. */
.wqa-sum-no{font-size:11px;font-weight:600;color:var(--wqa-quiet);
  font-variant-numeric:tabular-nums;text-align:center}
.wqa-c{font-weight:600;color:var(--text-2);white-space:nowrap;font-variant-numeric:tabular-nums;
  overflow:hidden;text-overflow:ellipsis;text-align:center}
/* LEVEL 1 — what the eye is looking for. Size, the dimensions and Qty are one
   weight; Price is one step above them and Weight one step below, so the row
   reads left to right and lands on the money. */
.wqa-c-size {font-weight:700;color:var(--text)}
.wqa-c-dim  {font-weight:700;color:var(--text)}      /* the values staff scan */
.wqa-c-qty  {font-weight:700;color:var(--text)}
.wqa-c-threadLen{font-weight:650;color:var(--text-2)}
/* A mixed list carries a whole spec in one cell, so that one may be narrower
   than its text and shows what it can. */
.wqa-c-spec {font-weight:600;color:var(--text-2)}
.wqa-c-w    {font-weight:600;color:var(--wqa-quiet)}
/* The row's outcome. Strongest thing on the line — by weight and size, not by
   colour: blue here competed with every other accent in the dialog. */
.wqa-c-price{font-weight:800;color:var(--text);font-size:13.5px;letter-spacing:-.01em}
/* The badge column is a pure slack column: min-width 0, hidden overflow and no
   flex-grow reaching outside it, so an "Asymmetric" pill can never widen the
   track or shift Price / Edit / ×. */
.wqa-sum-badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;
  min-width:0;max-width:100%;overflow:hidden}
/* A J Bolt names four dimensions and an L Bolt three, and by then the slack
   left over for the pills is a few characters wide — which shows a warning
   badly enough to be worse than not showing it. On those lists the badges take
   a line of their own under the row; the columns above them do not move. */
.wqa-sum-wide{row-gap:3px}
.wqa-sum-wide .wqa-sum-badges{grid-column:2/-3;justify-content:flex-start;overflow:visible}
.wqa-pill{font-size:10px;font-weight:800;padding:2px 7px;border-radius:var(--pill-r);white-space:nowrap;border:1px solid transparent}
/* Status pills are two words and stay on one line. A pill that carries a whole
   sentence — the product-conflict reason — wraps instead, because the badge
   column above hides its overflow and a half-shown sentence tells staff less
   than nothing. The column still cannot widen: only this pill gets taller. */
.wqa-pill-why{white-space:normal;overflow-wrap:anywhere;text-align:left;line-height:1.35;max-width:100%}
.wqa-pill-req{background:var(--amber-light);border-color:var(--amber-mid);color:var(--amber)}
.wqa-pill-warn{background:var(--amber-light);border-color:var(--amber-mid);color:var(--amber)}
.wqa-pill-info{background:var(--accent-light);color:var(--accent-2)}
/* the two action cells are fixed width and centred, so they cannot push
   anything to their left. LEVEL 2: Edit is the action, Delete sits a step under
   it — still plainly there, never the first thing found. */
.wqa-sum-act{font-size:11.5px;font-weight:700;color:var(--accent-2);text-align:center}
.wqa-row-del{background:transparent;border:0;color:#8d96a8;cursor:pointer;
  font-size:12px;width:28px;height:28px;border-radius:var(--r-xs);justify-self:center}
.wqa-row-del:hover{background:var(--red-light);color:var(--red)}
.wqa-row-body{padding:12px 12px 14px;min-width:0;overflow-wrap:anywhere;background:var(--surface)}
.wqa-row-raw-full{margin-top:8px;font-size:11px;color:var(--text-muted);font-family:ui-monospace,Menlo,Consolas,monospace;
  overflow-wrap:anywhere}
.wqa-hint-sm{display:block;margin-top:3px;font-size:10px;font-weight:650;color:var(--text-muted)}
/* The dialog is a flex column: title, one scrolling body, and an action bar that
   is a fixed row — so the Add button is on screen without scrolling, at any
   height. (A sticky last child has no slack to stick against.) */
/* The overlay pads 36px top and the modal carries a 36px bottom margin, so the
   dialog is capped to what is actually left — it always fits the viewport. */
.wqa-modal{display:flex;flex-direction:column;max-height:calc(100vh - 78px);min-width:0}
.modal-overlay{align-items:flex-start}
.wqa-modal>#wqaStep1{min-height:0;overflow-y:auto}
.wqa-modal>#wqaStep2{display:flex;flex-direction:column;min-height:0;flex:1 1 auto}
.wqa-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding-right:2px;
  /* breathing room so an expanded row never ends flush against the action bar */
  padding-bottom:14px;overscroll-behavior:contain}
.wqa-sticky-actions{flex:0 0 auto;align-items:center;
  background:var(--surface);border-top:1px solid var(--border);padding:11px 0 2px;margin-top:var(--wqa-s2)}
.wqa-foot-count{margin-right:auto;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--text-2)}
.wqa-foot-need{font-size:11px;font-weight:800;padding:2px 8px;border-radius:var(--pill-r);
  background:var(--amber-light);border:1px solid var(--amber-mid);color:var(--amber)}
.wqa-foot-need[hidden]{display:none}
/* ── Desktop ≥1024: the dialog earns its width, and the table spends it ───
   Quick Add was a 900px dialog holding a ten-column table, and the columns paid
   for it: values sat shoulder to shoulder, ACTIONS was clipped to "ACTI…", and
   an open row had no room that was not already spoken for. The dialog now takes
   the width the screen actually has, up to 1280px, and the tracks grow with it
   instead of handing every spare pixel to the badge column. It is written as
   min(): there is no width at which this rule can exceed the viewport, and
   everything below 1024px keeps the layout it already had. */
@media (min-width:1024px){
  .wqa-modal{
    width:min(1280px,calc(100vw - 64px));max-width:none;
    --wqa-lead: 44px minmax(86px,1fr);
    --wqa-dim:  minmax(92px,1.15fr);
    --wqa-dim-spec: minmax(240px,2.4fr);
    --wqa-tail: minmax(62px,.75fr) minmax(118px,1.15fr) minmax(104px,1.05fr)
                minmax(84px,1fr) 74px 34px;
  }
  /* One rhythm down the table: the same left edge for the header, the values
     and the metadata under them, and enough vertical room that neighbouring
     rows are told apart by space rather than only by the stripe. */
  .wqa-list-head,.wqa-sum{gap:0 var(--wqa-s3);padding-left:18px;padding-right:18px}
  .wqa-sum{padding-top:9px;padding-bottom:9px;min-height:48px}
  .wqa-list-head{padding-top:9px;padding-bottom:9px}
  .wqa-row-spec{padding:0 18px 10px 18px}
  .wqa-row-body{padding:14px 18px 16px}
  .wqa-bulk-head,.wqa-bulk .wqa-panel-head{padding-left:14px;padding-right:14px}
  .wqa-bulk .wqa-panel-body{padding:14px;max-width:1000px}
}

/* ── Tablet 600–1023: single-line tablet grid ─────────────────────────────
   The two-row item is gone: every value sits on ONE horizontal row, exactly as
   on desktop, so nothing looks high-low. That is achieved by narrowing the
   column variables and DELETING every tablet placement rule — the cells then
   fall into the same ten tracks in DOM order that desktop uses, which is also
   why the header and the rows can never disagree. */
@media (max-width:1023px){
  /*             #     Size          each dimension     Qty
                 Weight          Price         badges      Edit  ×          */
  .wqa-modal{
    --wqa-lead: 22px minmax(40px,52px);
    --wqa-dim:  minmax(46px,62px);
    --wqa-dim-spec: minmax(96px,1.4fr);
    --wqa-tail: minmax(30px,42px) minmax(80px,100px) minmax(56px,72px)
                minmax(0,1fr) 56px 24px;
    width:min(96vw,900px);          /* wide enough for one line, never overflowing */
  }
  .wqa-list-head,.wqa-sum{
    gap:0 6px;padding-left:8px;padding-right:8px;
    padding-top:5px;padding-bottom:5px;min-height:44px}
  .wqa-sum{font-size:12px}
  /* bare values — the header carries the meaning, and a variable-width label
     would break the alignment the columns exist to provide */
  .wqa-sum .wqa-c-dim::before,
  .wqa-sum .wqa-c-qty::before{content:none}
  .wqa-list-head{padding-top:6px;padding-bottom:6px;min-height:0}
  .wqa-list-head .wqa-h{line-height:1.35}
  /* ACTIONS had to be clipped to "ACTI…" to fit a tablet's track. It fits
     without the letter-spacing, so the label is shown whole instead. */
  .wqa-list-head .wqa-h-act{letter-spacing:0}
  /* the two empty header cells stay in the layout: hiding them would pull
     ACTIONS back a track and break alignment with the rows */
  .wqa-actions .btn{min-width:0;flex:1 1 auto}
}
/* ── Phone <600: tighter still ────────────────────────────────────────────── */
@media (max-width:599px){
  .wqa-modal{width:100%}
  /* No column header on a phone — the summary is its own shape there. */
  .wqa-list-head{display:none}
  .wqa-rows.has-head{border-top:1px solid var(--border);border-radius:var(--r-sm)}
  /* And no fixed tracks: a J Bolt has four dimensions where a Stud has one, and
     a layout that names its cells by column number can only be right for one of
     them. The summary wraps instead — number, size and dimensions on the first
     line, weight and price under them — which reads the same whatever the
     product turns out to be and cannot push the row sideways. */
  .wqa-sum{display:flex;flex-wrap:wrap;align-items:center;gap:3px 8px;
    font-size:12px;min-height:44px;padding-left:9px;padding-right:9px}
  .wqa-sum-no{flex:0 0 auto;min-width:16px;text-align:left}
  .wqa-sum .wqa-c{flex:0 1 auto;max-width:100%}
  .wqa-sum .wqa-c-w,.wqa-sum .wqa-c-price{flex:0 0 auto}
  .wqa-sum .wqa-c-price{margin-left:auto}
  .wqa-sum-act{flex:0 0 auto;order:8}
  .wqa-sum .wqa-row-del{flex:0 0 auto;order:9}
  .wqa-sum-badges{flex:1 1 100%;justify-content:flex-start;order:10}
  /* No header on a phone, so each dimension carries its own letter. */
  .wqa-sum .wqa-c-dim[data-lbl]::before{content:attr(data-lbl) ' ';
    font-weight:700;color:var(--text-muted)}
  .wqa-sum .wqa-c-qty::before{content:'×';font-weight:800;color:var(--text-muted)}
  .wqa-foot-count{flex:1 1 100%;margin-bottom:6px}
}

/* Additional info for analysis — deliberately light: one label, one line, one
   read-back. The upload card must not start looking like a form. */
.wqa-note{margin-top:11px}
.wqa-note-lbl{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
  font-size:12px;font-weight:800;color:var(--text-2);margin-bottom:5px}
.wqa-note-opt{font-size:11px;font-weight:650;color:var(--text-muted)}
.wqa-note-in{
  width:100%;border:1.5px solid var(--border);border-radius:var(--r-xs);background:var(--surface);
  padding:10px 11px;font-size:14px;font-family:inherit;color:var(--text);min-height:var(--control-h);
}
.wqa-note-in:focus{outline:none;border-color:var(--border-focus);box-shadow:0 0 0 3px var(--accent-light)}
.wqa-note-read{margin-top:6px;font-size:11.5px;font-weight:700;color:var(--accent-2);
  overflow-wrap:anywhere}
@media (hover:none) and (pointer:coarse){ .wqa-note-in{min-height:46px} }

/* Quick Add — AI photo / PDF upload (step 1) */
.wqa-method{display:flex;border:1.5px solid var(--border);border-radius:var(--r-sm);overflow:hidden;margin-bottom:11px}
.wqa-method-btn{flex:1;border:0;background:var(--surface2);font-family:inherit;font-size:12.5px;font-weight:800;
  padding:10px 12px;cursor:pointer;color:var(--text-muted);min-height:44px}
.wqa-method-btn.is-on{background:var(--accent-light);color:var(--accent-2)}
.wqa-method-btn+.wqa-method-btn{border-left:1.5px solid var(--border)}
.wqa-file-pick{display:flex;align-items:center;gap:11px;cursor:pointer;flex-wrap:wrap}
.wqa-file-pick input[type=file]{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}
.wqa-file-info{font-size:12.5px;font-weight:650;color:var(--text-2);overflow-wrap:anywhere}
.wqa-ai-preview{margin-top:10px}
.wqa-ai-preview img{max-height:160px;max-width:100%;border:1.5px solid var(--border);border-radius:var(--r-xs)}
/* Every author display rule below outranks the browser's own [hidden], which
   is how a PDF badge survived onto an image and how "Analyzing document…" sat
   under "No file selected". One rule, at ID strength, for the whole modal. */
#wqaModal [hidden]{display:none}
.wqa-ai-status{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:13px;font-weight:700;color:var(--text-2)}
.wqa-ai-status small{font-weight:600;color:var(--text-muted)}
.wqa-spinner{width:18px;height:18px;flex:0 0 auto;border:2.5px solid var(--accent-light);
  border-top-color:var(--accent);border-radius:50%;animation:wqaspin .8s linear infinite}
@keyframes wqaspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.wqa-spinner{animation:none}}
.wqa-ai-privacy{margin-top:10px;font-size:11px;font-weight:600;color:var(--text-muted)}

/* Quick Add — drag & drop upload zone (AI Quick Add V2.1) */
/* Input choice: two targets big enough for a thumb, one column on a phone. */
.wqa-choice{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wqa-choice-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  padding:22px 14px;border:1.5px solid var(--border);border-radius:var(--r-sm);background:var(--surface2);
  font-family:inherit;color:var(--text);cursor:pointer;min-height:104px}
.wqa-choice-btn:hover{border-color:var(--accent-mid);background:var(--surface)}
.wqa-choice-ico{font-size:22px;line-height:1}
.wqa-choice-lbl{font-size:13px;font-weight:800}
.wqa-back-btn{margin-right:auto}
@media (max-width:640px){ .wqa-choice{grid-template-columns:1fr} }
.wqa-drop{border:2px dashed var(--border);border-radius:var(--r-sm);background:var(--surface2);
  padding:20px 14px;text-align:center;transition:border-color .15s ease,background-color .15s ease}
.wqa-drop.is-drag{border-color:var(--accent);background:var(--accent-light)}
.wqa-drop.is-bad{border-color:var(--red)}
.wqa-drop-main{font-size:13.5px;font-weight:800;color:var(--text-2)}
.wqa-drop.is-drag .wqa-drop-main{color:var(--accent-2)}
.wqa-drop-or{font-size:11.5px;font-weight:700;color:var(--text-muted);margin:7px 0}
.wqa-drop-types{margin-top:10px;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.03em}
.wqa-drop .wqa-file-pick{justify-content:center}
.wqa-drop .wqa-file-info{display:block;margin-top:10px}
/* Children must not steal dragenter/dragleave from the zone. */
.wqa-drop.is-drag *{pointer-events:none}
.wqa-pdf-chip{display:inline-flex;align-items:center;gap:9px;padding:10px 13px;border:1.5px solid var(--border);
  border-radius:var(--r-xs);background:var(--surface2);font-size:12.5px;font-weight:700;color:var(--text-2);
  max-width:100%;overflow-wrap:anywhere}
.wqa-pdf-badge{flex:0 0 auto;padding:3px 7px;border-radius:4px;background:var(--red);color:#fff;
  font-size:10.5px;font-weight:800;letter-spacing:.04em}
@media (prefers-reduced-motion:reduce){.wqa-drop{transition:none}}

/* ── Language switch (EN / 中文) ──────────────────────────────────────────
   Two real buttons, never flags, and the labels themselves are never
   translated: "EN" and "中文" read the same in both modes, so a lost user can
   always find their way back. */
.lang-switch{display:inline-flex;border:1px solid rgba(255,255,255,.24);border-radius:var(--pill-r);
  overflow:hidden;flex-shrink:0}
.lang-btn{background:rgba(255,255,255,.14);border:0;color:#fff;font-family:inherit;font-size:12px;
  font-weight:700;padding:6px 11px;cursor:pointer;line-height:1;white-space:nowrap;
  transition:background .15s ease}
.lang-btn+.lang-btn{border-left:1px solid rgba(255,255,255,.24)}
.lang-btn:hover{background:rgba(255,255,255,.26)}
.lang-btn.is-on{background:#fff;color:var(--accent-2)}
.lang-btn:focus-visible{outline:2px solid #fff;outline-offset:-2px}
/* The header row is hidden below 820px, so the sidebar copy is the only way in
   on tablet and phone — it gets a full 44px touch target. */
.side-lang{display:flex;margin:2px 12px 12px;border:1.5px solid var(--border);
  border-radius:var(--r-sm);overflow:hidden}
.side-lang .lang-btn{flex:1;background:var(--surface2);color:var(--text-muted);
  min-height:44px;font-size:13px;border-left-color:var(--border)}
.side-lang .lang-btn:hover{background:var(--surface2);color:var(--text-2)}
.side-lang .lang-btn.is-on{background:var(--accent-light);color:var(--accent-2)}
.side-lang .lang-btn:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
@media (prefers-reduced-motion:reduce){.lang-btn{transition:none}}

/* Quick Add — "AI assisted" source badge. Informational only: muted text on a
   faint neutral chip, no warning colour, no border emphasis, and it never
   competes with the row badges beside it. */
.wqa-ai-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:var(--pill-r);
  background:var(--surface2);color:var(--text-muted);font-size:11px;font-weight:700;
  letter-spacing:.01em;white-space:nowrap;flex:0 0 auto}
.wqa-ai-badge[hidden]{display:none}

/* Quick Add — common Size / Thread panel */
.wqa-item-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:11px}
@media (max-width:560px){.wqa-item-grid{grid-template-columns:1fr}}
</style>
</head>
<body>

<!-- HEADER -->
<div class="app-header">
  <button class="hdr-burger" id="burgerBtn" onclick="toggleSidebar()">☰</button>
  <a class="hdr-brand" href="index.php" aria-label="Der-Cheng Quotation — home">
    <img class="hdr-logo" src="/assets/icons/icon-192.png" alt="" width="32" height="32" decoding="async">
    <div class="hdr-text">
      <h1>Der-Cheng Quotation</h1>
      <p data-i18n="brandSub">Quotation System · v2.24.0</p>
    </div>
  </a>
  <!-- Global nav: the same three destinations on both pages. Pricing Guide,
       Default Prices and Diameter Settings live in the sidebar and are not
       duplicated here. -->
  <div class="hdr-actions">
    <div class="lang-switch" role="group" data-i18n-aria="langAria" aria-label="Language">
      <button type="button" class="lang-btn" data-lang-set="en" aria-pressed="true"  onclick="dcSetLang('en')">EN</button>
      <button type="button" class="lang-btn" data-lang-set="zh" aria-pressed="false" onclick="dcSetLang('zh')">中文</button>
    </div>
    <a class="hdr-btn is-active" href="index.php" aria-current="page" data-i18n="navCalculator">Calculator</a>
    <a class="hdr-btn" href="companies.php" data-i18n="navCompanies">Companies</a>
    <a class="hdr-btn is-secondary" href="logout.php" data-i18n-title="navSignOutTitle" title="Sign out on this device only" data-i18n="navSignOut">Sign Out</a>
  </div>
</div>

<div class="sidebar-backdrop" id="sideBackdrop" onclick="toggleSidebar()"></div>

<div class="app-shell">
  <!-- SIDEBAR -->
  <aside class="sidebar" id="sidebar">
    <div class="side-section-title" data-i18n="sideQuickMenu">Quick Menu</div>
    <div class="side-nav">
      <button class="side-link" onclick="startNewQuotation();toggleSidebar(false)"><span class="side-link-inner" data-i18n="sideNewQuotation">New Quotation</span></button>
      <a class="side-link" href="companies.php"><span class="side-link-inner" data-i18n="sideCompanies">Companies / Saved</span></a>
      <button class="side-link" onclick="openDPModal();toggleSidebar(false)"><span class="side-link-inner" data-i18n="sideDefaultPrices">Default Prices</span></button>
      <button class="side-link" onclick="openDSModal();toggleSidebar(false)"><span class="side-link-inner" data-i18n="sideDiameterSettings">Diameter Settings</span></button>
      <button class="side-link" onclick="openRefModal();toggleSidebar(false)"><span class="side-link-inner" data-i18n="sidePricingGuide">Pricing Guide</span></button>
      <button class="side-link" onclick="openModal('versionUpdatesModal');toggleSidebar(false)"><span class="side-link-inner" data-i18n="sideVersionUpdates">Version Updates</span></button>
      <a class="side-link" href="logout.php"><span class="side-link-inner" data-i18n="navSignOut">Sign Out</span></a>
    </div>
    <!-- The header switch is hidden below 820px; this is the tablet/phone route. -->
    <div class="side-section-title" data-i18n="language">Language</div>
    <div class="side-lang" role="group" data-i18n-aria="langAria" aria-label="Language">
      <button type="button" class="lang-btn" data-lang-set="en" aria-pressed="true"  onclick="dcSetLang('en')">EN</button>
      <button type="button" class="lang-btn" data-lang-set="zh" aria-pressed="false" onclick="dcSetLang('zh')">中文</button>
    </div>
  </aside>

  <!-- MAIN -->
  <main class="main">

    <!-- Workflow Stepper -->
    <div class="stepper" id="stepper">
      <button class="step-pill" data-step="1" onclick="goToStep(1)"><span class="step-num">1</span><span class="step-label" data-i18n="step1">Customer</span></button>
      <div class="step-line"></div>
      <button class="step-pill" data-step="2" onclick="goToStep(2)"><span class="step-num">2</span><span class="step-label" data-i18n="step2">Add Items</span></button>
      <div class="step-line"></div>
      <button class="step-pill" data-step="3" onclick="goToStep(3)"><span class="step-num">3</span><span class="step-label" data-i18n="step3">Review &amp; Save</span></button>
      <div class="step-line"></div>
      <button class="step-pill" data-step="4" onclick="goToStep(4)"><span class="step-num">4</span><span class="step-label" data-i18n="step4">Print / WhatsApp</span></button>
    </div>

    <!-- Quick Open: paste a quotation number and press Enter -->
    <div class="card qo-card">
      <label class="qo-label" for="qoInput" data-i18n="quickOpen">Quick Open</label>
      <div class="qo-row">
        <input type="text" id="qoInput" class="qo-input" placeholder="Q-2026-0001"
               inputmode="text" autocomplete="off" autocapitalize="characters"
               autocorrect="off" spellcheck="false" enterkeyhint="go"
               data-i18n-aria="ariaQuotationNo" aria-label="Quotation number"
               onkeydown="if(event.key==='Enter'){event.preventDefault();quickOpen();}">
        <button type="button" class="btn btn-primary qo-btn" id="qoBtn" onclick="quickOpen()" data-i18n="open">Open</button>
      </div>
      <div class="qo-result" id="qoResult" hidden></div>
    </div>

    <!-- Step 1: Customer -->
    <div class="card summary-card" id="step1Card">
      <div class="summary-topline">
        <div>
          <div class="step-caption" style="margin-bottom:0" data-i18n="step1Caption">Step 1 · Customer</div>
          <span class="step-caption-sub" data-i18n="step1Sub">Customer details</span>
        </div>
        <button class="btn btn-danger btn-sm" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="startNewQuotation()" data-i18n="newQuotation">New Quotation</button>
      </div>
      <div class="qi-compact" onclick="toggleQIEdit()">
        <div class="summary-ava" aria-hidden="true">👤</div>
        <div class="qi-compact-main">
          <div class="nm" id="qiName">No customer yet</div>
          <div class="meta summary-meta">
            <span class="sum-chip" id="qiRefDisp">Quotation No. —</span>
            <span class="sum-chip" id="qiDateDisp">Date —</span>
          </div>
          <div class="quote-status-row">
            <span class="quote-status-badge draft" id="quoteStatusBadge">New Draft</span>
          </div>
        </div>
        <div class="qi-action-stack">
          <button class="btn btn-outline btn-sm" type="button" id="unlockSavedBtn" style="display:none" onclick="event.stopPropagation();unlockSavedQuotation()" data-i18n="editSavedQuotation">Edit Saved Quotation</button>
          <button class="btn btn-outline btn-sm" type="button" id="qiToggleBtn" onclick="event.stopPropagation();toggleQIEdit()" data-i18n="editDetails">Edit Details</button>
        </div>
      </div>
      <div class="locked-notice" id="lockedNoticePanel">
        <div>
          <div class="locked-notice-title" data-i18n="lockedTitle">This quotation is locked.</div>
          <div class="locked-notice-text" data-i18n="lockedText">Editing requires unlocking.</div>
        </div>
        <button class="btn btn-unlock-primary btn-sm" type="button" onclick="unlockSavedQuotation()" data-i18n="editSavedQuotation">Edit Saved Quotation</button>
      </div>
      <div class="qi-edit" id="qiEdit">
        <div class="field full" style="position:relative">
          <label data-i18n="lblCustomerName">Customer Name</label>
          <input type="text" id="qi-customer" data-i18n-ph="phCustomerName" placeholder="Select or type customer name" autocomplete="off"
                 oninput="onCustomerInput()" onkeydown="onCustomerKeydown(event)" onblur="onCustomerBlur()">
          <div class="ac-dropdown" id="acDropdown"></div>
        </div>
        <div class="field"><label data-i18n="lblContactPhone">Contact / Phone</label><input type="text" id="qi-phone" data-i18n-ph="phContactNumber" placeholder="Contact number" oninput="syncQI()"></div>
        <div class="field"><label data-i18n="lblQuotationNo">Quotation No.</label><input type="text" id="qi-refno" readonly data-i18n-ph="phAutoGenerated" placeholder="Auto-generated"></div>
        <div class="field"><label data-i18n="lblDate">Date</label><input type="date" id="qi-date" oninput="syncQI()"></div>
        <div class="field"><label data-i18n="lblPreparedBy">Prepared By</label><input type="text" id="qi-prepby" data-i18n-ph="phPreparedBy" placeholder="Prepared by" oninput="syncQI()"></div>
        <div class="field full"><label data-i18n="lblIssuedBy">Issued By</label>
          <select id="qi-issued-by" onchange="scheduleDraftAutosave()">
            <option value="" data-i18n="optNoCompanyHeader">— No company header —</option>
            <option value="DER-CHENG FASTENER SDN. BHD.">DER-CHENG FASTENER SDN. BHD.</option>
            <option value="DNC HARDWARE SDN. BHD.">DNC HARDWARE SDN. BHD.</option>
            <option value="EVERTOP HARDWARE TRADING">EVERTOP HARDWARE TRADING</option>
          </select>
        </div>
        <div class="field full"><label data-i18n="lblRemarks">Remarks / Notes</label><input type="text" id="qi-remarks" data-i18n-ph="phRemarks" placeholder="Price subject to change without prior notice" oninput="syncQI()"></div>
      </div>
    </div>

    <div class="two-col">
      <!-- LEFT: Item Entry -->
      <div class="card" id="step2Card">
        <div class="card-head">
          <div>
            <div class="step-caption" data-i18n="step2Caption">Step 2 · Add Items</div>
            <span class="step-caption-sub" data-i18n="step2Sub">Add items</span>
            <div class="card-title" data-i18n="itemEntry">Item Entry</div>
          </div>
        </div>

        <button type="button" class="btn btn-outline wqa-open-btn" onclick="wqaOpen()">
          <span class="wqa-open-ico">💬</span> WhatsApp Quick Add
          <span class="wqa-open-sub"><span data-i18n="wqaOpenSub">Paste customer text · Sag Rod / Stud / Anchor Bolt</span></span>
        </button>

        <div class="group-label full" style="margin-bottom:8px" data-i18n="productEntry">Product Entry</div>
        <div class="type-picker" id="typePicker">
          <button class="type-btn active" data-type="sagrod" onclick="switchType('sagrod')"><span class="t-name">Sag Rod</span></button>
          <button class="type-btn" data-type="stud" onclick="switchType('stud')"><span class="t-name">Stud</span></button>
          <button class="type-btn" data-type="anchorbolt" onclick="switchType('anchorbolt')"><span class="t-name">Anchor Bolt</span></button>
          <button class="type-btn" data-type="ubolt" onclick="switchType('ubolt')"><span class="t-name">U-Bolt</span></button>
          <button class="type-btn" data-type="squbolt" onclick="switchType('squbolt')"><span class="t-name">SQ U-Bolt</span></button>
          <button class="type-btn" data-type="lbolt" onclick="switchType('lbolt')"><span class="t-name">L Bolt</span></button>
          <button class="type-btn" data-type="lbolt45" onclick="switchType('lbolt45')"><span class="t-name">L Bolt 45DEG</span></button>
          <button class="type-btn" data-type="jbolt" onclick="switchType('jbolt')"><span class="t-name">J Bolt</span></button>
          <button class="type-btn" data-type="plate" onclick="switchType('plate')"><span class="t-name">Plate<span style="display:block;font-size:10.5px;opacity:.65;font-weight:600" data-i18n="glossPlate"></span></span></button>
          <button class="type-btn" data-type="was" onclick="switchType('was')"><span class="t-name">Welding Anchor Set<span class="was-type-zh" data-i18n="glossWAS"></span></span></button>
          <button class="type-btn" data-type="others" onclick="switchType('others')"><span class="t-name">Others / Special Bolt<span class="was-type-zh" data-i18n="glossOthers"></span></span></button>
        </div>

        <!-- SAG ROD -->
        <div class="item-form active" id="form-sagrod" data-type="sagrod">
          <div class="field"><label data-i18n="lblMaterial">Material</label>
            <select id="sagrod-material" onchange="onMaterialSizeChange('sagrod',false,'material')">
              <option value="MS">MS</option><option value="S45C">S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option>
              <option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option>
            </select></div>
          <div class="field"><label data-i18n="lblSizeType">Size Type</label>
            <select id="sagrod-sizeType" onchange="onMaterialSizeChange('sagrod')">
              <option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option>
            </select></div>
          <div class="field"><label data-i18n="lblSize">Size</label><input type="text" id="sagrod-size" list="sizeOptions" value="M12" autocomplete="off" oninput="onSizeInput('sagrod')"></div>
          <div class="field full"><label data-i18n="lblFinish">Finish</label>
            <div class="finish-pills" id="sagrod-finishPills">
              <label class="finish-pill selected-NA" id="sagrod-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="sagrod-finish" value="" onchange="onFinishChange('sagrod')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="sagrod-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="sagrod-finish" value="PL" checked onchange="onFinishChange('sagrod')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="sagrod-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="sagrod-finish" value="ZP" onchange="onFinishChange('sagrod')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="sagrod-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="sagrod-finish" value="HDG" onchange="onFinishChange('sagrod')"><span class="fp-code">HDG</span></label>
            </div></div>
          <div class="group-label full" data-i18n="dimensionEntry">Dimension Entry</div>
          <div class="field"><label data-i18n="lblDiameter">Diameter</label><input type="number" id="sagrod-diameter" step="0.1" value="10.6" oninput="calcSagRod()"></div>
          <div class="field"><label data-i18n="lblLengthMmParen">Length (mm)</label><input type="number" id="sagrod-length" min="1" data-i18n-ph="phEnterLength" placeholder="Enter length" oninput="calcSagRod()" onkeydown="if(event.key==='Enter'){event.preventDefault();addSagRod();}"><span style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-top:3px"><span data-i18n="pressEnterToAdd">Press Enter to add</span></span></div>
          <div class="field"><label data-i18n="lblThreadLength">Thread Length</label><input type="text" id="sagrod-threadLen" data-i18n-ph="phEnterThreadLength" placeholder="Enter thread length" oninput="onThreadLenChange('sagrod')"></div>
          <button type="button" class="acc-toggle-btn full" id="sagrod-accToggle" onclick="toggleAccPanel('sagrod')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="sagrod-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="sagrod-nutEnabled"><input type="checkbox" id="sagrod-nutEnabled" onchange="onAccChange('sagrod')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="sagrod-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('sagrod')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="sagrod-nutFinish" disabled onchange="onAccChange('sagrod')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="sagrod-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('sagrod')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="sagrod-fwEnabled"><input type="checkbox" id="sagrod-fwEnabled" onchange="onAccChange('sagrod')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="sagrod-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('sagrod')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="sagrod-fwFinish" disabled onchange="onAccChange('sagrod')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="sagrod-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('sagrod')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="sagrod-customEnabled"><input type="checkbox" id="sagrod-customEnabled" onchange="onAccChange('sagrod')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="sagrod-customText" data-i18n-ph="phCwWording" placeholder="Enter c/w wording" disabled oninput="onAccChange('sagrod')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="sagrod-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('sagrod')"></div>
              </div>
            </div>
          </div>
          <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
          <div class="field"><label data-i18n="lblCostRate">Cost Rate</label><input type="text" class="hl" id="sagrod-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcSagRod()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('sagrod','costRate');}"></div>
          <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="text" class="hl" id="sagrod-addCost" placeholder="0.00" oninput="calcSagRod()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('sagrod','addCost');}"></div>
          <div class="field"><label data-i18n="lblMarkup">Markup</label><input type="number" id="sagrod-markup" placeholder="0" min="0" oninput="calcSagRod()"></div>
          <div class="field"><label data-i18n="lblQTY">QTY</label><input type="number" id="sagrod-qty" value="1" min="1" step="1"></div>
          <div class="warn-note full" id="sagrod-warn" style="display:none">Rate not set for this material. Enter Cost Rate manually. Do not calculate as RM0.</div>
        </div>

        <!-- STUD -->
        <div class="item-form" id="form-stud" data-type="stud">
          <div class="field"><label data-i18n="lblMaterial">Material</label>
            <select id="stud-material" onchange="onMaterialSizeChange('stud',false,'material')">
              <option value="MS">MS</option><option value="S45C">S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option>
              <option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option>
            </select></div>
          <div class="field"><label data-i18n="lblSize">Size</label><input type="text" id="stud-size" list="sizeOptions" value="M12" autocomplete="off" oninput="onStudSizeInput()"></div>
          <div class="field full finish-field"><label data-i18n="lblFinish">Finish</label>
            <div class="finish-pills" id="stud-finishPills">
              <label class="finish-pill selected-NA" id="stud-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="stud-finish" value="" onchange="onFinishChange('stud')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="stud-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="stud-finish" value="PL" checked onchange="onFinishChange('stud')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="stud-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="stud-finish" value="ZP" onchange="onFinishChange('stud')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="stud-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="stud-finish" value="HDG" onchange="onFinishChange('stud')"><span class="fp-code">HDG</span></label>
            </div></div>
          <div class="group-label full" data-i18n="dimensionEntry">Dimension Entry</div>
          <div class="field"><label data-i18n="lblDiameter">Diameter</label><input type="number" id="stud-diameter" step="0.1" value="10.6" oninput="calcStud()"></div>
          <div class="field"><label>L</label><input type="number" id="stud-l" min="1" data-i18n-ph="phEnterLength" placeholder="Enter length" oninput="calcStud()" onkeydown="if(event.key==='Enter'){event.preventDefault();addStud();}"><span style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-top:3px"><span data-i18n="pressEnterToAdd">Press Enter to add</span></span></div>
          <button type="button" class="acc-toggle-btn full" id="stud-accToggle" onclick="toggleAccPanel('stud')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="stud-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="stud-nutEnabled"><input type="checkbox" id="stud-nutEnabled" onchange="onAccChange('stud')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="stud-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('stud')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="stud-nutFinish" disabled onchange="onAccChange('stud')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="stud-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('stud')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="stud-fwEnabled"><input type="checkbox" id="stud-fwEnabled" onchange="onAccChange('stud')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="stud-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('stud')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="stud-fwFinish" disabled onchange="onAccChange('stud')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="stud-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('stud')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="stud-customEnabled"><input type="checkbox" id="stud-customEnabled" onchange="onAccChange('stud')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="stud-customText" data-i18n-ph="phCwWording" placeholder="Enter c/w wording" disabled oninput="onAccChange('stud')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="stud-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('stud')"></div>
              </div>
            </div>
          </div>
          <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
          <div class="field"><label data-i18n="lblCostRate">Cost Rate</label><input type="text" class="hl" id="stud-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcStud()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('stud','costRate');}"></div>
          <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="text" class="hl" id="stud-addCost" placeholder="0.00" oninput="calcStud()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('stud','addCost');}"></div>
          <div class="field"><label data-i18n="lblMarkup">Markup</label><input type="number" id="stud-markup" placeholder="0" min="0" oninput="calcStud()"></div>
          <div class="field"><label data-i18n="lblQTY">QTY</label><input type="number" id="stud-qty" value="1" min="1" step="1"></div>
          <div class="warn-note full" id="stud-warn" style="display:none">Rate not set for this material. Enter Cost Rate manually. Do not calculate as RM0.</div>
        </div>

        <!-- ANCHOR BOLT -->
        <div class="item-form" id="form-anchorbolt" data-type="anchorbolt">
          <div class="field"><label data-i18n="lblMaterial">Material</label>
            <select id="anchorbolt-material" onchange="onMaterialSizeChange('anchorbolt',false,'material')">
              <option value="MS">MS</option><option value="S45C">S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option>
              <option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option>
            </select></div>
          <div class="field"><label data-i18n="lblSizeType">Size Type</label>
            <select id="anchorbolt-sizeType" onchange="onMaterialSizeChange('anchorbolt')">
              <option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option>
            </select></div>
          <div class="field"><label data-i18n="lblSize">Size</label><input type="text" id="anchorbolt-size" list="sizeOptions" value="M12" autocomplete="off" oninput="onSizeInput('anchorbolt')"></div>
          <div class="field full finish-field"><label data-i18n="lblFinish">Finish</label>
            <div class="finish-pills" id="anchorbolt-finishPills">
              <label class="finish-pill selected-NA" id="anchorbolt-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="anchorbolt-finish" value="" onchange="onFinishChange('anchorbolt')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="anchorbolt-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="anchorbolt-finish" value="PL" checked onchange="onFinishChange('anchorbolt')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="anchorbolt-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="anchorbolt-finish" value="ZP" onchange="onFinishChange('anchorbolt')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="anchorbolt-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="anchorbolt-finish" value="HDG" onchange="onFinishChange('anchorbolt')"><span class="fp-code">HDG</span></label>
            </div></div>
          <div class="group-label full" data-i18n="dimensionEntry">Dimension Entry</div>
          <div class="field"><label data-i18n="lblDiameter">Diameter</label><input type="number" id="anchorbolt-diameter" step="0.1" value="10.6" oninput="calcAnchorBolt()"></div>
          <div class="field"><label>L</label><input type="number" id="anchorbolt-l" min="1" data-i18n-ph="phEnterLength" placeholder="Enter length" oninput="calcAnchorBolt()" onkeydown="if(event.key==='Enter'){event.preventDefault();addAnchorBolt();}"><span style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-top:3px"><span data-i18n="pressEnterToAdd">Press Enter to add</span></span></div>
          <div class="field"><label>TL</label><input type="text" id="anchorbolt-threadLen" data-i18n-ph="phEnterThreadLength" placeholder="Enter thread length"></div>
          <button type="button" class="acc-toggle-btn full" id="anchorbolt-accToggle" onclick="toggleAccPanel('anchorbolt')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="anchorbolt-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="anchorbolt-nutEnabled"><input type="checkbox" id="anchorbolt-nutEnabled" onchange="onAccChange('anchorbolt')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="anchorbolt-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('anchorbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="anchorbolt-nutFinish" disabled onchange="onAccChange('anchorbolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="anchorbolt-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('anchorbolt')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="anchorbolt-fwEnabled"><input type="checkbox" id="anchorbolt-fwEnabled" onchange="onAccChange('anchorbolt')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="anchorbolt-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('anchorbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="anchorbolt-fwFinish" disabled onchange="onAccChange('anchorbolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="anchorbolt-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('anchorbolt')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="anchorbolt-customEnabled"><input type="checkbox" id="anchorbolt-customEnabled" onchange="onAccChange('anchorbolt')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="anchorbolt-customText" data-i18n-ph="phCwWording" placeholder="Enter c/w wording" disabled oninput="onAccChange('anchorbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="anchorbolt-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('anchorbolt')"></div>
              </div>
            </div>
          </div>
          <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
          <div class="field"><label data-i18n="lblCostRate">Cost Rate</label><input type="text" class="hl" id="anchorbolt-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcAnchorBolt()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('anchorbolt','costRate');}"></div>
          <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="text" class="hl" id="anchorbolt-addCost" placeholder="0.00" oninput="calcAnchorBolt()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('anchorbolt','addCost');}"></div>
          <div class="field"><label data-i18n="lblMarkup">Markup</label><input type="number" id="anchorbolt-markup" placeholder="0" min="0" oninput="calcAnchorBolt()"></div>
          <div class="field"><label data-i18n="lblQTY">QTY</label><input type="number" id="anchorbolt-qty" value="1" min="1" step="1"></div>
          <div class="warn-note full" id="anchorbolt-warn" style="display:none">Rate not set for this material. Enter Cost Rate manually. Do not calculate as RM0.</div>
        </div>

        <!-- U-BOLT -->
        <div class="item-form" id="form-ubolt" data-type="ubolt">
          <div class="field"><label data-i18n="lblMaterial">Material</label><select id="ubolt-material" onchange="onMaterialSizeChange('ubolt',false,'material')"><option value="MS">MS</option><option value="S45C">S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option><option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option></select></div>
          <div class="field"><label data-i18n="lblSizeType">Size Type</label><select id="ubolt-sizeType" onchange="onMaterialSizeChange('ubolt')"><option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option></select></div>
          <div class="field"><label data-i18n="lblSize">Size</label><input type="text" id="ubolt-size" list="sizeOptions" value="M12" autocomplete="off" oninput="onSizeInput('ubolt')"></div>
          <div class="field full"><label data-i18n="lblFinish">Finish</label>
            <div class="finish-pills" id="ubolt-finishPills">
              <label class="finish-pill selected-NA" id="ubolt-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="ubolt-finish" value="" onchange="onFinishChange('ubolt')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="ubolt-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="ubolt-finish" value="PL" checked onchange="onFinishChange('ubolt')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="ubolt-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="ubolt-finish" value="ZP" onchange="onFinishChange('ubolt')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="ubolt-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="ubolt-finish" value="HDG" onchange="onFinishChange('ubolt')"><span class="fp-code">HDG</span></label>
            </div></div>
          <div class="group-label full" data-i18n="dimensionEntry">Dimension Entry</div>
          <div class="field"><label data-i18n="lblDiameter">Diameter</label><input type="number" id="ubolt-diameter" step="0.1" oninput="calcUBolt('ubolt')"></div>
          <div class="field"><label>ID</label><input type="number" id="ubolt-id" placeholder="50" step="0.1" oninput="calcUBolt('ubolt')"></div>
          <div class="field"><label>IH</label><input type="number" id="ubolt-ih" placeholder="60" step="0.1" oninput="calcUBolt('ubolt')"></div>
          <div class="field"><label data-i18n="lblThreadLength">Thread Length</label><input type="text" id="ubolt-threadLen" data-i18n-ph="phEnterThreadLength" placeholder="Enter thread length" oninput="calcUBolt('ubolt',true)"></div>
          <div class="field"><label data-i18n="lblTotalLength">Total Length</label><input type="number" id="ubolt-length" data-i18n-ph="phAutoCalculated" placeholder="Auto calculated" oninput="calcUBolt('ubolt',true)"></div>
          <button type="button" class="acc-toggle-btn full" id="ubolt-accToggle" onclick="toggleAccPanel('ubolt')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="ubolt-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="ubolt-nutEnabled"><input type="checkbox" id="ubolt-nutEnabled" onchange="onAccChange('ubolt')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="ubolt-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('ubolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="ubolt-nutFinish" disabled onchange="onAccChange('ubolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="ubolt-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('ubolt')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="ubolt-fwEnabled"><input type="checkbox" id="ubolt-fwEnabled" onchange="onAccChange('ubolt')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="ubolt-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('ubolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="ubolt-fwFinish" disabled onchange="onAccChange('ubolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="ubolt-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('ubolt')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="ubolt-customEnabled"><input type="checkbox" id="ubolt-customEnabled" onchange="onAccChange('ubolt')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="ubolt-customText" data-i18n-ph="phCwWording" placeholder="Enter c/w wording" disabled oninput="onAccChange('ubolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="ubolt-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('ubolt')"></div>
              </div>
            </div>
          </div>
          <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
          <div class="field"><label data-i18n="lblCostRate">Cost Rate</label><input type="text" class="hl" id="ubolt-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcUBolt('ubolt',true)" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('ubolt','costRate');}"></div>
          <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="text" class="hl" id="ubolt-addCost" placeholder="0.00" oninput="calcUBolt('ubolt',true)" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('ubolt','addCost');}"></div>
          <div class="field"><label data-i18n="lblMarkup">Markup</label><input type="number" id="ubolt-markup" placeholder="0" min="0" oninput="calcUBolt('ubolt',true)"></div>
          <div class="field"><label data-i18n="lblQTY">QTY</label><input type="number" id="ubolt-qty" value="1" min="1" step="1"></div>
          <div class="warn-note full" id="ubolt-warn">Cost Rate must be entered manually for this product type.</div>
        </div>

        <!-- SQ U-BOLT -->
        <div class="item-form" id="form-squbolt" data-type="squbolt">
          <div class="field"><label data-i18n="lblMaterial">Material</label><select id="squbolt-material" onchange="onMaterialSizeChange('squbolt',false,'material')"><option value="MS">MS</option><option value="S45C">S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option><option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option></select></div>
          <div class="field"><label data-i18n="lblSizeType">Size Type</label><select id="squbolt-sizeType" onchange="onMaterialSizeChange('squbolt')"><option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option></select></div>
          <div class="field"><label data-i18n="lblSize">Size</label><input type="text" id="squbolt-size" list="sizeOptions" value="M12" autocomplete="off" oninput="onSizeInput('squbolt')"></div>
          <div class="field full"><label data-i18n="lblFinish">Finish</label>
            <div class="finish-pills" id="squbolt-finishPills">
              <label class="finish-pill selected-NA" id="squbolt-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="squbolt-finish" value="" onchange="onFinishChange('squbolt')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="squbolt-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="squbolt-finish" value="PL" checked onchange="onFinishChange('squbolt')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="squbolt-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="squbolt-finish" value="ZP" onchange="onFinishChange('squbolt')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="squbolt-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="squbolt-finish" value="HDG" onchange="onFinishChange('squbolt')"><span class="fp-code">HDG</span></label>
            </div></div>
          <div class="group-label full" data-i18n="dimensionEntry">Dimension Entry</div>
          <div class="field"><label data-i18n="lblDiameter">Diameter</label><input type="number" id="squbolt-diameter" step="0.1" oninput="calcSQUBolt('squbolt')"></div>
          <div class="field"><label>OH</label><input type="number" id="squbolt-oh" placeholder="100" step="0.1" oninput="calcSQUBolt('squbolt')"></div>
          <div class="field"><label>W</label><input type="number" id="squbolt-w" placeholder="150" step="0.1" oninput="calcSQUBolt('squbolt')"></div>
          <div class="field"><label data-i18n="lblThreadLength">Thread Length</label><input type="text" id="squbolt-threadLen" data-i18n-ph="phEnterThreadLength" placeholder="Enter thread length"></div>
          <div class="field"><label data-i18n="lblTotalLength">Total Length</label><input type="number" id="squbolt-length" data-i18n-ph="phAutoCalculated" placeholder="Auto calculated" oninput="calcSQUBolt('squbolt',true)"></div>
          <button type="button" class="acc-toggle-btn full" id="squbolt-accToggle" onclick="toggleAccPanel('squbolt')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="squbolt-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="squbolt-nutEnabled"><input type="checkbox" id="squbolt-nutEnabled" onchange="onAccChange('squbolt')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="squbolt-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('squbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="squbolt-nutFinish" disabled onchange="onAccChange('squbolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="squbolt-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('squbolt')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="squbolt-fwEnabled"><input type="checkbox" id="squbolt-fwEnabled" onchange="onAccChange('squbolt')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="squbolt-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('squbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="squbolt-fwFinish" disabled onchange="onAccChange('squbolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="squbolt-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('squbolt')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="squbolt-customEnabled"><input type="checkbox" id="squbolt-customEnabled" onchange="onAccChange('squbolt')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="squbolt-customText" data-i18n-ph="phCwWording" placeholder="Enter c/w wording" disabled oninput="onAccChange('squbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="squbolt-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('squbolt')"></div>
              </div>
            </div>
          </div>
          <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
          <div class="field"><label data-i18n="lblCostRate">Cost Rate</label><input type="text" class="hl" id="squbolt-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcSQUBolt('squbolt',true)" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('squbolt','costRate');}"></div>
          <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="text" class="hl" id="squbolt-addCost" placeholder="0.00" oninput="calcSQUBolt('squbolt',true)" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('squbolt','addCost');}"></div>
          <div class="field"><label data-i18n="lblMarkup">Markup</label><input type="number" id="squbolt-markup" placeholder="0" min="0" oninput="calcSQUBolt('squbolt',true)"></div>
          <div class="field"><label data-i18n="lblQTY">QTY</label><input type="number" id="squbolt-qty" value="1" min="1" step="1"></div>
          <div class="warn-note full" id="squbolt-warn">Cost Rate must be entered manually for this product type.</div>
        </div>

        <!-- L BOLT -->
        <div class="item-form" id="form-lbolt" data-type="lbolt">
          <div class="field"><label data-i18n="lblMaterial">Material</label><select id="lbolt-material" onchange="onMaterialSizeChange('lbolt',false,'material')"><option value="MS">MS</option><option value="S45C">S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option><option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option></select></div>
          <div class="field"><label data-i18n="lblSizeType">Size Type</label><select id="lbolt-sizeType" onchange="onMaterialSizeChange('lbolt')"><option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option></select></div>
          <div class="field"><label data-i18n="lblSize">Size</label><input type="text" id="lbolt-size" list="sizeOptions" value="M12" autocomplete="off" oninput="onSizeInput('lbolt')"></div>
          <div class="field full"><label data-i18n="lblFinish">Finish</label>
            <div class="finish-pills" id="lbolt-finishPills">
              <label class="finish-pill selected-NA" id="lbolt-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="lbolt-finish" value="" onchange="onFinishChange('lbolt')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="lbolt-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="lbolt-finish" value="PL" checked onchange="onFinishChange('lbolt')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="lbolt-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="lbolt-finish" value="ZP" onchange="onFinishChange('lbolt')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="lbolt-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="lbolt-finish" value="HDG" onchange="onFinishChange('lbolt')"><span class="fp-code">HDG</span></label>
            </div></div>
          <div class="group-label full" data-i18n="dimensionEntry">Dimension Entry</div>
          <div class="field"><label data-i18n="lblDiameter">Diameter</label><input type="number" id="lbolt-diameter" step="0.1" oninput="calcLBolt('lbolt')"></div>
          <div class="field"><label>L</label><input type="number" id="lbolt-l" placeholder="500" step="0.1" oninput="calcLBolt('lbolt')"></div>
          <div class="field"><label>W</label><input type="number" id="lbolt-w" placeholder="100" step="0.1" oninput="calcLBolt('lbolt')"></div>
          <div class="field"><label data-i18n="lblThreadLength">Thread Length</label><input type="text" id="lbolt-threadLen" data-i18n-ph="phEnterThreadLength" placeholder="Enter thread length"></div>
          <div class="field"><label data-i18n="lblTotalLength">Total Length</label><input type="number" id="lbolt-length" data-i18n-ph="phAutoCalculated" placeholder="Auto calculated" oninput="calcLBolt('lbolt',true)"></div>
          <button type="button" class="acc-toggle-btn full" id="lbolt-accToggle" onclick="toggleAccPanel('lbolt')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="lbolt-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="lbolt-nutEnabled"><input type="checkbox" id="lbolt-nutEnabled" onchange="onAccChange('lbolt')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="lbolt-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('lbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="lbolt-nutFinish" disabled onchange="onAccChange('lbolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="lbolt-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('lbolt')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="lbolt-fwEnabled"><input type="checkbox" id="lbolt-fwEnabled" onchange="onAccChange('lbolt')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="lbolt-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('lbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="lbolt-fwFinish" disabled onchange="onAccChange('lbolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="lbolt-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('lbolt')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="lbolt-customEnabled"><input type="checkbox" id="lbolt-customEnabled" onchange="onAccChange('lbolt')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="lbolt-customText" data-i18n-ph="phCwWording" placeholder="Enter c/w wording" disabled oninput="onAccChange('lbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="lbolt-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('lbolt')"></div>
              </div>
            </div>
          </div>
          <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
          <div class="field"><label data-i18n="lblCostRate">Cost Rate</label><input type="text" class="hl" id="lbolt-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcLBolt('lbolt',true)" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('lbolt','costRate');}"></div>
          <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="text" class="hl" id="lbolt-addCost" placeholder="0.00" oninput="calcLBolt('lbolt',true)" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('lbolt','addCost');}"></div>
          <div class="field"><label data-i18n="lblMarkup">Markup</label><input type="number" id="lbolt-markup" placeholder="0" min="0" oninput="calcLBolt('lbolt',true)"></div>
          <div class="field"><label data-i18n="lblQTY">QTY</label><input type="number" id="lbolt-qty" value="1" min="1" step="1"></div>
          <div class="warn-note full" id="lbolt-warn">Cost Rate must be entered manually for this product type.</div>
        </div>

        <!-- J BOLT -->
        <div class="item-form" id="form-jbolt" data-type="jbolt">
          <div class="field"><label data-i18n="lblMaterial">Material</label><select id="jbolt-material" onchange="onMaterialSizeChange('jbolt',false,'material')"><option value="MS">MS</option><option value="S45C">S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option><option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option></select></div>
          <div class="field"><label data-i18n="lblSizeType">Size Type</label><select id="jbolt-sizeType" onchange="onMaterialSizeChange('jbolt')"><option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option></select></div>
          <div class="field"><label data-i18n="lblSize">Size</label><input type="text" id="jbolt-size" list="sizeOptions" value="M12" autocomplete="off" oninput="onSizeInput('jbolt')"></div>
          <div class="field full"><label data-i18n="lblFinish">Finish</label>
            <div class="finish-pills" id="jbolt-finishPills">
              <label class="finish-pill selected-NA" id="jbolt-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="jbolt-finish" value="" onchange="onFinishChange('jbolt')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="jbolt-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="jbolt-finish" value="PL" checked onchange="onFinishChange('jbolt')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="jbolt-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="jbolt-finish" value="ZP" onchange="onFinishChange('jbolt')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="jbolt-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="jbolt-finish" value="HDG" onchange="onFinishChange('jbolt')"><span class="fp-code">HDG</span></label>
            </div></div>
          <div class="group-label full" data-i18n="dimensionEntry">Dimension Entry</div>
          <div class="field"><label data-i18n="lblDiameter">Diameter</label><input type="number" id="jbolt-diameter" step="0.1" oninput="calcJBolt('jbolt')"></div>
          <div class="field"><label>H</label><input type="number" id="jbolt-h" placeholder="910" step="0.1" oninput="calcJBolt('jbolt')"></div>
          <div class="field"><label>ID</label><input type="number" id="jbolt-id" placeholder="80" step="0.1" oninput="calcJBolt('jbolt')"></div>
          <div class="field"><label>S</label><input type="number" id="jbolt-s" placeholder="105" step="0.1" oninput="calcJBolt('jbolt')"></div>
          <div class="field"><label data-i18n="lblThreadLength">Thread Length</label><input type="text" id="jbolt-threadLen" data-i18n-ph="phEnterThreadLength" placeholder="Enter thread length"></div>
          <div class="field"><label data-i18n="lblTotalLength">Total Length</label><input type="number" id="jbolt-length" data-i18n-ph="phAutoCalculated" placeholder="Auto calculated" oninput="calcJBolt('jbolt',true)"></div>
          <button type="button" class="acc-toggle-btn full" id="jbolt-accToggle" onclick="toggleAccPanel('jbolt')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="jbolt-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="jbolt-nutEnabled"><input type="checkbox" id="jbolt-nutEnabled" onchange="onAccChange('jbolt')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="jbolt-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('jbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="jbolt-nutFinish" disabled onchange="onAccChange('jbolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="jbolt-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('jbolt')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="jbolt-fwEnabled"><input type="checkbox" id="jbolt-fwEnabled" onchange="onAccChange('jbolt')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="jbolt-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('jbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="jbolt-fwFinish" disabled onchange="onAccChange('jbolt')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="jbolt-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('jbolt')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="jbolt-customEnabled"><input type="checkbox" id="jbolt-customEnabled" onchange="onAccChange('jbolt')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="jbolt-customText" data-i18n-ph="phCwWording" placeholder="Enter c/w wording" disabled oninput="onAccChange('jbolt')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="jbolt-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('jbolt')"></div>
              </div>
            </div>
          </div>
          <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
          <div class="field"><label data-i18n="lblCostRate">Cost Rate</label><input type="text" class="hl" id="jbolt-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcJBolt('jbolt',true)" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('jbolt','costRate');}"></div>
          <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="text" class="hl" id="jbolt-addCost" placeholder="0.00" oninput="calcJBolt('jbolt',true)" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('jbolt','addCost');}"></div>
          <div class="field"><label data-i18n="lblMarkup">Markup</label><input type="number" id="jbolt-markup" placeholder="0" min="0" oninput="calcJBolt('jbolt',true)"></div>
          <div class="field"><label data-i18n="lblQTY">QTY</label><input type="number" id="jbolt-qty" value="1" min="1" step="1"></div>
          <div class="warn-note full" id="jbolt-warn">Cost Rate must be entered manually for this product type.</div>
        </div>

        <!-- ══ PLATE FORM ══ -->
        <div class="item-form" id="form-plate" data-type="plate">

          <!-- Product Setup -->
          <div class="group-label full">Product Setup <span class="gl-zh">/ 产品类型</span></div>
          <div class="field full">
            <label>Plate Type <span class="gl-zh" style="font-weight:500">/ 板型</span></label>
            <div class="hole-pills">
              <label class="hole-pill hole-pill-card" id="plate-type-ms-label">
                <input type="radio" name="plate-plateType" value="ms_plate" checked onchange="onPlateTypeChange()">
                <span class="hole-pill-main">MS Plate</span>
                <span class="hole-pill-zh">普通钢板</span>
              </label>
              <label class="hole-pill hole-pill-card" id="plate-type-tri-label">
                <input type="radio" name="plate-plateType" value="triangle_plate" onchange="onPlateTypeChange()">
                <span class="hole-pill-main">Triangle Plate</span>
                <span class="hole-pill-zh">三角加强板</span>
              </label>
            </div>
          </div>
          <!-- Material hidden: defaults to MS internally -->
          <input type="hidden" id="plate-material" value="MS">
          <div class="field full finish-field"><label data-i18n="lblFinish">Finish</label>
            <div class="finish-pills" id="plate-finishPills">
              <label class="finish-pill selected-NA" id="plate-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="plate-finish" value="" onchange="onFinishChange('plate')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="plate-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="plate-finish" value="PL" checked onchange="onFinishChange('plate')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="plate-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="plate-finish" value="ZP" onchange="onFinishChange('plate')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="plate-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="plate-finish" value="HDG" onchange="onFinishChange('plate')"><span class="fp-code">HDG</span></label>
            </div>
          </div>

          <!-- MS Plate Dimension Entry -->
          <div class="group-label full" id="plate-dim-group-ms">Dimension Entry <span class="gl-zh">/ 尺寸资料</span></div>
          <div class="field" id="plate-f-l"><label data-i18n="lblLength">Length</label><input type="number" id="plate-l" placeholder="mm, e.g. 200" step="0.1" min="0.1" oninput="calcPlate()"></div>
          <div class="field" id="plate-f-w"><label data-i18n="lblWidth">Width</label><input type="number" id="plate-w" placeholder="mm, e.g. 200" step="0.1" min="0.1" oninput="calcPlate()"></div>
          <div class="field" id="plate-f-t"><label data-i18n="lblThickness">Thickness</label><input type="number" id="plate-t" placeholder="mm, e.g. 10" step="0.1" min="0.1" oninput="calcPlate()"></div>
          <!-- Hole Option — MS Plate only -->
          <div class="field full" id="plate-f-hole">
            <label data-i18n="lblHoleOption">Hole Option</label>
            <div class="hole-pills">
              <label class="hole-pill"><input type="radio" name="plate-hole" value="none" checked onchange="onHoleOptionChange()"><span class="hole-pill-main">No Hole</span><span class="hole-pill-zh">无洞</span></label>
              <label class="hole-pill"><input type="radio" name="plate-hole" value="center" onchange="onHoleOptionChange()"><span class="hole-pill-main">Center Hole</span><span class="hole-pill-zh">中间开洞</span></label>
              <label class="hole-pill"><input type="radio" name="plate-hole" value="corners" onchange="onHoleOptionChange()"><span class="hole-pill-main">4 Corner Holes</span><span class="hole-pill-zh">四角开洞</span></label>
              <label class="hole-pill"><input type="radio" name="plate-hole" value="custom" onchange="onHoleOptionChange()"><span class="hole-pill-main">Custom Holes</span><span class="hole-pill-zh">自定义洞口</span></label>
            </div>
          </div>
          <div class="field" id="plate-f-hd" style="display:none"><label data-i18n="lblHoleDia">Hole Dia.</label><input type="number" id="plate-hd" placeholder="mm, e.g. 30" step="0.1" min="0.1" oninput="calcPlate()"></div>
          <div class="field" id="plate-f-nh" style="display:none"><label data-i18n="lblHoles">Holes</label><input type="number" id="plate-nh" placeholder="e.g. 1" step="1" min="1" oninput="calcPlate()"></div>

          <!-- Triangle Plate Dimension Entry — hidden by default -->
          <div class="group-label full" id="plate-dim-group-tri" style="display:none">Dimension Entry <span class="gl-zh">/ 尺寸资料</span></div>
          <div class="field" id="plate-f-tri-l" style="display:none"><label data-i18n="lblLength">Length</label><input type="number" id="plate-tri-l" placeholder="mm, e.g. 180" step="0.1" min="0.1" oninput="calcPlate()"></div>
          <div class="field" id="plate-f-tri-h" style="display:none"><label data-i18n="lblHeight">Height</label><input type="number" id="plate-tri-h" placeholder="mm, e.g. 180" step="0.1" min="0.1" oninput="calcPlate()"></div>
          <div class="field" id="plate-f-tri-cl" style="display:none"><label>Cut Length <span class="gl-zh field-zh">切边长度（可选）</span></label><input type="number" id="plate-tri-cl" data-i18n-ph="phOptional" placeholder="Optional" step="0.1" min="0.1" oninput="calcPlate()"></div>
          <div class="field" id="plate-f-tri-ch" style="display:none"><label>Cut Height <span class="gl-zh field-zh">切边高度（可选）</span></label><input type="number" id="plate-tri-ch" data-i18n-ph="phOptional" placeholder="Optional" step="0.1" min="0.1" oninput="calcPlate()"></div>
          <div class="field" id="plate-f-tri-t" style="display:none"><label data-i18n="lblThickness">Thickness</label><input type="number" id="plate-tri-t" placeholder="mm, e.g. 8" step="0.1" min="0.1" oninput="calcPlate()"></div>

          <!-- Accessories -->
          <button type="button" class="acc-toggle-btn full" id="plate-accToggle" onclick="toggleAccPanel('plate')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="plate-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="plate-nutEnabled"><input type="checkbox" id="plate-nutEnabled" onchange="onAccChange('plate')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="plate-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('plate')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="plate-nutFinish" disabled onchange="onAccChange('plate')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="plate-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('plate')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="plate-fwEnabled"><input type="checkbox" id="plate-fwEnabled" onchange="onAccChange('plate')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="plate-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('plate')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="plate-fwFinish" disabled onchange="onAccChange('plate')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="plate-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('plate')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="plate-customEnabled"><input type="checkbox" id="plate-customEnabled" onchange="onAccChange('plate')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="plate-customText" data-i18n-ph="phCwWording" placeholder="Enter c/w wording" disabled oninput="onAccChange('plate')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="plate-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('plate')"></div>
              </div>
            </div>
          </div>

          <!-- Pricing Entry -->
          <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
          <div class="field"><label>Cost Rate <span class="gl-zh field-zh" data-i18n="costRateSub">Cost per kg</span></label><input type="text" class="hl" id="plate-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcPlate()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('plate','costRate');}"></div>
          <div class="field"><label>Additional Cost <span class="gl-zh field-zh">额外加工费</span></label><input type="text" class="hl" id="plate-addCost" placeholder="0.00" oninput="calcPlate()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('plate','addCost');}"></div>
          <div class="field"><label>Markup <span class="gl-zh field-zh">加价</span></label><input type="number" id="plate-markup" placeholder="0" min="0" oninput="calcPlate()"></div>
          <div class="field"><label>Qty <span class="gl-zh field-zh">数量</span></label><input type="number" id="plate-qty" value="1" min="1" step="1" oninput="calcPlate()"></div>
          <div class="info-note full">Hole drilling / laser / punching cost: include in Additional Cost. <span class="gl-zh">开洞加工费请放在额外加工费。</span></div>
        </div>

        <!-- ══ WELDING ANCHOR SET FORM ══ -->
        <div class="item-form" id="form-was" data-type="was">

          <!-- Guide box -->
          <div class="was-guide full">
            这是 Anchor Bolt + Base Plate + Triangle Plate 焊接成一套的报价。<br>
            焊接费、开洞费、加工费请放在 Additional Cost。<br>
            Nut / FW 请在 Accessories 里面选择。
          </div>

          <!-- Finish (applies to whole set) -->
          <div class="field full finish-field"><label>Finish <span class="gl-zh field-zh">表面处理</span></label>
            <div class="finish-pills" id="was-finishPills">
              <label class="finish-pill selected-NA" id="was-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="was-finish" value="" onchange="onFinishChange('was')"><span class="fp-code">N/A</span></label>
              <label class="finish-pill selected-PL" id="was-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="was-finish" value="PL" checked onchange="onFinishChange('was')"><span class="fp-code">PL</span></label>
              <label class="finish-pill" id="was-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="was-finish" value="ZP" onchange="onFinishChange('was')"><span class="fp-code">ZP</span></label>
              <label class="finish-pill" id="was-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="was-finish" value="HDG" onchange="onFinishChange('was')"><span class="fp-code">HDG</span></label>
            </div>
          </div>

          <!-- ── Anchor Bolt ── -->
          <div class="group-label full">Anchor Bolt <span class="gl-zh">/ 锚栓</span></div>
          <div class="field"><label>Material <span class="gl-zh field-zh">材料</span></label>
            <select id="was-ab-material" onchange="calcWAS()">
              <option value="MS">MS</option><option value="S45C">S45C</option>
              <option value="4140">4140 QT</option><option value="4140_PLAIN">4140</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option>
            </select>
          </div>
          <div class="field"><label>Size Type <span class="gl-zh field-zh">尺寸类型</span></label>
            <select id="was-ab-sizeType" onchange="calcWAS()">
              <option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option>
            </select>
          </div>
          <div class="field"><label>Size <span class="gl-zh field-zh">尺寸</span></label>
            <input type="text" id="was-ab-size" list="sizeOptions" value="M20" autocomplete="off" oninput="calcWAS()">
          </div>
          <div class="field"><label>Diameter <span class="gl-zh field-zh">直径 mm</span></label>
            <input type="number" id="was-ab-diameter" step="0.1" placeholder="18" oninput="calcWAS()">
          </div>
          <div class="field"><label data-i18n="lblLengthMm">Length</label>
            <input type="number" id="was-ab-length" placeholder="600" step="1" min="1" oninput="calcWAS()">
          </div>
          <div class="field"><label>Thread Length <span class="gl-zh field-zh">牙长</span></label>
            <input type="text" id="was-ab-threadLen" placeholder="e.g. 150">
          </div>
          <div class="field"><label data-i18n="lblQtyPerSet">Qty per Set</label>
            <input type="number" id="was-ab-qty" value="1" min="1" step="1" oninput="calcWAS()">
          </div>

          <!-- ── Base Plate ── -->
          <div class="group-label full">Base Plate <span class="gl-zh">/ 底板</span></div>
          <div class="field"><label data-i18n="lblLengthMm">Length</label>
            <input type="number" id="was-bp-l" placeholder="250" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field"><label data-i18n="lblWidthMm">Width</label>
            <input type="number" id="was-bp-w" placeholder="250" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field"><label data-i18n="lblThicknessMm">Thickness</label>
            <input type="number" id="was-bp-t" placeholder="12" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field full">
            <label data-i18n="lblHoleOption">Hole Option</label>
            <div class="hole-pills">
              <label class="hole-pill"><input type="radio" name="was-bp-hole" value="none" checked onchange="onWASHoleChange()"><span class="hole-pill-main">No Hole</span><span class="hole-pill-zh">无洞</span></label>
              <label class="hole-pill"><input type="radio" name="was-bp-hole" value="center" onchange="onWASHoleChange()"><span class="hole-pill-main">Center Hole</span><span class="hole-pill-zh">中间开洞</span></label>
              <label class="hole-pill"><input type="radio" name="was-bp-hole" value="corners" onchange="onWASHoleChange()"><span class="hole-pill-main">4 Corner Holes</span><span class="hole-pill-zh">四角开洞</span></label>
              <label class="hole-pill"><input type="radio" name="was-bp-hole" value="custom" onchange="onWASHoleChange()"><span class="hole-pill-main">Custom Holes</span><span class="hole-pill-zh">自定义洞口</span></label>
            </div>
          </div>
          <div class="field" id="was-bp-hd-wrap" style="display:none"><label data-i18n="lblHoleDiaMm">Hole Dia.</label>
            <input type="number" id="was-bp-hd" placeholder="30" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field" id="was-bp-nh-wrap" style="display:none"><label data-i18n="lblHoles">Holes</label>
            <input type="number" id="was-bp-nh" placeholder="1" step="1" min="1" oninput="calcWAS()">
          </div>
          <div class="field"><label data-i18n="lblQtyPerSet">Qty per Set</label>
            <input type="number" id="was-bp-qty" value="1" min="1" step="1" oninput="calcWAS()">
          </div>

          <!-- ── Triangle Plate ── -->
          <div class="group-label full">Triangle Plate <span class="gl-zh">/ 三角加强板</span></div>
          <div class="field"><label data-i18n="lblLengthMm">Length</label>
            <input type="number" id="was-tp-l" placeholder="180" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field"><label data-i18n="lblHeightMm">Height</label>
            <input type="number" id="was-tp-h" placeholder="180" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field"><label>Cut Length <span class="gl-zh field-zh">切边长度 mm（可选）</span></label>
            <input type="number" id="was-tp-cl" data-i18n-ph="phOptional" placeholder="Optional" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field"><label>Cut Height <span class="gl-zh field-zh">切边高度 mm（可选）</span></label>
            <input type="number" id="was-tp-ch" data-i18n-ph="phOptional" placeholder="Optional" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field"><label data-i18n="lblThicknessMm">Thickness</label>
            <input type="number" id="was-tp-t" placeholder="8" step="0.1" min="0.1" oninput="calcWAS()">
          </div>
          <div class="field"><label data-i18n="lblQtyPerSet">Qty per Set</label>
            <input type="number" id="was-tp-qty" value="4" min="0" step="1" oninput="calcWAS()">
          </div>

          <!-- ── Accessories ── -->
          <button type="button" class="acc-toggle-btn full" id="was-accToggle" onclick="toggleAccPanel('was')">
            <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title" data-i18n="accessories">Accessories</span><span class="acc-toggle-sub" data-i18n="accToggleSub">Nut / FW / Custom · Optional</span></span>
          </button>
          <div class="acc-panel" id="was-accPanel">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="was-nutEnabled"><input type="checkbox" id="was-nutEnabled" onchange="onAccChange('was')"><span class="acc-title-txt" data-i18n="accAddNut">Add Nut</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="was-nutQty" value="2" min="1" step="1" disabled oninput="onAccChange('was')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="was-nutFinish" disabled onchange="onAccChange('was')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="was-nutPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('was')"></div>
              </div>
            </div>
            <hr class="acc-divider">
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="was-fwEnabled"><input type="checkbox" id="was-fwEnabled" onchange="onAccChange('was')"><span class="acc-title-txt" data-i18n="accAddFW">Add FW</span></label></div>
              <div class="acc-item-fields">
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblQty">Qty</span><input type="number" id="was-fwQty" value="1" min="1" step="1" disabled oninput="onAccChange('was')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblFinish">Finish</span><select id="was-fwFinish" disabled onchange="onAccChange('was')"><option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option><option value="SS">SS</option></select></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="was-fwPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('was')"></div>
              </div>
            </div>
            <div class="acc-item">
              <div class="acc-item-head"><label class="acc-enable" for="was-customEnabled"><input type="checkbox" id="was-customEnabled" onchange="onAccChange('was')"><span class="acc-title-txt">Add Custom</span></label></div>
              <div class="acc-item-fields acc-custom">
                <div class="acc-field"><span class="acc-field-label">Text</span><input type="text" id="was-customText" data-i18n-ph="phEgWelding" placeholder="e.g. welding" disabled oninput="onAccChange('was')"></div>
                <div class="acc-field"><span class="acc-field-label" data-i18n="lblUnitPrice">Unit Price</span><input type="number" id="was-customPrice" value="0" min="0" step="0.01" disabled oninput="onAccChange('was')"></div>
              </div>
            </div>
          </div>

          <!-- ── Pricing ── -->
          <div class="group-label full" data-i18n="pricing">Pricing</div>
          <div class="field"><label>Anchor Cost Rate <span class="gl-zh field-zh">锚栓每公斤成本</span></label>
            <input type="text" class="hl" id="was-anchorCostRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcWAS()">
          </div>
          <div class="field"><label>Base Plate Cost Rate <span class="gl-zh field-zh">底板每公斤成本</span></label>
            <input type="text" class="hl" id="was-basePlateCostRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcWAS()">
          </div>
          <div class="field"><label>Triangle Plate Cost Rate <span class="gl-zh field-zh">三角板每公斤成本</span></label>
            <input type="text" class="hl" id="was-trianglePlateCostRate" data-i18n-ph="phOptionalQty0" placeholder="Optional when Qty is 0" oninput="calcWAS()">
          </div>
          <div class="field"><label>Additional Cost <span class="gl-zh field-zh">额外加工费</span></label>
            <input type="text" class="hl" id="was-addCost" placeholder="0.00" oninput="calcWAS()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('was','addCost');}">
          </div>
          <div class="field"><label>Markup <span class="gl-zh field-zh">加价</span></label>
            <input type="number" id="was-markup" placeholder="0" min="0" oninput="calcWAS()">
          </div>
          <div class="field"><label>Set Qty <span class="gl-zh field-zh">套数</span></label>
            <input type="number" id="was-qty" value="1" min="1" step="1" oninput="calcWAS()">
          </div>
          <div class="was-cost-note"><strong>加工费说明：</strong>焊接费、开洞费、加工费请放在 Additional Cost。</div>
        </div>

        <div class="calc-preview" id="calcPreview">
          <div class="cp-item"><label data-i18n="lblUnitWeight">Unit Weight</label><span id="cpWeight">—</span></div>
          <div class="cp-item"><label data-i18n="lblBasePrice">Base Price</label><span id="cpBase">—</span></div>
          <div class="cp-item cp-acc"><label><span data-i18n="accessories">Accessories</span></label><span id="cpAcc">—</span></div>
          <div class="cp-item cp-final"><label data-i18n="lblFinalUnitPrice">Final Unit Price</label><span id="cpFinal">—</span></div>
        </div>
        <div class="price-mode-preview" id="priceModePreview">
          <div><span data-i18n="lblRawPrice">Raw Price</span><strong id="pmPreviewRaw">RM 0.00</strong></div>
          <div><span data-i18n="lblPriceMode">Price Mode</span><strong id="pmPreviewMode">Auto Round</strong></div>
          <div><span data-i18n="lblFinalUnitPrice">Final Unit Price</span><strong id="pmPreviewFinal">RM 0.00</strong></div>
        </div>
        <div class="was-breakdown" id="wasBreakdown" aria-live="polite">
          <div class="was-breakdown-title">Cost Breakdown <span class="zh">/ 成本拆分</span></div>
          <div class="was-breakdown-row"><span class="was-breakdown-label">Anchor Bolt</span><span class="was-breakdown-value" id="wasBreakdownAnchor">—</span></div>
          <div class="was-breakdown-row"><span class="was-breakdown-label">Base Plate</span><span class="was-breakdown-value" id="wasBreakdownBasePlate">—</span></div>
          <div class="was-breakdown-row" id="wasBreakdownTriangleRow"><span class="was-breakdown-label">Triangle Plate</span><span class="was-breakdown-value" id="wasBreakdownTriangle">—</span></div>
          <div class="was-breakdown-row"><span class="was-breakdown-label">Additional Cost</span><span class="was-breakdown-value" id="wasBreakdownAdditional">—</span></div>
          <div class="was-breakdown-row"><span class="was-breakdown-label">Accessories</span><span class="was-breakdown-value" id="wasBreakdownAccessories">—</span></div>
          <div class="was-breakdown-row"><span class="was-breakdown-label" data-i18n="lblBasePrice">Base Price</span><span class="was-breakdown-value was-breakdown-total" id="wasBreakdownBasePrice">—</span></div>
          <div class="was-breakdown-row"><span class="was-breakdown-label" data-i18n="lblFinalUnitPrice">Final Unit Price</span><span class="was-breakdown-value was-breakdown-total" id="wasBreakdownFinal">—</span></div>
        </div>
        <div class="ubolt-debug-wrap" id="uboltDebugWrap">
          <div class="ubolt-debug-head">
            <div class="ubolt-debug-title">U-Bolt Price Debug <span>Internal only</span></div>
            <button type="button" class="ubolt-debug-toggle" id="uboltDebugToggle" onclick="toggleUBoltDebug()">Show Debug</button>
          </div>
          <div class="ubolt-debug-panel" id="uboltDebugPanel">
            <div class="ubolt-debug-cell">Diameter<strong id="ubDebugDiameter">—</strong></div>
            <div class="ubolt-debug-cell">ID<strong id="ubDebugId">—</strong></div>
            <div class="ubolt-debug-cell">IH<strong id="ubDebugIh">—</strong></div>
            <div class="ubolt-debug-cell">Thread Length<strong id="ubDebugThreadLen">—</strong></div>
            <div class="ubolt-debug-cell">Total Length<strong id="ubDebugTotalLen">—</strong></div>
            <div class="ubolt-debug-cell">Unit Weight<strong id="ubDebugWeight">—</strong></div>
            <div class="ubolt-debug-cell">Cost Rate<strong id="ubDebugCostRate">—</strong></div>
            <div class="ubolt-debug-cell">Additional Cost<strong id="ubDebugAddCost">—</strong></div>
            <div class="ubolt-debug-cell">Markup<strong id="ubDebugMarkup">—</strong></div>
            <div class="ubolt-debug-cell">Base Price<strong id="ubDebugBase">—</strong></div>
            <div class="ubolt-debug-cell">Before Rounding<strong id="ubDebugBeforeRound">—</strong></div>
            <div class="ubolt-debug-cell">After Rounding<strong id="ubDebugAfterRound">—</strong></div>
          </div>
        </div>
        <div class="dp-status" id="dpStatus">
          <span data-i18n="mDefaultApplied">Default price applied</span>
          <button class="dp-edit" onclick="openDPModal()" data-i18n="mManageRules">Manage rules</button>
        </div>

        <div class="ph-mini" id="phMini">
          <div class="ph-mini-head">
            <span class="ph-title"><span data-i18n="prevQuotedPrices">Previous Quoted Prices</span> <span class="ph-tag" data-i18n="mRefOnly">reference only, does not change your price</span></span>
            <button class="btn btn-outline btn-sm" onclick="checkPreviousPrice()"><span data-i18n="checkPrevPrices">Check Previous Prices</span></button>
          </div>
          <div id="phResults" style="display:none">
            <div class="ph-section" id="phSameCustomerSection" style="display:none">
              <div class="ph-section-title">Same Customer History</div>
              <div class="ph-stats">
                <div class="ph-stat hl"><label>Last Quoted</label><span id="phSameLast">—</span></div>
                <div class="ph-stat"><label>Low</label><span id="phSameLow">—</span></div>
                <div class="ph-stat"><label>High</label><span id="phSameHigh">—</span></div>
                <div class="ph-stat"><label>Avg</label><span id="phSameAvg">—</span></div>
                <div class="ph-stat"><label>Records</label><span id="phSameRecords">—</span></div>
              </div>
            </div>
            <div class="ph-section" id="phAllSection" style="display:none">
              <div class="ph-section-title">All Customer Reference</div>
              <div class="ph-stats">
                <div class="ph-stat hl"><label>Last Quoted</label><span id="phAllLast">—</span></div>
                <div class="ph-stat"><label>Low</label><span id="phAllLow">—</span></div>
                <div class="ph-stat"><label>High</label><span id="phAllHigh">—</span></div>
                <div class="ph-stat"><label>Avg</label><span id="phAllAvg">—</span></div>
                <div class="ph-stat"><label>Records</label><span id="phAllRecords">—</span></div>
              </div>
            </div>
          </div>
          <div class="ph-empty-msg" id="phEmptyMsg" style="display:none">No matching saved quotations for this Product Type, Material, Size Type, Finish and Size yet.</div>
        </div>

        <!-- Extra Drawing Dimensions lives HERE and only here, and only while an
             item already in the quotation is open for editing. Entering a new
             item never builds it: there is no bar, no panel and no markup for it
             anywhere in the entry flow, because a dimension the product's own
             schema owns must be typed into that schema's field, where the
             calculator can see it. setItemEditMode() fills and empties this. -->
        <div id="cdimHost" hidden></div>

        <div class="entry-actions">
          <div class="qi-edit-mode-note" id="itemEditNote">Editing item #1 / 正在编辑第 1 项</div>
          <button class="btn btn-ghost btn-xl btn-block btn-bi" id="cancelItemEditBtn" type="button" style="display:none" onclick="cancelItemEdit()" data-i18n="cancelEdit">Cancel Edit</button>
          <button class="btn btn-primary btn-xl btn-block btn-bi" id="addBtn" onclick="addCurrentItem()" data-i18n="addToQuotation">＋ Add to Quotation</button>
        </div>
      </div>

      <!-- RIGHT: Review & Save -->
      <div class="card" id="step3Card">
        <div class="card-head">
          <div>
            <div class="step-caption" data-i18n="step3Caption">Step 3 · Review &amp; Save</div>
            <span class="step-caption-sub" data-i18n="step3Sub">Review & save</span>
            <div class="card-title"><span data-i18n="quotationList">Quotation List</span> <span class="count-pill" id="quoteCount">0</span></div>
          </div>
          <button class="btn btn-danger btn-sm" id="clearAllBtn" onclick="clearAllItems()" data-i18n="clearAll">Clear All</button>
        </div>

        <div class="qi-sort-row" id="quoteSortRow" style="display:none">
          <label for="quoteSortSelect"><span data-i18n="sort">Sort</span></label>
          <select id="quoteSortSelect" onchange="setQuoteSortOrder(this.value)">
            <option value="newest" data-i18n="newestFirst">Newest First</option>
            <option value="oldest" data-i18n="oldestFirst">Oldest First</option>
          </select>
        </div>

        <div class="review-list-panel" id="reviewListPanel">
          <div class="review-lock-label" id="reviewLockLabel">Locked / 已锁定</div>
          <div id="quoteEmpty" class="empty-state">
            <p data-i18n="noItemsYet">No items yet</p>
          </div>

          <div id="quoteItemsWrap" style="display:none">
            <div class="qi-list" id="quoteItemList"></div>
          </div>
        </div>

        <div class="review-action-panel" id="step4Actions">
          <div class="quote-total-bar" id="quoteTotalBar" style="display:none">
            <div><div class="qt-label"><span data-i18n="quotationTotal">Quotation Total</span></div><div class="qt-amt" id="quoteTotalAmt">RM 0.00</div></div>
          </div>
          <div class="step-caption" style="margin-top:12px" data-i18n="step4Caption">Step 4 · Print / WhatsApp</div>
          <span class="step-caption-sub" style="display:block;margin-bottom:10px" data-i18n="step4Sub">Print / WhatsApp</span>
          <div class="quote-actions">
            <button class="btn btn-save btn-xl btn-bi" id="saveQuoteBtn" onclick="openSaveModal()"><span data-i18n="saveQuotation">Save Quotation</span></button>
            <button class="btn btn-ghost btn-sm" onclick="doPrint()" data-i18n="print">Print</button>
            <button class="btn btn-wa btn-sm" onclick="doWhatsApp()">WhatsApp</button>
            <button class="btn btn-outline btn-sm" onclick="doCopyWA()" data-i18n="copy">Copy</button>
          </div>
        </div>
      </div>
    </div>

  </main>
</div>

<!-- Mobile sticky bar -->
<div class="mobile-bar">
  <div class="mb-total"><label>Total</label><span id="mbTotal">RM 0.00</span></div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline btn-sm" onclick="scrollToQuote()"><span id="mbCount">0</span> <span data-i18n="itemsUnit">items</span></button>
    <button class="btn btn-save" id="mobileSaveBtn" style="padding:10px 18px;font-size:13.5px" onclick="openSaveModal()" data-i18n="save">Save</button>
  </div>
</div>

<!-- Print summary (only visible on print) -->
<div class="card print-card" id="printSummary" style="display:none">
  <div class="print-issuer" id="printIssuer" hidden>
    <div class="print-issuer-name" id="printIssuerName"></div>
    <div class="print-issuer-line">83 LOT 10341, JALAN BENDAHARA 38,</div>
    <div class="print-issuer-line">OFF JALAN SUNGAI JATI,</div>
    <div class="print-issuer-line">41200 KLANG, SELANGOR</div>
    <div class="print-issuer-line">Email: sales@derchengfastener.com</div>
    <div class="print-issuer-line">Tel: 016-328 7627 / 012-304 2890</div>
  </div>
  <h1 class="print-title">QUOTATION</h1>
  <div class="print-meta-grid">
    <div class="print-meta-item"><span class="print-meta-label">Quotation No.</span><span class="print-meta-value" id="printRefNo"></span></div>
    <div class="print-meta-item"><span class="print-meta-label">Date</span><span class="print-meta-value" id="printDate"></span></div>
    <div class="print-meta-item"><span class="print-meta-label">Customer</span><span class="print-meta-value" id="printCustomer"></span></div>
    <div class="print-meta-item"><span class="print-meta-label">Prepared By</span><span class="print-meta-value" id="printPreparedBy"></span></div>
  </div>
  <table class="print-items-table">
    <thead>
      <tr><th class="print-col-no">No.</th><th class="print-col-desc">Description</th><th>Size / Dimension</th><th class="print-col-qty">Qty</th><th class="print-col-money">Unit Price</th><th class="print-col-money">Total</th></tr>
    </thead>
    <tbody id="printItemsBody"></tbody>
    <tfoot>
      <tr><td colspan="5" class="print-grand-label">Grand Total</td><td class="print-col-money" id="printGrandTotal"></td></tr>
    </tfoot>
  </table>
  <div class="print-remarks" id="printRemarks" hidden></div>
  <div class="print-footer-note">This is a computer-generated quotation. No signature is required.</div>
</div>

<datalist id="sizeOptions">
  <option value="M8"><option value="M10"><option value="M12"><option value="M13"><option value="M16"><option value="M18"><option value="M20"><option value="M22"><option value="M24"><option value="M25"><option value="M27"><option value="M30"><option value="M32"><option value="M33"><option value="M36"><option value="M38"><option value="M39"><option value="M40"><option value="M42"><option value="M45"><option value="M48"><option value="M50"><option value="M52"><option value="M55"><option value="M60"><option value="M65">
  <option value="1/4"><option value="5/16"><option value="3/8"><option value="1/2"><option value="5/8"><option value="3/4"><option value="7/8"><option value='1"'><option value="1-1/8"><option value="1-1/4"><option value="1-1/2">
</datalist>

<!-- ═══ VERSION UPDATES MODAL ═══ -->
<div class="modal-overlay" id="versionUpdatesModal">
  <div class="modal version-updates-modal">
    <div class="modal-title version-updates-head">
      <span data-i18n="sideVersionUpdates">Version Updates</span>
      <button class="modal-close" onclick="closeModal('versionUpdatesModal')">✕</button>
    </div>
    <div class="version-updates-list">
      <section class="version-card">
        <h3 class="version-card-title">v2.24.0 — EN / 中文 Interface</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- EN / 中文 language switch in the header, and in the sidebar on tablet and phone</span><span>- The interface is translated throughout Calculator, WhatsApp Quick Add, Companies / Saved and Sign In</span><span>- Your language choice is remembered on this device and carries across every page</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Mixed "English / 中文" labels replaced by one language at a time</span><span>- Product, material, finish and size terms (Sag Rod, 4140 QT, ZP, M12, TL, RM) stay in English in both modes</span><span>- Quotation data — customer names, quotation numbers, item descriptions — is never translated</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.23.3 — AI Quick Add: Photo / PDF Extraction</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- WhatsApp Quick Add can read a photo, screenshot, drawing or PDF of the customer request</span><span>- Drag and drop a file onto the upload area, or choose one as before</span><span>- Common Item Fields — Apply to All: enter Size and Thread once and copy them into every row</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Product is classified by the drawing geometry first, so an "Anchor Bolt" title on a straight rod threaded at both ends is read as Sag Rod</span><span>- Accessory wording on a document is shown as a note only and is never priced automatically</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Uploads no longer fail when the server has no fileinfo extension; a clear message is shown instead</span><span>- Analysis now uses the working model on this server</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.23.2 — Production Stability Fixes</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Quotation number is now allocated by the server at save time (two tabs can no longer get the same number)</span><span>- Numeric input validation: Qty must be a whole number ≥ 1, no negative dimensions / prices / totals</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Manually entered Cost Rate / Additional Cost is no longer overwritten by Size / Size Type / Finish / Thread Length changes (Material change still refreshes pricing)</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Default quotation date was wrong between midnight and 8am (UTC date bug)</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.23.1 — Pricing Guide Rewrite</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- New staff-friendly Pricing Guide</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Replaced technical Rate Reference wording</span><span>- Simplified pricing explanation</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Improved staff understanding of Cost Rate, Additional Cost and Price Mode</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.23.0 — Excel Import / Export</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Diameter Settings Excel Import / Export</span><span>- Default Price Settings Excel Import / Export</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Added Master Data import tools</span><span>- Reduced manual rule entry</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Easier bulk maintenance of pricing rules</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.22.3 — Tablet Input UX Polish</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Tablet-friendly Add to Quotation workflow</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Improved touch interaction for Product Entry</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Enter key dependency issue on tablet keyboards</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.22.2 — Price Mode UI Final Polish</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Cleaner Manual Price guide display</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Price Mode layout polished</span><span>- Price Mode badges made lighter</span><span>- U-Bolt debug and Previous Quoted Prices sections made more compact</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- PRICE MODEL label corrected to PRICE MODE</span><span>- Cost Rate warning no longer stays visible after Cost Rate is entered</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.22.1 — Price Mode UI Polish</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Staff guide for Manual Price</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Price Mode UI cleaned to English-only</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Price Mode bilingual labels were too crowded</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.22.0 — Global Price Mode</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Price Mode for all products</span><span>- Manual Unit Price override</span><span>- No Round option</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Staff can choose Auto Round, No Round, or Manual Price per item</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Small dimension differences no longer need to be forced into the same rounded price</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.21.2 — U-Bolt Price Debug</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- U-Bolt calculation debug display</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Added internal visibility for U-Bolt price breakdown</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- —</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.21.1 — Others Length Weight Option</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Diameter × Length weight mode for Others / Special Bolt</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Others can calculate Unit Weight from Diameter and Length</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Special bolts no longer need manual weight when length-based weight is available</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.21.0 — Others / Special Bolt</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Others / Special Bolt product type</span><span>- Manual special bolt quotation entry</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Product Entry supports custom Product Name and Dimension Text</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Special/custom bolts no longer need to be forced into existing product types</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.8 — Quick Menu + Version Updates</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Version Updates modal</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Cleaned Quick Menu</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- —</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.7 — Product Entry Draft Recovery</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Product Entry Draft Recovery</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Draft autosave now includes active Product Entry form data</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Product Entry fields not restoring after browser refresh</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.6 — Unsaved Draft Autosave</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Unsaved Draft Autosave</span><span>- Restore Draft prompt</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Unsaved quotation data can be recovered after refresh</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Customer and quotation items disappearing after refresh before save</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.5 — Print Layout Repair</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Issued By dropdown for print</span><span>- Computer-generated quotation note</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Formal print layout improved</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Print preview showing huge blank area</span><span>- Quotation items not showing clearly in print</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.4 — Remove Valid Until UI</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- —</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Removed visible Valid Until from UI and customer output</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Valid Until showing even though it is not used</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.3 — Accessories Layout Polish</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- —</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Accessories panel layout improved</span><span>- WAS Additional Cost note cleaned</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Accessories bar looking narrow / mobile-like on desktop</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.2 — Plate / WAS Formula Correction</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- WAS internal cost breakdown</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Plate and WAS plate formula corrected</span><span>- Base Plate hole no longer deducts weight</span><span>- Triangle Plate charged as full rectangle area</span><span>- CL / CH display optional</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Plate / WAS weight and display mismatch</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.1 — Welding Anchor Set Split Rates</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Separate WAS cost rates</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Welding Anchor Set uses separate rates for Anchor, Base Plate and Triangle Plate</span><span>- Triangle Plate can be optional</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Single cost rate not suitable for Welding Anchor Set</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.20.0 — Welding Anchor Set</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Welding Anchor Set quotation type</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Product Entry supports Anchor Bolt + Base Plate + Triangle Plate set</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- —</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.19.2 — Plate Wording Cleanup</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- —</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Plate wording cleaned</span><span>- Plate Material selector removed; internally fixed as MS</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Plate labels too messy / unclear</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.19.1 — Plate UI Repair</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- —</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Plate UI layout improved</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Plate form layout broken / cramped</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.18.0 — Saved Quotation Editing</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Saved quotation edit workflow</span><span>- Edit / Update / Delete item from quotation list</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Saved quotations can be locked and unlocked for editing</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Saved quotation item editing not smooth</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.17.0 — Accessories System</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Accessories system</span><span>- Nut / FW / Custom add-on support</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Product item pricing supports accessories</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Accessories had to be manually typed into quotation text</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.16.0 — Production Quotation System</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- Production quotation system</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- System moved toward MySQL/API production workflow</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- —</span></div>
        </div>
      </section>
      <section class="version-card">
        <h3 class="version-card-title">v2.15.0 — MySQL Safe Patch + Settings Visibility</h3>
        <div class="version-notes">
          <div class="version-label">Added:</div><div class="version-copy"><span>- MySQL safe patch</span><span>- Default Prices visibility</span><span>- Diameter Settings visibility</span></div>
          <div class="version-label">Changed:</div><div class="version-copy"><span>- Safer API handling</span><span>- Better settings display</span></div>
          <div class="version-label">Fixed:</div><div class="version-copy"><span>- Hidden/default price and diameter settings not easy to inspect</span></div>
        </div>
      </section>
    </div>
  </div>
</div>

<!-- ═══ REFERENCE MODAL ═══ -->
<!-- ═══ WHATSAPP QUICK ADD ═══ -->
<div class="modal-overlay" id="wqaModal">
  <div class="modal wqa-modal">
    <div class="wqa-confirm" id="wqaConfirm" hidden>
      <div class="wqa-confirm-box" role="alertdialog" aria-labelledby="wqaConfirmTitle">
        <div class="wqa-confirm-title" id="wqaConfirmTitle" data-i18n="wqaDiscardTitle">Discard Quick Add changes?</div>
        <div class="wqa-confirm-sub" data-i18n="wqaDiscardSub">The pasted text, parsed items, pricing entry and accessories in this session will be lost.</div>
        <div class="wqa-confirm-actions">
          <button type="button" class="btn btn-primary" id="wqaKeepBtn" onclick="wqaCancelClose()" data-i18n="wqaKeepEditing">Keep Editing</button>
          <button type="button" class="btn btn-ghost" onclick="wqaConfirmDiscard()" data-i18n="wqaDiscard">Discard</button>
        </div>
      </div>
    </div>
    <div class="modal-title"><span data-i18n="wqaTitle">WhatsApp Quick Add</span>
      <button class="modal-close" onclick="wqaRequestClose()">✕</button></div>

    <!-- STEP 1 — paste text OR upload a photo / PDF -->
    <div id="wqaStep1">
      <div class="wqa-method" id="wqaMethodTabs" role="group" data-i18n-aria="wqaAriaMethod" aria-label="Input method">
        <button type="button" id="wqaTabPaste" class="wqa-method-btn is-on" onclick="wqaSetMethod('paste')" data-i18n="wqaTabPaste">Paste WhatsApp Text</button>
        <button type="button" id="wqaTabUpload" class="wqa-method-btn" onclick="wqaSetMethod('upload')" data-i18n="wqaTabUpload">Upload Photo / PDF</button>
      </div>

      <!-- The way back to picking an input. Quick Add still OPENS on paste, so
           the common path costs nobody an extra tap; this is here for when the
           customer sent a photo after all. Nothing is cleared either way. -->
      <div id="wqaChoicePane" hidden>
        <p class="wqa-hint" data-i18n="wqaChooseHint">How did the customer send the request?</p>
        <div class="wqa-choice">
          <button type="button" class="wqa-choice-btn" onclick="wqaSetMethod('paste')">
            <span class="wqa-choice-ico" aria-hidden="true">💬</span>
            <span class="wqa-choice-lbl" data-i18n="wqaTabPaste">Paste WhatsApp Text</span>
          </button>
          <button type="button" class="wqa-choice-btn" onclick="wqaSetMethod('upload')">
            <span class="wqa-choice-ico" aria-hidden="true">🖼️</span>
            <span class="wqa-choice-lbl" data-i18n="wqaTabUpload">Upload Photo / PDF</span>
          </button>
        </div>
      </div>

      <div id="wqaPastePane">
        <p class="wqa-hint" data-i18n="wqaPasteHint">Paste the customer's WhatsApp message. Sag Rod, Stud and Anchor Bolt are supported.</p>
        <textarea id="wqaInput" class="wqa-input" rows="9" spellcheck="false"
          placeholder="ms hdg sag rod&#10;&#10;1. m12 x 1000 x 100 - 1&#10;2. m12 x 1070 x 100 - 2pc&#10;3. m12 x 1120 x 100 - 3pcs"></textarea>
      </div>

      <div id="wqaUploadPane" hidden>
        <p class="wqa-hint" data-i18n="wqaUploadHint">Upload a screenshot, photo, drawing or PDF of the customer's request. JPG / PNG / WEBP up to 10 MB, PDF up to 20 MB (max 10 pages). One file per analysis.</p>
        <div id="wqaDropZone" class="wqa-drop" ondragenter="wqaDragEnter(event)" ondragover="wqaDragOver(event)"
             ondragleave="wqaDragLeave(event)" ondrop="wqaDrop(event)">
          <div class="wqa-drop-main" data-i18n="wqaDropMain">Drop image or PDF here</div>
          <div class="wqa-drop-or" data-i18n="wqaDropOr">or</div>
          <label class="wqa-file-pick">
            <input type="file" id="wqaFileInput" accept="image/jpeg,image/png,image/webp,application/pdf"
                   onchange="wqaFileChosen(this)">
            <span class="btn btn-outline" data-i18n="wqaChooseFile">Choose File…</span>
          </label>
          <div class="wqa-drop-types">JPG / PNG / WEBP / PDF</div>
          <div class="wqa-file-info" id="wqaFileInfo" data-i18n="wqaNoFile">No file selected</div>
        </div>
        <div class="wqa-ai-preview" id="wqaAiPreviewBox" hidden>
          <img id="wqaAiPreview" alt="preview" hidden>
          <div class="wqa-pdf-chip" id="wqaAiPdfChip" hidden>
            <span class="wqa-pdf-badge">PDF</span><span id="wqaAiPdfName"></span>
          </div>
        </div>
        <!-- One line of free text, analysed WITH the file. It is not a custom
             dimension and never becomes one: a value it names for a field the
             product already owns goes into that field. -->
        <div class="wqa-note">
          <label class="wqa-note-lbl" for="wqaAiNote">
            <span data-i18n="wqaNoteLabel">Additional info for analysis</span>
            <span class="wqa-note-opt" data-i18n="wqaNoteOpt">Optional / 可选</span>
          </label>
          <input type="text" id="wqaAiNote" class="wqa-note-in" maxlength="200" autocomplete="off"
                 spellcheck="false" data-i18n-ph="wqaNotePh" placeholder="H 530, ID 100, TL 75, W 80"
                 oninput="wqaNoteInput()">
          <div class="wqa-note-read" id="wqaAiNoteRead" hidden></div>
        </div>
        <div class="wqa-ai-status" id="wqaAiStatus" hidden>
          <span class="wqa-spinner"></span>
          <span><span data-i18n="wqaAnalyzing">Analyzing document…</span><br><small data-i18n="wqaExtracting">Extracting product, dimensions and quantities…</small></span>
        </div>
        <p class="wqa-ai-privacy" data-i18n="wqaPrivacy">Uploaded files are used only for AI extraction and are not saved with the quotation.</p>
        <div id="wqaAiMsg" class="wqa-msg" hidden></div>
      </div>

      <div id="wqaParseMsg" class="wqa-msg" hidden></div>
      <div class="wqa-actions">
        <button class="btn btn-ghost btn-sm wqa-back-btn" id="wqaChooseBtn" onclick="wqaSetMethod('choose')"
                data-i18n="wqaChooseInput">← Choose Input</button>
        <button class="btn btn-ghost" onclick="wqaRequestClose()" data-i18n="cancel">Cancel</button>
        <button class="btn btn-primary" id="wqaParseBtn" onclick="wqaParseAndReview()" data-i18n="wqaParseItems">Parse Items</button>
        <button class="btn btn-primary" id="wqaAnalyzeBtn" onclick="wqaAnalyze()" hidden disabled data-i18n="wqaAnalyze">Analyze</button>
      </div>
    </div>

    <!-- STEP 2/3 — review + confirm -->
    <div id="wqaStep2" hidden>
      <div class="wqa-scroll">
      <!-- The customer's own words, above everything derived from them. -->
      <div class="wqa-common wqa-source-common" id="wqaSource" hidden></div>
      <div class="wqa-common" id="wqaCommon"></div>
      <!-- The four copy-once sections are ONE thing — change many items at
           once — so they live in one container instead of four stacked cards.
           Each keeps its own id and its own renderer; only the frame is
           shared. -->
      <div class="wqa-bulk" id="wqaBulk">
        <div class="wqa-bulk-head">
          <span class="wqa-bulk-title" data-i18n="wqaBulkTitle">Bulk Edit</span>
          <span class="wqa-bulk-sub" data-i18n="wqaBulkSub">One shared value, many items</span>
        </div>
        <!-- Correcting what was read, before anything is copied into it. -->
        <div class="wqa-common wqa-fix-common" id="wqaCommonFix"></div>
        <div class="wqa-common wqa-item-common" id="wqaCommonItem"></div>
        <div class="wqa-common wqa-price-common" id="wqaCommonPrice"></div>
        <div class="wqa-common wqa-acc-common" id="wqaCommonAcc"></div>
      </div>
      <div class="wqa-rows-head">
        <span class="wqa-rows-lead">
          <span class="wqa-rows-count" id="wqaRowsCount" data-i18n="wqaZeroItems">0 items</span>
          <!-- The ONE place a selected count is shown. Present only while the
               tick boxes are, and amber at zero so the refusal is never a
               surprise. -->
          <span class="wqa-sel-count" id="wqaSelCount" hidden></span>
        </span>
        <!-- Shown only when an AI call actually produced the rows below. -->
        <span class="wqa-ai-badge" id="wqaAiBadge" data-i18n="aiAssisted" hidden>✨ AI assisted</span>
        <span class="wqa-view-lbl" data-i18n="wqaViewLabel">View</span>
        <span class="wqa-view-toggle" role="group" data-i18n-aria="wqaAriaView" aria-label="View">
          <button type="button" class="wqa-view-btn is-on" id="wqaViewCompact" onclick="wqaSetView('compact')" data-i18n="wqaCompact">Compact</button>
          <button type="button" class="wqa-view-btn" id="wqaViewExpanded" onclick="wqaSetView('expanded')" data-i18n="wqaExpanded">Expanded</button>
        </span>
        <!-- Only for an upload, where there is no message panel to go back
             through. A pasted message is edited from the panel itself. -->
        <button type="button" class="btn btn-ghost btn-sm" id="wqaBackBtn" onclick="wqaBackToPaste()"
                data-i18n="wqaEditPasted" hidden>← Edit pasted text</button>
      </div>
      <div class="wqa-list-head" id="wqaListHead" hidden></div>
      <div class="wqa-rows" id="wqaRows"></div>
      </div><!-- /.wqa-scroll -->
      <div class="wqa-actions wqa-sticky-actions">
        <span class="wqa-foot-count"><span id="wqaFootTotal" data-i18n="wqaZeroItems">0 items</span><span
          class="wqa-foot-need" id="wqaFootNeed" hidden></span></span>
        <button class="btn btn-ghost" onclick="wqaRequestClose()" data-i18n="cancel">Cancel</button>
        <button class="btn btn-primary" id="wqaAddBtn" onclick="wqaAddAll()" data-i18n="wqaAddItems">Add Items to Quotation</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="refModal">
  <div class="modal" style="max-width:720px">
    <div class="modal-title"><span data-i18n="sidePricingGuide">Pricing Guide</span> <span class="zh" data-i18n="pricingGuideSub">Pricing guide</span> <button class="modal-close" onclick="closeModal('refModal')">✕</button></div>
    <div class="ref-tabs">
      <button class="ref-tab active" onclick="switchRefTab('cost')">Cost Rate</button>
      <button class="ref-tab" onclick="switchRefTab('addcost')">Additional Cost</button>
      <button class="ref-tab" onclick="switchRefTab('pricemode')" data-i18n="lblPriceMode">Price Mode</button>
      <button class="ref-tab" onclick="switchRefTab('examples')" data-i18n="mProductExamples">Product Examples</button>
    </div>
    <div class="ref-panel active" id="ref-cost">
      <div class="ref-note"><h4>Cost Rate <span class="zh" data-i18n="costRateSub">Cost per kg</span></h4>
        <p>Cost Rate = material cost per kg.</p>
        <p class="cn" data-i18n="mCostRateExplain">Cost Rate = the material cost per kilogram.</p></div>
      <div class="ref-note"><h4 data-i18n="mExample">Example</h4>
        <div class="ref-mini"><span data-i18n="mWeight2kg">Weight 2 kg</span><span>Cost Rate RM3.50/kg</span></div>
        <p><strong><span data-i18n="mMatCostEg">Material Cost = 2 × 3.50 = RM7.00</span></strong></p></div>
    </div>
    <div class="ref-panel" id="ref-addcost">
      <div class="ref-note"><h4>Additional Cost <span class="zh">额外加工费</span></h4>
        <p>Used for extra work, such as:</p>
        <div class="ref-mini"><span>Thread processing</span><span>Drilling</span><span>Welding</span><span>Special process</span><span>Extra customer requirement</span></div></div>
      <div class="ref-note"><h4 data-i18n="mExample">Example</h4>
        <div class="ref-mini"><span>Material Cost RM7.00</span><span>Additional Cost RM2.00</span></div>
        <p><strong>Base Price = RM7.00 + RM2.00 = RM9.00</strong></p></div>
    </div>
    <div class="ref-panel" id="ref-pricemode">
      <div class="ref-note"><h4>Auto Round</h4>
        <p>The system applies the product's existing rounding rule automatically.</p>
        <div class="ref-mini"><span>Calculated RM3.47</span><span>→ Final Price by rounding rule</span></div></div>
      <div class="ref-note"><h4>No Round</h4>
        <p>Keep the calculated price exactly as it is — no rounding applied.</p>
        <div class="ref-mini"><span>Calculated RM3.47</span><span>Final RM3.47</span></div></div>
      <div class="ref-note"><h4>Manual Price</h4>
        <p>Staff enters the final customer selling price directly.</p>
        <div class="ref-mini"><span>Calculated RM3.47</span><span>Customer Price RM4.00</span></div>
        <p><strong>System uses: RM4.00</strong></p></div>
    </div>
    <div class="ref-panel" id="ref-examples">
      <div class="ref-note"><h4>Sag Rod / Stud / Anchor Bolt</h4>
        <p>Material: MS &nbsp;·&nbsp; Cost Rate: RM/kg</p>
        <p class="cn">Thread Length may automatically affect Additional Cost.</p></div>
      <div class="ref-note"><h4>U-Bolt / SQ U-Bolt / L Bolt / J Bolt</h4>
        <p>Cost Rate is usually entered manually.</p>
        <p>Additional Cost is used for: Nut, FW, extra processing.</p></div>
      <div class="ref-note"><h4>Plate</h4>
        <p>Hole drilling / punching / laser cutting cost goes into Additional Cost.</p>
        <div class="ref-mini"><span>Plate RM10.00</span><span>Drilling RM2.00</span></div>
        <p><strong>Base = RM10.00 + RM2.00 = RM12.00</strong></p></div>
    </div>
  </div>
</div>

<!-- ═══ SAVE MODAL ═══ -->
<div class="modal-overlay" id="saveModal">
  <div class="modal">
    <div class="modal-title" id="saveModalTitle"><span data-i18n="saveQuotation">Save Quotation</span> <button class="modal-close" onclick="closeModal('saveModal')">✕</button></div>
    <div class="modal-grid">
      <div class="field full"><label data-i18n="mCompany">Company</label>
        <select id="sv-company"><option value="" data-i18n="mNoCompanyStandalone">— No company (standalone) —</option></select></div>
      <div class="field"><label data-i18n="lblQuotationNo">Quotation No.</label><input type="text" id="sv-refno"></div>
      <div class="field"><label data-i18n="lblDate">Date</label><input type="date" id="sv-date"></div>
      <div class="field"><label data-i18n="lblPreparedBy">Prepared By</label><input type="text" id="sv-prepby"></div>
      <div class="field full"><label data-i18n="mRemarks">Remarks</label><input type="text" id="sv-remarks"></div>
    </div>
    <div class="modal-btns">
      <button class="btn btn-save" id="saveModalSubmitBtn" onclick="doSaveQuotation()" data-i18n="saveQuotation">Save Quotation</button>
      <button class="btn btn-ghost" onclick="closeModal('saveModal')" data-i18n="cancel">Cancel</button>
    </div>
  </div>
</div>

<!-- Unsaved draft recovery -->
<div class="modal-overlay" id="draftRecoveryModal">
  <div class="modal" style="max-width:460px">
    <div class="modal-title"><span data-i18n="mRestoreTitle">Restore unsaved draft?</span> <span class="sub" style="display:block" data-i18n="mRestoreTitleZh">Restore unsaved draft?</span></div>
    <div class="draft-recovery-copy">
      <span data-i18n="mRestoreSub">You have an unsaved quotation draft. Restore it or discard it?</span>
      <span class="sub" style="display:block;margin-top:3px" data-i18n="mRestoreSubZh">You have an unsaved quotation draft. Restore it or discard it?</span>
      <span class="draft-recovery-time" id="draftRecoveryTime"></span>
    </div>
    <div class="modal-btns">
      <button class="btn btn-save" type="button" onclick="restoreUnsavedDraft()"><span data-i18n="restoreDraft">Restore Draft</span></button>
      <button class="btn btn-ghost" type="button" onclick="discardUnsavedDraft()"><span data-i18n="discardDraft">Discard</span></button>
    </div>
  </div>
</div>

<!-- ═══ DEFAULT PRICE SETTINGS MODAL ═══ -->
<div class="modal-overlay" id="dpModal">
  <div class="modal" style="max-width:800px">
    <div class="modal-title"><span data-i18n="mDefaultPriceSettings">Default Price Settings</span> <span style="font-size:11px;font-weight:500;color:var(--text-muted)" data-i18n="mSavedToMysql">saved to MySQL</span><button class="modal-close" onclick="closeModal('dpModal')">✕</button></div>

    <!-- Master Data Tools -->
    <div class="mdt-box">
      <div class="mdt-title"><span data-i18n="mMasterData">Master Data Tools</span> <span class="mdt-sub" data-i18n="mDefaultPriceRules">Default Price Rules</span></div>
      <div class="mdt-actions">
        <a class="btn btn-ghost btn-sm" href="api.php?action=default_price_template" data-i18n="mDownloadTemplate">Download Template</a>
        <button class="btn btn-ghost btn-sm" onclick="mdtPickFile('dp')" data-i18n="mImportExcel">Import Excel</button>
        <a class="btn btn-ghost btn-sm" href="api.php?action=export_default_prices" data-i18n="mExportCurrent">Export Current</a>
        <input type="file" id="dpImportFile" accept=".csv" style="display:none" onchange="mdtImportFileSelected('dp',this)">
      </div>
      <div class="mdt-preview" id="dpImportPreview" style="display:none">
        <div class="mdt-preview-summary" id="dpImportSummary"></div>
        <div class="mdt-preview-list" id="dpImportDetails"></div>
        <div class="mdt-preview-actions">
          <button class="btn btn-primary btn-sm" onclick="mdtConfirmImport('dp')">Confirm Import</button>
          <button class="btn btn-ghost btn-sm" onclick="mdtCancelImport('dp')" data-i18n="cancel">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Add / Edit Form -->
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px" id="dpFormTitle" data-i18n="mAddDefaultRule">Add Default Price Rule</div>
      <input type="hidden" id="dp-edit-id">
      <div class="dp-form-grid">
        <div class="dp-section-label" data-i18n="mMatchCriteria">Match Criteria</div>
        <div class="field"><label data-i18n="lblProductType">Product Type</label>
          <select id="dp-type" onchange="onDPMaterialChange()">
            <option value="sagrod">Sag Rod</option>
            <option value="stud">Stud</option>
            <option value="anchorbolt">Anchor Bolt</option>
            <option value="ubolt">U-Bolt</option>
            <option value="squbolt">SQ U-Bolt</option>
            <option value="lbolt">L Bolt</option>
            <option value="lbolt45">L Bolt 45DEG</option>
            <option value="jbolt">J Bolt</option>
          </select></div>
        <div class="field"><label data-i18n="lblMaterial">Material</label>
          <select id="dp-material" onchange="onDPMaterialChange()">
            <option>MS</option><option>S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option><option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option>SS304</option><option>SS316</option><option value="Y_BAR">Y BAR</option>
          </select></div>
        <div class="field" id="dp-sizeType-field"><label data-i18n="lblSizeType">Size Type</label>
          <select id="dp-sizeType"><option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option></select></div>
        <div class="field"><label data-i18n="lblSize">Size</label><input type="text" id="dp-size" placeholder="M12" list="sizeOptions"></div>
        <div class="field" id="dp-finish-field"><label data-i18n="lblFinish">Finish</label>
          <select id="dp-finish">
            <option value="">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option>
          </select></div>
        <div class="dp-section-label" data-i18n="mDefaultPricing">Default Pricing</div>
        <div class="field"><label>Cost Rate <small style="color:var(--text-muted);font-weight:500">RM/kg</small></label><input type="number" id="dp-costRate" step="0.01" placeholder="0.00" min="0"></div>
        <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="number" id="dp-addCost" step="0.01" placeholder="0.00" min="0"></div>
        <div class="field"><label><span data-i18n="lblMarkup">Markup</span> <small style="color:var(--text-muted);font-weight:500">%</small></label><input type="number" id="dp-markup" step="1" placeholder="0" min="0"></div>
        <div class="dp-section-label" data-i18n="mStatus">Status</div>
        <div class="field"><label data-i18n="mRuleStatus">Rule Status</label>
          <select id="dp-active"><option value="1" data-i18n="mActive">Active</option><option value="0" data-i18n="mDisabled">Disabled</option></select></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="saveDPRule()" data-i18n="saveRule">Save Rule</button>
        <button class="btn btn-ghost" onclick="resetDPForm()" data-i18n="mClear">Clear</button>
      </div>
    </div>

    <!-- List -->
    <div style="font-size:12px;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px"><span data-i18n="mSavedRules">Saved Rules</span> <span class="count-pill" id="dpRuleCount">0</span></div>
    <div class="settings-mode-row">
      <div class="settings-mode-buttons">
        <button class="settings-mode-btn active" id="dpModeCustom" onclick="setDPSourceMode('custom')" data-i18n="mSrcCustom">Custom</button>
        <button class="settings-mode-btn" id="dpModeSystem" onclick="setDPSourceMode('system')" data-i18n="mSrcSystem">System</button>
        <button class="settings-mode-btn" id="dpModeAll" onclick="setDPSourceMode('all')" data-i18n="mSrcAll">All</button>
      </div>
      <div class="settings-count-text" id="dpCountText"><span data-i18n="mShowingRules">Showing rules</span></div>
    </div>
    <div class="settings-filter-grid">
      <div class="field"><label data-i18n="lblProductType">Product Type</label><select id="dpFilterType" onchange="renderDPList()"><option value="" data-i18n="mSrcAll">All</option><option value="sagrod">Sag Rod</option><option value="stud">Stud</option><option value="anchorbolt">Anchor Bolt</option><option value="ubolt">U-Bolt</option><option value="squbolt">SQ U-Bolt</option><option value="lbolt">L Bolt</option><option value="lbolt45">L Bolt 45DEG</option><option value="jbolt">J Bolt</option></select></div>
      <div class="field"><label data-i18n="lblMaterial">Material</label><select id="dpFilterMaterial" onchange="renderDPList()"><option value="" data-i18n="mSrcAll">All</option><option>MS</option><option>S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option><option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option>SS304</option><option>SS316</option><option value="Y_BAR">Y BAR</option></select></div>
      <div class="field"><label data-i18n="lblSizeType">Size Type</label><select id="dpFilterSizeType" onchange="renderDPList()"><option value="" data-i18n="mSrcAll">All</option><option value="FULLSIZE">FULLSIZE</option><option value="UNDERSIZE">UNDERSIZE</option><option value="NO_SIZE_TYPE" data-i18n="mNoSizeType">No Size Type</option></select></div>
      <div class="field"><label data-i18n="lblFinish">Finish</label><select id="dpFilterFinish" onchange="renderDPList()"><option value="" data-i18n="mSrcAll">All</option><option value="NA">N/A</option><option value="PL">PL</option><option value="ZP">ZP</option><option value="HDG">HDG</option></select></div>
      <div class="field"><label data-i18n="mStatus">Status</label><select id="dpFilterSource" onchange="syncDPModeButtons();renderDPList()"><option value="custom" data-i18n="mCustomOnly">Custom Only</option><option value="system" data-i18n="mSystemDefaults">System Defaults</option><option value="all" data-i18n="mSrcAll">All</option></select></div>
      <div class="field"><label data-i18n="mSizeSearch">Size Search</label><input type="text" id="dpSearch" data-i18n-ph="phSearchSize" placeholder="Search size, e.g. M12" oninput="renderDPList()"></div>
    </div>
    <div class="dp-table-wrap">
      <table class="dp-table">
        <thead><tr>
          <th data-i18n="mThType">Type</th><th data-i18n="lblMaterial">Material</th><th>Size Type</th><th data-i18n="lblSize">Size</th><th data-i18n="lblFinish">Finish</th>
          <th>Cost Rate</th><th data-i18n="mAddCost">Add. Cost</th><th data-i18n="lblMarkup">Markup</th><th data-i18n="mSource">Source</th><th data-i18n="mStatus">Status</th><th></th>
        </tr></thead>
        <tbody id="dpListBody"></tbody>
      </table>
    </div>
    <div class="dp-empty" id="dpEmpty" style="display:none">No rules saved yet. Add a rule above to auto-fill pricing fields when an item matches.</div>
  </div>
</div>

<!-- ═══ WHATSAPP MESSAGE TEMPLATE MODAL ═══ -->
<div class="modal-overlay" id="waTemplateModal">
  <div class="modal" style="max-width:680px">
    <div class="modal-title">
      WhatsApp Message Template
      <span style="display:block;font-size:11.5px;font-weight:600;color:var(--text-muted);margin-top:2px" data-i18n="waTemplateSub">WhatsApp message template</span>
      <button class="modal-close" onclick="closeModal('waTemplateModal')" style="align-self:flex-start">✕</button>
    </div>

    <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
      <span data-i18n="mPlaceholders">Placeholders:</span> <code>{customer}</code> <code>{quotationNo}</code> <code>{no}</code> <code>{date}</code> <code>{total}</code> <code>{items}</code> <code>{preparedBy}</code>
    </p>

    <div class="field" style="margin-bottom:10px">
      <label data-i18n="mMessageTemplate">Message Template</label>
      <textarea id="waTemplateInput" rows="10" style="font-family:monospace;font-size:13px;line-height:1.5;resize:vertical"></textarea>
    </div>

    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px"><span data-i18n="preview">Preview</span></div>
      <pre id="waTemplatePreview" style="font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;font-family:inherit;margin:0;color:var(--text)"></pre>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-wa" onclick="copyWATemplatePreview()"><span data-i18n="copyPreview">Copy Preview</span></button>
      <button class="btn btn-primary" onclick="saveWATemplate()"><span data-i18n="saveTemplate">Save Template</span></button>
      <button class="btn btn-ghost" onclick="resetWATemplate()"><span data-i18n="resetDefault">Reset to Default</span></button>
      <button class="btn btn-ghost" style="margin-left:auto" onclick="closeModal('waTemplateModal')" data-i18n="close">Close</button>
    </div>
  </div>
</div>

<!-- ═══ DIAMETER SETTINGS MODAL ═══ -->
<div class="modal-overlay" id="dsModal">
  <div class="modal" style="max-width:760px">
    <div class="modal-title">
      <span data-i18n="sideDiameterSettings">Diameter Settings</span>
      <button class="modal-close" onclick="closeModal('dsModal')">✕</button>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px" data-i18n="mDsHelp">Custom diameter rules take priority over built-in defaults. Leave Size blank to match all sizes of a product+material combination.</p>

    <!-- Master Data Tools -->
    <div class="mdt-box">
      <div class="mdt-title"><span data-i18n="mMasterData">Master Data Tools</span> <span class="mdt-sub" data-i18n="mDiameterRules">Diameter Rules</span></div>
      <div class="mdt-actions">
        <a class="btn btn-ghost btn-sm" href="api.php?action=diameter_template" data-i18n="mDownloadTemplate">Download Template</a>
        <button class="btn btn-ghost btn-sm" onclick="mdtPickFile('ds')" data-i18n="mImportExcel">Import Excel</button>
        <a class="btn btn-ghost btn-sm" href="api.php?action=export_diameter_settings" data-i18n="mExportCurrent">Export Current</a>
        <input type="file" id="dsImportFile" accept=".csv" style="display:none" onchange="mdtImportFileSelected('ds',this)">
      </div>
      <div class="mdt-preview" id="dsImportPreview" style="display:none">
        <div class="mdt-preview-summary" id="dsImportSummary"></div>
        <div class="mdt-preview-list" id="dsImportDetails"></div>
        <div class="mdt-preview-actions">
          <button class="btn btn-primary btn-sm" onclick="mdtConfirmImport('ds')">Confirm Import</button>
          <button class="btn btn-ghost btn-sm" onclick="mdtCancelImport('ds')" data-i18n="cancel">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Add / Edit Form -->
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px" id="dsFormTitle"><span data-i18n="addDiameterRule">Add Diameter Rule</span></div>
      <input type="hidden" id="ds-edit-id">
      <div class="ds-form-grid">
        <div class="field"><label><span data-i18n="lblProductType">Product Type</span></label>
          <select id="ds-type" onchange="onDSTypeChange()">
            <option value="sagrod">Sag Rod</option>
            <option value="stud">Stud</option>
            <option value="anchorbolt">Anchor Bolt</option>
            <option value="ubolt">U-Bolt</option>
            <option value="squbolt">SQ U-Bolt</option>
            <option value="lbolt">L Bolt</option>
            <option value="lbolt45">L Bolt 45DEG</option>
            <option value="jbolt">J Bolt</option>
          </select></div>
        <div class="field"><label><span data-i18n="lblMaterial">Material</span></label>
          <select id="ds-material">
            <option value="MS">MS</option><option value="S45C">S45C</option>
            <option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option>
            <option value="4140">4140 QT</option><option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option>
            <option value="4140_PLAIN">4140</option>
            <option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option>
          </select></div>
        <div class="field" id="ds-sizeType-field"><label data-i18n="lblSizeType">Size Type</label>
          <select id="ds-sizeType">
            <option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option>
          </select></div>
        <div class="field"><label><span data-i18n="lblSize">Size</span></label>
          <input type="text" id="ds-size" list="sizeOptions" placeholder="M12"></div>
        <div class="field"><label><span data-i18n="lblDiameterMm">Diameter (mm)</span></label>
          <input type="number" id="ds-diameter" step="0.01" placeholder="10.6" min="0"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="saveDSRule()"><span data-i18n="saveRule">Save Rule</span></button>
        <button class="btn btn-ghost" onclick="resetDSForm()" data-i18n="mClear">Clear</button>
      </div>
    </div>

    <!-- Filter + List -->
    <div style="font-size:12px;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
      <span data-i18n="savedDiameterRules">Saved Diameter Rules</span> <span class="count-pill" id="dsRuleCount">0</span>
    </div>
    <div class="settings-mode-row">
      <div class="settings-mode-buttons">
        <button class="settings-mode-btn active" id="dsModeCustom" onclick="setDSSourceMode('custom')" data-i18n="mSrcCustom">Custom</button>
        <button class="settings-mode-btn" id="dsModeSystem" onclick="setDSSourceMode('system')" data-i18n="mSrcSystem">System</button>
        <button class="settings-mode-btn" id="dsModeAll" onclick="setDSSourceMode('all')" data-i18n="mSrcAll">All</button>
      </div>
      <div class="settings-count-text" id="dsCountText"><span data-i18n="mShowingRules">Showing rules</span></div>
    </div>
    <div class="settings-filter-grid">
      <div class="field"><label data-i18n="lblProductType">Product Type</label><select id="dsFilterType" onchange="renderDSList()"><option value="" data-i18n="mSrcAll">All</option><option value="sagrod">Sag Rod</option><option value="stud">Stud</option><option value="anchorbolt">Anchor Bolt</option><option value="ubolt">U-Bolt</option><option value="squbolt">SQ U-Bolt</option><option value="lbolt">L Bolt</option><option value="lbolt45">L Bolt 45DEG</option><option value="jbolt">J Bolt</option></select></div>
      <div class="field"><label data-i18n="lblMaterial">Material</label><select id="dsFilterMaterial" onchange="renderDSList()"><option value="" data-i18n="mSrcAll">All</option><option>MS</option><option>S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option><option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option>SS304</option><option>SS316</option><option value="Y_BAR">Y BAR</option></select></div>
      <div class="field"><label data-i18n="lblSizeType">Size Type</label><select id="dsFilterSizeType" onchange="renderDSList()"><option value="" data-i18n="mSrcAll">All</option><option value="FULLSIZE">FULLSIZE</option><option value="UNDERSIZE">UNDERSIZE</option><option value="NO_SIZE_TYPE" data-i18n="mNoSizeType">No Size Type</option></select></div>
      <div class="field"><label data-i18n="mStatus">Status</label><select id="dsFilterSource" onchange="syncDSModeButtons();renderDSList()"><option value="custom" data-i18n="mCustomOnly">Custom Only</option><option value="system" data-i18n="mSystemDefaults">System Defaults</option><option value="all" data-i18n="mSrcAll">All</option></select></div>
      <div class="field"><label data-i18n="mSizeSearch">Size Search</label><input type="text" id="dsSearch" data-i18n-ph="phSearchSize" placeholder="Search size, e.g. M12" oninput="renderDSList()"></div>
    </div>
    <div class="dp-table-wrap">
      <table class="dp-table">
        <thead><tr>
          <th data-i18n="mThType">Type</th><th data-i18n="lblMaterial">Material</th><th>Size Type</th><th data-i18n="lblSize">Size</th><th data-i18n="lblDiameterMm">Diameter (mm)</th><th data-i18n="mStatus">Status</th><th></th>
        </tr></thead>
        <tbody id="dsListBody"></tbody>
      </table>
    </div>
    <div class="dp-empty" id="dsEmpty" style="display:none">No custom diameter rules yet. Add a rule above to override built-in defaults.</div>
    <div style="margin-top:10px">
      <button class="btn btn-ghost btn-sm" onclick="if(confirm('Delete all custom diameter rules?')){clearAllDSRules();}" data-i18n="mResetAllRules">Reset All Rules</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
/* ══════════════════════════════════════════════════════
   PRODUCTION — MySQL production data through api.php.
   Formulas below are copied unchanged from the production
   quotation system (index.php) — do not alter the math.
══════════════════════════════════════════════════════ */
/* ═══════════════════ i18n runtime — EN / 中文 ═══════════════════════════════
   PRESENTATION ONLY. Nothing here reads or writes quotation data. No stored
   value, API payload, customer name, quotation ref or internal product /
   material / finish code passes through it — switching language re-labels the
   UI and changes nothing else.

   The helper is dcT(), NOT t(). This script already uses `const t=` as a local
   in ten functions (getPlateType, the toast, wqaAiApply and others), and a
   global t() would be shadowed inside every one of them — t('someKey') there
   would try to call a string. Renaming those locals would mean editing
   business logic inside a localisation change, so the helper takes a name that
   can never collide instead.

   Dictionary shape — the later localisation commits fill this in:
     I18N.en.someKey = 'English text'
     I18N.zh.someKey = '中文'
   Markup opts in per attribute, so one element can localise several parts:
     <span   data-i18n="key">        textContent
     <input  data-i18n-ph="key">     placeholder
     <button data-i18n-aria="key">   aria-label
     <a      data-i18n-title="key">  title
   A key with no zh entry falls back to en, then to the key itself, so a
   missing translation degrades to readable text rather than a blank element —
   which is what makes a staged rollout safe. */
const DC_LANG_KEY='dc_lang', DC_LANGS=['en','zh'];
/* Product names (Sag Rod, U-Bolt …), materials (MS, 4140 QT, Y BAR …),
   finishes (PL/ZP/HDG), Fullsize/Undersize, M-sizes, TL, RM and kg/pc are
   deliberately absent from this table: they are the trade's vocabulary and
   read the same to staff in either mode. Chinese here is the surrounding UI,
   not the industry terms. Where the app already carried an in-house
   translation, that exact wording is reused rather than reinvented. */
const I18N={
  en:{
    language:'Language', langAria:'Language', langSwitched:'Language set to English',
    /* header + sidebar */
    navCalculator:'Calculator', navCompanies:'Companies', navSignOut:'Sign Out',
    navSignOutTitle:'Sign out on this device only',
    sideQuickMenu:'Quick Menu', sideNewQuotation:'New Quotation', sideCompanies:'Companies / Saved',
    sideDefaultPrices:'Default Prices', sideDiameterSettings:'Diameter Settings',
    sidePricingGuide:'Pricing Guide', sideVersionUpdates:'Version Updates',
    /* stepper + quick open */
    step1:'Customer', step2:'Add Items', step3:'Review & Save', step4:'Print / WhatsApp',
    quickOpen:'Quick Open', open:'Open', ariaQuotationNo:'Quotation number',
    /* step 1 — customer */
    step1Caption:'Step 1 · Customer', step1Sub:'Customer details',
    newQuotation:'New Quotation', noCustomerYet:'No customer yet',
    quotationNoDash:'Quotation No. —', dateDash:'Date —', statusNewDraft:'New Draft',
    editSavedQuotation:'Edit Saved Quotation', editDetails:'Edit Details',
    lockedTitle:'This quotation is locked.', lockedText:'Editing requires unlocking.',
    lblCustomerName:'Customer Name', phCustomerName:'Select or type customer name',
    lblContactPhone:'Contact / Phone', phContactNumber:'Contact number',
    lblQuotationNo:'Quotation No.', phAutoGenerated:'Auto-generated',
    lblDate:'Date', lblPreparedBy:'Prepared By', phPreparedBy:'Prepared by',
    lblIssuedBy:'Issued By', optNoCompanyHeader:'— No company header —',
    lblRemarks:'Remarks / Notes', phRemarks:'Price subject to change without prior notice',
    /* step 2 — product entry */
    step2Caption:'Step 2 · Add Items', step2Sub:'Add items', itemEntry:'Item Entry',
    productEntry:'Product Entry', dimensionEntry:'Dimension Entry',
    pricingEntry:'Pricing Entry', pricing:'Pricing',
    /* field labels */
    lblMaterial:'Material', lblFinish:'Finish', lblSizeType:'Size Type', lblSize:'Size',
    lblDiameter:'Diameter', lblLength:'Length', lblLengthMm:'Length (mm)',
    lblLengthMmParen:'Length (mm)', lblTotalLength:'Total Length',
    lblThreadLength:'Thread Length', lblQty:'Qty', lblQTY:'QTY', lblQtyPerSet:'Qty per Set',
    lblThickness:'Thickness', lblThicknessMm:'Thickness (mm)', lblWidth:'Width',
    lblWidthMm:'Width (mm)', lblHeight:'Height', lblHeightMm:'Height (mm)',
    lblHoles:'Holes', lblHoleOption:'Hole Option', lblHoleDia:'Hole Dia.',
    lblHoleDiaMm:'Hole Dia. (mm)', lblProductType:'Product Type',
    lblCostRate:'Cost Rate', lblAdditionalCost:'Additional Cost', lblMarkup:'Markup',
    lblUnitPrice:'Unit Price', lblManualUnitPrice:'Manual Unit Price (RM)', lblPriceMode:'Price Mode',
    phEnterLength:'Enter length', phEnterThreadLength:'Enter thread length',
    pressEnterToAdd:'Press Enter to add',
    /* finish tooltips */
    ttNotApplicable:'Not applicable', ttPlain:'Plain', ttZincPlated:'Zinc Plated',
    ttHotDipGalvanized:'Hot Dip Galvanized',
    /* accessories */
    accessories:'Accessories', accToggleSub:'Nut / FW / Custom · Optional',
    accAddNut:'Add Nut', accAddFW:'Add FW',
    /* actions */
    cancelEdit:'Cancel Edit', addToQuotation:'＋ Add to Quotation', updateItem:'Update Item',
    editingItem:'Editing item #{n}', done:'Done',
    /* Quotation status badge. Written by JS around live data, so these are
       looked up rather than carried on the element. */
    statusNewDraft:'New Draft', statusUnsaved:'Unsaved Changes',
    statusSavedLocked:'Saved / Locked', statusEditing:'Editing', statusSavedUpdated:'Saved Updated',
    /* Chinese glosses under three product buttons. The product NAME stays
       English in both modes; the gloss is help text, so it is empty in EN. */
    glossPlate:'', glossWAS:'', glossOthers:'',
    /* ── WhatsApp Quick Add ── */
    cancel:'Cancel', nItems:'{n} items', needAttention:'{n} need attention',
    needs:'Needs {f}', fieldProduct:'Product', fieldSize:'Size', fieldLength:'Length',
    fieldSizeType:'Size Type', fieldThread:'Thread', fieldPrice:'Price',
    fieldValidSize:'Valid Size', wqaUnknownSize:'Size not in Diameter Settings — no weight is calculated',
    wqaUndersizeWord:'undersize',
    wqaNoDia:'no diameter in Diameter Settings — no weight, so no price',
    fieldMaterial:'Material', fieldFinish:'Finish',
    optRequired:'— required —', optNone:'— none —', wqaMixed:'Mixed',
    materialRequired:'Material was not stated in the message, so it is not guessed. Choose the material to price these items.',
    badgeNoThread:'No thread', badgeParseWarning:'Parse warning', badgeCheck:'Check {f}',
    badgeAsymmetric:'Asymmetric', badgeLastPrice:'Last price',
    wqaTitle:'WhatsApp Quick Add', wqaAriaMethod:'Input method', wqaAriaView:'View',
    wqaDiscardTitle:'Discard Quick Add changes?',
    wqaDiscardSub:'The pasted text, parsed items, pricing entry and accessories in this session will be lost.',
    wqaKeepEditing:'Keep Editing', wqaDiscard:'Discard',
    wqaTabPaste:'Paste WhatsApp Text', wqaTabUpload:'Upload Photo / PDF',
    wqaSourceFile:'Source', wqaImage:'Image', wqaBodyDia:'Body Dia',
    wqaNotPriced:'not priced in Quick Add', wqaNoCalcDia:'missing calculation diameter',
    wqaRadius:'Radius', wqaEvidenceOnly:'from the drawing — not a quotation field',
    wqaNoteLabel:'Additional info for analysis', wqaNoteOpt:'Optional / 可选',
    wqaNotePh:'H 530, ID 100, TL 75, W 80',
    wqaNoteRead:'Will be applied:', wqaNoteBadge:'From your note:',
    wqaNoteUsed:'Your additional info was applied to {n} item(s) — it overrides the document.',
    wqaNoteUnused:'Part of your additional info was not applied: it names no product and the document has more than one item. Write the product first, e.g. "L BOLT TL 100".',
    wqaConflictBadge:'Conflicting product',
    wqaConflictWhy:'Conflicting product: "{p}" wording vs {g} geometry — choose the product',
    wqaSpecCol:'Spec',
    cdimAdvTitle:'Advanced / Additional Drawing Information', cdimAdvTitleZh:'额外图纸资料',
    cdimHeading:'Custom Dimensions', cdimHeadingZh:'自定义尺寸',
    cdimTitle:'Extra Drawing Dimensions',
    cdimSub:"Not part of the product's own dimensions · Optional",
    cdimOne:'extra', cdimMany:'extra',
    cdimAdd:'+ Add Dimension', cdimLabelPh:'Dimension', cdimValuePh:'Value',
    cdimRemove:'Remove this dimension', cdimPrefix:'Custom:',
    cdimHint:"Optional. Extra dimensions from a drawing — e.g. A 120. Never used in any weight or price, and never a substitute for the product's own fields.",
    wqaPasteHint:"Paste the customer's WhatsApp message. Sag Rod, Stud and Anchor Bolt are supported.",
    wqaUploadHint:"Upload a screenshot, photo, drawing or PDF of the customer's request. JPG / PNG / WEBP up to 10 MB, PDF up to 20 MB (max 10 pages). One file per analysis.",
    wqaDropMain:'Drop image or PDF here', wqaDropOr:'or', wqaChooseFile:'Choose File…',
    wqaNoFile:'No file selected', wqaAnalyzing:'Analyzing document…',
    wqaExtracting:'Extracting product, dimensions and quantities…',
    wqaPrivacy:'Uploaded files are used only for AI extraction and are not saved with the quotation.',
    wqaParseItems:'Parse Items', wqaAnalyze:'Analyze',
    wqaCompact:'Compact', wqaExpanded:'Expanded', wqaEditPasted:'← Edit pasted text',
    wqaViewLabel:'View', wqaBulkTitle:'Bulk Edit', wqaBulkSub:'One shared value, many items',
    wqaNSelected:'{n} selected',
    wqaBackToUpload:'← Back to upload', wqaSourceTitle:'WhatsApp Message',
    wqaChooseInput:'← Choose Input', wqaChooseHint:'How did the customer send the request?',
    wqaSourceLines:'{n} lines', wqaSourceEdit:'Edit message',
    wqaAddItems:'Add Items to Quotation', wqaAddNItems:'Add {n} Items to Quotation', wqaZeroItems:'0 items', aiAssisted:'✨ AI assisted',
    notSet:'Not set', none:'None',
    pmAutoRound:'Auto Round', pmNoRound:'No Round', pmManualPrice:'Manual Price',
    sizeTypeRequired:'Size Type is required for {p} — it was not stated in the message, so it is not guessed.',
    wqaMsgUnsupported:'Detected as {p} — not supported by Quick Add yet. Please add these manually.',
    wqaTextAnalyzing:'Reading the message…',
    wqaCannotRead:'Could not confidently read this message. Please edit the pasted text or enter the items manually.',
    errNoText:'No text was supplied.',
    errTextTooLong:'That message is too long to analyze. Trim it and try again.',
    wqaCommonItemTitle:'Common Item Fields', wqaApplyToAll:'Apply to All',
    wqaApplyToSelected:'Apply to Selected', wqaScopeAll:'All Items',
    wqaScopeSelected:'Selected Items', wqaNIncomplete:'{n} incomplete',
    wqaApplyAll:'Apply to All Items', wqaApplySelected:'Apply to {n} Selected Items',
    wqaApplyPriceAll:'Apply Pricing to All Items', wqaApplyPriceSelected:'Apply Pricing to {n} Selected',
    wqaApplyManualAll:'Apply Manual Unit Price to All',
    wqaApplyManualSelected:'Apply Manual Unit Price to {n} Selected',
    wqaToastNoneSelected:'Tick at least one item first',
    wqaCommonFixTitle:'Correct Items', wqaFixKeep:'— Keep existing —',
    wqaFixNone:'Keep existing',
    wqaFixNothingYet:'Nothing chosen yet — Apply would change nothing',
    wqaFixWillSet:'Will set: {f}', wqaFixWillFill:'Will fill where blank: {f}',
    wqaFixBlanksOnly:'Fill blanks only',
    wqaFixNote:'“Keep existing” = unchanged. “Fill blanks only” fills empty values and never replaces one. Nothing is written until Apply.',
    wqaToastFixNothing:'Choose at least one field to change first',
    wqaToastFixApplied:'{n} item(s) corrected',
    wqaToastFixNoChange:'Nothing changed — those items already say that',
    wqaCommonPriceTitle:'Pricing Entry', wqaCommonAccTitle:'Accessories',
    wqaMsgNoRows:'No item rows could be read from this file. Try again or paste the text manually.',
    wqaMsgCannotAnalyze:'Could not analyze this file. Try again or paste the text manually.',
    wqaMsgNoProduct:'Could not read a supported product from this file. Try again or paste the text manually.',
    wqaMsgNoLines:'No item lines found. Each line needs dimensions, e.g. "m12 x 1000 x 100 - 2pcs".',
    wqaMsgPasteFirst:'Paste the customer text first.',
    wqaDropNoFile:'That drop did not contain a file. Drop a JPG, PNG, WEBP or PDF.',
    wqaToastEnterSizeThread:'Enter a Size or a Thread first', wqaToastNoItems:'There are no items to apply to',
    wqaToastPriceApplied:'Pricing entry applied to all items',
    wqaToastLastPriceOff:'Last Price switched off on {n} row(s)',
    wqaToastAccCleared:'Accessories cleared on all items',
    wqaToastSetManual:'Set Price Mode to Manual Price first',
    wqaToastEnterManual:'Enter a manual unit price first',
    /* Server error codes -> UI language. The endpoint keeps returning its
       English message for backward compatibility; the code is what we map. */
    errNoFile:'Upload exactly one file.', errTooLarge:'That file is larger than the server allows.',
    errUploadFailed:'The upload did not complete. Please try again.', errEmptyFile:'The file is empty.',
    errNoFileinfo:'AI upload validation is unavailable because the PHP fileinfo extension is not enabled on this server.',
    errTooManyPages:'PDFs are limited to 10 pages for analysis.',
    errNetwork:'Could not reach the analysis service. Check the connection and try again.',
    errAuth:"The analysis service rejected the server's credentials. Ask the administrator to check the API key.",
    errRate:'The analysis service is busy. Wait a moment and try again.',
    errUpstream:'The analysis service had a problem. Try again shortly.',
    errRequest:'Could not analyze this file. Try again or paste the text manually.',
    errMethod:'Could not analyze this file. Try again or paste the text manually.',
    errNotConfigured:'AI extraction is not configured on this server yet.',
    errAiOutputInvalid:'Could not analyze this file. Try again or paste the text manually.',
    errUnsupportedType:'Only JPG, PNG, WEBP images and PDF files are supported.',
    errPdfTooLarge:'PDF files must be 20 MB or smaller.',
    errImgTooLarge:'Images must be 10 MB or smaller.',
    /* ── step 3 / 4, modals, breakdown ── */
    brandSub:'Quotation System · v2.24.0',
    step3Caption:'Step 3 · Review & Save', step4Caption:'Step 4 · Print / WhatsApp',
    quotationList:'Quotation List', quotationTotal:'Quotation Total',
    clearAll:'Clear All', noItemsYet:'No items yet',
    newestFirst:'Newest First', oldestFirst:'Oldest First', sort:'Sort',
    saveQuotation:'Save Quotation', updateQuotation:'Update Quotation',
    print:'Print', copy:'Copy', close:'Close',
    restoreDraft:'Restore Draft', discardDraft:'Discard',
    preview:'Preview', copyPreview:'Copy Preview',
    saveTemplate:'Save Template', resetDefault:'Reset to Default',
    addDiameterRule:'Add Diameter Rule', editDiameterRule:'Edit Diameter Rule',
    savedDiameterRules:'Saved Diameter Rules', saveRule:'Save Rule',
    lblDiameterMm:'Diameter (mm)',
    prevQuotedPrices:'Previous Quoted Prices', checkPrevPrices:'Check Previous Prices',
    lblManualWeight:'Manual Weight', lblDiaXLength:'Diameter × Length',
    lblUnitWeight:'Unit Weight', lblBasePrice:'Base Price',
    lblFinalUnitPrice:'Final Unit Price', lblRawPrice:'Raw Price',
    mCompany:'Company', mRemarks:'Remarks', mNoCompanyStandalone:'— No company (standalone) —',
    mRestoreTitle:'Restore unsaved draft?',
    mRestoreSub:'You have an unsaved quotation draft. Restore it or discard it?',
    mDefaultApplied:'Default price applied', mManageRules:'Manage rules',
    mProductExamples:'Product Examples', mExample:'Example',
    mDefaultPriceSettings:'Default Price Settings', mMasterData:'Master Data Tools',
    mDefaultPriceRules:'Default Price Rules', mDownloadTemplate:'Download Template',
    mImportExcel:'Import Excel', mExportCurrent:'Export Current',
    mAddDefaultRule:'Add Default Price Rule', mMatchCriteria:'Match Criteria',
    mDefaultPricing:'Default Pricing', mRuleStatus:'Rule Status',
    mActive:'Active', mDisabled:'Disabled', mSavedRules:'Saved Rules',
    mSizeSearch:'Size Search', mAddCost:'Add. Cost', mSource:'Source',
    mNoSizeType:'No Size Type', mCustomOnly:'Custom Only', mSystemDefaults:'System Defaults',
    mDiameterRules:'Diameter Rules', mResetAllRules:'Reset All Rules',
    mMessageTemplate:'Message Template', mPlaceholders:'Placeholders:',
    wqaOpenSub:'Paste customer text · Sag Rod / Stud / Anchor Bolt',
    /* ── commit 5: settings modals, guide, placeholders, toasts ── */
    optNone:'— none —', mThType:'Type',
    step3Sub:'Review & save', step4Sub:'Print / WhatsApp', itemsUnit:'items', save:'Save',
    pricingGuideSub:'Pricing guide', costRateSub:'Cost per kg',
    waTemplateSub:'WhatsApp message template',
    mRestoreTitleZh:'Restore unsaved draft?',
    mRestoreSubZh:'You have an unsaved quotation draft. Restore it or discard it?',
    mCostRateExplain:'Cost Rate = the material cost per kilogram.', mRefOnly:'reference only, does not change your price',
    mSavedToMysql:'saved to MySQL', mStatus:'Status', mClear:'Clear',
    mSrcCustom:'Custom', mSrcSystem:'System', mSrcAll:'All',
    mShowingRules:'Showing rules', mDsHelp:'Custom diameter rules take priority over built-in defaults. Leave Size blank to match all sizes of a product type.',
    mWeight2kg:'Weight 2 kg', mMatCostEg:'Material Cost = 2 × 3.50 = RM7.00',
    phCwWording:'Enter c/w wording', phEnterRate:'Enter rate', phAutoCalculated:'Auto calculated',
    phManualTotalLen:'Enter manual total length', phEgEyeBolt:'e.g. EYE BOLT',
    phOptional:'Optional', phEgWelding:'e.g. welding', phOptionalQty0:'Optional when Qty is 0',
    phSearchSize:'Search size, e.g. M12',
    tQtyWhole:'Qty must be a whole number — no decimals or minus',
    tQtyMin1:'Qty must be at least 1', tQtyTooLarge:'Qty is too large — please check',
    tQtyWholeMin:'Qty must be a whole number of at least 1',
    tUnitNeg:'Unit price is negative — check Cost Rate / Markup',
    tLineNeg:'Line total is negative — check inputs',
    tIdIhNeg:'ID / IH cannot be negative', tItemUpdated:'Item updated',
    tOldNoRate:'Old item has no saved Cost Rate. Please confirm pricing.',
    tDraftRestored:'Draft restored', tDraftDiscarded:'Draft discarded',
    tSagRodAdded:'Sag Rod added', tStudAdded:'Stud added', tAnchorAdded:'Anchor Bolt added',
  },
  zh:{
    language:'语言', langAria:'语言', langSwitched:'已切换为中文',
    /* header + sidebar */
    navCalculator:'计算器', navCompanies:'公司', navSignOut:'退出',
    navSignOutTitle:'只退出此设备',
    sideQuickMenu:'快捷菜单', sideNewQuotation:'新建报价', sideCompanies:'公司 / 已保存',
    sideDefaultPrices:'默认价格', sideDiameterSettings:'直径设置',
    sidePricingGuide:'价格说明', sideVersionUpdates:'版本更新',
    /* stepper + quick open */
    step1:'客户', step2:'添加产品', step3:'检查与保存', step4:'打印',
    quickOpen:'快速打开', open:'打开', ariaQuotationNo:'报价单号',
    /* step 1 — customer */
    step1Caption:'第 1 步 · 客户', step1Sub:'客户资料',
    newQuotation:'新建报价', noCustomerYet:'尚未选择客户',
    quotationNoDash:'报价单号 —', dateDash:'日期 —', statusNewDraft:'新草稿',
    editSavedQuotation:'编辑已保存报价', editDetails:'编辑资料',
    lockedTitle:'这份报价已锁定。', lockedText:'如需修改，请先解锁编辑。',
    lblCustomerName:'客户名称', phCustomerName:'选择或输入客户名称',
    lblContactPhone:'联络电话', phContactNumber:'联络号码',
    lblQuotationNo:'报价单号', phAutoGenerated:'自动生成',
    lblDate:'日期', lblPreparedBy:'出单人', phPreparedBy:'出单人',
    lblIssuedBy:'出单公司', optNoCompanyHeader:'— 不显示公司抬头 —',
    lblRemarks:'备注', phRemarks:'价格如有变动，恕不另行通知',
    /* step 2 — product entry */
    step2Caption:'第 2 步 · 添加产品', step2Sub:'添加产品', itemEntry:'产品输入',
    productEntry:'产品资料', dimensionEntry:'尺寸资料',
    pricingEntry:'价格资料', pricing:'价格',
    /* field labels */
    lblMaterial:'材料', lblFinish:'表面处理', lblSizeType:'尺寸类型', lblSize:'尺寸',
    lblDiameter:'直径', lblLength:'长度', lblLengthMm:'长度 mm',
    lblLengthMmParen:'长度 mm', lblTotalLength:'总长度',
    lblThreadLength:'牙长', lblQty:'数量', lblQTY:'数量', lblQtyPerSet:'每套数量',
    lblThickness:'厚度', lblThicknessMm:'厚度 mm', lblWidth:'宽度',
    lblWidthMm:'宽度 mm', lblHeight:'高度', lblHeightMm:'高度 mm',
    lblHoles:'洞口数量', lblHoleOption:'开洞选择', lblHoleDia:'洞口直径',
    lblHoleDiaMm:'洞口直径 mm', lblProductType:'产品',
    lblCostRate:'每公斤成本', lblAdditionalCost:'额外加工费', lblMarkup:'利润',
    lblUnitPrice:'单价', lblManualUnitPrice:'手动单价 (RM)', lblPriceMode:'价格模式',
    phEnterLength:'输入长度', phEnterThreadLength:'输入牙长',
    pressEnterToAdd:'按 Enter 加入报价',
    /* finish tooltips */
    ttNotApplicable:'不适用', ttPlain:'素面', ttZincPlated:'电镀锌',
    ttHotDipGalvanized:'热浸镀锌',
    /* accessories */
    accessories:'配件', accToggleSub:'Nut / FW / 自定义 · 可选',
    accAddNut:'加 Nut', accAddFW:'加 FW',
    /* actions */
    cancelEdit:'取消编辑', addToQuotation:'＋ 加入报价', updateItem:'更新产品',
    editingItem:'正在编辑第 {n} 项', done:'完成',
    statusNewDraft:'新草稿', statusUnsaved:'未保存更改',
    statusSavedLocked:'已保存 / 已锁定', statusEditing:'正在编辑', statusSavedUpdated:'已更新保存',
    glossPlate:'铁板', glossWAS:'焊接锚栓组合', glossOthers:'其他 / 特殊螺栓',
    /* ── WhatsApp Quick Add ── */
    cancel:'取消', nItems:'{n} 项', needAttention:'{n} 项需检查',
    needs:'需要{f}', fieldProduct:'产品', fieldSize:'尺寸', fieldLength:'长度',
    fieldSizeType:'尺寸类型', fieldThread:'牙长', fieldPrice:'价格',
    fieldValidSize:'有效尺寸', wqaUnknownSize:'此尺寸不在直径设定中 — 不计算重量',
    wqaUndersizeWord:'小牙',
    wqaNoDia:'直径设定中没有对应直径 — 不计算重量，也不出价',
    fieldMaterial:'材料', fieldFinish:'表面处理',
    optRequired:'— 必填 —', optNone:'— 无 —', wqaMixed:'多种',
    materialRequired:'信息中未说明材料，系统不会猜测。请选择材料以计算价格。',
    badgeNoThread:'无牙长', badgeParseWarning:'解析提示', badgeCheck:'请检查 {f}',
    badgeAsymmetric:'左右不对称', badgeLastPrice:'上次价格',
    wqaTitle:'WhatsApp 快速添加', wqaAriaMethod:'输入方式', wqaAriaView:'显示方式',
    wqaDiscardTitle:'要放弃快速添加的内容吗？',
    wqaDiscardSub:'本次粘贴的文字、已解析产品、价格设置与配件都会丢失。',
    wqaKeepEditing:'继续编辑', wqaDiscard:'放弃',
    wqaTabPaste:'粘贴 WhatsApp 文字', wqaTabUpload:'上传照片 / PDF',
    wqaSourceFile:'来源文件', wqaImage:'图片', wqaBodyDia:'实际杆径',
    wqaNotPriced:'快速添加暂不支持计价', wqaNoCalcDia:'缺少计算直径',
    wqaRadius:'半径', wqaEvidenceOnly:'来自图纸 — 非报价字段',
    wqaNoteLabel:'补充分析资料', wqaNoteOpt:'选填 / Optional',
    wqaNotePh:'H 530, ID 100, TL 75, W 80',
    wqaNoteRead:'将会套用：', wqaNoteBadge:'来自补充资料：',
    wqaNoteUsed:'补充资料已套用到 {n} 个项目 — 以补充资料为准。',
    wqaNoteUnused:'部分补充资料未被套用：未指明产品，而文件有多个项目。请先写产品，例如「L BOLT TL 100」。',
    wqaConflictBadge:'产品矛盾',
    wqaConflictWhy:'产品矛盾：文字写「{p}」，但图形显示{g} — 请选择产品',
    wqaSpecCol:'规格',
    cdimAdvTitle:'进阶 / 额外图纸资料', cdimAdvTitleZh:'额外图纸资料',
    cdimHeading:'自定义尺寸', cdimHeadingZh:'自定义尺寸',
    cdimTitle:'额外图纸尺寸',
    cdimSub:'不属于该产品本身的尺寸 · 选填',
    cdimOne:'项', cdimMany:'项',
    cdimAdd:'+ 新增尺寸', cdimLabelPh:'尺寸名称', cdimValuePh:'数值',
    cdimRemove:'删除此尺寸', cdimPrefix:'自定义：',
    cdimHint:'选填。图纸上的额外尺寸，例如 A 120。不参与任何重量或价格计算，也不能代替产品本身的尺寸字段。',
    wqaPasteHint:'粘贴客户的 WhatsApp 信息。支持 Sag Rod、Stud 和 Anchor Bolt。',
    wqaUploadHint:'上传客户要求的截图、照片、图纸或 PDF。JPG / PNG / WEBP 最大 10 MB，PDF 最大 20 MB（最多 10 页）。每次只分析一个文件。',
    wqaDropMain:'把图片或 PDF 拖到这里', wqaDropOr:'或', wqaChooseFile:'选择文件…',
    wqaNoFile:'未选择文件', wqaAnalyzing:'正在分析文件…',
    wqaExtracting:'正在提取产品、尺寸与数量…',
    wqaPrivacy:'上传的文件只用于 AI 提取，不会随报价保存。',
    wqaParseItems:'解析产品', wqaAnalyze:'分析',
    wqaCompact:'精简', wqaExpanded:'展开', wqaEditPasted:'← 编辑粘贴文字',
    wqaViewLabel:'视图', wqaBulkTitle:'批量编辑', wqaBulkSub:'一个共同数值，多个项目',
    wqaNSelected:'已选 {n} 项',
    wqaBackToUpload:'← 返回上传', wqaSourceTitle:'客户原文',
    wqaChooseInput:'← 选择输入方式', wqaChooseHint:'客户是以什么方式发来的？',
    wqaSourceLines:'{n} 行', wqaSourceEdit:'编辑原文',
    wqaAddItems:'添加到报价单', wqaAddNItems:'添加 {n} 项到报价单', wqaZeroItems:'0 项', aiAssisted:'✨ AI 辅助',
    notSet:'未设置', none:'无',
    pmAutoRound:'自动进位', pmNoRound:'不进位', pmManualPrice:'手动价格',
    sizeTypeRequired:'{p} 需要选择 Size Type — 信息里没有写明，所以不作猜测。',
    wqaMsgUnsupported:'识别为 {p} — 快速添加暂不支持。请手动添加。',
    wqaTextAnalyzing:'正在识别这段内容…',
    wqaCannotRead:'无法可靠识别这段内容。请编辑粘贴文字，或手动输入产品。',
    errNoText:'没有提供文字。',
    errTextTooLong:'这段内容太长，无法分析。请精简后再试。',
    wqaCommonItemTitle:'通用项目参数', wqaApplyToAll:'应用到全部',
    wqaApplyToSelected:'应用到选定', wqaScopeAll:'全部项目',
    wqaScopeSelected:'选定项目', wqaNIncomplete:'{n} 项待补',
    wqaApplyAll:'应用到全部项目', wqaApplySelected:'应用到 {n} 个选定项目',
    wqaApplyPriceAll:'价格应用到全部项目', wqaApplyPriceSelected:'价格应用到 {n} 个选定项目',
    wqaApplyManualAll:'手动单价应用到全部',
    wqaApplyManualSelected:'手动单价应用到 {n} 个选定项目',
    wqaToastNoneSelected:'请先勾选至少一个项目',
    wqaCommonFixTitle:'批量修正', wqaFixKeep:'— 保持不变 —',
    wqaFixNone:'保持不变',
    wqaFixNothingYet:'尚未选择——按下应用不会有任何改动',
    wqaFixWillSet:'将设为：{f}', wqaFixWillFill:'仅填补空白：{f}',
    wqaFixBlanksOnly:'只填空白',
    wqaFixNote:'“保持不变” = 不改动。“只填空白” 只填补空白，不会覆盖已有的值。按下应用前不写入任何项目。',
    wqaToastFixNothing:'请先选择至少一个要修改的字段',
    wqaToastFixApplied:'已修正 {n} 个项目',
    wqaToastFixNoChange:'没有改动——这些项目已经是这个值',
    wqaCommonPriceTitle:'价格设置', wqaCommonAccTitle:'配件',
    wqaMsgNoRows:'无法从这个文件读取到产品行。请重试，或改用粘贴文字。',
    wqaMsgCannotAnalyze:'无法分析这个文件。请重试，或改用粘贴文字。',
    wqaMsgNoProduct:'无法从这个文件读出支持的产品。请重试，或改用粘贴文字。',
    wqaMsgNoLines:'找不到产品行。每一行都需要尺寸，例如 "m12 x 1000 x 100 - 2pcs"。',
    wqaMsgPasteFirst:'请先粘贴客户文字。',
    wqaDropNoFile:'拖进来的不是文件。请拖入 JPG、PNG、WEBP 或 PDF。',
    wqaToastEnterSizeThread:'请先填写尺寸或牙长', wqaToastNoItems:'没有可应用的项目',
    wqaToastPriceApplied:'价格设置已应用到全部项目',
    wqaToastLastPriceOff:'{n} 行的上次价格已关闭',
    wqaToastAccCleared:'已清除全部项目的配件',
    wqaToastSetManual:'请先把价格模式设为 Manual Price',
    wqaToastEnterManual:'请先填写手动单价',
    /* 服务器错误代码 → 界面语言 */
    errNoFile:'每次只能上传一个文件。', errTooLarge:'文件超过服务器允许的大小。',
    errUploadFailed:'上传没有完成，请重试。', errEmptyFile:'文件是空的。',
    errNoFileinfo:'服务器未启用 PHP fileinfo 扩展，暂时无法验证上传文件。',
    errTooManyPages:'PDF 最多只能分析 10 页。',
    errNetwork:'无法连接分析服务。请检查网络后重试。',
    errAuth:'分析服务拒绝了服务器凭证。请联系管理员检查 API key。',
    errRate:'分析服务繁忙，请稍等再试。',
    errUpstream:'分析服务出现问题，请稍后再试。',
    errRequest:'无法分析这个文件。请重试，或改用粘贴文字。',
    errMethod:'无法分析这个文件。请重试，或改用粘贴文字。',
    errNotConfigured:'服务器尚未配置 AI 提取功能。',
    errAiOutputInvalid:'无法分析这个文件。请重试，或改用粘贴文字。',
    errUnsupportedType:'只支持 JPG、PNG、WEBP 和 PDF 文件。',
    errPdfTooLarge:'PDF 文件不可超过 20 MB。',
    errImgTooLarge:'图片不可超过 10 MB。',
    /* ── 第 3 / 4 步、弹窗、成本拆分 ── */
    brandSub:'报价系统 · v2.24.0',
    step3Caption:'第 3 步 · 检查与保存', step4Caption:'第 4 步 · 打印 / WhatsApp',
    quotationList:'报价清单', quotationTotal:'报价总额',
    clearAll:'全部清除', noItemsYet:'暂无产品',
    newestFirst:'最新优先', oldestFirst:'最旧优先', sort:'排序',
    saveQuotation:'保存报价', updateQuotation:'更新报价',
    print:'打印', copy:'复制', close:'关闭',
    restoreDraft:'恢复草稿', discardDraft:'不要恢复',
    preview:'预览', copyPreview:'复制预览',
    saveTemplate:'保存模板', resetDefault:'重置为默认',
    addDiameterRule:'添加直径规则', editDiameterRule:'编辑直径规则',
    savedDiameterRules:'已保存直径规则', saveRule:'保存规则',
    lblDiameterMm:'直径 (mm)',
    prevQuotedPrices:'之前报价', checkPrevPrices:'查看之前报价',
    lblManualWeight:'手动重量', lblDiaXLength:'直径 × 长度',
    lblUnitWeight:'单件重量', lblBasePrice:'基础价格',
    lblFinalUnitPrice:'最终单价', lblRawPrice:'原始价格',
    mCompany:'公司', mRemarks:'备注', mNoCompanyStandalone:'— 不指定公司（独立）—',
    mRestoreTitle:'要恢复未保存的草稿吗？',
    mRestoreSub:'你有一份未保存的报价草稿。要恢复还是删除？',
    mDefaultApplied:'已套用默认价格', mManageRules:'管理规则',
    mProductExamples:'产品例子', mExample:'例子',
    mDefaultPriceSettings:'默认价格设置', mMasterData:'主数据工具',
    mDefaultPriceRules:'默认价格规则', mDownloadTemplate:'下载模板',
    mImportExcel:'导入 Excel', mExportCurrent:'导出当前',
    mAddDefaultRule:'添加默认价格规则', mMatchCriteria:'匹配条件',
    mDefaultPricing:'默认价格', mRuleStatus:'规则状态',
    mActive:'启用', mDisabled:'停用', mSavedRules:'已保存规则',
    mSizeSearch:'尺寸搜索', mAddCost:'额外费用', mSource:'来源',
    mNoSizeType:'无尺寸类型', mCustomOnly:'仅自定义', mSystemDefaults:'系统默认',
    mDiameterRules:'直径规则', mResetAllRules:'重置所有规则',
    mMessageTemplate:'信息模板', mPlaceholders:'占位符：',
    wqaOpenSub:'粘贴客户文字 · Sag Rod / Stud / Anchor Bolt',
    /* ── 第 5 次：设置弹窗、说明、占位符、提示 ── */
    optNone:'— 无 —', mThType:'类型',
    step3Sub:'检查与保存', step4Sub:'打印 / WhatsApp', itemsUnit:'项', save:'保存',
    pricingGuideSub:'价格说明', costRateSub:'每公斤成本',
    waTemplateSub:'WhatsApp 文字模板',
    mRestoreTitleZh:'恢复未保存草稿？',
    mRestoreSubZh:'您有一份未保存的报价草稿。要恢复还是删除？',
    mCostRateExplain:'Cost Rate（每公斤成本）= 材料每公斤的成本。', mRefOnly:'仅供参考，不会改变价格',
    mSavedToMysql:'已保存到 MySQL', mStatus:'状态', mClear:'清除',
    mSrcCustom:'自定义', mSrcSystem:'系统', mSrcAll:'全部',
    mShowingRules:'显示规则', mDsHelp:'自定义直径规则优先于内置默认值。尺寸留空则匹配该产品类型的所有尺寸。',
    mWeight2kg:'重量 2 kg', mMatCostEg:'材料成本 = 2 × 3.50 = RM7.00',
    phCwWording:'输入 c/w 说明', phEnterRate:'输入费率', phAutoCalculated:'自动计算',
    phManualTotalLen:'输入手动总长度', phEgEyeBolt:'例如 EYE BOLT',
    phOptional:'可选', phEgWelding:'例如 welding', phOptionalQty0:'数量为 0 时可选',
    phSearchSize:'搜索尺寸，例如 M12',
    tQtyWhole:'数量必须是整数，不能有小数或负号',
    tQtyMin1:'数量至少为 1', tQtyTooLarge:'数量过大，请检查',
    tQtyWholeMin:'数量必须是至少为 1 的整数',
    tUnitNeg:'单价为负数，请检查 Cost Rate / Markup',
    tLineNeg:'总额为负数，请检查输入',
    tIdIhNeg:'ID / IH 不能为负数', tItemUpdated:'产品已更新',
    tOldNoRate:'旧项目没有保存 Cost Rate，请确认价格。',
    tDraftRestored:'草稿已恢复', tDraftDiscarded:'草稿已删除',
    tSagRodAdded:'Sag Rod 已加入报价', tStudAdded:'Stud 已加入报价', tAnchorAdded:'Anchor Bolt 已加入报价',
  },
};
/* Current language. Anything other than a known code reads as 'en', so a
   corrupted or hand-edited localStorage value can never blank the UI. */
function dcLang(){
  try{ const v=localStorage.getItem(DC_LANG_KEY); if(DC_LANGS.indexOf(v)>=0) return v; }catch(e){}
  return 'en';
}
function dcT(key,fallback){
  const l=dcLang();
  const hit=(I18N[l]&&I18N[l][key])!==undefined ? I18N[l][key]
          : (I18N.en&&I18N.en[key])!==undefined ? I18N.en[key] : undefined;
  return hit!==undefined ? hit : (fallback!==undefined ? fallback : key);
}
/* Re-label every element that opted in, and mark the active button. Cheap
   enough to run on every switch; no reload, no re-fetch, no data touched. */
function dcApplyLang(){
  const l=dcLang(), r=document.documentElement;
  r.setAttribute('data-lang',l);
  r.setAttribute('lang', l==='zh' ? 'zh-Hans' : 'en');
  document.querySelectorAll('[data-i18n]').forEach(n=>{ n.textContent=dcT(n.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(n=>{ n.placeholder=dcT(n.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-aria]').forEach(n=>{ n.setAttribute('aria-label',dcT(n.getAttribute('data-i18n-aria'))); });
  document.querySelectorAll('[data-i18n-title]').forEach(n=>{ n.setAttribute('title',dcT(n.getAttribute('data-i18n-title'))); });
  document.querySelectorAll('[data-lang-set]').forEach(b=>{
    const on=b.getAttribute('data-lang-set')===l;
    b.classList.toggle('is-on',on);
    b.setAttribute('aria-pressed',on?'true':'false');
  });
}
function dcSetLang(l){
  if(DC_LANGS.indexOf(l)<0) return;
  const before=dcLang();
  try{ localStorage.setItem(DC_LANG_KEY,l); }catch(e){}   // private mode: session-only, still switches
  dcApplyLang();
  if(before!==l) dcRelabel();
}
/* Screens that build their own markup cannot be re-labelled by the attribute
   scan above, so each localisation commit registers its renderer here. One
   list means a converted screen can never be forgotten on switch. */
const DC_RELABEL=[];
function dcOnRelabel(fn){ if(typeof fn==='function') DC_RELABEL.push(fn); }
function dcRelabel(){
  DC_RELABEL.forEach(fn=>{ try{ fn(); }catch(e){} });   // one bad renderer must not block the rest
  try{ if(typeof showToast==='function') showToast(dcT('langSwitched')); }catch(e){}
}
/* Server errors: the endpoint returns a STABLE error code alongside its English
   message, so the code is what gets localised. The backend is untouched and
   stays language-agnostic; an unknown or missing code falls back to whatever
   message the server sent, which keeps older responses working unchanged. */
const DC_ERR={
  no_file:'errNoFile', too_large:'errTooLarge', upload_failed:'errUploadFailed',
  empty_file:'errEmptyFile', no_fileinfo:'errNoFileinfo', unsupported_type:'errUnsupportedType',
  too_many_pages:'errTooManyPages', network:'errNetwork', auth:'errAuth', rate:'errRate',
  upstream:'errUpstream', request:'errRequest', method:'errMethod',
  not_configured:'errNotConfigured', ai_output_invalid:'errAiOutputInvalid',
  no_text:'errNoText', text_too_long:'errTextTooLong',
};
function dcServerError(j){
  const key = j && j.error && DC_ERR[j.error];
  if(key){
    const txt=dcT(key,'');
    if(txt) return txt;
  }
  return (j && j.message) || dcT('wqaMsgCannotAnalyze');   // unknown code: trust the server's words
}

/* Markup all precedes this script, so the first pass can run immediately. */
dcApplyLang();
/* Some selects and panels are rebuilt during init, AFTER the pass above — they
   carry their keys but were never scanned. One more idempotent pass on load
   catches those without any renderer needing to know about i18n. */
window.addEventListener('load',()=>{ try{ dcApplyLang(); }catch(e){} });

const HANDOFF_KEY='loadQuote';
const UNSAVED_DRAFT_KEY='dc_quote_unsaved_draft_v1';

let dpRulesCache=[];
let dsRulesCache=[];
let waTemplateCache=null;
let cachedNextRefNo='';


let quoteItems=[];
/* ── Custom item dimensions ────────────────────────────────────────────────
   A manual annotation layer for dimensions the standard product schema does
   not have: H2, A, OD, P, "MAX 80", "±2", 3/4". It is exactly that — an
   annotation. Nothing here reaches a weight formula, a price, the size string
   the parser builds, or the standard fields H / ID / S / W / TL, even when a
   label happens to spell one of them. Values stay text, as typed.

   One shared editor serves every product type, so the twelve entry forms and
   their captureItemFormData lists are untouched by this feature. */
let dcCustomDims=[];
/* Trimmed; a row the user opened and never filled in is not an entry. This is
   also the deep copy — every item leaves here with its own array and its own
   objects, so editing item 2 can never reach item 1. */
function dcNormalizeCustomDims(list){
  if(!Array.isArray(list)) return [];
  return list.map(e=>({label:String((e&&e.label)!=null?e.label:'').trim(),
                       value:String((e&&e.value)!=null?e.value:'').trim()}))
             .filter(e=>e.label!=='' || e.value!=='');
}
function dcReadCustomDims(){ return dcNormalizeCustomDims(dcCustomDims); }
function dcSetCustomDims(list){
  dcCustomDims=dcNormalizeCustomDims(list);
  dcRenderCustomDims();
  /* An item that HAS extra dimensions shows them: a collapsed section that
     silently carries data is how data gets forgotten. An item with none stays
     shut. */
  dcOpenCustomDims(dcCustomDims.length>0);
}
/* ── Where the editor is allowed to exist ──────────────────────────────────
   Only while an item that is ALREADY in the quotation is being edited. Adding
   a new item is a different job with a different question in front of it, and
   an "extra dimensions" box sitting in that flow invites a J Bolt's H or an
   L Bolt's W to be typed somewhere the calculator cannot see it. So this is not
   hidden or collapsed for a new item — it is not built at all. */
function dcCustomDimsAllowed(){
  return typeof editingItemIndex!=='undefined' && editingItemIndex!==null;
}
function dcRenderCustomDimsHost(){
  const host=el('cdimHost'); if(!host) return;
  if(!dcCustomDimsAllowed()){
    /* Leaving Edit takes the markup with it, and the working copy too: the item
       kept its own array when it was committed. */
    host.hidden=true; host.innerHTML=''; dcCustomDims=[];
    return;
  }
  host.hidden=false;
  host.innerHTML=`
    <div class="cdim-adv">
      <div class="group-label">${escHtml(dcT('cdimAdvTitle'))} <span class="gl-zh">/ ${escHtml(dcT('cdimAdvTitleZh'))}</span></div>
      <div class="cdim-box" id="cdimBox">
        <button type="button" class="acc-toggle-btn full" id="cdimToggle" onclick="dcToggleCustomDims()">
          <span class="acc-arrow">▶</span><span class="acc-toggle-text"><span class="acc-toggle-title">${escHtml(dcT('cdimTitle'))}</span><span class="acc-toggle-sub">${escHtml(dcT('cdimSub'))}</span></span>
          <span class="acc-active-badge" id="cdimBadge" hidden></span>
        </button>
        <div class="acc-panel cdim-panel" id="cdimPanel">
          <div class="cdim-head">
            <div class="cdim-title">${escHtml(dcT('cdimHeading'))} <span class="gl-zh">/ ${escHtml(dcT('cdimHeadingZh'))}</span></div>
            <button type="button" class="cdim-add" onclick="dcAddCustomDim()">${escHtml(dcT('cdimAdd'))}</button>
          </div>
          <div class="cdim-rows" id="cdimRows"></div>
          <div class="cdim-hint">${escHtml(dcT('cdimHint'))}</div>
        </div>
      </div>
    </div>`;
  dcRenderCustomDims();
  /* An item that already carries some shows them, so a person editing it cannot
     miss data that is already saved against it. */
  dcOpenCustomDims(dcCustomDims.length>0);
}
/* Open state lives on the two elements, exactly as the accessory panel's does. */
function dcOpenCustomDims(on){
  const btn=el('cdimToggle'), panel=el('cdimPanel');
  if(btn)   btn.classList.toggle('open',!!on);
  if(panel) panel.classList.toggle('open',!!on);
}
function dcToggleCustomDims(){
  const panel=el('cdimPanel');
  const open=!(panel && panel.classList.contains('open'));
  dcOpenCustomDims(open);
  /* Opening an empty section offers the first row rather than an empty box. */
  if(open && !dcCustomDims.length) dcAddCustomDim();
}
function dcClearCustomDims(){ dcSetCustomDims([]); }
function dcAddCustomDim(){
  if(!dcCustomDimsAllowed()) return;      // no editor, no rows
  dcCustomDims.push({label:'',value:''});
  dcRenderCustomDims();
  /* Adding a dimension always shows it: a row added into a section that is
     still shut is a row nobody can fill in. */
  dcOpenCustomDims(true);
  const rows=el('cdimRows'), last=rows?rows.querySelector('.cdim-row:last-child input'):null;
  if(last) last.focus();
}
function dcRemoveCustomDim(i){
  if(!(i>=0 && i<dcCustomDims.length)) return;
  dcCustomDims.splice(i,1);
  dcRenderCustomDims();
  scheduleDraftAutosave();
}
/* Typing updates state only — re-rendering on every keystroke would move the
   caret out from under the person typing. */
function dcEditCustomDim(i,k,v){
  const row=dcCustomDims[i]; if(!row||(k!=='label'&&k!=='value')) return;
  row[k]=String(v==null?'':v);
  scheduleDraftAutosave();
}
function dcRenderCustomDims(){
  const badge=el('cdimBadge');
  if(badge){
    const n=dcReadCustomDims().length;
    badge.hidden=!n;
    badge.textContent=n?(n+' '+dcT(n===1?'cdimOne':'cdimMany')):'';
  }
  const box=el('cdimRows'); if(!box) return;
  box.innerHTML=dcCustomDims.map((e,i)=>`
    <div class="cdim-row">
      <input type="text" class="cdim-label-in" maxlength="24" value="${escHtml(e.label)}"
             placeholder="${escHtml(dcT('cdimLabelPh'))}" oninput="dcEditCustomDim(${i},'label',this.value)">
      <input type="text" maxlength="40" value="${escHtml(e.value)}"
             placeholder="${escHtml(dcT('cdimValuePh'))}" oninput="dcEditCustomDim(${i},'value',this.value)">
      <button type="button" class="cdim-del" onclick="dcRemoveCustomDim(${i})"
              title="${escHtml(dcT('cdimRemove'))}" aria-label="${escHtml(dcT('cdimRemove'))}">✕</button>
    </div>`).join('');
}
dcOnRelabel(dcRenderCustomDimsHost);
/* Read-only views: "H2 530 · A 120", in the order staff entered them. */
function dcCustomDimsText(list){
  return dcNormalizeCustomDims(list).map(e=>[e.label,e.value].filter(Boolean).join(' ')).join(' · ');
}
function dcCustomDimsLine(item){
  const t=dcCustomDimsText(item&&item.customDimensions);
  return t ? dcT('cdimPrefix')+' '+t : '';
}
/* The print sheet is an English customer document — its headings are not
   translated either, so its label is not read from the UI language. */
function dcCustomDimsPrintLine(item){
  const t=dcCustomDimsText(item&&item.customDimensions);
  return t ? 'Custom: '+t : '';
}
let currentType='sagrod';
let uboltDebugEnabled=false;
const priceCalcState={};
let editingItemIndex=null;
let editingQuoteId=null;
let loadedValidUntil='';
let savedThisSession=false;
let sentThisSession=false;
let quoteItemsSnapshotAtSave=null;
let companiesCache=[];
let selectedCompanyId=null;
let acMatches=[];
let acHighlight=-1;
let loadedSavedQuote=false;
let quoteLocked=false;
let savedQuoteDirty=false;
let quoteStatusMode='draft';
let savedQuoteSnapshot='';
let suspendDirtyTracking=false;
let draftAutosaveTimer=null;
let draftRecoveryChecked=false;
let draftRestoreInProgress=false;
let pendingUnsavedDraft=null;
let productEntryTouchedFields=new Set();

function captureWASFormDraft(){
  return {
    anchorMaterial:wasAbFv('material'),anchorSizeType:wasAbFv('sizeType'),anchorSize:wasAbFv('size'),
    anchorFinish:getFinish('was'),anchorDiameter:wasAbFv('diameter'),anchorLength:wasAbFv('length'),
    anchorThreadLength:wasAbFv('threadLen'),anchorQtyPerSet:wasAbFv('qty'),
    basePlateLength:wasBpFv('l'),basePlateWidth:wasBpFv('w'),basePlateThickness:wasBpFv('t'),
    basePlateHoleOption:wasGetHoleOpt(),basePlateHoleDia:wasBpFv('hd'),basePlateHoles:wasBpFv('nh'),basePlateQtyPerSet:wasBpFv('qty'),
    trianglePlateLength:wasTpFv('l'),trianglePlateHeight:wasTpFv('h'),trianglePlateCutLength:wasTpFv('cl'),
    trianglePlateCutHeight:wasTpFv('ch'),trianglePlateThickness:wasTpFv('t'),trianglePlateQtyPerSet:wasTpFv('qty'),
    anchorCostRate:fv0('was-anchorCostRate'),basePlateCostRate:fv0('was-basePlateCostRate'),
    trianglePlateCostRate:fv0('was-trianglePlateCostRate'),addCost:fv0('was-addCost'),
    markup:fv0('was-markup'),setQty:fv0('was-qty'),finish:getFinish('was'),accessories:getAccessories('was')
  };
}
function captureProductEntryDraft(){
  const type=currentType;
  const form=el('form-'+type);
  if(!form||!ITEM_TYPES[type]) return null;
  const data=type==='was'?captureWASFormDraft():captureItemFormData(type);
  if(type==='plate'){
    data.plateType=getPlateType();
    data.holeOption=getPlateHoleOption();
  }
  data.__draftFields={};
  form.querySelectorAll('input[id],select[id],textarea[id]').forEach(input=>{
    data.__draftFields[input.id]={value:input.value,checked:!!input.checked,type:input.type||input.tagName.toLowerCase()};
  });
  data.__draftRadioGroups={};
  form.querySelectorAll('input[type="radio"][name]:checked').forEach(input=>{data.__draftRadioGroups[input.name]=input.value;});
  data.__draftTouched=[...productEntryTouchedFields];
  data.__accPanelOpen=!!el(type+'-accPanel')?.classList.contains('open');
  return {currentType:type,formData:data};
}
function hasMeaningfulProductEntry(entry){
  if(!entry||!entry.formData||typeof entry.formData!=='object') return false;
  const data=entry.formData;
  const touched=Array.isArray(data.__draftTouched)?data.__draftTouched:[];
  const fields=data.__draftFields&&typeof data.__draftFields==='object'?data.__draftFields:{};
  return touched.some(rawKey=>{
    const key=String(rawKey||'');
    if(key.startsWith('name:')) return false;
    const field=fields[key];
    if(!field) return false;
    if(/(?:nut|fw|custom)Enabled$/i.test(key)) return !!field.checked;
    if(/(?:material|sizeType|size|Finish)$/i.test(key)) return false;
    if(/qty$/i.test(key)){
      const defaultQty=key==='was-tp-qty'?'4':'1';
      return String(field.value||'')!==defaultQty;
    }
    return String(field.value??'').trim()!=='';
  });
}
function restoreProductEntryDraft(entry){
  if(!entry||!ITEM_TYPES[entry.currentType]) return;
  const type=entry.currentType;
  const data=entry.formData&&typeof entry.formData==='object'?entry.formData:{};
  const form=el('form-'+type);
  if(!form) return;

  switchType(type);
  const radioGroups=data.__draftRadioGroups&&typeof data.__draftRadioGroups==='object'?data.__draftRadioGroups:{};
  form.querySelectorAll('input[type="radio"][name]').forEach(input=>{
    if(Object.prototype.hasOwnProperty.call(radioGroups,input.name)) input.checked=input.value===String(radioGroups[input.name]);
  });
  if(type==='plate') onPlateTypeChange();
  if(type==='was') onWASHoleChange();

  const fields=data.__draftFields&&typeof data.__draftFields==='object'?data.__draftFields:{};
  Object.entries(fields).forEach(([id,state])=>{
    const input=el(id);
    if(!input||!form.contains(input)||!state||typeof state!=='object') return;
    if(input.type==='checkbox'||input.type==='radio') input.checked=!!state.checked;
    else input.value=state.value??'';
  });
  if(el(type+'-material')) updateFinishAvailability(type);
  form.querySelectorAll('input[type="radio"][name]').forEach(input=>{
    if(Object.prototype.hasOwnProperty.call(radioGroups,input.name)) input.checked=input.value===String(radioGroups[input.name]);
  });
  setFinishPills(type,getFinish(type));
  if(data.accessories) loadAccIntoForm(type,data.accessories);
  else onAccChange(type);
  setAccPanelOpen(type,!!data.__accPanelOpen);
  productEntryTouchedFields=new Set(Array.isArray(data.__draftTouched)?data.__draftTouched:[]);
  onPriceModeChange(type);
  if(type==='others') onOthersWeightModeChange();
  recalcCurrent();
}

function hasMeaningfulDraft(draft){
  const items=Array.isArray(draft&&draft.items)?draft.items.filter(item=>item&&typeof item==='object'):[];
  const qi=draft&&draft.quoteInfo&&typeof draft.quoteInfo==='object'?draft.quoteInfo:{};
  const hasItems=items.length>0;
  const hasCustomer=!!qi.company_id||!!String(qi.customer||qi.customerName||qi.company_name||'').trim();
  const hasExtraInfo=!!String(qi.remarks||'').trim()
    ||!!String(qi.prepared_by||qi.preparedBy||'').trim()
    ||!!String(qi.issued_by||qi.issuedBy||'').trim();
  return hasItems||(hasCustomer&&hasExtraInfo)||hasMeaningfulProductEntry(draft&&draft.productEntry);
}
function buildUnsavedDraft(){
  const qi=getQI();
  return {
    version:2,
    savedAt:new Date().toISOString(),
    quoteInfo:{
      customer:qi.customer||'',
      phone:qi.phone||'',
      company_id:selectedCompanyId||null,
      quote_date:qi.date||'',
      prepared_by:qi.prepby||'',
      remarks:qi.remarks||'',
      issued_by:fv0('qi-issued-by')
    },
    items:JSON.parse(JSON.stringify(quoteItems)),
    grandTotal:quoteItems.reduce((sum,item)=>sum+(parseFloat(item.totalAmount)||0),0),
    productEntry:captureProductEntryDraft(),
    status:'unsaved'
  };
}
function clearUnsavedDraft(){
  if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}
  try{localStorage.removeItem(UNSAVED_DRAFT_KEY)}catch(e){}
  pendingUnsavedDraft=null;
}
function autosaveUnsavedDraft(){
  draftAutosaveTimer=null;
  if(!draftRecoveryChecked||draftRestoreInProgress||loadedSavedQuote||editingQuoteId) return;
  try{
    const draft=buildUnsavedDraft();
    if(hasMeaningfulDraft(draft)) localStorage.setItem(UNSAVED_DRAFT_KEY,JSON.stringify(draft));
    else localStorage.removeItem(UNSAVED_DRAFT_KEY);
  }catch(e){}
}
function scheduleDraftAutosave(){
  if(!draftRecoveryChecked||draftRestoreInProgress||loadedSavedQuote||editingQuoteId) return;
  if(draftAutosaveTimer) clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer=setTimeout(autosaveUnsavedDraft,500);
}
function readUnsavedDraft(){
  let raw='';
  try{raw=localStorage.getItem(UNSAVED_DRAFT_KEY)||''}catch(e){return null;}
  if(!raw) return null;
  try{return JSON.parse(raw)}catch(e){clearUnsavedDraft();return null;}
}
function checkUnsavedDraftOnLoad(){
  const draft=readUnsavedDraft();
  if(!hasMeaningfulDraft(draft)){
    if(draft) clearUnsavedDraft();
    return false;
  }
  pendingUnsavedDraft=draft;
  let savedLabel=String(draft.savedAt||'').trim();
  if(savedLabel){
    const savedDate=new Date(savedLabel);
    if(!Number.isNaN(savedDate.getTime())) savedLabel=savedDate.toLocaleString();
  }
  el('draftRecoveryTime').textContent=savedLabel?'Saved: '+savedLabel:'';
  openModal('draftRecoveryModal');
  return true;
}
function restoreUnsavedDraft(){
  const draft=pendingUnsavedDraft;
  if(!hasMeaningfulDraft(draft)){discardUnsavedDraft();return;}
  const qi=draft.quoteInfo&&typeof draft.quoteInfo==='object'?draft.quoteInfo:{};
  draftRestoreInProgress=true;
  suspendDirtyTracking=true;
  loadedSavedQuote=false;quoteLocked=false;editingQuoteId=null;loadedValidUntil='';
  savedQuoteSnapshot='';quoteItemsSnapshotAtSave=null;savedThisSession=false;sentThisSession=false;
  selectedCompanyId=qi.company_id||qi.companyId||null;
  el('qi-customer').value=qi.customer||qi.customerName||qi.company_name||'';
  el('qi-phone').value=qi.phone||qi.customer_phone||'';
  if(qi.quote_date||qi.date) el('qi-date').value=qi.quote_date||qi.date;
  el('qi-prepby').value=qi.prepared_by||qi.preparedBy||'';
  el('qi-remarks').value=qi.remarks||'';
  const issuer=String(qi.issued_by||qi.issuedBy||'');
  el('qi-issued-by').value=issuer;
  if(el('qi-issued-by').value!==issuer) el('qi-issued-by').value='';
  const draftItems=Array.isArray(draft.items)?draft.items.filter(item=>item&&typeof item==='object'):[];
  quoteItems=JSON.parse(JSON.stringify(draftItems));
  if(draft.productEntry) restoreProductEntryDraft(draft.productEntry);
  editingItemIndex=null;setItemEditMode(null);
  savedQuoteDirty=true;quoteStatusMode='dirty';
  syncQI();
  renderQuote();
  suspendDirtyTracking=false;
  draftRestoreInProgress=false;
  pendingUnsavedDraft=null;
  closeModal('draftRecoveryModal');
  updateQuoteLockUI();
  scheduleDraftAutosave();
  goToStep(quoteItems.length?3:(hasMeaningfulProductEntry(draft.productEntry)?2:1));
  showToast(dcT('tDraftRestored'));
}
function discardUnsavedDraft(){
  clearUnsavedDraft();
  productEntryTouchedFields.clear();
  closeModal('draftRecoveryModal');
  showToast(dcT('tDraftDiscarded'));
}

function getQuotationStateSnapshot(){
  return JSON.stringify({companyId:selectedCompanyId||null,qi:getQI(),items:quoteItems});
}
function captureSavedQuotationSnapshot(){
  savedQuoteSnapshot=getQuotationStateSnapshot();
  savedQuoteDirty=false;
  quoteItemsSnapshotAtSave=JSON.stringify(quoteItems);
}
function markQuotationDirty(){
  if(suspendDirtyTracking || !loadedSavedQuote || quoteLocked) return;
  savedQuoteDirty=getQuotationStateSnapshot()!==savedQuoteSnapshot;
  quoteStatusMode=savedQuoteDirty?'dirty':'editing';
  updateQuoteLockUI();
}
function getQuoteStatusLabel(){
  if(savedQuoteDirty) return {mode:'dirty',text:dcT('statusUnsaved')};
  if(quoteStatusMode==='locked') return {mode:'locked',text:dcT('statusSavedLocked')};
  if(quoteStatusMode==='editing') return {mode:'editing',text:dcT('statusEditing')};
  if(quoteStatusMode==='updated') return {mode:'updated',text:dcT('statusSavedUpdated')};
  return {mode:'draft',text:dcT('statusNewDraft')};
}
function updateQuoteLockUI(){
  const status=getQuoteStatusLabel();
  const badge=el('quoteStatusBadge');
  if(badge){
    badge.className='quote-status-badge '+status.mode;
    badge.textContent=status.text;
  }
  const locked=loadedSavedQuote && quoteLocked;
  const panel=el('lockedNoticePanel');
  if(panel) panel.classList.toggle('show',locked);
  const unlockBtn=el('unlockSavedBtn');
  if(unlockBtn) unlockBtn.style.display='none';
  const reviewPanel=el('reviewListPanel');
  if(reviewPanel) reviewPanel.classList.toggle('locked',locked);
  const reviewLabel=el('reviewLockLabel');
  if(reviewLabel){
    reviewLabel.classList.toggle('show',loadedSavedQuote);
    reviewLabel.textContent=locked?'Locked / 已锁定':'Editing / 正在编辑';
  }
  ['qi-customer','qi-phone','qi-date','qi-prepby','qi-remarks'].forEach(id=>{ const e=el(id); if(e) e.disabled=locked; });
  document.querySelectorAll('.item-form input,.item-form select,.type-picker button').forEach(e=>{ e.disabled=locked; });
  document.querySelectorAll('.acc-toggle-btn').forEach(e=>{ e.disabled=locked; e.style.pointerEvents=locked?'none':''; });
  ['addBtn','saveQuoteBtn','mobileSaveBtn','saveModalSubmitBtn','clearAllBtn','cancelItemEditBtn'].forEach(id=>{ const e=el(id); if(e) e.disabled=locked; });
  document.querySelectorAll('.qi-del').forEach(b=>{ b.disabled=locked; b.style.display=locked?'none':''; });
  document.querySelectorAll('.qi-edit-btn').forEach(b=>{ b.disabled=locked; b.style.display=locked?'none':''; });
  const saveText=editingQuoteId?dcT('updateQuotation'):dcT('saveQuotation');
  const saveBtn=el('saveQuoteBtn'); if(saveBtn) saveBtn.innerHTML=saveText;
  const mobileSave=el('mobileSaveBtn'); if(mobileSave) mobileSave.textContent=editingQuoteId?'Update / 更新':'Save / 保存';
}
function setQuoteLockState(locked,mode){
  quoteLocked=!!locked;
  quoteStatusMode=mode||quoteStatusMode;
  updateQuoteLockUI();
}
function unlockSavedQuotation(){
  if(!loadedSavedQuote || !quoteLocked) return;
  if(!confirm('Edit this saved quotation?\\n编辑已保存报价？')) return;
  setQuoteLockState(false,'editing');
  renderQuote();
  showToast('Saved quotation unlocked for editing');
}
function confirmDiscardUnsavedChanges(){
  if(!savedQuoteDirty) return true;
  return confirm('This saved quotation has unsaved changes. Continue and discard them?\\n此已保存报价有未保存更改。继续会放弃更改，确定吗？');
}

/* ── Rate tables (unchanged from production) ── */
const RATES={PL:{costRate:2.80},ZP:{costRate:4.20},HDG:{costRate:6.00}};
const RATES_4140={
  '4140 FULLSIZE SAG ROD':{ 'M12':{dia:13,plRate:8.50,addCostPL:2.50}, 'M16':{dia:16,plRate:6.50,addCostPL:3.50} },
  '4140 UNDERSIZE SAG ROD':{ 'M12':{dia:10.7,plRate:9.50,addCostPL:2.00}, 'M16':{dia:14.5,plRate:8.00,addCostPL:2.50} }
};
const ZP_SURCHARGE=1.50, HDG_SURCHARGE=3.20, HDG_THREAD_BRUSHING=1.00;

const ITEM_TYPES={sagrod:'SAG ROD',stud:'STUD',anchorbolt:'ANCHOR BOLT',ubolt:'U BOLT',squbolt:'SQ U BOLT',lbolt:'L BOLT',lbolt45:'L BOLT 45DEG',jbolt:'J BOLT',plate:'PLATE',was:'WELDING ANCHOR SET',others:'OTHERS / SPECIAL BOLT'};
const DIA_FULLSIZE={M8:8,M10:10,M12:12,M13:13,M16:16,M18:18,M20:20,M22:22,M24:24,M25:25,M27:27,M30:30,M32:32,M33:33,M36:36,M38:38,M39:39,M40:40,M42:42,M45:45,M48:48,M50:50,M52:52,M55:55,M60:60,M65:65,'1/2':12.7,'5/8':15.875,'3/4':19.05,'7/8':22.225,'1"':25.4,'1-1/8':28.575,'1-1/4':31.75,'1-1/2':38.1};
const DIA_FULLSIZE_SPECIAL={M12:13};
const DIA_UNDERSIZE={M6:5.2,M8:7,M10:8.8,M12:10.6,M14:12.5,M16:14.5,M20:18,M22:20,M25:23};
const DIA_UNDERSIZE_INCH={'1/4':5.3,'5/16':6.8,'3/8':8.2,'1/2':10.9,'5/8':14.2,'3/4':17.1,'7/8':20,'1"':23};

/* ── helpers ── */
function el(id){return document.getElementById(id)}
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
function dcSizeTypeFor(product,sizeType){ return dcProductHasSizeType(product) ? String(sizeType||'') : ''; }
function dcFinishFor(material,finish){ return dcMaterialHasFinish(material) ? String(finish||'') : ''; }

function fv(type,field){const e=el(type+'-'+field);return e?e.value:''}
function fn(type,field){return parseFloat(fv(type,field))||0}
function fmt(v){return 'RM '+v.toFixed(2)}
function cleanNum(v){const n=parseFloat(v);if(isNaN(n))return v;return Number.isInteger(n)?String(n):String(parseFloat(n.toFixed(2)))}
function withMm(v){return String(v).trim()?String(v).trim()+'mm':''}
function escHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function safeClassToken(s){return String(s??'').replace(/[^a-zA-Z0-9_-]/g,'')}
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
function isMaterialOptionText(text){
  const value=String(text||'').trim().toUpperCase();
  if(!value) return false;
  const labels=['MS','S45C','S45C + HARDEN = G8.8','4140 QT','4140 QT + HARDEN = G10.9','4140','4340 QT','SS304','SS316','Y BAR'];
  return labels.some(label=>label.toUpperCase()===value);
}
function displayItemDesc(item){
  const desc=String(item&&item.desc?item.desc:'');
  if(desc.includes('4140_HARDEN_G10_9')) return desc.replace(/4140_HARDEN_G10_9/g,'4140 QT + HARDEN = G10.9');
  if(desc.includes('S45C_HARDEN_G8_8')) return desc.replace(/S45C_HARDEN_G8_8/g,'S45C + HARDEN = G8.8');
  /* The 4140/4340 rewrites below repair very old descs that stored the raw internal
     value ("4140" meaning 4140 QT). Items on the new materials already read correctly
     ("4140 ...", "Y BAR ...") and must never be rewritten to "4140 QT". */
  const mat=String(item&&item.material?item.material:'');
  if(mat==='4140_PLAIN'||mat==='Y_BAR') return desc;
  return desc
    .replace(/\b4140\b(?!\s+QT)/g,'4140 QT')
    .replace(/\b4340\b(?!\s+QT)/g,'4340 QT');
}
function getFinish(type){const r=document.querySelector(`input[name="${type}-finish"]:checked`);return r?r.value:'PL'}
function setFinishPills(type,finish){
  ['NA','PL','ZP','HDG'].forEach(key=>{
    const p=el(type+'-pill-'+key); if(!p) return;
    const val = key==='NA' ? '' : key;
    p.classList.toggle('selected-'+key, val===finish);
  });
}
function updateFinishAvailability(type){
  const material=fv(type,'material');
  const isSS = material==='SS304'||material==='SS316';
  const container=el(type+'-finishPills');
  if(container) container.classList.toggle('ss-mode',isSS);
  ['PL','ZP','HDG'].forEach(f=>{
    const input=document.querySelector(`input[name="${type}-finish"][value="${f}"]`);
    const pill=el(type+'-pill-'+f);
    if(input) input.disabled=isSS;
    if(pill){
      pill.classList.toggle('pill-ss-hide',isSS);
      pill.classList.toggle('pill-disabled',isSS);
    }
  });
  const naInput=document.querySelector(`input[name="${type}-finish"][value=""]`);
  if(isSS){
    if(naInput) naInput.checked=true;
  } else if(getFinish(type)===''){
    const plInput=document.querySelector(`input[name="${type}-finish"][value="PL"]`);
    if(plInput) plInput.checked=true;
  }
  setFinishPills(type,getFinish(type));
}
function evalExpr(raw){
  if(!raw||!raw.trim())return 0;
  if(/^[\d\s.+\-*/]+$/.test(raw)){ try{return parseFloat(Function('"use strict";return('+raw+')')())||0}catch(e){} }
  return parseFloat(raw)||0;
}
function evalRateField(type,field){
  const input=el(type+'-'+field), raw=input?input.value.trim():'';
  if(/^[\d\s.+\-*/]+$/.test(raw)){
    try{const r=Function('"use strict";return('+raw+')')();if(!isNaN(r)){input.value=parseFloat(r).toFixed(2);showToast(raw+' = '+input.value)}}catch(e){}
  }
  recalcCurrent();
}
/* ── Phase 1 fix: numeric entry validation ──
   Shared guards used by every Add-to-Quotation path. Server-side api.php
   enforces the same rules — these give staff an immediate, field-specific
   message instead of a rejected save. */
function validateQtyEntry(type){
  const raw=(fv(type,'qty')||'').trim();
  if(!/^\d+$/.test(raw)){ showToast(dcT('tQtyWhole')); return null; }
  const q=parseInt(raw,10);
  if(q<1){ showToast(dcT('tQtyMin1')); return null; }
  if(q>1000000){ showToast(dcT('tQtyTooLarge')); return null; }
  return q;
}
/* Rate fields accept simple expressions (evalExpr). Reject negative results and
   text that silently evaluates to 0 (e.g. "abc"). Blank stays allowed here —
   the existing blank-Cost-Rate guards handle that with their own message. */
function validateRateEntry(type,field,label){
  const raw=(fv(type,field)||'').trim();
  if(raw==='') return 0;
  const v=evalExpr(raw);
  if(v<0){ showToast(label+' cannot be negative / '+label+' 不能为负数'); return null; }
  if(v===0 && !/^[0\s.+\-*/]*$/.test(raw)){ showToast(label+' is not a valid number / '+label+' 不是有效数字'); return null; }
  return v;
}
/* Required dimensions must be positive numbers (blocks negatives that the old
   truthy checks let through). */
function validateDims(dims){
  for(const label in dims){
    const n=parseFloat(dims[label]);
    if(!isFinite(n)||n<=0){ showToast(label+' must be greater than 0 / '+label+' 必须大于 0'); return false; }
  }
  return true;
}
/* Final safety net before an item enters the quotation list. */
function validateFinalItem(qty,finalUnitPrice,totalAmount){
  if(!Number.isInteger(qty)||qty<1){ showToast(dcT('tQtyWholeMin')); return false; }
  if(!isFinite(finalUnitPrice)||finalUnitPrice<0){ showToast(dcT('tUnitNeg')); return false; }
  if(!isFinite(totalAmount)||totalAmount<0){ showToast(dcT('tLineNeg')); return false; }
  return true;
}
function round05(v){
  const r=Math.round(v*100)/100;
  const cents=Math.round(r*100)%10;
  if(cents===9) return Math.round((r+0.01)*10)/10;
  if(cents===1) return Math.floor(r*10)/10;
  return r;
}
function roundCustom10(v){
  const cents=Math.round((v+0.0000001)*100);
  const last=cents%10;
  const rounded=last<=3?cents-last:cents+(10-last);
  return rounded/100;
}
function roundMoney2(v){return Math.round((Number(v)||0)*100)/100}
function getPriceMode(type){
  const value=fv(type,'priceMode');
  return ['auto','no_round','manual'].includes(value)?value:'auto';
}
function getPriceModeLabel(mode){return mode==='manual'?'Manual Price':mode==='no_round'?'No Round':'Auto Round'}
function resolvePriceMode(type,rawUnitPrice,autoRoundedUnitPrice,accessoriesCost=0){
  const mode=getPriceMode(type);
  const manualRaw=fv(type,'manualUnitPrice').trim();
  const manualUnitPrice=evalExpr(manualRaw);
  let finalUnitPrice;
  if(mode==='manual') finalUnitPrice=manualUnitPrice;
  else if(mode==='no_round') finalUnitPrice=roundMoney2(rawUnitPrice)+accessoriesCost;
  else finalUnitPrice=autoRoundedUnitPrice+accessoriesCost;
  priceCalcState[type]={
    priceMode:mode,manualUnitPrice:manualRaw,rawUnitPrice:Number(rawUnitPrice)||0,
    roundedUnitPrice:Number(autoRoundedUnitPrice)||0,accessoriesCost:Number(accessoriesCost)||0,
    finalUnitPrice:Number(finalUnitPrice)||0
  };
  updatePriceModePreview(type);
  return priceCalcState[type].finalUnitPrice;
}
function getPriceModeSaveData(type){
  const state=priceCalcState[type]||{};
  return {
    priceMode:getPriceMode(type),manualUnitPrice:fv(type,'manualUnitPrice'),
    rawUnitPrice:state.rawUnitPrice??0,roundedUnitPrice:state.roundedUnitPrice??0
  };
}
function validatePriceMode(type){
  if(getPriceMode(type)!=='manual') return true;
  const value=fv(type,'manualUnitPrice').trim();
  if(!value||evalExpr(value)<0){showToast('Enter Manual Unit Price');return false;}
  return true;
}
function syncCostRateWarning(type){
  const warning=el(type+'-warn');
  if(!warning) return;
  const alwaysManual=['ubolt','squbolt','lbolt','lbolt45','jbolt'].includes(type);
  const materialManual=['sagrod','stud','anchorbolt'].includes(type)
    && ['S45C','S45C_HARDEN_G8_8','SS304','SS316','4340','4140_HARDEN_G10_9','4140_PLAIN','Y_BAR'].includes(fv(type,'material'));
  const show=(alwaysManual||materialManual)&&!fv(type,'costRate').trim();
  warning.textContent='Cost Rate must be entered manually for this product type.';
  warning.style.display=show?'block':'none';
}
function updatePriceModePreview(type){
  if(type!==currentType) return;
  const state=priceCalcState[type]||{};
  const raw=el('pmPreviewRaw'),mode=el('pmPreviewMode'),final=el('pmPreviewFinal');
  if(raw) raw.textContent=fmt(Number(state.rawUnitPrice)||0);
  if(mode) mode.textContent=getPriceModeLabel(state.priceMode||getPriceMode(type));
  if(final) final.textContent=fmt(Number(state.finalUnitPrice)||0);
}
function onPriceModeChange(type){
  const manual=getPriceMode(type)==='manual';
  const field=el(type+'-manualUnitPriceField'),input=el(type+'-manualUnitPrice');
  if(field) field.style.display=manual?'flex':'none';
  if(input) input.disabled=!manual;
  if(type===currentType) recalcCurrent();
  scheduleDraftAutosave();
}
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
     Length, TL, ID, S and W are plain millimetres and never gain an M. */
  let m=v.match(/^M?\s*(\d+(?:\.\d+)?)\s*(?:MM)?$/);
  if(m) return 'M'+String(Number(m[1])).replace(/\.0$/,'');
  return v;
}
/* Is this a size the quotation can actually be built from? Metric sizes come
   from the diameter table; an imperial size is valid when the inch reader can
   turn it into millimetres. Everything else is a size we have READ but do not
   recognise: it is kept exactly as written, shown to a person, and never
   weighed. */
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
function getNominalDiameter(size){
  if(DIA_FULLSIZE[size]!==undefined) return DIA_FULLSIZE[size];
  const m=(size||'').match(/^M(\d+(?:\.\d+)?)$/i);
  if(m) return parseFloat(m[1]);
  return null;
}
function formatSizeLabel(size,diameter,sizeType){
  const d=parseFloat(diameter);
  if(!size||!d) return size;
  if((sizeType||'FULLSIZE')==='UNDERSIZE') return size;
  const bar=cleanNum(Math.round(d*10)/10);
  const nominal=getNominalDiameter(size);
  if(nominal===null) return 'Ø'+bar+'-'+size;
  return Math.abs(d-nominal)>0.2 ? 'Ø'+bar+'-'+size : size;
}
function buildDesc(type){
  const mat=materialLabel(fv(type,'material'));
  if(type==='others') return [mat,fv(type,'sizeType'),fv(type,'productName').trim()].filter(Boolean).join(' ');
  if(type==='stud') return mat+' '+ITEM_TYPES[type];
  const sizeType=fv(type,'sizeType');
  return mat+' '+sizeType+' '+ITEM_TYPES[type];
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
function wqaImperialDia(size){
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
  const key=String(m[1]!==undefined?m[1]:m[2]).replace(/\s*\/\s*/,'/').replace(/\s*[-\s]\s*/,'-');
  return WQA_INCH_DIA[key]!==undefined ? String(WQA_INCH_DIA[key]) : '';
}
function autoFillDiameter(type){
  const material=fv(type,'material'), sizeType=fv(type,'sizeType');
  const sizeEl=el(type+'-size'); if(!sizeEl)return;
  const size=normalizeSizeValue(sizeEl.value); sizeEl.value=size;

  // Custom diameter rule takes priority
  const custom=findDSRule(type,material,sizeType,size);
  if(custom!==null){
    const diaEl=el(type+'-diameter'); if(diaEl) diaEl.value=custom;
    return;
  }

  let dia='';
  // Stud always uses undersize diameter regardless of size type
  if(type==='stud' || sizeType==='UNDERSIZE'){
    dia=DIA_UNDERSIZE_INCH[size]!==undefined?DIA_UNDERSIZE_INCH[size]:(DIA_UNDERSIZE[size]!==undefined?DIA_UNDERSIZE[size]:'');
  }else{
    if((material==='4140'||material==='4340')&&DIA_FULLSIZE_SPECIAL[size]!==undefined) dia=DIA_FULLSIZE_SPECIAL[size];
    else dia=DIA_FULLSIZE[size]!==undefined?DIA_FULLSIZE[size]:'';
  }
  /* Nothing in the metric table matched. If the size is written in inches —
     1/2", 3/4" BSW — the calculation diameter is the millimetres behind that
     fraction. Only ever a fallback, so no size that already resolves changes. */
  if(dia==='') dia=wqaImperialDia(size);
  const diaEl=el(type+'-diameter'); if(diaEl) diaEl.value=(dia!==''?dia:'');
}

/* ═══════════════════════════════════════════════════════════════
   DIAMETER SETTINGS — MySQL/API
   Rules: {id, type, material, sizeType ('' for stud), size, diameter}
═══════════════════════════════════════════════════════════════ */
const DS_TYPES_NO_SIZETYPE=['stud'];
let dsRulesLoadPromise=null;

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
async function refreshDSRules(){
  const res=await api('get_diameter_settings');
  dsRulesCache=(res.ok?(res.data||[]):[]).map(normalizeDSRule);
  return dsRulesCache;
}
function saveDSRulesStore(rules){ dsRulesCache=rules.map(normalizeDSRule); }

function dsKey(r){
  const type=r.type||'';
  const noST=DS_TYPES_NO_SIZETYPE.includes(type);
  return [type,r.material||'',noST?'':(r.sizeType||''),(r.size||'').toUpperCase()].join('|');
}
function makeSystemDSRule(type,material,sizeType,size,diameter){
  return normalizeDSRule({id:'sys-ds:'+[type,material,sizeType,size].join(':'),type,material,sizeType,size,diameter,source:'system',active:'1'});
}
function getSystemDSRules(){
  const rows=[];
  const sizedTypes=['sagrod','anchorbolt','ubolt','squbolt','lbolt','lbolt45','jbolt'];
  sizedTypes.forEach(type=>{
    Object.entries(DIA_FULLSIZE).forEach(([size,dia])=>rows.push(makeSystemDSRule(type,'MS','FULLSIZE',size,dia)));
    Object.entries(DIA_UNDERSIZE).forEach(([size,dia])=>rows.push(makeSystemDSRule(type,'MS','UNDERSIZE',size,dia)));
    Object.entries(DIA_UNDERSIZE_INCH).forEach(([size,dia])=>rows.push(makeSystemDSRule(type,'MS','UNDERSIZE',size,dia)));
  });
  Object.entries(DIA_UNDERSIZE).forEach(([size,dia])=>rows.push(makeSystemDSRule('stud','MS','',size,dia)));
  Object.entries(DIA_UNDERSIZE_INCH).forEach(([size,dia])=>rows.push(makeSystemDSRule('stud','MS','',size,dia)));
  Object.entries(RATES_4140).forEach(([desc,sizes])=>{
    const sizeType=desc.includes('UNDERSIZE')?'UNDERSIZE':'FULLSIZE';
    Object.entries(sizes).forEach(([size,row])=>rows.push(makeSystemDSRule('sagrod','4140',sizeType,size,row.dia)));
  });
  return rows;
}
function getDSDisplayRules(){
  const merged=new Map();
  getSystemDSRules().forEach(r=>merged.set(dsKey(r),r));
  loadDSRules().forEach(r=>merged.set(dsKey(r),normalizeDSRule({...r,source:'custom'})));
  return Array.from(merged.values());
}
function normalizedRuleSizeType(r){ return (r.sizeType||'') ? r.sizeType : 'NO_SIZE_TYPE'; }
function setDSSourceMode(mode){ const e=el('dsFilterSource'); if(e)e.value=mode; syncDSModeButtons(); renderDSList(); }
function syncDSModeButtons(){
  const mode=(el('dsFilterSource')&&el('dsFilterSource').value)||'custom';
  [['dsModeCustom','custom'],['dsModeSystem','system'],['dsModeAll','all']].forEach(([id,key])=>{const b=el(id); if(b)b.classList.toggle('active',mode===key);});
}
function updateSettingsCount(id,shown,total){
  const e=el(id); if(e)e.textContent=`Showing ${shown} of ${total} rules / 显示 ${shown} / ${total} 条规则`;
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

const DS_TYPE_LABELS={sagrod:'Sag Rod',stud:'Stud',anchorbolt:'Anchor Bolt',ubolt:'U-Bolt',squbolt:'SQ U-Bolt',lbolt:'L Bolt',lbolt45:'L Bolt 45DEG',jbolt:'J Bolt'};

async function openDSModal(){
  resetDSForm();
  await refreshDSRules().catch(()=>{});
  const src=el('dsFilterSource'); if(src) src.value='custom';
  syncDSModeButtons();
  renderDSList();
  onDSTypeChange();
  openModal('dsModal');
}
function onDSTypeChange(){
  const type=el('ds-type')&&el('ds-type').value;
  const stf=el('ds-sizeType-field');
  if(stf) stf.style.display=DS_TYPES_NO_SIZETYPE.includes(type)?'none':'';
}
function resetDSForm(){
  ['ds-edit-id','ds-size','ds-diameter'].forEach(id=>{const e=el(id);if(e)e.value='';});
  ['ds-type','ds-material','ds-sizeType'].forEach(id=>{const e=el(id);if(e)e.selectedIndex=0;});
  el('dsFormTitle').textContent=dcT('addDiameterRule');
  onDSTypeChange();
}
async function saveDSRule(){
  const size=(el('ds-size').value||'').trim().toUpperCase();
  const diameter=parseFloat(el('ds-diameter').value);
  if(!size){showToast('Enter a Size value');return}
  if(isNaN(diameter)||diameter<=0){showToast('Enter a valid Diameter');return}
  const type=el('ds-type').value;
  const noST=DS_TYPES_NO_SIZETYPE.includes(type);
  const rule={
    id: el('ds-edit-id').value||'',
    type,
    material: el('ds-material').value,
    sizeType: noST ? '' : el('ds-sizeType').value,
    size,
    diameter
  };
  const action=rule.id?'update_diameter_setting':'save_diameter_setting';
  const res=await api(action,rule,'POST');
  if(!res.ok){showToast('Save failed: '+(res.error||'server error'));return}
  await refreshDSRules();
  if(rule.type===currentType){ autoFillDiameter(currentType); recalcCurrent(); }
  showToast('Diameter setting saved');
  resetDSForm();
  renderDSList();
}
function editDSRule(id){
  const rule=getDSDisplayRules().find(r=>String(r.id)===String(id));if(!rule)return;
  el('ds-edit-id').value=rule.source==='system'?'':rule.id;
  el('ds-type').value=rule.type;
  el('ds-material').value=rule.material;
  onDSTypeChange();
  if(el('ds-sizeType')) el('ds-sizeType').value=rule.sizeType||'FULLSIZE';
  el('ds-size').value=rule.size;
  el('ds-diameter').value=rule.diameter;
  el('dsFormTitle').textContent=dcT('editDiameterRule');
}
async function deleteDSRule(id){
  if(!confirm('Delete this diameter rule?')) return;
  const res=await api('delete_diameter_setting',{id},'POST');
  if(!res.ok){showToast('Delete failed');return}
  await refreshDSRules();
  renderDSList();
  autoFillDiameter(currentType); recalcCurrent();
  showToast('Diameter rule deleted');
}
async function clearAllDSRules(){
  const rules=loadDSRules().slice();
  for(const r of rules){ await api('delete_diameter_setting',{id:r.id},'POST'); }
  await refreshDSRules();
  renderDSList();
  autoFillDiameter(currentType); recalcCurrent();
  showToast('All diameter rules cleared');
}
function renderDSList(){
  const q=(el('dsSearch').value||'').toLowerCase();
  const fType=el('dsFilterType').value;
  const fMaterial=(el('dsFilterMaterial')&&el('dsFilterMaterial').value)||'';
  const fSizeType=(el('dsFilterSizeType')&&el('dsFilterSizeType').value)||'';
  const fSource=(el('dsFilterSource')&&el('dsFilterSource').value)||'custom';
  const allRules=getDSDisplayRules();
  let rules=allRules;
  if(fType) rules=rules.filter(r=>r.type===fType);
  if(fMaterial) rules=rules.filter(r=>r.material===fMaterial);
  if(fSizeType) rules=rules.filter(r=>normalizedRuleSizeType(r)===fSizeType);
  if(fSource!=='all') rules=rules.filter(r=>r.source===fSource);
  if(q) rules=rules.filter(r=>(r.size||'').toLowerCase().includes(q));
  syncDSModeButtons();
  updateSettingsCount('dsCountText',rules.length,allRules.length);
  el('dsRuleCount').textContent=rules.length;
  const tbody=el('dsListBody'); tbody.innerHTML='';
  const empty=el('dsEmpty');
  empty.innerHTML=fSource==='custom'
    ? 'No custom diameter rules yet.<br>还没有自定义直径规则。<div style="font-size:11.5px;margin-top:6px">Use Status filter to view System Defaults.<br>可切换状态筛选查看系统默认值。</div>'
    : 'No diameter rules match these filters.';
  empty.style.display=rules.length?'none':'block';
  rules.forEach(r=>{
    const tr=document.createElement('tr');
    const isSystem=r.source==='system';
    tr.innerHTML=`
      <td>${escHtml(DS_TYPE_LABELS[r.type]||r.type)}</td>
      <td>${escHtml(materialLabel(r.material))}</td>
      <td style="font-size:11px;color:var(--text-muted)">${escHtml(r.sizeType||'-')}</td>
      <td><strong>${escHtml(r.size)}</strong></td>
      <td><strong>${parseFloat(r.diameter)||0}mm</strong></td>
      <td><span class="dp-badge ${isSystem?'dp-badge-system':'dp-badge-custom'}">${isSystem?'System Default / 系统默认':'Custom / 自定义'}</span></td>
      <td style="white-space:nowrap">
        <button class="dp-act" onclick="editDSRule('${r.id}')" title="Edit">✎</button>
        ${isSystem?'':`<button class="dp-act" style="color:var(--red)" onclick="deleteDSRule('${r.id}')" title="Delete">✕</button>`}
      </td>`;
    tbody.appendChild(tr);
  });
}

function get4140Rates(desc,size,finish){
  const table=RATES_4140[desc]; if(!table) return null;
  const key=Object.keys(table).find(k=>size.toUpperCase().includes(k));
  if(!key) return null;
  const row=table[key];
  const surcharge=(finish==='ZP'?ZP_SURCHARGE:finish==='HDG'?HDG_SURCHARGE:0);
  const addCost=row.addCostPL+(finish==='HDG'?HDG_THREAD_BRUSHING:0);
  return {costRate:row.plRate+surcharge, addCost, dia:row.dia};
}
function getAddCostFromTL(s){
  if(!s||!s.trim())return 0;
  const parts=s.split('/').map(v=>parseFloat(v.trim())).filter(n=>!isNaN(n));
  if(!parts.length)return 0;
  const max=Math.max(...parts);
  if(max>=30&&max<=120)return 0.60;
  if(max>=121&&max<=200)return 1.00;
  return 0;
}
/* ── Phase 1 fix: manual Cost Rate / Additional Cost protection ──
   productEntryTouchedFields records every field the user typed in (input/change
   events; programmatic .value writes do not fire events, so they never mark a
   field). Once staff manually edits Cost Rate or Additional Cost, automatic
   pricing (built-in MS/4140 sag rod rates, thread-length table, default price
   rules) must not silently replace that value.
   Exception: an explicit MATERIAL change keeps its existing behaviour — it
   re-derives the rate for the new material and returns ownership of the field
   to the automatic pricing (the flag is cleared).
   The flags reset on product-type switch, New Quotation and after each add —
   the same places productEntryTouchedFields was already cleared. */
function isUserPriced(type,field){ return productEntryTouchedFields.has(type+'-'+field); }
function markUserPriced(type,field){ productEntryTouchedFields.add(type+'-'+field); }
/* Write an automatic price into a field.
   force=true (material change): always write and clear the manual flag.
   force=false: skip the write when the field is user-edited. */
function setAutoRate(type,field,value,force){
  const e=el(type+'-'+field); if(!e) return;
  if(force){ e.value=value; productEntryTouchedFields.delete(type+'-'+field); return; }
  if(isUserPriced(type,field)) return;
  e.value=value;
}

function onThreadLenChange(type,force){
  const material=fv(type,'material');
  const isUnknown=['S45C','S45C_HARDEN_G8_8','SS304','SS316','4340','4140','4140_HARDEN_G10_9','4140_PLAIN','Y_BAR'].includes(material);
  if(!isUnknown && getFinish(type)!=='HDG') setAutoRate(type,'addCost',getAddCostFromTL(fv(type,'threadLen')).toFixed(2),force);
  calcSagRod();
}
function onSizeInput(type){ autoFillDiameter(type); onMaterialSizeChange(type,true); applyDefaultPrice(); }
function onFinishChange(type){
  setFinishPills(type,getFinish(type));
  if(type==='sagrod') onMaterialSizeChange(type,true); else recalcCurrent();
  applyDefaultPrice();
}

function onMaterialSizeChange(type,skipDiameterRefill,trigger){
  if(!skipDiameterRefill) autoFillDiameter(type);
  updateFinishAvailability(type);
  const warnEl=el(type+'-warn');
  if(type==='sagrod'){
    const material=fv('sagrod','material'), finish=getFinish('sagrod');
    const force=trigger==='material';
    const isUnknown=['S45C','S45C_HARDEN_G8_8','SS304','SS316','4340','4140_HARDEN_G10_9','4140_PLAIN','Y_BAR'].includes(material);
    if(isUnknown){
      setAutoRate('sagrod','costRate','',force); setAutoRate('sagrod','addCost','',force);
      if(warnEl) warnEl.style.display='block';
    } else {
      if(warnEl) warnEl.style.display='none';
      if(material==='MS'){
        setAutoRate('sagrod','costRate',RATES[finish].costRate.toFixed(2),force);
        if(finish==='HDG'){ setAutoRate('sagrod','addCost','1.60',force); } else { onThreadLenChange('sagrod',force); }
      } else if(material==='4140'){
        const desc=buildDesc('sagrod'), size=normalizeSizeValue(fv('sagrod','size'));
        const r=get4140Rates(desc,size,finish);
        if(r){ setAutoRate('sagrod','costRate',r.costRate.toFixed(2),force); setAutoRate('sagrod','addCost',r.addCost.toFixed(2),force); el('sagrod-diameter').value=r.dia; }
      }
    }
  } else if(type==='stud'||type==='anchorbolt'){
    const material=fv(type,'material');
    const isUnknown=['S45C','S45C_HARDEN_G8_8','SS304','SS316','4340','4140_HARDEN_G10_9','4140_PLAIN','Y_BAR'].includes(material);
    if(isUnknown){
      if(warnEl) warnEl.style.display='block';
    } else {
      if(warnEl) warnEl.style.display='none';
    }
  }
  recalcCurrent();
  applyDefaultPrice();
}

/* ── product type switch ── */
function switchType(type){
  if(!draftRestoreInProgress&&type!==currentType) productEntryTouchedFields.clear();
  currentType=type;
  document.querySelectorAll('.type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
  document.querySelectorAll('.item-form').forEach(f=>f.classList.toggle('active',f.dataset.type===type));
  syncUBoltDebugVisibility();
  resetPriceHistoryPanel();
  onMaterialSizeChange(type);
  recalcCurrent();
  applyDefaultPrice();
  scheduleDraftAutosave();
}

function recalcCurrent(){
  if(currentType==='sagrod') calcSagRod();
  else if(currentType==='stud') calcStud();
  else if(currentType==='anchorbolt') calcAnchorBolt();
  else if(currentType==='ubolt') calcUBolt('ubolt');
  else if(currentType==='squbolt') calcSQUBolt('squbolt');
  else if(currentType==='lbolt') calcLBolt('lbolt');
  else if(currentType==='lbolt45') calcLBolt('lbolt45');
  else if(currentType==='jbolt') calcJBolt('jbolt');
  else if(currentType==='plate') calcPlate();
  else if(currentType==='was') calcWAS();
  else if(currentType==='others') calcOthers();
}
function updatePreview(weight,base,final){
  const breakdown=el('wasBreakdown');
  if(breakdown) breakdown.classList.remove('show');
  const thirdLabel=document.querySelector('.cp-acc label');
  if(thirdLabel) thirdLabel.textContent=dcT('accessories');
  el('cpWeight').textContent = weight>0 ? weight.toFixed(4)+' kg' : '—';
  /* Publish the weight this calculation just produced so other views (the
     Quick Add review) can display it without owning a second formula. */
  if(priceCalcState[currentType]) priceCalcState[currentType].weight=weight;
  el('cpBase').textContent = fmt(base);
  // Accessories live total
  const accTotal=accAddon(getAccessories(currentType));
  el('cpAcc').textContent = accTotal>0 ? fmt(accTotal) : '—';
  const resolved=priceCalcState[currentType];
  el('cpFinal').textContent = fmt(resolved?resolved.finalUnitPrice:final+accTotal);
  syncCostRateWarning(currentType);
  updatePriceModePreview(currentType);
}
function updateWASPreview(calc){
  const thirdLabel=document.querySelector('.cp-acc label');
  if(thirdLabel) thirdLabel.textContent='Additional Cost';
  el('cpWeight').textContent=calc.weights.setWeight>0?calc.weights.setWeight.toFixed(4)+' kg':'—';
  el('cpBase').textContent=fmt(calc.basePrice);
  el('cpAcc').textContent=calc.addCost?fmt(calc.addCost):'—';
  el('cpFinal').textContent=fmt(calc.finalUnitPrice);
  updatePriceModePreview('was');
  const breakdown=el('wasBreakdown');
  if(!breakdown) return;
  breakdown.classList.add('show');
  const component=(weight,rate,cost)=>`${weight.toFixed(4)}kg × RM${rate.toFixed(2)} = RM${cost.toFixed(2)}`;
  el('wasBreakdownAnchor').textContent=component(calc.weights.anchorWeight,calc.anchorRate,calc.anchorCost);
  el('wasBreakdownBasePlate').textContent=component(calc.weights.basePlateWeight,calc.basePlateRate,calc.basePlateCost);
  const triangleRow=el('wasBreakdownTriangleRow');
  if(triangleRow) triangleRow.style.display=calc.weights.tpQty>0?'grid':'none';
  if(calc.weights.tpQty>0) el('wasBreakdownTriangle').textContent=component(calc.weights.trianglePlateWeight,calc.trianglePlateRate,calc.trianglePlateCost);
  el('wasBreakdownAdditional').textContent=`RM${calc.addCost.toFixed(2)}`;
  el('wasBreakdownAccessories').textContent=`RM${calc.accessories.toFixed(2)}`;
  el('wasBreakdownBasePrice').textContent=`RM${calc.basePrice.toFixed(2)}`;
  el('wasBreakdownFinal').textContent=`RM${calc.finalUnitPrice.toFixed(2)}/set`;
}
function refreshAccPreview(){
  // Re-trigger the current type's calc to refresh preview with new acc total
  if(currentType==='sagrod') calcSagRod();
  else if(currentType==='stud') calcStud();
  else if(currentType==='anchorbolt') calcAnchorBolt();
  else if(currentType==='ubolt') calcUBolt(currentType,true);
  else if(currentType==='squbolt') calcSQUBolt(currentType,true);
  else if(currentType==='lbolt') calcLBolt(currentType,true);
  else if(currentType==='lbolt45') calcLBolt(currentType,true);
  else if(currentType==='jbolt') calcJBolt(currentType,true);
  else if(currentType==='plate') calcPlate();
  else if(currentType==='was') calcWAS();
  else if(currentType==='others') calcOthers();
}

function normalizeThreadLengthKey(raw){
  return String(raw||'').trim().toUpperCase().replace(/\s+/g,'').replace(/MM/g,'');
}
function getMSUndersizeSagRodPLSpecialPrice(size,sizeType,material,finish,threadLen,length){
  const isMatch = material==='MS'
    && sizeType==='UNDERSIZE'
    && finish==='PL'
    && normalizeSizeValue(size)==='M12'
    && normalizeThreadLengthKey(threadLen)==='100/100';
  if(!isMatch) return null;
  const l=Math.round(parseFloat(length)||0);
  if(l===1000) return 4.00;
  if(l===1200) return 4.20;
  return null;
}

/* ── Sag Rod ── */
function calcSagRod(){
  const diameter=fn('sagrod','diameter'), length=fn('sagrod','length');
  const costRate=evalExpr(fv('sagrod','costRate')), addCost=evalExpr(fv('sagrod','addCost'));
  const markup=fn('sagrod','markup');
  const weight=diameter*diameter*length*0.0000061654;
  const base=weight*costRate+addCost;
  const special=getMSUndersizeSagRodPLSpecialPrice(
    fv('sagrod','size'), fv('sagrod','sizeType'), fv('sagrod','material'), getFinish('sagrod'), fv('sagrod','threadLen'), length
  );
  const raw=base*(1+markup/100);
  const rounded=special!==null ? special : round05(raw);
  const final=resolvePriceMode('sagrod',raw,rounded,accAddon(getAccessories('sagrod')));
  updatePreview(weight,base,final);
}
/* ── Accessories helper ── */
function getAccessories(type){
  const nutEnabled=!!(el(type+'-nutEnabled')&&el(type+'-nutEnabled').checked);
  const fwEnabled=!!(el(type+'-fwEnabled')&&el(type+'-fwEnabled').checked);
  const customEnabled=!!(el(type+'-customEnabled')&&el(type+'-customEnabled').checked);
  const nutQty=parseFloat((el(type+'-nutQty')&&el(type+'-nutQty').value)||2)||2;
  const fwQty=parseFloat((el(type+'-fwQty')&&el(type+'-fwQty').value)||1)||1;
  const nutPrice=parseFloat((el(type+'-nutPrice')&&el(type+'-nutPrice').value)||0)||0;
  const fwPrice=parseFloat((el(type+'-fwPrice')&&el(type+'-fwPrice').value)||0)||0;
  const customPrice=parseFloat((el(type+'-customPrice')&&el(type+'-customPrice').value)||0)||0;
  const nutFinish=(el(type+'-nutFinish')&&el(type+'-nutFinish').value)||'';
  const fwFinish=(el(type+'-fwFinish')&&el(type+'-fwFinish').value)||'';
  const customText=((el(type+'-customText')&&el(type+'-customText').value)||'').trim();
  return {
    nut:{enabled:nutEnabled,qty:nutQty,finish:nutFinish,unitPrice:nutPrice},
    fw:{enabled:fwEnabled,qty:fwQty,finish:fwFinish,unitPrice:fwPrice},
    custom:{enabled:customEnabled,text:customText,unitPrice:customPrice}
  };
}
function accAddon(acc){
  if(!acc) return 0;
  let addon=0;
  if(acc.nut&&acc.nut.enabled) addon+=(acc.nut.qty||0)*(acc.nut.unitPrice||0);
  if(acc.fw&&acc.fw.enabled) addon+=(acc.fw.qty||0)*(acc.fw.unitPrice||0);
  if(acc.custom&&acc.custom.enabled) addon+=(acc.custom.unitPrice||0);
  return addon;
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
function setAccPanelOpen(type,open){
  const panel=el(type+'-accPanel'), btn=el(type+'-accToggle');
  if(panel) panel.classList.toggle('open',!!open);
  if(btn) btn.classList.toggle('open',!!open);
}
function toggleAccPanel(type){
  const panel=el(type+'-accPanel');
  setAccPanelOpen(type,!(panel&&panel.classList.contains('open')));
  scheduleDraftAutosave();
}
function onAccChange(type){
  const nutEn=el(type+'-nutEnabled')&&el(type+'-nutEnabled').checked;
  const fwEn=el(type+'-fwEnabled')&&el(type+'-fwEnabled').checked;
  const customEn=el(type+'-customEnabled')&&el(type+'-customEnabled').checked;
  ['nutQty','nutFinish','nutPrice'].forEach(f=>{const e=el(type+'-'+f);if(e)e.disabled=!nutEn});
  ['fwQty','fwFinish','fwPrice'].forEach(f=>{const e=el(type+'-'+f);if(e)e.disabled=!fwEn});
  ['customText','customPrice'].forEach(f=>{const e=el(type+'-'+f);if(e)e.disabled=!customEn});
  const nutRow=el(type+'-nutEnabled')?.closest('.acc-item');
  const fwRow=el(type+'-fwEnabled')?.closest('.acc-item');
  const customRow=el(type+'-customEnabled')?.closest('.acc-item');
  if(nutRow) nutRow.classList.toggle('is-disabled',!nutEn);
  if(fwRow) fwRow.classList.toggle('is-disabled',!fwEn);
  if(customRow) customRow.classList.toggle('is-disabled',!customEn);
  /* Safety badge: the panel is usually collapsed, so an enabled accessory must be
     visible from the outside. Injected here rather than in the markup so every
     form gets it — including the runtime-cloned L Bolt 45DEG and Others forms. */
  const activeCount=(nutEn?1:0)+(fwEn?1:0)+(customEn?1:0);
  const toggleBtn=el(type+'-accToggle');
  if(toggleBtn){
    let badge=toggleBtn.querySelector('.acc-active-badge');
    if(activeCount>0){
      if(!badge){ badge=document.createElement('span'); badge.className='acc-active-badge'; toggleBtn.appendChild(badge); }
      badge.textContent=activeCount+' active';
      toggleBtn.classList.add('has-acc');
    }else{
      if(badge) badge.remove();
      toggleBtn.classList.remove('has-acc');
    }
  }
  if(type===currentType) refreshAccPreview();
}
function resetAccPanel(type){
  ['nutEnabled','fwEnabled','customEnabled'].forEach(f=>{const e=el(type+'-'+f);if(e)e.checked=false;});
  ['nutQty'].forEach(f=>{const e=el(type+'-'+f);if(e)e.value='2';});
  ['fwQty'].forEach(f=>{const e=el(type+'-'+f);if(e)e.value='1';});
  ['nutPrice','fwPrice','customPrice'].forEach(f=>{const e=el(type+'-'+f);if(e)e.value='0';});
  ['customText'].forEach(f=>{const e=el(type+'-'+f);if(e)e.value='';});
  ['nutFinish','fwFinish'].forEach(f=>{const e=el(type+'-'+f);if(e)e.selectedIndex=0;});
  onAccChange(type);
  setAccPanelOpen(type,false);
}
function loadAccIntoForm(type,acc){
  if(!acc) return;
  const nutEn=el(type+'-nutEnabled'); if(nutEn) nutEn.checked=!!(acc.nut&&acc.nut.enabled);
  const fwEn=el(type+'-fwEnabled');  if(fwEn)  fwEn.checked=!!(acc.fw&&acc.fw.enabled);
  const customEn=el(type+'-customEnabled'); if(customEn) customEn.checked=!!(acc.custom&&acc.custom.enabled);
  if(acc.nut){
    const nq=el(type+'-nutQty');  if(nq) nq.value=acc.nut.qty||2;
    const nf=el(type+'-nutFinish'); if(nf) nf.value=acc.nut.finish||'';
    const np=el(type+'-nutPrice'); if(np) np.value=acc.nut.unitPrice||0;
  }
  if(acc.fw){
    const fq=el(type+'-fwQty');  if(fq) fq.value=acc.fw.qty||1;
    const ff=el(type+'-fwFinish'); if(ff) ff.value=acc.fw.finish||'';
    const fp=el(type+'-fwPrice'); if(fp) fp.value=acc.fw.unitPrice||0;
  }
  if(acc.custom){
    const ct=el(type+'-customText'); if(ct) ct.value=acc.custom.text||'';
    const cp=el(type+'-customPrice'); if(cp) cp.value=acc.custom.unitPrice||0;
  }
  onAccChange(type);
  const hasAcc=(acc.nut&&acc.nut.enabled)||(acc.fw&&acc.fw.enabled)||(acc.custom&&acc.custom.enabled);
  setAccPanelOpen(type,hasAcc);
}

function addSagRod(){
  const wasEditing=editingItemIndex!==null;
  const size=normalizeSizeValue(fv('sagrod','size'));
  const diameter=fn('sagrod','diameter'), length=fn('sagrod','length');
  const threadLen=fv('sagrod','threadLen').trim();
  if(!size){showToast('Enter Size');return}
  if(!diameter){showToast('Enter Diameter');return}
  if(!length){showToast('Enter Length');return}
  if(!validateDims({'Diameter':diameter,'Length':length})) return;
  const costRateVal=fv('sagrod','costRate').trim(), addCostVal=fv('sagrod','addCost').trim();
  if(!costRateVal && !addCostVal){showToast('Cost Rate is blank. Enter price before adding.');return}
  if(!validatePriceMode('sagrod')) return;
  const costRate=validateRateEntry('sagrod','costRate','Cost Rate'), addCost=validateRateEntry('sagrod','addCost','Additional Cost');
  if(costRate===null||addCost===null) return;
  const markup=fn('sagrod','markup'), qty=validateQtyEntry('sagrod');
  if(qty===null) return;
  const weight=diameter*diameter*length*0.0000061654;
  const base=weight*costRate+addCost;
  const special=getMSUndersizeSagRodPLSpecialPrice(size,fv('sagrod','sizeType'),fv('sagrod','material'),getFinish('sagrod'),threadLen,length);
  const raw=base*(1+markup/100);
  const rounded=special!==null ? special : round05(raw);
  const sizeLabel=formatSizeLabel(size,diameter,fv('sagrod','sizeType'))+' x L '+cleanNum(length)+(threadLen?' x TL '+withMm(threadLen):'');
  const acc=getAccessories('sagrod');
  const final=resolvePriceMode('sagrod',raw,rounded,accAddon(acc));
  if(!pushItem('sagrod',sizeLabel,fv('sagrod','material'),qty,final,final*qty,markup,size,fv('sagrod','sizeType'),acc,weight)) return;
  el('sagrod-length').value=''; calcSagRod();
  flashPreview();
  if(!wasEditing) showToast(dcT('tSagRodAdded'));
  setTimeout(()=>{try{el('sagrod-length').focus()}catch(e){}},50);
}

function onStudSizeInput(){
  // Stud always uses UNDERSIZE diameter — no Size Type selector
  const sizeEl=el('stud-size'); if(!sizeEl) return;
  const size=normalizeSizeValue(sizeEl.value); sizeEl.value=size;
  const material=fv('stud','material');
  const custom=findDSRule('stud',material,'',size);
  const dia=custom!==null ? custom
           : DIA_UNDERSIZE_INCH[size]!==undefined ? DIA_UNDERSIZE_INCH[size]
           : DIA_UNDERSIZE[size]!==undefined ? DIA_UNDERSIZE[size] : undefined;
  if(dia!==undefined){ const d=el('stud-diameter'); if(d) d.value=dia; }
  updateFinishAvailability('stud');
  calcStud();
  applyDefaultPrice();
}
function calcStud(){
  const diameter=fn('stud','diameter'), length=fn('stud','l');
  const costRate=evalExpr(fv('stud','costRate')), addCost=evalExpr(fv('stud','addCost')), markup=fn('stud','markup');
  const weight=diameter*diameter*length*0.0000061654;
  const base=weight*costRate+addCost;
  const raw=base*(1+markup/100), final=resolvePriceMode('stud',raw,round05(raw),accAddon(getAccessories('stud')));
  updatePreview(weight,base,final);
}
function addStud(){
  const wasEditing=editingItemIndex!==null;
  const size=normalizeSizeValue(fv('stud','size'));
  const diameter=fn('stud','diameter'), length=fn('stud','l');
  if(!size){showToast('Enter Size');return}
  if(!diameter){showToast('Enter Diameter');return}
  if(!length){showToast('Enter L');return}
  if(!validateDims({'Diameter':diameter,'L':length})) return;
  const costRateVal=fv('stud','costRate').trim(), addCostVal=fv('stud','addCost').trim();
  if(!costRateVal && !addCostVal){showToast('Cost Rate is blank. Enter price before adding.');return}
  if(!validatePriceMode('stud')) return;
  const costRate=validateRateEntry('stud','costRate','Cost Rate'), addCost=validateRateEntry('stud','addCost','Additional Cost');
  if(costRate===null||addCost===null) return;
  const markup=fn('stud','markup'), qty=validateQtyEntry('stud');
  if(qty===null) return;
  const weight=diameter*diameter*length*0.0000061654;
  const base=weight*costRate+addCost;
  const raw=base*(1+markup/100);
  const sizeLabel=size+' x L '+cleanNum(length)+'mm';
  const acc=getAccessories('stud');
  const final=resolvePriceMode('stud',raw,round05(raw),accAddon(acc));
  if(!pushItem('stud',sizeLabel,fv('stud','material'),qty,final,final*qty,markup,size,'',acc,weight)) return;
  el('stud-l').value=''; calcStud();
  flashPreview();
  if(!wasEditing) showToast(dcT('tStudAdded'));
  setTimeout(()=>{try{el('stud-l').focus()}catch(e){}},50);
}

/* ── Anchor Bolt ── */
function calcAnchorBolt(){
  const diameter=fn('anchorbolt','diameter'), length=fn('anchorbolt','l');
  const costRate=evalExpr(fv('anchorbolt','costRate')), addCost=evalExpr(fv('anchorbolt','addCost')), markup=fn('anchorbolt','markup');
  const weight=diameter*diameter*length*0.0000061654;
  const base=weight*costRate+addCost;
  const raw=base*(1+markup/100), final=resolvePriceMode('anchorbolt',raw,round05(raw),accAddon(getAccessories('anchorbolt')));
  updatePreview(weight,base,final);
}
function addAnchorBolt(){
  const wasEditing=editingItemIndex!==null;
  const size=normalizeSizeValue(fv('anchorbolt','size'));
  const diameter=fn('anchorbolt','diameter'), length=fn('anchorbolt','l');
  const threadLen=fv('anchorbolt','threadLen').trim();
  if(!size){showToast('Enter Size');return}
  if(!diameter){showToast('Enter Diameter');return}
  if(!length){showToast('Enter L');return}
  if(!validateDims({'Diameter':diameter,'L':length})) return;
  const costRateVal=fv('anchorbolt','costRate').trim(), addCostVal=fv('anchorbolt','addCost').trim();
  if(!costRateVal && !addCostVal){showToast('Cost Rate is blank. Enter price before adding.');return}
  if(!validatePriceMode('anchorbolt')) return;
  const costRate=validateRateEntry('anchorbolt','costRate','Cost Rate'), addCost=validateRateEntry('anchorbolt','addCost','Additional Cost');
  if(costRate===null||addCost===null) return;
  const markup=fn('anchorbolt','markup'), qty=validateQtyEntry('anchorbolt');
  if(qty===null) return;
  const weight=diameter*diameter*length*0.0000061654;
  const base=weight*costRate+addCost;
  const raw=base*(1+markup/100);
  const sizeLabel=formatSizeLabel(size,diameter,fv('anchorbolt','sizeType'))+' x L '+cleanNum(length)+(threadLen?' x TL '+withMm(threadLen):'');
  const acc=getAccessories('anchorbolt');
  const final=resolvePriceMode('anchorbolt',raw,round05(raw),accAddon(acc));
  if(!pushItem('anchorbolt',sizeLabel,fv('anchorbolt','material'),qty,final,final*qty,markup,size,fv('anchorbolt','sizeType'),acc,weight)) return;
  el('anchorbolt-l').value=''; calcAnchorBolt();
  flashPreview();
  if(!wasEditing) showToast(dcT('tAnchorAdded'));
  setTimeout(()=>{try{el('anchorbolt-l').focus()}catch(e){}},50);
}

/* ── U-Bolt ── */
function syncUBoltDebugVisibility(){
  const wrap=el('uboltDebugWrap'),panel=el('uboltDebugPanel'),button=el('uboltDebugToggle');
  if(wrap) wrap.style.display=currentType==='ubolt'?'block':'none';
  if(panel) panel.classList.toggle('show',uboltDebugEnabled&&currentType==='ubolt');
  if(button) button.textContent=uboltDebugEnabled?'Hide Debug':'Show Debug';
}
function toggleUBoltDebug(){
  uboltDebugEnabled=!uboltDebugEnabled;
  syncUBoltDebugVisibility();
  calcUBolt('ubolt',true);
  renderQuote();
}
function setUBoltDebugValue(id,value){const target=el(id);if(target)target.textContent=value}
function updateUBoltDebug(data){
  if(!data) return;
  setUBoltDebugValue('ubDebugDiameter',cleanNum(data.diameter)+' mm');
  setUBoltDebugValue('ubDebugId',cleanNum(data.id)+' mm');
  setUBoltDebugValue('ubDebugIh',cleanNum(data.ih)+' mm');
  setUBoltDebugValue('ubDebugThreadLen',data.threadLen||'—');
  setUBoltDebugValue('ubDebugTotalLen',cleanNum(data.totalLength)+' mm');
  setUBoltDebugValue('ubDebugWeight',data.weight.toFixed(6)+' kg');
  setUBoltDebugValue('ubDebugCostRate','RM '+data.costRate.toFixed(4));
  setUBoltDebugValue('ubDebugAddCost','RM '+data.addCost.toFixed(4));
  setUBoltDebugValue('ubDebugMarkup',data.markup.toFixed(2)+'%');
  setUBoltDebugValue('ubDebugBase','RM '+data.base.toFixed(6));
  setUBoltDebugValue('ubDebugBeforeRound','RM '+data.beforeRound.toFixed(6));
  setUBoltDebugValue('ubDebugAfterRound','RM '+data.afterRound.toFixed(2));
}
function getSavedUBoltDebug(item){
  const fd=item&&item.formData;
  if(!fd) return null;
  const diameter=parseFloat(fd.diameter??fd.dimensions?.diameter)||0,id=parseFloat(fd.id??fd.dimensions?.id)||0,ih=parseFloat(fd.ih??fd.dimensions?.ih)||0;
  const storedLength=parseFloat(fd.length)||parseFloat(fd.totalLength)||parseFloat(fd.dimensions?.totalLength)||0;
  const totalLength=storedLength?Math.ceil(storedLength):Math.ceil((diameter+id)*1.57+(2*ih)-id);
  const costRate=evalExpr(String(fd.costRate??'')),addCost=evalExpr(String(fd.addCost??'')),markup=parseFloat(fd.markup)||0;
  const weight=diameter*diameter*totalLength*0.0000061654;
  const base=weight*costRate+addCost,beforeRound=base*(1+markup/100),afterRound=roundCustom10(beforeRound);
  const mode=fd.priceMode||item.priceMode||'auto';
  const accessoryCost=accAddon(fd.accessories||item.accessories||{});
  const recalculatedUnit=mode==='manual'
    ? evalExpr(String(fd.manualUnitPrice??item.manualUnitPrice??''))
    : mode==='no_round' ? roundMoney2(beforeRound)+accessoryCost : afterRound+accessoryCost;
  return {diameter,id,ih,threadLen:String(fd.threadLen||fd.dimensions?.threadLen||''),totalLength,recalculatedUnit};
}
function getUBoltCardDebugHtml(item){
  if(!uboltDebugEnabled||item.itemType!=='ubolt'||!item.formData) return '';
  const data=getSavedUBoltDebug(item);
  if(!data) return '';
  const dimensions=`D ${cleanNum(data.diameter)}, ID ${cleanNum(data.id)}, IH ${cleanNum(data.ih)}, TL ${data.threadLen||'—'}, Total L ${cleanNum(data.totalLength)}`;
  const text=`Saved Unit ${fmt(parseFloat(item.finalUnitPrice)||0)} | Saved formData: ${dimensions} | Recalculated Unit ${fmt(data.recalculatedUnit)}`;
  return `<div class="ubolt-card-debug">${escHtml(text)}</div>`;
}
function calcUBolt(type,skipAuto){
  const d=fn(type,'diameter'), id=fn(type,'id'), ih=fn(type,'ih');
  const tlEl=el(type+'-length');
  if(!skipAuto && (d>0||id>0||ih>0)){ const auto=Math.ceil((d+id)*1.57+(2*ih)-id); if(tlEl) tlEl.value=auto>0?auto:''; }
  const tl=parseFloat(tlEl?tlEl.value:0)||0;
  const costRate=evalExpr(fv(type,'costRate')), addCost=evalExpr(fv(type,'addCost')), markup=fn(type,'markup');
  const weight=d*d*tl*0.0000061654;
  const base=weight*costRate+addCost;
  const beforeRound=base*(1+markup/100);
  const rounded=roundCustom10(beforeRound);
  const final=resolvePriceMode(type,beforeRound,rounded,accAddon(getAccessories(type)));
  updatePreview(weight,base,final);
  if(type==='ubolt') updateUBoltDebug({diameter:d,id,ih,threadLen:fv(type,'threadLen').trim(),totalLength:tl,weight,costRate,addCost,markup,base,beforeRound,afterRound:rounded});
}
function addUBolt(){
  const type='ubolt';
  const size=normalizeSizeValue(fv(type,'size')), d=fn(type,'diameter');
  const id=fv(type,'id'), ih=fv(type,'ih'), tl=fv(type,'threadLen');
  if(!size){showToast('Enter Size');return}
  if(!d){showToast('Enter Diameter');return}
  const tlField=el(type+'-length'), totalLen=Math.ceil(parseFloat(tlField.value)||0);
  if(!totalLen){showToast('Total Length is 0 — check Diameter, ID, IH');return}
  if(!validateDims({'Diameter':d,'Total Length':totalLen})) return;
  if((id&&parseFloat(id)<0)||(ih&&parseFloat(ih)<0)){showToast(dcT('tIdIhNeg'));return}
  const costRateRaw=fv(type,'costRate').trim(), addCostRaw=fv(type,'addCost').trim();
  if(!costRateRaw){showToast('Cost Rate is blank — enter price before adding');return}
  if(!addCostRaw){showToast('Additional Cost is blank — enter price before adding');return}
  if(!validatePriceMode(type)) return;
  const costRate=validateRateEntry(type,'costRate','Cost Rate'), addCost=validateRateEntry(type,'addCost','Additional Cost');
  if(costRate===null||addCost===null) return;
  const markup=fn(type,'markup'), qty=validateQtyEntry(type);
  if(qty===null) return;
  const weight=d*d*totalLen*0.0000061654, base=weight*costRate+addCost, raw=base*(1+markup/100), rounded=roundCustom10(raw);
  const acc=getAccessories(type);
  const final=resolvePriceMode(type,raw,rounded,accAddon(acc)), total=final*qty;
  const sizeLabel=formatSizeLabel(size,d,fv(type,'sizeType'));
  const dimStr=sizeLabel+(id?' x ID '+cleanNum(id):'')+(ih?' x IH '+cleanNum(ih):'')+(tl?' x TL '+withMm(tl):'');
  if(!pushItem(type,dimStr,fv(type,'material'),qty,final,total,markup,size,fv(type,'sizeType'),acc,weight)) return;
  flashPreview();
}

/* ── SQ U-Bolt ── */
function calcSQUBolt(type,skipAuto){
  const d=fn(type,'diameter'), oh=fn(type,'oh'), w=fn(type,'w');
  const tlEl=el(type+'-length');
  if(!skipAuto && (d>0||oh>0||w>0)){ const auto=Math.ceil(((w/2+oh)-d*1.5)*2); if(tlEl) tlEl.value=auto>0?auto:''; }
  const tl=parseFloat(tlEl?tlEl.value:0)||0;
  const costRate=evalExpr(fv(type,'costRate')), addCost=evalExpr(fv(type,'addCost')), markup=fn(type,'markup');
  const weight=d*d*tl*0.0000061654, base=weight*costRate+addCost, raw=base*(1+markup/100), final=resolvePriceMode(type,raw,roundCustom10(raw),accAddon(getAccessories(type)));
  updatePreview(weight,base,final);
}
function addSQUBolt(){
  const type='squbolt';
  const size=normalizeSizeValue(fv(type,'size')), d=fn(type,'diameter');
  const oh=fv(type,'oh'), w=fv(type,'w'), tl=fv(type,'threadLen');
  if(!size){showToast('Enter Size');return}
  if(!d){showToast('Enter Diameter');return}
  if(!oh||!w){showToast('Enter OH and W');return}
  const tlField=el(type+'-length'), totalLen=Math.ceil(parseFloat(tlField.value)||0);
  if(!totalLen){showToast('Total Length is 0 — check OH, W, Diameter');return}
  if(!validateDims({'Diameter':d,'OH':oh,'W':w,'Total Length':totalLen})) return;
  const costRateRaw=fv(type,'costRate').trim(), addCostRaw=fv(type,'addCost').trim();
  if(!costRateRaw){showToast('Cost Rate is blank — enter price before adding');return}
  if(!addCostRaw){showToast('Additional Cost is blank — enter price before adding');return}
  if(!validatePriceMode(type)) return;
  const costRate=validateRateEntry(type,'costRate','Cost Rate'), addCost=validateRateEntry(type,'addCost','Additional Cost');
  if(costRate===null||addCost===null) return;
  const markup=fn(type,'markup'), qty=validateQtyEntry(type);
  if(qty===null) return;
  const weight=d*d*totalLen*0.0000061654, base=weight*costRate+addCost, raw=base*(1+markup/100), rounded=roundCustom10(raw);
  const acc=getAccessories(type);
  const final=resolvePriceMode(type,raw,rounded,accAddon(acc)), total=final*qty;
  const sizeLabel=formatSizeLabel(size,d,fv(type,'sizeType'));
  const dimStr=sizeLabel+' x OH '+cleanNum(oh)+' x W '+cleanNum(w)+(tl?' x TL '+withMm(tl):'');
  if(!pushItem(type,dimStr,fv(type,'material'),qty,final,total,markup,size,fv(type,'sizeType'),acc,weight)) return;
  flashPreview();
}

/* ── L Bolt ── */
function calcLBolt(type,skipAuto){
  const d=fn(type,'diameter'), l=fn(type,'l'), w=fn(type,'w');
  const tlEl=el(type+'-length');
  if(type!=='lbolt45' && !skipAuto && (l>0||w>0||d>0)){ const auto=Math.ceil(l+w-d*1.5); if(tlEl) tlEl.value=auto>0?auto:''; }
  const tl=parseFloat(tlEl?tlEl.value:0)||0;
  const costRate=evalExpr(fv(type,'costRate')), addCost=evalExpr(fv(type,'addCost')), markup=fn(type,'markup');
  const weight=d*d*tl*0.0000061654, base=weight*costRate+addCost, raw=base*(1+markup/100), final=resolvePriceMode(type,raw,roundCustom10(raw),accAddon(getAccessories(type)));
  updatePreview(weight,base,final);
}
function addLBolt(type='lbolt'){
  const size=normalizeSizeValue(fv(type,'size')), d=fn(type,'diameter');
  const l=fv(type,'l'), w=fv(type,'w'), tl=fv(type,'threadLen');
  if(!size){showToast('Enter Size');return}
  if(!l||!w){showToast('Enter L and W dimensions');return}
  if(!d){showToast('Enter Diameter');return}
  const costRateRaw=fv(type,'costRate').trim(), addCostRaw=fv(type,'addCost').trim();
  if(!costRateRaw){showToast('Cost Rate is blank — enter price before adding');return}
  if(!addCostRaw){showToast('Additional Cost is blank — enter price before adding');return}
  if(!validatePriceMode(type)) return;
  const tlField=el(type+'-length'), totalLen=Math.ceil(parseFloat(tlField.value)||0);
  if(!totalLen){showToast('Total Length is 0 — check L, W, Diameter');return}
  if(!validateDims({'Diameter':d,'L':l,'W':w,'Total Length':totalLen})) return;
  const costRate=validateRateEntry(type,'costRate','Cost Rate'), addCost=validateRateEntry(type,'addCost','Additional Cost');
  if(costRate===null||addCost===null) return;
  const markup=fn(type,'markup'), qty=validateQtyEntry(type);
  if(qty===null) return;
  const weight=d*d*totalLen*0.0000061654, base=weight*costRate+addCost, raw=base*(1+markup/100), rounded=roundCustom10(raw);
  const acc=getAccessories(type);
  const final=resolvePriceMode(type,raw,rounded,accAddon(acc)), total=final*qty;
  const sizeLabel=formatSizeLabel(size,d,fv(type,'sizeType'));
  const dimStr=sizeLabel+' x L '+cleanNum(l)+' x W '+cleanNum(w)+(tl?' x TL '+withMm(tl):'')+(type==='lbolt45'?' 45deg':'');
  if(!pushItem(type,dimStr,fv(type,'material'),qty,final,total,markup,size,fv(type,'sizeType'),acc,weight)) return;
  flashPreview();
}

/* ── J Bolt ── */
function calcJBolt(type,skipAuto){
  const d=fn(type,'diameter'), h=fn(type,'h'), id=fn(type,'id'), s=fn(type,'s');
  const tlEl=el(type+'-length');
  if(!skipAuto && (d>0||h>0||id>0||s>0)){
    const upper=h-s, lower=(d+id)*1.57+(s-d)+(s-d)-id;
    const auto=Math.ceil(upper+lower);
    if(tlEl) tlEl.value=auto>0?auto:'';
  }
  const tl=parseFloat(tlEl?tlEl.value:0)||0;
  const costRate=evalExpr(fv(type,'costRate')), addCost=evalExpr(fv(type,'addCost')), markup=fn(type,'markup');
  const weight=d*d*tl*0.0000061654, base=weight*costRate+addCost, raw=base*(1+markup/100), final=resolvePriceMode(type,raw,roundCustom10(raw),accAddon(getAccessories(type)));
  updatePreview(weight,base,final);
}
function addJBolt(){
  const type='jbolt';
  const size=normalizeSizeValue(fv(type,'size')), d=fn(type,'diameter');
  const h=fv(type,'h'), id=fv(type,'id'), s=fv(type,'s'), tl=fv(type,'threadLen');
  if(!size){showToast('Enter Size');return}
  if(!d){showToast('Enter Diameter');return}
  if(!h||!id||!s){showToast('Enter H, ID and S');return}
  const costRateRaw=fv(type,'costRate').trim(), addCostRaw=fv(type,'addCost').trim();
  if(!costRateRaw){showToast('Cost Rate is blank — enter price before adding');return}
  if(!addCostRaw){showToast('Additional Cost is blank — enter price before adding');return}
  if(!validatePriceMode(type)) return;
  const tlField=el(type+'-length'), totalLen=Math.ceil(parseFloat(tlField.value)||0);
  if(!totalLen){showToast('Total Length is 0 — check H, ID, S, Diameter');return}
  if(!validateDims({'Diameter':d,'H':h,'ID':id,'S':s,'Total Length':totalLen})) return;
  const costRate=validateRateEntry(type,'costRate','Cost Rate'), addCost=validateRateEntry(type,'addCost','Additional Cost');
  if(costRate===null||addCost===null) return;
  const markup=fn(type,'markup'), qty=validateQtyEntry(type);
  if(qty===null) return;
  const weight=d*d*totalLen*0.0000061654, base=weight*costRate+addCost, raw=base*(1+markup/100), rounded=roundCustom10(raw);
  const acc=getAccessories(type);
  const final=resolvePriceMode(type,raw,rounded,accAddon(acc)), total=final*qty;
  const sizeLabel=formatSizeLabel(size,d,fv(type,'sizeType'));
  const dimStr=sizeLabel+' x H '+cleanNum(h)+' x ID '+cleanNum(id)+' x S '+cleanNum(s)+(tl?' x TL '+withMm(tl):'');
  if(!pushItem(type,dimStr,fv(type,'material'),qty,final,total,markup,size,fv(type,'sizeType'),acc,weight)) return;
  flashPreview();
}

function fieldExists(type,field){ return !!el(type+'-'+field); }
function setFieldValue(type,field,value){
  const input=el(type+'-'+field);
  if(input) input.value=value ?? '';
}
function setFinishValue(type,finish){
  const value=finish || '';
  const input=document.querySelector(`input[name="${type}-finish"][value="${value}"]`);
  if(input) input.checked=true;
  setFinishPills(type,value);
  updateFinishAvailability(type);
}
function captureItemFormData(type){
  const fields=['material','sizeType','size','diameter','length','threadLen','l','id','ih','oh','w','h','s','productName','dimensionText','weightMode','unitWeight','costRate','addCost','markup','qty','priceMode','manualUnitPrice',
    'plateType','t','hd','nh',
    'tri-l','tri-h','tri-cl','tri-ch','tri-t'];
  const data={itemType:type,productType:ITEM_TYPES[type]||type,finish:getFinish(type),accessories:getAccessories(type)};
  fields.forEach(field=>{
    const input=el(type+'-'+field);
    if(input) data[field]=input.value;
  });
  const totalLengthEl=el(type+'-length');
  if(totalLengthEl) data.totalLength=totalLengthEl.value;
  data.dimensions={
    diameter:fv(type,'diameter'),
    length:fv(type,'length'),
    l:fv(type,'l'),
    id:fv(type,'id'),
    ih:fv(type,'ih'),
    oh:fv(type,'oh'),
    w:fv(type,'w'),
    h:fv(type,'h'),
    s:fv(type,'s'),
    threadLen:fv(type,'threadLen'),
    totalLength:totalLengthEl ? totalLengthEl.value : ''
  };
  Object.assign(data,getPriceModeSaveData(type));
  return data;
}
function parseSizeLabelForEdit(item){
  const raw=String(item.cleanSize||item.sizeCode||'').trim();
  if(raw) return raw;
  const left=String(item.size||'').split(' x ')[0].trim();
  const custom=left.match(/^Ø?[\d.]+-(.+)$/i) || left.match(/^Ã˜[\d.]+-(.+)$/i);
  return custom ? custom[1] : left;
}
function parseDiameterForEdit(item){
  if(item.formData && item.formData.diameter!==undefined) return item.formData.diameter;
  if(item.diameter!==undefined) return item.diameter;
  const left=String(item.size||'').split(' x ')[0].trim();
  const m=left.match(/^(?:Ø|Ã˜)([\d.]+)-/i);
  return m ? m[1] : '';
}
function parseDimValue(text,label){
  const re=new RegExp('(?:^| x )'+label+'\\s+([^ x]+(?:/[^ x]+)?)','i');
  const m=String(text||'').match(re);
  return m ? String(m[1]).replace(/mm$/i,'') : '';
}
function parseDimensionsForEdit(item,type){
  const dim=String(item.size||'');
  if(type==='sagrod') return {length:parseDimValue(dim,'L'),threadLen:parseDimValue(dim,'TL')};
  if(type==='stud') return {l:parseDimValue(dim,'L')};
  if(type==='anchorbolt') return {l:parseDimValue(dim,'L'),threadLen:parseDimValue(dim,'TL')};
  if(type==='ubolt') return {id:parseDimValue(dim,'ID'),ih:parseDimValue(dim,'IH'),threadLen:parseDimValue(dim,'TL')};
  if(type==='squbolt') return {oh:parseDimValue(dim,'OH'),w:parseDimValue(dim,'W'),threadLen:parseDimValue(dim,'TL')};
  if(type==='lbolt' || type==='lbolt45') return {l:parseDimValue(dim,'L'),w:parseDimValue(dim,'W'),threadLen:parseDimValue(dim,'TL')};
  if(type==='jbolt') return {h:parseDimValue(dim,'H'),id:parseDimValue(dim,'ID'),s:parseDimValue(dim,'S'),threadLen:parseDimValue(dim,'TL')};
  if(type==='plate') return {}; // plate uses formData entirely
  return {};
}
function resolveItemType(item){
  if(item.itemType && ITEM_TYPES[item.itemType]) return item.itemType;
  const normalized=String(item.productType||item.desc||'').toUpperCase().replace(/[-\s]+/g,'');
  const found=Object.entries(ITEM_TYPES)
    .sort((a,b)=>b[1].length-a[1].length)
    .find(([,label])=>normalized.includes(label.replace(/[-\s]+/g,'')));
  return found ? found[0] : currentType;
}
function fillItemFormFromItem(item){
  const type=resolveItemType(item);
  switchType(type);
  /* Above the plate / WAS branches below, which return early: every product
     type gets its custom dimensions back when the item is edited. An older
     item without the field simply restores an empty editor. */
  dcSetCustomDims(item.customDimensions);
  // Plate has its own complete restore path
  if(type==='plate'){
    fillPlateFormFromItem(item);
    return;
  }
  if(type==='was'){
    fillWASFormFromItem(item);
    return;
  }
  const saved=item.formData||{};
  const hasSavedCostRate=Object.prototype.hasOwnProperty.call(saved,'costRate');
  const hasSavedAddCost=Object.prototype.hasOwnProperty.call(saved,'addCost');
  resetAccPanel(type);
  /* Others / Special Bolt may legitimately be saved with no material and no
     size type, so it falls back to blank rather than MS / FULLSIZE. Every other
     product type keeps the original defaults for older items that lack them. */
  const blankOk = type==='others';
  setFieldValue(type,'material',saved.material ?? item.material ?? (blankOk?'':'MS'));
  if(fieldExists(type,'sizeType')) setFieldValue(type,'sizeType',saved.sizeType ?? item.sizeType ?? (blankOk?'':'FULLSIZE'));
  /* Deliberately still 'manual', NOT the fresh-form default of 'length': an older
     Others item saved without a weightMode carries a hand-entered unitWeight, and
     reading it as Diameter x Length would discard that weight and change its price. */
  if(type==='others') setFieldValue(type,'weightMode',saved.weightMode ?? 'manual');
  setFieldValue(type,'priceMode',saved.priceMode ?? item.priceMode ?? 'auto');
  setFieldValue(type,'manualUnitPrice',saved.manualUnitPrice ?? item.manualUnitPrice ?? '');
  setFieldValue(type,'size',saved.size ?? parseSizeLabelForEdit(item));
  autoFillDiameter(type);
  const parsed=parseDimensionsForEdit(item,type);
  Object.entries(parsed).forEach(([field,value])=>setFieldValue(type,field,value));
  if(!hasSavedCostRate) setFieldValue(type,'costRate','');
  if(!hasSavedAddCost) setFieldValue(type,'addCost','');
  ['diameter','length','threadLen','l','id','ih','oh','w','h','s','productName','dimensionText','weightMode','unitWeight','costRate','addCost','markup','qty','priceMode','manualUnitPrice'].forEach(field=>{
    if(saved[field]!==undefined) setFieldValue(type,field,saved[field]);
  });
  if(saved.dimensions){
    ['diameter','length','threadLen','l','id','ih','oh','w','h','s'].forEach(field=>{
      if(saved[field]===undefined && saved.dimensions[field]!==undefined) setFieldValue(type,field,saved.dimensions[field]);
    });
    if(saved.length===undefined && saved.dimensions.totalLength!==undefined) setFieldValue(type,'length',saved.dimensions.totalLength);
  }
  if(saved.length===undefined && saved.totalLength!==undefined) setFieldValue(type,'length',saved.totalLength);
  if(!saved.diameter){
    const parsedDiameter=parseDiameterForEdit(item);
    if(parsedDiameter) setFieldValue(type,'diameter',parsedDiameter);
  }
  if(saved.qty===undefined) setFieldValue(type,'qty',item.qty||1);
  if(saved.markup===undefined) setFieldValue(type,'markup',item.markup||0);
  /* Phase 1 fix: prices restored from a saved item belong to that quotation —
     protect them like manual entries so a size/finish tweak during editing
     cannot silently swap in default pricing. */
  if(hasSavedCostRate) markUserPriced(type,'costRate');
  if(hasSavedAddCost) markUserPriced(type,'addCost');
  setFinishValue(type,saved.finish ?? item.finish ?? '');
  loadAccIntoForm(type,saved.accessories || item.accessories);
  onPriceModeChange(type);
  if(type==='others') onOthersWeightModeChange();
  if(!hasSavedCostRate || !hasSavedAddCost){
    applyDefaultPrice();
    showToast(dcT('tOldNoRate'));
  }
  recalcCurrent();
}
function setItemEditMode(index){
  editingItemIndex=Number.isInteger(index)?index:null;
  const editing=editingItemIndex!==null;
  const note=el('itemEditNote');
  if(note){
    note.classList.toggle('show',editing);
    if(editing) note.textContent=dcT('editingItem').replace('{n}', editingItemIndex+1);
  }
  const addBtn=el('addBtn');
  /* Carries the key rather than a literal, so dcApplyLang() re-labels it on a
     switch exactly like any other opted-in element. */
  if(addBtn){ const k=editing?'updateItem':'addToQuotation';
              addBtn.setAttribute('data-i18n',k); addBtn.textContent=dcT(k); }
  const cancelBtn=el('cancelItemEditBtn');
  if(cancelBtn) cancelBtn.style.display=editing?'inline-flex':'none';
  /* The one place the extra-dimensions editor is built, and the one place it is
     taken away again. */
  dcRenderCustomDimsHost();
  renderQuote();
}
/* "Editing item #3" interpolates a number, so the attribute scan cannot rebuild
   it — re-run the writer on a language switch instead. Passing the CURRENT index
   keeps it a pure re-label: no edit is started, cancelled or changed. */
dcOnRelabel(()=>{ if(typeof editingItemIndex!=='undefined' && editingItemIndex!==null) setItemEditMode(editingItemIndex); });
/* The customer summary and the status badge are written by JS wrapped around
   LIVE data, so they are re-rendered rather than re-labelled — a data-i18n on
   them would overwrite a real quotation number with placeholder text. Both read
   their values back from the form, so this re-labels and stores nothing. */
dcOnRelabel(()=>{ try{ syncQI(); }catch(e){} try{ updateQuoteLockUI(); }catch(e){} });
/* Quick Add builds its panels and rows from templates, so re-render them when
   the language changes. Only runs while the modal is actually open, and every
   renderer reads from wqa state — no row, price or accessory value is altered. */
dcOnRelabel(()=>{
  const m=el('wqaModal');
  if(!m || !m.classList.contains('open')) return;
  try{ wqaUpdateAiPane(); }catch(e){}
  try{ wqaRenderAiBadge(); }catch(e){}
  if(wqa.rows && wqa.rows.length){
    try{ wqaRenderCommon(); }catch(e){}
    try{ wqaRenderCommonFix(true); }catch(e){}
    try{ wqaRenderCommonItem(true); }catch(e){}
    try{ wqaRenderCommonPrice(true); }catch(e){}
    try{ wqaRenderCommonAcc(true); }catch(e){}
    try{ wqaRenderRows(true); }catch(e){}
    try{ wqaUpdateAddButton(); }catch(e){}
  }
});
function editItem(i){
  if(loadedSavedQuote && quoteLocked){ showToast('Click Edit Saved Quotation first'); return; }
  if(!quoteItems[i]) return;
  fillItemFormFromItem(quoteItems[i]);
  editingItemIndex=i;
  setItemEditMode(i);
  goToStep(2);
}
function cancelItemEdit(){
  setItemEditMode(null);
  showToast('Edit cancelled');
}

function addCurrentItem(){
  if(loadedSavedQuote && quoteLocked){ showToast('Click Edit Saved Quotation first'); return; }
  if(currentType==='sagrod') addSagRod();
  else if(currentType==='stud') addStud();
  else if(currentType==='anchorbolt') addAnchorBolt();
  else if(currentType==='ubolt') addUBolt();
  else if(currentType==='squbolt') addSQUBolt();
  else if(currentType==='lbolt') addLBolt('lbolt');
  else if(currentType==='lbolt45') addLBolt('lbolt45');
  else if(currentType==='jbolt') addJBolt();
  else if(currentType==='plate') addPlate();
  else if(currentType==='was') addWAS();
  else if(currentType==='others') addOthers();
}
function flashPreview(){ const box=el('calcPreview'); box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); }

/* ─── OTHERS / SPECIAL BOLT ─────────────────────────────────────── */
/* Others / Special Bolt product names are stored uppercase so the item list,
   print and WhatsApp output read consistently. Applied on input, on blur and
   once more before saving. Only this field — never customer name or remarks. */
function upperOthersProductName(){
  const e=el('others-productName'); if(!e) return;
  const up=String(e.value||'').toUpperCase();
  if(e.value===up) return;                 // keep the caret still when nothing changes
  const s=e.selectionStart, t=e.selectionEnd;
  e.value=up;
  try{ e.setSelectionRange(s,t); }catch(err){}
}
function getOthersWeightMode(){return fv('others','weightMode')||'manual'}
function getOthersUnitWeight(){
  if(getOthersWeightMode()==='length'){
    const diameter=fn('others','diameter'),length=fn('others','length');
    const weight=diameter*diameter*length*0.0000061654;
    const input=el('others-unitWeight');
    if(input) input.value=diameter>0&&length>0?weight.toFixed(4):'';
    return weight;
  }
  return fn('others','unitWeight');
}
/* userInitiated=true ONLY from the Weight Mode select's own onchange — i.e. staff
   deliberately switching mode. The three programmatic callers (draft restore,
   Load & Edit, first-load init) pass nothing, so a saved Unit Weight is never
   wiped while a quotation or draft is being restored. */
function onOthersWeightModeChange(userInitiated){
  const auto=getOthersWeightMode()==='length';
  const diameterField=el('others-diameterField'),lengthField=el('others-lengthField');
  const weightField=el('others-unitWeightField'),weightInput=el('others-unitWeight');
  if(diameterField) diameterField.style.display=auto?'flex':'none';
  if(lengthField) lengthField.style.display=auto?'flex':'none';
  /* Unit Weight belongs to Manual Weight only. In Diameter x Length the weight is
     derived from the two dimensions and shown in the calculation preview, so the
     box is hidden rather than shown read-only. The input itself stays in the DOM:
     getOthersUnitWeight() still writes the derived value into it, and it is only
     ever READ in manual mode — so a hidden value can never reach the price. */
  if(weightField) weightField.style.display=auto?'none':'flex';
  if(weightInput) weightInput.readOnly=auto;
  /* Safety: when staff switch TO Manual Weight, start from a blank box. Whatever
     is in there is the weight derived from the previous Diameter x Length entry,
     and must not be mistaken for a hand-entered figure. */
  if(userInitiated && !auto && weightInput) weightInput.value='';
  calcOthers();
}
function calcOthers(){
  const weight=getOthersUnitWeight();
  const costRate=evalExpr(fv('others','costRate'));
  const addCost=evalExpr(fv('others','addCost'));
  const markup=fn('others','markup');
  const base=weight*costRate;
  const raw=(base+addCost)*(1+markup/100);
  const final=resolvePriceMode('others',raw,raw,accAddon(getAccessories('others')));
  updatePreview(weight,base,final);
}
function addOthers(){
  upperOthersProductName();          // stored text is always uppercase
  const productName=fv('others','productName').trim();
  const material=fv('others','material').trim();
  const sizeType=fv('others','sizeType').trim();
  const dimensionText=fv('others','dimensionText').trim();
  const weightMode=getOthersWeightMode();
  const diameter=fn('others','diameter'),length=fn('others','length');
  const weight=getOthersUnitWeight();
  const costRateValue=fv('others','costRate').trim();
  if(!productName){showToast('Enter Product Name');return}
  /* Others / Special Bolt may be quoted without a material or size type — both
     are optional here and simply drop out of the description. Every other
     product type keeps its own requirements. */
  if(!dimensionText){showToast('Enter Dimension Text');return}
  if(weightMode==='length'&&diameter<=0){showToast('Enter Diameter');return}
  if(weightMode==='length'&&length<=0){showToast('Enter Length');return}
  if(weightMode==='manual'&&weight<=0){showToast('Enter Unit Weight');return}
  if(!costRateValue||evalExpr(costRateValue)<=0){showToast('Enter Cost Rate');return}
  const qty=validateQtyEntry('others');
  if(qty===null) return;
  if(!validatePriceMode('others')) return;
  const costRate=evalExpr(costRateValue);
  const addCost=validateRateEntry('others','addCost','Additional Cost');
  if(addCost===null) return;
  const markup=fn('others','markup');
  const base=weight*costRate;
  const raw=(base+addCost)*(1+markup/100);
  const accessories=getAccessories('others');
  const final=resolvePriceMode('others',raw,raw,accAddon(accessories));
  if(!pushItem('others',dimensionText,material,qty,final,final*qty,markup,'',sizeType,accessories,weight)) return;
  flashPreview();
}

/* ─── PLATE (MS Plate / Triangle Plate) ─────────────────────────────── */
function getPlateType(){
  const r=document.querySelector('input[name="plate-plateType"]:checked');
  return r ? r.value : 'ms_plate';
}
function getPlateHoleOption(){
  const r=document.querySelector('input[name="plate-hole"]:checked');
  return r ? r.value : 'none';
}
function onPlateTypeChange(){
  const t=getPlateType();
  const msFields=['plate-dim-group-ms','plate-f-l','plate-f-w','plate-f-t','plate-f-hole'];
  const triFields=['plate-dim-group-tri','plate-f-tri-l','plate-f-tri-h','plate-f-tri-cl','plate-f-tri-ch','plate-f-tri-t'];
  const showMs=t==='ms_plate';
  msFields.forEach(id=>{const e=el(id);if(e)e.style.display=showMs?'':'none';});
  triFields.forEach(id=>{const e=el(id);if(e)e.style.display=showMs?'none':'';});
  // Also handle hole-dependent fields based on current hole option
  if(!showMs){el('plate-f-hd').style.display='none';el('plate-f-nh').style.display='none';}
  else onHoleOptionChange();
  calcPlate();
}
function onHoleOptionChange(){
  const opt=getPlateHoleOption();
  const showHole=opt!=='none';
  const hdEl=el('plate-f-hd'), nhEl=el('plate-f-nh');
  if(hdEl) hdEl.style.display=showHole?'':'none';
  if(nhEl) nhEl.style.display=showHole?'':'none';
  if(opt==='center'&&el('plate-nh')) el('plate-nh').value='1';
  if(opt==='corners'&&el('plate-nh')) el('plate-nh').value='4';
  calcPlate();
}
function calcPlateWeight(){
  if(getPlateType()==='ms_plate'){
    return fn('plate','l')*fn('plate','w')*fn('plate','t')*0.00000785;
  }
  return fn('plate','tri-l')*fn('plate','tri-h')*fn('plate','tri-t')*0.00000785;
}
function calcPlate(){
  const costRate=evalExpr(fv('plate','costRate'));
  const addCost=evalExpr(fv('plate','addCost'));
  const markup=fn('plate','markup');
  const weight=calcPlateWeight();
  const base=weight*costRate+addCost;
  const raw=base*(1+markup/100);
  const final=resolvePriceMode('plate',raw,round05(raw),0);
  updatePreview(weight,base,final);
}
function buildPlateSizeStr(){
  const t=getPlateType();
  const finish=getFinish('plate');
  const finTag=finish?` (${finish})`:'';
  if(t==='ms_plate'){
    const l=fv('plate','l'), w=fv('plate','w'), thick=fv('plate','t');
    const opt=getPlateHoleOption();
    let holeStr='';
    if(opt==='center'){
      const hd=fv('plate','hd');
      holeStr=` x Ø${hd}mm center hole`;
    } else if(opt==='corners'){
      const hd=fv('plate','hd');
      holeStr=` x 4-Ø${hd}mm holes`;
    } else if(opt==='custom'){
      const hd=fv('plate','hd'), nh=fv('plate','nh');
      holeStr=` x ${nh}-Ø${hd}mm holes`;
    }
    return `L ${l} x W ${w} x T ${thick}mm${holeStr}`;
  } else {
    const l=fv('plate','tri-l'), h=fv('plate','tri-h');
    const cl=fv('plate','tri-cl'), ch=fv('plate','tri-ch'), thick=fv('plate','tri-t');
    const cut=(parseFloat(cl)||parseFloat(ch)) ? `${parseFloat(cl)?' x CL '+cl:''}${parseFloat(ch)?' x CH '+ch:''}` : '';
    return `L ${l} x H ${h}${cut} x T ${thick}mm`;
  }
}
function addPlate(){
  const t=getPlateType();
  const costRate=validateRateEntry('plate','costRate','Cost Rate');
  const addCost=validateRateEntry('plate','addCost','Additional Cost');
  if(costRate===null||addCost===null) return;
  const markup=fn('plate','markup');
  const qty=validateQtyEntry('plate');
  if(qty===null) return;
  // Validation
  if(t==='ms_plate'){
    if(!fn('plate','l')||!fn('plate','w')||!fn('plate','t')){showToast('⚠️ Enter Length, Width and Thickness');return;}
    if(!validateDims({'Length':fn('plate','l'),'Width':fn('plate','w'),'Thickness':fn('plate','t')})) return;
    if(getPlateHoleOption()!=='none'&&(!fn('plate','hd')||!fn('plate','nh'))){showToast('⚠️ Enter Hole Dia. and Holes');return;}
    if(getPlateHoleOption()!=='none'&&!validateDims({'Hole Dia.':fn('plate','hd'),'Holes':fn('plate','nh')})) return;
  } else {
    if(!fn('plate','tri-l')||!fn('plate','tri-h')||!fn('plate','tri-t')){showToast('⚠️ Enter Triangle Plate Length, Height and Thickness');return;}
    if(!validateDims({'Length':fn('plate','tri-l'),'Height':fn('plate','tri-h'),'Thickness':fn('plate','tri-t')})) return;
  }
  if(!costRate){showToast('⚠️ Enter Cost Rate before adding');return;}
  if(!validatePriceMode('plate')) return;
  const weight=calcPlateWeight();
  const base=weight*costRate+addCost;
  const raw=base*(1+markup/100);
  const finalUnitPrice=resolvePriceMode('plate',raw,round05(raw),0);
  const totalAmount=finalUnitPrice*qty;
  if(!validateFinalItem(qty,finalUnitPrice,totalAmount)) return; // Phase 1 fix
  // Build size string (English only)
  const sizeStr=buildPlateSizeStr();
  // Desc includes plate subtype for WA grouping
  const desc=t==='ms_plate'?'MS PLATE':'TRIANGLE PLATE';
  const acc=getAccessories('plate');
  const formData=captureItemFormData('plate');
  formData.plateType=t;
  formData.holeOption=getPlateHoleOption();
  const item={
    itemType:'plate',plateType:t,
    desc,finish:getFinish('plate'),
    size:sizeStr,qty,finalUnitPrice,totalAmount,markup,
    material:fv('plate','material'),
    sizeCode:'',sizeType:'',
    productType:t==='ms_plate'?'MS PLATE':'TRIANGLE PLATE',
    cleanSize:'',dimensionPreview:sizeStr,
    accessories:acc,weight,customDimensions:dcReadCustomDims(),formData,...getPriceModeSaveData('plate')
  };
  if(editingItemIndex!==null && quoteItems[editingItemIndex]){
    const idx=editingItemIndex;
    quoteItems[idx]=item;
    editingItemIndex=null;
    markQuotationDirty(); setItemEditMode(null); dcClearCustomDims(); renderQuote(idx);
    showToast(dcT('tItemUpdated')); return;
  }
  quoteItems.push(item);
  markQuotationDirty(); dcClearCustomDims(); renderQuote(quoteItems.length-1);
  flashPreview();
  showToast('Added #'+quoteItems.length+' — '+sizeStr+'  '+fmt(finalUnitPrice));
}
/* Plate restore for edit */
function fillPlateFormFromItem(item){
  const saved=item.formData||{};
  const t=item.plateType||saved.plateType||'ms_plate';
  // Set plate type radio
  const radios=document.querySelectorAll('input[name="plate-plateType"]');
  radios.forEach(r=>{r.checked=r.value===t;});
  onPlateTypeChange();
  // Material + finish
  setFieldValue('plate','material',saved.material||item.material||'MS');
  setFinishValue('plate',saved.finish||item.finish||'PL');
  if(t==='ms_plate'){
    setFieldValue('plate','l',saved.l||saved['plate-l']||'');
    setFieldValue('plate','w',saved.w||saved['plate-w']||'');
    setFieldValue('plate','t',saved.t||saved['plate-t']||'');
    // Hole option
    const holeOpt=saved.holeOption||'none';
    const holeRadios=document.querySelectorAll('input[name="plate-hole"]');
    holeRadios.forEach(r=>{r.checked=r.value===holeOpt;});
    onHoleOptionChange(); // uses flat field IDs
    if(holeOpt!=='none'){
      setFieldValue('plate','hd',saved.hd||saved['plate-hd']||'');
      setFieldValue('plate','nh',saved.nh||saved['plate-nh']||'');
    }
  } else {
    setFieldValue('plate','tri-l',saved['tri-l']||'');
    setFieldValue('plate','tri-h',saved['tri-h']||'');
    setFieldValue('plate','tri-cl',saved['tri-cl']||'');
    setFieldValue('plate','tri-ch',saved['tri-ch']||'');
    setFieldValue('plate','tri-t',saved['tri-t']||'');
  }
  setFieldValue('plate','costRate',saved.costRate||'');
  setFieldValue('plate','addCost',saved.addCost||'');
  setFieldValue('plate','markup',saved.markup??0);
  setFieldValue('plate','qty',saved.qty||item.qty||1);
  setFieldValue('plate','priceMode',saved.priceMode??item.priceMode??'auto');
  setFieldValue('plate','manualUnitPrice',saved.manualUnitPrice??item.manualUnitPrice??'');
  loadAccIntoForm('plate',saved.accessories||item.accessories);
  onPriceModeChange('plate');
  calcPlate();
}

/* ─── WELDING ANCHOR SET ─────────────────────────────────────── */
function wasAbFn(f){return parseFloat(el('was-ab-'+f)?.value||0)||0}
function wasAbFv(f){return el('was-ab-'+f)?.value||''}
function wasBpFn(f){return parseFloat(el('was-bp-'+f)?.value||0)||0}
function wasBpFv(f){return el('was-bp-'+f)?.value||''}
function wasTpFn(f){return parseFloat(el('was-tp-'+f)?.value||0)||0}
function wasTpFv(f){return el('was-tp-'+f)?.value||''}
function wasGetHoleOpt(){const r=document.querySelector('input[name="was-bp-hole"]:checked');return r?r.value:'none'}
function onWASHoleChange(){
  const opt=wasGetHoleOpt();
  const show=opt!=='none';
  const hdW=el('was-bp-hd-wrap'),nhW=el('was-bp-nh-wrap');
  if(hdW)hdW.style.display=show?'':'none';
  if(nhW)nhW.style.display=show?'':'none';
  if(opt==='center'){const e=el('was-bp-nh');if(e)e.value='1';}
  if(opt==='corners'){const e=el('was-bp-nh');if(e)e.value='4';}
  calcWAS();
}
function calcWASWeights(){
  // Anchor Bolt weight: D² × L × 0.0000061654
  const abD=wasAbFn('diameter'),abL=wasAbFn('length'),abQty=Math.max(1,wasAbFn('qty')||1);
  const abW=abD*abD*abL*0.0000061654;
  // Base Plate weight
  const bpL=wasBpFn('l'),bpW=wasBpFn('w'),bpT=wasBpFn('t'),bpQty=Math.max(1,wasBpFn('qty')||1);
  const bpWt=bpL*bpW*bpT*0.00000785;
  // Triangle Plate weight
  const tpL=wasTpFn('l'),tpH=wasTpFn('h'),tpT=wasTpFn('t');
  const tpFieldsBlank=['l','h','cl','ch','t'].every(f=>!wasTpFv(f).trim());
  const tpQty=tpFieldsBlank?0:Math.max(0,wasTpFn('qty'));
  const tpWt=tpL*tpH*tpT*0.00000785;
  const anchorWeight=abW*abQty;
  const basePlateWeight=bpWt*bpQty;
  const trianglePlateWeight=tpQty>0?tpWt*tpQty:0;
  const setWeight=anchorWeight+basePlateWeight+trianglePlateWeight;
  return {setWeight,anchorWeight,basePlateWeight,trianglePlateWeight,abW,bpWt,tpWt,tpQty};
}
function getWASCalc(){
  const weights=calcWASWeights();
  const anchorRate=evalExpr(fv('was','anchorCostRate'));
  const basePlateRate=evalExpr(fv('was','basePlateCostRate'));
  const trianglePlateRate=evalExpr(fv('was','trianglePlateCostRate'));
  const anchorCost=weights.anchorWeight*anchorRate;
  const basePlateCost=weights.basePlateWeight*basePlateRate;
  const trianglePlateCost=weights.tpQty>0?weights.trianglePlateWeight*trianglePlateRate:0;
  const basePrice=anchorCost+basePlateCost+trianglePlateCost;
  const addCost=evalExpr(fv('was','addCost'));
  const accessories=accAddon(getAccessories('was'));
  const markup=fn('was','markup');
  const rawUnitPrice=(basePrice+addCost+accessories)*(1+markup/100);
  const roundedUnitPrice=round05(rawUnitPrice);
  const finalUnitPrice=resolvePriceMode('was',rawUnitPrice,roundedUnitPrice,0);
  return {weights,anchorRate,basePlateRate,trianglePlateRate,anchorCost,basePlateCost,trianglePlateCost,basePrice,addCost,accessories,markup,rawUnitPrice,roundedUnitPrice,finalUnitPrice};
}
function calcWAS(){
  updateWASPreview(getWASCalc());
}
function wasTriangleCutSegment(){
  const cl=wasTpFv('cl').trim(),ch=wasTpFv('ch').trim();
  return (parseFloat(cl)||parseFloat(ch)) ? `${parseFloat(cl)?' x CL '+cl:''}${parseFloat(ch)?' x CH '+ch:''}` : '';
}
function buildWASSizeStr(){
  // Anchor bolt line
  const abSize=wasAbFv('size')||'M20';
  const abL=wasAbFv('length');
  const abTL=wasAbFv('threadLen').trim();
  const abLine=`${abSize} x L ${abL}${abTL?' x TL '+abTL:''}`;
  // Base plate line
  const bpL=wasBpFv('l'),bpW=wasBpFv('w'),bpT=wasBpFv('t');
  const holeOpt=wasGetHoleOpt();
  let bpHole='';
  if(holeOpt==='center'){bpHole=` x Ø${wasBpFv('hd')}mm center hole`;}
  else if(holeOpt==='corners'){bpHole=` x 4-Ø${wasBpFv('hd')}mm holes`;}
  else if(holeOpt==='custom'){bpHole=` x ${wasBpFv('nh')}-Ø${wasBpFv('hd')}mm holes`;}
  const bpQty=el('was-bp-qty')?.value||'1';
  const bpLine=`L ${bpL} x W ${bpW} x T ${bpT}mm${bpHole} x ${bpQty}pc`;
  // Triangle plate line
  const tpL=wasTpFv('l'),tpH=wasTpFv('h'),tpT=wasTpFv('t');
  const tpQty=calcWASWeights().tpQty;
  const tpLine=`L ${tpL} x H ${tpH}${wasTriangleCutSegment()} x T ${tpT}mm x ${tpQty}pc`;
  // Compose: first line = anchor bolt main dim; full size = all lines joined
  return `${abLine} | Base Plate: ${bpLine}${tpQty>0?' | Triangle Plate: '+tpLine:''}`;
}
function buildWASSizeMultiline(){
  const abSize=wasAbFv('size')||'M20';
  const abL=wasAbFv('length');
  const abTL=wasAbFv('threadLen').trim();
  const abQty=el('was-ab-qty')?.value||'1';
  const bpL=wasBpFv('l'),bpW=wasBpFv('w'),bpT=wasBpFv('t');
  const holeOpt=wasGetHoleOpt();
  let bpHole='';
  if(holeOpt==='center'){bpHole=` x Ø${wasBpFv('hd')}mm center hole`;}
  else if(holeOpt==='corners'){bpHole=` x 4-Ø${wasBpFv('hd')}mm holes`;}
  else if(holeOpt==='custom'){bpHole=` x ${wasBpFv('nh')}-Ø${wasBpFv('hd')}mm holes`;}
  const bpQty=el('was-bp-qty')?.value||'1';
  const tpL=wasTpFv('l'),tpH=wasTpFv('h'),tpT=wasTpFv('t');
  const tpQty=calcWASWeights().tpQty;
  const pcs=n=>parseInt(n,10)===1?'1pc':`${n}pcs`;
  const abLine=`${abSize} x L ${abL}${abTL?' x TL '+abTL+'mm':''}`;
  const lines=[
    `   Anchor Bolt: ${pcs(abQty)}`,
    `   Base Plate: L ${bpL} x W ${bpW} x T ${bpT}mm${bpHole} x ${pcs(bpQty)}`
  ];
  if(tpQty>0) lines.push(`   Triangle Plate: L ${tpL} x H ${tpH}${wasTriangleCutSegment()} x T ${tpT}mm x ${pcs(tpQty)}`);
  return {abLine,compLines:lines.join('\n')};
}
function addWAS(){
  // Validation
  if(!wasAbFv('material')||!wasAbFv('sizeType')||!wasAbFv('size')||!wasAbFn('diameter')||!wasAbFn('length')||!wasAbFn('qty')){showToast('⚠️ Enter Anchor Bolt dimensions');return;}
  if(!wasBpFn('l')||!wasBpFn('w')||!wasBpFn('t')||!wasBpFn('qty')){showToast('⚠️ Enter Base Plate dimensions');return;}
  if(wasGetHoleOpt()!=='none'&&(!wasBpFn('hd')||!wasBpFn('nh'))){showToast('⚠️ Enter Hole Dia. and Holes');return;}
  const calc=getWASCalc();
  if(calc.weights.tpQty>0&&(!wasTpFn('l')||!wasTpFn('h')||!wasTpFn('t'))){showToast('⚠️ Enter Triangle Plate Length, Height and Thickness');return;}
  if(!calc.anchorRate){showToast('⚠️ Enter Anchor Cost Rate');return;}
  if(!calc.basePlateRate){showToast('⚠️ Enter Base Plate Cost Rate');return;}
  if(calc.weights.tpQty>0&&!calc.trianglePlateRate){showToast('⚠️ Enter Triangle Plate Cost Rate');return;}
  if(!validatePriceMode('was')) return;
  const qty=validateQtyEntry('was');
  if(qty===null) return;
  const acc=getAccessories('was');
  const finalUnitPrice=calc.finalUnitPrice;
  const totalAmount=finalUnitPrice*qty;
  if(!validateFinalItem(qty,finalUnitPrice,totalAmount)) return; // Phase 1 fix
  // Build size string for quote list
  const {abLine,compLines}=buildWASSizeMultiline();
  const sizeStr=abLine+'\n'+compLines;
  const finish=getFinish('was');
  /* The set is named after the Anchor Bolt material the user picked (MS,
     4140 QT, 4140, Y BAR …). It is stored on item.material so the quote list,
     Save, Print, WhatsApp, Copy and Quotation Detail all read the same title.
     Calculation is unaffected — rates stay fully manual. */
  const anchorMaterial=wasAbFv('material')||'MS';
  const desc=materialLabel(anchorMaterial)+' WELDING ANCHOR SET';
  // Capture form data
  const formData={
    anchorMaterial:wasAbFv('material'),anchorSizeType:wasAbFv('sizeType'),anchorSize:wasAbFv('size'),anchorFinish:finish,
    anchorDiameter:wasAbFv('diameter'),anchorLength:wasAbFv('length'),anchorThreadLength:wasAbFv('threadLen'),anchorQtyPerSet:el('was-ab-qty')?.value||'1',
    basePlateLength:wasBpFv('l'),basePlateWidth:wasBpFv('w'),basePlateThickness:wasBpFv('t'),
    basePlateHoleOption:wasGetHoleOpt(),basePlateHoleDia:wasBpFv('hd'),basePlateHoles:wasBpFv('nh'),basePlateQtyPerSet:el('was-bp-qty')?.value||'1',
    trianglePlateLength:wasTpFv('l'),trianglePlateHeight:wasTpFv('h'),trianglePlateCutLength:wasTpFv('cl'),trianglePlateCutHeight:wasTpFv('ch'),trianglePlateThickness:wasTpFv('t'),trianglePlateQtyPerSet:String(calc.weights.tpQty),
    anchorCostRate:fv('was','anchorCostRate'),basePlateCostRate:fv('was','basePlateCostRate'),trianglePlateCostRate:fv('was','trianglePlateCostRate'),
    addCost:fv('was','addCost'),markup:fv('was','markup'),setQty:fv('was','qty'),
    ...getPriceModeSaveData('was'),
    finish,accessories:acc
  };
  const item={
    itemType:'was',desc,finish,size:sizeStr,qty,
    finalUnitPrice,totalAmount,markup:calc.markup,
    material:anchorMaterial,sizeCode:'',sizeType:'',
    productType:desc,
    cleanSize:'',dimensionPreview:abLine,
    accessories:acc,weight:calc.weights.setWeight,customDimensions:dcReadCustomDims(),formData,...getPriceModeSaveData('was'),
    wasData:{abLine,compLines}
  };
  if(editingItemIndex!==null&&quoteItems[editingItemIndex]){
    const idx=editingItemIndex;
    quoteItems[idx]=item;
    editingItemIndex=null;
    markQuotationDirty();setItemEditMode(null);
    resetAccPanel('was');                     // same rule as pushItem: no carry-over
    dcClearCustomDims();
    renderQuote(idx);
    showToast(dcT('tItemUpdated'));return;
  }
  quoteItems.push(item);
  markQuotationDirty();
  resetAccPanel('was');                       // same rule as pushItem: no carry-over
  dcClearCustomDims();
  renderQuote(quoteItems.length-1);flashPreview();
  showToast('Added #'+quoteItems.length+' — '+materialLabel(anchorMaterial)+' Welding Anchor Set  '+fmt(finalUnitPrice)+'/set');
}
function fillWASFormFromItem(item){
  const fd=item.formData||{};
  const oldRate=fd.costRate??'';
  // Anchor bolt
  const abMatEl=el('was-ab-material');if(abMatEl)abMatEl.value=fd.anchorMaterial??fd.abMaterial??'MS';
  const abStEl=el('was-ab-sizeType');if(abStEl)abStEl.value=fd.anchorSizeType??fd.abSizeType??'FULLSIZE';
  const abSzEl=el('was-ab-size');if(abSzEl)abSzEl.value=fd.anchorSize??fd.abSize??'M20';
  const abDEl=el('was-ab-diameter');if(abDEl)abDEl.value=fd.anchorDiameter??fd.abDiameter??'';
  const abLEl=el('was-ab-length');if(abLEl)abLEl.value=fd.anchorLength??fd.abLength??'';
  const abTlEl=el('was-ab-threadLen');if(abTlEl)abTlEl.value=fd.anchorThreadLength??fd.abThreadLen??'';
  const abQtEl=el('was-ab-qty');if(abQtEl)abQtEl.value=fd.anchorQtyPerSet??fd.abQty??'1';
  // Base plate
  const bpLEl=el('was-bp-l');if(bpLEl)bpLEl.value=fd.basePlateLength??fd.bpL??'';
  const bpWEl=el('was-bp-w');if(bpWEl)bpWEl.value=fd.basePlateWidth??fd.bpW??'';
  const bpTEl=el('was-bp-t');if(bpTEl)bpTEl.value=fd.basePlateThickness??fd.bpT??'';
  const bpQtEl=el('was-bp-qty');if(bpQtEl)bpQtEl.value=fd.basePlateQtyPerSet??fd.bpQty??'1';
  const holeOpt=fd.basePlateHoleOption??fd.bpHoleOpt??'none';
  document.querySelectorAll('input[name="was-bp-hole"]').forEach(r=>r.checked=r.value===holeOpt);
  onWASHoleChange();
  if(holeOpt!=='none'){
    const hdEl=el('was-bp-hd');if(hdEl)hdEl.value=fd.basePlateHoleDia??fd.bpHd??'';
    const nhEl=el('was-bp-nh');if(nhEl)nhEl.value=fd.basePlateHoles??fd.bpNh??'';
  }
  // Triangle plate
  const tpLEl=el('was-tp-l');if(tpLEl)tpLEl.value=fd.trianglePlateLength??fd.tpL??'';
  const tpHEl=el('was-tp-h');if(tpHEl)tpHEl.value=fd.trianglePlateHeight??fd.tpH??'';
  const tpCLEl=el('was-tp-cl');if(tpCLEl)tpCLEl.value=fd.trianglePlateCutLength??fd.tpCL??'';
  const tpCHEl=el('was-tp-ch');if(tpCHEl)tpCHEl.value=fd.trianglePlateCutHeight??fd.tpCH??'';
  const tpTEl=el('was-tp-t');if(tpTEl)tpTEl.value=fd.trianglePlateThickness??fd.tpT??'';
  const tpQtEl=el('was-tp-qty');if(tpQtEl)tpQtEl.value=fd.trianglePlateQtyPerSet??fd.tpQty??'4';
  // Pricing
  setFieldValue('was','anchorCostRate',fd.anchorCostRate??oldRate);
  setFieldValue('was','basePlateCostRate',fd.basePlateCostRate??oldRate);
  setFieldValue('was','trianglePlateCostRate',fd.trianglePlateCostRate??oldRate);
  setFieldValue('was','addCost',fd.addCost??'');
  setFieldValue('was','markup',fd.markup??0);
  setFieldValue('was','qty',fd.setQty??fd.qty??item.qty??1);
  setFieldValue('was','priceMode',fd.priceMode??item.priceMode??'auto');
  setFieldValue('was','manualUnitPrice',fd.manualUnitPrice??item.manualUnitPrice??'');
  // Finish
  setFinishValue('was',fd.anchorFinish??fd.finish??item.finish??'PL');
  // Accessories
  loadAccIntoForm('was',fd.accessories||item.accessories);
  onPriceModeChange('was');
  calcWAS();
}

/* v2.23.1 — Stage 7B-19 Pricing Guide Rewrite */
/* v2.23.0 — Stage 7B-18A Excel Import / Export */
/* v2.22.3 — Stage 7B-15 Tablet Input UX Polish */
/* v2.22.2 — Stage 7B-14 Price Mode UI Final Polish */
/* v2.22.1 — Stage 7B-13 Price Mode UI Polish */
/* v2.22.0 — Stage 7B-12 Global Price Mode */
/* v2.21.2 — Stage 7B-11 U-Bolt Price Debug */
/* v2.21.1 — Stage 7B-10B Others Length Weight Option */
/* v2.21.0 — Stage 7B-10 Others / Special Bolt */
/* v2.20.8 — Stage 7B-9 Quick Menu + Version Updates */
/* v2.20.7 — Stage 7B-8B Product Entry Draft Recovery */
/* v2.20.6 — Stage 7B-8 Unsaved Draft Autosave */
/* v2.20.5 — Stage 7B-7 Print layout repair + optional Issued By header */
/* v2.20.4 — Stage 7B-6 Remove Valid Until UI */
/* v2.20.3 — Stage 7B-3 global accessories layout polish + WAS Additional Cost note cleanup */
/* v2.20.2 — Stage 7B-2 WAS breakdown + Plate/WAS full-plate formula correction */
/* v2.20.1 — Stage 7B-1 Welding Anchor layout + split cost rates */
/* v2.20.0 — Stage 7B Welding Anchor Set */
/* v2.19.0 — Stage 7A Plate category */
/* v2.17.2 - Product settings cleanup and Recent Quotations pagination */
/* v2.17.3 - Stage 6A UI polish: spacing, card hierarchy, placeholders, mobile overflow safety (no logic/formula/API changes) */
/* v2.17.4 - Stage 6A-2 UI polish: customer bar hierarchy, type picker, group labels, calc preview, edit-mode visual, qi-item cards, locked state, mobile stack (no logic/formula/API changes) */
/* v2.17.6 - Accessories UI polish: Nut/FW/Custom mini cards, checkbox+title head, active/dimmed card states, compact collapsed fields, panel subtitle (no calculation/save/WA changes) */
/* v2.17.7 - Accessories UI cleanup: one main toggle title, concise checkbox wording and Unit Price labels (no calculation/save/WA changes) */
/* v2.17.8 - Accessories visible fields fix: disabled option fields stay visible and grey until enabled (no calculation/save/WA changes) */
/* v2.17.9 - Accessories checkbox editable fix: valid change handlers immediately enable or disable option fields (no calculation/save/WA changes) */
/* v2.17.5 - Stage 6A-3 strong UI redesign: customer summary card with avatar+chips, section band headers, selectable product cards with radio dot, accessories mini-card, 4 KPI calc cards with hero Final Unit Price, gradient primary action, two-tier quotation item cards, hero total bar (no logic/formula/API changes) */
/* ── quote list ── */
/* Phase 1 fix: pushItem now returns true when the item was actually added or
   updated, false when it was blocked — callers must not toast "added" or clear
   the form when it returns false. */
function pushItem(type,sizeStr,material,qty,finalUnitPrice,totalAmount,markup,sizeCode,sizeType,accessories,weight){
  if(loadedSavedQuote && quoteLocked){ showToast('Click Edit Saved Quotation first'); return false; }
  if(!validateFinalItem(qty,finalUnitPrice,totalAmount)) return false; // Phase 1 fix: final safety net
  const finish=getFinish(type);
  const acc=accessories||{nut:{enabled:false,qty:2,finish:'',unitPrice:0},fw:{enabled:false,qty:1,finish:'',unitPrice:0},custom:{enabled:false,text:'',unitPrice:0}};
  const productType=type==='others'?(fv(type,'productName').trim()||ITEM_TYPES[type]):(ITEM_TYPES[type]||type);
  const priceData=getPriceModeSaveData(type);
  const item={itemType:type,desc:buildDesc(type),finish,size:sizeStr,qty,finalUnitPrice,totalAmount,markup,material,sizeCode:sizeCode||'',sizeType:sizeType||fv(type,'sizeType'),productType,cleanSize:sizeCode||'',dimensionPreview:sizeStr.includes(' x ')?sizeStr.substring(sizeStr.indexOf(' x ')+3):'',accessories:acc,weight:weight||0,customDimensions:dcReadCustomDims(),formData:captureItemFormData(type),...priceData};
  if(editingItemIndex!==null && quoteItems[editingItemIndex]){
    const updatedIndex=editingItemIndex;
    quoteItems[updatedIndex]=item;
    editingItemIndex=null;
    markQuotationDirty();
    setItemEditMode(null);
    /* The updated item has its accessories captured above — the form now returns
       to "next item" state, so its accessory panel must not leak into it. */
    resetAccPanel(type);
    dcClearCustomDims();
    renderQuote(updatedIndex);
    showToast(dcT('tItemUpdated'));
    return true;
  }
  quoteItems.push(item);
  markQuotationDirty();
  /* Accessories are the one part of the entry form that silently carries a CHARGE
     into the next item while the panel sits collapsed. The item just added keeps
     its own copy (captured into item.accessories above); the form resets so the
     next item always starts with zero accessories. */
  resetAccPanel(type);
  dcClearCustomDims();
  renderQuote(quoteItems.length-1);
  showToast('Added #'+quoteItems.length+' — '+sizeStr+'  '+fmt(finalUnitPrice));
  return true;
}
/* Reset every product type's accessory panel — Clear All and New Quotation must
   leave no hidden accessory anywhere, including types not currently shown. */
function resetAllAccPanels(){
  ['sagrod','stud','anchorbolt','ubolt','squbolt','lbolt','lbolt45','jbolt','plate','was','others'].forEach(resetAccPanel);
}
function makeChip(f){return f?`<span class="finish-chip chip-${safeClassToken(f)}">${escHtml(f)}</span>`:''}
/* Stage 7B-17: display-only sort, does not touch quoteItems array (save/print/WA order untouched) */
let quoteListSortOrder='newest';
function setQuoteSortOrder(v){
  quoteListSortOrder=(v==='oldest')?'oldest':'newest';
  renderQuote();
}
function renderQuote(newIdx){
  const count=quoteItems.length;
  const grand=quoteItems.reduce((s,i)=>s+i.totalAmount,0);
  el('quoteCount').textContent=count;
  el('mbCount').textContent=count;
  el('mbTotal').textContent=fmt(grand);
  const hasItems=count>0;
  el('quoteEmpty').style.display=hasItems?'none':'block';
  el('quoteItemsWrap').style.display=hasItems?'block':'none';
  el('quoteTotalBar').style.display=hasItems?'flex':'none';
  el('quoteTotalAmt').textContent=fmt(grand);
  const sortRow=el('quoteSortRow'); if(sortRow) sortRow.style.display=hasItems?'flex':'none';
  const sortSelect=el('quoteSortSelect'); if(sortSelect) sortSelect.value=quoteListSortOrder;

  const list=el('quoteItemList'); list.innerHTML='';
  /* Item numbers are INSERTION ORDER (array position + 1) — the same number the
     print sheet, WhatsApp and Quotation Detail derive from the stored array, so
     "Item 3" on screen is always row 3 on paper. Sorting below is view-only and
     must never renumber: under Newest First the list simply reads 3, 2, 1. */
  const displayOrder=quoteItems.map((item,i)=>({item,i}));
  if(quoteListSortOrder==='newest') displayOrder.reverse();
  displayOrder.forEach(({item,i},pos)=>{
    const div=document.createElement('div');
    div.className='qi-item'+(i===newIdx?' row-new':'')+(i===editingItemIndex?' editing':'');
    const chip=makeChip(item.finish);
    const markupValue=parseFloat(item.markup)||0;
    const markupTag=markupValue>0?`<span class="qi-markup">⭐ +${markupValue}%</span>`:'';
    const itemPriceMode=item.priceMode||item.formData?.priceMode||'auto';
    const priceModeTag=itemPriceMode==='manual'
      ? '<span class="price-mode-badge">Manual Price</span>'
      : itemPriceMode==='no_round' ? '<span class="price-mode-badge">No Round</span>' : '';
    const cwLine=item.itemType==='was'?wasCWLabel(item.accessories||null):accCWLabel(item.accessories||null);
    const cdLine=dcCustomDimsLine(item);
    const displaySize=item.itemType==='was'?wasDisplayData(item).size:item.size;
    const unitSuffix=item.itemType==='was'?'/set':'';
    const uboltDebugHtml=getUBoltCardDebugHtml(item);
    div.innerHTML=`
      <div class="qi-item-top">
        <div class="qi-item-left">
          <div class="qi-num">${i+1}</div>
          <div class="qi-body">
            <div class="qi-desc">${escHtml(displayItemDesc(item))}${chip?' '+chip:''}</div>
            <div class="qi-dim">${escHtml(displaySize)}${cdLine?`<span class="qi-cdim">${escHtml(cdLine)}</span>`:''}${cwLine?`<span style="display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px;white-space:pre-line">${escHtml(cwLine)}</span>`:''}${uboltDebugHtml}</div>
          </div>
        </div>
        ${loadedSavedQuote&&quoteLocked?'':`<div class="qi-card-actions"><button class="qi-edit-btn" onclick="editItem(${i})" title="Edit item">Edit / 编辑</button><button class="qi-del" onclick="removeItem(${i})" title="Delete item">Delete / 删除</button></div>`}
      </div>
      <div class="qi-item-bottom">
        <div class="qi-meta">
          ${parseFloat(item.weight)>0?`<span class="qi-meta-pill qi-weight-pill">Weight <strong>${parseFloat(item.weight).toFixed(3)}kg</strong></span>`:''}
          <span class="qi-meta-pill">Qty <strong>${parseInt(item.qty,10)||0}</strong></span>
          <span class="qi-meta-pill">Unit <strong>${fmt(item.finalUnitPrice)}${unitSuffix}</strong> ${markupTag} ${priceModeTag}</span>
        </div>
        <div class="qi-price-group">
          <span class="qi-unit">Total</span>
          <span class="qi-total">${fmt(item.totalAmount)}</span>
        </div>
      </div>`;
    list.appendChild(div);
  });
  refreshWorkflow();
  updateQuoteLockUI();
  scheduleDraftAutosave();
}
function removeItem(i){
  if(loadedSavedQuote && quoteLocked){ showToast('Click Edit Saved Quotation first'); return; }
  quoteItems.splice(i,1);
  if(editingItemIndex!==null){
    if(editingItemIndex===i) setItemEditMode(null);
    else if(editingItemIndex>i) setItemEditMode(editingItemIndex-1);
  }
  markQuotationDirty();
  renderQuote();
  showToast('Item removed');
}
function clearAllItems(){
  if(!quoteItems.length) return;
  if(loadedSavedQuote && quoteLocked){ showToast('Click Edit Saved Quotation first'); return; }
  if(!confirm('Clear all items in this quotation?')) return;
  quoteItems=[];
  setItemEditMode(null);
  if(!editingQuoteId) quoteItemsSnapshotAtSave=null;
  markQuotationDirty();
  resetAllAccPanels();          // Clear All: no hidden accessory may survive
  dcClearCustomDims();          // …and no annotation from a cleared item either
  renderQuote();
  showToast('Quotation list cleared');
}
function startNewQuotation(){
  const dirtyAlreadyPrompted=savedQuoteDirty;
  if(!confirmDiscardUnsavedChanges()) return;
  if(!dirtyAlreadyPrompted&&!loadedSavedQuote&&hasMeaningfulDraft(buildUnsavedDraft())&&!confirm('Start a new quotation? Current unsaved draft will be cleared.')) return;
  clearUnsavedDraft();
  productEntryTouchedFields.clear();
  resetAllAccPanels();          // New Quotation starts with zero accessories everywhere
  dcClearCustomDims();
  loadedSavedQuote=false; quoteLocked=false; savedQuoteDirty=false; quoteStatusMode='draft'; savedQuoteSnapshot='';
  editingItemIndex=null; setItemEditMode(null);
  quoteItems=[]; editingQuoteId=null; loadedValidUntil=''; quoteItemsSnapshotAtSave=null; savedThisSession=false; sentThisSession=false; selectedCompanyId=null; renderQuote();
  ['qi-customer','qi-phone','qi-issued-by','qi-prepby','qi-remarks'].forEach(id=>{const e=el(id); if(e)e.value='';});
  el('qi-date').value=todayStr();
  el('qi-refno').value=nextRefNo();
  syncQI();
  updateQuoteLockUI();
  /* Others / Special Bolt starts from the same default a fresh page gives:
     Diameter x Length, with no manual weight carried over from the previous
     quotation. Called WITHOUT userInitiated on purpose — Load & Edit and draft
     restore still own their saved mode, and the clear-on-user-switch safety in
     onOthersWeightModeChange() is untouched. */
  const othersModeEl=el('others-weightMode');
  if(othersModeEl){
    othersModeEl.value='length';
    const othersWeightEl=el('others-unitWeight');
    if(othersWeightEl) othersWeightEl.value='';
    onOthersWeightModeChange();
    /* onOthersWeightModeChange() runs calcOthers(), which writes the SHARED calc
       preview — put the active product type's figures back. */
    recalcCurrent();
  }
  showToast('New quotation started');
  goToStep(1);
  if(window.innerWidth<=900) toggleSidebar(false);
}

/* ── Quotation Info ── */
function toggleQIEdit(){
  const ed=el('qiEdit'); const open=ed.classList.toggle('open');
  el('qiToggleBtn').textContent = open ? dcT('done') : dcT('editDetails');
}
function syncQI(){
  const customer=fv0('qi-customer'), phone=fv0('qi-phone'), refno=fv0('qi-refno'), date=fv0('qi-date');
  /* Only the wrapper text is localised. customer, refno and date are stored
     quotation data and are written through exactly as entered. */
  el('qiName').textContent = customer || dcT('noCustomerYet');
  el('qiRefDisp').textContent = dcT('lblQuotationNo')+' '+(refno||'—');
  el('qiDateDisp').textContent = dcT('lblDate')+' '+(date||'—');
  refreshWorkflow();
  markQuotationDirty();
  scheduleDraftAutosave();
}
function fv0(id){const e=el(id);return e?e.value:''}
function getQI(){
  return {customer:fv0('qi-customer'),phone:fv0('qi-phone'),refno:fv0('qi-refno'),date:fv0('qi-date'),
    prepby:fv0('qi-prepby'),remarks:fv0('qi-remarks')};
}
/* Phase 1 fix: toISOString() returns the UTC date, which is 8 hours behind
   Malaysia — between 00:00 and 07:59 MYT it produced *yesterday's* date.
   Use the browser's local date instead. */
function todayStr(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

/* ── API / saved production data ── */
async function api(action,data={},method='GET'){
  const opts=method==='GET'
    ? {method:'GET'}
    : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
  const sep=action.includes('&')?'&':'';
  const url='api.php?action='+action+sep;
  const res=await fetch(url,opts);
  /* Session expired (or signed out in another tab): send the user to the
     login page and come back here afterwards, instead of showing a
     confusing "save failed" message. */
  if(res.status===401){
    location.href='login.php?next='+encodeURIComponent(location.pathname+location.search);
    return {ok:false,error:'Signed out'};
  }
  const json=await res.json().catch(()=>({ok:false,error:'Invalid JSON response'}));
  return json;
}
/* ── Quick Open ───────────────────────────────────────────────────────────
   Paste a quotation number, press Enter (or tap Open) and jump straight to
   that saved quotation. Matching happens server-side (find_quotation) so it
   reaches every quotation, not just the ones cached on this page.
   Opening reuses the EXISTING Quotation Detail modal on companies.php — no
   second viewer is created here. */
let qoBusy=false;
function qoEsc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function qoShow(html){const b=el('qoResult'); b.innerHTML=html; b.hidden=false;}
function qoClear(){const b=el('qoResult'); b.innerHTML=''; b.hidden=true;}
/* Hand off by id, not by ref: once a retired number lives in another row's
   previous_ref_no, looking the ref up again on companies.php would return two
   quotations and refuse to open either. The id is unambiguous. */
function qoGoId(id){ location.href='companies.php?openId='+encodeURIComponent(id); }
function qoGo(ref){ location.href='companies.php?open='+encodeURIComponent(ref); }

async function quickOpen(){
  if(qoBusy) return;
  const input=el('qoInput');
  const raw=(input.value||'').trim();
  if(!raw){ qoClear(); input.focus(); return; }
  qoBusy=true;
  const btn=el('qoBtn'); const label=btn.textContent;
  btn.textContent='…'; btn.disabled=true;
  qoShow('<div class="qo-msg info">Searching… / 搜索中…</div>');
  try{
    const res=await api('find_quotation&ref='+encodeURIComponent(raw));
    if(!res||!res.ok){ qoShow('<div class="qo-msg err">Lookup failed. Please try again. / 查询失败，请重试。</div>'); return; }
    const hits=res.data||[];
    if(hits.length===0){
      qoShow('<div class="qo-msg err">Quotation '+qoEsc(res.normalized||raw)+' not found. / 找不到此报价。</div>');
      return;
    }
    /* One hit on its CURRENT number → open it. A lone hit found only by its
       RETIRED number is still shown as a card, so staff can see the quotation
       has been renumbered instead of silently landing on a different number. */
    if(hits.length===1 && !hits[0].matched_previous){ qoGoId(hits[0].id); return; }
    // Never guess which one staff means — list them all.
    const rows=hits.map(h=>{
      const who=h.customer_name||h.company_name||'—';
      const rawWhen=h.quote_date||(h.created_at||'').slice(0,10);
      const when=rawWhen?formatPrintDate(rawWhen):'—';   // "29 Jun 2026"
      const amt=parseFloat(h.total_amount||0).toFixed(2);
      const prev=h.matched_previous&&h.previous_ref_no
        ? '<span class="qo-hit-prev">Formerly '+qoEsc(h.previous_ref_no)+'</span>' : '';
      return '<button type="button" class="qo-hit" onclick="qoGoId('+encodeURIComponent(h.id)+')">'
        +'<span class="qo-hit-main"><span class="qo-hit-ref">'+qoEsc(h.ref_no)+'</span>'
        +'<span class="qo-hit-sub">'+qoEsc(who)+' · '+qoEsc(when)+'</span>'+prev+'</span>'
        +'<span class="qo-hit-amt">RM '+amt+'</span></button>';
    }).join('');
    const head=hits.length===1
      ? 'Quotation '+qoEsc(raw)+' was renumbered. / 此报价编号已更改：'
      : hits.length+' quotations match “'+qoEsc(raw)+'”. Choose one: / 多个结果，请选择：';
    qoShow('<div class="qo-msg info">'+head+'</div><div class="qo-list">'+rows+'</div>');
  }catch(e){
    qoShow('<div class="qo-msg err">Lookup failed. Please try again. / 查询失败，请重试。</div>');
  }finally{
    qoBusy=false; btn.textContent=label; btn.disabled=false;
  }
}

async function refreshNextRefNo(){
  try{
    const res=await api('get_next_ref');
    if(res.ok) cachedNextRefNo=(res.data&&res.data.ref_no)||res.ref_no||'';
  }catch(e){}
  return cachedNextRefNo;
}

/* ── Customer autocomplete (MySQL companies) ── */
async function loadCompaniesCache(){
  try{
    const res=await api('get_companies');
    companiesCache=res.ok?(res.data||[]):[];
  }catch(e){ companiesCache=[]; }
}
function escapeHtmlQ(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function onCustomerInput(){
  syncQI();
  const q=(el('qi-customer').value||'').trim().toLowerCase();
  if(selectedCompanyId){
    const c=companiesCache.find(x=>String(x.id)===String(selectedCompanyId));
    if(!c || c.name.toLowerCase()!==q) selectedCompanyId=null;
  }
  if(!q){ closeAcDropdown(); return; }
  acMatches=companiesCache.filter(c=>((c.name+' '+(c.short_code||'')).toLowerCase().includes(q))).slice(0,8);
  acHighlight=-1;
  renderAcDropdown();
}
function renderAcDropdown(){
  const dd=el('acDropdown'); if(!dd) return;
  if(!acMatches.length){ dd.innerHTML=''; dd.classList.remove('open'); return; }
  dd.innerHTML=acMatches.map((c,i)=>`<div class="ac-item${i===acHighlight?' hl':''}" onmousedown="selectAcMatch(${i})">
      <div class="ac-name">${escapeHtmlQ(c.name)}</div>
      <div class="ac-meta">${escapeHtmlQ(c.short_code||'')}${c.phone?' · '+escapeHtmlQ(c.phone):''}</div>
    </div>`).join('');
  dd.classList.add('open');
}
function onCustomerKeydown(e){
  const dd=el('acDropdown');
  if(!acMatches.length || !dd || !dd.classList.contains('open')) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); acHighlight=Math.min(acHighlight+1, acMatches.length-1); renderAcDropdown(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); acHighlight=Math.max(acHighlight-1, 0); renderAcDropdown(); }
  else if(e.key==='Enter'){ if(acHighlight>=0){ e.preventDefault(); selectAcMatch(acHighlight); } }
  else if(e.key==='Escape'){ closeAcDropdown(); }
}
function selectAcMatch(i){
  const c=acMatches[i]; if(!c) return;
  el('qi-customer').value=c.name;
  el('qi-phone').value=c.phone||'';
  selectedCompanyId=c.id;
  closeAcDropdown();
  syncQI();
}
function onCustomerBlur(){ setTimeout(closeAcDropdown,150); }
function closeAcDropdown(){ acMatches=[]; acHighlight=-1; const dd=el('acDropdown'); if(dd){ dd.innerHTML=''; dd.classList.remove('open'); } }

/* ── ref no (MySQL/API) ── */
function nextRefNo(){
  if(cachedNextRefNo) return cachedNextRefNo;
  return '';
}
async function ensureRefNo(){
  if(!cachedNextRefNo) await refreshNextRefNo();
  return nextRefNo();
}

/* ── sidebar / dark / modal / toast ── *//* ── sidebar / dark / modal / toast ── */
function toggleSidebar(force){
  const sb=el('sidebar'), bd=el('sideBackdrop');
  const open = force!==undefined ? force : !sb.classList.contains('open');
  sb.classList.toggle('open',open); bd.classList.toggle('open',open);
}
function openModal(id){ el(id).classList.add('open'); }
function closeModal(id){ el(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m=>{
  /* Quick Add holds a long editing session — pasted text, parsed rows, pricing
     and accessories — so a stray backdrop click must never discard it. */
  m.addEventListener('click',e=>{ if(e.target===m&&m.id!=='draftRecoveryModal'&&m.id!=='wqaModal') m.classList.remove('open'); });
});
function openRefModal(){ openModal('refModal'); }
function switchRefTab(key){
  document.querySelectorAll('.ref-tab').forEach(t=>t.classList.toggle('active',t.getAttribute('onclick').includes("'"+key+"'")));
  ['cost','addcost','pricemode','examples'].forEach(k=>el('ref-'+k).classList.toggle('active',k===key));
}
let toastTimer;
function showToast(msg){
  const t=el('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}
function scrollToQuote(){ goToStep(3); }

/* ── Workflow stepper ── */
function goToStep(n){
  const map={1:'step1Card',2:'step2Card',3:'step3Card',4:'step4Actions'};
  const target=el(map[n]);
  if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
  if(window.innerWidth<=900) toggleSidebar(false);
}
function setStepState(n,done,current){
  const p=document.querySelector('.step-pill[data-step="'+n+'"]');
  if(!p) return;
  p.classList.toggle('done',done);
  p.classList.toggle('current',current);
}
function refreshWorkflow(){
  const qi=getQI();
  const hasCustomer=!!(qi.customer&&qi.customer.trim());
  const hasItems=quoteItems.length>0;
  const costRateOk=hasItems && quoteItems.every(i=>i.finalUnitPrice>0);
  const saved=hasItems && quoteItemsSnapshotAtSave!==null && JSON.stringify(quoteItems)===quoteItemsSnapshotAtSave;
  savedThisSession=saved;

  let active=4;
  if(!hasCustomer) active=1; else if(!hasItems) active=2; else if(!saved) active=3; else if(!sentThisSession) active=4; else active=4;
  setStepState(1,hasCustomer,active===1);
  setStepState(2,hasItems,active===2);
  setStepState(3,saved,active===3);
  setStepState(4,sentThisSession,active===4);
}

/* ── WhatsApp / print ── */
/* ── WhatsApp Message Template ── */
const WA_DEFAULT_TPL=`Hi {customer},\nQuotation {quotationNo} is ready.\nDate: {date}\n\nItems:\n{items}\n\nTotal: RM{total}\n\nPrepared by: {preparedBy}\nThank you.`;

function sanitizeWATemplate(template){
  return String(template||'')
    .replace(/^[^\r\n]*\{validUntil\}[^\r\n]*(?:\r?\n|$)/gmi,'')
    .replace(/{validUntil}/gi,'')
    .replace(/\n{3,}/g,'\n\n');
}
function getWATemplate(){ return sanitizeWATemplate(waTemplateCache || WA_DEFAULT_TPL); }
async function loadWATemplate(){
  try{
    const res=await api('get_whatsapp_template');
    if(res.ok && res.data && res.data.template_body) waTemplateCache=res.data.template_body;
    else waTemplateCache=WA_DEFAULT_TPL;
  }catch(e){ waTemplateCache=WA_DEFAULT_TPL; }
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
function buildWAItemsText(emptyText='-'){
  if(!quoteItems.length) return emptyText;
  const groups=[];
  const groupIndex=new Map();
  quoteItems.forEach(item=>{
    const title=getWAGroupTitle(item);
    if(!groupIndex.has(title)){
      groupIndex.set(title,groups.length);
      groups.push({title,rows:[],seen:new Set(),cwLabels:[]});
    }
    const group=groups[groupIndex.get(title)];
    // WAS: use abLine as size key; component lines appended after price line
    const wasItem=item.itemType==='was';
    const wasDisplay=wasItem?wasDisplayData(item):null;
    const size=wasItem?wasDisplay.abLine:(item.size||'').trim();
    const price=fmtWAUnitPrice(item.finalUnitPrice);
    const cw=wasItem?wasCWLabel(item.accessories||null):accCWLabel(item.accessories||null);
    const wasComp=wasItem?wasDisplay.compLines:'';
    const key=size+'|'+wasComp+'|'+price+'|'+cw;
    if(group.seen.has(key)) return;
    group.seen.add(key);
    group.rows.push({size,price,cw,wasComp,wasItem});
    group.cwLabels.push(cw);
  });
  let rowNo=1;
  return groups.map(group=>{
    const cwSet=new Set(group.cwLabels.filter(Boolean));
    const allRowsHaveSameCw=group.rows.length>0 && group.rows.every(row=>row.cw) && cwSet.size===1;
    const rows=group.rows.map(row=>{
      if(row.wasItem){
        const compPart=row.wasComp?'\n'+row.wasComp:'';
        const cwPart=row.cw?'\n   '+row.cw:'';
        return `${rowNo++}. ${row.size}${compPart}${cwPart}\n   - ${row.price}/set`;
      }
      const line=`${rowNo++}. ${row.size} - ${row.price}`;
      const cwPart=(!allRowsHaveSameCw&&row.cw)?'\n'+row.cw:'';
      return line+cwPart;
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
function buildQuoteText(){
  const qi=getQI();
  const grand=quoteItems.reduce((s,i)=>s+i.totalAmount,0);
  const itemLines=buildWAItemsText('-');
  const tpl=getWATemplate();
  return tpl
    .replace(/{customer}/g, qi.customer||'-')
    .replace(/{quotationNo}/g, qi.refno||'-')
    .replace(/{no}/g, qi.refno||'-')
    .replace(/{date}/g, qi.date||'-')
    .replace(/{total}/g, grand.toFixed(2))
    .replace(/{items}/g, itemLines||'-')
    .replace(/{preparedBy}/g, qi.prepby||'-');
}
async function copyTextToClipboard(text){
  if(!text) return false;
  if(navigator.clipboard && window.isSecureContext){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(e){}
  }
  const ta=document.createElement('textarea');
  ta.value=text;
  ta.setAttribute('readonly','');
  ta.style.position='fixed';
  ta.style.top='0';
  ta.style.left='0';
  ta.style.width='1px';
  ta.style.height='1px';
  ta.style.opacity='0';
  ta.style.pointerEvents='none';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let ok=false;
  try{ ok=document.execCommand('copy'); }catch(e){ ok=false; }
  document.body.removeChild(ta);
  return ok;
}
async function copyWhatsApp(){
  if(!quoteItems.length){showToast('Add items first');return}
  const ok=await copyTextToClipboard(buildQuoteText());
  showToast(ok?'WhatsApp text copied.':'Copy failed. Please copy manually from WhatsApp Message preview.');
}
function openWhatsApp(){
  if(!quoteItems.length){showToast('Add items first');return}
  window.open('https://wa.me/?text='+encodeURIComponent(buildQuoteText()),'_blank');
}
async function openWATemplateModal(){
  await loadWATemplate();
  const inp=el('waTemplateInput');
  inp.value=getWATemplate();
  refreshWAPreview();
  inp.oninput=refreshWAPreview;
  openModal('waTemplateModal');
}
function refreshWAPreview(){
  const qi=getQI();
  const grand=quoteItems.reduce((s,i)=>s+i.totalAmount,0);
  const itemLines=buildWAItemsText('(No items yet)');
  const tpl=sanitizeWATemplate(el('waTemplateInput').value);
  el('waTemplatePreview').textContent=tpl
    .replace(/{customer}/g, qi.customer||'Customer Name')
    .replace(/{quotationNo}/g, qi.refno||'Q-2026-0001')
    .replace(/{no}/g, qi.refno||'Q-2026-0001')
    .replace(/{date}/g, qi.date||'2026-07-01')
    .replace(/{total}/g, grand>0?grand.toFixed(2):'0.00')
    .replace(/{items}/g, itemLines)
    .replace(/{preparedBy}/g, qi.prepby||'Staff Name');
}
async function saveWATemplate(){
  let res;
  try{
    res=await api('save_whatsapp_template',{template_body:el('waTemplateInput').value},'POST');
  }catch(e){
    showToast('Template save failed: '+(e.message||'Network/API error'));
    return;
  }
  if(res.ok){
    await loadWATemplate();
    el('waTemplateInput').value=getWATemplate();
    refreshWAPreview();
    showToast('Template saved');
  } else {
    showToast('Template save failed: '+(res.error||'Unknown API error'));
  }
}
async function resetWATemplate(){
  const res=await api('reset_whatsapp_template',{},'POST');
  waTemplateCache=WA_DEFAULT_TPL;
  el('waTemplateInput').value=WA_DEFAULT_TPL;
  refreshWAPreview();
  showToast(res.ok?'Reset to default template':'Reset locally to default');
}
async function copyWATemplatePreview(){
  const text=el('waTemplatePreview').textContent;
  const ok=await copyTextToClipboard(text);
  showToast(ok?'WhatsApp text copied.':'Copy failed. Please copy manually.');
}
window.addEventListener('beforeprint',()=>{
  const qi=getQI();
  const issuer=fv0('qi-issued-by').trim();
  const issuerBlock=el('printIssuer');
  issuerBlock.hidden=!issuer;
  el('printIssuerName').textContent=issuer;
  el('printSummary').style.display='block';
  el('printRefNo').textContent=qi.refno||'-';
  el('printCustomer').textContent=qi.customer||'-';
  el('printDate').textContent=formatPrintDate(qi.date);
  el('printPreparedBy').textContent=qi.prepby||'-';
  el('printItemsBody').innerHTML=quoteItems.map((item,index)=>{
    const qty=parseInt(item.qty,10)||0;
    const unit=parseFloat(item.finalUnitPrice)||0;
    const total=Number.isFinite(Number(item.totalAmount))?Number(item.totalAmount):qty*unit;
    return `<tr>
      <td class="print-col-no">${index+1}</td>
      <td>${escHtml(getPrintItemDescription(item))}</td>
      <td class="print-item-size">${escHtml(getPrintItemDimension(item))}</td>
      <td class="print-col-qty">${qty}</td>
      <td class="print-col-money">${formatPrintMoney(unit)}${item.itemType==='was'?'/set':''}</td>
      <td class="print-col-money">${formatPrintMoney(total)}</td>
    </tr>`;
  }).join('');
  const grand=quoteItems.reduce((sum,item)=>sum+(parseFloat(item.totalAmount)||0),0);
  el('printGrandTotal').textContent=formatPrintMoney(grand);
  const remarks=(qi.remarks||'').trim();
  const remarksEl=el('printRemarks');
  remarksEl.hidden=!remarks;
  remarksEl.textContent=remarks?'Remarks: '+remarks:'';
});
window.addEventListener('afterprint',()=>{
  el('printSummary').style.display='none';
  el('printItemsBody').innerHTML='';
});

function formatPrintDate(value){
  if(!value) return '-';
  const s=String(value).trim();
  const parts=s.split(/[ T]/)[0].split('-');
  if(parts.length===3){
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const year=parts[0],month=Number(parts[1]),day=Number(parts[2]);
    if(/^\d{4}$/.test(year)&&month>=1&&month<=12&&day>=1&&day<=31) return `${day} ${months[month-1]} ${year}`;
  }
  return s;
}
function formatPrintMoney(value){ return 'RM '+(parseFloat(value)||0).toFixed(2); }
function getPrintItemDescription(item){
  const description=(displayItemDesc(item)||item.productType||ITEM_TYPES[item.itemType]||'Item').trim();
  const finish=String(item.finish||'').trim();
  return finish&&!description.endsWith(`(${finish})`)?`${description} (${finish})`:description;
}
function getPrintItemDimension(item){
  const size=item.itemType==='was'?wasDisplayData(item).size:String(item.size||'');
  const accessories=item.itemType==='was'?wasCWLabel(item.accessories||null):accCWLabel(item.accessories||null);
  /* Custom dimensions print with the dimension they annotate, above the
     accessory line. An item with none prints exactly as it did before. */
  return [size,dcCustomDimsPrintLine(item),accessories].filter(Boolean).join('\n');
}

/* ── Step 4 wrappers — mark "Print / WhatsApp" step as done once used ── */
function doPrint(){ if(!quoteItems.length){showToast('Add items first');return} sentThisSession=true; refreshWorkflow(); window.print(); }
function doWhatsApp(){ sentThisSession=true; refreshWorkflow(); openWhatsApp(); }
function doCopyWA(){ sentThisSession=true; refreshWorkflow(); copyWhatsApp(); }

/* ── Previous Quoted Prices (MySQL quotation history) ── */
function resetPriceHistoryPanel(){
  el('phResults').style.display='none';
  el('phEmptyMsg').style.display='none';
  el('phSameCustomerSection').style.display='none';
  el('phAllSection').style.display='none';
}
async function fetchPriceHistory(companyId){
  const material=fv(currentType,'material');
  const isSS=material==='SS304'||material==='SS316';
  const params=new URLSearchParams({
    action:'get_price_history',
    productType:ITEM_TYPES[currentType]||currentType,
    material,
    sizeType:currentType==='stud' ? '' : fv(currentType,'sizeType'),
    finish:isSS ? '' : getFinish(currentType),
    cleanSize:normalizeSizeValue(fv(currentType,'size'))
  });
  if(companyId!=null) params.set('company_id',companyId);
  const res=await fetch('api.php?'+params.toString()).then(r=>r.json());
  return res.ok?(res.data||[]):[];
}
function computeStats(matches){
  if(!matches.length) return null;
  const sorted=matches.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const prices=sorted.map(m=>parseFloat(m.unitPrice!==undefined?m.unitPrice:m.price)||0).filter(n=>n>0);
  if(!prices.length) return null;
  return {last:parseFloat(sorted[0].unitPrice!==undefined?sorted[0].unitPrice:sorted[0].price)||0, low:Math.min(...prices), high:Math.max(...prices), avg:prices.reduce((s,p)=>s+p,0)/prices.length, records:sorted.length};
}
function fillStats(prefix,stats){
  el('ph'+prefix+'Last').textContent=fmt(stats.last);
  el('ph'+prefix+'Low').textContent=fmt(stats.low);
  el('ph'+prefix+'High').textContent=fmt(stats.high);
  el('ph'+prefix+'Avg').textContent=fmt(stats.avg);
  el('ph'+prefix+'Records').textContent=stats.records;
}
async function checkPreviousPrice(){
  resetPriceHistoryPanel();
  const sameMatches = selectedCompanyId!=null ? await fetchPriceHistory(selectedCompanyId) : [];
  const sameStats = computeStats(sameMatches);
  const allMatches = await fetchPriceHistory(null);
  const allStats = computeStats(allMatches);

  const showSame = !!sameStats;
  const showAll = !!allStats && (!sameStats || sameStats.records<3);

  el('phSameCustomerSection').style.display = showSame ? 'block' : 'none';
  el('phAllSection').style.display = showAll ? 'block' : 'none';
  if(showSame) fillStats('Same', sameStats);
  if(showAll) fillStats('All', allStats);

  const hasAny = showSame || showAll;
  el('phResults').style.display = hasAny ? 'block' : 'none';
  el('phEmptyMsg').style.display = hasAny ? 'none' : 'block';
}

function findMatchingCompanyByName(name){
  const n=(name||'').trim().toLowerCase();
  return companiesCache.find(c=>(c.name||'').trim().toLowerCase()===n)||null;
}
async function loadCompaniesIntoSelect(){
  await loadCompaniesCache();
  const sel=el('sv-company'); sel.innerHTML='<option value="" data-i18n="mNoCompanyStandalone">— No company (standalone) —</option>';
  companiesCache.forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=(c.short_code?c.short_code+' — ':'')+c.name; sel.appendChild(o); });
}

/* ── Save modal ── */
async function openSaveModal(){
  if(loadedSavedQuote && quoteLocked){ showToast('Click Edit Saved Quotation first'); return; }
  if(editingItemIndex!==null){ showToast('Update or cancel item edit first'); goToStep(2); return; }
  if(!quoteItems.length){ showToast('Add items first'); return; }
  await loadCompaniesIntoSelect();
  if(selectedCompanyId) el('sv-company').value=selectedCompanyId;
  else{
    const match=findMatchingCompanyByName(fv0('qi-customer'));
    if(match){ selectedCompanyId=match.id; el('sv-company').value=match.id; if(!fv0('qi-phone')) el('qi-phone').value=match.phone||''; }
  }
  const qi=getQI();
  const ref=editingQuoteId ? qi.refno : (qi.refno || await ensureRefNo());
  if(!ref){ showToast('Unable to get quotation number. Please check API/database.'); return; }
  el('sv-refno').value=ref;
  el('sv-refno').readOnly=!!editingQuoteId;
  el('sv-date').value=qi.date||todayStr();
  el('sv-prepby').value=qi.prepby||'';
  el('sv-remarks').value=qi.remarks||'';
  el('saveModalTitle').innerHTML = (editingQuoteId?dcT('updateQuotation'):dcT('saveQuotation')) + ' <button class="modal-close" onclick="closeModal(\'saveModal\')">✕</button>';
  const submit=el('saveModalSubmitBtn');
  if(submit) submit.textContent=editingQuoteId?'Update Quotation':'Save Quotation';
  openModal('saveModal');
}
async function doSaveQuotation(){
  if(loadedSavedQuote && quoteLocked){ showToast('Click Edit Saved Quotation first'); return; }
  if(editingItemIndex!==null){ showToast('Update or cancel item edit first'); goToStep(2); return; }
  const customer=(fv0('qi-customer')||'').trim();
  if(!customer){ showToast('Customer is required'); goToStep(1); return; }
  if(!quoteItems.length){ showToast('Add at least 1 item'); return; }
  const companyId=el('sv-company').value?parseInt(el('sv-company').value,10):null;
  selectedCompanyId=companyId;
  const updatingExisting=!!editingQuoteId;
  const ref=updatingExisting ? fv0('qi-refno') : (el('sv-refno').value.trim() || await ensureRefNo());
  if(!ref){ showToast('Unable to get quotation number. Please check API/database.'); return; }
  el('qi-refno').value=ref;
  el('qi-date').value=el('sv-date').value;
  el('qi-prepby').value=el('sv-prepby').value.trim();
  el('qi-remarks').value=el('sv-remarks').value.trim();
  syncQI();
  const payload={
    id: editingQuoteId||undefined,
    company_id: companyId,
    ref_no: ref,
    quote_date: el('sv-date').value,
    valid_until: updatingExisting ? loadedValidUntil : '',
    prepared_by: el('sv-prepby').value.trim(),
    remarks: el('sv-remarks').value.trim(),
    customer_name: customer,
    customer_phone: fv0('qi-phone'),
    items: JSON.parse(JSON.stringify(quoteItems)),
    total_amount: quoteItems.reduce((s,i)=>s+i.totalAmount,0)
  };
  const res=await api(editingQuoteId?'update_quotation':'save_quotation',payload,'POST');
  if(!res.ok){ showToast('Save failed: '+(res.error||'server error')); return; }
  clearUnsavedDraft();
  editingQuoteId=editingQuoteId || res.id || (res.data&&res.data.id) || null;
  /* Phase 1 fix: the quotation number is allocated by the server at save time.
     If another tab/user took the previewed number first, the server assigns
     the next free one — show it and update the form so Print/WhatsApp/Copy
     all carry the real number. */
  let refWasReassigned=false;
  if(!updatingExisting && res.ref_no){
    refWasReassigned=!!(res.reassigned && ref && res.ref_no!==ref);
    el('qi-refno').value=res.ref_no;
    syncQI();
  }
  closeModal('saveModal');
  loadedSavedQuote=true;
  quoteLocked=true;
  editingItemIndex=null;
  quoteStatusMode=updatingExisting?'updated':'locked';
  captureSavedQuotationSnapshot();
  renderQuote();
  await refreshNextRefNo();
  if(refWasReassigned){
    showToast('Saved as '+el('qi-refno').value+' — number '+ref+' was already taken / 已保存为 '+el('qi-refno').value+'（'+ref+' 已被使用）');
  } else {
    showToast(updatingExisting?'Quotation updated and locked':'Quotation saved and locked');
  }
  refreshWorkflow();
}

/* ── handoff load from Companies page ── */
function checkHandoff(){
  let payload=null; try{payload=JSON.parse(sessionStorage.getItem(HANDOFF_KEY)||'null')}catch(e){}
  if(!payload) return false;
  sessionStorage.removeItem(HANDOFF_KEY);
  clearUnsavedDraft();
  productEntryTouchedFields.clear();
  suspendDirtyTracking=true;
  el('qi-customer').value=payload.customer_name||payload.company_name||'';
  el('qi-phone').value=payload.customer_phone||'';
  el('qi-refno').value=payload.ref_no||'';
  el('qi-date').value=payload.quote_date||todayStr();
  el('qi-issued-by').value='';
  loadedValidUntil=payload.valid_until||'';
  el('qi-prepby').value=payload.prepared_by||'';
  el('qi-remarks').value=payload.remarks||'';
  selectedCompanyId=payload.company_id||null;
  syncQI();
  /* The spread is shallow, so the custom dimensions are cloned explicitly:
     two items loaded from one payload must never share an array. An item saved
     before this feature existed normalises to an empty list and loads as it
     always did.

     The size type is normalised on the way in as well: a Stud saved before the
     rule existed can be carrying Fullsize, and a hard rule that only applied to
     new items would not be a hard rule. Nothing else about the item is touched
     — its stored description, price and weight are the quotation as it was
     sent, and those are not ours to rewrite. */
  quoteItems=(payload.items||[]).map(i=>({...i,
    sizeType:dcSizeTypeFor(resolveItemType(i||{}),i&&i.sizeType),
    customDimensions:dcNormalizeCustomDims(i&&i.customDimensions)}));
  editingItemIndex=null;
  editingQuoteId=payload.id||null;
  loadedSavedQuote=!!editingQuoteId;
  quoteLocked=!!editingQuoteId;
  quoteStatusMode=editingQuoteId?'locked':'draft';
  captureSavedQuotationSnapshot();
  suspendDirtyTracking=false;
  // Restore accessories into the current form type if only one type present
  const accByType={};
  quoteItems.forEach(item=>{
    if(item.accessories && (item.accessories.nut?.enabled||item.accessories.fw?.enabled||item.accessories.custom?.enabled)){
      accByType[item.itemType]=item.accessories;
    }
  });
  Object.entries(accByType).forEach(([t,acc])=>{ try{loadAccIntoForm(t,acc);}catch(e){} });
  renderQuote();
  showToast('Loaded quotation '+(payload.ref_no||''));
  goToStep(3);
  return true;
}

const ITEM_TYPE_LABELS={sagrod:'Sag Rod',stud:'Stud',anchorbolt:'Anchor Bolt',ubolt:'U-Bolt',squbolt:'SQ U-Bolt',lbolt:'L Bolt',lbolt45:'L Bolt 45DEG',jbolt:'J Bolt'};

function normalizeDPRule(r){
  return {
    id:String(r.id||''),
    type:r.type||r.product_type||'sagrod',
    material:r.material||'MS',
    sizeType:r.sizeType!==undefined ? (r.sizeType||'') : (r.size_type||''),
    size:(r.size||'').toUpperCase(),
    finish:r.finish||'',
    costRate:parseFloat(r.costRate!==undefined?r.costRate:r.cost_rate)||0,
    addCost:parseFloat(r.addCost!==undefined?r.addCost:r.additional_cost)||0,
    markup:parseFloat(r.markup)||0,
    active:String(r.active!==undefined?r.active:(r.is_active!==undefined?r.is_active:1)),
    source:r.source||'custom'
  };
}
function loadDPRules(){ return dpRulesCache; }
async function refreshDPRules(){
  const res=await api('get_default_prices');
  dpRulesCache=(res.ok?(res.data||[]):[]).map(normalizeDPRule);
  return dpRulesCache;
}
function saveDPRules(rules){ dpRulesCache=rules.map(normalizeDPRule); }

function dpKey(r){
  const type=r.type||'';
  const noST=type==='stud';
  return [type,r.material||'',noST?'':(r.sizeType||''),(r.size||'').toUpperCase(),r.finish||''].join('|');
}
function makeSystemDPRule(type,material,sizeType,size,finish,costRate,addCost,markup=0){
  return normalizeDPRule({id:'sys-dp:'+[type,material,sizeType,size,finish||'NA'].join(':'),type,material,sizeType,size,finish,costRate,addCost,markup,active:'1',source:'system'});
}
function getSystemDPRules(){
  const rows=[];
  const addSagRodMS=(sizeType,size)=>{
    Object.entries(RATES).forEach(([finish,row])=>{
      rows.push(makeSystemDPRule('sagrod','MS',sizeType,size,finish,row.costRate,finish==='HDG'?1.60:0,0));
    });
  };
  Object.keys(DIA_FULLSIZE).forEach(size=>addSagRodMS('FULLSIZE',size));
  Object.keys(DIA_UNDERSIZE).forEach(size=>addSagRodMS('UNDERSIZE',size));
  Object.keys(DIA_UNDERSIZE_INCH).forEach(size=>addSagRodMS('UNDERSIZE',size));
  Object.entries(RATES_4140).forEach(([desc,sizes])=>{
    const sizeType=desc.includes('UNDERSIZE')?'UNDERSIZE':'FULLSIZE';
    Object.entries(sizes).forEach(([size,row])=>{
      rows.push(makeSystemDPRule('sagrod','4140',sizeType,size,'PL',row.plRate,row.addCostPL,0));
      rows.push(makeSystemDPRule('sagrod','4140',sizeType,size,'ZP',row.plRate+ZP_SURCHARGE,row.addCostPL,0));
      rows.push(makeSystemDPRule('sagrod','4140',sizeType,size,'HDG',row.plRate+HDG_SURCHARGE,row.addCostPL+HDG_THREAD_BRUSHING,0));
    });
  });
  return rows;
}
function getDPDisplayRules(){
  const merged=new Map();
  getSystemDPRules().forEach(r=>merged.set(dpKey(r),r));
  loadDPRules().forEach(r=>merged.set(dpKey(r),normalizeDPRule({...r,source:'custom'})));
  return Array.from(merged.values());
}
function normalizedRuleFinish(r){ return (r.finish||'') ? r.finish : 'NA'; }
function setDPSourceMode(mode){ const e=el('dpFilterSource'); if(e)e.value=mode; syncDPModeButtons(); renderDPList(); }
function syncDPModeButtons(){
  const mode=(el('dpFilterSource')&&el('dpFilterSource').value)||'custom';
  [['dpModeCustom','custom'],['dpModeSystem','system'],['dpModeAll','all']].forEach(([id,key])=>{const b=el(id); if(b)b.classList.toggle('active',mode===key);});
}

/* ── Matching ── */
function findDPMatch(type,material,sizeType,size,finish){
  const rules=getDPDisplayRules().filter(r=>r.active=='1');
  const isSS=material==='SS304'||material==='SS316';
  const skipSizeType=type==='stud';
  return rules.find(r=>{
    if(r.type!==type) return false;
    if(r.material!==material) return false;
    if(!skipSizeType && r.sizeType!==sizeType) return false;
    const rSize=(r.size||'').toUpperCase().trim();
    const cSize=(size||'').toUpperCase().trim();
    if(rSize && rSize!==cSize) return false;
    if(!isSS){
      const rFinish=(r.finish||'');
      if(rFinish && rFinish!==finish) return false;
    }
    return true;
  })||null;
}

/* ── Auto-fill when form changes ── */
function applyDefaultPrice(){
  const type=currentType;
  const stat=el('dpStatus');
  if(type==='others'){
    if(stat) stat.classList.remove('show');
    return;
  }
  const material=fv(type,'material');
  const sizeType=type==='stud' ? '' : fv(type,'sizeType');
  const size=normalizeSizeValue(fv(type,'size'));
  const finish=getFinish(type);
  const match=findDPMatch(type,material,sizeType,size,finish);
  if(match){
    const crEl=el(type+'-costRate'), acEl=el(type+'-addCost'), mkEl=el(type+'-markup');
    /* Phase 1 fix: never refill a field the user has manually edited —
       even if they cleared it (deliberate blank stays blank until Add). */
    if(crEl && !crEl.value && !isUserPriced(type,'costRate')) crEl.value=parseFloat(match.costRate||0).toFixed(2);
    if(acEl && !acEl.value && !isUserPriced(type,'addCost')) acEl.value=parseFloat(match.addCost||0).toFixed(2);
    if(mkEl && !mkEl.value) mkEl.value=match.markup||0;
    if(stat) stat.classList.add('show');
    recalcCurrent();
  } else {
    if(stat) stat.classList.remove('show');
  }
}

/* ── Modal open/close ── */
async function openDPModal(){
  resetDPForm();
  await refreshDPRules().catch(()=>{});
  const src=el('dpFilterSource'); if(src) src.value='custom';
  syncDPModeButtons();
  renderDPList();
  onDPMaterialChange();
  openModal('dpModal');
}

function onDPMaterialChange(){
  const mat=el('dp-material')&&el('dp-material').value;
  const type=el('dp-type')&&el('dp-type').value;
  const isSS=mat==='SS304'||mat==='SS316';
  const ff=el('dp-finish-field');
  if(ff) ff.style.display=isSS?'none':'';
  if(isSS && el('dp-finish')) el('dp-finish').value='';
  const stf=el('dp-sizeType-field');
  if(stf) stf.style.display=(type==='stud')?'none':'';
  if(type==='stud' && el('dp-sizeType')) el('dp-sizeType').value='';
}

/* ── Form CRUD ── */
function resetDPForm(){
  ['dp-edit-id','dp-size'].forEach(id=>{ const e=el(id); if(e) e.value=''; });
  ['dp-type','dp-material','dp-sizeType','dp-finish','dp-active'].forEach(id=>{ const e=el(id); if(e) e.selectedIndex=0; });
  ['dp-costRate','dp-addCost','dp-markup'].forEach(id=>{ const e=el(id); if(e) e.value=''; });
  el('dpFormTitle').textContent='Add Default Price Rule';
  onDPMaterialChange();
}

async function saveDPRule(){
  const size=(el('dp-size').value||'').trim().toUpperCase();
  if(!size){ showToast('Enter a Size value'); return; }
  const mat=el('dp-material').value;
  const isSS=mat==='SS304'||mat==='SS316';
  const type=el('dp-type').value;
  const rule={
    id: el('dp-edit-id').value || '',
    type,
    material: mat,
    sizeType: type==='stud' ? '' : el('dp-sizeType').value,
    size,
    finish: isSS ? '' : el('dp-finish').value,
    costRate: parseFloat(el('dp-costRate').value)||0,
    addCost: parseFloat(el('dp-addCost').value)||0,
    markup: parseFloat(el('dp-markup').value)||0,
    active: el('dp-active').value
  };
  const action=rule.id?'update_default_price':'save_default_price';
  const res=await api(action,rule,'POST');
  if(!res.ok){showToast('Save failed: '+(res.error||'server error'));return}
  await refreshDPRules();
  showToast(rule.id ? 'Rule updated' : 'Rule saved');
  resetDPForm();
  renderDPList();
  applyDefaultPrice();
}

function editDPRule(id){
  const rule=getDPDisplayRules().find(r=>String(r.id)===String(id)); if(!rule) return;
  el('dp-edit-id').value=rule.source==='system'?'':rule.id;
  el('dp-type').value=rule.type;
  el('dp-material').value=rule.material;
  el('dp-sizeType').value=rule.sizeType;
  el('dp-size').value=rule.size;
  onDPMaterialChange();
  el('dp-finish').value=rule.finish||'';
  el('dp-costRate').value=rule.costRate;
  el('dp-addCost').value=rule.addCost;
  el('dp-markup').value=rule.markup;
  el('dp-active').value=rule.active;
  el('dpFormTitle').textContent=rule.source==='system'?'Override System Default':'Edit Rule';
  el('dpModal').scrollTop=0;
}

async function toggleDPRule(id){
  const rule=loadDPRules().find(r=>String(r.id)===String(id)); if(!rule) return;
  rule.active=rule.active=='1'?'0':'1';
  const res=await api('update_default_price',rule,'POST');
  if(!res.ok){showToast('Update failed');return}
  await refreshDPRules();
  renderDPList();
  applyDefaultPrice();
}

async function deleteDPRule(id){
  if(!confirm('Delete this default price rule?')) return;
  const res=await api('delete_default_price',{id},'POST');
  if(!res.ok){showToast('Delete failed');return}
  await refreshDPRules();
  renderDPList();
  applyDefaultPrice();
}

/* ── Render list ── */
function renderDPList(){
  const q=(el('dpSearch').value||'').toLowerCase();
  const fType=el('dpFilterType').value;
  const fMaterial=(el('dpFilterMaterial')&&el('dpFilterMaterial').value)||'';
  const fSizeType=(el('dpFilterSizeType')&&el('dpFilterSizeType').value)||'';
  const fFinish=(el('dpFilterFinish')&&el('dpFilterFinish').value)||'';
  const fSource=(el('dpFilterSource')&&el('dpFilterSource').value)||'custom';
  const allRules=getDPDisplayRules();
  let rules=allRules;
  if(fType) rules=rules.filter(r=>r.type===fType);
  if(fMaterial) rules=rules.filter(r=>r.material===fMaterial);
  if(fSizeType) rules=rules.filter(r=>normalizedRuleSizeType(r)===fSizeType);
  if(fFinish) rules=rules.filter(r=>normalizedRuleFinish(r)===fFinish);
  if(fSource!=='all') rules=rules.filter(r=>r.source===fSource);
  if(q) rules=rules.filter(r=>(r.size||'').toLowerCase().includes(q));
  syncDPModeButtons();
  updateSettingsCount('dpCountText',rules.length,allRules.length);
  el('dpRuleCount').textContent=rules.length;
  const tbody=el('dpListBody'); tbody.innerHTML='';
  const empty=el('dpEmpty');
  empty.innerHTML=fSource==='custom'
    ? 'No custom default price rules yet.<br>还没有自定义默认价格规则。<div style="font-size:11.5px;margin-top:6px">Use Status filter to view System Defaults.<br>可切换状态筛选查看系统默认值。</div>'
    : 'No default price rules match these filters.';
  empty.style.display=rules.length?'none':'block';
  const pct=n=>(n||0)+'%';
  rules.forEach(r=>{
    const tr=document.createElement('tr');
    const isSystem=r.source==='system';
    tr.innerHTML=`
      <td>${escHtml(ITEM_TYPE_LABELS[r.type]||r.type)}</td>
      <td>${escHtml(materialLabel(r.material))}</td>
      <td style="font-size:11px">${escHtml(r.sizeType||'-')}</td>
      <td><strong>${escHtml(r.size)}</strong></td>
      <td>${escHtml(r.finish||'N/A')}</td>
      <td>${parseFloat(r.costRate).toFixed(2)}</td>
      <td>${parseFloat(r.addCost).toFixed(2)}</td>
      <td>${pct(r.markup)}</td>
      <td><span class="dp-badge ${isSystem?'dp-badge-system':'dp-badge-custom'}">${isSystem?'System Default / 系统默认':'Custom / 自定义'}</span></td>
      <td><span class="dp-badge ${r.active=='1'?'dp-badge-on':'dp-badge-off'}">${r.active=='1'?'Active':'Off'}</span></td>
      <td style="white-space:nowrap">
        <button class="dp-act" onclick="editDPRule('${r.id}')" title="Edit">✎</button>
        ${isSystem?'':`<button class="dp-act" onclick="toggleDPRule('${r.id}')" title="${r.active=='1'?'Disable':'Enable'}">${r.active=='1'?'⏸':'▶'}</button>`}
        ${isSystem?'':`<button class="dp-act" style="color:var(--red)" onclick="deleteDPRule('${r.id}')" title="Delete">✕</button>`}
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ── v2.23.0 Stage 7B-18A: Master Data Tools (Diameter Settings / Default Price Excel Import-Export) ── */
const MDT_CONFIG={
  ds:{importAction:'import_diameter_settings',refreshFn:()=>refreshDSRules().then(()=>renderDSList()),
    fileInputId:'dsImportFile',previewId:'dsImportPreview',summaryId:'dsImportSummary',detailsId:'dsImportDetails'},
  dp:{importAction:'import_default_prices',refreshFn:()=>refreshDPRules().then(()=>renderDPList()),
    fileInputId:'dpImportFile',previewId:'dpImportPreview',summaryId:'dpImportSummary',detailsId:'dpImportDetails'}
};
let mdtPendingCsv={ds:'',dp:''};
function mdtPickFile(kind){ const f=el(MDT_CONFIG[kind].fileInputId); if(f) f.click(); }
function mdtCancelImport(kind){
  const cfg=MDT_CONFIG[kind];
  mdtPendingCsv[kind]='';
  el(cfg.previewId).style.display='none';
  el(cfg.fileInputId).value='';
}
function mdtRenderPreview(kind,res){
  const cfg=MDT_CONFIG[kind];
  el(cfg.previewId).style.display='block';
  const parts=['Imported: <strong>'+res.validCount+' rows</strong>'];
  if(res.duplicateCount) parts.push('<span class="warn">Warnings: '+res.duplicateCount+' duplicate rule(s)</span>');
  if(res.errorCount) parts.push('<span class="err">Errors: '+res.errorCount+' invalid row(s)</span>');
  el(cfg.summaryId).innerHTML=parts.join(' &nbsp;·&nbsp; ');
  const lines=[];
  (res.errors||[]).forEach(e=>lines.push('Row '+e.row+': '+e.reason));
  (res.duplicates||[]).forEach(d=>lines.push('Row '+d.row+': Duplicate Rule Found — '+d.key));
  el(cfg.detailsId).innerHTML=lines.length?lines.map(l=>'<div>'+escHtml(l)+'</div>').join(''):'<div>No warnings or errors.</div>';
}
async function mdtImportFileSelected(kind,input){
  const cfg=MDT_CONFIG[kind];
  const file=input.files&&input.files[0];
  if(!file) return;
  const text=await file.text();
  mdtPendingCsv[kind]=text;
  const res=await api(cfg.importAction,{mode:'preview',csv:text},'POST');
  if(!res.ok){ showToast('Import failed: '+(res.error||'server error')); return; }
  mdtRenderPreview(kind,res);
}
async function mdtConfirmImport(kind){
  const cfg=MDT_CONFIG[kind];
  const csv=mdtPendingCsv[kind];
  if(!csv){ showToast('Nothing to import'); return; }
  const res=await api(cfg.importAction,{mode:'confirm',csv},'POST');
  if(!res.ok){ showToast('Import failed: '+(res.error||'server error')); return; }
  await cfg.refreshFn();
  let msg='Imported '+res.imported+' rows';
  if(res.duplicateCount) msg+=' · '+res.duplicateCount+' duplicates skipped';
  if(res.errorCount) msg+=' · '+res.errorCount+' invalid skipped';
  showToast(msg);
  mdtCancelImport(kind);
}

function trackProductEntryDraftEvent(event){
  const target=event.target;
  const form=target&&target.closest?target.closest('.item-form'):null;
  if(!form||form.dataset.type!==currentType) return;
  const key=target.id||(target.name?'name:'+target.name:'');
  if(key) productEntryTouchedFields.add(key);
  scheduleDraftAutosave();
}
document.addEventListener('input',trackProductEntryDraftEvent);
document.addEventListener('change',trackProductEntryDraftEvent);

window.addEventListener('beforeunload',e=>{
  if(!savedQuoteDirty) return;
  e.preventDefault();
  e.returnValue='';
});

function ensureLBolt45Form(){
  if(el('form-lbolt45')) return;
  const source=el('form-lbolt');
  if(!source) return;
  const clone=source.cloneNode(true);
  clone.id='form-lbolt45';
  clone.dataset.type='lbolt45';
  clone.innerHTML=clone.innerHTML
    .replace(/lbolt-/g,'lbolt45-')
    .replace(/lbolt'/g,"lbolt45'")
    .replace(/lbolt"/g,'lbolt45"')
    .replace(/lbolt\)/g,'lbolt45)')
    .replace(/name="lbolt-finish"/g,'name="lbolt45-finish"')
    .replace(/for="lbolt/g,'for="lbolt45');
  const totalLength=clone.querySelector('#lbolt45-length');
  if(totalLength){
    totalLength.placeholder=dcT('phManualTotalLen');
    totalLength.setAttribute('oninput',"calcLBolt('lbolt45',true)");
  }
  const heading=document.createElement('div');
  heading.className='group-label full';
  heading.textContent='L Bolt 45DEG';
  clone.insertBefore(heading,clone.firstChild);
  source.insertAdjacentElement('afterend',clone);
}

function ensureOthersForm(){
  if(el('form-others')) return;
  const source=el('form-jbolt');
  if(!source) return;
  const accToggle=source.querySelector('.acc-toggle-btn');
  const accPanel=source.querySelector('.acc-panel');
  if(!accToggle||!accPanel) return;
  const accessoriesHtml=(accToggle.outerHTML+accPanel.outerHTML).replace(/jbolt/g,'others');
  const form=document.createElement('div');
  form.className='item-form';
  form.id='form-others';
  form.dataset.type='others';
  form.innerHTML=`
    <div class="group-label full">Product Details <span class="gl-zh">/ 产品资料</span></div>
    <div class="field"><label>Product Name <span class="field-zh">产品名称</span></label><input type="text" id="others-productName" data-i18n-ph="phEgEyeBolt" placeholder="e.g. EYE BOLT" style="text-transform:uppercase" oninput="upperOthersProductName();calcOthers()" onblur="upperOthersProductName()"></div>
    <div class="field"><label>Material <span class="field-zh">材料</span></label>
      <select id="others-material" onchange="onMaterialSizeChange('others')">
        <option value="" selected data-i18n="optNone">— none —</option>
        <option value="MS">MS</option><option value="S45C">S45C</option><option value="S45C_HARDEN_G8_8">S45C + HARDEN = G8.8</option><option value="4140">4140 QT</option>
        <option value="4140_HARDEN_G10_9">4140 QT + HARDEN = G10.9</option><option value="4140_PLAIN">4140</option><option value="4340">4340 QT</option><option value="SS304">SS304</option><option value="SS316">SS316</option><option value="Y_BAR">Y BAR</option>
      </select>
    </div>
    <div class="field"><label>Size Type <span class="field-zh">尺寸类型</span></label><select id="others-sizeType" onchange="calcOthers()"><option value="" selected data-i18n="optNone">— none —</option><option value="FULLSIZE">Fullsize</option><option value="UNDERSIZE">Undersize</option></select></div>
    <div class="field full finish-field"><label>Finish <span class="field-zh">表面处理</span></label>
      <div class="finish-pills" id="others-finishPills">
        <label class="finish-pill" id="others-pill-NA" data-i18n-title="ttNotApplicable" title="Not applicable"><input type="radio" name="others-finish" value="" onchange="onFinishChange('others')"><span class="fp-code">N/A</span></label>
        <label class="finish-pill" id="others-pill-PL" data-i18n-title="ttPlain" title="Plain"><input type="radio" name="others-finish" value="PL" onchange="onFinishChange('others')"><span class="fp-code">PL</span></label>
        <label class="finish-pill selected-ZP" id="others-pill-ZP" data-i18n-title="ttZincPlated" title="Zinc Plated"><input type="radio" name="others-finish" value="ZP" checked onchange="onFinishChange('others')"><span class="fp-code">ZP</span></label>
        <label class="finish-pill" id="others-pill-HDG" data-i18n-title="ttHotDipGalvanized" title="Hot Dip Galvanized"><input type="radio" name="others-finish" value="HDG" onchange="onFinishChange('others')"><span class="fp-code">HDG</span></label>
      </div>
    </div>
    <div class="field full"><label>Dimension Text <span class="field-zh">尺寸说明</span></label><textarea id="others-dimensionText" rows="2" placeholder="e.g. M16 x L 120 x ID 35" oninput="calcOthers()"></textarea></div>
    <div class="others-weight-row">
      <!-- A fresh form defaults to Diameter x Length. The inline styles below match
           that default so the first paint is already correct; init() then calls
           onOthersWeightModeChange() which keeps them in sync from then on.
           Load & Edit and draft restore both override the mode from saved data. -->
      <div class="field"><label>Weight Mode <span class="field-zh">重量模式</span></label><select id="others-weightMode" onchange="onOthersWeightModeChange(true)"><option value="manual" data-i18n="lblManualWeight">Manual Weight</option><option value="length" selected data-i18n="lblDiaXLength">Diameter × Length</option></select></div>
      <div class="field" id="others-unitWeightField" style="display:none"><label>Unit Weight <span class="hint">(kg)</span><span class="field-zh">单件重量</span></label><input type="number" id="others-unitWeight" min="0" step="0.0001" placeholder="kg" oninput="calcOthers()"></div>
      <div class="field" id="others-diameterField"><label>Diameter <span class="hint">(mm)</span><span class="field-zh">直径</span></label><input type="number" id="others-diameter" min="0" step="0.01" placeholder="mm" oninput="calcOthers()"></div>
      <div class="field" id="others-lengthField"><label>Length <span class="hint">(mm)</span><span class="field-zh">长度</span></label><input type="number" id="others-length" min="0" step="0.1" placeholder="mm" oninput="calcOthers()"></div>
    </div>
    ${accessoriesHtml}
    <div class="group-label full" data-i18n="pricingEntry">Pricing Entry</div>
    <div class="field"><label>Cost Rate <span class="hint">(RM/kg)</span></label><input type="text" class="hl" id="others-costRate" data-i18n-ph="phEnterRate" placeholder="Enter rate" oninput="calcOthers()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('others','costRate');}"></div>
    <div class="field"><label data-i18n="lblAdditionalCost">Additional Cost</label><input type="text" class="hl" id="others-addCost" placeholder="0.00" oninput="calcOthers()" onkeydown="if(event.key==='Enter'){event.preventDefault();evalRateField('others','addCost');}"></div>
    <div class="field"><label>Markup <span class="hint">(%)</span></label><input type="number" id="others-markup" placeholder="0" min="0" oninput="calcOthers()"></div>
    <div class="field"><label data-i18n="lblQty">Qty</label><input type="number" id="others-qty" value="1" min="1" step="1" oninput="calcOthers()"></div>`;
  source.insertAdjacentElement('afterend',form);
}

function ensurePriceModeControls(){
  Object.keys(ITEM_TYPES).forEach(type=>{
    const form=el('form-'+type);
    if(!form||el(type+'-priceMode')) return;
    const pricingLabel=[...form.querySelectorAll('.group-label')].find(node=>node.textContent.includes('Pricing'));
    if(!pricingLabel) return;
    const modeField=document.createElement('div');
    modeField.className='field price-mode-field';
    modeField.innerHTML=`<label data-i18n="lblPriceMode">Price Mode</label><select id="${type}-priceMode" onchange="onPriceModeChange('${type}')"><option value="auto">Auto Round</option><option value="no_round">No Round</option><option value="manual">Manual Price</option></select>`;
    const manualField=document.createElement('div');
    manualField.className='field manual-price-field';
    manualField.id=type+'-manualUnitPriceField';
    manualField.style.display='none';
    manualField.innerHTML=`<label data-i18n="lblManualUnitPrice">Manual Unit Price (RM)</label><input type="number" id="${type}-manualUnitPrice" min="0" step="0.01" placeholder="0.00" disabled oninput="recalcCurrent()"><small class="manual-price-guide">Manual Price 是最终客户单价，配件不会再另外加一次。<span>例子：Bolt RM1.80 + 配件 RM0.20 → Manual Price 填 RM2.00</span></small>`;
    const qtyField=el(type+'-qty')?.closest('.field');
    (qtyField||pricingLabel).insertAdjacentElement('afterend',modeField);
    modeField.insertAdjacentElement('afterend',manualField);
  });
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
/* Every dimension a row can carry, beyond size and thread. Named, never
   positional: a J Bolt's ID is not an L Bolt's W wearing a different hat. */
const WQA_DIMS=['length','w','h','id','s'];
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

/* Material aliases -> the system's EXISTING internal values. Order matters:
   the more specific spellings must be tested before the bare "4140". */
const WQA_MATERIALS=[
  /* Written as our own material name, so it is that material and not a grade
     reading of it: "4140 QT + HARDEN = G10.9" selects exactly that. */
  {re:/\b4140\s*(qt)?\s*\+?\s*harden\b/i,                value:'4140_HARDEN_G10_9'},
  {re:/\bs45c\s*\+?\s*harden\b/i,                        value:'S45C_HARDEN_G8_8'},
  /* 10.9 is the other established strength mapping, and it is 4340 QT — never
     a harder 4140. It has to be tested BEFORE the 8.8/HT family below, because
     "HT 10.9" contains the generic HT and must not be answered by it: the more
     specific grade always wins. 10.9 is uncommon and customers state it, often
     as "gr10.9 or near material" — the "or near material" says they would
     accept an equivalent, it does not name a second material, so it maps to
     4340 QT exactly as a bare grade 10.9 does.
     notAfter keeps a grade apart from a measurement that happens to read the
     same: "qty 10.9" and "length 10.9" are numbers, not materials. */
  {re:/\bgrade[\s-]*10\.?9\b|\bgr\.?[\s-]*10\.?9\b|\bg[\s-]*10\.?9\b|\bht[\s-]*10\.?9\b|\bhigh[\s-]*tensile[\s-]*10\.?9\b|\b10\.9\b(?!\s*(?:mm|cm|kg|m\b))/i,
   notAfter:WQA_MEASURED_RE, value:'4340', defaulted:true, from:'G10.9'},
  /* G8.8, HT and High Tensile are all STRENGTH descriptions, not materials.
     Several materials can meet them, and the established business answer for
     all of them is 4140 QT — a defined mapping, not a guess, so the row is not
     blocked; the note simply says which wording produced it. Writing
     "S45C + HARDEN" explicitly still selects that material on the line above.

     HT is a two-letter token, so it is matched ONLY standing alone: "HT SAG
     ROD" is high tensile, "length 1000" is not, and no word containing those
     letters can trigger it. */
  /* Longest wording first, because the first alternative that matches is also
     the wording shown back to the customer: "GRADE 8.8 → 4140 QT", not
     "8.8 → 4140 QT". HT stays two letters and is matched only as a whole token,
     so "height 200" and "length 1000" can never reach it. */
  {re:/\bgrade[\s-]*8\.?8\b|\bgr\.?[\s-]*8\.?8\b|\bg[\s-]*8\.?8\b|\bht[\s-]*8\.?8\b|\bhigh[\s-]*tensile[\s-]*8\.?8\b|\bhigh[\s-]*tensile(?:\s*steel)?\b|\bht\b(?:\s*(?:material|rod|steel|stud|bolt))?|\b8\.8\b(?!\s*mm)/i,
   notAfter:WQA_MEASURED_RE, value:'4140', defaulted:true, from:'G8.8'},
  {re:/\b4140\s*qt\b/i,                                   value:'4140'},
  {re:/\b4140\s*(plain|non[\s-]*qt|not[\s-]*qt)\b|\b(plain|non[\s-]*qt)\s*4140\b/i, value:'4140_PLAIN'},
  {re:/\b4140\b/i,                                        value:'4140', defaulted:true},
  {re:/\b4340\s*(qt)?\b/i,                                value:'4340'},
  /* Stainless is written SS304, SS 304, S/S304, S.S 304, SUS304, STAINLESS
     STEEL 304 or 304 SS. The GRADE is what makes it a material: a bare "S/S" or
     "Stainless" with no number stays null and Review asks, and a bare 304 or
     316 is just a number — "304 pcs" is a quantity, "Length 316mm" is a
     length. */
  {re:/\bs\s*[\/.]?\s*s\s*[\s\/.-]*304\b|\bsus[\s-]*304\b|\bstainless(?:\s*steel)?[\s-]*304\b|\b304[\s-]*(?:ss|s\s*\/\s*s|stainless(?:\s*steel)?)\b/i,
   value:'SS304'},
  {re:/\bs\s*[\/.]?\s*s\s*[\s\/.-]*316\b|\bsus[\s-]*316\b|\bstainless(?:\s*steel)?[\s-]*316\b|\b316[\s-]*(?:ss|s\s*\/\s*s|stainless(?:\s*steel)?)\b/i,
   value:'SS316'},
  {re:/\by\s*bar\b|\bybar\b/i,                            value:'Y_BAR'},
  {re:/\bs45c\b/i,                                        value:'S45C'},
  {re:/\bms\b|\bm\s*\/\s*s\b|\bmild\s*steel\b/i,          value:'MS'},
];
/* Finish -> existing finish values only. "plain" reads as the PL finish; it is
   NOT treated as plain-4140 material, which needs explicit non-QT wording. */
const WQA_FINISHES=[
  {re:/\bhdg\b|\bhot\s*dip\b|\bgalvani[sz]ed\b/i, value:'HDG'},
  /* Zinc plating is written a dozen ways by hand and comes back from OCR with
     whatever punctuation was on the paper: ZP, Z/P, Z(P), Z[P], z p. They all
     mean the one finish we quote. */
  {re:/\bzp\b|\bz\s*[\/(\[]\s*p\s*[)\]]?|\bz\s+p\b|\bzinc\b/i, value:'ZP'},
  /* Black is what the trade calls an uncoated rod, and PL is what we quote it
     as. Matched as a whole word only. */
  {re:/\bpl\b|\bplain\b|\bblack\b/i,             value:'PL'},
];

const wqa={raw:'',product:null,common:{},commonItem:null,commonAcc:null,commonPrice:null,
           commonFix:null,
           panels:{fix:false,item:false,price:false,acc:false},applyScope:'all',
           view:'compact',rows:[],busy:false};
/* Both common sections start COLLAPSED at every width, so the parsed items are
   the first thing on screen. Collapsing only hides the editor — every value
   lives in wqa.commonPrice / wqa.commonAcc and is redrawn untouched. */
function wqaTogglePanel(which){ wqa.panels[which]=!wqa.panels[which];
  if(which==='source')     wqaRenderSource(true);
  else if(which==='fix')   wqaRenderCommonFix(true);
  else if(which==='item')  wqaRenderCommonItem(true);
  else if(which==='price') wqaRenderCommonPrice(true);
  else                     wqaRenderCommonAcc(true); }
/* opts.scope  where this section's Apply would land, said once and quietly
                instead of riding in the title as five more bold words
   opts.tone    'warn' when the badge is a count of work still to do        */
function wqaPanelHead(which,title,summary,badge,opts){
  const open=!!wqa.panels[which];
  const o=opts||{};
  return `<button type="button" class="wqa-panel-head${open?' open':''}" onclick="wqaTogglePanel('${which}')"
            aria-expanded="${open?'true':'false'}">
     <span class="wqa-panel-arrow">${open?'▾':'▸'}</span>
     <span class="wqa-panel-text">
       <span class="wqa-panel-title">${escHtml(title)}</span>
       <span class="wqa-panel-sum">${escHtml(summary)}</span>
     </span>
     ${o.scope?`<span class="wqa-panel-scope">${escHtml(o.scope)}</span>`:''}
     <span class="wqa-panel-badge${o.tone==='warn'?' is-warn':''}"${badge?'':' hidden'}>${escHtml(badge||'')}</span>
   </button>`;
}

/* ── Apply scope ────────────────────────────────────────────────────────────
   The three copy-once panels write to every live row, which is the ordinary
   job and stays the default. Switching to Selected puts a tick box on each row,
   and the same three panels then write only to what is ticked. ONE scope and
   ONE selection shared by all three, so the table gains tick boxes once — and
   only while they are being used. */
function wqaApplyTargets(){
  const live=wqa.rows.filter(r=>!r.removed);
  return wqa.applyScope==='selected' ? live.filter(r=>r.sel) : live;
}
function wqaSelCount(){ return wqa.rows.filter(r=>!r.removed&&r.sel).length; }
/* The selected count is shown in exactly one place — the table toolbar — and
   only while the tick boxes are on screen. Amber at zero, because that is the
   state an Apply is about to refuse. */
function wqaPatchSelCount(){
  const c=el('wqaSelCount'); if(!c) return;
  const on=wqa.applyScope==='selected';
  c.hidden=!on;
  if(!on){ c.classList.remove('is-zero'); return; }
  const n=wqaSelCount();
  c.textContent=dcT('wqaNSelected').replace('{n}',n);
  c.classList.toggle('is-zero',n===0);
}
function wqaSetApplyScope(s){
  wqa.applyScope = s==='selected' ? 'selected' : 'all';
  /* Leaving Selected drops the ticks: a hidden selection that a later Apply
     would silently obey is worse than starting again. */
  if(wqa.applyScope==='all') wqa.rows.forEach(r=>{ r.sel=false; });
  wqaRenderCommonFix(true);
  wqaRenderCommonItem(true); wqaRenderCommonPrice(true); wqaRenderCommonAcc(true);
  wqaRenderRows(true);
  wqaPatchSelCount();
}
function wqaToggleRowSel(i){
  const r=wqa.rows[i]; if(!r) return;
  r.sel=!r.sel;
  const card=el('wqaRows')&&el('wqaRows').querySelector('[data-wqa-row="'+i+'"]');
  if(card) card.classList.toggle('is-picked',!!r.sel);
  wqaPatchApplyLabels();          // only the button labels move; no panel rebuild
  wqaPatchSelCount();
}
/* What a panel's Apply button says it will do, in the language of the moment. */
function wqaApplyLabel(allKey,selKey){
  return wqa.applyScope==='selected'
    ? dcT(selKey).replace('{n}',wqaSelCount())
    : dcT(allKey);
}
function wqaPatchApplyLabels(){
  const step=el('wqaStep2'); if(!step) return;
  step.querySelectorAll('[data-wqa-apply]').forEach(btn=>{
    const k=String(btn.getAttribute('data-wqa-apply')).split('|');
    btn.textContent=wqaApplyLabel(k[0],k[1]);
  });
}
/* Rendered identically in all three panels, from the segmented control the row
   view toggle already uses — so it is one component, responsive already. */
function wqaScopeSwitch(){
  const sel=wqa.applyScope==='selected';
  return `<div class="wqa-view-toggle wqa-scope" role="group">
      <button type="button" class="wqa-view-btn${sel?'':' is-on'}" onclick="wqaSetApplyScope('all')"
              data-i18n="wqaScopeAll">${escHtml(dcT('wqaScopeAll'))}</button>
      <button type="button" class="wqa-view-btn${sel?' is-on':''}" onclick="wqaSetApplyScope('selected')"
              data-i18n="wqaScopeSelected">${escHtml(dcT('wqaScopeSelected'))}</button>
    </div>`;
}
/* A COLLAPSED panel still says where its Apply would land — it just no longer
   says it in the heading's voice. Same words, same guarantee, level 3. */
function wqaScopeWord(){
  return dcT(wqa.applyScope==='selected'?'wqaApplyToSelected':'wqaApplyToAll');
}

/* ── Common Size / Thread — Apply to All ───────────────────────────────────
   Shorthand photos routinely carry only lengths and quantities:

     1068 - 38pcs / 1430 - 148pcs / 1295 - 34pcs / under size / ZP

   The document never states the diameter or the thread, and the extractor is
   deliberately forbidden from inventing them — a guessed M12 would be silently
   wrong on every row. Staff know both values, so they enter them ONCE here
   instead of retyping them down thirty rows.

   A one-time copy, exactly like Pricing and Accessories below it. Nothing is
   linked: after applying, every row stays independently editable and a later
   edit here does nothing until Apply is pressed again. */
function wqaEmptyItem(){ return {size:'',thread:''}; }

/* "12", "m12" and "M12.0" all mean M12. Same shape an extracted M value is
   normalised into, so a typed size and a read one land identically. */
function wqaNormSize(v){ return wqaNormM(v); }
function wqaItemSummary(c){
  const bits=[];
  if(String(c.size||'').trim())   bits.push('Size '+wqaNormSize(c.size));
  if(String(c.thread||'').trim()) bits.push('Thread '+String(c.thread).trim());
  return bits.length ? bits.join(' · ') : dcT('notSet');
}
/* Rows still missing a size or a thread — the reason this panel exists, so it
   is surfaced on the collapsed header too. */
function wqaItemNeedCount(){
  /* Product-specific, per row: a Stud has no thread, so it is never counted as
     missing one, even when the Sag Rod beside it is. */
  return wqa.rows.filter(r=>!r.removed &&
    (!String(r.size||'').trim() ||
     (wqaThreadEnds(wqaRowProduct(r))>0 && !wqaThreadValue(r)))).length;
}
function wqaRenderCommonItem(force){
  const box=el('wqaCommonItem'); if(!box) return;
  if(!force && wqaTypingIn(box)){ wqaPatchItemPanel(); wqaDeferRender('item'); return; }
  const c=wqa.commonItem||(wqa.commonItem=wqaEmptyItem());
  const need=wqaItemNeedCount();
  /* A Stud is threaded over its whole length by definition, so there is no
     thread for a customer to state and none to ask for here. Sag Rod wants the
     pair, Anchor Bolt the single value — the placeholder says which. */
  /* Mixed rows: the box is offered when ANY of them has a thread. A J Bolt's
     ID and S are never offered to an L Bolt row, so the shared panel keeps to
     what every row in scope actually has — Size, and the thread. */
  const ends=wqaMaxEnds();
  const head=wqaPanelHead('item',dcT('wqaCommonItemTitle'),wqaItemSummary(c),
                          need?dcT('wqaNIncomplete').replace('{n}',need):'',
                          {scope:wqaScopeWord(),tone:'warn'});
  box.innerHTML = head + (!wqa.panels.item ? '' :
    `<div class="wqa-panel-body">
       <div class="wqa-acc-note">Copied once into every item in scope; each stays editable afterwards. A blank field is never copied.</div>
       <div class="wqa-item-grid${ends?'':' wqa-item-grid-1'}">
         <label class="wqa-acc-f"><span>Size</span>
           <input type="text" id="wqaCommonSize" value="${escHtml(c.size)}" placeholder="M12"
                  oninput="wqaEditCommonItem('size',this.value)"></label>
         ${ends?`<label class="wqa-acc-f"><span>Thread</span>
           <input type="text" id="wqaCommonThread" value="${escHtml(c.thread)}" placeholder="${ends===2?'75/75':'100'}"
                  oninput="wqaEditCommonItem('thread',this.value)"></label>`:''}
       </div>
       ${wqaScopeSwitch()}
       <div class="wqa-acc-actions">
         <button type="button" class="btn btn-outline btn-sm" data-wqa-apply="wqaApplyAll|wqaApplySelected"
                 onclick="wqaApplyItemToAll()">${escHtml(wqaApplyLabel('wqaApplyAll','wqaApplySelected'))}</button>
         <span class="wqa-acc-sum">Current: ${escHtml(wqaItemSummary(c))}</span>
       </div>
     </div>`);
}
/* Read-only nodes only, so a focused input is never touched. */
function wqaPatchItemPanel(){
  const box=el('wqaCommonItem'); if(!box) return;
  const c=wqa.commonItem||wqaEmptyItem();
  wqaPanelSum(box,wqaItemSummary(c));
  const need=wqaItemNeedCount();
  wqaPanelBadge(box,need?dcT('wqaNIncomplete').replace('{n}',need):'');
  const cur=box.querySelector('.wqa-acc-sum');
  if(cur) cur.textContent='Current: '+wqaItemSummary(c);
}
function wqaEditCommonItem(field,value){
  if(!wqa.commonItem) wqa.commonItem=wqaEmptyItem();
  wqa.commonItem[field]=value;
  /* Typing here changes nothing on the rows — they are untouched until Apply —
     so only the summary text is refreshed and the caret is left alone. */
  wqaPatchItemPanel();
}
/* One-time copy of Size and Thread ONLY. Length, Qty, Material, Finish, Size
   Type, pricing entry and accessories are never read or written here. */
function wqaApplyItemToAll(){
  const c=wqa.commonItem||wqaEmptyItem();
  const size=wqaNormSize(c.size);
  /* Suppressed only where we KNOW the product has no thread. An unknown product
     still copies whatever was typed — losing it would be worse than carrying it. */
  const thread=(wqaMaxEnds()===0) ? '' : String(c.thread||'').trim();
  if(!size && !thread){ showToast(dcT('wqaToastEnterSizeThread')); return; }
  const live=wqaApplyTargets();
  if(!live.length){ showToast(dcT(wqa.applyScope==='selected'?'wqaToastNoneSelected':'wqaToastNoItems')); return; }
  /* A blank field is not an instruction to clear. Only what was filled in gets
     copied, so Size-only leaves every row's thread exactly as it was — an
     asymmetric 50/110 included — and Thread-only leaves every row's size. */
  live.forEach(r=>{
    if(size){
      r.size=size;
      r.issues=r.issues.filter(x=>x!=='size');
    }
    if(thread){
      /* Thread stays ONE field. Both ends live behind it as threadLen and
         threadLen2, split by the same helper wqaEditThread uses, so 75/75,
         50/110 and 68/20 all keep their asymmetry. */
      const p=wqaSplitThread(thread);
      r.threadLen=p.a; r.threadLen2=p.b;
      r.issues=r.issues.filter(x=>x!=='threadLen');
      if(r.defaulted) r.defaulted.threadMissing=false;   // the badge is no longer true
    }
  });
  /* The panel exists to fill these in. Once every item has them it gets out of
     the way by itself — and it reopens the moment something is missing again. */
  wqa.panels.item = wqaItemNeedCount()>0;
  wqaRenderCommonItem(true);
  wqaRecomputeAll();                    // existing validation + calculator, unchanged
  const what = size&&thread ? 'Size '+size+' and Thread '+thread
             : (size ? 'Size '+size : 'Thread '+thread);
  showToast(what+' applied to '+live.length+' item'+(live.length===1?'':'s'));
}

/* ── Bulk correction ────────────────────────────────────────────────────────
   What the message SAID is read once; what it MEANT is sometimes corrected by
   the person reading it — a whole section quoted under the wrong finish, a
   stainless block that came back as MS. Doing that row by row down thirty rows
   is where mistakes come from, so it is done once here.

   Three rules make it safe to use on a list somebody has already checked:

     · every field starts at KEEP EXISTING and a field left there is not read,
       so this panel can be opened, looked at and closed without effect;
     · nothing is written until Apply — typing here changes no row;
     · Fill blanks only fills what is empty and refuses to change what is not.

   It is deliberately separate from the header selects above, which are the
   quick path for a document that is one product throughout. This is the path
   for a document that is not.                                              */
const WQA_KEEP='__KEEP__';
const WQA_FIX_FIELDS=['product','material','finish','sizeType'];
function wqaEmptyFix(){
  return {product:WQA_KEEP,material:WQA_KEEP,finish:WQA_KEEP,sizeType:WQA_KEEP,blanksOnly:false};
}
/* What a row would SHOW for this field today — the test "is this blank?" has to
   ask the same question the list answers, or Fill blanks only would fill a
   field the person can plainly see a value in. */
function wqaFixCurrent(r,k){
  return k==='product' ? wqaRowProduct(r) : wqaRowSpec(r,k);
}
function wqaFixLabel(k,v){
  if(k==='product'){ const p=wqaProductByType(v); return p?p.label:v; }
  if(k==='material') return materialLabel(v);
  if(k==='finish')   return v||'N/A';
  if(k==='sizeType') return v==='FULLSIZE'?'Fullsize':(v==='UNDERSIZE'?'Undersize':dcT('optNone'));
  return v;
}
/* What pressing Apply would do, said in one line under the button. */
function wqaFixIntent(f){
  const set=WQA_FIX_FIELDS.filter(k=>f[k]!==WQA_KEEP);
  if(!set.length) return dcT('wqaFixNothingYet');
  return dcT(f.blanksOnly?'wqaFixWillFill':'wqaFixWillSet')
         .replace('{f}',set.map(k=>wqaFixLabel(k,f[k])).join(', '));
}
function wqaFixSummary(f){
  const set=WQA_FIX_FIELDS.filter(k=>f[k]!==WQA_KEEP);
  if(!set.length) return dcT('wqaFixNone');
  return set.map(k=>wqaFixLabel(k,f[k])).join('  ·  ')
       + (f.blanksOnly ? '  ·  '+dcT('wqaFixBlanksOnly') : '');
}
/* The material list belongs to a product, so it is taken from the product this
   correction is FOR — the one being chosen here, else the document's, else the
   first one the rows actually use. */
function wqaFixMatType(f){
  return (f.product!==WQA_KEEP && f.product) || wqa.product || wqaLiveProducts()[0] || '';
}
function wqaRenderCommonFix(force){
  const box=el('wqaCommonFix'); if(!box) return;
  const f=wqa.commonFix||(wqa.commonFix=wqaEmptyFix());
  const keep=escHtml(dcT('wqaFixKeep'));
  const opt=(k,v,label)=>`<option value="${escHtml(v)}"${f[k]===v?' selected':''}>${escHtml(label)}</option>`;
  const keepOpt=k=>`<option value="${WQA_KEEP}"${f[k]===WQA_KEEP?' selected':''}>${keep}</option>`;
  const matSrc=el(wqaFixMatType(f)+'-material');
  const matOpts=keepOpt('material')+(matSrc
    ? [...matSrc.options].filter(o=>o.value)
        .map(o=>`<option value="${escHtml(o.value)}"${f.material===o.value?' selected':''}>${escHtml(o.text)}</option>`).join('')
    : '');
  const head=wqaPanelHead('fix',dcT('wqaCommonFixTitle'),wqaFixSummary(f),'',{scope:wqaScopeWord()});
  box.innerHTML = head + (!wqa.panels.fix ? '' :
    `<div class="wqa-panel-body">
       <div class="wqa-acc-note">${escHtml(dcT('wqaFixNote'))}</div>
       <div class="wqa-common-grid">
         <div class="field"><label>${escHtml(dcT('fieldProduct'))}</label>
           <select id="wqaFixProduct" onchange="wqaEditFix('product',this.value)">
             ${keepOpt('product')}
             ${WQA_PRODUCTS.map(p=>opt('product',p.type,p.label)).join('')}
           </select></div>
         <div class="field"><label>${escHtml(dcT('fieldMaterial'))}</label>
           <select id="wqaFixMaterial" onchange="wqaEditFix('material',this.value)">${matOpts}</select></div>
         <div class="field"><label>${escHtml(dcT('fieldFinish'))}</label>
           <select id="wqaFixFinish" onchange="wqaEditFix('finish',this.value)">
             ${keepOpt('finish')}${opt('finish','','N/A')}
             ${['PL','ZP','HDG'].map(v=>opt('finish',v,v)).join('')}
           </select></div>
         <div class="field"><label>${escHtml(dcT('fieldSizeType'))}</label>
           <select id="wqaFixSizeType" onchange="wqaEditFix('sizeType',this.value)">
             ${keepOpt('sizeType')}${opt('sizeType','',dcT('optNone'))}
             ${opt('sizeType','FULLSIZE','Fullsize')}${opt('sizeType','UNDERSIZE','Undersize')}
           </select></div>
       </div>
       <label class="wqa-acc-en"><input type="checkbox" id="wqaFixBlanks"${f.blanksOnly?' checked':''}
              onchange="wqaEditFix('blanksOnly',this.checked)"> ${escHtml(dcT('wqaFixBlanksOnly'))}</label>
       ${wqaScopeSwitch()}
       <div class="wqa-acc-actions">
         <button type="button" class="btn btn-outline btn-sm" data-wqa-apply="wqaApplyAll|wqaApplySelected"
                 onclick="wqaApplyFixToAll()">${escHtml(wqaApplyLabel('wqaApplyAll','wqaApplySelected'))}</button>
         <span class="wqa-acc-sum">${escHtml(wqaFixIntent(f))}</span>
       </div>
     </div>`);
}
function wqaEditFix(k,v){
  if(!wqa.commonFix) wqa.commonFix=wqaEmptyFix();
  wqa.commonFix[k]=(k==='blanksOnly')?!!v:v;
  /* Choosing a product changes which materials exist, so the panel is rebuilt;
     everything else only moves the summary. Either way NO row is touched. */
  if(k==='product'){ if(wqa.commonFix.material!==WQA_KEEP) wqa.commonFix.material=WQA_KEEP;
                     wqaRenderCommonFix(true); return; }
  const box=el('wqaCommonFix');
  wqaPanelSum(box,wqaFixSummary(wqa.commonFix));
  const cur=box&&box.querySelector('.wqa-acc-sum');
  if(cur) cur.textContent=wqaFixIntent(wqa.commonFix);
}
/* The one place these four fields are written in bulk. Order matters: the
   product decides whether a size type exists at all, and the material decides
   whether a finish does, so each is applied before the field that depends on
   it and the existing per-field rules do the refusing. */
function wqaApplyFixToAll(){
  const f=wqa.commonFix||wqaEmptyFix();
  const set=WQA_FIX_FIELDS.filter(k=>f[k]!==WQA_KEEP);
  if(!set.length){ showToast(dcT('wqaToastFixNothing')); return; }
  const live=wqaApplyTargets();
  if(!live.length){ showToast(dcT(wqa.applyScope==='selected'?'wqaToastNoneSelected':'wqaToastNoItems')); return; }
  let changed=0;
  live.forEach(r=>{
    let did=false;
    set.forEach(k=>{
      const v=f[k];
      /* Fill blanks only: a field that already says something is left saying
         it. Asked of what the row SHOWS, so an inherited value counts as an
         answer — this mode exists to be incapable of contradicting one. */
      if(f.blanksOnly && wqaFixCurrent(r,k)) return;
      if(k==='product'){
        if(wqaRowProduct(r)===v) return;
        r.product=v; r.productConflict=null;
        wqaRowRestoreThread(r,v);
        r.sizeType=dcSizeTypeFor(v,r.sizeType);
        if(!r.sizeType) r.stDefaulted=false;
        did=true; return;
      }
      if(k==='material'){
        if(r.material===v) return;
        r.material=v; r.matDefaulted=false; r.matFrom='';
        r.finish=wqaFinishFor(v,r.finish);
        did=true; return;
      }
      /* A stainless row has no finish to set, and a Stud no size type — the
         same refusals the single-field path makes, made here too. */
      if(k==='finish'){
        if(wqaNoFinish(wqaRowSpec(r,'material')) || r.finish===v) return;
        r.finish=v; did=true; return;
      }
      if(k==='sizeType'){
        if(!dcProductHasSizeType(wqaRowProduct(r)) || r.sizeType===v) return;
        r.sizeType=v; r.stDefaulted=false; did=true; return;
      }
    });
    if(did) changed++;
  });
  /* The header is a summary of the rows, so it follows them. */
  const p=wqaRowsCommonValue('product');
  if(p && p!==WQA_MIXED) wqa.product=p;
  WQA_FIX_FIELDS.filter(k=>k!=='product').forEach(k=>{
    const v=wqaRowsCommonValue(k);
    if(v!==WQA_MIXED) wqa.common[k]=v;
  });
  if(wqa.common.material) wqa.common.materialDefaulted=false;
  wqaRenderCommon(); wqaRenderCommonFix(true);
  wqa.panels.item=wqaItemNeedCount()>0; wqaRenderCommonItem(true);
  wqaRecomputeAll('force');
  showToast(changed
    ? dcT('wqaToastFixApplied').replace('{n}',changed)
    : dcT('wqaToastFixNoChange'));
}

/* Accessory shape is the EXISTING one used by getAccessories() /
   loadAccIntoForm() / accAddon(). Nothing here re-prices anything: the row is
   handed to loadAccIntoForm() and the normal engine does the sums. */
const WQA_ACC_FINISHES=['','PL','ZP','HDG','SS'];
function wqaEmptyAcc(){
  return {nut:{enabled:false,qty:2,finish:'',unitPrice:0},
          fw:{enabled:false,qty:1,finish:'',unitPrice:0},
          custom:{enabled:false,text:'',unitPrice:0}};
}
function wqaAccHas(a){ return !!(a&&((a.nut&&a.nut.enabled)||(a.fw&&a.fw.enabled)||(a.custom&&a.custom.enabled))); }
function wqaAccSummary(a){
  if(!wqaAccHas(a)) return dcT('none');
  const money=v=>Number(v)>0?(' @ RM'+Number(v).toFixed(2)):'';
  const out=[];
  if(a.nut.enabled) out.push('Nut x'+(a.nut.qty||2)+(a.nut.finish?' '+a.nut.finish:'')+money(a.nut.unitPrice));
  if(a.fw.enabled)  out.push('FW x'+(a.fw.qty||1)+(a.fw.finish?' '+a.fw.finish:'')+money(a.fw.unitPrice));
  if(a.custom.enabled) out.push((String(a.custom.text||'').trim()||'Custom')+money(a.custom.unitPrice));
  return out.join('  ·  ');
}
/* Deep clone — Apply to All is a ONE-TIME COPY. Every row must own its object
   so editing one item can never reach into another. */
function wqaCloneAcc(a){ return a?JSON.parse(JSON.stringify(a)):null; }

/* One editor markup used by both the common panel and each row; `h` builds the
   handler expression so the two share markup without sharing state. */
function wqaAccEditor(a,h){
  const fin=sel=>WQA_ACC_FINISHES.map(f=>`<option value="${f}"${f===(sel||'')?' selected':''}>${f||'N/A'}</option>`).join('');
  const off=on=>on?'':'disabled';
  return `<div class="wqa-acc-editor">
    <div class="wqa-acc-line">
      <label class="wqa-acc-en"><input type="checkbox" ${a.nut.enabled?'checked':''} onchange="${h('nut','enabled','this.checked')}"> Nut</label>
      <label class="wqa-acc-f"><span>Qty</span><input type="number" min="1" step="1" value="${a.nut.qty}" ${off(a.nut.enabled)} oninput="${h('nut','qty','this.value')}"></label>
      <label class="wqa-acc-f"><span>Finish</span><select ${off(a.nut.enabled)} onchange="${h('nut','finish','this.value')}">${fin(a.nut.finish)}</select></label>
      <label class="wqa-acc-f"><span>Unit Price</span><input type="number" min="0" step="0.01" value="${a.nut.unitPrice}" ${off(a.nut.enabled)} oninput="${h('nut','unitPrice','this.value')}"></label>
    </div>
    <div class="wqa-acc-line">
      <label class="wqa-acc-en"><input type="checkbox" ${a.fw.enabled?'checked':''} onchange="${h('fw','enabled','this.checked')}"> FW</label>
      <label class="wqa-acc-f"><span>Qty</span><input type="number" min="1" step="1" value="${a.fw.qty}" ${off(a.fw.enabled)} oninput="${h('fw','qty','this.value')}"></label>
      <label class="wqa-acc-f"><span>Finish</span><select ${off(a.fw.enabled)} onchange="${h('fw','finish','this.value')}">${fin(a.fw.finish)}</select></label>
      <label class="wqa-acc-f"><span>Unit Price</span><input type="number" min="0" step="0.01" value="${a.fw.unitPrice}" ${off(a.fw.enabled)} oninput="${h('fw','unitPrice','this.value')}"></label>
    </div>
    <div class="wqa-acc-line">
      <label class="wqa-acc-en"><input type="checkbox" ${a.custom.enabled?'checked':''} onchange="${h('custom','enabled','this.checked')}"> Custom</label>
      <label class="wqa-acc-f wqa-acc-wide"><span>Description</span><input type="text" value="${escHtml(a.custom.text||'')}" ${off(a.custom.enabled)} oninput="${h('custom','text','this.value')}"></label>
      <label class="wqa-acc-f"><span>Unit Price</span><input type="number" min="0" step="0.01" value="${a.custom.unitPrice}" ${off(a.custom.enabled)} oninput="${h('custom','unitPrice','this.value')}"></label>
    </div>
  </div>`;
}
function wqaSetAccField(a,group,field,value){
  if(field==='enabled')       a[group].enabled=!!value;
  else if(field==='qty')      a[group].qty=value===''?'':(parseFloat(value)||0);
  else if(field==='unitPrice')a[group].unitPrice=value===''?0:(parseFloat(value)||0);
  else                        a[group][field]=value;
}

/* ── common pricing entry: configure once, copy into every row ──────────────
   Cost Rate / Additional Cost / Markup / Price Mode are the ENTRY values. The
   final unit price is never copied for Auto Round or No Round — each row is
   pushed through the existing calculator with its own size, length, thread and
   weight, so two different lengths keep two different prices. Manual is the one
   mode where a final price can legitimately be shared, and it has its own
   separate button so it can never happen by accident. */
const WQA_PRICE_MODES=[{v:'auto',label:'Auto Round'},{v:'no_round',label:'No Round'},{v:'manual',label:'Manual Price'}];
function wqaEmptyPrice(){ return {costRate:'',addCost:'',markup:'',priceMode:'auto',manualUnitPrice:''}; }
/* Looked up so the summary follows the UI language; the underlying values
   (auto / no_round / manual) never change. */
function wqaPriceModeLabel(m){
  const k={auto:'pmAutoRound',no_round:'pmNoRound',manual:'pmManualPrice'}[m];
  return k ? dcT(k) : dcT('pmAutoRound');
}

function wqaRenderCommonPrice(force){
  /* `force` is for structural changes (Price Mode), where the panel must show
     the manual row immediately. Everything else yields to an active caret. */
  if(!force && wqaTypingIn(el('wqaCommonPrice'))){ wqaPatchPricePanel(); wqaDeferRender('price'); return; }
  const c=wqa.commonPrice||(wqa.commonPrice=wqaEmptyPrice());
  const manual=c.priceMode==='manual';
  const opts=WQA_PRICE_MODES.map(m=>`<option value="${m.v}"${m.v===c.priceMode?' selected':''}>${m.label}</option>`).join('');
  const entered=[c.costRate!==''?'Cost Rate '+c.costRate:'',c.addCost!==''?'Add Cost '+c.addCost:'',
                 c.markup!==''?'Markup '+c.markup+'%':'',wqaPriceModeLabel(c.priceMode)].filter(Boolean).join('  ·  ');
  el('wqaCommonPrice').innerHTML=
    wqaPanelHead('price',dcT('wqaCommonPriceTitle'),wqaPriceSummary(c),'',{scope:wqaScopeWord()}) +
    (!wqa.panels.price ? '' : `<div class="wqa-panel-body">
       <div class="wqa-acc-note">Entry values only. Auto Round and No Round rows each recalculate their own Final Unit Price.</div>
     <div class="wqa-price-line">
       <label class="wqa-acc-f"><span>Cost Rate</span><input type="number" min="0" step="0.01" value="${escHtml(c.costRate)}" oninput="wqaEditCommonPrice('costRate',this.value)"></label>
       <label class="wqa-acc-f"><span>Additional Cost</span><input type="number" min="0" step="0.01" value="${escHtml(c.addCost)}" oninput="wqaEditCommonPrice('addCost',this.value)"></label>
       <label class="wqa-acc-f"><span>Markup (%)</span><input type="number" step="0.1" value="${escHtml(c.markup)}" oninput="wqaEditCommonPrice('markup',this.value)"></label>
       <label class="wqa-acc-f"><span data-i18n="lblPriceMode">Price Mode</span><select onchange="wqaEditCommonPrice('priceMode',this.value)">${opts}</select></label>
     </div>
     ${manual?`<div class="wqa-price-line wqa-price-manual">
       <label class="wqa-acc-f"><span>Manual Unit Price (RM)</span><input type="number" min="0" step="0.01" value="${escHtml(c.manualUnitPrice)}" oninput="wqaEditCommonPrice('manualUnitPrice',this.value)"></label>
     </div>`:''}
     ${wqaScopeSwitch()}
     <div class="wqa-acc-actions">
       <button type="button" class="btn btn-outline btn-sm" data-wqa-apply="wqaApplyPriceAll|wqaApplyPriceSelected"
               onclick="wqaApplyPriceToAll()">${escHtml(wqaApplyLabel('wqaApplyPriceAll','wqaApplyPriceSelected'))}</button>
       ${manual?`<button type="button" class="btn btn-outline btn-sm wqa-manual-btn" data-wqa-apply="wqaApplyManualAll|wqaApplyManualSelected"
               onclick="wqaApplyManualPriceToAll()">${escHtml(wqaApplyLabel('wqaApplyManualAll','wqaApplyManualSelected'))}</button>`:''}
       <span class="wqa-acc-sum">${escHtml(entered)}</span>
     </div>
     ${manual?`<div class="wqa-price-warn">Manual Price gives every item the SAME final price. Different lengths normally cost different amounts — use it only for a genuine flat quote.</div>`:''}
     </div>`);
}
/* Collapsed header line: "Cost 6.00 · Add 1.60 · Markup 4% · Auto Round". */
function wqaPriceSummary(c){
  if(!c) return 'Auto Round';
  const parts=[];
  if(String(c.costRate)!=='') parts.push('Cost '+c.costRate);
  if(String(c.addCost)!=='')  parts.push('Add '+c.addCost);
  if(String(c.markup)!=='')   parts.push('Markup '+c.markup+'%');
  parts.push(wqaPriceModeLabel(c.priceMode));
  if(c.priceMode==='manual'&&String(c.manualUnitPrice||'')!=='') parts.push('RM'+c.manualUnitPrice);
  return parts.join(' · ');
}
function wqaEditCommonPrice(field,value){
  if(!wqa.commonPrice) wqa.commonPrice=wqaEmptyPrice();
  wqa.commonPrice[field]=value;
  /* Only Price Mode changes the panel's structure (manual row, manual button,
     warning). Everything else is typing, so just refresh the summary text. */
  if(field==='priceMode') wqaRenderCommonPrice(true);   // manual row appears/disappears
  else wqaPatchPricePanel();
}
/* One-time copy. Final Unit Price is deliberately NOT part of this. */
function wqaApplyPriceToAll(){
  const c=wqa.commonPrice||wqaEmptyPrice();
  const targets=wqaApplyTargets();
  if(!targets.length){ showToast(dcT(wqa.applyScope==='selected'?'wqaToastNoneSelected':'wqaToastNoItems')); return; }
  let droppedLast=0;
  targets.forEach(r=>{
    if(c.costRate!=='') r.priceOverride.costRate=c.costRate;
    if(c.addCost!=='')  r.priceOverride.addCost=c.addCost;
    if(c.markup!=='')   r.priceOverride.markup=c.markup;
    r.priceMode=c.priceMode||'auto';
    /* Leaving a row on Use Last Price while the copied mode says Auto would be
       a silent contradiction, so the flag is cleared and the count reported. */
    if(r.priceMode!=='manual'&&r.useLastPrice){ r.useLastPrice=false; r.manualPrice=''; droppedLast++; }
  });
  wqa.panels.price=true;    // stay open while staff keep editing
  wqaRenderCommonPrice();
  wqaRecomputeAll();
  showToast(dcT('wqaToastPriceApplied')+(droppedLast?' · '+dcT('wqaToastLastPriceOff').replace('{n}',droppedLast):''));
}
/* Separate, manual-only, and never triggered by the button above. */
function wqaApplyManualPriceToAll(){
  const c=wqa.commonPrice||wqaEmptyPrice();
  if(c.priceMode!=='manual'){ showToast(dcT('wqaToastSetManual')); return; }
  const v=String(c.manualUnitPrice||'').trim();
  if(v===''||!(parseFloat(v)>0)){ showToast(dcT('wqaToastEnterManual')); return; }
  const targets=wqaApplyTargets();
  if(!targets.length){ showToast(dcT(wqa.applyScope==='selected'?'wqaToastNoneSelected':'wqaToastNoItems')); return; }
  targets.forEach(r=>{ r.priceMode='manual'; r.manualPrice=v; r.useLastPrice=false; });
  wqa.panels.price=true;
  wqaRenderCommonPrice();
  wqaRecomputeAll();
  showToast('Manual unit price RM'+parseFloat(v).toFixed(2)+' applied to '+targets.length+' item'+(targets.length===1?'':'s'));
}
/* Per row, so one item can differ from the rest. */
function wqaEditRowMode(i,mode){
  const r=wqa.rows[i]; if(!r) return;
  r.priceMode=mode;
  if(mode!=='manual'){ r.useLastPrice=false; r.manualPrice=''; }
  wqaRecomputeAll(true);          // the manual price field appears/disappears
}
function wqaEditRowManualPrice(i,v){
  const r=wqa.rows[i]; if(!r) return;
  r.manualPrice=v; r.useLastPrice=false;     // typed by hand, so not a "last price"
  clearTimeout(wqa._tm); wqa._tm=setTimeout(()=>wqaRecomputeAll('patch'),250);
}

/* ── common accessories: configure once, copy into every row ── */
/* Compact form for the collapsed header: names and counts only, so the line
   stays readable on a phone. The full detail is one tap away. */
function wqaAccShortSummary(a){
  if(!wqaAccHas(a)) return dcT('none');
  const out=[];
  if(a.nut.enabled) out.push('Nut ×'+(a.nut.qty||2));
  if(a.fw.enabled)  out.push('FW ×'+(a.fw.qty||1));
  if(a.custom.enabled) out.push(String(a.custom.text||'').trim()||'Custom');
  return out.join(' · ');
}
function wqaAccActiveCount(a){
  if(!a) return 0;
  return ['nut','fw','custom'].filter(g=>a[g]&&a[g].enabled).length;
}
function wqaRenderCommonAcc(force){
  if(!force && wqaTypingIn(el('wqaCommonAcc'))){ wqaPatchAccPanel(); wqaDeferRender('acc'); return; }
  const a=wqa.commonAcc||(wqa.commonAcc=wqaEmptyAcc());
  const n=wqaAccActiveCount(a);
  const head=wqaPanelHead('acc',dcT('wqaCommonAccTitle'),wqaAccShortSummary(a),n?n+' active':'',
                          {scope:wqaScopeWord()});
  el('wqaCommonAcc').innerHTML = head + (!wqa.panels.acc ? '' :
    `<div class="wqa-panel-body">
       <div class="wqa-acc-note">Copied once into every item in scope; each stays editable afterwards.</div>
       ${wqaAccEditor(a,(g,f,v)=>`wqaEditCommonAcc('${g}','${f}',${v})`)}
       ${wqaScopeSwitch()}
       <div class="wqa-acc-actions">
         <button type="button" class="btn btn-outline btn-sm" data-wqa-apply="wqaApplyAll|wqaApplySelected"
                 onclick="wqaApplyAccToAll()">${escHtml(wqaApplyLabel('wqaApplyAll','wqaApplySelected'))}</button>
         <button type="button" class="btn btn-ghost btn-sm" onclick="wqaClearAllAcc()">Clear All Accessories</button>
         <span class="wqa-acc-sum">Current: ${escHtml(wqaAccSummary(a))}</span>
       </div>
     </div>`);
}
function wqaEditCommonAcc(group,field,value){
  if(!wqa.commonAcc) wqa.commonAcc=wqaEmptyAcc();
  wqaSetAccField(wqa.commonAcc,group,field,value);
  /* No re-render: enabling a group only flips `disabled`, and the summary is
     plain text. Rows are untouched until Apply either way. */
  if(field==='enabled') wqaSyncAccDisabled(el('wqaCommonAcc'),wqa.commonAcc);
  wqaPatchAccPanel();
}
function wqaApplyAccToAll(){
  const src=wqa.commonAcc||wqaEmptyAcc();
  const targets=wqaApplyTargets();
  if(!targets.length){ showToast(dcT(wqa.applyScope==='selected'?'wqaToastNoneSelected':'wqaToastNoItems')); return; }
  targets.forEach(r=>{ r.acc=wqaCloneAcc(src); });                   // clone per row
  wqa.panels.acc=true;      // stay open while staff keep editing
  wqaRenderCommonAcc();
  wqaRecomputeAll();
  const n=targets.length;
  showToast((wqaAccHas(src)?'Accessories applied to ':'No accessories set on ')+n+' item'+(n===1?'':'s'));
}
function wqaClearAllAcc(){
  wqa.rows.forEach(r=>{ if(!r.removed) r.acc=null; });   // dimensions and pricing entry untouched
  wqa.panels.acc=true;
  wqaRenderCommonAcc();
  wqaRecomputeAll();
  showToast(dcT('wqaToastAccCleared'));
}
function wqaEditAcc(i,group,field,value){
  const r=wqa.rows[i]; if(!r) return;
  if(!r.acc) r.acc=wqaEmptyAcc();          // lazily own an object on first edit
  wqaSetAccField(r.acc,group,field,value);
  const card=el('wqaRows').querySelector('[data-wqa-row="'+i+'"]');
  if(card){
    if(field==='enabled') wqaSyncAccDisabled(card,r.acc);
    wqaPatchRowAccBar(card,r);
  }
  /* The bar, the disabled states and the prices are all patched, so the card —
     and any field the user is still in — is left alone. */
  clearTimeout(wqa._ta); wqa._ta=setTimeout(()=>wqaRecomputeAll('patch'),250);
}
function wqaToggleAccOpen(i){ wqa.rows[i].accOpen=!wqa.rows[i].accOpen; wqaRenderRows(true); }

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
/* Stainless is quoted bare: PL, ZP and HDG are coatings for carbon steel and
   we do not quote a coated SS304 or SS316. So their finish is N/A — a definite
   answer, not a missing one — and it OUTRANKS whatever the group above them
   said. That is what stops an HDG stated for rows 1-2 from reaching the
   stainless rows underneath, wherever the finish came from. */
/* The same rule, under the name Quick Add already calls it by. */
const WQA_BARE_MATERIALS=DC_NO_FINISH_MATERIALS;
/* ── Size Type defaults ─────────────────────────────────────────────────────
   Two, both confirmed, both overridden the moment the customer says otherwise:
     · 4140, 4140 QT and 4340 QT are bought fullsize
     · MS at M12 (and its imperial twin 1/2") is bought undersize
   Nothing else has a default. MS at M16 or M20 stays blank and Review asks —
   inventing a third rule here would be exactly the guess the whole review
   screen exists to avoid. A defaulted value is marked as defaulted, so the
   screen can say it was ours and not the customer's. */
const WQA_FULLSIZE_MATERIALS=['4140','4140_PLAIN','4340'];
const WQA_UNDERSIZE_MS_SIZES=['M12','1/2','1/2"'];
function wqaDefaultSizeType(material,size){
  const m=String(material||''), s=String(size||'').trim();
  if(WQA_FULLSIZE_MATERIALS.indexOf(m)>=0) return 'FULLSIZE';
  if(m==='MS' && WQA_UNDERSIZE_MS_SIZES.indexOf(s)>=0) return 'UNDERSIZE';
  return '';
}
function wqaNoFinish(material){ return !dcMaterialHasFinish(material); }
function wqaFinishFor(material,finish){ return dcFinishFor(material,finish); }
function wqaNoSizeType(product){ return !dcProductHasSizeType(product); }
/* What the header should show for a field: the shared value, or Mixed. */
function wqaRowsCommonValue(k){
  const live=wqa.rows.filter(r=>!r.removed);
  if(!live.length) return String(wqa.common[k]||'');
  const first=String(live[0][k]||'');
  return live.every(r=>String(r[k]||'')===first) ? first : WQA_MIXED;
}
function wqaIsMixed(k){ return wqaRowsCommonValue(k)===WQA_MIXED; }
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
/* What THIS product calls that dimension. A bent bolt's long leg is its L, not
   its "Length", and its threaded end is TL — that is how the drawing is
   labelled and how the calculator's own form is labelled, so the review says
   the same. A J Bolt has no length at all: its overall size is H, and asking
   for a Length would be asking for a dimension the product does not have. */
function wqaDimLabel(product,d){
  const bent=(product==='lbolt'||product==='lbolt45'||product==='jbolt');
  if(d==='threadLen') return bent?'TL':'Thread';
  if(d==='length')    return bent?'L':'Length';
  return WQA_DIM_LABEL[d]||d;
}
/* The columns the compact list actually has. Every live row is asked what its
   product's dimensions are called, and where they all answer the same the list
   is headed with exactly those. A mixed drawing has no shared answer, so it
   gets one Spec column per row instead of a column per dimension of a product
   half the rows are not — and Edit still shows each row its own fields. */
function wqaListCols(){
  const live=wqa.rows.filter(r=>!r.removed);
  const types=[...new Set(live.map(r=>wqaRowProduct(r)))];
  if(types.length===1){
    const p=wqaProductByType(types[0]);
    if(p) return p.dims.filter(d=>d!=='size')
                       .map(d=>({k:d, lbl:wqaDimLabel(p.type,d)}));
  }
  return [{k:'spec', lbl:dcT('wqaSpecCol')}];
}
/* One row's value for one of those columns. */
function wqaRowDimCell(r,k){
  if(k==='threadLen') return wqaThreadValue(r)||'';
  if(k==='spec')      return wqaRowDimSummary(r);
  return String(r[k]==null?'':r[k]);
}
/* A mixed list's one-cell summary: this row's own dimensions, in its own
   product's order, labelled the way that product labels them. */
function wqaRowDimSummary(r){
  const t=wqaRowProduct(r);
  const p=wqaProductByType(t)||WQA_NO_PRODUCT;
  return (p.dims||[]).filter(d=>d!=='size').map(d=>{
    const v=wqaRowDimCell(r,d);
    if(!v) return '';
    return d==='length' ? v : wqaDimLabel(t,d)+' '+v;
  }).filter(Boolean).join(' · ');
}
/* And what it IS. A row carries its own product, so an Anchor Bolt and a Sag
   Rod in one document are each validated, weighed and priced as themselves.
   Falls back to the session product only while a row has none of its own —
   which is what happens when staff choose the product for the whole list. */
function wqaRowProduct(r){ return String((r&&r.product)||'') || String(wqa.product||''); }
/* Every product actually in use, for the parts of the UI that must cover them
   all: the compact column layout, the common Item panel's placeholder. */
function wqaLiveProducts(){
  const out=[];
  wqa.rows.filter(r=>!r.removed).forEach(r=>{ const t=wqaRowProduct(r);
    if(t && out.indexOf(t)<0) out.push(t); });
  if(!out.length && wqa.product) out.push(wqa.product);
  return out;
}
function wqaMaxEnds(){ return wqaLiveProducts().reduce((m,t)=>Math.max(m,wqaThreadEnds(t)),0); }

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
  return m ? 'M'+m[1].replace(/\.0$/,'') : s.toUpperCase();
}

/* Normalise separators so x / X / × / * / spaces all behave the same. */
function wqaNorm(s){
  return String(s||'')
    .replace(/[×✕✖]/g,'x')
    .replace(/\*/g,'x')
    .replace(/[–—]/g,'-')
    .replace(/\s+/g,' ')
    .trim();
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

/* ── Live updates without destroying the field being typed into ────────────
   Every panel here renders with innerHTML, which replaces the focused input and
   drops the caret. So an `input` event never re-renders: it updates state and
   patches the few read-only bits that depend on it (summaries, badges, the
   final price, the blocked message). A full render still runs on structural
   changes, and is deferred if it would land while someone is typing. */
function wqaTypingIn(container){
  const a=document.activeElement;
  if(!a||!container||!container.contains(a)) return false;
  if(a.tagName==='TEXTAREA') return true;
  if(a.tagName!=='INPUT')    return false;                 // selects/checkboxes commit
  return /^(text|number|search|tel|)$/i.test(a.type||'');
}
function wqaPanelSum(box,text){
  const n=box&&box.querySelector('.wqa-panel-sum'); if(n) n.textContent=text;
}
function wqaPanelBadge(box,text){
  const n=box&&box.querySelector('.wqa-panel-badge'); if(!n) return;
  n.textContent=text||''; n.hidden=!text;
}
/* Enable/disable a group's fields in place instead of re-rendering the editor. */
function wqaSyncAccDisabled(box,acc){
  if(!box) return;
  const lines=box.querySelectorAll('.wqa-acc-editor .wqa-acc-line');
  ['nut','fw','custom'].forEach((g,i)=>{
    const line=lines[i]; if(!line||!acc[g]) return;
    const on=!!acc[g].enabled;
    line.querySelectorAll('.wqa-acc-f input,.wqa-acc-f select').forEach(e=>{ e.disabled=!on; });
  });
}
function wqaPatchAccPanel(){
  const box=el('wqaCommonAcc'), a=wqa.commonAcc||wqaEmptyAcc();
  if(!box) return;
  wqaPanelSum(box,wqaAccShortSummary(a));
  const n=wqaAccActiveCount(a);
  wqaPanelBadge(box,n?n+' active':'');
  const cur=box.querySelector('.wqa-acc-sum');
  if(cur) cur.textContent='Current: '+wqaAccSummary(a);
}
function wqaPatchPricePanel(){
  const box=el('wqaCommonPrice');
  if(box) wqaPanelSum(box,wqaPriceSummary(wqa.commonPrice));
}
/* Row-level patch: only read-only nodes, so a focused input is never touched. */
function wqaPatchRowAccBar(card,r){
  const sum=card.querySelector('.wqa-acc-bar-sum');
  if(sum){ sum.textContent=wqaAccShortSummary(r.acc); sum.classList.toggle('has',wqaAccHas(r.acc)); }
  const badge=card.querySelector('.wqa-acc-bar .wqa-panel-badge');
  if(badge){ const n=wqaAccActiveCount(r.acc); badge.textContent=n?n+' active':''; badge.hidden=!n; }
}
function wqaPatchRows(){
  const box=el('wqaRows'); if(!box) return;
  wqa.rows.forEach((r,i)=>{
    if(r.removed) return;
    const card=box.querySelector('[data-wqa-row="'+i+'"]'); if(!card) return;
    const miss=wqaRowMissing(r);
    card.classList.toggle('wqa-row-block',miss.length>0);
    card.querySelectorAll('.wqa-uw,.wqa-uw-full').forEach(n=>{ n.textContent=wqaFmtWeight((r.calc||{}).weight); });
    const fin2=card.querySelector('.wqa-fin');
    if(fin2) fin2.textContent=wqaFmtPrice(wqaShownPrice(r));
    const badges=card.querySelector('.wqa-sum-badges');
    if(badges) badges.innerHTML=wqaBadgeHtml(r);
    const cQty=card.querySelector('.wqa-c-qty');
    if(cQty) cQty.textContent=r.qty||'—';
    /* The dimension cells are whatever this list's columns turned out to be,
       so they are refreshed from that same list rather than by name. */
    const dims=card.querySelectorAll('.wqa-sum .wqa-c-dim');
    wqaListCols().forEach((c,k)=>{ if(dims[k]) dims[k].textContent=wqaRowDimCell(r,c.k)||'—'; });
    const cSize=card.querySelector('.wqa-c-size');
    if(cSize) cSize.textContent=r.size||'—';
    const tw=card.querySelector('.wqa-tw');
    if(tw) tw.textContent=wqaFmtTotalWeight((r.calc||{}).weight,r.qty);
    wqaPatchRowAccBar(card,r);
  });
  wqaUpdateAddButton();
}
/* Both read the weight the calculator produced — no second formula anywhere. */
function wqaFmtWeight(w){
  const n=Number(w)||0;
  return n>0 ? n.toFixed(4)+' kg/pc' : '—';
}
function wqaFmtTotalWeight(w,qty){
  const n=Number(w)||0, q=parseInt(qty,10)||0;
  if(!(n>0)) return '—';
  if(!(q>0)) return '—';           // no qty yet — not an error
  return n.toFixed(4)+' × '+q+' = '+(n*q).toFixed(4)+' kg';
}
/* ── Compact review ────────────────────────────────────────────────────────
   The summary line carries everything needed to check a row at a glance, so the
   full controls only exist in the DOM when a row is actually being edited. */
function wqaRowIsOpen(r){ return wqa.view==='expanded' || !!r.open; }
function wqaToggleRow(i){ const r=wqa.rows[i]; if(!r) return; r.open=!wqaRowIsOpen(r); wqaRenderRows(true); }
function wqaSetView(v){
  wqa.view = v==='expanded' ? 'expanded' : 'compact';
  if(wqa.view==='compact') wqa.rows.forEach(r=>{ r.open=false; });
  const c=el('wqaViewCompact'), e=el('wqaViewExpanded');
  if(c) c.classList.toggle('is-on',wqa.view==='compact');
  if(e) e.classList.toggle('is-on',wqa.view==='expanded');
  wqaRenderRows(true);
}
/* Thread is ONE user-facing field. Both ends live behind it as threadLen and
   threadLen2, written and read as "50/110". */
function wqaEditThread(i,v){
  const r=wqa.rows[i]; if(!r) return;
  const m=wqaSplitThread(v);
  r.threadLen=m.a; r.threadLen2=m.b;
  r.issues=r.issues.filter(x=>x!=='threadLen');
  clearTimeout(wqa._t); wqa._t=setTimeout(()=>wqaRecomputeAll('patch'),250);
}
/* Compact cells are values only — the column header says what they are, so
   "L340" / "TL 75/75" / "Qty 48" become 340 / 75/75 / 48 and the numbers line
   up down the list. Each is its own grid cell, so every row aligns. */
/* Only worth saying on the row when the rows disagree — otherwise the header
   above has already said it once for all of them. */
function wqaRowSpecLine(r){
  if(!(wqaIsMixed('material')||wqaIsMixed('finish')||wqaIsMixed('product')||r.bodyDia)) return '';
  const bits=[];
  /* Named on the row only while the list holds more than one product — one
     word, in front of the material, so the compact list stays a list. */
  if(wqaIsMixed('product')){
    const p=wqaProductByType(wqaRowProduct(r));
    bits.push(p?p.label:dcT('needs').replace('{f}','Product'));
  }
  const m=wqaRowSpec(r,'material'); if(m) bits.push(materialLabel(m));
  else bits.push(dcT('needs').replace('{f}',dcT('fieldMaterial')));
  const f=wqaRowSpec(r,'finish');
  /* N/A is the stainless answer and is worth printing: a blank would read as a
     finish nobody has got round to yet. */
  if(f) bits.push(f); else if(wqaNoFinish(m)) bits.push('N/A');
  /* Evidence the customer gave us and we did not use for the price: shown so
     nobody wonders where it went. */
  if(r.bodyDia) bits.push(dcT('wqaBodyDia')+' '+r.bodyDia+'mm');
  return `<div class="wqa-row-spec">${escHtml(bits.join(' · '))}</div>`;
}
/* The letter this dimension is known by, short enough to sit in front of its
   own value on a phone — where there is no column header to read it from. A
   length needs none: the number after the size is the length on every product
   that has one. */
function wqaDimShort(product,k){
  if(k==='length'||k==='spec') return '';
  return k==='threadLen' ? 'TL' : wqaDimLabel(product,k);
}
function wqaCompactCells(r,cols){
  const calc=r.calc||{};
  const cell=(cls,txt,lbl)=>`<span class="wqa-c ${cls}"${lbl?` data-lbl="${escHtml(lbl)}"`:''}>${escHtml(txt)}</span>`;
  return cell('wqa-c-size', r.size||'—')
    + (cols||wqaListCols()).map(c=>cell('wqa-c-dim wqa-c-'+c.k, wqaRowDimCell(r,c.k)||'—',
                                        wqaDimShort(wqaRowProduct(r),c.k))).join('')
    + cell('wqa-c-qty',  r.qty||'—')
    + `<span class="wqa-c wqa-c-w wqa-uw">${escHtml(wqaFmtWeight(calc.weight))}</span>`
    + `<span class="wqa-c wqa-c-price wqa-fin">${escHtml(wqaFmtPrice(wqaShownPrice(r)))}</span>`;
}
/* The column widths live in CSS, one set per breakpoint. The only thing that
   cannot be written there is how MANY dimension columns this list has — CSS
   repeat() will not take a custom property as its count — so that number, and
   only that number, is composed here from the three widths the breakpoint in
   force has already chosen. */
function wqaSetListGrid(){
  /* The panel, not the overlay: the widths are declared on .wqa-modal, and a
     value set on its parent would be overridden by its own rule. */
  const m=document.querySelector('#wqaModal .wqa-modal'); if(!m) return;
  const cs=getComputedStyle(m);
  const cols=wqaListCols();
  const lead=(cs.getPropertyValue('--wqa-lead')||'32px 62px').trim();
  /* A mixed list has ONE column carrying a whole specification, so it gets a
     track sized for a sentence rather than for a number. */
  const spec=cols.length===1 && cols[0].k==='spec';
  const dim =((spec ? cs.getPropertyValue('--wqa-dim-spec') : cs.getPropertyValue('--wqa-dim'))
              ||'78px').trim();
  const tail=(cs.getPropertyValue('--wqa-tail')||'56px 104px 86px minmax(0,1fr) 46px 26px').trim();
  m.style.setProperty('--wqa-cols',
    [lead].concat(new Array(cols.length).fill(dim)).concat([tail]).join(' '));
}
/* The header uses the same grid, so labels sit exactly over their column. */
function wqaRenderListHead(){
  const head=el('wqaListHead'); if(!head) return;
  const live=wqa.rows.filter(r=>!r.removed);
  const show = wqa.view==='compact' && live.length>0;
  head.hidden=!show;
  const list=el('wqaRows');
  if(list) list.classList.toggle('has-head',show);
  wqaSetListGrid();
  if(!show) return;
  head.className='wqa-list-head';
  /* One header, two layouts. Desktop lets these fall into its columns in order;
     the tablet rules narrow them. Each label sits directly over its own value
     because both are built from the SAME column list. */
  head.innerHTML=
      '<span class="wqa-h wqa-h-no">#</span>'
    + '<span class="wqa-h wqa-h-size">Size</span>'
    + wqaListCols().map(c=>`<span class="wqa-h wqa-h-num wqa-h-dim">${escHtml(c.lbl)}</span>`).join('')
    + '<span class="wqa-h wqa-h-num wqa-h-qty">Qty</span>'
    + '<span class="wqa-h wqa-h-num wqa-h-w">Weight</span>'
    + '<span class="wqa-h wqa-h-num wqa-h-price">Price</span>'
    + '<span class="wqa-h wqa-h-slack"></span>'
    + '<span class="wqa-h wqa-h-act">Actions</span>'
    + '<span class="wqa-h wqa-h-del"></span>';
}
function wqaFmtPrice(v){ const n=Number(v)||0; return n>0 ? 'RM'+n.toFixed(2) : 'RM—'; }
/* A price worked out from a material nobody chose is not this item's price, and
   a number on screen reads as an answer. So the money waits for the material.
   The weight beside it does not: it comes from diameter and length alone and is
   true whatever the rod is made of. */
function wqaShownPrice(r){
  if(wqaRowProduct(r) && !wqaRowSpec(r,'material')) return 0;
  return (r.calc||{}).finalUnitPrice;
}
/* A row that cannot be committed: something is missing, or the evidence about
   what it IS disagrees with itself. Both stop the Add button; only the second
   needs a person rather than a value. */
function wqaRowBlocked(r){ return wqaRowMissing(r).length>0 || !!r.productConflict; }
/* Small pills, never alert blocks. */
function wqaRowBadges(r){
  const out=[];
  if(r.productConflict) out.push({t:dcT('wqaConflictBadge'),k:'req'});
  if(r.noteApplied&&r.noteApplied.length)
    out.push({t:dcT('wqaNoteBadge')+' '+[...new Set(r.noteApplied)].join(' · '),k:'info'});
  /* Field names are looked up too, so "Needs Size Type" reads as a sentence in
     either language instead of a translated word glued to an English one. */
  wqaRowMissing(r).forEach(m=>out.push({t:dcT('needs').replace('{f}',
    dcT('field'+m.replace(/\s/g,''),m)),k:'req'}));
  if(r.unsupported)                             out.push({t:r.unsupported+' — '+dcT('wqaNotPriced'),k:'warn'});
  if(String(r.size).trim() && !isKnownSize(r.size))
    out.push({t:String(r.size)+': '+dcT('wqaUnknownSize'),k:'warn',w:1});
  else if(r.noDia && wqaRowSpec(r,'sizeType'))
    out.push({t:String(r.size)+(wqaRowSpec(r,'sizeType')==='UNDERSIZE'?' '+dcT('wqaUndersizeWord'):'')
                +': '+dcT('wqaNoDia'),k:'warn',w:1});
  if(r.productConflict) out.push({t:dcT('wqaConflictWhy').replace('{p}',r.productConflict.said)
                                        .replace('{g}',r.productConflict.saw),k:'warn',w:1});
  if(r.issues.includes('extra'))                out.push({t:dcT('badgeParseWarning'),k:'warn'});
  (r.aiUncertain||[]).forEach(f=>out.push({t:dcT('badgeCheck').replace('{f}',f),k:'warn'}));
  if(wqaIsAsymmetric(r))                        out.push({t:dcT('badgeAsymmetric'),k:'info'});
  if(r.useLastPrice)                            out.push({t:dcT('badgeLastPrice'),k:'info'});
  return out;
}
function wqaBadgeHtml(r){
  return wqaRowBadges(r).map(b=>`<span class="wqa-pill wqa-pill-${b.k}${b.w?' wqa-pill-why':''}">${escHtml(b.t)}</span>`).join('');
}
function wqaUpdateAddButton(){
  const live=wqa.rows.filter(r=>!r.removed);
  const blocked=live.filter(wqaRowBlocked).length;
  const btn=el('wqaAddBtn'); if(!btn) return;
  el('wqaRowsCount').textContent=dcT('nItems').replace('{n}',live.length);
  btn.disabled = live.length===0 || blocked>0;
  btn.textContent = live.length? dcT('wqaAddNItems').replace('{n}',live.length) : dcT('wqaAddItems');
  const ft=el('wqaFootTotal'), fn=el('wqaFootNeed');
  if(ft){
    ft.textContent=dcT('nItems').replace('{n}',live.length);
    /* "16 items", then "Add 16 Items to Quotation" 40px to its right, said the
       same number twice on one bar. The button is the one that has to carry it,
       so the count stands only while the button has no number to show. */
    ft.hidden = live.length>0;
  }
  if(fn){ fn.textContent=blocked?dcT('needAttention').replace('{n}',blocked):''; fn.hidden=!blocked; }
  /* Keeps the "N incomplete" badge live as rows are edited, without ever
     re-rendering the panel out from under a caret. */
  wqaPatchItemPanel();
  wqaPatchSelCount();
}
/* A render that arrives mid-typing (price history landing, a debounced
   recompute) patches instead, and the real render runs once focus leaves. */
function wqaDeferRender(kind){
  wqa._deferred=wqa._deferred||{};
  wqa._deferred[kind]=true;
  if(wqa._deferBound) return;
  wqa._deferBound=true;
  document.addEventListener('focusout',()=>{
    setTimeout(()=>{
      const d=wqa._deferred||{};
      if(d.rows  && !wqaTypingIn(el('wqaRows')))        { d.rows=false;  wqaRenderRows(); }
      if(d.item  && !wqaTypingIn(el('wqaCommonItem')))  { d.item=false;  wqaRenderCommonItem(); }
      if(d.price && !wqaTypingIn(el('wqaCommonPrice'))) { d.price=false; wqaRenderCommonPrice(); }
      if(d.acc   && !wqaTypingIn(el('wqaCommonAcc')))   { d.acc=false;   wqaRenderCommonAcc(); }
    },0);
  },true);
}

/* Layer 1 — whole-message scan for the fields that are stated once and apply to
   every row. Aliases resolve to the SAME value, so "MS UNDERSIZE SAG ROD (ZP)"
   and "m/s zp sag rod (undersize)" produce one consistent set, not a conflict. */
/* The first occurrence of a material's wording that is NOT a measurement of the
   same number. Skipping the occurrence rather than the rule matters: a message
   can say "length 10.9mm" in one line and "grade 10.9" in another, and only the
   second one is the material. */
function wqaMatchMaterial(m,said){
  if(!m.notAfter) return m.re.exec(said);
  const re=new RegExp(m.re.source,'gi');
  let x;
  while((x=re.exec(said))!==null){
    if(!m.notAfter.test(said.slice(0,x.index))) return x;
    if(re.lastIndex<=x.index) re.lastIndex=x.index+1;
  }
  return null;
}
function wqaDetectCommon(text){
  const hay=' '+wqaNorm(text).toLowerCase()+' ';
  const out={product:null,material:'',materialDefaulted:false,finish:'',sizeType:''};
  /* Every product the wording names, not the first one. A document that says
     "SAG ROD / ANCHOR BOLT" has not said which, and choosing for the customer
     is exactly the confident-and-wrong answer we refuse to give: product stays
     null and Review asks. A drawing that genuinely CONTAINS both is the same
     answer at document level — each row then says what it is. */
  const named=[];
  for(const p of WQA_PRODUCTS){
    if((p.std && p.std.test(hay)) ||
       p.aliases.some(a=>hay.includes(' '+a+' ')||hay.includes(' '+a+'s ')||hay.includes(a))){
      named.push(p.type); }
  }
  out.product = named.length===1 ? named[0] : null;
  out.productAmbiguous = named.length>1;
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
    if(hit){ out.material=m.value; out.materialDefaulted=!!m.defaulted;
             out.materialDefaultedFrom=String(hit[0]).replace(/\s+/g,' ').trim()||m.from||'4140';
             break; }
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
const WQA_DIM_RE=(function(){
  const out={};
  Object.keys(WQA_DIM_WORDS).forEach(k=>{
    const w=WQA_DIM_WORDS[k];
    /* "ID 70mm" and "70mm ID" and "400mm L" — the label may come before or
       after the number, and the unit may sit between them. */
    out[k]=new RegExp('(?:\\b(?:'+w+')\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:mm\\b)?'
      + '|(\\d+(?:\\.\\d+)?)\\s*(?:mm\\b)?\\s*(?:'+w+')\\b)','i');
  });
  return out;
})();
/* The thread, in the wording all three of these products share. */
const WQA_TL_DIM_RE=/(?:\bt\.?l\.?|thread(?:ed)?(?:\s*(?:length|portion|part|section))?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mm\b)?|(\d+(?:\.\d+)?)\s*(?:mm\b)?\s*(?:\bt\.?l\.?|thread(?:ed)?(?:\s*(?:length|portion|part|section))?)\b/i;
function wqaDimLabelled(s,key){
  const re = key==='TL' ? WQA_TL_DIM_RE : WQA_DIM_RE[key];
  if(!re) return null;
  const m=re.exec(s);
  if(!m) return null;
  const v=m[1]!==undefined&&m[1]!==null ? m[1] : m[2];
  return (v!=null && Number(v)>0) ? {v:String(Number(v)), at:m.index, len:m[0].length} : null;
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

/* ── Field recognisers ──────────────────────────────────────────────────────
   Each one consumes what it matches, so a consumed qty token can never be
   re-read as part of a diameter ("4pcs - M12" never becomes 4PCSM12).      */
/* opts.product lets a line be read with ITS product's vocabulary — see
   wqaProductDims. Without one, none of those letters mean anything. */
function wqaExtractFields(rawLine,opts){
  let s=wqaNorm(rawLine).replace(WQA_LIST_NUM_RE,'');
  const f={qty:null,size:null,threadLen:null,threadLen2:null,nums:[],mm:[],bodyDia:null,
           dims:null, hadX:/\sx\s|\dx\d/i.test(s), threadEnds:null, fullyThreaded:false};
  /* Read the threading off the line AS WRITTEN — the spec-word strip below
     removes the very words that say how many ends there are. */
  const ev=wqaThreadEvidence(s);
  f.threadEnds=ev.explicitEndCount;
  f.fullyThreaded=ev.fullyThreaded;
  s=wqaStripSpecWords(s);
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
  f.series=wqaSeriesValue(s);
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
                conf, issues, defaulted}};
}

/* Kept as the single-line entry point (used by the parser and by tests). */
function wqaParseLine(rawLine,productType,ctx){
  const f=wqaExtractFields(rawLine);
  const r=wqaResolveLine(f,ctx||{},productType);
  const n=wqaNormalizeExtraction({product:productType||'',
                                  items:[{...r.item,raw:String(rawLine).trim()}]},
                                 {wording:String(rawLine||'')});
  return n.rows[0];
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
  const nums=(n.replace(WQA_END_LABEL_RE,' ').match(/\d+(?:\.\d+)?/g)||[]);
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
/* ── Additional info for analysis ───────────────────────────────────────────
   A line of free text typed by the person who is looking at the drawing. It is
   sent to the model as context AND applied over the model's answer afterwards,
   here, in our own code: a value a person typed deliberately outranks a value
   read off a photograph, and that decision is not the model's to make.

   Only labels a PRODUCT ACTUALLY OWNS are filled. OD, A, B, C, T, P and R are
   recognised so they cannot be misread as one of ours — and then left alone.
   This feature never invents a custom dimension: customDimensions is a manual
   annotation layer with its own editor, and turning notes into annotations
   would put a J Bolt's H somewhere no calculator can see it. */
const WQA_NOTE_FIELDS={H:'h', ID:'id', S:'s', W:'w', L:'length', TL:'threadLen'};
const WQA_NOTE_OTHER=['OD','A','B','C','T','P','R'];
/* "H should be 530", "ID use 100", "TL change to 75" — the few words a person
   puts between a label and its value. Anything else breaks the match, which is
   the conservative half of the bargain. */
const WQA_NOTE_RE=(function(){
  const labels=Object.keys(WQA_NOTE_FIELDS).concat(WQA_NOTE_OTHER)
                 .sort((a,b)=>b.length-a.length).join('|');
  /* Plain space first — "H 530" is by far the common form — then the few words
     a person puts between a label and its value. */
  const fill='\\s*(?:(?:should\\s+be|shall\\s+be|must\\s+be|change(?:d)?\\s+to|set\\s+to|'
            +'use|using|is|are|to|be|as|=|:|-)\\s*)*';
  return new RegExp('\\b('+labels+')'+fill+'(\\d+(?:\\.\\d+)?)'
                    +'(?:\\s*/\\s*(\\d+(?:\\.\\d+)?))?\\s*(?:mm)?\\b','gi');
})();
/* "ALL TL 75" — said of every row, and the only way unscoped values reach more
   than one row. */
const WQA_NOTE_ALL_RE=/\b(?:all|every|each)(?:\s+(?:rows?|items?|sizes?|of\s+them))?\b/i;

/* One segment's facts. Material, finish and size type are read by the SAME
   function every document goes through, so the note has no second vocabulary. */
function wqaNoteSegFacts(t){
  const s=String(t||''), f={};
  const re=new RegExp(WQA_NOTE_RE.source,'gi');
  let m;
  while((m=re.exec(s))!==null){
    const field=WQA_NOTE_FIELDS[m[1].toUpperCase()];
    if(!field) continue;                       // recognised, and not ours to fill
    f[field]=String(Number(m[2]));
    if(field==='threadLen' && m[3]!=null) f.threadLen2=String(Number(m[3]));
  }
  let k=s.match(/\bm\s*(\d+(?:\.\d+)?)\b/i);
  if(k) f.size='M'+k[1].replace(/\.0$/,'');
  k=s.match(/\bqty\s*[:=]?\s*(\d+)\b/i) ||
    s.match(/\b(\d+)\s*(?:pcs|pc|nos|no|sets|set|units|unit)\b/i);
  if(k) f.qty=String(parseInt(k[1],10));
  const d=wqaDetectCommon(s);
  if(d.material) f.material=d.material;
  if(d.finish)   f.finish=d.finish;
  if(d.sizeType) f.sizeType=d.sizeType;
  return f;
}
/* The note, cut at the products it names. "L BOLT TL 100" is about the L Bolt
   and must not reach the Anchor Bolt in the same drawing. */
function wqaNoteFacts(text){
  const s=String(text||'').trim();
  if(!s) return [];
  const marks=[];
  WQA_PRODUCTS.forEach(p=>(p.aliases||[]).forEach(a=>{
    const re=new RegExp('\\b'+a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')+'\\b','gi');
    let m; while((m=re.exec(s))!==null) marks.push({at:m.index, len:m[0].length, type:p.type});
  }));
  marks.sort((a,b)=>a.at-b.at || b.len-a.len);
  const cuts=[]; let end=-1;
  marks.forEach(m=>{ if(m.at<end) return; cuts.push(m); end=m.at+m.len; });
  const segs=[];
  const head=cuts.length ? s.slice(0,cuts[0].at) : s;
  if(head.trim()) segs.push({scope:WQA_NOTE_ALL_RE.test(head)?'all':null, text:head});
  cuts.forEach((c,i)=>{
    const to=(i+1<cuts.length) ? cuts[i+1].at : s.length;
    segs.push({scope:c.type, text:s.slice(c.at+c.len,to)});
  });
  return segs.map(g=>({scope:g.scope, facts:wqaNoteSegFacts(g.text)}))
             .filter(g=>Object.keys(g.facts).length>0);
}
/* Everything the note says, for the read-back under the input. */
function wqaNoteSummary(text){
  const out=[];
  wqaNoteFacts(text).forEach(g=>{
    const p=g.scope&&g.scope!=='all' ? (wqaProductByType(g.scope)||{}).label : '';
    Object.keys(g.facts).forEach(k=>{
      if(k==='threadLen2') return;
      const lbl = k==='threadLen' ? 'TL'
                : k==='size' ? 'Size' : k==='qty' ? 'Qty'
                : k==='material' ? 'Material' : k==='finish' ? 'Finish'
                : k==='sizeType' ? 'Size Type' : (WQA_DIM_LABEL[k]||k);
      const val = k==='threadLen' && g.facts.threadLen2
                ? g.facts.threadLen+'/'+g.facts.threadLen2 : g.facts[k];
      out.push((p?p+' ':'')+(g.scope==='all'?'all ':'')+lbl+' '+val);
    });
  });
  return out;
}
/* Apply one segment's facts to one row. A field is only written where the row's
   own product HAS it — a Stud gains no thread, a Sag Rod gains no ID — and the
   two hard rules still hold over anything typed here. */
function wqaApplyNoteToRow(r,f){
  const t=wqaRowProduct(r);
  const prod=wqaProductByType(t)||WQA_NO_PRODUCT;
  const dims=prod.dims||[];
  const done=[];
  const put=(k,v,label)=>{ r[k]=String(v); r.issues=(r.issues||[]).filter(x=>x!==k);
                           done.push(label); };
  ['h','id','s','w','length'].forEach(k=>{
    if(f[k]!=null && dims.indexOf(k)>=0) put(k,f[k],wqaDimLabel(t,k));
  });
  if(f.threadLen!=null && dims.indexOf('threadLen')>=0){
    put('threadLen',f.threadLen,wqaDimLabel(t,'threadLen'));
    r.threadLen2 = f.threadLen2!=null ? String(f.threadLen2)
                 : (prod.threadEnds===2 ? String(f.threadLen) : '');
  }
  if(f.size!=null){ put('size',wqaNormM(f.size)||f.size,'Size'); }
  if(f.qty!=null)  put('qty',f.qty,'Qty');
  if(f.material!=null){
    r.material=f.material; r.matDefaulted=false; r.matFrom='';
    r.finish=wqaFinishFor(r.material,r.finish);
    done.push('Material');
  }
  if(f.finish!=null && dcMaterialHasFinish(r.material)){ r.finish=f.finish; done.push('Finish'); }
  if(f.sizeType!=null && dcProductHasSizeType(t)){
    r.sizeType=f.sizeType; r.stDefaulted=false; done.push('Size Type');
  }
  if(!done.length) return 0;
  r.conf=r.conf||{};
  ['size','length','qty','threadLen'].forEach(k=>{ if(f[k]!=null) r.conf[k]=WQA_CONF.DETECTED; });
  r.noteApplied=(r.noteApplied||[]).concat(done);
  return done.length;
}
/* The merge itself. Scoped facts go to the rows of that product; "all" goes to
   every row; unscoped facts go to the single row when there IS a single row,
   and nowhere at all when there are several — spraying a value across a mixed
   drawing is exactly the guess this system does not make. */
function wqaApplyNoteFacts(rows,text){
  const groups=wqaNoteFacts(text);
  const live=(rows||[]).filter(r=>!r.removed);
  const out={facts:groups.length, applied:0, skipped:[]};
  groups.forEach(g=>{
    let targets;
    if(g.scope==='all')      targets=live;
    else if(g.scope)         targets=live.filter(r=>wqaRowProduct(r)===g.scope);
    else                     targets=(live.length===1?live:[]);
    if(!targets.length){ out.skipped.push(g); return; }
    targets.forEach(r=>{ out.applied+=wqaApplyNoteToRow(r,g.facts)?1:0; });
  });
  return out;
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

/* Judged on the line alone: could this be a shared spec rather than an item?
   A line that already states its own thread cannot be one: "M10 X 40mm X 2end
   20/12mm Thread" names the thread outright, so the number still standing is
   the length. Without this the word "Thread" alone turned every such row into
   a header and the whole list vanished. */
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
  const entries=lines.map(raw=>{
    const t=raw.trim();
    if(!t) return {blank:true};
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
    return {t,n,f:ef,d:dd};
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
    /* "UNC" on a line of its own is the thread series of the item above it —
       read, attached, and no longer reported as something we could not read. */
    if(e.noise && WQA_SERIES_RE.test(' '+(e.n||'')+' ')){
      const prevS=lastItem();
      if(prevS && !prevS.series) prevS.series=wqaSeriesValue(e.n);
      else if(!ctx.series) ctx.series=wqaSeriesValue(e.n);
      return;
    }
    if(e.noise){ skipped.push(e.t); if(counts) unread++; return; }
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
          if(hp!==ctx.product) secFrom=items.length;
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
    items.push({...r.item, raw:e.t, specResolved:true,
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
  if(ctx.size || ctx.threadLen || ctx.qty){
    const wantsThread=wqaThreadEnds(common.product)>0;
    const ctxTL=ctx.threadLen ? (ctx.threadLen2?ctx.threadLen+'/'+ctx.threadLen2:ctx.threadLen) : '';
    items.forEach(it=>{
      if(!it.M && ctx.size){ it.M=ctx.size; it.conf.size=WQA_CONF.INHERITED; }
      if(!it.TL && ctxTL && wantsThread){ it.TL=ctxTL; it.conf.threadLen=WQA_CONF.INHERITED; }
      /* "All Qty 20 pcs/each size" is one quantity for every row, exactly as a
         diameter or a thread stated once is. */
      if((it.qty==null||it.qty==='') && ctx.qty){ it.qty=ctx.qty; it.conf.qty=WQA_CONF.INHERITED; }
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
  return {common:norm.common, rows:norm.rows, skipped, risky, numeric, unread};
}

/* Everything the LAST source told us that is not a row: the accessory wording
   it mentioned, and the customer-label-vs-geometry note. It belongs to that
   source and to nothing else, so every fresh Parse and every fresh Analyze
   throws it away before reading the new one. Leaving it behind is how a
   previous drawing's "5 Nuts + 2 FW" came to sit over an unrelated inquiry. */
function wqaClearSourceEvidence(){ wqa.aiWarnings=[]; wqa.aiMeta=null; }

/* ── review UI ─────────────────────────────────────────────────────────── */
function wqaOpen(){
  /* Every session starts from the same clean slate — product, material, finish
     and size type come from the pasted text or from the user inside this modal,
     never from the calculator form and never from a previous session. */
  wqaResetState();
  openModal('wqaModal');
  setTimeout(()=>{try{el('wqaInput').focus()}catch(e){}},80);
}
/* ── AI photo / PDF extraction (Quick Add V2.1) ────────────────────────────
   The AI only extracts. Its raw wording is pushed through the SAME business
   rules the text parser uses (wqaDetectCommon owns 4140/G8.8 defaults and all
   aliases), and the resulting rows flow into the normal review -> Add path.
   The browser never talks to OpenAI: uploads go to ai_extract.php, which holds
   the key server-side and deletes the temp file immediately. */
const WQA_AI_MAX_IMG = 10*1048576, WQA_AI_MAX_PDF = 20*1048576;

/* paste | upload | choose. "choose" is the input-choice view: it hides the two
   panes without touching what is in them, so coming back finds the pasted text
   and the selected file exactly as they were. Only Cancel and the X discard. */
function wqaSetMethod(m){
  const choose = m==='choose';
  wqa.method = choose ? 'choose' : (m==='upload' ? 'upload' : 'paste');
  const up = wqa.method==='upload';
  el('wqaChoicePane').hidden  = !choose;
  el('wqaMethodTabs').hidden  = choose;
  el('wqaChooseBtn').hidden   = choose;
  el('wqaPastePane').hidden   = choose || up;
  el('wqaUploadPane').hidden  = choose || !up;
  el('wqaParseBtn').hidden    = choose || up;
  el('wqaAnalyzeBtn').hidden  = choose || !up;
  el('wqaTabPaste').classList.toggle('is-on', !up && !choose);
  el('wqaTabUpload').classList.toggle('is-on', up);
  wqaAbandonAi();                     // leaving the pane ends any analysing state
  wqaUpdateAiPane();
  wqaMsg('wqaParseMsg','',false); wqaMsg('wqaAiMsg','',false);
}
/* ── The analysing state ────────────────────────────────────────────────────
   It exists only while a request is actually in flight. ONE function owns the
   spinner, the message and the button, so no path can leave a spinner spinning
   over a pane with no file in it. Every abandonment — a replaced file, a tab
   switch, a reset — also retires the in-flight request's token, so a late
   response can never write over newer state. */
function wqaSetAiBusy(on){
  wqa.aiBusy=!!on;
  const s=el('wqaAiStatus'); if(s) s.hidden=!on;
  wqaUpdateAiPane();
}
function wqaAbandonAi(){
  wqa._aiReq=(wqa._aiReq||0)+1;          // any answer still coming is now stale
  wqa.aiBusy=false;
  const s=el('wqaAiStatus'); if(s) s.hidden=true;
}
function wqaClearAiFile(rerender){
  if(wqa.aiPreviewUrl){ try{ URL.revokeObjectURL(wqa.aiPreviewUrl); }catch(e){} }
  wqa.aiFile=null; wqa.aiPreviewUrl=''; wqa.aiIsPdf=false;
  wqa._dragDepth=0; wqaDragPaint(false); wqaDropBad(false);
  wqaAbandonAi();
  if(rerender!==false) wqaUpdateAiPane();
}
/* ── Drag & drop ───────────────────────────────────────────────────────────
   Dropping a file does exactly what Choose File does — same validation, same
   preview, same Analyze button. It never uploads on its own: the user still
   presses Analyze, so a mis-drop costs nothing.

   dragenter/dragleave fire for every child element the pointer crosses, so the
   highlight is driven by a depth counter rather than by the last event seen. */
function wqaDragPaint(on){ const z=el('wqaDropZone'); if(z) z.classList.toggle('is-drag',!!on); }
function wqaDropBad(on){   const z=el('wqaDropZone'); if(z) z.classList.toggle('is-bad',!!on); }
function wqaDragEnter(e){
  e.preventDefault(); e.stopPropagation();
  wqa._dragDepth=(wqa._dragDepth||0)+1;
  wqaDragPaint(true);
}
function wqaDragOver(e){
  /* Without this preventDefault the browser refuses the drop and opens the file
     in the tab instead, taking the whole Quick Add session with it. */
  e.preventDefault(); e.stopPropagation();
  if(e.dataTransfer) try{ e.dataTransfer.dropEffect='copy'; }catch(err){}
}
function wqaDragLeave(e){
  e.preventDefault(); e.stopPropagation();
  wqa._dragDepth=Math.max(0,(wqa._dragDepth||0)-1);
  if(!wqa._dragDepth) wqaDragPaint(false);
}
function wqaDrop(e){
  e.preventDefault(); e.stopPropagation();
  wqa._dragDepth=0; wqaDragPaint(false);
  const dt=e.dataTransfer, files=(dt&&dt.files)||null;
  if(!files || !files.length){
    wqaRejectFile(dcT('wqaDropNoFile'));
    return;
  }
  /* One file per analysis, unchanged from V2.1: extras are ignored rather than
     queued, and a second drop replaces the first selection outright. */
  const many=files.length>1;
  wqaAcceptFile(files[0]);
  if(many && wqa.aiFile) wqaMsg('wqaAiMsg','One file per analysis — using '+wqa.aiFile.name+'.',false);
}
/* Rejection is shared so the picker and the drop zone fail identically. */
function wqaRejectFile(msg){
  if(el('wqaFileInput')) el('wqaFileInput').value='';
  wqaDropBad(true);
  wqaUpdateAiPane();
  wqaMsg('wqaAiMsg',msg,true);
}
/* The single entry point for a chosen file, whichever way it arrived. These are
   the same client rules as before; the server re-validates from content and
   remains the authority. */
function wqaAcceptFile(f){
  /* A note describes the drawing it was typed against. Swapping the file makes
     it a note about something else, so it goes with the file it belonged to. */
  if(wqa.aiFile) wqaClearNote();
  wqaClearAiFile(false);              // revokes the previous object URL
  wqaMsg('wqaAiMsg','',false);
  if(!f){ wqaUpdateAiPane(); return; }
  const isPdf = f.type==='application/pdf' || /\.pdf$/i.test(f.name);
  const isImg = /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
  if(!isPdf && !isImg){ wqaRejectFile(dcT('errUnsupportedType')); return; }
  if(isPdf && f.size>WQA_AI_MAX_PDF){ wqaRejectFile(dcT('errPdfTooLarge')); return; }
  if(!isPdf && f.size>WQA_AI_MAX_IMG){ wqaRejectFile(dcT('errImgTooLarge')); return; }
  wqa.aiFile=f; wqa.aiIsPdf=isPdf;
  if(!isPdf){ try{ wqa.aiPreviewUrl=URL.createObjectURL(f); }catch(e){ wqa.aiPreviewUrl=''; } }
  /* Clear the picker after a drop so it cannot hold a stale file: re-picking
     that same file later would otherwise fire no change event and silently
     leave the dropped one selected. The File object above is already captured.*/
  if(el('wqaFileInput')) el('wqaFileInput').value='';
  wqaUpdateAiPane();
}
function wqaFileChosen(input){
  wqaAcceptFile(input.files && input.files[0]);
}
/* The note belongs to THIS analysis: it describes the file on screen. */
function wqaNoteInput(){
  const e=el('wqaAiNote');
  wqa.aiNote = e ? String(e.value||'') : '';
  const read=el('wqaAiNoteRead');
  if(read){
    const bits=wqaNoteSummary(wqa.aiNote);
    read.hidden=!bits.length;
    read.textContent=bits.length ? dcT('wqaNoteRead')+' '+bits.join(' · ') : '';
  }
}
function wqaClearNote(){
  wqa.aiNote='';
  if(el('wqaAiNote'))     el('wqaAiNote').value='';
  if(el('wqaAiNoteRead')){ el('wqaAiNoteRead').hidden=true; el('wqaAiNoteRead').textContent=''; }
}
function wqaFmtBytes(n){ return n>=1048576 ? (n/1048576).toFixed(1)+' MB' : Math.max(1,Math.round(n/1024))+' KB'; }
function wqaUpdateAiPane(){
  const info=el('wqaFileInfo'), box=el('wqaAiPreviewBox'), img=el('wqaAiPreview'),
        chip=el('wqaAiPdfChip'), pname=el('wqaAiPdfName'), btn=el('wqaAnalyzeBtn');
  if(info) info.textContent = wqa.aiFile ? (wqa.aiFile.name+' · '+wqaFmtBytes(wqa.aiFile.size)) : dcT('wqaNoFile');
  /* Read from the file that is selected RIGHT NOW, never from what was shown
     before: an image gets the preview and no badge, a PDF gets the badge and no
     preview, and replacing one with the other swaps both in the same pass. */
  const showImg=!!wqa.aiFile && !wqa.aiIsPdf && !!wqa.aiPreviewUrl;
  const showPdf=!!wqa.aiFile && !!wqa.aiIsPdf;
  if(img){ img.hidden=!showImg; img.src=wqa.aiPreviewUrl||''; }
  if(chip)  chip.hidden=!showPdf;
  if(pname) pname.textContent = showPdf ? wqa.aiFile.name : '';
  if(box)   box.hidden = !(showImg||showPdf);
  if(btn) btn.disabled = !wqa.aiFile || !!wqa.aiBusy;
}
/* A file dropped ANYWHERE else in the modal would navigate the tab to it and
   destroy the session, so the default is refused across the whole modal while
   it is open. The zone's own handlers run first and are left alone. */
['dragover','drop'].forEach(evt=>document.addEventListener(evt,e=>{
  const m=el('wqaModal');
  if(!m || !m.classList.contains('open')) return;
  const t=e.target;
  if(t && t.closest && t.closest('#wqaDropZone')) return;
  e.preventDefault();
  if(evt==='drop'){ wqa._dragDepth=0; wqaDragPaint(false); }
}));
async function wqaAnalyze(){
  wqaClearSourceEvidence();          // this file's evidence only, never the last one's
  if(!wqa.aiFile || wqa.aiBusy) return;               // no double-submit
  const token=(wqa._aiReq=(wqa._aiReq||0)+1);
  wqaSetAiBusy(true);
  wqaMsg('wqaAiMsg','',false);
  try{
    const fd=new FormData(); fd.append('file', wqa.aiFile, wqa.aiFile.name);
    /* Supplemental context for the model — it may genuinely help it read the
       drawing. It is NOT how the override is enforced: that happens in our own
       code, after the answer comes back. Sent only when there is one, so a
       blank note leaves the request byte-identical to before. */
    const note=String(wqa.aiNote||'').trim();
    if(note) fd.append('note', note);
    const res=await fetch('ai_extract.php',{method:'POST',body:fd});
    let j=null; try{ j=await res.json(); }catch(e){}
    if(token!==wqa._aiReq) return;                     // superseded while in flight
    if(!j || !j.ok){
      wqaMsg('wqaAiMsg',dcServerError(j),true);
      return;                                          // file stays selected for a retry
    }
    await wqaAiApply(j.data);
  }catch(e){
    if(token!==wqa._aiReq) return;
    wqaMsg('wqaAiMsg',dcT('wqaMsgCannotAnalyze'),true);
  }finally{
    if(token===wqa._aiReq) wqaSetAiBusy(false);
  }
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
  const word={SAG_ROD:'SAG ROD',STUD:'STUD',ANCHOR_BOLT:'ANCHOR BOLT',L_BOLT:'L BOLT'};

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
  const common=wqaDetectCommon(wording);
  common.product=prod;

  const ends=wqaThreadEnds(prod);
  /* The same context that licences R12 -> M12 when a line is read: a rod
     product, or an undersize note. Owned here so a photo and a paste
     standardise identically. */
  const rodSize=ends>0 || common.sizeType==='UNDERSIZE';
  const inh={M:'',TL:''};
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
    if(it.ID!=null&&it.ID!==''&&it.S!=null&&it.S!==''&&rowProd!=='jbolt') rowProd='jbolt';
    else if(it.W!=null&&it.W!==''&&(rowProd==='anchorbolt'||rowProd==='sagrod'||!rowProd)) rowProd='lbolt';

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
    const spec = it.specResolved ? {
      material:String(it.materialValue||''), finish:String(it.finishValue||''),
      sizeType:String(it.sizeTypeValue||''),
    } : {
      material: (own&&own.material) || common.material || '',
      finish:   (own&&own.finish)   || common.finish   || '',
      sizeType: (own&&own.sizeType) || common.sizeType || '',
    };
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

    /* Ours, not the customer's — and said so. */
    let stDefaulted=false;
    if(!spec.sizeType){
      const def=wqaDefaultSizeType(spec.material,M);
      if(def){ spec.sizeType=def; stDefaulted=true; }
    }
    /* And then the hard rule, over both the customer's wording and our own
       default: a Stud has no size type at all. A 4140 QT stud does not become
       fullsize because 4140 usually is. */
    if(!dcProductHasSizeType(rowProd)){ spec.sizeType=''; stDefaulted=false; }

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
               /* Read from the customer, priced from by nothing: the schema has
                  no pitch and no thread-series field, and inventing one from
                  these would be worse than showing them as what they are. */
               pitch:(it.pitch==null||it.pitch==='')?'':String(it.pitch),
               series:(it.series==null||it.series==='')?'':String(it.series),
               length:(it.L==null||it.L==='')?'':String(it.L),
               w:(it.W==null||it.W==='')?'':String(it.W),
               h:(it.H==null||it.H==='')?'':String(it.H),
               id:(it.ID==null||it.ID==='')?'':String(it.ID),
               s:(it.S==null||it.S==='')?'':String(it.S),
               threadLen:tl.a, threadLen2:tl.b,
               qty:(it.qty==null||it.qty==='')?'':String(it.qty),
               material:spec.material, finish:spec.finish, sizeType:spec.sizeType,
               stDefaulted,
               matFrom: it.matFrom || ((own&&own.materialDefaulted)?own.materialDefaultedFrom:'')
                        || (spec.material===common.material ? (common.materialDefaultedFrom||'') : ''),
               matDefaulted: it.matDefaulted!==undefined ? !!it.matDefaulted
                            : ((own&&own.materialDefaulted) || (spec.material===common.material && !!common.materialDefaulted)),
               issues, defaulted, conf, aiUncertain:[],
               raw: it.raw!=null ? String(it.raw)
                    : [it.M,it.L,it.TL,(it.qty!=null?it.qty+'pcs':null)].filter(v=>v!=null).join(' x ')};

    if(row.size   && conf.size===undefined)      conf.size=WQA_CONF.DETECTED;
    if(row.length && conf.length===undefined)    conf.length=WQA_CONF.DETECTED;
    if(row.threadLen && conf.threadLen===undefined) conf.threadLen=WQA_CONF.DETECTED;
    if(row.qty)   { if(conf.qty===undefined) conf.qty=WQA_CONF.DETECTED; }
    else          conf.qty=WQA_CONF.UNCERTAIN;   // optional: recorded, not an issue

    /* A + B + C did not reconcile with the overall length: surfaced for a human
       look, never silently corrected and never dropped. */
    if(it.Bbad) row.aiUncertain.push('segments vs length');
    /* The extractor could not read something on this row and said so. It is a
       note for a person, never a value: whatever it names is null, and the row
       asks for it in the ordinary way. */
    if(it.unclear) row.aiUncertain.push(String(it.unclear).slice(0,40));
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

/* Turn the compact extraction into Quick Add state. AI output is NOT final
   truth: it goes through wqaNormalizeExtraction, the very same normaliser the
   deterministic text parser feeds, so bare 4140 / G8.8 default to 4140 QT,
   aliases resolve, thread representation follows the product, and nothing
   bypasses the business rules. Pricing, weight and accessories all run in the
   existing calculator, never in the model. */
async function wqaAiApply(d, msgTarget){
  /* The photo/PDF path writes into the upload pane; the paste fallback writes
     into the paste pane. Default keeps the image path byte-identical. */
  const MT = msgTarget || 'wqaAiMsg';
  /* Geometry-classified by the model, then held to what Quick Add can actually
     price. A null product means the document genuinely does not say — the review
     opens and asks, which is safer than assuming Sag Rod. */
  const norm = wqaNormalizeExtraction(d, {inheritGaps:true});
  if(!norm.ok){
    const e=norm.error||{};
    if(e.code==='unsupported')     wqaMsg(MT,dcT('wqaMsgUnsupported').replace('{p}',e.word||''),true);
    else if(e.code==='no_product') wqaMsg(MT,dcT('wqaMsgNoProduct'),true);
    else                           wqaMsg(MT,dcT('wqaMsgNoRows'),true);
    return false;
  }
  /* Drawings routinely show standard assembly hardware that the quotation may
     not include, so the wording is reported and nothing is enabled: no nut, no
     washer, no quantity, no price. Accessories stay entirely manual. */
  /* The extraction came from the AI endpoint and is about to become the rows,
     so this session is genuinely AI-assisted. Set here rather than in wqaAnalyze
     because a call that fails or returns nothing usable never reaches this line
     — the badge reflects a result that was USED, not merely a request sent. */
  wqa.aiAssisted = true;
  wqa.aiWarnings = d.note
    ? ['Document mentions: '+d.note+' — accessories are never added automatically. Add them yourself if this quotation includes them.']
    : [];
  /* ── Manual wins ────────────────────────────────────────────────────────
     Deterministic, and deliberately AFTER the model has answered: the person
     typing "H 530" has looked at the drawing and decided. No confidence is
     compared and the model is not asked to arbitrate — a field the note names
     is simply the note's value. A blank note does nothing at all. */
  const noteText=String((msgTarget==='wqaParseMsg') ? '' : (wqa.aiNote||'')).trim();
  if(noteText){
    const res=wqaApplyNoteFacts(norm.rows,noteText);
    /* The header says what the rows say — re-read after the merge, exactly as
       the normaliser does at the end of its own pass. */
    WQA_ROW_SPEC.forEach(k=>{ const v=wqaRowsCommonValueOf(norm.rows,k);
                              if(v!==WQA_MIXED) norm.common[k]=v; });
    if(res.applied) wqa.aiWarnings.push(dcT('wqaNoteUsed').replace('{n}',res.applied));
    /* Typed and used by nothing: said once, plainly, rather than left to be
       discovered when the quotation is already out. */
    if(res.skipped.length) wqa.aiWarnings.push(dcT('wqaNoteUnused'));
  }
  /* A pasted message that the parser handed to the AI is still the customer's
     own words, so it stays a TEXT source. An upload has no trustworthy
     transcript — a filename is not what the customer said — so it is a FILE
     source and the panel names the file instead of inventing a transcript. */
  const fromText = !!msgTarget && msgTarget==='wqaParseMsg';
  await wqaEnterReview(norm.common, norm.rows,
                       fromText ? (wqa.aiRaw||'') : ('[uploaded] '+(wqa.aiFile?wqa.aiFile.name:'file')),
                       [], 'ai', fromText ? 'text' : 'file');
  return true;
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

/* Only reached when the parser could not read the message. One call, never in
   parallel with the parser, and never on a paste the parser handled. */
async function wqaTextFallback(text){
  if(wqa.aiBusy) return;
  wqa.aiBusy = true;
  const btn = el('wqaParseBtn');
  if(btn) btn.disabled = true;
  wqaMsg('wqaParseMsg', dcT('wqaTextAnalyzing'), false);
  try{
    const fd = new FormData();
    fd.append('text', text);                    // the key never leaves the server
    const res = await fetch('ai_extract.php',{method:'POST',body:fd});
    let j=null; try{ j=await res.json(); }catch(e){}
    if(!j || !j.ok || !j.data){
      /* Deliberately NOT dcServerError(): those messages are written for the
         file path ("Could not analyze this file"), which reads wrong under a
         pasted message. One clean line for every fallback failure, and the
         pasted text is left exactly as the customer sent it. */
      wqaMsg('wqaParseMsg', dcT('wqaCannotRead'), true);
      return;
    }
    wqa.aiRaw = text;                           // review keeps the original message
    const applied = await wqaAiApply(j.data, 'wqaParseMsg');
    if(applied) wqaMsg('wqaParseMsg','',false);
  }catch(e){
    wqaMsg('wqaParseMsg', dcT('wqaCannotRead'), true);
  }finally{
    wqa.aiBusy = false;
    if(btn) btn.disabled = false;
  }
}

/* ── Safe close ────────────────────────────────────────────────────────────
   Quick Add can hold a lot of unsaved work, so it closes only through the X or
   Cancel, and only after a confirmation when there is anything to lose. State
   survives everything else — a backdrop click cannot touch it. */
function wqaIsDirty(){
  const pasted=String((el('wqaInput')&&el('wqaInput').value)||'').trim();
  if(pasted) return true;                                   // pasted text
  if(wqa.aiFile) return true;                               // a selected upload
  if(wqa.rows&&wqa.rows.length) return true;                /* parsed items, and
     with them every edit made on top: dimensions, material / finish / size
     type, pricing entry, accessories, removed rows, Use Last Price */
  return false;
}
/* The ONLY definition of a clean Quick Add session. Both reset paths — a
   confirmed Discard and a successful Add — and opening the modal all call this,
   so there is no second copy to drift out of step (which is what let a
   discarded session come back).

   It clears three kinds of state, not just the first:
     · the session object          parsed rows, common fields, pricing,
                                   accessories, view, panels, skipped lines
     · anything still in flight    debounce timers and the price-history fetch,
                                   via a session token the async work checks
     · what was already rendered   the row list, the common panels, the column
                                   header, the counters and the Add button   */
function wqaResetState(){
  wqa.session=(wqa.session||0)+1;          // invalidates any in-flight async work
  clearTimeout(wqa._t); clearTimeout(wqa._ta); clearTimeout(wqa._tm);
  wqa._t=wqa._ta=wqa._tm=null;
  wqa._deferred={};

  wqa.raw=''; wqa.rows=[]; wqa.product=null; wqa.common={}; wqa.source='paste';
  /* Both source states, and which of them the Review is showing. */
  wqa.textSource=''; wqa.fileSource=null; wqa.srcKind='text';
  wqa.commonItem=wqaEmptyItem();
  /* A queued correction belongs to the message it was queued for. */
  wqa.commonFix=wqaEmptyFix();
  wqa.commonAcc=wqaEmptyAcc(); wqa.commonPrice=wqaEmptyPrice();
  wqa.panels={source:false,fix:false,item:false,price:false,acc:false}; wqa.view='compact';
  wqa.applyScope='all';
  wqa.skipped=[]; wqa.busy=false;

  /* AI upload session state — the selected/dropped file, its name, its preview,
     the object URL behind that preview, the drag-over highlight and any upload
     error all belong to the session and go with it. */
  wqaClearAiFile(false);                       // revokes the object URL, clears drag + error state
  wqa.aiBusy=false; wqa.aiMeta=null; wqa.aiWarnings=[];
  wqaClearNote();
  /* A new Quick Add session is never AI-assisted until it earns it again. */
  wqa.aiAssisted=false; wqa.aiRaw='';
  if(el('wqaAiBadge')) el('wqaAiBadge').hidden=true;
  wqa.method='paste';
  if(el('wqaFileInput'))   el('wqaFileInput').value='';
  if(el('wqaFileInfo'))    el('wqaFileInfo').textContent=dcT('wqaNoFile');
  if(el('wqaAiPreviewBox')) el('wqaAiPreviewBox').hidden=true;
  if(el('wqaAiPreview')){  el('wqaAiPreview').src=''; el('wqaAiPreview').hidden=true; }
  if(el('wqaAiPdfChip'))   el('wqaAiPdfChip').hidden=true;
  if(el('wqaAiPdfName'))   el('wqaAiPdfName').textContent='';
  if(el('wqaDropZone'))    el('wqaDropZone').classList.remove('is-drag','is-bad');
  if(el('wqaAiStatus'))    el('wqaAiStatus').hidden=true;
  wqaMsg('wqaAiMsg','',false);
  if(el('wqaPastePane'))   el('wqaPastePane').hidden=false;
  if(el('wqaUploadPane'))  el('wqaUploadPane').hidden=true;
  if(el('wqaParseBtn'))    el('wqaParseBtn').hidden=false;
  if(el('wqaAnalyzeBtn')){ el('wqaAnalyzeBtn').hidden=true; el('wqaAnalyzeBtn').disabled=true; }
  if(el('wqaTabPaste'))    el('wqaTabPaste').classList.add('is-on');
  if(el('wqaTabUpload'))   el('wqaTabUpload').classList.remove('is-on');

  ['wqaRows','wqaSource','wqaCommon','wqaCommonItem','wqaCommonPrice','wqaCommonAcc','wqaListHead']
    .forEach(id=>{ const n=el(id); if(n) n.innerHTML=''; });
  /* The message panel is hidden as well as emptied, so a new session never
     opens on an empty frame where the last customer's words were. */
  const src=el('wqaSource');  if(src) src.hidden=true;
  const lh=el('wqaListHead'); if(lh) lh.hidden=true;
  const rows=el('wqaRows');   if(rows) rows.classList.remove('has-head');
  const vc=el('wqaViewCompact'), ve=el('wqaViewExpanded');
  if(vc) vc.classList.add('is-on');
  if(ve) ve.classList.remove('is-on');

  if(el('wqaInput'))     el('wqaInput').value='';
  if(el('wqaConfirm'))   el('wqaConfirm').hidden=true;
  if(el('wqaRowsCount')) el('wqaRowsCount').textContent=dcT('nItems').replace('{n}',0);
  if(el('wqaFootTotal')) el('wqaFootTotal').textContent=dcT('nItems').replace('{n}',0);
  if(el('wqaFootNeed')){ el('wqaFootNeed').textContent=''; el('wqaFootNeed').hidden=true; }
  if(el('wqaAddBtn')){ el('wqaAddBtn').disabled=true;
                       el('wqaAddBtn').textContent=dcT('wqaAddItems'); }
  wqaMsg('wqaParseMsg','',false);
  if(el('wqaStep1')) el('wqaStep1').hidden=false;
  if(el('wqaStep2')) el('wqaStep2').hidden=true;
}
function wqaRequestClose(){
  if(!wqaIsDirty()){ wqaHardClose(); return; }
  el('wqaConfirm').hidden=false;
  setTimeout(()=>{ try{ el('wqaKeepBtn').focus(); }catch(e){} },30);
}
function wqaCancelClose(){ el('wqaConfirm').hidden=true; }
function wqaConfirmDiscard(){ el('wqaConfirm').hidden=true; wqaHardClose(); }
/* The ONLY path that clears state: confirmed discard, or a successful add. */
function wqaHardClose(){ wqaResetState(); closeModal('wqaModal'); }
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  const m=el('wqaModal');
  if(!m||!m.classList.contains('open')) return;
  e.preventDefault(); e.stopPropagation();
  if(el('wqaConfirm')&&!el('wqaConfirm').hidden){ wqaCancelClose(); return; }  // ESC = keep editing
  wqaRequestClose();
});
/* One entry into the review step, shared by the text parser and the AI
   extraction path, so both get identical row shape, rendering and recompute. */
async function wqaEnterReview(common, rows, rawText, skipped, source, srcKind){
  wqa.raw=rawText; wqa.product=common.product||'';
  wqa.source=source||'paste';
  /* Text unless the caller says otherwise, and the file is captured HERE, from
     the file that produced these very rows — so replacing image A with image B
     replaces what Review names, and a PDF followed by an image leaves no PDF
     behind. */
  wqa.srcKind = srcKind==='file' ? 'file' : 'text';
  if(wqa.srcKind==='file'){
    wqa.fileSource = wqa.aiFile
      ? {name:String(wqa.aiFile.name||''), pdf:!!wqa.aiIsPdf} : null;
  } else {
    wqa.textSource = String(rawText||'');
  }
  wqa.common={...common};
  wqa.rows=rows.map(r=>({...r,acc:null,accOpen:false,priceMode:'auto',useLastPrice:false,manualPrice:'',
                         priceOverride:{},history:undefined,removed:false}));
  wqa.skipped=skipped||[];
  el('wqaStep1').hidden=true; el('wqaStep2').hidden=false;
  wqa.panels.source=wqaSourceOpenDefault();
  wqaRenderSource(true);
  wqaRenderCommon();
  wqaRenderCommonFix(true);
  wqaRenderAiBadge();
  /* Opened by default when anything is actually missing — on a shorthand photo
     that is every row, and this panel is the one-action fix. */
  wqa.panels.item = wqaItemNeedCount() > 0;
  wqaRenderCommonItem(true);
  wqaRenderCommonPrice();
  wqaRenderCommonAcc();
  await wqaRecomputeAll();
}

/* ── The customer's message during Review ──────────────────────────────────
   Staff read the parsed rows against what the customer actually wrote, so the
   source stays on screen instead of hiding behind a button. It is shown only
   where the text IS the customer's own message: a paste, or the AI text
   fallback, which is that same paste. A photo or a PDF has no trustworthy
   transcript — "[uploaded] drawing.png" is a filename, not what the customer
   said — so the panel stays away and the Back button takes its place. Nothing
   is fetched or generated to fill it. */
/* Which source these rows came from — and it is the ONLY thing the panel may
   read. The pasted text and the uploaded file are kept apart on purpose: they
   both survive a trip back to Choose Input, so neither is lost by switching,
   but a Review built from a photograph must never show the message someone
   pasted before it. That is what made an image extraction look as though the
   AI had read the wrong document. */
function wqaSourceText(){
  return wqa.srcKind==='file' ? '' : String(wqa.textSource||'');
}
/* A phone opens it closed: a long message would otherwise be the whole screen
   before a single row. Everything wider opens it expanded. */
function wqaSourceOpenDefault(){
  try{ return !window.matchMedia('(max-width:640px)').matches; }catch(e){ return true; }
}
function wqaRenderSource(force){
  const box=el('wqaSource'), back=el('wqaBackBtn');
  if(!box) return;
  /* A file source gets a one-line panel: what was read, by name. No transcript
     is shown, because none was captured — nothing is fetched or generated to
     fill it, and it is never labelled as the customer's message. */
  if(wqa.srcKind==='file' && wqa.fileSource){
    const f=wqa.fileSource;
    box.hidden=false;
    box.innerHTML=`<div class="wqa-file-src">
        <span class="wqa-file-lbl" data-i18n="wqaSourceFile">${escHtml(dcT('wqaSourceFile'))}</span>
        <span class="wqa-file-chip">${escHtml(f.pdf?'PDF':dcT('wqaImage'))}</span>
        <span class="wqa-file-name">${escHtml(f.name||'')}</span>
        <button type="button" class="btn btn-outline btn-sm" onclick="wqaBackToPaste()"
                data-i18n="wqaBackToUpload">${escHtml(dcT('wqaBackToUpload'))}</button>
      </div>`;
    if(back) back.hidden=true;
    return;
  }
  const txt=wqaSourceText();
  if(!txt.trim()){
    box.hidden=true; box.innerHTML='';
    /* No panel: the Back button is the only way back to the upload step, so it
       stays — relabelled, because there is nothing pasted to edit. */
    if(back){ back.hidden=!(wqa.rows&&wqa.rows.length);
              back.setAttribute('data-i18n','wqaBackToUpload');
              back.textContent=dcT('wqaBackToUpload'); }
    return;
  }
  if(back) back.hidden=true;
  if(!force && wqaTypingIn(box)) return;
  const lines=txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const summary=dcT('wqaSourceLines').replace('{n}',lines.length);
  box.hidden=false;
  box.innerHTML = wqaPanelHead('source',dcT('wqaSourceTitle'),summary,'')
    + (!wqa.panels.source ? '' :
       `<div class="wqa-panel-body">
          <pre class="wqa-source-text">${escHtml(txt)}</pre>
          <div class="wqa-source-actions">
            <button type="button" class="btn btn-outline btn-sm" onclick="wqaBackToPaste()"
                    data-i18n="wqaSourceEdit">${escHtml(dcT('wqaSourceEdit'))}</button>
          </div>
        </div>`);
}
/* Language switches redraw it, so the title and the line count follow. */
dcOnRelabel(()=>{ try{ if(el('wqaStep2')&&!el('wqaStep2').hidden) wqaRenderSource(true); }catch(e){} });

/* The flag is the single source of truth, so a deterministic parse simply
   never shows it. */
function wqaRenderAiBadge(){
  const b=el('wqaAiBadge');
  if(b) b.hidden = !wqa.aiAssisted;
}
function wqaBackToPaste(){ el('wqaStep2').hidden=true; el('wqaStep1').hidden=false; }
function wqaMsg(id,text,warn){
  const b=el(id); if(!b) return;
  b.textContent=text; b.hidden=!text;
  b.classList.toggle('wqa-msg-warn',!!warn);
}

async function wqaParseAndReview(){
  const text=el('wqaInput').value||'';
  if(!text.trim()){ wqaMsg('wqaParseMsg',dcT('wqaMsgPasteFirst'),true); return; }
  wqaMsg('wqaParseMsg','',false);
  wqaClearSourceEvidence();
  let parsed=wqaParseText(text);
  /* A message that never names its product is still readable — the review screen
     already asks for one, exactly as it does for an extracted photo. Re-read the
     dimensions under the most general shape rather than refusing outright, and
     leave product blank so nothing is invented. Picking a product in review
     re-parses the same text under that product's rules. */
  /* Only when NOTHING said which product — not when the rows disagree. A mixed
     document has no single product at the top on purpose, and re-reading it
     under one shape would flatten exactly the distinction it was making. */
  if(!parsed.common.product && !parsed.rows.some(r=>r.product)){
    const probe=wqaParseText(text,'sagrod');
    if(probe.rows.length){
      /* The shape was borrowed to read the dimensions; the product was NOT.
         Everything the borrowed shape INVENTED is given back: the product, and
         a thread pair that exists only because a Sag Rod has two ends. A single
         "thread 100" under an unknown product is a number whose end nobody has
         established, so it is left for Review to place rather than shown as
         100/100. A pair the customer actually wrote is kept — it is in the
         message. */
      const wrotePair=/\d\s*\/\s*\d/.test(text);
      parsed={...probe, common:{...probe.common, product:''},
              rows:probe.rows.map(r=>({...r, product:'',
                ...(r.threadLen && r.threadLen===r.threadLen2 && !wrotePair
                    ? {threadLen:'', threadLen2:''} : {})}))};
    }
  }
  const q=wqaParseQuality(parsed,text);
  if(q.ok){
    /* Parser understood it. No AI call, no badge, no cost. */
    await wqaEnterReview(parsed.common, parsed.rows, text, parsed.skipped);
    return;
  }
  await wqaTextFallback(text);
}

/* Without a blank option the browser selects the FIRST material, so a document
   that never named one still showed a real material sitting in the box — and
   the quotation was committed in it without anyone choosing it. A value nobody
   stated is shown as missing, never as chosen. */
function wqaMaterialOptions(sel,type){
  const src=el((type||wqa.product)+'-material');
  if(!src) return '';
  if(sel===WQA_MIXED)
    return `<option value="${escHtml(WQA_MIXED)}" selected>${escHtml(dcT('wqaMixed'))}</option>`
      + [...src.options].map(o=>`<option value="${escHtml(o.value)}">${escHtml(o.text)}</option>`).join('');
  const known=[...src.options].some(o=>o.value===sel);
  return (known?'':`<option value="" selected>${escHtml(dcT('optRequired'))}</option>`)
    + [...src.options].map(o=>`<option value="${escHtml(o.value)}"${o.value===sel?' selected':''}>${escHtml(o.text)}</option>`).join('');
}
function wqaRenderCommon(){
  const c=wqa.common;
  /* Rows can hold different products, so the header summarises them exactly as
     it does material and finish: the shared one, or Mixed. Mixed is a fact
     about the rows, not a product anyone can pick. */
  const prodMixed=wqaIsMixed('product');
  const prod=wqaProductByType(prodMixed?'':wqa.product)||WQA_NO_PRODUCT;
  /* A defined mapping, so it reads as information: "HT → 4140 QT". Not a
     warning — the warning styling belongs to a material nobody stated. */
  /* Read from the rows, so it names a substitution that actually happened —
     and once per distinct wording, not once per row. */
  const notes=[];
  wqa.rows.filter(x=>!x.removed&&x.matDefaulted&&x.matFrom&&x.material).forEach(x=>{
    const line=x.matFrom+' → '+materialLabel(x.material);
    if(notes.indexOf(line)<0) notes.push(line);
  });
  if(!notes.length && c.materialDefaulted) notes.push((c.materialDefaultedFrom||'4140')+' → '+materialLabel(c.material));
  const matNote=notes.map(nx=>`<div class="wqa-flag wqa-flag-def">${escHtml(nx)}</div>`).join('');
  /* Mixed is a fact about the rows, not a value anyone can choose. */
  const shownMat=wqaRowsCommonValue('material'), shownFin=wqaRowsCommonValue('finish'),
        shownSt=wqaRowsCommonValue('sizeType');
  const live=wqa.rows.filter(x=>!x.removed);
  /* Every row stainless -> the finish selector says N/A and offers nothing
     else. Mixed stays Mixed: an HDG row beside an N/A row genuinely differs. */
  const allSS=live.length ? live.every(x=>wqaNoFinish(wqaRowSpec(x,'material')))
                          : wqaNoFinish(c.material);
  /* Every row a Stud -> the size type selector says N/A and offers nothing
     else, exactly as the finish selector does for stainless. */
  const allNoSt=live.length ? live.every(x=>!dcProductHasSizeType(wqaRowProduct(x)))
                            : !dcProductHasSizeType(wqa.product);
  const stNeeded=!allNoSt && live.some(x=>{ const p=wqaProductByType(wqaRowProduct(x));
                                return p && p.needSizeType && dcProductHasSizeType(wqaRowProduct(x))
                                       && !wqaRowSpec(x,'sizeType'); })
                 && !wqaIsMixed('sizeType');
  /* Asked for only once the product is known, because the list of materials
     depends on it. Never guessed from the product, the finish or what this
     customer usually orders. */
  const matNeeded=!!wqa.product && !wqaIsMixed('material') &&
                  (live.length ? live.some(x=>!wqaRowSpec(x,'material')) : !c.material);
  const skipNote=(wqa.skipped&&wqa.skipped.length)
    ? `<div class="wqa-flag">${wqa.skipped.length} line(s) not read as items (header/notes). They are ignored.</div>` : '';
  /* Geometry-first classification: when the customer's own wording disagrees
     with the detected product, say so — never hide the conflict. */
  const aiNote=(wqa.aiMeta
    ? `<div class="wqa-flag wqa-flag-def">Customer label: “${escHtml(wqa.aiMeta.src)}” · Detected as: ${escHtml(wqa.aiMeta.det)}</div>` : '')
    + (wqa.aiWarnings&&wqa.aiWarnings.length
    ? wqa.aiWarnings.map(w=>`<div class="wqa-flag">${escHtml(w)}</div>`).join('') : '');
  el('wqaCommon').innerHTML=`
    <div class="wqa-common-grid">
      <div class="field"><label>Product${(prodMixed||wqa.product)?'':' <span class="wqa-req">*</span>'}</label>
        <select id="wqaProduct" class="${(prodMixed||wqa.product)?'':'wqa-needed'}" onchange="wqaChangeProduct(this.value)">
          ${prodMixed?`<option value="${escHtml(WQA_MIXED)}" selected>${escHtml(dcT('wqaMixed'))}</option>`:''}
          ${(prodMixed||wqa.product)?'':`<option value="" selected>${escHtml(dcT('optRequired'))}</option>`}
          ${WQA_PRODUCTS.map(p=>`<option value="${p.type}"${!prodMixed&&p.type===wqa.product?' selected':''}>${p.label}</option>`).join('')}
        </select></div>
      <div class="field"><label>Material${matNeeded?' <span class="wqa-req">*</span>':''}</label>
        <select id="wqaMaterial" class="${matNeeded?'wqa-needed':''}" onchange="wqaSetCommon('material',this.value)">${wqaMaterialOptions(shownMat)}</select></div>
      <div class="field"><label>Finish</label>
        <select id="wqaFinish" onchange="wqaSetCommon('finish',this.value)"${allSS?' disabled':''}>
          ${shownFin===WQA_MIXED?`<option value="${escHtml(WQA_MIXED)}" selected>${escHtml(dcT('wqaMixed'))}</option>`:''}
          <option value=""${shownFin===''?' selected':''}>N/A</option>
          ${allSS?'':['PL','ZP','HDG'].map(v=>`<option value="${v}"${shownFin===v?' selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="field"><label>Size Type${(prod.needSizeType&&!allNoSt)?' <span class="wqa-req">*</span>':''}</label>
        <select id="wqaSizeType" class="${stNeeded?'wqa-needed':''}" onchange="wqaSetCommon('sizeType',this.value)"${allNoSt?' disabled':''}>
          ${shownSt===WQA_MIXED?`<option value="${escHtml(WQA_MIXED)}" selected>${escHtml(dcT('wqaMixed'))}</option>`:''}
          <option value=""${shownSt===''?' selected':''}>${escHtml(allNoSt?'N/A':dcT(prod.needSizeType?'optRequired':'optNone'))}</option>
          ${allNoSt?'':`<option value="FULLSIZE"${shownSt==='FULLSIZE'?' selected':''}>Fullsize</option>
          <option value="UNDERSIZE"${shownSt==='UNDERSIZE'?' selected':''}>Undersize</option>`}
        </select></div>
    </div>
    ${matNote}
    ${(prodMixed||wqa.product)?'':'<div class="wqa-flag wqa-flag-req">The document does not say which product this is, so it is not guessed. Choose the product to price these items.</div>'}
    ${stNeeded?'<div class="wqa-flag wqa-flag-req">'+dcT('sizeTypeRequired').replace('{p}',prod.label)+'</div>':''}
    ${matNeeded?'<div class="wqa-flag wqa-flag-req">'+dcT('materialRequired')+'</div>':''}
    ${skipNote}${aiNote}`;
}
/* Changing the product re-parses the same text under the new product's rules —
   the dimension columns differ between products. */
function wqaChangeProduct(t){
  /* Mixed is not a choice — it is what the rows already say. */
  if(t===WQA_MIXED){ wqaRenderCommon(); return; }
  wqa.product=t;
  /* Choosing a product at the top is a deliberate action by staff, so it is
     applied to the rows in scope — exactly like Apply to All for material.
     Nothing automatic ever overwrites a row's own product. */
  wqaApplyTargets().forEach(r=>{ r.product=t; r.productConflict=null;
    wqaRowRestoreThread(r,t);
    r.sizeType=dcSizeTypeFor(t,r.sizeType); if(!r.sizeType) r.stDefaulted=false; });
  wqa.common.sizeType=dcSizeTypeFor(t,wqa.common.sizeType);
  /* Extracted rows have no source text to re-read — re-parsing "[uploaded]
     file.png" would throw the rows away. They carry their own fields, so the
     product change only needs a recompute. */
  /* The required common fields change with the product — a Stud loses its
     Thread box, a Sag Rod gains a paired one — so the panel is rebuilt and its
     open state re-decided every time. */
  if(wqa.source==='ai'){
    wqaRenderCommon(); wqa.panels.item=wqaItemNeedCount()>0; wqaRenderCommonItem(true);
    wqaRecomputeAll('force'); return;
  }
  /* Same pipeline as the first parse, so header context and inheritance behave
     identically after a product switch. */
  wqa.rows=wqaParseText(wqa.raw,t).rows
    .map(r=>({...r,acc:null,accOpen:false,priceMode:'auto',useLastPrice:false,manualPrice:'',priceOverride:{},history:undefined,removed:false}));
  wqaRenderCommon();
  wqa.panels.item=wqaItemNeedCount()>0; wqaRenderCommonItem(true);
  wqaRecomputeAll();
}
/* Choosing at the top is a staff decision, so it writes THROUGH to the rows —
   to the ticked ones when Apply Selected is on. Mixed is a summary, never a
   choice, so selecting it does nothing. */
function wqaSetCommon(k,v){
  if(v===WQA_MIXED){ wqaRenderCommon(); return; }
  wqa.common[k]=v;
  if(k==='material') wqa.common.materialDefaulted=false;
  if(WQA_ROW_SPEC.indexOf(k)>=0) wqaApplyTargets().forEach(r=>{
    /* A finish cannot be applied to a stainless row, and choosing stainless
       clears the finish that row was carrying. The same for a Stud and its
       size type. */
    if(k==='finish'   && wqaNoFinish(wqaRowSpec(r,'material'))) return;
    if(k==='sizeType' && !dcProductHasSizeType(wqaRowProduct(r))) return;
    r[k]=v; if(k==='material'){ r.matDefaulted=false; r.matFrom='';
                                r.finish=wqaFinishFor(v,r.finish); }
  });
  wqaRenderCommon(); wqaRecomputeAll(); }
/* A row's own product, chosen on its own card. Changing it re-reads that row
   through that product's calculator — nothing else on the list moves. */
/* A thread the message stated, put into the row once the row has somewhere to
   put it. Only ever fills an empty field, and only for a product that has one. */
function wqaRowRestoreThread(r,product){
  const ends=wqaThreadEnds(product);
  if(ends<1 || !r || !r.threadSeen || r.threadLen) return;
  const t=wqaSplitThread(r.threadSeen);
  r.threadLen=t.a;
  r.threadLen2=t.b || (ends===2 ? t.a : '');
}
function wqaEditRowProduct(i,v){
  const r=wqa.rows[i]; if(!r) return;
  r.product=v;
  /* Choosing the product by hand is the answer the conflict was waiting for. */
  r.productConflict=null;
  wqaRowRestoreThread(r,v);
  /* Anchor Bolt -> Stud takes the size type with it. */
  r.sizeType=dcSizeTypeFor(v,r.sizeType); if(!r.sizeType) r.stDefaulted=false;
  wqaRenderCommon();
  wqaRecomputeAll('force');
}
/* ── Inline dimension arithmetic ────────────────────────────────────────────
   "500+30" in a length box becomes 530 on Enter or on leaving the field. A rod
   is often quoted as a wall plus an overhang, and doing that sum in your head
   over twenty rows is where mistakes come from.

   A hand-written recursive-descent evaluator, not eval and not new Function:
   it understands digits, a decimal point, + - * / and brackets, and it cannot
   express anything else. Anything it does not understand is left alone — the
   box keeps what was typed and Review still asks. Division is deliberately
   available here and NOT on a paired thread box, where "100/120" is two ends
   and not a division. */
function wqaCalc(expr){
  const s=String(expr==null?'':expr).replace(/\s+/g,'');
  if(!s || !/^[0-9.+\-*/()]+$/.test(s)) return null;
  if(!/[+\-*/]/.test(s)) return null;            // a plain number needs no maths
  let i=0;
  const peek=()=>s[i];
  const num=()=>{ const st=i; while(i<s.length && /[0-9.]/.test(s[i])) i++;
                  if(i===st) return NaN; const v=Number(s.slice(st,i));
                  return isFinite(v)?v:NaN; };
  const factor=()=>{
    if(peek()==='('){ i++; const v=expr2(); if(peek()!==')') return NaN; i++; return v; }
    if(peek()==='-'){ i++; const v=factor(); return isNaN(v)?NaN:-v; }
    if(peek()==='+'){ i++; return factor(); }
    return num();
  };
  const term=()=>{
    let v=factor();
    while(!isNaN(v) && (peek()==='*'||peek()==='/')){
      const op=s[i++], r=factor();
      if(isNaN(r)) return NaN;
      if(op==='/'&&r===0) return NaN;
      v = op==='*' ? v*r : v/r;
    }
    return v;
  };
  const expr2=()=>{
    let v=term();
    while(!isNaN(v) && (peek()==='+'||peek()==='-')){
      const op=s[i++], r=term();
      if(isNaN(r)) return NaN;
      v = op==='+' ? v+r : v-r;
    }
    return v;
  };
  const out=expr2();
  if(i!==s.length || isNaN(out) || !isFinite(out)) return null;
  return String(Math.round(out*1000)/1000);
}
/* Wired to a dimension input: evaluate, write the answer back, save it. */
function wqaCalcField(inp,i,k){
  const v=wqaCalc(inp.value);
  if(v==null) return;
  inp.value=v;
  wqaEdit(i,k,v);
}
/* One row's own specification, edited from its expanded card. */
function wqaEditRowSpec(i,k,v){
  const r=wqa.rows[i]; if(!r) return;
  if(k==='finish'   && wqaNoFinish(wqaRowSpec(r,'material'))) return;
  if(k==='sizeType' && !dcProductHasSizeType(wqaRowProduct(r))) return;
  r[k]=v; if(k==='material'){ r.matDefaulted=false; r.matFrom='';
                              r.finish=wqaFinishFor(v,r.finish); }
  wqaRenderCommon();                       // the header summary may have moved
  clearTimeout(wqa._t); wqa._t=setTimeout(()=>wqaRecomputeAll('patch'),250);
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
  else if(!isKnownSize(r.size))miss.push('Valid Size');
  /* Read, recognised — and no diameter AS ASKED FOR. There is no undersize M24,
     so an undersized M24 rod cannot be weighed and must not be priced. Skipped
     while the size type itself is still an open question, because THAT is the
     question and a row should only ever be asked one thing at a time. */
  else if(r.noDia && !(prod.needSizeType && dcProductHasSizeType(t) && !wqaRowSpec(r,'sizeType')))
                               miss.push('Valid Size');
  /* Each product asks for its own dimensions, by name: an L Bolt wants L and
     W, a J Bolt wants H, ID and S, and nothing is invented for the ones it
     does not have. */
  (prod.dims||[]).forEach(d=>{
    if(d==='size'||d==='threadLen') return;
    if(!String(r[d]==null?'':r[d]).trim()) miss.push(WQA_DIM_LABEL[d]||d);
  });
  /* Qty is optional in Quick Add: a customer may send lengths with no counts,
     and those are still real items. It is therefore NOT a blocker here. The
     existing calculator still requires a qty of its own to add an item, so a
     blank-qty row is skipped at commit and reported — never defaulted to 1,
     which the calculator does not do either. */
  /* The customer's material or nothing. Every rod is made of something, so a
     blank one means "not stated" — never "mild steel". Asked for only once the
     product is known, since Product is already the blocker until then. */
  if(t && !wqaRowSpec(r,'material')) miss.push('Material');
  if(prod.needSizeType && dcProductHasSizeType(t) && !wqaRowSpec(r,'sizeType')) miss.push('Size Type');
  /* A product that HAS a thread needs one: a Sag Rod as the pair 75/75 or
     50/110, an Anchor Bolt as the single value 100. Product-specific, never one
     rule for all — a Stud has no thread and is never asked for one. */
  if(prod.threadEnds>0 && !wqaThreadValue(r)) miss.push('Thread');
  if(!(parseFloat(r.calc&&r.calc.finalUnitPrice)>0)) miss.push('Price');
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
function wqaIsAsymmetric(r){
  const a=String(r.threadLen||'').trim(), b=String(r.threadLen2||'').trim();
  return !!(a&&b&&a!==b);
}

/* Write a row into the REAL form, run the REAL calc, read the result back.
   This is the whole point: no second pricing engine exists. */
function wqaApplyRowToForm(r){
  const t=wqaRowProduct(r), c=wqa.common;
  productEntryTouchedFields.clear();
  resetAccPanel(t);
  /* Quick Add does not extract custom dimensions, and whatever is sitting in
     the editor belongs to the person's own half-finished item — never to a row
     read out of a customer's message. Staff add them afterwards, by editing the
     committed item. */
  dcClearCustomDims();
  /* THIS row's material, finish and size type — a stainless row is priced as
     stainless even when the row above it is 4140 QT. */
  const rowMat=wqaRowSpec(r,'material')||c.material||'MS';
  setFieldValue(t,'material',rowMat);
  if(fieldExists(t,'sizeType')){
    /* Assigning '' to a select with no blank option would silently leave the
       previous choice in place, so the field is cleared explicitly. */
    const stEl=el(t+'-sizeType');
    const st=dcSizeTypeFor(t,wqaRowSpec(r,'sizeType')||c.sizeType);
    if(st) setFieldValue(t,'sizeType',st);
    else if(stEl) stEl.selectedIndex=-1;
  }
  setFinishValue(t,dcFinishFor(rowMat,wqaRowSpec(r,'finish')||''));
  onMaterialSizeChange(t,false,'material');
  setFieldValue(t,'size',normalizeSizeValue(r.size));
  autoFillDiameter(t);
  /* By NAME, from this product's own map: a Sag Rod's length is its overall
     length, an Anchor Bolt's is "l", an L Bolt's long leg is "l" with the short
     leg in "w", and a J Bolt has h/id/s. The L and J calculators compute their
     own total length from those, so it is never written over. */
  const map=(wqaProductByType(t)||WQA_NO_PRODUCT).map||{};
  Object.keys(map).forEach(k=>{
    if(fieldExists(t,map[k])) setFieldValue(t,map[k],r[k]==null?'':r[k]);
  });
  if(fieldExists(t,'threadLen')) setFieldValue(t,'threadLen',wqaThreadValue(r));
  setFieldValue(t,'qty',r.qty||'');
  onMaterialSizeChange(t,true);
  applyDefaultPrice();
  /* Staff overrides win over whatever default pricing filled in. */
  if(r.priceOverride.costRate!==undefined){ setFieldValue(t,'costRate',r.priceOverride.costRate); markUserPriced(t,'costRate'); }
  if(r.priceOverride.addCost!==undefined){ setFieldValue(t,'addCost',r.priceOverride.addCost); markUserPriced(t,'addCost'); }
  if(r.priceOverride.markup!==undefined)  setFieldValue(t,'markup',r.priceOverride.markup);
  if(r.acc) loadAccIntoForm(t,r.acc); else resetAccPanel(t);
  /* Price mode is per row. Use Last Price is the existing Manual Price mode:
     it sets the FINAL unit price and leaves cost rate / additional cost /
     markup exactly as they are. Auto and No Round never carry a final price
     across rows — each row recalculates from its own dimensions below. */
  const rowMode=r.useLastPrice?'manual':(r.priceMode||'auto');
  setFieldValue(t,'priceMode',rowMode);
  setFieldValue(t,'manualUnitPrice',rowMode==='manual'?(r.manualPrice||''):'');
  onPriceModeChange(t);
  recalcCurrent();
}
function wqaReadFormPricing(t){
  t=t||wqa.product;
  const st=priceCalcState[t]||{};
  return {costRate:fv(t,'costRate'),addCost:fv(t,'addCost'),markup:fv(t,'markup'),
          finalUnitPrice:Number(st.finalUnitPrice)||0,
          weight:Number(st.weight)||0};          // straight from the calculator
}

/* mode: 'force' = always full render (structural, user-initiated)
         'patch' = never re-render, just refresh the derived read-only values
         omitted = full render unless someone is typing                    */
async function wqaRecomputeAll(mode){
  if(!wqa.rows.length) return;                   // nothing to recompute after a reset
  /* Nothing to price until at least one row knows what it is. */
  if(!wqaLiveProducts().length){
    if(mode==='patch') wqaPatchRows(); else wqaRenderRows(mode==='force');
    wqaUpdateAddButton();
    return;
  }
  const token=wqa.session;
  const keepType=currentType;
  /* The calculator is switched to each row's OWN product, so a Stud row is
     weighed and priced by the Stud path and the Sag Rod beside it by the Sag
     Rod path. Same calculators, same formulas — only the routing is per row. */
  wqa.rows.forEach(r=>{
    if(r.removed) return;
    const t=wqaRowProduct(r);
    if(!t){ r.calc=null; return; }               // still asking which product
    /* No recognised size, no diameter, no weight — and therefore no price. The
       calculator is not even asked: a weight of zero with an Additional Cost on
       top still produces a number, and a number is what a person would trust. */
    if(!isKnownSize(r.size)){ r.calc=null; r.noDia=false; return; }
    switchType(t);
    wqaApplyRowToForm(r);
    /* And then the question the calculator actually answers: is there a
       diameter for this size AT this size type? M24 is a size we stock and
       there is no undersize M24 — the form comes back with an empty diameter,
       the weight is zero, and the price would be the Additional Cost standing
       on its own. Read from the form so this is the SAME rule the calculator
       used, custom Diameter Settings rules included. */
    r.noDia = !(fn(t,'diameter') > 0);
    if(r.noDia){ r.calc=null; return; }
    r.calc=wqaReadFormPricing(t);
  });
  wqaLiveProducts().forEach(t=>resetAccPanel(t));
  switchType(keepType);
  if(token!==wqa.session) return;                // a late debounce after a reset
  if(mode==='patch') wqaPatchRows(); else wqaRenderRows(mode==='force');
  wqaLoadHistory();                 // fire and forget; re-renders when it lands
}

function wqaRenderRows(force){
  /* Structural, user-initiated changes (expanding an item's accessories,
     removing a row, switching a row's price mode) always render. Only
     incidental redraws — a debounced recompute, price history landing — step
     aside for an active caret. */
  if(!force && wqaTypingIn(el('wqaRows'))){ wqaPatchRows(); wqaDeferRender('rows'); return; }
  const live=wqa.rows.filter(r=>!r.removed);
  const prod=wqaProductByType(wqa.product)||WQA_NO_PRODUCT;
  const cols=wqaListCols();
  el('wqaRows').innerHTML=wqa.rows.map((r,i)=>{
    if(r.removed) return '';
    const open=wqaRowIsOpen(r);
    const miss=wqaRowMissing(r);
    const calc=r.calc||{};
    const hist=r.history;
    let histHtml='<div class="wqa-hist wqa-hist-none">No previous matching price for this customer</div>';
    if(hist===undefined) histHtml='<div class="wqa-hist">Checking previous prices…</div>';
    else if(hist&&hist.rec){
      const exact=hist.exact;
      histHtml=`<div class="wqa-hist ${exact?'wqa-hist-exact':'wqa-hist-similar'}">
        <div class="wqa-hist-tag">${exact?'Exact previous match':'Similar previous item — not exact same size'}</div>
        <div class="wqa-hist-line">${escHtml(hist.rec.dimensionPreview||'')} · ${escHtml(hist.rec.refNo||'')} · ${escHtml(fmtDateShort(hist.rec.date))} · Qty ${parseInt(hist.rec.qty,10)||0}</div>
        <div class="wqa-hist-foot"><span class="wqa-hist-price">Last Price RM ${(parseFloat(hist.rec.unitPrice)||0).toFixed(2)}</span>
        <button type="button" class="btn btn-outline btn-sm" onclick="wqaUseLastPrice(${i})">${r.useLastPrice?'✓ Using Last Price':'Use Last Price'}</button></div>
      </div>`;
    }
    /* The body — every control that existed before — is built only when this row
       is open, so a 19-item paste is a 19-line list instead of 19 tall cards. */
    /* This row's product decides which dimensions it is asked for. */
    const rprod=wqaProductByType(wqaRowProduct(r))||prod;
    const body = !open ? '' : `<div class="wqa-row-body">
      <div class="wqa-row-grid">
        <div class="field"><label>Size</label><input type="text" value="${escHtml(r.size)}" oninput="wqaEdit(${i},'size',this.value)"></div>
        ${(rprod.dims||[]).filter(d=>d!=='size'&&d!=='threadLen').map(d=>`
        <div class="field"><label>${escHtml(wqaDimLabel(rprod.type,d))} (mm)</label>
          <input type="text" inputmode="decimal" value="${escHtml(r[d]==null?'':r[d])}"
                 oninput="wqaEdit(${i},'${d}',this.value)"
                 onblur="wqaCalcField(this,${i},'${d}')"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();wqaCalcField(this,${i},'${d}');}"></div>`).join('')}
        ${rprod.dims.includes('threadLen')?`<div class="field"><label>${escHtml(wqaDimLabel(rprod.type,'threadLen'))} (mm)</label>
          <input type="text" value="${escHtml(wqaThreadValue(r))}" placeholder="${rprod.threadEnds===2?'50/110':'100'}" oninput="wqaEditThread(${i},this.value)">
          <small class="wqa-hint-sm">${rprod.threadEnds===2?'one value, or both ends as 50/110':'one value'}</small></div>`:''}
        <div class="field"><label>Qty</label><input type="number" min="1" step="1" value="${escHtml(r.qty)}" oninput="wqaEdit(${i},'qty',this.value)"></div>
      </div>
      <div class="wqa-row-grid">
        <div class="field"><label>Product</label>
          <select onchange="wqaEditRowProduct(${i},this.value)">
            <option value=""${wqaRowProduct(r)?'':' selected'}>${escHtml(dcT('optRequired'))}</option>
            ${WQA_PRODUCTS.map(p=>`<option value="${p.type}"${p.type===wqaRowProduct(r)?' selected':''}>${p.label}</option>`).join('')}
          </select></div>
        ${r.bodyDia?`<div class="field"><label data-i18n="wqaBodyDia">${escHtml(dcT('wqaBodyDia'))}</label>
          <input type="text" inputmode="decimal" value="${escHtml(r.bodyDia)}"
                 oninput="wqaEdit(${i},'bodyDia',this.value)"
                 onblur="wqaCalcField(this,${i},'bodyDia')"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();wqaCalcField(this,${i},'bodyDia');}"></div>`:''}
        ${r.radius?`<div class="field"><label>${escHtml(dcT('wqaRadius'))}</label>
          <input type="text" value="${escHtml(r.radius)}" disabled>
          <small class="wqa-hint-sm">${escHtml(dcT('wqaEvidenceOnly'))}</small></div>`:''}
        <div class="field"><label data-i18n="fieldMaterial">Material</label>
          <select onchange="wqaEditRowSpec(${i},'material',this.value)">${wqaMaterialOptions(wqaRowSpec(r,'material'),wqaRowProduct(r))}</select></div>
        <div class="field"><label>Finish</label>
          <select onchange="wqaEditRowSpec(${i},'finish',this.value)"${wqaNoFinish(wqaRowSpec(r,'material'))?' disabled':''}>
            ${(wqaNoFinish(wqaRowSpec(r,'material'))?['']:['','PL','ZP','HDG'])
               .map(v=>`<option value="${v}"${wqaRowSpec(r,'finish')===v?' selected':''}>${v||'N/A'}</option>`).join('')}
          </select></div>
        ${(rprod.needSizeType && dcProductHasSizeType(wqaRowProduct(r)))?`<div class="field"><label data-i18n="fieldSizeType">Size Type</label>
          <select onchange="wqaEditRowSpec(${i},'sizeType',this.value)">
            ${[['','—'],['FULLSIZE','Fullsize'],['UNDERSIZE','Undersize']].map(o=>`<option value="${o[0]}"${wqaRowSpec(r,'sizeType')===o[0]?' selected':''}>${escHtml(o[1])}</option>`).join('')}
          </select></div>`:''}
      </div>
      <div class="wqa-row-grid wqa-price-grid">
        <div class="field"><label>Cost Rate</label><input type="text" value="${escHtml(calc.costRate||'')}" oninput="wqaEditPrice(${i},'costRate',this.value)"></div>
        <div class="field"><label>Additional Cost</label><input type="text" value="${escHtml(calc.addCost||'')}" oninput="wqaEditPrice(${i},'addCost',this.value)"></div>
        <div class="field"><label>Markup (%)</label><input type="number" value="${escHtml(calc.markup||'')}" oninput="wqaEditPrice(${i},'markup',this.value)"></div>
        <div class="field"><label data-i18n="lblPriceMode">Price Mode</label>
          <select onchange="wqaEditRowMode(${i},this.value)">${
            WQA_PRICE_MODES.map(m=>`<option value="${m.v}"${(r.useLastPrice?'manual':(r.priceMode||'auto'))===m.v?' selected':''}>${m.label}</option>`).join('')
          }</select></div>
        ${(r.useLastPrice?'manual':(r.priceMode||'auto'))==='manual'?`<div class="field"><label>Manual Unit Price (RM)</label>
          <input type="number" min="0" step="0.01" value="${escHtml(r.manualPrice||'')}" oninput="wqaEditRowManualPrice(${i},this.value)"></div>`:''}
      </div>
      <div class="wqa-weight-line">
        <span class="wqa-w-item"><span class="wqa-w-lbl" data-i18n="lblUnitWeight">Unit Weight</span>
          <span class="wqa-w-val wqa-uw-full">${wqaFmtWeight(calc.weight)}</span></span>
        <span class="wqa-w-item"><span class="wqa-w-lbl">Total Weight</span>
          <span class="wqa-w-val wqa-tw">${wqaFmtTotalWeight(calc.weight,r.qty)}</span></span>
      </div>
      ${histHtml}
      <div class="wqa-row-acc">
        <button type="button" class="wqa-acc-bar" onclick="wqaToggleAccOpen(${i})">
          <span class="wqa-acc-arrow">${r.accOpen?'▾':'▸'}</span>
          <span class="wqa-acc-bar-lbl">Accessories:</span>
          <span class="wqa-acc-bar-sum${wqaAccHas(r.acc)?' has':''}">${escHtml(wqaAccShortSummary(r.acc))}</span>
          <span class="wqa-panel-badge"${wqaAccActiveCount(r.acc)?'':' hidden'}>${wqaAccActiveCount(r.acc)?wqaAccActiveCount(r.acc)+' active':''}</span>
        </button>
        ${r.accOpen?wqaAccEditor(r.acc||wqaEmptyAcc(),(g,f,v)=>`wqaEditAcc(${i},'${g}','${f}',${v})`):''}
      </div>
      <div class="wqa-row-raw-full">${escHtml(r.raw)}</div>
    </div>`;

    return `<div class="wqa-row${miss.length?' wqa-row-block':''}${open?' is-open':''}${r.sel?' is-picked':''}" data-wqa-row="${i}">
      <div class="wqa-sum${cols.length>2?' wqa-sum-wide':''}" role="button" tabindex="0" aria-expanded="${open?'true':'false'}"
           onclick="wqaToggleRow(${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();wqaToggleRow(${i});}">
        <span class="wqa-sum-no">${wqa.applyScope==='selected'
          ? `<input type="checkbox" class="wqa-pick"${r.sel?' checked':''} onclick="event.stopPropagation()"
                    onchange="wqaToggleRowSel(${i})" aria-label="Select item ${i+1}">`
          : (i+1)}</span>
        ${wqaCompactCells(r,cols)}
        <span class="wqa-sum-badges">${wqaBadgeHtml(r)}</span>
        <span class="wqa-sum-act">${open?'Close':'Edit'}</span>
        <button type="button" class="wqa-row-del" title="Remove"
                onclick="event.stopPropagation();wqaRemoveRow(${i})">✕</button>
      </div>
      ${wqaRowSpecLine(r)}
      ${body}
    </div>`;
  }).join('');
  wqaRenderListHead();
  wqaUpdateAddButton();
}
function fmtDateShort(d){ return formatPrintDate(d); }

function wqaEdit(i,k,v){
  /* A size typed by hand is normalised as it is typed — 22, m22, M 22 and 22mm
     are all M22 — so the row is validated and weighed against what the person
     meant, not against the keystrokes. Only the SIZE box: Length, TL, ID, S and
     W are plain millimetres and never gain an M. */
  wqa.rows[i][k] = (k==='size') ? normalizeSizeValue(v) : v;
  wqa.rows[i].issues=wqa.rows[i].issues.filter(x=>x!==k);
  clearTimeout(wqa._t); wqa._t=setTimeout(()=>wqaRecomputeAll('patch'),250); }
function wqaEditPrice(i,k,v){ wqa.rows[i].priceOverride[k]=v;
  clearTimeout(wqa._t); wqa._t=setTimeout(()=>wqaRecomputeAll('patch'),250); }
function wqaRemoveRow(i){ wqa.rows[i].removed=true; wqaRenderRows(true); }
function wqaUseLastPrice(i){
  const r=wqa.rows[i];
  if(!r.history||!r.history.rec) return;
  r.useLastPrice=!r.useLastPrice;
  r.manualPrice=r.useLastPrice?String(parseFloat(r.history.rec.unitPrice)||0):'';
  wqaRecomputeAll();
}

/* ── Same-customer last price ──────────────────────────────────────────────
   Reuses get_price_history with company_id, so only the CURRENT customer's
   quotations are ever consulted and only the saved FINAL unit price is read.
   Exact = same dimensions; otherwise the newest same-spec item is offered as a
   clearly-labelled similar match. No cross-customer fallback.            */
/* Price history lands asynchronously, so it must never rebuild the rows out from
   under someone mid-edit. It re-renders only when a row's result actually
   changed — toggling an accessory or retyping a rate leaves it identical, so
   nothing is replaced. */
function wqaHistKey(){
  return wqa.rows.map(r=>r.removed?'x':(r.history===undefined?'?':(r.history&&r.history.rec
    ? (r.history.exact?'E':'S')+':'+r.history.rec.refNo+':'+r.history.rec.unitPrice : '-'))).join('|');
}
async function wqaLoadHistory(){
  const token=wqa.session;                 // abandon results from a discarded session
  const live=wqa.rows.filter(r=>!r.removed);
  const before=wqaHistKey();
  if(selectedCompanyId==null){
    live.forEach(r=>{ if(r.history===undefined) r.history=null; });
    if(wqaHistKey()!==before) wqaRenderRows();
    return;
  }
  const c=wqa.common;
  for(const r of live){
    try{
      const t=wqaRowProduct(r);
      if(!t){ r.history=null; continue; }
      const rMat=wqaRowSpec(r,'material')||c.material||'';
      const isSS=rMat==='SS304'||rMat==='SS316';
      const params=new URLSearchParams({action:'get_price_history',
        productType:ITEM_TYPES[t]||t, material:rMat,
        sizeType:t==='stud'?'':(wqaRowSpec(r,'sizeType')||c.sizeType||''),
        finish:isSS?'':(wqaRowSpec(r,'finish')||c.finish||''),
        cleanSize:normalizeSizeValue(r.size), company_id:String(selectedCompanyId)});
      const res=await fetch('api.php?'+params.toString()).then(x=>x.json());
      const recs=(res&&res.ok&&res.data)||[];
      const want=wqaExpectedDimPreview(r);
      const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
      const sorted=recs.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      const exact=sorted.find(x=>norm(x.dimensionPreview)===norm(want));
      if(token!==wqa.session) return;     // the session was discarded mid-fetch
      r.history = exact ? {rec:exact,exact:true} : (sorted[0]?{rec:sorted[0],exact:false}:null);
    }catch(e){ if(token!==wqa.session) return; r.history=null; }
  }
  if(token!==wqa.session) return;
  if(wqaHistKey()!==before) wqaRenderRows();
}
/* Mirror of the dimension string the add functions build, so an exact match
   really means the same length and thread. */
function wqaExpectedDimPreview(r){
  const t=wqaRowProduct(r), tl=wqaThreadValue(r);
  /* Written exactly as the calculator writes it when the item is committed, so
     Last Price matches on the same string it saved. */
  if(t==='lbolt')
    return 'L '+cleanNum(r.length)+' x W '+cleanNum(r.w)+(tl?' x TL '+withMm(tl):'');
  if(t==='jbolt')
    return 'H '+cleanNum(r.h)+' x ID '+cleanNum(r.id)+' x S '+cleanNum(r.s)+(tl?' x TL '+withMm(tl):'');
  const len=cleanNum(r.length);
  if(t==='stud') return 'L '+len+'mm';
  return 'L '+len+(tl?' x TL '+withMm(tl):'');
}

/* ── commit ────────────────────────────────────────────────────────────── */
async function wqaAddAll(){
  if(wqa.busy) return;
  const live=wqa.rows.filter(r=>!r.removed);
  if(!live.length || live.some(wqaRowBlocked)) return;
  wqa.busy=true;
  const btn=el('wqaAddBtn'); const label=btn.textContent; btn.disabled=true; btn.textContent='Adding…';
  const before=quoteItems.length;
  try{
    for(const r of live){
      if(!(parseInt(r.qty,10)>0)) continue;   // no qty: the calculator would refuse it
      /* Each row is committed through ITS OWN product's calculator — the same
         add path as before, chosen per row instead of once for the list. */
      switchType(wqaRowProduct(r));
      wqaApplyRowToForm(r);
      addCurrentItem();                 // the REAL add path: validation, calc, pushItem
    }
  } finally {
    wqaLiveProducts().forEach(t=>resetAccPanel(t));
    wqa.busy=false; btn.disabled=false; btn.textContent=label;
  }
  const added=quoteItems.length-before;
  const noQty=live.filter(r=>!(parseInt(r.qty,10)>0)).length;
  /* When a row does not make it, say WHICH row and WHY — "0 of 1 added" tells
     nobody anything. The reason comes from the row itself: what it is missing,
     or, when nothing is missing on our side, that the calculator refused it. */
  const blocked=live.filter(r=>parseInt(r.qty,10)>0).map(r=>{
    const miss=wqaRowMissing(r).filter(x=>x!=='Price');
    const name=(wqaProductByType(wqaRowProduct(r))||WQA_NO_PRODUCT).label;
    const why=r.productConflict
            ? dcT('wqaConflictWhy').replace('{p}',r.productConflict.said)
                                   .replace('{g}',r.productConflict.saw)
            : (miss.length ? miss.map(x=>dcT('needs').replace('{f}',x)).join(' / ')
            : (!fv(wqaRowProduct(r),'diameter') && r.size ? dcT('wqaNoCalcDia') : ''));
    return why ? `${name} ${r.size||''} — ${why}`.trim() : '';
  }).filter(Boolean);
  wqaHardClose();          // a successful add is the other path that may clear state
  showToast(added===live.length
    ? `${added} item${added===1?'':'s'} added from WhatsApp`
    : (noQty && added+noQty===live.length
        ? `${added} added · ${noQty} skipped — enter a quantity for those`
        : `${added} of ${live.length} added` + (blocked.length ? ' · '+blocked.slice(0,2).join(' · ') : ' — check the remaining rows')));
  goToStep(3);
}

/* ── init ── */
(async function init(){
  ensureLBolt45Form();
  ensureOthersForm();
  ensurePriceModeControls();
  el('qi-date').value=todayStr();
  await Promise.all([
    loadCompaniesCache(),
    refreshDPRules().catch(()=>{}),
    refreshDSRules().catch(()=>{}),
    loadWATemplate().catch(()=>{}),
    refreshNextRefNo().catch(()=>{})
  ]);
  el('qi-refno').value=nextRefNo();
  syncQI();
  onMaterialSizeChange('sagrod');
  ['sagrod','stud','anchorbolt','ubolt','squbolt','lbolt','lbolt45','jbolt','was','others'].forEach(onAccChange);
  onOthersWeightModeChange();
  renderQuote();
  const handoffLoaded=checkHandoff();
  draftRecoveryChecked=true;
  if(!handoffLoaded){
    updateQuoteLockUI();
    checkUnsavedDraftOnLoad();
  }
  setTimeout(applyDefaultPrice,100);
})();

</script>
</body>
</html>

