<?php require_once __DIR__ . '/auth.php'; dc_require_login(); ?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<script>
/* Language boot — same storage key and codes as index.php, so a choice made on
   either page is already in force when the other one paints. */
(function(){try{
  var l=localStorage.getItem('dc_lang'); if(l!=='zh'&&l!=='en') l='en';
  var r=document.documentElement;
  r.setAttribute('data-lang',l);
  r.setAttribute('lang', l==='zh' ? 'zh-Hans' : 'en');
}catch(e){}})();
</script>
<title>Der-Cheng Quotation / Companies</title>
<!-- App icons / Home Screen -->
<link rel="icon" type="image/svg+xml" href="assets/icons/dnc-logo.svg">
<link rel="icon" href="assets/icons/favicon.ico" sizes="any">
<link rel="apple-touch-icon" sizes="180x180" href="assets/icons/apple-touch-icon.png">
<?= dc_page_head_meta() /* CSRF token; manifest on quo.dnchardware.com only */ ?>
<meta name="theme-color" content="#ffffff">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Quotation">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  /* v2.24.1 brightness pass — same ground and surfaces as index.php. */
  --bg:#e8ecf3;--surface:#fff;--surface2:#f3f5f8;--surface3:#eceff5;
  --border:#d9dfe9;--border-focus:#3b5bdb;
  --text:#111318;--text-2:#3d4452;--text-muted:#6b7280;
  --accent:#2547d0;--accent-2:#1c3faa;--accent-light:#eef1fd;--accent-mid:#c7d0f8;
  --green:#0e7a38;--green-light:#dcfce7;
  --red:#dc2626;--red-light:#fef2f2;--red-mid:#fecaca;
  --amber:#d97706;--amber-light:#fffbeb;--amber-mid:#fde68a;
  --purple:#7c3aed;--purple-light:#f5f3ff;
  --shadow:0 1px 3px rgba(20,25,40,.07),0 8px 24px rgba(20,25,40,.09);
  --shadow-md:0 4px 8px rgba(20,25,40,.08),0 12px 34px rgba(20,25,40,.11);
  --r:14px;--r-sm:10px;--r-xs:7px;
  /* one control height language, shared with index.php */
  --control-h:40px;--control-h-lg:48px;--pill-r:999px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;}

/* Header */
.page-header{background:linear-gradient(135deg,var(--accent-2),var(--accent));color:#fff;padding:0 16px;display:flex;align-items:center;gap:10px;height:58px;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(28,63,170,.3)}
/* Brand block = app icon + title, the whole thing links back to the quotation home.
   Negative margin cancels the padding so the 44px tap target does not grow the header. */
/* Horizontal padding only — this header is content-sized at several widths, so any
   vertical padding would make it taller. min-height alone gives the 44px tap target. */
.brand-link{display:flex;align-items:center;gap:12px;flex:1;min-width:0;min-height:44px;color:inherit;text-decoration:none;border-radius:var(--r-sm);padding:0 6px;margin:0 -6px;transition:background .15s}
.brand-link:hover{background:rgba(255,255,255,.10)}
.brand-link:focus-visible{outline:2px solid rgba(255,255,255,.8);outline-offset:2px}
/* White plate: the app icon is a solid blue tile and would otherwise vanish into the blue header. */
.logo{width:32px;height:32px;background:#fff;border:1px solid rgba(255,255,255,.55);border-radius:var(--r-sm);padding:2px;flex-shrink:0;display:block;object-fit:cover}
.header-text{flex:1;min-width:0}
.header-text h1{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.header-text p{font-size:11px;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav-btn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);color:#fff;border-radius:var(--pill-r);padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;display:flex;align-items:center;gap:5px;font-family:inherit;flex-shrink:0;transition:background .15s}
.nav-btn:hover{background:rgba(255,255,255,.22)}

/* Layout */
.wrap{max-width:1020px;margin:0 auto;padding:22px 18px 80px;display:grid;grid-template-columns:300px 1fr;gap:18px}
@media(max-width:700px){.wrap{grid-template-columns:1fr}}

/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);padding:20px}
.card:hover{box-shadow:var(--shadow-md)}
.section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-muted);margin-bottom:14px;padding-bottom:11px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:7px}
.sl-icon{width:20px;height:20px;background:var(--accent-light);border-radius:var(--r-xs);display:flex;align-items:center;justify-content:center;font-size:11px}

/* Form */
.field{display:flex;flex-direction:column;gap:4px;margin-bottom:11px}
.field label{font-size:10.5px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em}
.field input,.field select,.field textarea{padding:9px 11px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:14px;font-family:inherit;color:var(--text);background:var(--surface);width:100%}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--border-focus);box-shadow:0 0 0 3px rgba(91,122,245,.14)}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:var(--control-h);padding:9px 16px;border:none;border-radius:var(--r-sm);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s,transform .08s;touch-action:manipulation}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-2)}
.btn-ghost{background:var(--surface2);color:var(--text-2);border:1.5px solid var(--border)}
.btn-ghost:hover{background:var(--surface3)}
.btn-danger{background:var(--red-light);color:var(--red);border:1.5px solid var(--red-mid)}
.btn-danger:hover{background:var(--red-mid)}
.btn-sm{min-height:34px;padding:6px 12px;font-size:12.5px}
.btn-purple{background:var(--purple);color:#fff}
.btn-purple:hover{filter:brightness(1.1)}
.btn-green{background:var(--green);color:#fff}
.btn-green:hover{filter:brightness(1.1)}
.btn-amber{background:var(--amber);color:#fff}
.btn-amber:hover{filter:brightness(1.1)}

/* Company list */
.company-item{
  display:flex;align-items:center;justify-content:space-between;
  padding:11px 13px;border-radius:var(--r-sm);
  border:1.5px solid var(--border);background:var(--surface2);
  cursor:pointer;transition:all .15s;margin-bottom:8px;
}
.company-item:hover{border-color:var(--accent);background:var(--accent-light)}
.company-item.active{border-color:var(--accent);background:var(--accent-light)}
.company-name{font-weight:700;font-size:14px}
.company-code{display:inline-block;font-size:10.5px;font-weight:700;background:var(--accent);color:#fff;padding:1px 7px;border-radius:var(--r-sm);margin-left:6px}
.company-sub{font-size:11px;color:var(--text-muted);margin-top:2px}
.company-actions{display:flex;gap:5px;flex-shrink:0}

/* Quotation cards */
.quote-item{
  background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);
  padding:13px 15px;margin-bottom:10px;
}
.quote-item-header{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px}
.quote-ref{font-size:13px;font-weight:700}
.quote-date{font-size:11px;color:var(--text-muted)}
.quote-total-badge{font-size:14px;font-weight:800;color:var(--green)}
.quote-item-rows{margin-top:8px;border-top:1px solid var(--border);padding-top:8px}
.quote-row-item{font-size:12px;color:var(--text-2);padding:2px 0}
.quote-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}
.quote-actions .btn{font-size:11px;padding:5px 11px}

/* Status badge */
.status-badge{display:inline-block;padding:2px 8px;border-radius:var(--r-sm);font-size:10.5px;font-weight:700;text-transform:uppercase}
.status-saved{background:var(--accent-light);color:var(--accent)}

/* Empty */
.empty-state{padding:32px 16px;text-align:center;color:var(--text-muted);border:1.5px dashed var(--border);border-radius:var(--r-sm)}
.empty-state .icon{font-size:32px;margin-bottom:8px;opacity:.5}
.empty-state-compact{padding:18px 14px}
.empty-state-compact .icon{font-size:22px;margin-bottom:5px}
.empty-state-compact p{font-size:12.5px;margin:0}

/* Modal */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;align-items:center;justify-content:center;padding:16px}
.modal-overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow-md);width:100%;max-width:420px;padding:24px;max-height:90vh;overflow-y:auto}
.modal-title{font-size:15px;font-weight:700;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.modal-close{background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted)}
.modal-close:hover{color:var(--text)}
.sub{display:block;font-size:10.5px;opacity:.6;font-weight:400;letter-spacing:0;text-transform:none;margin-top:1px}
.modal-btns{display:flex;gap:10px;margin-top:16px}
.modal-btns .btn{flex:1}

/* Quote detail modal */
.q-detail-item{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px}
.q-detail-item:last-child{border-bottom:none}
.q-detail-chip{display:inline-block;padding:1px 7px;border-radius:var(--r-xs);font-size:11px;font-weight:700}
.chip-PL{background:#fffbeb;color:#d97706}
.chip-ZP{background:#eef1fd;color:#2547d0}
.chip-HDG{background:#dcfce7;color:#0e7a38}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:rgba(20,22,30,.92);color:#fff;padding:11px 20px;border-radius:var(--r-sm);font-size:13px;font-weight:600;opacity:0;transform:translateY(16px);transition:opacity .2s,transform .2s;pointer-events:none;z-index:999;max-width:320px}
.toast.show{opacity:1;transform:translateY(0)}

/* Dark toggle */

/* ══════════════ UI v3.1 merge: dashboard, search/filter/sort, cards ══════════════ */
html,body{max-width:100%;overflow-x:hidden}
/* R2.2: overflow-x:hidden on BOTH html and body turns body into a scroll
   container, so the sticky phone top bar (#rspTop) scrolled away with the page.
   clip keeps the same no-sideways-scroll guard without creating one. */
@supports (overflow:clip){ html,body{overflow-x:clip} }
.header-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}

/* Dashboard summary */
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.summary-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);padding:14px 16px;position:relative;overflow:hidden}
.summary-card::before{content:"";position:absolute;top:0;left:0;width:4px;height:100%;background:var(--accent)}
.summary-card.sc-green::before{background:var(--green)}
.summary-card.sc-amber::before{background:var(--amber)}
.summary-card.sc-purple::before{background:var(--purple)}
.summary-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px;overflow-wrap:anywhere}
.summary-value{font-size:21px;font-weight:800;letter-spacing:-.02em;color:var(--text);overflow-wrap:anywhere}
.summary-sub{font-size:10.5px;color:var(--text-muted);margin-top:2px;font-weight:600;overflow-wrap:anywhere}
.summary-note{font-size:10.5px;color:var(--text-muted);font-style:italic;margin:-6px 0 14px;grid-column:1/-1}

/* Search / filter / sort */
/* Quotation-number search results (incl. retired numbers) */
.cp-search-result{margin-top:10px;font-size:13px}
.cp-hit-msg{padding:9px 12px;border-radius:var(--r-sm);font-weight:600;line-height:1.45;
  background:var(--accent-light);color:var(--accent-2);border:1px solid var(--accent-mid)}
.cp-hit-list{display:flex;flex-direction:column;gap:7px;margin-top:8px;max-height:320px;overflow-y:auto}
.cp-hit{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
  min-height:var(--control-h-lg);padding:9px 12px;text-align:left;cursor:pointer;
  background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-sm);
  font-family:inherit;color:var(--text);transition:border-color .12s,background .12s}
.cp-hit:hover,.cp-hit:focus-visible{border-color:var(--accent);background:var(--accent-light);outline:none}
.cp-hit-main{min-width:0}
.cp-hit-ref{font-weight:800;font-size:13.5px;display:block}
.cp-hit-sub{font-size:12px;color:var(--text-muted);margin-top:2px;display:block;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-hit-prev{display:block;font-size:11.5px;font-weight:700;margin-top:3px;color:var(--amber)}
.cp-hit-amt{flex:0 0 auto;font-weight:800;font-size:13.5px;color:var(--green);white-space:nowrap}

.page-title{margin:0 0 14px}
.page-title h2{font-size:18px;font-weight:800;line-height:1.2;letter-spacing:-.01em}
.page-title p{font-size:12.5px;color:var(--text-muted);margin-top:2px}
.search-bar{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-bottom:11px}
.search-input-wrap{flex:1;min-width:200px;position:relative}
.search-input-wrap input{width:100%;min-height:var(--control-h);padding:9px 11px 9px 34px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:13.5px;font-family:inherit;color:var(--text);background:var(--surface)}
.search-input-wrap input:focus{outline:none;border-color:var(--border-focus);box-shadow:0 0 0 3px rgba(91,122,245,.14)}
.search-input-wrap .icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;pointer-events:none}
.cp-sort-select{min-height:var(--control-h);padding:9px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:13.5px;font-family:inherit;color:var(--text);background:var(--surface);font-weight:600;cursor:pointer}
.cp-sort-select:focus{outline:none;border-color:var(--border-focus)}

/* Two-col layout for company list (left) + selected panel (right) */
.cp-main-grid{display:grid;grid-template-columns:340px 1fr;gap:16px;align-items:start}
.list-count{font-size:11px;color:var(--text-muted);font-weight:700;background:var(--surface2);padding:2px 8px;border-radius:var(--r-sm)}

/* Company card (replaces old flat .company-item visual, function kept) */
.company-card{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-sm);padding:13px 15px;cursor:pointer;transition:border-color .15s,box-shadow .15s,background .15s;margin-bottom:9px}
.company-card:hover{border-color:var(--accent-mid);box-shadow:var(--shadow)}
.company-card.selected{border-color:var(--accent);background:var(--accent-light);box-shadow:0 0 0 3px rgba(37,71,208,.1)}
.cc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:7px}
.cc-name{font-weight:800;font-size:14px;color:var(--text);line-height:1.3;overflow-wrap:anywhere}
.cc-phone{font-size:11.5px;color:var(--text-muted);margin-top:2px;font-weight:600;overflow-wrap:anywhere}
.badge-recent{background:var(--green-light);color:var(--green)}
.badge-remarks{background:var(--amber-light);color:var(--amber)}
.badge-norecent{background:var(--surface3);color:var(--text-muted)}
.cc-stats{display:flex;gap:12px;font-size:11px;color:var(--text-2);font-weight:600;border-top:1px solid var(--border);padding-top:8px;margin-top:1px;flex-wrap:wrap}
.cc-stats b{color:var(--text);font-weight:800}
.cc-actions{display:flex;gap:5px;margin-top:8px}
.latest-item-preview{font-size:10.5px;color:var(--text-muted);margin-top:5px;font-weight:500;overflow-wrap:anywhere}

/* Compact company card */
.company-card-compact{padding:9px 12px;margin-bottom:6px}
.company-card-compact .cc-top{margin-bottom:4px;gap:6px}
.company-card-compact .cc-name{font-size:13px}
.cc-row2{display:flex;justify-content:space-between;align-items:center;gap:8px}
.cc-row2-text{font-size:10.5px;color:var(--text-muted);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.cc-row2-text b{color:var(--text-2);font-weight:700}
.cc-icon-actions{display:flex;gap:3px;flex-shrink:0}
.cc-icon-btn{width:26px;height:26px;border:1px solid var(--border);background:var(--surface2);border-radius:var(--r-xs);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.55;transition:opacity .15s,background .15s}
.cc-icon-btn:hover{opacity:1;background:var(--surface3)}
@media (hover:none){.cc-icon-btn{opacity:.85}}

/* Desktop company list scroll */
@media (min-width:981px){
  #companyList{max-height:calc(100vh - 320px);overflow-y:auto;padding-right:2px}
  #companyList::-webkit-scrollbar{width:6px}
  #companyList::-webkit-scrollbar-thumb{background:var(--border);border-radius:var(--r-xs)}
}

/* Recent Quotations (right panel default state) */
.rq-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px 14px;margin-bottom:9px}
.rq-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.rq-no{font-weight:800;font-size:13px;color:var(--accent)}
.rq-company{font-size:11px;color:var(--text-2);font-weight:700;margin-top:1px}
.rq-date{font-size:10.5px;color:var(--text-muted);margin-top:1px;font-weight:600}
.rq-preview{font-size:11px;color:var(--text-muted);margin-bottom:6px;overflow-wrap:anywhere;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rq-total{font-size:10.5px;color:var(--text-muted);font-weight:600;margin-bottom:8px}
.rq-total b{color:var(--text-2);font-weight:700;font-size:12px}
.rq-actions{display:flex;gap:7px;flex-wrap:wrap}
.rq-actions .btn{font-size:11px;padding:5px 10px;flex:1}

/* Selected company panel */
.sp-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.sp-name{font-size:18px;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere}
.sp-phone{font-size:12.5px;color:var(--text-muted);margin-top:2px;font-weight:600}
.cp-back-btn{background:var(--surface2);color:var(--text-2);border:1.5px solid var(--border);border-radius:var(--r-sm);padding:7px 13px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex-shrink:0;transition:background .15s,border-color .15s}
.cp-back-btn:hover{background:var(--surface3);border-color:var(--accent-mid)}
.sp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:14px}
.sp-stat{background:var(--surface2);border-radius:var(--r-sm);padding:9px 11px}
.sp-stat-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
.sp-stat-value{font-size:14px;font-weight:800;margin-top:2px;overflow-wrap:anywhere}
.sp-remarks{margin-top:12px;padding:9px 11px;background:var(--amber-light);border:1px solid var(--amber-mid);border-radius:var(--r-sm);font-size:12px;color:var(--text-2)}
.sp-remarks b{color:var(--amber)}

/* Quotation cards (new layout, reuses .quote-actions buttons) */
.q-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px 16px;margin-bottom:11px}
.q-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.q-no{font-weight:800;font-size:13.5px;color:var(--accent)}
.q-dates{font-size:11px;color:var(--text-muted);margin-top:2px;font-weight:600}
.q-meta{display:flex;gap:12px;font-size:11px;color:var(--text-2);font-weight:600;margin-bottom:8px;flex-wrap:wrap}
.q-preview{background:var(--surface2);border-radius:var(--r-xs);padding:8px 10px;font-size:11.5px;color:var(--text-2);margin-bottom:8px;line-height:1.6}
.q-preview .item-line{display:flex;justify-content:space-between;gap:8px;overflow-wrap:anywhere}
.q-preview .item-line span:first-child{min-width:0}
.q-preview .item-more{color:var(--text-muted);font-style:italic;margin-top:2px}
.ref-total{font-size:10.5px;color:var(--text-muted);font-weight:600;margin-bottom:8px}
.ref-total b{color:var(--text-2);font-weight:700;font-size:13px}
.ref-total-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700}
.q-remarks{font-size:11px;color:var(--text-muted);margin-bottom:10px;font-style:italic}
.q-helper{font-size:11px;color:var(--text-muted);background:var(--surface2);border-radius:var(--r-xs);padding:7px 11px;margin-bottom:11px;font-weight:500}
/* The company list sits beside the quotations above 980px and above them below it. */
.cp-where-above{display:none}
@media (max-width:980px){ .cp-where-side{display:none} .cp-where-above{display:inline} }

/* Responsive */
@media (max-width:980px){
  .cp-main-grid{grid-template-columns:1fr}
  .summary-grid{grid-template-columns:repeat(2,1fr)}
  .sp-stats{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:560px){
  .page-header{padding:0 14px;flex-wrap:wrap;height:auto;min-height:56px}
  .header-text{flex-basis:100%;order:1;padding:8px 0 4px}
  .header-actions{order:2;width:100%;padding-bottom:8px}
  .nav-btn{flex:1;justify-content:center;min-width:0}
  .summary-grid{grid-template-columns:1fr 1fr;gap:8px}
  .summary-card{padding:11px 12px}
  .summary-value{font-size:18px}
  .search-bar{flex-direction:column;align-items:stretch}
  .cp-sort-select{width:100%}
  .sp-stats{grid-template-columns:1fr 1fr}
  .quote-actions{flex-direction:column}
  .quote-actions .btn{width:100%}
  .rq-actions{flex-direction:column}
  .rq-actions .btn{width:100%}
  .cc-actions{flex-direction:column}
  .cp-back-btn{width:100%;justify-content:center}
}
@media (max-width:420px){
  .summary-grid{grid-template-columns:1fr}
  .sp-stats{grid-template-columns:1fr}
}

/* ═══════════════ v2.18.0 — Stage 6B Companies UI/UX ═══════════════ */

/* v2.18.2 — customer card two-line info */
.cc-row2-stack{display:flex;flex-direction:column;gap:2px;overflow:hidden;min-width:0;flex:1}
.cc-phone-line{font-size:11px;color:var(--text-muted);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-quote-line{font-size:11px;color:var(--text-2);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-quote-line b{color:var(--accent-2);font-weight:800}

/* ── Header: gradient top accent bar matching index.php ── */
.page-header{
  background:linear-gradient(135deg,var(--accent-2) 0%,var(--accent) 100%);
  border-bottom:none;
}
.page-header::after{
  content:'';display:block;position:absolute;bottom:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,var(--accent-2),var(--accent) 55%,#5b7af5);
}
.page-header{position:relative}
.header-text h1{font-size:15px;font-weight:800;letter-spacing:-.01em}
.header-text p{font-size:11px;opacity:.72;font-weight:500}

/* ── Summary cards: KPI style from index.php ── */
.summary-grid{
  display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;
}
@media (max-width:700px){.summary-grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width:420px){.summary-grid{grid-template-columns:1fr 1fr}}
.summary-card{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  padding:14px 16px;box-shadow:var(--shadow);
}
.summary-label{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px}
.summary-value{font-size:22px;font-weight:900;color:var(--text);line-height:1}
.summary-sub{font-size:11px;color:var(--text-muted);font-weight:600;margin-top:3px}
.summary-note{font-size:11px;color:var(--text-muted);margin-bottom:14px;font-style:italic;padding:0 2px}

/* ── Empty states: cleaner ── */
.empty-state{
  border-radius:var(--r-sm);padding:36px 18px;
  background:var(--surface2);
}
.empty-state .icon{font-size:36px;margin-bottom:10px;opacity:.4}
.empty-state p{font-size:13.5px;color:var(--text-muted);font-weight:600}

/* ── Mobile tab bar ── */
.mob-tab-bar{
  display:none; /* hidden on desktop */
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  padding:5px;gap:5px;margin-bottom:14px;
  box-shadow:var(--shadow);
}
.mob-tab{
  flex:1;padding:10px 8px;border:none;border-radius:var(--r-sm);
  background:transparent;color:var(--text-muted);font-family:inherit;
  font-size:13px;font-weight:800;cursor:pointer;text-align:center;
  transition:background .15s,color .15s;line-height:1.2;
}
.mob-tab.active{
  background:var(--accent);color:#fff;
  box-shadow:0 2px 8px rgba(37,71,208,.3);
}
.mob-tab:not(.active):hover{background:var(--surface2);color:var(--text-2)}

/* ── Mobile panes ── */
.mob-pane{} /* no-op on desktop; controlled by media query below */

@media (max-width:980px){
  .mob-tab-bar{display:flex}
  .cp-main-grid{grid-template-columns:1fr;gap:14px}
  /* Pane switching */
  .mob-pane{display:none}
  .mob-pane.mob-pane-active{display:block}
}

/* ── Quotation cards: two-tier style like index.php qi-item ── */
.q-card{
  border-radius:var(--r-sm);padding:0;overflow:hidden;
  margin-bottom:11px;box-shadow:var(--shadow-sm);
  border:1px solid var(--border);background:var(--surface);
  transition:box-shadow .15s;
}
.q-card:hover{box-shadow:var(--shadow-md)}
.q-card-top{padding:13px 15px 10px}
.q-card-bottom{
  padding:9px 15px 11px;
  background:var(--surface2);
  border-top:1px solid var(--border);
  display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;
}
.q-card .q-no{font-size:13.5px;font-weight:900;color:var(--accent)}
.q-card .q-dates{font-size:11px;font-weight:600;color:var(--text-muted);margin-top:2px}
.q-card .q-preview{
  background:var(--surface2);border-radius:var(--r-xs);
  padding:7px 10px;font-size:11.5px;color:var(--text-2);
  margin:8px 0 0;line-height:1.6;
}
.q-total-hero{font-size:18px;font-weight:900;color:var(--green)}
.q-action-row{display:flex;gap:7px;flex-wrap:wrap}
.q-action-row .btn{font-size:11px;padding:5px 11px}
@media (max-width:560px){
  .q-action-row{flex-direction:column}
  .q-action-row .btn{width:100%}
}

/* ── Recent quotations cards (rq-card) polish ── */
.rq-card{border-radius:var(--r-sm);overflow:hidden;padding:0;margin-bottom:9px}
.rq-card-top{padding:12px 14px 8px}
.rq-card-bot{
  padding:8px 14px 10px;background:var(--surface2);
  border-top:1px solid var(--border);
  display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;
}

/* ── Company cards: tighter active ring ── */
.company-card.selected{
  border-color:var(--accent);border-width:2px;
  box-shadow:0 0 0 3px var(--accent-mid),var(--shadow);
}
.company-card{border-radius:var(--r-sm)}

/* ── Section label: slightly bolder ── */
.section-label{font-weight:900;letter-spacing:.1em}

/* ── Button sizing: match index.php ERP style ── */
.btn-primary{background:linear-gradient(135deg,var(--accent-2),var(--accent));box-shadow:0 3px 10px rgba(37,71,208,.22)}
.btn-primary:hover{background:linear-gradient(135deg,#17348f,var(--accent-2))}

/* Company creation is the page-level primary, below the module-level shell CTA. */
.btn-company-primary{min-height:40px;border-radius:8px;background:#eef0fd;color:#4338ca;border:1px solid #c7d2fe;font-family:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;font-weight:500;box-shadow:none}
.btn-company-primary:hover{background:#e0e7ff;border-color:#a5b4fc}
.btn-company-primary:focus-visible{outline:2px solid #4338ca;outline-offset:2px}
.btn-company-primary:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}

/* Viewing is quiet beside the contextual orange Load action. */
.btn-view{background:var(--surface);color:var(--text-2);border:0;box-shadow:inset 0 0 0 1px var(--border)}
.btn-view:hover{background:var(--surface2);color:var(--text);box-shadow:inset 0 0 0 1px var(--accent-mid)}
.btn-view:focus-visible{outline:2px solid #4338ca;outline-offset:2px}
.btn-view:disabled{opacity:.5;cursor:not-allowed}
.cc-icon-danger{opacity:1;background:var(--red-light);color:var(--red);border-color:var(--red-mid)}
.cc-icon-danger:hover{background:var(--red-mid)}

/* ── Load More button ── */
.load-more-btn{
  width:100%;margin-top:6px;padding:11px;font-size:13px;font-weight:800;
  border-radius:var(--r-sm);
}

/* ── Selected company panel ── */
.sp-name{font-weight:900;letter-spacing:-.02em}
.sp-stats{gap:10px;margin-top:16px}
.sp-stat{border-radius:var(--r-sm);padding:10px 13px;border:1px solid var(--border)}
.sp-stat-label{font-weight:900;letter-spacing:.06em}
.sp-stat-value{font-size:16px;font-weight:900}

/* ── Dashboard section header above grid ── */
.dash-head{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-bottom:10px;
}
.dash-head-title{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted)}

/* ── Tooltip/helper lines ── */
.q-helper{border-radius:var(--r-xs);background:var(--surface2);border:1px solid var(--border);padding:8px 12px;font-size:11px;color:var(--text-muted);margin-bottom:11px}

/* ── Wrap outer ── */
.wrap{padding-top:20px;padding-bottom:80px}

/* ── Mobile: remove extra paddings ── */
@media (max-width:560px){
  .wrap{padding:14px 12px 60px}
  .q-card-top{padding:11px 12px 8px}
  .q-card-bottom{padding:8px 12px 10px}
  .rq-card-top{padding:10px 12px 7px}
  .rq-card-bot{padding:7px 12px 9px}
}

/* Stage 7B-6 Remove Valid Until UI */
/* Stage 7B-5 Companies mobile/header polish */
/* The old height:auto/min-height:60px override here dated from the two-line
   bilingual "Companies / 公司" header. The header now carries the same compact
   brand block as index.php, so it uses the same fixed 58px at every width above
   the phone breakpoint (the <=700px rule still lets it grow if it must). */
.company-tools{margin-bottom:16px}
.summary-card.sc-purple .summary-value{word-break:normal;overflow-wrap:normal}
.rq-no,.q-no{word-break:normal;overflow-wrap:normal}

@media (max-width:700px){
  .page-header{
    /* two children now: the brand link (icon + title) and the actions */
    display:grid;grid-template-columns:minmax(0,1fr) auto;
    height:auto;min-height:58px;padding:6px 10px;gap:8px;flex-wrap:nowrap;
  }
  .brand-link{gap:8px;min-width:0}
  /* keep the brand mark identical to index.php at every width */
  .logo{width:32px;height:32px;border-radius:var(--r-sm)}
  .header-text{min-width:0;padding:0;order:initial;flex-basis:auto}
  .header-text h1{font-size:14px;line-height:1.08;letter-spacing:0}
  .header-text p{font-size:10.5px;line-height:1.15;margin-top:3px;white-space:normal}
  .header-actions{order:initial;width:auto;padding:0;gap:4px;flex-wrap:nowrap}
  .nav-btn{
    min-width:0;min-height:40px;padding:6px 10px;border-radius:var(--r-xs);
    justify-content:center;gap:4px;font-size:11.5px;white-space:nowrap;
  }

  .wrap{padding:10px 10px 48px}
  .mob-tab-bar{padding:3px;gap:3px;margin-bottom:10px;border-radius:var(--r-sm)}
  .mob-tab{min-height:44px;padding:8px 6px;border-radius:var(--r-xs);font-size:12px;line-height:1.15}

  .summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:10px}
  .summary-card{min-width:0;padding:9px 10px;border-radius:var(--r-sm)}
  .summary-label{font-size:10.5px;line-height:1.2;letter-spacing:.04em;margin-bottom:4px}
  .summary-value{font-size:17px;line-height:1.05;letter-spacing:0;overflow-wrap:anywhere}
  .summary-card.sc-purple .summary-value{font-size:15.5px;white-space:nowrap}
  .summary-sub{font-size:10.5px;line-height:1.25;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .summary-note{font-size:10.5px;line-height:1.35;margin:0 1px 10px;padding:0}

  .company-tools{padding:10px;margin-bottom:10px!important;border-radius:var(--r-sm)}
  .search-bar{gap:7px;margin-bottom:8px;flex-direction:column;align-items:stretch}
  .search-input-wrap{width:100%;min-width:0}
  .search-input-wrap input{min-height:44px;padding-top:9px;padding-bottom:9px;font-size:13.5px}
  .cp-sort-select{width:100%;min-height:44px;padding:9px 10px;font-size:13.5px}

  .rq-card,.q-card,.company-card{margin-bottom:7px}
  .rq-card-top,.q-card-top{padding:10px 11px 7px}
  .rq-card-bot,.q-card-bottom{padding:7px 11px 9px;gap:6px}
  .rq-top,.q-top{margin-bottom:4px}
  .rq-no,.q-no{font-size:12.5px;white-space:nowrap}
  .rq-company{font-size:10.5px}
  .rq-date,.q-dates{font-size:10.5px}
  .rq-preview{font-size:10.5px;margin-bottom:0}
  .rq-total,.ref-total{margin:0}
  .rq-actions{display:flex;flex-direction:row;gap:5px;margin-left:auto}
  .rq-actions .btn{width:auto;min-width:72px;min-height:44px;padding:8px 12px;font-size:12.5px}
  .quote-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:0}
  .quote-actions .btn{width:100%;min-width:0;min-height:44px;padding:8px 10px;font-size:12.5px}
  .company-card-compact{padding:8px 10px}
  .cc-name{font-size:12.5px}
  .cc-phone-line,.cc-quote-line{font-size:10.5px}
  .section-label{font-size:10.5px;letter-spacing:.06em}
  .q-helper{padding:7px 9px;font-size:10.5px;line-height:1.35;margin-bottom:8px}
  .load-more-btn,#recentQuotesMoreBtn,#companyQuotesMoreBtn{width:100%;padding:9px;font-size:11.5px}
}

/* 440, not 430: a 430pt phone reports a fractional viewport, so max-width:430px
   never matched on the exact device this breakpoint was written for. */
@media (max-width:440px){
  /* These used to be icon buttons, so the label was hidden and the button pinned
     to a 40px square. The icons are gone, so that would leave three empty boxes.
     Keep the text and tighten the type instead; the brand truncates if it must. */
  .nav-btn{width:auto;padding:0 7px;font-size:10.5px;min-height:40px}
  .header-actions{gap:3px}
  /* Three text buttons plus a 19-character brand will not both fit at 390px.
     The subtitle goes, and so does the link to the page you are already on —
     that frees exactly enough room for the full brand title. */
  .header-text p{display:none}
  .header-text h1{font-size:14px}
  .nav-btn.is-active{display:none}
  .summary-card.sc-purple .summary-value{font-size:14.5px}
}

/* ── Tap targets ──────────────────────────────────────────────────
   Last in the sheet on purpose: .btn-sm and the phone rules above set
   smaller heights, and at equal specificity the later rule wins. Covers
   phones and tablets; View / Load must never be tiny on touch. */
@media (max-width:820px){
  .btn,.btn-sm,.rq-actions .btn,.quote-actions .btn{min-height:44px}
  /* the pane tabs are primary navigation on tablet */
  .mob-tab{min-height:44px}
  /* header stays compact, but the two nav buttons get a usable target */
  .nav-btn{min-height:40px}
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

/* Pane switching + search results: a short fade, no slide-in of whole lists. */
.mob-pane.mob-pane-active{animation:mo-pane var(--mo) var(--mo-ease) both}
@keyframes mo-pane{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
.cp-search-result:not([hidden]){animation:mo-fade var(--mo) var(--mo-ease) both}
@keyframes mo-fade{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
  .mob-pane.mob-pane-active,.cp-search-result:not([hidden]){animation:none}
}

/* Language switch (EN / 中文) — mirrors index.php */
.lang-switch{display:inline-flex;border:1px solid rgba(255,255,255,.24);border-radius:var(--pill-r,999px);
  overflow:hidden;flex-shrink:0}
.lang-btn{background:rgba(255,255,255,.14);border:0;color:#fff;font-family:inherit;font-size:12px;
  font-weight:700;padding:6px 11px;cursor:pointer;line-height:1;white-space:nowrap;min-height:40px}
.lang-btn+.lang-btn{border-left:1px solid rgba(255,255,255,.24)}
.lang-btn:hover{background:rgba(255,255,255,.26)}
.lang-btn.is-on{background:#fff;color:var(--accent-2)}
.lang-btn:focus-visible{outline:2px solid #fff;outline-offset:-2px}
/* Single header toggle: always shows the OTHER language. The label is CSS-only
   (keyed on <html data-lang>, set before first paint) so it never flashes. */
.lang-toggle::before{content:'中文'}
:root[data-lang="zh"] .lang-toggle::before{content:'EN'}
.lang-switch .lang-btn{min-width:56px;text-align:center}
/* Desktop: equal-minimum nav buttons so a language switch cannot move them (<=560px they are flex:1) */
@media (min-width:561px){ .header-actions .nav-btn{min-width:112px;justify-content:center} }
@media (max-width:440px){ .lang-btn{padding:0 8px;font-size:10.5px} }

/* Global nav states — same language as index.php */
.nav-btn.is-active{background:rgba(255,255,255,.28);border-color:rgba(255,255,255,.55);font-weight:800}
.nav-btn.is-active:hover{background:rgba(255,255,255,.34)}
.nav-btn.is-secondary{background:transparent;border-color:rgba(255,255,255,.3);opacity:.85;font-weight:600}
.nav-btn.is-secondary:hover{background:rgba(255,255,255,.16);opacity:1}

/* ── Historical item search results ──────────────────────────────────────
   Built for one job: reading an old quoted price fast. The price is the loudest
   thing in each card. Single column on phones, two-up from 768px. */
.ih-list{display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px;max-height:60vh;overflow-y:auto}
@media (min-width:768px){ .ih-list{grid-template-columns:repeat(2,minmax(0,1fr))} }
@media (min-width:1280px){ .ih-list{grid-template-columns:repeat(3,minmax(0,1fr))} }
.ih-card{display:flex;flex-direction:column;gap:3px;padding:11px 12px;min-width:0;
  background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-sm)}
.ih-desc{font-size:13.5px;font-weight:800;line-height:1.3;overflow-wrap:anywhere}
.ih-finish{font-size:11px;font-weight:700;color:var(--text-muted)}
.ih-size{font-size:12px;color:var(--text-2);line-height:1.35;overflow-wrap:anywhere}
.ih-meta{font-size:11.5px;color:var(--text-muted);line-height:1.4;overflow-wrap:anywhere}
.ih-prev{display:inline-block;margin-left:6px;font-weight:700;color:var(--amber)}
.ih-foot{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:5px;
  padding-top:7px;border-top:1px solid var(--border)}
.ih-qty{font-size:12px;font-weight:700;color:var(--text-2);white-space:nowrap}
.ih-price{font-size:12px;color:var(--text-muted);white-space:nowrap}
.ih-price strong{font-size:16px;font-weight:800;color:var(--green);margin-left:4px}
.ih-view{width:100%;margin-top:9px;min-height:44px}

/* Smart-search transient states */
.cp-hit-busy{display:flex;align-items:center;gap:8px}
.cp-hit-busy::before{content:'';width:13px;height:13px;flex:0 0 auto;border-radius:50%;
  border:2px solid var(--accent-mid);border-top-color:var(--accent);animation:cp-spin .7s linear infinite}
@keyframes cp-spin{to{transform:rotate(360deg)}}
.cp-empty{padding:22px 16px;text-align:center;background:var(--surface);
  border:1.5px dashed var(--border);border-radius:var(--r-sm)}
.cp-empty-icon{font-size:22px;line-height:1;margin-bottom:8px;opacity:.7}
.cp-empty-main{font-size:14px;font-weight:800;overflow-wrap:anywhere}
.cp-empty-sub{font-size:12.5px;color:var(--text-muted);margin-top:5px;line-height:1.45}
@media (prefers-reduced-motion: reduce){ .cp-hit-busy::before{animation:none} }

/* Item price-history search card (right pane, above Recent Quotations) */
.item-search-tools{padding:12px;margin-bottom:14px}
.item-search-hint{font-size:11.5px;color:var(--text-muted);margin-top:7px;line-height:1.4}
.item-search-tools .cp-search-result{margin-top:10px}
@media (max-width:700px){ .item-search-tools{padding:10px;margin-bottom:10px} }

/* ── Reaching these with a thumb ──────────────────────────────
   Measured on a 430px phone, three controls came out under the 44px a finger
   actually needs, and they are not obscure ones: the language pair in the
   header (30.6 x 40 and 39 x 40) and the × that closes every modal
   (17 x 24 — under a fifth of the area). The Edit Company fields sat at 36.

   The × is the one that matters most: it is the only way out of a modal on a
   phone, it sits in the top corner where the hand is least steady, and missing
   it means tapping the page behind. It grows into a real box rather than
   staying a bare glyph.

   Held to narrow widths and coarse pointers on purpose. Desktop keeps the
   density UI POLISH 1 and UI POLISH 2 settled on — nothing here applies above
   560px with a mouse, and none of it changes what any control DOES. */
@media (max-width:560px){
  .lang-btn{min-width:44px;min-height:44px;padding:0 12px;font-size:12px}
  .modal-close{min-width:44px;min-height:44px;display:inline-flex;align-items:center;
    justify-content:center;margin:-10px -10px -10px 8px;border-radius:var(--r-sm);
    flex:0 0 auto;touch-action:manipulation}
  .modal-close:hover{background:var(--surface2)}
  .field input,.field select,.field textarea{min-height:44px}
  .field textarea{min-height:64px}
}
/* A touch screen has no hover to fall back on, whatever its width. */
@media (hover:none) and (pointer:coarse){
  .lang-btn{min-width:44px;min-height:44px}
  .modal-close{min-width:44px;min-height:44px;display:inline-flex;align-items:center;
    justify-content:center;flex:0 0 auto;touch-action:manipulation}
  .field input,.field select,.field textarea{min-height:44px}
}
/* The label keeps its place beside a taller close box. */
@media (max-width:560px){ .modal-title{align-items:flex-start} }
/* ══ DNC shared desktop shell (2026-10-24) ═════════════════════════════════
   The same block in index.php and companies.php, and the same values as the
   Internal PO shell: 240px sidebar, 64px brand row, 36px rows, 8px radius,
   3px accent bar, 11px section labels, 40px primary action, IBM Plex Sans.
   Desktop only (≥1024px). Below that nothing here applies and each page keeps
   its own header and off-canvas menu, unchanged. Shell tokens are scoped to
   the shell, so the quotation content keeps its own type and colours. */
.dnc-shell,.dnc-page-head{display:none}
.dnc-shell,.dnc-page-head{
  --dnc-indigo:#4338ca; --dnc-indigo-hover:#3730a3; --dnc-indigo-soft:#eef0fd;
  --dnc-tangerine:#ff8a3d; --dnc-canvas:#f2f3f6; --dnc-surface:#ffffff; --dnc-sunken:#eceef2;
  --dnc-border:#e2e4ea; --dnc-ink:#161a23; --dnc-ink-2:#4d5463; --dnc-ink-3:#737a89;
  --dnc-font:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
}
@media (min-width:1024px){
  :root{--header-h:0px}
  body{padding-left:240px}
  .app-header,.page-header,.sidebar,.sidebar-backdrop{display:none!important}
  .dnc-shell{
    display:flex; flex-direction:column; position:fixed; z-index:200;
    top:var(--banner-h,0px); bottom:0; left:0; width:240px;
    background:var(--dnc-surface); border-right:1px solid var(--dnc-border);
    color:var(--dnc-ink); font-family:var(--dnc-font); font-size:14px; line-height:1.4;
    -webkit-font-smoothing:antialiased;
  }
  .dnc-page-head{display:flex; align-items:flex-end; justify-content:space-between; gap:12px; font-family:var(--dnc-font)}
}
.dnc-ico{width:16px;height:16px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dnc-ico-sub{color:var(--dnc-ink-3)}
.dnc-brand{display:flex;align-items:center;gap:10px;height:64px;flex-shrink:0;padding:0 20px;color:inherit;text-decoration:none}
.dnc-brand:focus-visible{outline:2px solid var(--dnc-indigo);outline-offset:-4px;border-radius:8px}
.dnc-mark{width:32px;height:32px;flex-shrink:0;object-fit:contain}
.dnc-brand-text{min-width:0;line-height:1}
.dnc-brand-sys{display:block;font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--dnc-ink)}
.dnc-brand-mod{display:block;margin-top:4px;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;
  color:var(--dnc-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dnc-back-wrap{flex-shrink:0;padding:0 12px 4px}
.dnc-back{display:flex;align-items:center;gap:8px;height:32px;padding:0 10px;border-radius:8px;
  font-size:14px;color:var(--dnc-ink-2);text-decoration:none;transition:background .15s,color .15s}
.dnc-back:hover{background:var(--dnc-sunken);color:var(--dnc-ink)}
.dnc-cta-wrap{flex-shrink:0;padding:0 12px 8px}
.dnc-cta{display:flex;align-items:center;justify-content:flex-start;gap:10px;width:100%;height:36px;padding:0 10px;
  border:0;border-radius:8px;background:transparent;color:var(--dnc-ink-2);font:inherit;font-size:14px;font-weight:500;text-align:left;cursor:pointer;
  box-shadow:none;transition:background .15s,color .15s}
.dnc-cta:hover{background:var(--dnc-indigo-soft);color:var(--dnc-indigo)}
.dnc-cta:active{background:#e0e7ff;color:var(--dnc-indigo-hover)}
.dnc-cta:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.dnc-nav{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:0 12px 8px}
.dnc-sec{padding:0 10px 6px;font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--dnc-ink-3)}
.dnc-nav .dnc-sec ~ .dnc-sec{margin-top:16px}
.dnc-link{position:relative;display:flex;align-items:center;gap:10px;width:100%;height:36px;flex-shrink:0;padding:0 10px;
  border:0;border-radius:8px;background:transparent;font:inherit;font-size:14px;font-weight:500;text-align:left;
  color:var(--dnc-ink-2);text-decoration:none;cursor:pointer;transition:background .15s,color .15s}
.dnc-link > span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dnc-link:hover{background:var(--dnc-sunken);color:var(--dnc-ink)}
.dnc-link.is-active{background:var(--dnc-indigo-soft);color:var(--dnc-indigo)}
.dnc-link.is-active::before{content:'';position:absolute;top:8px;bottom:8px;left:-12px;width:3px;border-radius:0 999px 999px 0;background:var(--dnc-tangerine)}
.dnc-link:focus-visible,.dnc-back:focus-visible,.dnc-cta:focus-visible,.dnc-acct:focus-visible,.dnc-mi:focus-visible,.dnc-lang-btn:focus-visible{
  outline:2px solid var(--dnc-indigo);outline-offset:2px}
.dnc-bottom{position:relative;flex-shrink:0;display:flex;flex-direction:column;gap:8px;padding:12px;border-top:1px solid var(--dnc-border)}
.dnc-lang{display:flex;width:100%;padding:2px;border:1px solid var(--dnc-border);border-radius:8px;background:var(--dnc-sunken)}
.dnc-lang-btn{flex:1;height:28px;border:0;border-radius:6px;background:transparent;font:inherit;font-size:13px;font-weight:500;color:var(--dnc-ink-2);cursor:pointer}
.dnc-lang-btn:hover{color:var(--dnc-ink)}
.dnc-lang-btn.is-on{background:var(--dnc-surface);color:var(--dnc-ink);box-shadow:0 1px 2px 0 rgb(22 26 35 / .08)}
.dnc-acct{display:flex;align-items:center;gap:10px;width:100%;padding:6px 8px;border:0;border-radius:8px;background:transparent;
  font:inherit;text-align:left;color:inherit;cursor:pointer;transition:background .15s}
.dnc-acct:hover,.dnc-acct[aria-expanded="true"]{background:var(--dnc-sunken)}
.dnc-avatar{display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;border-radius:999px;
  background:var(--dnc-indigo-soft);color:var(--dnc-indigo);font-size:13px;font-weight:600}
.dnc-acct-text{flex:1;min-width:0}
.dnc-acct-name{display:block;font-size:14px;font-weight:500;color:var(--dnc-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dnc-acct-user{display:block;font-size:12px;color:var(--dnc-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dnc-menu{position:absolute;left:12px;right:12px;bottom:calc(100% - 4px);z-index:5;padding:4px;
  background:var(--dnc-surface);border:1px solid var(--dnc-border);border-radius:12px;
  box-shadow:0 12px 32px -8px rgb(22 26 35 / .18),0 2px 6px rgb(22 26 35 / .06)}
.dnc-menu[hidden]{display:none}
.dnc-mi{display:flex;align-items:center;gap:10px;width:100%;height:36px;padding:0 10px;border:0;border-radius:8px;background:transparent;
  font:inherit;font-size:14px;color:var(--dnc-ink);text-align:left;text-decoration:none;cursor:pointer}
.dnc-mi:hover{background:var(--dnc-sunken)}
.dnc-mi.is-static{cursor:default;color:var(--dnc-ink-2)} .dnc-mi.is-static:hover{background:transparent}
.dnc-mi-val{margin-left:auto;font-size:12px;color:var(--dnc-ink-3);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.dnc-mi-sep{height:1px;margin:4px 6px;background:var(--dnc-border)}
.dnc-page-title{font-size:22px;font-weight:600;line-height:1.25;letter-spacing:-.01em;color:var(--dnc-ink)}
.dnc-page-sub{margin-top:4px;font-size:14px;color:var(--dnc-ink-2)}
@media (min-width:1024px){
  /* The shared page header replaces the old page title; content takes the shared width. */
  .wrap{max-width:1440px!important;padding:32px 32px 80px!important}
  .wrap>.page-title{display:none}
  .dnc-page-head{margin:0 0 18px}
}
@media print{
  .dnc-shell,.dnc-page-head{display:none!important}
  body{padding-left:0!important}
}
@media (prefers-reduced-motion:reduce){ .dnc-link,.dnc-back,.dnc-cta,.dnc-acct{transition:none} }

/* ══ DNC responsive shell — R1 (2026-10-24) ═════════════════════════════════
   The same block in index.php and companies.php. One information architecture
   (the shared shell above), three presentations:
     ≥1024px        the permanent 240px sidebar — untouched by anything below
     600–1023px     the same sidebar as an off-canvas drawer, opened from the top bar
     <600px         compact top bar + four-item bottom navigation; Tools and
                    Account are bottom sheets; Quotation and Saved are pages.
   Nothing here applies at ≥1024px except hiding its own parts. */
.rsp-top,.rsp-nav,.rsp-sheet,.rsp-quick{
  --dnc-indigo:#4338ca; --dnc-indigo-hover:#3730a3; --dnc-indigo-soft:#eef0fd;
  --dnc-tangerine:#ff8a3d; --dnc-canvas:#f2f3f6; --dnc-surface:#ffffff; --dnc-sunken:#eceef2;
  --dnc-border:#e2e4ea; --dnc-ink:#161a23; --dnc-ink-2:#4d5463; --dnc-ink-3:#737a89;
  --dnc-font:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
}
.rsp-top,.rsp-nav,.rsp-sheet,.rsp-scrim,.rsp-quick,.rsp-close,.rsp-burger,.rsp-avatar-btn{display:none}
.rsp-scrim{position:fixed;inset:0;z-index:410;background:rgba(10,12,20,.45);opacity:0;visibility:hidden;pointer-events:none;
  transition:opacity .18s ease,visibility 0s linear .18s}
.rsp-scrim.is-open{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .18s ease,visibility 0s}
html.rsp-lock,html.rsp-lock body{overflow:hidden}
@media (max-width:1023px){
  :root{--header-h:58px}
  /* R2.2 iOS Home Screen app: iOS (26.1+, WebKit bug 301994) may draw a solid
     band between the status bar and the page that the page cannot reach (no
     safe-area inset is reported for it). iOS fills it with the PAGE background,
     which was the grey canvas, so it read as a blank grey gap above the white
     top bar. The root background is the top bar's white; body keeps the canvas.
     No padding is added: where iOS does report an inset, nothing doubles. */
  html{background:#ffffff}
  body{min-height:100vh;min-height:100dvh}
  .rsp-scrim{display:block}
  .rsp-top{display:flex;align-items:center;gap:6px;position:sticky;top:var(--banner-h,0px);z-index:250;height:58px;
    padding:0 max(10px,env(safe-area-inset-right,0px)) 0 max(10px,env(safe-area-inset-left,0px));
    background:var(--dnc-surface);border-bottom:1px solid var(--dnc-border);font-family:var(--dnc-font);color:var(--dnc-ink)}
  .rsp-brand{display:flex;align-items:center;gap:10px;min-width:0;min-height:44px;padding:0 4px;color:inherit;text-decoration:none;border-radius:8px}
  .rsp-brand .dnc-mark{width:30px;height:30px}
  .rsp-top .rsp-brand + *{margin-left:auto}
  .rsp-burger,.rsp-avatar-btn,.rsp-x{align-items:center;justify-content:center;width:44px;height:44px;flex-shrink:0;border:0;border-radius:10px;
    background:transparent;color:var(--dnc-ink-2);cursor:pointer;padding:0}
  .rsp-burger:hover,.rsp-avatar-btn:hover,.rsp-x:hover{background:var(--dnc-sunken)}
  .rsp-top .dnc-ico,.rsp-sheet .dnc-ico{width:20px;height:20px}
  .rsp-brand:focus-visible,.rsp-burger:focus-visible,.rsp-avatar-btn:focus-visible,.rsp-x:focus-visible,.rsp-close:focus-visible,
  .rsp-nav-item:focus-visible,.rsp-row:focus-visible,.rsp-chip:focus-visible{outline:2px solid var(--dnc-indigo);outline-offset:2px}
  .rsp-sheet-body .dnc-ico{color:var(--dnc-ink-3)}
}
/* ── 600–1023: the shared sidebar, off-canvas ── */
@media (min-width:600px) and (max-width:1023px){
  .rsp-burger{display:inline-flex}
  .dnc-shell{
    display:flex;flex-direction:column;position:fixed;z-index:420;top:0;bottom:0;left:0;
    width:320px;max-width:calc(100vw - 40px);height:100vh;height:100dvh;
    background:var(--dnc-surface);border-right:1px solid var(--dnc-border);
    box-shadow:0 0 40px rgb(22 26 35 / .22);
    color:var(--dnc-ink);font-family:var(--dnc-font);font-size:14px;line-height:1.4;-webkit-font-smoothing:antialiased;
    transform:translateX(-105%);visibility:hidden;
    transition:transform .2s ease,visibility 0s linear .2s;
  }
  .dnc-shell.is-open{transform:none;visibility:visible;transition:transform .2s ease,visibility 0s}
  .dnc-shell .dnc-brand{padding-right:60px}
  .rsp-close{display:inline-flex;align-items:center;justify-content:center;position:absolute;top:10px;right:10px;z-index:6;
    width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--dnc-ink-2);cursor:pointer;padding:0}
  .rsp-close:hover{background:var(--dnc-sunken)}
  .rsp-close .dnc-ico{width:20px;height:20px}
  .dnc-shell .dnc-lang-btn{height:36px}
}
/* ── <600: phone app shell ── */
@media (max-width:599px){
  :root{--rsp-nav-h:56px}
  .rsp-avatar-btn{display:inline-flex}
  .rsp-avatar-btn .dnc-avatar{width:34px;height:34px}
  .rsp-nav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:270;
    height:calc(var(--rsp-nav-h) + var(--sab,0px));padding:0 env(safe-area-inset-right,0px) var(--sab,0px) env(safe-area-inset-left,0px);
    background:var(--dnc-surface);border-top:1px solid var(--dnc-border);box-shadow:0 -4px 16px rgb(22 26 35 / .06);
    font-family:var(--dnc-font);transition:transform .18s ease}
  .rsp-nav-item{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
    height:var(--rsp-nav-h);padding:0 2px;border:0;background:transparent;font:inherit;font-size:11px;font-weight:500;line-height:1.2;
    color:var(--dnc-ink-3);text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .rsp-nav-item .dnc-ico{width:22px;height:22px}
  .rsp-nav-item > span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rsp-nav-item.is-active,.rsp-nav-item[aria-expanded="true"]{color:var(--dnc-indigo)}
  .rsp-nav-item.is-active::before{content:'';position:absolute;top:0;left:30%;right:30%;height:3px;border-radius:0 0 999px 999px;background:var(--dnc-tangerine)}
  html.kb-open .rsp-nav{transform:translateY(110%);pointer-events:none}
  /* the TOTAL / Save bar rides above the navigation, the page clears both */
  .mobile-bar{bottom:calc(var(--rsp-nav-h) + var(--sab,0px));padding-bottom:10px}
  .main{padding-bottom:calc(var(--bar-h,64px) + var(--rsp-nav-h) + var(--sab,0px) + 56px)}
  .toast{bottom:calc(var(--bar-h,64px) + var(--rsp-nav-h) + var(--sab,0px) + 16px)}
  body.rsp-page-plain{padding-bottom:calc(var(--rsp-nav-h) + var(--sab,0px) + 16px)}
  /* quick actions: compact, in the QUO control language */
  .rsp-quick{display:flex;gap:8px;font-family:var(--dnc-font)}
  .rsp-chip{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;height:40px;padding:0 8px;
    border:1px solid var(--dnc-border);border-radius:10px;background:var(--dnc-surface);color:var(--dnc-ink-2);
    font:inherit;font-size:13px;font-weight:500;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .rsp-chip.is-primary{flex:1.35 1 0;background:var(--dnc-indigo-soft);border-color:#d5d9f7;color:var(--dnc-indigo)}
  .rsp-chip .dnc-ico{width:16px;height:16px}
  .rsp-chip > span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rsp-chip:active{background:var(--dnc-sunken)} .rsp-chip.is-primary:active{background:#e0e7ff}
  /* bottom sheets: Tools and Account */
  .rsp-sheet{display:flex;flex-direction:column;position:fixed;left:0;right:0;bottom:0;z-index:430;
    max-height:min(82vh,calc(100dvh - 40px));background:var(--dnc-surface);color:var(--dnc-ink);font-family:var(--dnc-font);font-size:14px;
    border-radius:16px 16px 0 0;box-shadow:0 -12px 40px rgb(22 26 35 / .22);padding-bottom:var(--sab,0px);
    transform:translateY(105%);visibility:hidden;transition:transform .2s ease,visibility 0s linear .2s;outline:0}
  .rsp-sheet.is-open{transform:none;visibility:visible;transition:transform .2s ease,visibility 0s}
  .rsp-sheet-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 0 18px;min-height:52px}
  .rsp-sheet-title{font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--dnc-ink)}
  .rsp-x{display:inline-flex}
  .rsp-sheet-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:4px 10px 12px;display:flex;flex-direction:column;gap:2px}
  .rsp-row{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;flex-shrink:0;padding:0 10px;border:0;border-radius:10px;background:transparent;
    font:inherit;font-size:15px;font-weight:500;color:var(--dnc-ink);text-align:left;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .rsp-row:active{background:var(--dnc-sunken)}
  .rsp-row.is-static{cursor:default;color:var(--dnc-ink-2)} .rsp-row.is-static:active{background:transparent}
  .rsp-row > span{min-width:0}
  .rsp-row .dnc-mi-val{margin-left:auto}
  .rsp-sep{height:1px;margin:6px 10px;background:var(--dnc-border);flex-shrink:0}
  .rsp-ident{display:flex;align-items:center;gap:12px;padding:6px 10px 10px;flex-shrink:0}
  .rsp-ident .dnc-avatar{width:40px;height:40px;font-size:15px}
  .rsp-lang-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 10px;flex-shrink:0}
  .rsp-lang-row .dnc-lang{width:170px}
  .rsp-lang-row .dnc-lang-btn{height:40px}
  .rsp-lang-lbl{font-size:15px;font-weight:500;color:var(--dnc-ink)}
}
@media print{
  .rsp-top,.rsp-nav,.rsp-sheet,.rsp-scrim,.rsp-quick{display:none!important}
  body.rsp-page-plain{padding-bottom:0!important}
}
@media (prefers-reduced-motion:reduce){
  .dnc-shell,.rsp-sheet,.rsp-scrim,.rsp-nav{transition:none!important}
}


/* ═══════════════ R2.3 Session D — Saved / Companies on the phone (<600px) ═══════════════
   Search first: the four statistics collapse to one line (expand for the
   cards); the Recent Quotations heading the tab already names is not repeated;
   Add Company opens as a focused bottom sheet; cards tighter. Same data,
   same handlers, desktop untouched. */
.cp-sum-line{display:none}
@media (max-width:599px){
  .page-title{margin-bottom:8px}
  .page-title h2{font-size:20px}
  .page-title p{display:none}
  .mob-tab-bar .mob-tab{min-height:40px;font-size:13.5px;padding:6px 8px}
  .cp-sum-line{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;margin:0 0 10px;padding:6px 12px;border:1px solid var(--border);
    border-radius:var(--r-sm);background:var(--surface);color:var(--text-2);font:inherit;font-size:13px;font-weight:700;text-align:left;cursor:pointer}
  .cp-sum-line:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .cp-sum-line .cp-sum-chev{margin-left:auto;width:8px;height:8px;border-right:2px solid var(--text-muted);border-bottom:2px solid var(--text-muted);transform:rotate(-45deg);transition:transform .15s}
  .cp-sum-line[aria-expanded="true"] .cp-sum-chev{transform:rotate(45deg)}
  body:not(.cp-sum-open) #summaryGrid,body:not(.cp-sum-open) .summary-note{display:none!important}
  #rightPanel .rq-head{display:none}
  .item-search-tools,.company-tools{padding:10px!important;margin-bottom:10px!important}
  .item-search-hint{font-size:11.5px;margin-top:6px}
  #addCompanyForm:not([hidden]){position:fixed;left:0;right:0;bottom:0;z-index:440;margin:0!important;border-radius:16px 16px 0 0;
    max-height:min(88vh,calc(100dvh - 40px));overflow-y:auto;overscroll-behavior:contain;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));
    box-shadow:0 0 0 100vmax rgba(10,12,20,.45),0 -12px 40px rgb(22 26 35 / .22)}
  /* the pane's entrance animation leaves a transform that would pin a fixed sheet to the pane */
  body.cp-sheet-open .mob-pane{animation:none!important;transform:none!important}
  #addCompanyForm input,#addCompanyForm textarea{font-size:16px;min-height:44px}
  #addCompanyForm .btn{min-height:44px}
}   /* R2.4: this brace was lost when R2.3 Sessions D and E were merged (both ended on "}") */
/* ═══════════════ R2.3 Session E — one PWA shell geometry on Quotation and Saved ═══════════════
   The bottom navigation reads --sab (the home-indicator inset). index.php
   defines it; this page never did, so on an iPhone the Saved navigation had
   no home-indicator padding and sat ~34px lower than Quotation's — the "slightly
   different position" the owner saw. Same definition, same viewport-fit=cover
   as Quotation, and the side insets for landscape. */
:root{--sab:env(safe-area-inset-bottom,0px)}
@media (max-width:1023px){
  .wrap{padding-left:max(18px,env(safe-area-inset-left,0px))!important;padding-right:max(18px,env(safe-area-inset-right,0px))!important}
}
:root{--hi-check:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m4.5 12.75 6 6 9-13.5'/%3E%3C/svg%3E");--hi-pencil:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10'/%3E%3C/svg%3E")}

/* ═══════════════ R2.4 Session E — Heroicons (v2.2.0, MIT, self-hosted sprite) ═══════════════
   One icon language: <svg class="hi"><use href="#hi-NAME"/></svg> from the
   inline sprite (no CDN, only the icons used). Outline by default; the bottom
   navigation shows the solid variant for the current / open item. */
.hi{display:inline-block;width:1.2em;height:1.2em;flex-shrink:0;vertical-align:-.22em;overflow:visible}
.hi-18{width:18px;height:18px}.hi-20{width:20px;height:20px}.hi-24{width:24px;height:24px}.hi-28{width:28px;height:28px}
.dc-ic{display:inline-block;width:1.15em;height:1.15em;flex-shrink:0;vertical-align:-.2em;margin-right:.3em}
.dc-ic.ic-ok{color:#15803d}.dc-ic.ic-warn{color:#b45309}.dc-ic.ic-bad{color:#b91c1c}.dc-ic.ic-info{color:var(--accent-2,#4338ca)}
.dc-ic.ic-trail{margin-right:0;margin-left:.3em}
.dnc-ico.hi-s{display:none}
.rsp-nav-item.is-active .dnc-ico.hi-o,.rsp-nav-item[aria-expanded="true"] .dnc-ico.hi-o{display:none}
.rsp-nav-item.is-active .dnc-ico.hi-s,.rsp-nav-item[aria-expanded="true"] .dnc-ico.hi-s{display:block}
.rsp-nav-item .dnc-ico{width:24px!important;height:24px!important}
.dnc-shell .dnc-link .dnc-ico{width:20px;height:20px}
.modal-close .hi,.uc-x .hi{width:20px;height:20px;vertical-align:middle}
/* glyphs drawn by CSS: the same Heroicons, as masks */
.step-pill.done .step-num::before{content:''!important;display:inline-block;width:14px;height:14px;background:currentColor;-webkit-mask:var(--hi-check) center/contain no-repeat;mask:var(--hi-check) center/contain no-repeat}
.qi-edit-mode-note.show::before{content:''!important;display:inline-block;width:16px;height:16px;margin-right:6px;vertical-align:-3px;background:currentColor;-webkit-mask:var(--hi-pencil) center/contain no-repeat;mask:var(--hi-pencil) center/contain no-repeat}
.wqa-gx::after{content:''!important;width:10px;height:10px;background:currentColor;-webkit-mask:var(--hi-pencil) center/contain no-repeat;mask:var(--hi-pencil) center/contain no-repeat}
@media print{ .dc-ic,.hi{display:none!important} }

/* ═══════════════ R2.4 Session C — compact quotation cards on the phone (<600px) ═══════════════
   Same cards, same data, same handlers. The quotation number leads with the
   date beside it, then the company, one line of product description, and one
   row for the Reference Total (labelled as reference, never an order amount)
   with View and Load. Duplicate and Delete leave the card on the phone and
   live in the View dialog (Delete still asks); desktop keeps them. */
#viewModal .vm-more{display:none}
@media (max-width:599px){
  .rq-card .rq-card-top,.q-card .q-card-top{padding:10px 12px 6px!important}
  .rq-card .rq-card-bot,.q-card .q-card-bottom{padding:6px 12px 10px!important;display:flex!important;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border)}
  .rq-top,.q-top{margin-bottom:2px!important}
  .rq-top > div,.q-top > div{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;row-gap:1px;width:100%;align-items:baseline}
  .rq-no,.q-no{font-size:15px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rq-date,.q-dates{grid-column:2;grid-row:1;font-size:12px;color:var(--text-muted);white-space:nowrap;display:inline-flex;align-items:center;gap:3px}
  .rq-company{grid-column:1/-1;font-size:13px;font-weight:700;min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
  .rq-company .hi,.rq-date .hi{width:14px;height:14px;flex-shrink:0;vertical-align:-2px}
  .rq-preview{font-size:12.5px;color:var(--text-2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rq-total,.q-card .ref-total{display:flex;flex-direction:column;line-height:1.2;min-width:0}
  .rq-total br,.q-card .ref-total br{display:none}
  .rq-total b,.q-card .ref-total b{font-size:15px;white-space:nowrap}
  .rq-total .ref-total-label,.q-card .ref-total-label{font-size:10.5px}
  .rq-actions,.q-card .quote-actions{display:flex!important;flex-direction:row!important;gap:6px;margin-left:auto;flex-wrap:nowrap}
  .rq-actions .btn,.q-card .quote-actions .btn{min-height:44px;padding:0 12px;font-size:13.5px;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
  .q-card .quote-actions .btn-ghost,.q-card .quote-actions .btn-danger{display:none!important}
  .q-card .q-meta{font-size:12px;gap:4px 10px}
  .q-card .q-preview .item-line{font-size:12.5px}
  .q-card .q-remarks{font-size:12px;margin:4px 0 0}
  #viewModal .vm-more{display:inline-flex}
  #viewModal .modal-btns{flex-wrap:wrap;gap:8px}
  #viewModal .modal-btns .btn{min-height:44px}
  /* a selected company: its four figures as a compact 2 × 2, not four full-width boxes */
  .sp-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin-top:10px!important}
  .sp-stat{padding:7px 10px!important;min-width:0}
  .sp-stat *{overflow-wrap:anywhere}
}

/* ═══════════════ R2.4 Session D — PWA responsive / final polish ═══════════════
   Phones: every control a 44px target; a dialog never taller than the screen —
   it scrolls inside itself with its title and Close pinned, so Close is always
   in reach. Tablet: one input height. Same controls and handlers. */
@media (max-width:599px){
  .rsp-chip,.mob-tab,.cp-sum-line,.cp-break,.acc-sum,.uc-open,.step-pill{min-height:44px!important}
  .dp-status .dp-edit{min-height:44px;display:inline-flex;align-items:center;padding:0 6px;font-size:12.5px}
  .modal-close{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}
  .modal-overlay.open{padding-top:12px;padding-bottom:12px}   /* was 5vh: the box is now capped to the screen instead */
  .modal-overlay.open .modal{max-height:calc(100dvh - 24px);margin-bottom:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
  .modal-overlay.open .modal > .modal-title,.modal-overlay.open .modal > .modal-header{position:sticky;top:0;z-index:3;background:var(--surface);
    margin-top:0;padding-top:4px;padding-bottom:6px}
}
@media (min-width:600px) and (max-width:1023px){
  #step1Card .qi-edit .field input,#step1Card .qi-edit .field select,
  #step2Card .item-form.active .field input:not([type=radio]):not([type=checkbox]),#step2Card .item-form.active .field select{height:42px;min-height:42px}
}

/* ═══════════════ R2.5 Session B — the View dialog (#03 phone, #16 desktop) ═══════════════
   One structure for every width: a header (title, quotation number, Close), a
   body that is the ONLY scrolling region (details, then the items), and an
   action bar that never scrolls away. Read-only: nothing here writes or reprices.
   Phone — Load & Edit full width, Duplicate / Delete side by side under it,
   Close at the top. Desktop — one item: a comfortable 640px; several items: a
   wider dialog with a column per figure. Money never splits from its "RM". */
#viewModal .vm-box{display:flex;flex-direction:column;padding:0;overflow:hidden;max-width:640px;max-height:calc(100dvh - 48px)}
#viewModal .vm-box.vm-wide{max-width:min(920px,calc(100vw - 48px))}
#viewModal .vm-head{position:static;margin:0;padding:12px 12px 10px 20px;border-bottom:1px solid var(--border);flex:0 0 auto;align-items:center;gap:12px;background:var(--surface)}
#viewModal .vm-head-t{display:flex;flex-direction:column;min-width:0;gap:1px}
#viewModal #vmTitle{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
#viewModal .vm-ref{font-size:17px;font-weight:900;color:var(--accent);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#viewModal .vm-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px 20px 12px}
#viewModal .vm-actions{flex:0 0 auto;margin:0!important;padding:12px 20px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border);background:var(--surface);justify-content:flex-end}
#viewModal .vm-actions .btn{flex:0 0 auto;min-width:120px;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px}
#viewModal .vm-actions .vm-more{display:none}   /* desktop keeps Duplicate / Delete on the card (R2.4) */
#viewModal .vm-box:focus{outline:none}
#viewModal .vm-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;background:var(--surface2);border-radius:var(--r-sm);padding:10px 12px;margin:0 0 12px;font-size:13px}
#viewModal .vm-meta > div{min-width:0;margin:0}
#viewModal .vm-meta dt{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)}
#viewModal .vm-meta dd{margin:1px 0 0;font-weight:650;overflow-wrap:anywhere}
#viewModal .vm-meta .full{grid-column:1/-1}
#viewModal .vm-count{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin:0 0 2px}
#viewModal .vm-items{list-style:none;margin:0;padding:0}
#viewModal .vm-item{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;row-gap:2px;padding:9px 0;border-bottom:1px solid var(--border)}
#viewModal .vm-item:last-child{border-bottom:0}
#viewModal .vm-name{grid-column:1;font-size:13.5px;font-weight:800;color:var(--text);overflow-wrap:break-word}
#viewModal .vm-name .q-detail-chip{margin-left:4px;vertical-align:1px}
#viewModal .vm-dims{grid-column:1/-1;font-size:12.5px;color:var(--text-2);overflow-wrap:anywhere}
#viewModal .vm-qp{grid-column:1/-1;font-size:12.5px;color:var(--text-muted);font-variant-numeric:tabular-nums}
#viewModal .vm-acc{grid-column:1/-1;font-size:11.5px;color:var(--text-muted)}
#viewModal .vm-amt{grid-column:2;grid-row:1;font-weight:800;color:var(--green);text-align:right;font-variant-numeric:tabular-nums}
#viewModal .money{white-space:nowrap}
#viewModal .vm-total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:6px;padding-top:10px;border-top:2px solid var(--border);font-weight:800}
#viewModal .vm-total .money{font-size:18px;color:var(--green);font-variant-numeric:tabular-nums}
@media (min-width:600px){
  #viewModal .vm-wide .vm-item{grid-template-columns:minmax(0,1.15fr) minmax(0,1.35fr) minmax(150px,auto) minmax(104px,auto);align-items:baseline}
  #viewModal .vm-wide .vm-name{grid-column:1;grid-row:1}
  #viewModal .vm-wide .vm-dims{grid-column:2;grid-row:1}
  #viewModal .vm-wide .vm-qp{grid-column:3;grid-row:1;text-align:right}
  #viewModal .vm-wide .vm-acc{grid-column:3;grid-row:2;text-align:right}
  #viewModal .vm-wide .vm-amt{grid-column:4;grid-row:1}
  #viewModal .vm-wide .vm-meta{grid-template-columns:repeat(4,minmax(0,1fr))}
  #viewModal .vm-wide .vm-meta .full{grid-column:span 2}
}
@media (max-width:599px){
  #viewModal.modal-overlay.open{padding:12px max(10px,env(safe-area-inset-right,0px)) 12px max(10px,env(safe-area-inset-left,0px))}
  #viewModal .vm-box,#viewModal .vm-box.vm-wide{max-width:none;max-height:calc(100dvh - 24px);overflow:hidden}
  #viewModal .vm-head{position:static;padding:8px 6px 8px 16px}
  #viewModal .vm-body{padding:12px 14px 10px}
  #viewModal .vm-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px))}
  #viewModal .vm-actions .btn{min-width:0;min-height:44px;width:100%;padding:0 10px}
  #viewModal .vm-actions .vm-load{grid-column:1/-1}
  #viewModal .vm-actions .vm-more{display:inline-flex}
  #viewModal .vm-actions .vm-close{display:none}
}
</style>
</head>
<body class="rsp-page-plain">
<!-- HEROICONS-SPRITE v2.2.0 (https://heroicons.com) - MIT License, Copyright (c) Tailwind Labs, Inc.
     Full text: assets/icons/HEROICONS-LICENSE.txt. Built by tests/tools/build-heroicons-sprite.py; do not edit by hand. -->
<svg id="dcHeroSprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">
<symbol id="hi-x-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></symbol>
<symbol id="hi-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></symbol>
<symbol id="hi-document-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></symbol>
<symbol id="hi-document-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></symbol>
<symbol id="hi-building-office-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"/></symbol>
<symbol id="hi-building-office" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></symbol>
<symbol id="hi-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"/> <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z"/></symbol>
<symbol id="hi-adjustments-horizontal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/></symbol>
<symbol id="hi-book-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></symbol>
<symbol id="hi-clipboard-document-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75"/></symbol>
<symbol id="hi-clipboard-document-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"/></symbol>
<symbol id="hi-sparkles" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/></symbol>
<symbol id="hi-information-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></symbol>
<symbol id="hi-arrow-right-start-on-rectangle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"/></symbol>
<symbol id="hi-bars-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></symbol>
<symbol id="hi-bookmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/></symbol>
<symbol id="hi-wrench-screwdriver" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"/></symbol>
<symbol id="hi-user-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></symbol>
<symbol id="hi-ellipsis-horizontal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></symbol>
<symbol id="hi-check-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></symbol>
<symbol id="hi-exclamation-triangle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></symbol>
<symbol id="hi-x-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></symbol>
<symbol id="hi-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></symbol>
<symbol id="hi-chat-bubble-left-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/></symbol>
<symbol id="hi-photo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></symbol>
<symbol id="hi-magnifying-glass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></symbol>
<symbol id="hi-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></symbol>
<symbol id="hi-document-duplicate" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"/></symbol>
<symbol id="hi-light-bulb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"/></symbol>
<symbol id="hi-folder-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"/></symbol>
<symbol id="hi-inbox" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"/></symbol>
<symbol id="hi-pencil-square" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/></symbol>
<symbol id="hi-cube" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></symbol>
<symbol id="hi-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/> <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></symbol>
<symbol id="hi-calendar-days" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/></symbol>
<symbol id="hi-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></symbol>
<symbol id="hi-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></symbol>
<symbol id="hi-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></symbol>
<symbol id="hi-calculator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z"/></symbol>
<symbol id="hi-arrows-right-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></symbol>
<symbol id="hi-puzzle-piece" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z"/></symbol>
<symbol id="hi-printer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"/></symbol>
<symbol id="hi-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></symbol>
<symbol id="hi-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></symbol>
<symbol id="his-document-text" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clip-rule="evenodd"/> <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z"/></symbol>
<symbol id="his-bookmark" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clip-rule="evenodd"/></symbol>
<symbol id="his-wrench-screwdriver" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 6.75a5.25 5.25 0 0 1 6.775-5.025.75.75 0 0 1 .313 1.248l-3.32 3.319c.063.475.276.934.641 1.299.365.365.824.578 1.3.64l3.318-3.319a.75.75 0 0 1 1.248.313 5.25 5.25 0 0 1-5.472 6.756c-1.018-.086-1.87.1-2.309.634L7.344 21.3A3.298 3.298 0 1 1 2.7 16.657l8.684-7.151c.533-.44.72-1.291.634-2.309A5.342 5.342 0 0 1 12 6.75ZM4.117 19.125a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008Z" clip-rule="evenodd"/> <path d="m10.076 8.64-2.201-2.2V4.874a.75.75 0 0 0-.364-.643l-3.75-2.25a.75.75 0 0 0-.916.113l-.75.75a.75.75 0 0 0-.113.916l2.25 3.75a.75.75 0 0 0 .643.364h1.564l2.062 2.062 1.575-1.297Z"/> <path fill-rule="evenodd" d="m12.556 17.329 4.183 4.182a3.375 3.375 0 0 0 4.773-4.773l-3.306-3.305a6.803 6.803 0 0 1-1.53.043c-.394-.034-.682-.006-.867.042a.589.589 0 0 0-.167.063l-3.086 3.748Zm3.414-1.36a.75.75 0 0 1 1.06 0l1.875 1.876a.75.75 0 1 1-1.06 1.06L15.97 17.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></symbol>
<symbol id="his-user-circle" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clip-rule="evenodd"/></symbol>
</svg>
<!-- /HEROICONS-SPRITE -->
<!-- ══ DNC shared desktop shell (≥1024px). The same block, byte for byte, in
     index.php and companies.php; only the active item differs. Below 1024px it
     is not shown and the page keeps its own header and off-canvas menu. ══ -->
<aside class="dnc-shell" id="dncShell" data-i18n-aria="shellNav" aria-label="DNC navigation">
  <button type="button" class="rsp-close" data-i18n-aria="rspClose" aria-label="Close" onclick="rspClose()"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-x-mark"/></svg></button>
  <a class="dnc-brand" href="index.php" data-i18n-aria="shellHome" aria-label="DNC Quotation — home">
    <img class="dnc-mark" src="assets/icons/dnc-logo.svg" alt="" aria-hidden="true">
    <span class="dnc-brand-text"><span class="dnc-brand-sys">DNC</span><span class="dnc-brand-mod">QUOTATION</span></span>
  </a>
  <div class="dnc-back-wrap">
    <a class="dnc-back" id="dncBack" href="https://portal.dnchardware.com"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-arrow-left"/></svg><span data-i18n="shellBack">Back to Workspace</span></a>
  </div>
  <div class="dnc-cta-wrap">
    <button type="button" class="dnc-cta" id="dncNew" onclick="dcShellNew()"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-document-plus"/></svg><span data-i18n="shellNewQuotation">New Quotation</span></button>
  </div>
  <nav class="dnc-nav">
    <p class="dnc-sec" data-i18n="shellModules">Quotation</p>
    <a class="dnc-link" data-shell="quotations" href="index.php"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-document-text"/></svg><span data-i18n="shellQuotations">Quotations</span></a>
    <p class="dnc-sec" data-i18n="shellQuoTools">Quotation Tools</p>
    <a class="dnc-link is-active" aria-current="page" data-shell="companies" href="companies.php"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-building-office-2"/></svg><span data-i18n="shellCompaniesSaved">Companies &amp; Saved</span></a>
    <button type="button" class="dnc-link" data-shell="dp" onclick="dcShellTool('dp')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-tag"/></svg><span data-i18n="shellDefaultPrices">Default Prices</span></button>
    <button type="button" class="dnc-link" data-shell="ds" onclick="dcShellTool('ds')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-adjustments-horizontal"/></svg><span data-i18n="shellDiameterSettings">Diameter Settings</span></button>
    <button type="button" class="dnc-link" data-shell="ref" onclick="dcShellTool('ref')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-book-open"/></svg><span data-i18n="shellPricingGuide">Pricing Guide</span></button>
    <p class="dnc-sec" data-i18n="shellOtherModules">Other Modules</p>
    <a class="dnc-link" data-shell="ipo" href="https://po.dnchardware.com/auth/handoff/start" onclick="return dcShellLeave(event,this.href)"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-clipboard-document-check"/></svg><span data-i18n="shellIpo">Internal Purchase Orders</span></a>
  </nav>
  <div class="dnc-bottom">
    <div class="dnc-lang" role="group" data-i18n-aria="langAria" aria-label="Language">
      <button type="button" class="dnc-lang-btn" data-lang-set="en" aria-pressed="true" onclick="dcSetLang('en')">EN</button>
      <button type="button" class="dnc-lang-btn" data-lang-set="zh" aria-pressed="false" onclick="dcSetLang('zh')">中文</button>
    </div>
    <div class="dnc-menu" id="dncMenu" role="menu" hidden>
      <button type="button" class="dnc-mi" role="menuitem" onclick="dcShellToggleMenu(false);dcShellTool('whatsnew')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-sparkles"/></svg><span data-i18n="shellWhatsNew">What's New</span></button>
      <div class="dnc-mi is-static" role="menuitem" aria-disabled="true"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-information-circle"/></svg><span data-i18n="shellSystemVersion">System Version</span><span class="dnc-mi-val" id="dncSysVer" data-i18n-skip>…</span></div>
      <div class="dnc-mi-sep" role="separator"></div>
      <a class="dnc-mi" role="menuitem" href="logout.php"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-arrow-right-start-on-rectangle"/></svg><span data-i18n="shellSignOut">Sign Out</span></a>
    </div>
    <button type="button" class="dnc-acct" id="dncAcctBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="dncMenu"
            data-i18n-aria="shellAccountMenu" aria-label="Account menu" onclick="dcShellToggleMenu()">
      <span class="dnc-avatar" id="dncAvatar" aria-hidden="true" data-i18n-skip>·</span>
      <span class="dnc-acct-text" data-i18n-skip><span class="dnc-acct-name" id="dncAcctName"></span><span class="dnc-acct-user" id="dncAcctUser"></span></span>
      <svg class="dnc-ico dnc-ico-sub" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
    </button>
  </div>
</aside>
<script>/* The signed-in identity, for the shell's account block only. */
window.DC_SHELL_USER=<?= json_encode((function(){ $u=dc_current_user(); return $u ? ['name'=>$u['display_name'],'username'=>$u['username']] : null; })(), JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE) ?>;</script>

<!-- ══ DNC responsive shell (<1024px) — R1. The same block in index.php and
     companies.php. Tablet (600–1023px) opens #dncShell above as a drawer; phones
     (<600px) get the compact top bar, the bottom navigation and the two sheets. ══ -->
<div class="rsp-top" id="rspTop">
  <button type="button" class="rsp-burger" id="rspBurger" aria-expanded="false" aria-controls="dncShell" data-i18n-aria="rspOpenMenu" aria-label="Open menu" onclick="rspOpen('drawer')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-bars-3"/></svg></button>
  <a class="rsp-brand" href="index.php" data-i18n-aria="shellHome" aria-label="DNC Quotation — home">
    <img class="dnc-mark" src="assets/icons/dnc-logo.svg" alt="" aria-hidden="true">
    <span class="dnc-brand-text"><span class="dnc-brand-sys">DNC</span><span class="dnc-brand-mod">QUOTATION</span></span>
  </a>
  <button type="button" class="rsp-avatar-btn" id="rspAvatarBtn" aria-expanded="false" aria-controls="rspAcct" data-i18n-aria="shellAccountMenu" aria-label="Account menu" onclick="rspOpen('account')"><span class="dnc-avatar" id="rspAvatarTop" aria-hidden="true" data-i18n-skip>·</span></button>
</div>
<nav class="rsp-nav" id="rspNav" data-i18n-aria="rspMainNav" aria-label="Main navigation">
  <a class="rsp-nav-item" href="index.php"><svg class="dnc-ico hi-o" aria-hidden="true" focusable="false"><use href="#hi-document-text"/></svg><svg class="dnc-ico hi-s" aria-hidden="true" focusable="false"><use href="#his-document-text"/></svg><span data-i18n="rspNavQuotation">Quotation</span></a>
  <button type="button" class="rsp-nav-item is-active" aria-current="page" onclick="rspTop()"><svg class="dnc-ico hi-o" aria-hidden="true" focusable="false"><use href="#hi-bookmark"/></svg><svg class="dnc-ico hi-s" aria-hidden="true" focusable="false"><use href="#his-bookmark"/></svg><span data-i18n="rspNavSaved">Saved</span></button>
  <button type="button" class="rsp-nav-item" id="rspNavTools" aria-expanded="false" aria-controls="rspTools" onclick="rspOpen('tools')"><svg class="dnc-ico hi-o" aria-hidden="true" focusable="false"><use href="#hi-wrench-screwdriver"/></svg><svg class="dnc-ico hi-s" aria-hidden="true" focusable="false"><use href="#his-wrench-screwdriver"/></svg><span data-i18n="rspNavTools">Tools</span></button>
  <button type="button" class="rsp-nav-item" id="rspNavAccount" aria-expanded="false" aria-controls="rspAcct" onclick="rspOpen('account')"><svg class="dnc-ico hi-o" aria-hidden="true" focusable="false"><use href="#hi-user-circle"/></svg><svg class="dnc-ico hi-s" aria-hidden="true" focusable="false"><use href="#his-user-circle"/></svg><span data-i18n="rspNavAccount">Account</span></button>
</nav>
<div class="rsp-scrim" id="rspScrim" onclick="rspClose()"></div>
<div class="rsp-sheet" id="rspTools" role="dialog" aria-modal="true" aria-labelledby="rspToolsTitle" tabindex="-1">
  <div class="rsp-sheet-head"><h2 class="rsp-sheet-title" id="rspToolsTitle" data-i18n="rspNavTools">Tools</h2><button type="button" class="rsp-x" data-i18n-aria="rspClose" aria-label="Close" onclick="rspClose()"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-x-mark"/></svg></button></div>
  <div class="rsp-sheet-body">
    <button type="button" class="rsp-row rsp-go" onclick="dcShellTool('dp')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-tag"/></svg><span data-i18n="shellDefaultPrices">Default Prices</span></button>
    <button type="button" class="rsp-row rsp-go" onclick="dcShellTool('ds')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-adjustments-horizontal"/></svg><span data-i18n="shellDiameterSettings">Diameter Settings</span></button>
    <button type="button" class="rsp-row rsp-go" onclick="dcShellTool('ref')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-book-open"/></svg><span data-i18n="shellPricingGuide">Pricing Guide</span></button>
    <a class="rsp-row rsp-go" href="https://po.dnchardware.com/auth/handoff/start" onclick="return dcShellLeave(event,this.href)"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-clipboard-document-check"/></svg><span data-i18n="shellIpo">Internal Purchase Orders</span></a>
  </div>
</div>
<div class="rsp-sheet" id="rspAcct" role="dialog" aria-modal="true" aria-labelledby="rspAcctTitle" tabindex="-1">
  <div class="rsp-sheet-head"><h2 class="rsp-sheet-title" id="rspAcctTitle" data-i18n="rspNavAccount">Account</h2><button type="button" class="rsp-x" data-i18n-aria="rspClose" aria-label="Close" onclick="rspClose()"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-x-mark"/></svg></button></div>
  <div class="rsp-sheet-body">
    <div class="rsp-ident" data-i18n-skip><span class="dnc-avatar" id="rspAcctAvatar" aria-hidden="true">·</span><span class="dnc-acct-text"><span class="dnc-acct-name" id="rspAcctName"></span><span class="dnc-acct-user" id="rspAcctUser"></span></span></div>
    <div class="rsp-lang-row"><span class="rsp-lang-lbl" data-i18n="language">Language</span>
      <div class="dnc-lang" role="group" data-i18n-aria="langAria" aria-label="Language">
        <button type="button" class="dnc-lang-btn" data-lang-set="en" aria-pressed="true" onclick="dcSetLang('en')">EN</button>
        <button type="button" class="dnc-lang-btn" data-lang-set="zh" aria-pressed="false" onclick="dcSetLang('zh')">中文</button>
      </div></div>
    <div class="rsp-sep" role="separator"></div>
    <button type="button" class="rsp-row rsp-go" onclick="dcShellTool('whatsnew')"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-sparkles"/></svg><span data-i18n="shellWhatsNew">What's New</span></button>
    <div class="rsp-row is-static"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-information-circle"/></svg><span data-i18n="shellSystemVersion">System Version</span><span class="dnc-mi-val" id="rspSysVer" data-i18n-skip>…</span></div>
    <a class="rsp-row rsp-go" href="https://portal.dnchardware.com"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-arrow-left"/></svg><span data-i18n="shellBack">Back to Workspace</span></a>
    <div class="rsp-sep" role="separator"></div>
    <a class="rsp-row" href="logout.php"><svg class="dnc-ico" aria-hidden="true" focusable="false"><use href="#hi-arrow-right-start-on-rectangle"/></svg><span data-i18n="shellSignOut">Sign Out</span></a>
  </div>
</div>

<div class="wrap" style="display:block;max-width:1240px">

  <!-- Shared page header (desktop shell): the module's page title, nothing else. -->
    <div class="dnc-page-head">
      <div class="dnc-page-head-text">
        <h1 class="dnc-page-title" data-i18n="shellPageCompanies">Companies &amp; Saved</h1>
        <p class="dnc-page-sub" data-i18n="pageCompaniesSub">Manage customers &amp; saved quotations</p>
      </div>
    </div>

  <!-- Page identity lives in the content area; the header carries the global brand -->
  <div class="page-title">
    <h2 data-i18n="pageCompanies">Companies</h2>
    <p data-i18n="pageCompaniesSub">Manage customers &amp; saved quotations</p>
  </div>

  <!-- Mobile tabs (≤980px only) -->
  <div class="mob-tab-bar" id="mobTabBar">
    <button class="mob-tab active" id="mobTabRecent" onclick="switchMobTab('recent')" data-i18n="tabRecent">📋 Recent Quotations</button>
    <button class="mob-tab" id="mobTabCustomers" onclick="switchMobTab('customers')" data-i18n="tabCustomers">🏢 Customers</button>
  </div>

  <!-- Dashboard summary (phones: one line, the cards on demand) -->
  <button type="button" class="cp-sum-line" id="cpSumLine" aria-expanded="false" aria-controls="summaryGrid" onclick="cpSumToggle()"><span id="cpSumText"></span><span class="cp-sum-chev" aria-hidden="true"></span></button>
  <div class="summary-grid" id="summaryGrid"></div>
  <div class="summary-note" data-i18n="summaryNote">💡 Quotation total is reference only — actual order quantity may differ.</div>

  <div class="cp-main-grid">

    <!-- Left: customer search + sort, Add Company, company cards -->
    <div id="mobPaneCustomers" class="mob-pane">
      <!-- The customer search lives with the list it filters: companies, phones
           and quotation numbers only. Item keywords belong to the right pane. -->
      <div class="card company-tools">
        <div class="search-bar">
          <div class="search-input-wrap">
            <span class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-magnifying-glass"/></svg></span>
            <input type="text" id="searchInput" data-i18n-ph="phSearchCompany" placeholder="Search company, phone, quotation no." autocomplete="off"
                   oninput="onCpSearchInput()"
                   onkeydown="if(event.key==='Enter'){event.preventDefault();cpSearchSubmit();}">
          </div>
          <select class="cp-sort-select" id="sortSelect" onchange="renderCompanyCards()">
            <option value="latest" data-i18n="sortLatest">Sort: Latest First</option>
            <option value="name" data-i18n="sortAZ">Sort: Company A–Z</option>
            <option value="count" data-i18n="sortMost">Sort: Most Quotations</option>
          </select>
        </div>
        <div class="cp-search-result" id="cpSearchResult" hidden></div>
      </div>

      <button class="btn btn-primary btn-company-primary" id="addCompanyToggleBtn" style="width:100%;margin-bottom:12px" onclick="toggleAddCompanyForm()"><span data-i18n="addCompanyBtn">＋ Add Company</span></button>

      <div class="card" id="addCompanyForm" hidden style="margin-bottom:14px">
        <div class="section-label"><span class="sl-icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-plus"/></svg></span><span data-i18n="addCompany">Add Company</span></div>
        <div class="field"><label data-i18n="lblCompanyName">Company Name *</label><input type="text" id="c-name" data-i18n-ph="phCompanyEg" placeholder="e.g. SL Struktur Sdn Bhd"></div>
        <div class="field"><label data-i18n="lblShortCode">Short Code</label><input type="text" id="c-code" data-i18n-ph="phShortEg" placeholder="e.g. SLSPJ" style="text-transform:uppercase"></div>
        <div class="field"><label data-i18n="lblPhone">Phone</label><input type="text" id="c-phone" data-i18n-ph="phPhoneEg" placeholder="03-XXXX XXXX"></div>
        <div class="field"><label data-i18n="lblAddress">Address</label><textarea id="c-addr" rows="2" data-i18n-ph="phOptional" placeholder="Optional"></textarea></div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-primary btn-company-primary" style="flex:1" onclick="addCompany()"><span data-i18n="addCompanyBtn">＋ Add Company</span></button>
          <button class="btn btn-ghost" style="flex:1" onclick="closeAddCompanyForm()" data-i18n="cancel">Cancel</button>
        </div>
      </div>

      <div class="list-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="section-label" style="margin-bottom:0;padding-bottom:0;border-bottom:none"><span class="sl-icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-building-office-2"/></svg></span><span data-i18n="secCompanies">Companies</span></div>
        <span class="list-count" id="companyCount">0</span>
      </div>
      <div id="companyList"><div class="empty-state"><div class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-building-office-2"/></svg></div><p><span data-i18n="msgNoCompanies">No companies yet</span> <span class="sub" data-i18n="msgNoCompanies">No companies yet</span></p></div></div>
    </div>

    <!-- Right: Recent Quotations (default) or Selected company panel -->
    <div id="mobPaneRecent" class="mob-pane mob-pane-active">
    <!-- Item price-history search sits with the quotation history it searches.
         It never filters the Companies list and never switches panes. -->
    <div class="card item-search-tools">
      <div class="search-input-wrap">
        <span class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-magnifying-glass"/></svg></span>
        <input type="text" id="itemSearchInput" data-i18n-ph="phSearchItem" placeholder="Search item, material, size, product..." autocomplete="off"
               oninput="onItemSearchInput()"
               onkeydown="if(event.key==='Enter'){event.preventDefault();itemSearchSubmit();}">
      </div>
      <p class="item-search-hint"><span data-i18n="itemSearchHint">Past quoted prices — try “M16 J BOLT”, “4140”, “Y BAR”</span></p>
      <div class="cp-search-result" id="itemSearchResult" hidden></div>
    </div>
    <div id="rightPanel">
      <div class="empty-state empty-state-compact">
        <div class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-clipboard-document-list"/></svg></div>
        <p data-i18n="cpLoadingRecent">Loading recent quotations…</p>
      </div>
    </div>
    </div><!-- /mobPaneRecent -->

  </div>

</div>

<!-- Edit Company Modal -->
<div class="modal-overlay" id="editCompanyModal">
  <div class="modal">
    <div class="modal-title">✏️ <span data-i18n="editCompany">Edit Company</span> <button class="modal-close" onclick="closeModal('editCompanyModal')" aria-label="Close" data-i18n-aria="rspClose"><svg class="hi hi-20" aria-hidden="true" focusable="false"><use href="#hi-x-mark"/></svg></button></div>
    <input type="hidden" id="ec-id">
    <div class="field"><label data-i18n="lblCompanyName">Company Name *</label><input type="text" id="ec-name"></div>
    <div class="field"><label data-i18n="lblShortCode">Short Code</label><input type="text" id="ec-code"></div>
    <div class="field"><label data-i18n="lblPhone">Phone</label><input type="text" id="ec-phone"></div>
    <div class="field"><label data-i18n="lblAddress">Address</label><textarea id="ec-addr" rows="2"></textarea></div>
    <div class="modal-btns">
      <button class="btn btn-primary" onclick="saveEditCompany()"><span data-i18n="save">💾 Save</span></button>
      <button class="btn btn-ghost" onclick="closeModal('editCompanyModal')" data-i18n="cancel">Cancel</button>
    </div>
  </div>
</div>

<!-- View Quotation Modal -->
<div class="modal-overlay" id="viewModal">
  <div class="modal vm-box" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="vmTitle">
    <div class="modal-title vm-head">
      <div class="vm-head-t"><span id="vmTitle" data-i18n="quotationDetail">Quotation Detail</span><span class="vm-ref" id="vmRef"></span></div>
      <button class="modal-close" type="button" onclick="cpCloseView()" aria-label="Close" data-i18n-aria="rspClose"><svg class="hi hi-20" aria-hidden="true" focusable="false"><use href="#hi-x-mark"/></svg></button>
    </div>
    <div id="viewModalBody" class="vm-body"></div>
    <div class="modal-btns vm-actions">
      <button class="btn btn-amber vm-load" type="button" onclick="loadAndGo()">📂 <span data-i18n="loadAndEdit">Load &amp; Edit</span></button>
      <!-- R2.4: on the phone Duplicate and Delete live here, not on the card -->
      <button class="btn btn-ghost vm-more" type="button" onclick="cpViewDuplicate()"><span data-i18n="cpDuplicate">📄 Duplicate</span></button>
      <button class="btn btn-danger vm-more" type="button" onclick="cpViewDelete()"><span data-i18n="cpDelete">🗑️ Delete</span></button>
      <button class="btn btn-ghost vm-close" type="button" onclick="cpCloseView()" data-i18n="close">Close</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
/* ═══════════════════ i18n runtime — EN / 中文 ═══════════════════════════════
   Same contract and the same dc_lang key as index.php, so a choice made on
   either page is already in force on the other. The runtime is inlined rather
   than shared because a new file cannot be added without editing .cpanel.yml's
   APPFILES allowlist, and a missing include would fatal the whole page. The
   dictionary below is page-scoped: only what companies.php actually shows.

   PRESENTATION ONLY. Company names, quotation numbers, item descriptions,
   dates and every API payload pass through untranslated. */
const DC_LANG_KEY='dc_lang', DC_LANGS=['en','zh'];
const I18N={
  en:{
    /* R2.2 Smart Pull-to-Refresh (installed app) */
    ptrPull:'Pull to refresh', ptrRelease:'Release to refresh', ptrRefreshing:'Refreshing…', ptrDone:'Up to date',
    ptrFail:'Couldn’t refresh — nothing on this page changed', ptrRetry:'Retry',
    ptrBlockUnsaved:'Not refreshed — this quotation has unsaved changes', ptrBlockQuickAdd:'Not refreshed — Quick Add is open',
    ptrBlockAi:'Not refreshed — AI is still reading', ptrBlockOpen:'Not refreshed — close the open window first',
    ptrBlockInput:'Not refreshed — finish or clear what you are typing', ptrBlockBusy:'Not refreshed — still loading',
    ptrBlockUnknown:'Not refreshed — the page state could not be checked',
    language:'Language', langAria:'Language', langSwitched:'Language set to English',
    navCalculator:'Calculator', navCalculatorTitle:'Quotation Calculator',
    navCompanies:'Companies', navSignOut:'Sign Out', navWorkspace:'DNC Workspace',
    navSignOutTitle:'Sign out on this device only',
    pageCompanies:'Companies', pageCompaniesSub:'Manage customers & saved quotations',
    tabRecent:'📋 Recent Quotations', tabCustomers:'🏢 Customers',
    summaryNote:'💡 Quotation total is reference only — actual order quantity may differ.',
    phSearchCompany:'Search company, phone, quotation no.',
    /* modals + actions */
    addCompanyBtn:'＋ Add Company', addCompany:'Add Company', editCompany:'Edit Company',
    quotationDetail:'Quotation Detail', loadAndEdit:'Load & Edit', save:'💾 Save',
    close:'Close', cancel:'Cancel',
    lblCompanyName:'Company Name *', lblShortCode:'Short Code',
    lblPhone:'Phone', lblAddress:'Address',
    /* messages + empty states */
    msgFailLoadMore:'❌ Failed to load more quotations', msgNoMore:'No more quotations',
    msgCompanyNameRequired:'⚠️ Company name required', msgCompanyAdded:'✅ Company added',
    msgNameRequired:'⚠️ Name required', msgUpdated:'✅ Updated', msgDeleted:'🗑️ Deleted',
    msgFailLoadQuotes:'❌ Failed to load quotations', msgFailLoad:'❌ Failed to load',
    msgDupFail:'❌ Unable to get new quotation no. Duplicate cancelled.', msgFailed:'❌ Failed',
    msgQuoteNotFound:'Quotation not found', msgLoading:'Loading…',
    msgLoadMore:'Load More Quotations', msgNoRecent:'No recent quotations found.',
    msgLookingUp:'Looking up quotation…', msgSearchingHistory:'Searching quotation history…',
    msgTryFewer:'Try fewer words, or a size and product like “M16 J BOLT”.',
    msgNoCompanies:'No companies yet', msgNoCompanyMatch:'No companies match your search',
    msgNoSavedQuotes:'No saved quotations for this company yet', msgNoItems:'No items',
    /* summary cards + section labels + search pane */
    cardTotalCompanies:'Total Companies', cardTotalCompaniesSub:'Active customer records',
    cardSavedQuotations:'Saved Quotations', cardSavedQuotationsSub:'Across all companies',
    cardRecentQuotes:'Recent Quotes', cardRecentQuotesSub:'Created in the last 14 days',
    cardLatestSavedQuote:'Latest Saved Quote', cardNoQuotationsYet:'No quotations yet',
    secCompanies:'Companies', secRecentQuotations:'Recent Quotations',
    secSavedQuotations:'Saved Quotations',
    phSearchItem:'Search item, material, size, product...',
    /* the three examples stay English: they are what staff actually type */
    itemSearchHint:'Past quoted prices — try “M16 J BOLT”, “4140”, “Y BAR”',
    sortLatest:'Sort: Latest First', sortAZ:'Sort: Company A–Z', sortMost:'Sort: Most Quotations',
    brandSub:'Quotation System · v2.24.0',
    /* Example values stay as typed — they show the expected FORMAT. */
    phCompanyEg:'e.g. SL Struktur Sdn Bhd', phShortEg:'e.g. SLSPJ',
    phPhoneEg:'03-XXXX XXXX', phOptional:'Optional',
    /* Written straight into the markup and the toasts before this, so they
       stayed English in 中文. The card action buttons carry an icon and their
       only wording is the tooltip. */
    btnEdit:'Edit', btnDelete:'Delete',
    tDuplicated:'📄 Duplicated as #{n}', tQuoteNotFound:'Quotation {r} not found',
    ariaHome:'Der-Cheng Quotation — home',
    /* The helper lines and empty states, which are most of what this page
       says before a company is chosen. */
    cpSelectCompany:'ℹ️ Select a company on the left to view all saved quotations for that company.',
    cpSelectCompanyAbove:'ℹ️ Open Customers and choose a company to see all its saved quotations.',
    cpSumLineM:'{c} companies · {q} saved · {r} in 14 days', cpViewTip:'View — read only, nothing changes', cpLoadTip:'Load into Quotation to edit or reuse',
    cpPastPriceHint:'Looking for a past price instead? Use the item search under Recent Quotations.',
    cpNoItemsMatch:'No past items match “{t}”',
    cpBackRecent:'← Back to Recent Quotations',
    cpGrandTotalNote:'ℹ️ Grand total is for quotation reference only. Actual order quantity may change.',
    cpReferenceTotal:'Reference Total', cpViewQuotation:'View Quotation',
    /* Everything this page draws from data — the cards, the badges, the
       buttons under each quotation, the loading and end-of-list lines. Built
       in script on every render, so none of it reached the attribute scan. */
    cpLoadingRecent:'Loading recent quotations…', cpNoMoreQuotes:'No more quotations',
    cpShowingNewest:'(showing the newest {n})', cpNoItems:'No items',
    msgError:'Error', cpManyMatch:'{n} quotations match {r} — use search',
    cpLoad:'📂 Load', cpDuplicate:'📄 Duplicate', cpDelete:'🗑️ Delete',
    cpNoQuotationMatch:'No quotation “{t}”',
    cpFormerly:'Formerly {r}',
    cpHistMatch:'{n} historical item(s) match “{t}”{more} — newest first:',
    cpBadgeActive:'Active', cpBadgeNoQuotes:'No Quotes', cpBadgeRecent:'Recent',
    cpBadgeRemarks:'Has Remarks',
    cpMoreItems:'+{n} more item(s)', cpDateLabel:'Date:', cpItemCount:'📦 {n} item(s)',
    cpRemarksLabel:'Remarks:', cpPreparedByLabel:'Prepared By:', cpItems1:'1 item', cpItemsN:'{n} items', cpAccIncl:'incl. {a} accessories', cpMoreRemarks:'(+{n} more quote(s) with remarks)',
    cpContact:'Contact', cpRefLabel:'Ref:', cpCustomerLabel:'Customer:',
    cpPhoneLabel:'Phone:', cpTotalLabel:'Total:',
    cpView:'👁️ View', cpLoadMore:'📋 Load More Quotations',
    cpQty:'Qty', cpUnitPrice:'Unit Price', cpQtyCaps:'QTY',
    cpNoPhone:'No phone on file',
    cpConfirmDeleteCompany:'Delete company “{n}”?\nAll linked quotations will be unlinked.',
    cpConfirmDeleteQuote:'Delete this quotation?', cpSignedOut:'Signed out',
    errCsrfReload:'This page has expired. Please reload it and try again.',
    cpSavedQuotes:'Saved quotes: {n} · Latest: {d}', cpNoSavedQuotes:'No saved quotations',
    cpLastUpdated:'Last Updated', cpLatestProduct:'Latest Product',
    qoRenumbered:'Quotation {r} was renumbered.', qoChooseOne:'{n} quotations match “{r}”. Choose one:',
    /* DNC shared desktop shell (2026-10-24) */
    rspNavQuotation:'Quotation', rspNavSaved:'Saved', rspNavTools:'Tools', rspNavAccount:'Account', rspMainNav:'Main navigation', rspOpenMenu:'Open menu', rspClose:'Close', rspQuickAria:'Quick actions', rspQuickPo:'Internal PO', shellNav:'DNC navigation', shellHome:'DNC Quotation — home', shellBack:'Back to Workspace', shellNewQuotation:'New Quotation', shellModules:'Quotation', shellQuotations:'Quotations', shellIpo:'Internal Purchase Orders', shellQuoTools:'Quotation Tools', shellOtherModules:'Other Modules', shellCompaniesSaved:'Companies & Saved', shellDefaultPrices:'Default Prices', shellDiameterSettings:'Diameter Settings', shellPricingGuide:'Pricing Guide', shellWhatsNew:'What\'s New', shellSystemVersion:'System Version', shellSignOut:'Sign Out', shellAccountMenu:'Account menu', shellPageQuotations:'Quotations', shellPageCompanies:'Companies & Saved', shellCfmLeaveDraft:'Your unsaved quotation draft stays on this device and will be offered when you come back. Go to Internal Purchase Orders?',
  },
  zh:{
    /* R2.2 下拉刷新（已安装的应用） */
    ptrPull:'下拉刷新', ptrRelease:'松开即可刷新', ptrRefreshing:'正在刷新…', ptrDone:'已是最新',
    ptrFail:'刷新失败，本页内容没有改变', ptrRetry:'重试',
    ptrBlockUnsaved:'未刷新：此报价单有未保存的修改', ptrBlockQuickAdd:'未刷新：快速添加仍在打开',
    ptrBlockAi:'未刷新：AI 仍在识别', ptrBlockOpen:'未刷新：请先关闭打开的窗口',
    ptrBlockInput:'未刷新：请先完成或清除正在输入的内容', ptrBlockBusy:'未刷新：仍在加载',
    ptrBlockUnknown:'未刷新：无法确认页面状态',
    qoRenumbered:'报价单 {r} 的编号已更改：', qoChooseOne:'有 {n} 份报价单符合「{r}」，请选择：',
    language:'语言', langAria:'语言', langSwitched:'已切换为中文',
    navCalculator:'计算器', navCalculatorTitle:'报价计算器',
    navCompanies:'公司', navSignOut:'退出', navWorkspace:'DNC 工作台',
    navSignOutTitle:'只退出此设备',
    pageCompanies:'公司', pageCompaniesSub:'管理客户与已保存报价',
    tabRecent:'📋 最新报价', tabCustomers:'🏢 客户',
    summaryNote:'💡 报价总额仅供参考 — 实际订购数量可能不同。',
    phSearchCompany:'搜索公司、电话、报价单号',
    /* modals + actions */
    addCompanyBtn:'＋ 新增公司', addCompany:'新增公司', editCompany:'编辑公司',
    quotationDetail:'报价详情', loadAndEdit:'载入并编辑', save:'💾 保存',
    close:'关闭', cancel:'取消',
    lblCompanyName:'公司名称 *', lblShortCode:'简称',
    lblPhone:'电话', lblAddress:'地址',
    /* messages + empty states */
    msgFailLoadMore:'❌ 加载更多报价失败', msgNoMore:'没有更多报价',
    msgCompanyNameRequired:'⚠️ 请填写公司名称', msgCompanyAdded:'✅ 公司已添加',
    msgNameRequired:'⚠️ 请填写名称', msgUpdated:'✅ 已更新', msgDeleted:'🗑️ 已删除',
    msgFailLoadQuotes:'❌ 加载报价失败', msgFailLoad:'❌ 加载失败',
    msgDupFail:'❌ 无法取得新报价单号，复制已取消。', msgFailed:'❌ 失败',
    msgQuoteNotFound:'找不到报价', msgLoading:'加载中…',
    msgLoadMore:'加载更多报价', msgNoRecent:'暂无最新报价。',
    msgLookingUp:'正在查找报价…', msgSearchingHistory:'正在搜索报价记录…',
    msgTryFewer:'试试少几个字，或输入尺寸加产品，例如 “M16 J BOLT”。',
    msgNoCompanies:'还没有公司', msgNoCompanyMatch:'没有符合搜索的公司',
    msgNoSavedQuotes:'这家公司还没有已保存的报价', msgNoItems:'没有产品',
    /* 汇总卡片 + 区块标题 + 搜索 */
    cardTotalCompanies:'公司总数', cardTotalCompaniesSub:'有效客户记录',
    cardSavedQuotations:'已保存报价', cardSavedQuotationsSub:'所有公司',
    cardRecentQuotes:'近期报价', cardRecentQuotesSub:'最近 14 天建立',
    cardLatestSavedQuote:'最新保存报价', cardNoQuotationsYet:'暂无报价',
    secCompanies:'公司', secRecentQuotations:'最新报价',
    secSavedQuotations:'报价记录',
    phSearchItem:'搜索产品、材料、尺寸...',
    itemSearchHint:'搜索历史报价，例如 “M16 J BOLT”、“4140”、“Y BAR”',
    sortLatest:'排序：最新优先', sortAZ:'排序：公司 A–Z', sortMost:'排序：报价最多',
    brandSub:'报价系统 · v2.24.0',
    phCompanyEg:'例如 SL Struktur Sdn Bhd', phShortEg:'例如 SLSPJ',
    phPhoneEg:'03-XXXX XXXX', phOptional:'选填',
    btnEdit:'编辑', btnDelete:'删除',
    tDuplicated:'📄 已复制为 #{n}', tQuoteNotFound:'找不到报价单 {r}',
    ariaHome:'Der-Cheng 报价系统 — 首页',
    cpSelectCompany:'ℹ️ 请在左侧选择公司，以查看该公司所有已保存的报价单。',
    cpSelectCompanyAbove:'ℹ️ 打开「客户」并选择公司，即可查看该公司所有已保存的报价单。',
    cpSumLineM:'{c} 家公司 · {q} 份报价 · 14 天内 {r} 份', cpViewTip:'查看 — 只读，不作任何更改', cpLoadTip:'载入报价页以编辑或重用',
    cpPastPriceHint:'想查询历史价格？请使用「最新报价」下方的产品搜索。',
    cpNoItemsMatch:'没有符合「{t}」的历史项目',
    cpBackRecent:'← 返回最新报价',
    cpGrandTotalNote:'ℹ️ 报价总额仅供参考，实际订购数量可能不同。',
    cpReferenceTotal:'参考总额', cpViewQuotation:'查看报价单',
    cpLoadingRecent:'正在载入最新报价…', cpNoMoreQuotes:'没有更多报价',
    cpShowingNewest:'（仅显示最新 {n} 条）', cpNoItems:'没有项目',
    msgError:'错误', cpManyMatch:'有 {n} 张报价单匹配 {r} — 请使用搜索',
    cpLoad:'📂 载入', cpDuplicate:'📄 复制', cpDelete:'🗑️ 删除',
    cpNoQuotationMatch:'没有符合「{t}」的报价单',
    cpFormerly:'原单号 {r}',
    cpHistMatch:'{n} 项历史记录符合「{t}」{more} — 最新优先：',
    cpBadgeActive:'使用中', cpBadgeNoQuotes:'尚无报价', cpBadgeRecent:'最近',
    cpBadgeRemarks:'有备注',
    cpMoreItems:'另有 {n} 项产品', cpDateLabel:'日期：', cpItemCount:'📦 {n} 项产品',
    cpRemarksLabel:'备注：', cpPreparedByLabel:'出单人：', cpItems1:'1 项产品', cpItemsN:'{n} 项产品', cpAccIncl:'含配件 {a}', cpMoreRemarks:'（另有 {n} 张报价单有备注）',
    cpContact:'联系方式', cpRefLabel:'单号：', cpCustomerLabel:'客户：',
    cpPhoneLabel:'电话：', cpTotalLabel:'合计：',
    cpView:'👁️ 查看', cpLoadMore:'📋 载入更多报价',
    cpQty:'数量', cpUnitPrice:'单价', cpQtyCaps:'数量',
    cpNoPhone:'未登记电话',
    cpConfirmDeleteCompany:'确定删除公司「{n}」？\n所有关联的报价单将会解除关联。',
    cpConfirmDeleteQuote:'确定删除此报价单？', cpSignedOut:'已退出登录',
    errCsrfReload:'此页面已过期，请刷新后重试。',
    cpSavedQuotes:'已保存报价：{n} · 最新：{d}', cpNoSavedQuotes:'尚无已保存报价',
    cpLastUpdated:'最后更新', cpLatestProduct:'最新产品',
    /* DNC shared desktop shell (2026-10-24) */
    rspNavQuotation:'报价', rspNavSaved:'已保存', rspNavTools:'工具', rspNavAccount:'账户', rspMainNav:'主导航', rspOpenMenu:'打开菜单', rspClose:'关闭', rspQuickAria:'快捷操作', rspQuickPo:'内部 PO', shellNav:'DNC 导航', shellHome:'DNC 报价 — 首页', shellBack:'返回工作台', shellNewQuotation:'新建报价', shellModules:'报价', shellQuotations:'报价单', shellIpo:'内部 PO', shellQuoTools:'报价工具', shellOtherModules:'其他模块', shellCompaniesSaved:'公司与已保存报价', shellDefaultPrices:'默认价格', shellDiameterSettings:'直径设置', shellPricingGuide:'价格说明', shellWhatsNew:'最新更新', shellSystemVersion:'系统版本', shellSignOut:'退出', shellAccountMenu:'账户菜单', shellPageQuotations:'报价单', shellPageCompanies:'公司与已保存报价', shellCfmLeaveDraft:'未保存的报价草稿会保留在此设备上，返回时可恢复。前往内部 PO？',
  },
};
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
const DC_RELABEL=[];
function dcOnRelabel(fn){ if(typeof fn==='function') DC_RELABEL.push(fn); }
function dcRelabel(){
  DC_RELABEL.forEach(fn=>{ try{ fn(); }catch(e){} });
  try{ if(typeof showToast==='function') showToast(dcT('langSwitched')); }catch(e){}
}
/* The lists are rebuilt from cached API data, so re-render them on a switch and
   re-scan for any data-i18n emitted by those renderers. Every renderer reads
   from the existing cache — no API call, no stored value altered. */
dcOnRelabel(()=>{
  try{ if(typeof renderCompanies==='function') renderCompanies(); }catch(e){}
  try{ if(typeof renderRecentQuotes==='function') renderRecentQuotes(); }catch(e){}
  try{ if(typeof renderSummary==='function') renderSummary(); }catch(e){}
  /* The detail panel is built inside selectCompany, so re-selecting the same
     company is what re-labels it. That is the same read-only fetch clicking
     the card already makes — no company, quotation or remark is written. */
  try{ if(selectedCompanyId!==null) selectCompany(selectedCompanyId); }catch(e){}
});
function dcToggleLang(){ dcSetLang(dcLang()==='zh'?'en':'zh'); }
function dcSetLang(l){
  if(DC_LANGS.indexOf(l)<0) return;
  try{ localStorage.setItem(DC_LANG_KEY,l); }catch(e){}
  dcApplyLang();
  dcRelabel();
}

dcApplyLang();

let selectedCompanyId = null;
let viewingQuote = null;

/* ── UI v3.1 merge: shared in-memory data + filter/sort state ── */
let allCompaniesCache = [];
let allQuotationsCache = [];
const RECENT_QUOTES_PAGE_SIZE = 10;
const COMPANY_QUOTES_PAGE_SIZE = 10;
let recentQuotesOffset = 0;
let recentQuotesLoading = false;
let recentQuotesHasMore = true;
let recentQuotesTotal = 0;
const recentQuoteIds = new Set();
let companyQuotesOffset = 0;
let companyQuotesLoading = false;
let companyQuotesHasMore = true;
const companyQuoteIds = new Set();

/* ── Toast ── */
let toastTimer;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2700);
}

/* ── API ── */
/* This session's CSRF token, printed once in <head> by auth.php
   dc_page_head_meta(). Every state-changing request sends it (X-DC-CSRF). */
function dcCsrf(){ const m=document.querySelector('meta[name="dc-csrf"]'); return m?m.content:''; }
/* Sign Out posts the token (logout.php refuses a bare GET). Same links, same
   one click; without a token the link's own GET shows logout.php's button. */
document.addEventListener('click',e=>{
  const a=e.target&&e.target.closest&&e.target.closest('a[href="logout.php"]');
  const t=a&&!e.defaultPrevented&&dcCsrf();
  if(!t) return;
  e.preventDefault();
  const f=document.createElement('form'); f.method='post'; f.action='logout.php'; f.hidden=true;
  const i=document.createElement('input'); i.type='hidden'; i.name='csrf'; i.value=t;
  f.appendChild(i); document.body.appendChild(f); f.submit();
});
async function api(action,data={},method='GET'){
  const url='api.php?action='+action;
  const opts=method==='GET'?{method:'GET'}:{method:'POST',headers:{'Content-Type':'application/json','X-DC-CSRF':dcCsrf()},body:JSON.stringify(data)};
  const r=await fetch(url,opts);
  /* Session expired (or signed out in another tab) — go to login, then back. */
  if(r.status===401){
    location.href='login.php?next='+encodeURIComponent(location.pathname+location.search);
    return {ok:false,error:dcT('cpSignedOut')};
  }
  const json=await r.json();
  /* A page older than this session's token: nothing was written; reload. */
  if(json&&json.error==='csrf') return {ok:false,error:dcT('errCsrfReload')};
  return json;
}

/* ── Companies ── */
async function loadCompanies(){
  const res=await api('get_companies');
  allCompaniesCache = res.data||[];
  // Also refresh the all-quotations cache for dashboard + latest-product
  await loadAllQuotations();
  renderSummary();
  renderCompanyCards();
  if(selectedCompanyId===null){
    renderRecentQuotations();
  }
}

function renderRecentQuotations(){
  const panel = document.getElementById('rightPanel');
  const recent = [...allQuotationsCache]
    .sort((a,b)=> new Date(b.created_at||b.quote_date) - new Date(a.created_at||a.quote_date));

  if(!recent.length){
    panel.innerHTML = `
      <div class="card rq-head" style="margin-bottom:12px">
        <div class="section-label" style="margin-bottom:0;padding-bottom:0;border-bottom:none"><span class="sl-icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-clipboard-document-list"/></svg></span>${dcT('secRecentQuotations')}</div>
      </div>
      <div class="empty-state empty-state-compact">
        <div class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-inbox"/></svg></div>
        <p>${dcT('msgNoRecent')}</p>
      </div>`;
    return;
  }

  const cardsHtml = recent.map(q=>{
    const items = q.items||[];
    const previewText = items.length
      ? items.slice(0,1).map(it=>displayItemDesc(it)||it.size||'').join('') + (items.length>1?` +${items.length-1} more`:'')
      : dcT('msgNoItems');
    return `
      <div class="rq-card">
        <div class="rq-card-top">
          <div class="rq-top">
            <div>
              <div class="rq-no">${esc(q.ref_no||'(No Ref)')}</div>
              <div class="rq-company" title="${esc(q.company_name||'')}">${dcIcon('building-office-2')} ${esc(q.company_name||'—')}</div>
              <div class="rq-date">${dcIcon('calendar-days')} ${fmtDate(q.quote_date||q.created_at)}</div>
            </div>
          </div>
          <div class="rq-preview">${esc(previewText)}</div>
        </div>
        <div class="rq-card-bot">
          <div class="rq-total"><span class="ref-total-label">${esc(dcT('cpReferenceTotal'))}</span> <b>${fmtMoneyCP(q.total_amount)}</b></div>
          <div class="rq-actions">
            <button class="btn btn-view" onclick="viewQuote(${q.id})" title="${esc(dcT('cpViewTip'))}" aria-label="${esc(dcT('cpViewTip'))}">${esc(dcT('cpView'))}</button>
            <button class="btn btn-amber" onclick="loadQuoteToCalc(${q.id})" title="${esc(dcT('cpLoadTip'))}" aria-label="${esc(dcT('cpLoadTip'))}">${esc(dcT('cpLoad'))}</button>
          </div>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="card rq-head" style="margin-bottom:12px">
      <div class="section-label" style="margin-bottom:0;padding-bottom:0;border-bottom:none"><span class="sl-icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-clipboard-document-list"/></svg></span>${dcT('secRecentQuotations')}</div>
    </div>
    <div class="q-helper"><span class="cp-where-side">${esc(dcT('cpSelectCompany'))}</span><span class="cp-where-above">${esc(dcT('cpSelectCompanyAbove'))}</span></div>
    ${cardsHtml}
    <div id="recentQuotesMoreWrap" style="display:${recentQuotesHasMore?'block':'none'};text-align:center;margin-top:12px">
      <button class="btn btn-ghost" id="recentQuotesMoreBtn" onclick="loadMoreRecentQuotations()">${esc(dcT('msgLoadMore'))}</button>
    </div>
    <div id="recentQuotesDone" class="q-helper" style="display:${!recentQuotesHasMore?'block':'none'};text-align:center;margin-top:12px">${esc(dcT("cpNoMoreQuotes"))}</div>
  `;
}

async function loadAllQuotations(){
  recentQuotesOffset=0;
  recentQuotesHasMore=true;
  recentQuotesLoading=false;
  recentQuoteIds.clear();
  const res = await api('get_quotations&limit='+RECENT_QUOTES_PAGE_SIZE+'&offset=0');
  applyRecentQuotations(res);
}
/* The first page of Recent Quotations, from a get_quotations answer. */
function applyRecentQuotations(res){
  recentQuotesOffset=0;
  recentQuotesHasMore=true;
  recentQuotesLoading=false;
  recentQuoteIds.clear();
  allQuotationsCache = res.data || [];
  allQuotationsCache.forEach(q=>recentQuoteIds.add(String(q.id)));
  recentQuotesOffset = allQuotationsCache.length;
  recentQuotesTotal = Number.isFinite(Number(res.total)) ? Number(res.total) : allQuotationsCache.length;
  recentQuotesHasMore = recentQuotesOffset < recentQuotesTotal;
}

async function loadMoreRecentQuotations(){
  if(recentQuotesLoading || !recentQuotesHasMore || selectedCompanyId!==null) return;
  recentQuotesLoading=true;
  const btn=document.getElementById('recentQuotesMoreBtn');
  if(btn){btn.disabled=true;btn.textContent=dcT('msgLoading');}
  const res=await api('get_quotations&limit='+RECENT_QUOTES_PAGE_SIZE+'&offset='+recentQuotesOffset);
  if(!res.ok){
    recentQuotesLoading=false;
    if(btn){btn.disabled=false;btn.textContent=dcT('msgLoadMore');}
    showToast(dcT('msgFailLoadMore'));
    return;
  }
  const quotes=(res.data||[]).sort((a,b)=>new Date(b.created_at||b.quote_date)-new Date(a.created_at||a.quote_date));
  const fresh=quotes.filter(q=>!recentQuoteIds.has(String(q.id)));
  fresh.forEach(q=>recentQuoteIds.add(String(q.id)));
  allQuotationsCache=allQuotationsCache.concat(fresh);
  recentQuotesOffset+=quotes.length;
  recentQuotesTotal=Number.isFinite(Number(res.total)) ? Number(res.total) : recentQuotesOffset;
  recentQuotesHasMore=recentQuotesOffset<recentQuotesTotal;
  recentQuotesLoading=false;
  renderSummary();
  renderCompanyCards();
  renderRecentQuotations();
  if(!fresh.length && !recentQuotesHasMore) showToast(dcT('msgNoMore'));
}

function fmtMoneyCP(v){ return "RM " + Number(v||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function daysSinceCP(d){ if(!d) return 9999; const today=new Date(); const dt=new Date(d); return Math.floor((today-dt)/86400000); }

function quotesForCompany(id){ return allQuotationsCache.filter(q=>q.company_id==id); }
function lastDateForCompany(id){
  // Prefer exact date from API (set by get_companies), fall back to paginated cache
  const c = allCompaniesCache.find(x=>x.id==id);
  if(c && c.latest_quotation_date) return c.latest_quotation_date;
  const qs=quotesForCompany(id);
  if(!qs.length) return null;
  return qs.reduce((latest,q)=> new Date(q.quote_date||q.created_at) > new Date(latest) ? (q.quote_date||q.created_at) : latest, qs[0].quote_date||qs[0].created_at);
}
function exactQuoteCount(id){
  // Use API-provided exact count if present, else fall back to cache length
  const c = allCompaniesCache.find(x=>x.id==id);
  if(c && typeof c.quotation_count === 'number') return c.quotation_count;
  return quotesForCompany(id).length;
}

function renderSummary(){
  const totalCompanies = allCompaniesCache.length;
  const totalQuotes = recentQuotesTotal || allQuotationsCache.length;
  const recentQuotes = allQuotationsCache.filter(q=>daysSinceCP(q.quote_date||q.created_at) <= 14).length;
  const latest = allQuotationsCache.length
    ? allQuotationsCache.reduce((l,q)=> new Date(q.quote_date||q.created_at) > new Date(l.quote_date||l.created_at) ? q : l, allQuotationsCache[0])
    : null;

  const cards = [
    { cls:"", label:dcT('cardTotalCompanies'), value:totalCompanies, sub:dcT('cardTotalCompaniesSub') },
    { cls:"sc-green", label:dcT('cardSavedQuotations'), value:totalQuotes, sub:dcT('cardSavedQuotationsSub') },
    { cls:"sc-amber", label:dcT('cardRecentQuotes'), value:recentQuotes, sub:dcT('cardRecentQuotesSub') },
    /* ref_no, date and company_name are STORED data, so they are escaped like
       every other stored value on this page. The reference is typed by hand
       when a quotation is saved, and this card writes it into innerHTML: a
       reference containing a tag used to be markup here, on a page that lists
       every customer. The company name beside it was already escaped; the
       reference was the one that was not. */
    { cls:"sc-purple", label:dcT('cardLatestSavedQuote'),
      value: latest ? esc(latest.ref_no || '(No Ref)') : '—',
      sub: latest ? (fmtDate(latest.quote_date||latest.created_at)+' — '+esc(latest.company_name||'')) : dcT('cardNoQuotationsYet') }
  ];
  document.getElementById('summaryGrid').innerHTML = cards.map(c=>`
    <div class="summary-card ${c.cls}">
      <div class="summary-label">${c.label}</div>
      <div class="summary-value">${c.value}</div>
      <div class="summary-sub">${c.sub}</div>
    </div>`).join('');
  const st=document.getElementById('cpSumText');
  if(st) st.textContent=dcT('cpSumLineM').replace('{c}',totalCompanies).replace('{q}',totalQuotes).replace('{r}',recentQuotes);
}
function cpSumToggle(){
  const open=!document.body.classList.contains('cp-sum-open');
  document.body.classList.toggle('cp-sum-open',open);
  const b=document.getElementById('cpSumLine'); if(b) b.setAttribute('aria-expanded',open?'true':'false');
}

/* ── Search ───────────────────────────────────────────────────────────────
   Typing filters the Companies list on the left (company name, phone, and any
   quotation number already cached). Pressing Enter on something that looks like
   a quotation number additionally asks the server via find_quotation, which
   also covers RETIRED numbers through previous_ref_no:
     one match  → open Quotation Detail
     several    → show a chooser, never guess
   Company-name and phone searches just keep filtering the list.            */
/* ── Two independent searches ─────────────────────────────────────────────
   LEFT  (#searchInput)     — companies, phones, quotation numbers, retired
                              quotation numbers. Drives the Companies list.
   RIGHT (#itemSearchInput) — historical item keywords. Drives the price
                              history results inside Recent Quotations.
   They share no state and never switch panes, so neither has to guess what the
   other meant. Both debounce at 450ms and both act at once on Enter.        */
const CP_SEARCH_DEBOUNCE = 450;   // ms after the last keystroke

function cpSearchClear(){ const b=document.getElementById('cpSearchResult'); b.innerHTML=''; b.hidden=true; }
function itemSearchClear(){ const b=document.getElementById('itemSearchResult'); b.innerHTML=''; b.hidden=true; }

/* ── LEFT: customer / quotation-number search ── */
const cpSearch={busy:false,term:'',seq:0,timer:null};

function onCpSearchInput(){
  const term=(document.getElementById('searchInput').value||'').trim();
  clearTimeout(cpSearch.timer);
  if(term!==cpSearch.term) cpSearchClear();
  cpSearch.term=term;
  renderCompanyCards();                       // company + phone filtering is local
  if(!term){ cpSearch.busy=false; return; }
  /* Only a quotation-number-shaped term needs the server. Company and phone
     searches are answered entirely from the cache above. */
  if(!looksLikeQuotationNo(term)){ cpSearch.busy=false; return; }
  cpSearch.timer=setTimeout(()=>cpRunCustomerSearch(term,false), CP_SEARCH_DEBOUNCE);
}

/* Enter is the only path allowed to open a quotation automatically — a modal
   appearing mid-typing would be startling. */
function cpSearchSubmit(){
  clearTimeout(cpSearch.timer);
  const term=(document.getElementById('searchInput').value||'').trim();
  cpSearch.term=term;
  if(!term){ cpSearchClear(); renderCompanyCards(); return Promise.resolve(); }
  renderCompanyCards();
  if(!looksLikeQuotationNo(term)){ cpSearchClear(); return Promise.resolve(); }
  return cpRunCustomerSearch(term,true);
}

function cpBusyPanel(){
  const b=document.getElementById('cpSearchResult');
  b.innerHTML='<div class="cp-hit-msg cp-hit-busy"><span>'+esc(dcT('msgLookingUp'))+'</span></div>';
  b.hidden=false;
}
function cpNotFoundPanel(term){
  const b=document.getElementById('cpSearchResult');
  b.innerHTML='<div class="cp-empty"><div class="cp-empty-icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-magnifying-glass"/></svg></div>'
    +'<p class="cp-empty-main">'+esc(dcT('cpNoQuotationMatch').replace('{t}',term))+'</p>'
    +'<p class="cp-empty-sub">'+esc(dcT('cpPastPriceHint'))+'</p></div>';
  b.hidden=false;
}

async function cpRunCustomerSearch(term,immediate){
  const seq=++cpSearch.seq;
  cpSearch.busy=true; cpBusyPanel();
  try{
    const res=await api('find_quotation&ref='+encodeURIComponent(term));
    if(seq!==cpSearch.seq) return;                       // a newer keystroke won
    const hits=(res&&res.ok&&res.data)||[];
    cpSearch.busy=false;
    if(hits.length===1 && !hits[0].matched_previous && immediate){
      cpSearchClear(); viewQuote(hits[0].id); return;
    }
    if(hits.length){ renderCpSearchHits(hits,term); return; }
    cpNotFoundPanel(term);
  }catch(e){
    if(seq!==cpSearch.seq) return;
    cpSearch.busy=false; cpSearchClear();
  }
}

/* ── RIGHT: historical item search ── */
const itemSearch={busy:false,count:0,term:'',seq:0,timer:null};

function onItemSearchInput(){
  const term=(document.getElementById('itemSearchInput').value||'').trim();
  clearTimeout(itemSearch.timer);
  if(term!==itemSearch.term){ itemSearch.count=0; itemSearchClear(); }
  itemSearch.term=term;
  if(!term){ itemSearch.busy=false; return; }
  itemSearch.timer=setTimeout(()=>itemRunSearch(term), CP_SEARCH_DEBOUNCE);
}
function itemSearchSubmit(){
  clearTimeout(itemSearch.timer);
  const term=(document.getElementById('itemSearchInput').value||'').trim();
  itemSearch.term=term;
  if(!term){ itemSearch.count=0; itemSearchClear(); return Promise.resolve(); }
  return itemRunSearch(term);
}
function itemBusyPanel(){
  const b=document.getElementById('itemSearchResult');
  b.innerHTML='<div class="cp-hit-msg cp-hit-busy"><span>'+esc(dcT('msgSearchingHistory'))+'</span></div>';
  b.hidden=false;
}
function itemEmptyPanel(term){
  const b=document.getElementById('itemSearchResult');
  b.innerHTML='<div class="cp-empty"><div class="cp-empty-icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-magnifying-glass"/></svg></div>'
    +'<p class="cp-empty-main">'+esc(dcT('cpNoItemsMatch').replace('{t}',term))+'</p>'
    +'<p class="cp-empty-sub"><span>'+esc(dcT('msgTryFewer'))+'</span></p></div>';
  b.hidden=false;
}
async function itemRunSearch(term){
  const seq=++itemSearch.seq;
  itemSearch.busy=true; itemBusyPanel();
  try{
    const res=await api('search_items&q='+encodeURIComponent(term));
    if(seq!==itemSearch.seq) return;
    const items=(res&&res.ok&&res.data)||[];
    itemSearch.busy=false; itemSearch.count=items.length;
    if(items.length) renderCpItemHits(items,term,res);
    else itemEmptyPanel(term);
  }catch(e){
    if(seq!==itemSearch.seq) return;
    itemSearch.busy=false; itemSearch.count=0; itemSearchClear();
  }
}
function looksLikeQuotationNo(term){
  const t=String(term||'').toUpperCase().replace(/\s+/g,'').replace(/^#/,'');
  return /^Q?-?\d{4}-?\d{1,6}$/.test(t) || /^\d{1,6}$/.test(t);
}
function renderCpSearchHits(hits,term){
  const rows=hits.map(h=>{
    const who=h.customer_name||h.company_name||'—';
    const when=fmtDate(h.quote_date||(h.created_at||'').slice(0,10));
    const amt=parseFloat(h.total_amount||0).toFixed(2);
    const prev=h.matched_previous&&h.previous_ref_no
      ? `<span class="cp-hit-prev">${esc(dcT('cpFormerly').replace('{r}',h.previous_ref_no))}</span>` : '';
    return `<button type="button" class="cp-hit" onclick="cpSearchClear();viewQuote(${parseInt(h.id,10)})">
        <span class="cp-hit-main"><span class="cp-hit-ref">${esc(h.ref_no)}</span>
        <span class="cp-hit-sub">${esc(who)} · ${esc(when)}</span>${prev}</span>
        <span class="cp-hit-amt">RM ${amt}</span></button>`;
  }).join('');
  const head=hits.length===1
    ? esc(dcT('qoRenumbered').replace('{r}',term))
    : esc(dcT('qoChooseOne').replace('{n}',hits.length).replace('{r}',term));
  const b=document.getElementById('cpSearchResult');
  b.innerHTML=`<div class="cp-hit-msg">${head}</div><div class="cp-hit-list">${rows}</div>`;
  b.hidden=false;
}

/* Historical item results — what was quoted before, and for how much.
   Unit Price is the saved selling price from that quotation item; cost rate is
   never shown here. Newest quotation first (ordered server-side). */
function renderCpItemHits(hits,term,meta){
  const rows=hits.map(h=>{
    const when=fmtDate(h.quote_date||(h.created_at||'').slice(0,10));
    const unit=parseFloat(h.unit_price||0).toFixed(2);
    const qty=parseInt(h.qty,10)||0;
    const finish=h.finish?` <span class="ih-finish">${esc(h.finish)}</span>`:'';
    const prev=h.previous_ref_no?`<span class="ih-prev">${esc(dcT('cpFormerly').replace('{r}',h.previous_ref_no))}</span>`:'';
    return `<div class="ih-card">
      <div class="ih-desc">${esc(displayItemDesc(h)||'—')}${finish}</div>
      <div class="ih-size">${esc(h.size||'')}</div>
      <div class="ih-meta">${esc(h.customer||'—')} · ${esc(when)} · <strong>${esc(h.ref_no)}</strong>${prev}</div>
      <div class="ih-foot">
        <span class="ih-qty">${esc(dcT('cpQty'))} ${qty}</span>
        <span class="ih-price">${esc(dcT('cpUnitPrice'))} <strong>RM ${unit}</strong></span>
      </div>
      <button type="button" class="btn btn-view ih-view" onclick="itemSearchClear();viewQuote(${parseInt(h.quotation_id,10)})">${esc(dcT('cpViewQuotation'))}</button>
    </div>`;
  }).join('');
  const more=meta&&meta.truncated?' '+dcT('cpShowingNewest').replace('{n}',hits.length):'';
  const b=document.getElementById('itemSearchResult');
  b.innerHTML=`<div class="cp-hit-msg">${esc(dcT('cpHistMatch').replace('{n}',hits.length).replace('{t}',term).replace('{more}',more))}</div>
               <div class="ih-list">${rows}</div>`;
  b.hidden=false;
}

function filteredCompaniesCP(){
  const term = (document.getElementById('searchInput').value||'').trim().toLowerCase();
  let list = allCompaniesCache.filter(c=>{
    if(!term) return true;
    const inName = (c.name||'').toLowerCase().includes(term);
    const inPhone = (c.phone||'').toLowerCase().includes(term);
    const inQuote = quotesForCompany(c.id).some(q=>(q.ref_no||'').toLowerCase().includes(term));
    return inName || inPhone || inQuote;
  });

  const sort = document.getElementById('sortSelect').value;
  if(sort === "name"){
    list = [...list].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  } else if(sort === "count"){
    list = [...list].sort((a,b)=>exactQuoteCount(b.id)-exactQuoteCount(a.id));
  } else {
    list = [...list].sort((a,b)=>{
      const da = lastDateForCompany(a.id), db = lastDateForCompany(b.id);
      return new Date(db||0) - new Date(da||0);
    });
  }
  return list;
}

function renderCompanyCards(){
  const list = filteredCompaniesCP();
  document.getElementById('companyCount').textContent = list.length;

  if(!allCompaniesCache.length){
    document.getElementById('companyList').innerHTML='<div class="empty-state"><div class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-building-office-2"/></svg></div><p><span class="sub">'+esc(dcT('msgNoCompanies'))+'</span></p></div>';
    return;
  }
  if(!list.length){
    /* Item results live in the right pane now, so this only ever speaks for the
       Companies list and can say so plainly. */
    document.getElementById('companyList').innerHTML=
      '<div class="empty-state"><div class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-building-office-2"/></svg></div><p>'+dcT('msgNoCompanyMatch')+'</p></div>';
    return;
  }

  document.getElementById('companyList').innerHTML = list.map(c=>{
    const qCount = exactQuoteCount(c.id);
    const lastDate = lastDateForCompany(c.id); // uses API exact date first
    const isRecent = lastDate && daysSinceCP(lastDate) <= 14;
    const hasRemarks = quotesForCompany(c.id).some(q=>q.remarks && q.remarks.trim().length>0);

    let badge = '<span class="status-badge badge-norecent">'+esc(dcT('cpBadgeActive'))+'</span>';
    if(!lastDate || qCount === 0) badge = '<span class="status-badge badge-norecent">'+esc(dcT('cpBadgeNoQuotes'))+'</span>';
    else if(isRecent) badge = '<span class="status-badge badge-recent">'+esc(dcT('cpBadgeRecent'))+'</span>';
    else if(hasRemarks) badge = '<span class="status-badge badge-remarks">'+esc(dcT('cpBadgeRemarks'))+'</span>';

    const phoneLine = c.phone ? esc(c.phone) : '—';
    const quoteLine = qCount === 0
      ? esc(dcT('cpNoSavedQuotes'))
      : esc(dcT('cpSavedQuotes').replace('{n}',qCount).replace('{d}',lastDate ? fmtDate(lastDate) : '—'));

    return `
      <div class="company-card company-card-compact ${selectedCompanyId==c.id?'selected':''}" onclick="selectCompany(${c.id})">
        <div class="cc-top">
          <div class="cc-name">${esc(c.name)}${c.short_code?` <span class="company-code">${esc(c.short_code)}</span>`:''}</div>
          ${badge}
        </div>
        <div class="cc-row2">
          <span class="cc-row2-text cc-row2-stack">
            <span class="cc-phone-line">${phoneLine}</span>
            <span class="cc-quote-line">${quoteLine}</span>
          </span>
          <span class="cc-icon-actions">
            <button class="cc-icon-btn" title="${esc(dcT('btnEdit'))}" onclick="event.stopPropagation();openEditCompany(${c.id},'${esc(c.name)}','${esc(c.short_code||'')}','${esc(c.phone||'')}','${esc(c.address||'')}')">✏️</button>
            <button class="cc-icon-btn cc-icon-danger" title="${esc(dcT('btnDelete'))}" onclick="event.stopPropagation();deleteCompany(${c.id},'${esc(c.name)}')">🗑️</button>
          </span>
        </div>
      </div>`;
  }).join('');
}

/* ── Add Company collapsible ── */
function toggleAddCompanyForm(){
  const f=document.getElementById('addCompanyForm');
  f.hidden=!f.hidden;
  document.body.classList.toggle('cp-sheet-open',!f.hidden);
  if(!f.hidden){const n=document.getElementById('c-name');if(n)n.focus();}
}
function closeAddCompanyForm(){
  document.getElementById('addCompanyForm').hidden=true;
  document.body.classList.remove('cp-sheet-open');
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const f=document.getElementById('addCompanyForm'); if(f&&!f.hidden&&window.matchMedia('(max-width:599px)').matches) closeAddCompanyForm(); } });

async function addCompany(){
  const name=document.getElementById('c-name').value.trim();
  if(!name){showToast(dcT('msgCompanyNameRequired'));return}
  const res=await api('add_company',{
    name,
    short_code:document.getElementById('c-code').value.trim().toUpperCase(),
    phone:document.getElementById('c-phone').value.trim(),
    address:document.getElementById('c-addr').value.trim()
  },'POST');
  if(res.ok){
    document.getElementById('c-name').value='';
    document.getElementById('c-code').value='';
    document.getElementById('c-phone').value='';
    document.getElementById('c-addr').value='';
    showToast(dcT('msgCompanyAdded'));
    closeAddCompanyForm();
    loadCompanies();
  } else showToast('❌ '+(res.error||dcT('msgError')));
}

function openEditCompany(id,name,code,phone,addr){
  document.getElementById('ec-id').value=id;
  document.getElementById('ec-name').value=name;
  document.getElementById('ec-code').value=code;
  document.getElementById('ec-phone').value=phone;
  document.getElementById('ec-addr').value=addr;
  openModal('editCompanyModal');
}

async function saveEditCompany(){
  const id=document.getElementById('ec-id').value;
  const name=document.getElementById('ec-name').value.trim();
  if(!name){showToast(dcT('msgNameRequired'));return}
  const res=await api('update_company',{
    id,name,
    short_code:document.getElementById('ec-code').value.trim().toUpperCase(),
    phone:document.getElementById('ec-phone').value.trim(),
    address:document.getElementById('ec-addr').value.trim()
  },'POST');
  if(res.ok){showToast(dcT('msgUpdated'));closeModal('editCompanyModal');loadCompanies()}
  else showToast('❌ '+(res.error||dcT('msgError')));
}

async function deleteCompany(id,name){
  if(!confirm(dcT('cpConfirmDeleteCompany').replace('{n}',name)))return;
  const res=await api('delete_company',{id},'POST');
  if(res.ok){showToast(dcT('msgDeleted'));if(selectedCompanyId==id){selectedCompanyId=null;}loadCompanies();}
  else showToast('❌ '+(res.error||dcT('msgError')));
}

/* ── Quotations ── */
function renderCompanyQuoteCard(q){
  const items = q.items||[];
  const previewItems = items.slice(0,2);
  const moreCount = items.length - previewItems.length;
  const previewHtml = previewItems.map(it=>`
    <div class="item-line"><span>${esc(displayItemDesc(it)||it.size||'')} <span class="q-detail-chip chip-${safeClassToken(it.finish||'')}">${esc(it.finish||'')}</span></span><span style="flex-shrink:0;margin-left:8px">${parseInt(it.qty,10)||0} × RM${dcItemFinalUnit(it).toFixed(2)}${esc(dcAccNote(it))}</span></div>
  `).join('') + (moreCount>0 ? `<div class="item-more">${esc(dcT('cpMoreItems').replace('{n}',moreCount))}</div>` : '');

  return `
    <div class="q-card" data-quote-id="${q.id}">
      <div class="q-card-top">
        <div class="q-top">
          <div>
            <div class="q-no">${esc(q.ref_no||'(No Ref)')}</div>
            <div class="q-dates">${esc(dcT('cpDateLabel'))} ${fmtDate(q.quote_date)}</div>
          </div>
        </div>
        <div class="q-meta">
          ${q.prepared_by?`<span>${dcIcon('user-circle')} ${esc(q.prepared_by)}</span>`:''}
          <span>${esc(dcT('cpItemCount').replace('{n}',items.length))}</span>
        </div>
        <div class="q-preview">${previewHtml || `<span style="opacity:.6">${esc(dcT('cpNoItems'))}</span>`}</div>
        ${q.remarks ? `<div class="q-remarks">${dcIcon('chat-bubble-left-right')} ${esc(q.remarks)}</div>` : ''}
      </div>
      <div class="q-card-bottom">
        <div class="ref-total">
          <span class="ref-total-label">${esc(dcT('cpReferenceTotal'))}</span><br>
          <b>${fmtMoneyCP(q.total_amount)}</b>
        </div>
        <div class="quote-actions">
          <button class="btn btn-view" onclick="viewQuote(${q.id})" title="${esc(dcT('cpViewTip'))}" aria-label="${esc(dcT('cpViewTip'))}">${esc(dcT('cpView'))}</button>
          <button class="btn btn-amber" onclick="loadQuoteToCalc(${q.id})" title="${esc(dcT('cpLoadTip'))}" aria-label="${esc(dcT('cpLoadTip'))}">${esc(dcT('cpLoad'))}</button>
          <button class="btn btn-ghost" onclick="duplicateQuote(${q.id})">${esc(dcT('cpDuplicate'))}</button>
          <button class="btn btn-danger" onclick="deleteQuote(${q.id})">${esc(dcT('cpDelete'))}</button>
        </div>
      </div>
    </div>`;
}

async function selectCompany(id){
  selectedCompanyId=id;
  companyQuotesOffset=0;
  companyQuotesHasMore=true;
  companyQuotesLoading=false;
  companyQuoteIds.clear();
  renderCompanyCards(); // re-render to update selected state

  const res=await api('get_quotations&company_id='+id+'&limit='+COMPANY_QUOTES_PAGE_SIZE+'&offset=0');
  if(!res.ok){showToast(dcT('msgFailLoadQuotes'));return false}
  const quotes=(res.data||[]).sort((a,b)=>new Date(b.quote_date||b.created_at)-new Date(a.quote_date||a.created_at));
  const totalQuotesForCompany = Number.isFinite(Number(res.total)) ? Number(res.total) : quotes.length;
  companyQuotesOffset=quotes.length;
  companyQuotesHasMore=companyQuotesOffset<totalQuotesForCompany;
  quotes.forEach(q=>companyQuoteIds.add(String(q.id)));
  const c = allCompaniesCache.find(x=>x.id==id);
  if(!c) return;

  const lastDate = quotes.length ? (quotes[0].quote_date||quotes[0].created_at) : null;
  const latestProduct = (quotes.length && quotes[0].items && quotes[0].items[0]) ? displayItemDesc(quotes[0].items[0]) : '—';
  const remarksList = quotes.filter(q=>q.remarks && q.remarks.trim().length>0).map(q=>q.remarks);
  const remarksHtml = remarksList.length ? `<div class="sp-remarks"><b>${esc(dcT('cpRemarksLabel'))}</b> ${esc(remarksList[0])}${remarksList.length>1?` <span style="opacity:.7">${esc(dcT('cpMoreRemarks').replace('{n}',remarksList.length-1))}</span>`:''}</div>` : '';

  let quotesHtml = quotes.length ? quotes.map(q=>{
    const items = q.items||[];
    const previewItems = items.slice(0,2);
    const moreCount = items.length - previewItems.length;
    const previewHtml = previewItems.map(it=>`
      <div class="item-line"><span>${esc(displayItemDesc(it)||it.size||'')} <span class="q-detail-chip chip-${safeClassToken(it.finish||'')}">${esc(it.finish||'')}</span></span><span style="flex-shrink:0;margin-left:8px">${parseInt(it.qty,10)||0} × RM${dcItemFinalUnit(it).toFixed(2)}${esc(dcAccNote(it))}</span></div>
    `).join('') + (moreCount>0 ? `<div class="item-more">${esc(dcT('cpMoreItems').replace('{n}',moreCount))}</div>` : '');

    return `
      <div class="q-card">
        <div class="q-top">
          <div>
            <div class="q-no">${esc(q.ref_no||'(No Ref)')}</div>
            <div class="q-dates">${esc(dcT('cpDateLabel'))} ${fmtDate(q.quote_date)}</div>
          </div>
        </div>
        <div class="q-meta">
          ${q.prepared_by?`<span>${dcIcon('user-circle')} ${esc(q.prepared_by)}</span>`:''}
          <span>${esc(dcT('cpItemCount').replace('{n}',items.length))}</span>
        </div>
        <div class="q-preview">${previewHtml || `<span style="opacity:.6">${esc(dcT('cpNoItems'))}</span>`}</div>
        <div class="ref-total">
          <span class="ref-total-label">${esc(dcT('cpReferenceTotal'))}</span><br>
          <b>${fmtMoneyCP(q.total_amount)}</b>
        </div>
        ${q.remarks ? `<div class="q-remarks">${dcIcon('chat-bubble-left-right')} ${esc(q.remarks)}</div>` : ''}
        <div class="quote-actions">
          <button class="btn btn-view" onclick="viewQuote(${q.id})" title="${esc(dcT('cpViewTip'))}" aria-label="${esc(dcT('cpViewTip'))}">${esc(dcT('cpView'))}</button>
          <button class="btn btn-amber" onclick="loadQuoteToCalc(${q.id})" title="${esc(dcT('cpLoadTip'))}" aria-label="${esc(dcT('cpLoadTip'))}">${esc(dcT('cpLoad'))}</button>
          <button class="btn btn-ghost" onclick="duplicateQuote(${q.id})">${esc(dcT('cpDuplicate'))}</button>
          <button class="btn btn-danger" onclick="deleteQuote(${q.id})">${esc(dcT('cpDelete'))}</button>
        </div>
      </div>`;
  }).join('') : '<div class="empty-state"><div class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-inbox"/></svg></div><p>'+dcT('msgNoSavedQuotes')+'</p></div>';

  quotesHtml = quotes.length ? quotes.map(renderCompanyQuoteCard).join('') : '<div class="empty-state"><div class="icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-inbox"/></svg></div><p>'+dcT('msgNoSavedQuotes')+'</p></div>';

  document.getElementById('rightPanel').innerHTML = `
    <div class="card selected-panel" style="margin-bottom:16px">
      <div class="sp-top">
        <div>
          <div class="sp-name">${esc(c.name)}${c.short_code?` <span class="company-code">${esc(c.short_code)}</span>`:''}</div>
          <div class="sp-phone">${c.phone?esc(c.phone):esc(dcT('cpNoPhone'))}</div>
        </div>
        <button class="cp-back-btn" onclick="clearCompanySelection()">${esc(dcT('cpBackRecent'))}</button>
      </div>
      <div class="sp-stats">
        <div class="sp-stat"><div class="sp-stat-label">${esc(dcT('cardSavedQuotations'))}</div><div class="sp-stat-value">${totalQuotesForCompany}</div></div>
        <div class="sp-stat"><div class="sp-stat-label">${esc(dcT('cpLastUpdated'))}</div><div class="sp-stat-value">${lastDate?fmtDate(lastDate):'—'}</div></div>
        <div class="sp-stat"><div class="sp-stat-label">${esc(dcT('cpContact'))}</div><div class="sp-stat-value" style="font-size:12.5px">${c.phone?esc(c.phone):'—'}</div></div>
        <div class="sp-stat"><div class="sp-stat-label">${esc(dcT('cpLatestProduct'))}</div><div class="sp-stat-value" style="font-size:11px;line-height:1.4">${esc(latestProduct)}</div></div>
      </div>
      ${remarksHtml}
    </div>

    <div class="list-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="section-label" style="margin-bottom:0;padding-bottom:0;border-bottom:none"><span class="sl-icon"><svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-clipboard-document-list"/></svg></span><span>${esc(dcT('secSavedQuotations'))}</span></div>
      <span class="list-count">${totalQuotesForCompany}</span>
    </div>
    <div class="q-helper">${esc(dcT('cpGrandTotalNote'))}</div>
    <div id="companyQuotesList">${quotesHtml}</div>
    <div id="companyQuotesMoreWrap" style="display:${quotes.length&&companyQuotesHasMore?'block':'none'};text-align:center;margin-top:12px">
      <button class="btn btn-ghost" id="companyQuotesMoreBtn" onclick="loadMoreCompanyQuotations()">${esc(dcT('msgLoadMore'))}</button>
    </div>
    <div id="companyQuotesDone" class="q-helper" style="display:${quotes.length&&!companyQuotesHasMore?'block':'none'};text-align:center;margin-top:12px">${esc(dcT("cpNoMoreQuotes"))}</div>
  `;
  // Mobile: switch to Recent Quotations tab now that company panel is ready
  if(window.innerWidth<=980) switchMobTab('recent');
}

async function loadMoreCompanyQuotations(){
  if(!selectedCompanyId || companyQuotesLoading || !companyQuotesHasMore) return;
  companyQuotesLoading=true;
  const btn=document.getElementById('companyQuotesMoreBtn');
  if(btn){btn.disabled=true;btn.textContent=dcT('msgLoading');}
  const res=await api('get_quotations&company_id='+selectedCompanyId+'&limit='+COMPANY_QUOTES_PAGE_SIZE+'&offset='+companyQuotesOffset);
  if(!res.ok){
    companyQuotesLoading=false;
    if(btn){btn.disabled=false;btn.textContent=dcT('msgLoadMore');}
    showToast(dcT('msgFailLoadMore'));
    return;
  }
  const quotes=(res.data||[]).sort((a,b)=>new Date(b.quote_date||b.created_at)-new Date(a.quote_date||a.created_at));
  const fresh=quotes.filter(q=>!companyQuoteIds.has(String(q.id)));
  fresh.forEach(q=>companyQuoteIds.add(String(q.id)));
  companyQuotesOffset+=quotes.length;
  const totalQuotesForCompany = Number.isFinite(Number(res.total)) ? Number(res.total) : companyQuotesOffset;
  companyQuotesHasMore=companyQuotesOffset<totalQuotesForCompany;
  const list=document.getElementById('companyQuotesList');
  if(list && fresh.length) list.insertAdjacentHTML('beforeend', fresh.map(renderCompanyQuoteCard).join(''));
  const wrap=document.getElementById('companyQuotesMoreWrap');
  const done=document.getElementById('companyQuotesDone');
  if(wrap) wrap.style.display=companyQuotesHasMore?'block':'none';
  if(done) done.style.display=companyQuotesHasMore?'none':'block';
  if(btn){btn.disabled=false;btn.textContent=dcT('msgLoadMore');}
  companyQuotesLoading=false;
  if(!fresh.length && !companyQuotesHasMore) showToast(dcT('msgNoMore'));
}

function clearCompanySelection(){
  selectedCompanyId = null;
  renderCompanyCards();
  renderRecentQuotations();
  // Mobile: go back to Recent tab (now showing all recent, not company-specific)
  if(window.innerWidth<=980) switchMobTab('recent');
}

/* This is the SCREEN's date. The printed quotation's date is formatted in
   index.php and deliberately stays English — which language a CUSTOMER's
   document is written in is an open business question, and is not the same
   question as which language the operator works in. */
function fmtDate(d){
  if(!d)return'\u2014';
  const s=String(d).trim();
  const datePart=s.split(/[ T]/)[0];
  const parts=datePart.split('-');
  if(parts.length===3){
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const y=parts[0];
    const m=Number(parts[1]);
    const day=Number(parts[2]);
    if(/^\d{4}$/.test(y) && m>=1 && m<=12 && day>=1 && day<=31){
      return dcLang()==='zh' ? `${y}年${m}月${day}日` : `${day} ${months[m-1]} ${y}`;
    }
  }
  return s;
}

async function viewQuote(id){
  const res=await api('get_quotation&id='+id);
  if(!res.ok)return;
  const q=res.data;
  viewingQuote=q;
  const items=q.items||[];
  /* R2.5 #03/#16 — the saved figures exactly as stored (unit = the same final
     unit the cards and index.php show; line = the saved totalAmount); "RM" and
     its number never split. Read-only. */
  const money=v=>`<span class="money">RM ${v}</span>`;
  const lbl=k=>esc(String(dcT(k)).replace(/[:：]\s*$/,''));
  let rows=items.map(i=>{ const acc=dcItemAccUnit(i);
    return `<li class="vm-item">
      <div class="vm-name">${esc(displayItemDesc(i)||'')}${i.finish?` <span class="q-detail-chip chip-${safeClassToken(i.finish)}">${esc(i.finish)}</span>`:''}</div>
      <div class="vm-amt">${money(parseFloat(i.totalAmount||0).toFixed(2))}</div>
      ${i.size?`<div class="vm-dims">${esc(i.size)}</div>`:''}
      <div class="vm-qp">${esc(dcT('cpQtyCaps'))} ${parseInt(i.qty,10)||0} × ${money(dcItemFinalUnit(i).toFixed(2))}</div>
      ${acc>0?`<div class="vm-acc">${esc(dcT('cpAccIncl').replace('{a}','RM'+acc.toFixed(2)))}</div>`:''}
    </li>`; }).join('');
  const meta=[[q.customer_name,'cpCustomerLabel',esc(q.customer_name),'full'],[q.quote_date,'cpDateLabel',fmtDate(q.quote_date),''],
    [q.customer_phone,'cpPhoneLabel',esc(q.customer_phone),''],[q.prepared_by,'cpPreparedByLabel',esc(q.prepared_by),''],
    [q.remarks,'cpRemarksLabel',esc(q.remarks),'full']].filter(m=>m[0])
    .map(m=>`<div class="${m[3]}"><dt>${lbl(m[1])}</dt><dd>${m[2]}</dd></div>`).join('');
  document.getElementById('vmRef').textContent=q.ref_no||'';
  document.querySelector('#viewModal .vm-box').classList.toggle('vm-wide',items.length>1);
  document.getElementById('viewModalBody').innerHTML=`
    ${meta?`<dl class="vm-meta">${meta}</dl>`:''}
    <div class="vm-count"><span>${esc(items.length===1?dcT('cpItems1'):dcT('cpItemsN').replace('{n}',items.length))}</span></div>
    <ul class="vm-items">${rows}</ul>
    <div class="vm-total"><span>${lbl('cpTotalLabel')}</span>${money(Number(q.total_amount||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}))}</div>
  `;
  document.getElementById('viewModalBody').scrollTop=0;
  cpViewReturn=document.activeElement;
  openModal('viewModal');
  const box=document.querySelector('#viewModal .vm-box'); try{ box.focus({preventScroll:true}); }catch(e){}   /* Tab reaches Close first */
}
let cpViewReturn=null;
function cpCloseView(){ closeModal('viewModal'); const r=cpViewReturn; cpViewReturn=null; if(r&&r.isConnected&&typeof r.focus==='function') try{ r.focus({preventScroll:true}); }catch(e){} }
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const m=document.getElementById('viewModal'); if(m&&m.classList.contains('open')){ e.preventDefault(); cpCloseView(); } } });

function loadAndGo(){
  if(!viewingQuote)return;
  // Store in sessionStorage and redirect
  sessionStorage.setItem('loadQuote', JSON.stringify(viewingQuote));
  window.location.href='index.php';
}

async function loadQuoteToCalc(id){
  const res=await api('get_quotation&id='+id);
  if(!res.ok){showToast(dcT('msgFailLoad'));return}
  sessionStorage.setItem('loadQuote', JSON.stringify(res.data));
  window.location.href='index.php';
}

async function duplicateQuote(id){
  const res=await api('get_quotation&id='+id);
  if(!res.ok)return;
  const q=res.data;
  delete q.id;
  let nr;
  try{nr=await api('get_next_ref');}catch(e){nr=null;}
  if(!nr || !nr.ok || !nr.ref_no){showToast(dcT('msgDupFail'));return;}
  q.ref_no=nr.ref_no;
  /* A duplicate is a NEW quotation: new number, and therefore today's date.
     Carrying the original's date across gave the customer a freshly numbered
     quotation dated weeks earlier, with nothing on it saying so. Anything
     derived from the date — a validity window — is left to be set again on
     purpose rather than inherited from a document this one only resembles. */
  const dt=new Date();
  q.quote_date=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  q.date=q.quote_date;
  q.valid_until='';
  const saveRes=await api('save_quotation',q,'POST');
  if(saveRes.ok){showToast(dcT('tDuplicated').replace('{n}',saveRes.id));await loadAllQuotations();renderSummary();renderCompanyCards();selectCompany(selectedCompanyId);}
  else showToast(dcT('msgFailed'));
}

/* The View dialog's Duplicate / Delete (phone): the same actions on the quotation
   being viewed — Delete still asks first. */
async function cpViewDuplicate(){ if(!viewingQuote) return; closeModal('viewModal'); await duplicateQuote(viewingQuote.id); }
async function cpViewDelete(){ if(!viewingQuote) return; const id=viewingQuote.id; if(!confirm(dcT('cpConfirmDeleteQuote'))) return;
  closeModal('viewModal'); const res=await api('delete_quotation',{id},'POST');
  if(res.ok){showToast(dcT('msgDeleted'));await loadAllQuotations();renderSummary();renderCompanyCards();if(selectedCompanyId!==null) selectCompany(selectedCompanyId); else renderRecentQuotations();}
  else showToast(dcT('msgFailed')); }
async function deleteQuote(id){
  if(!confirm(dcT('cpConfirmDeleteQuote')))return;
  const res=await api('delete_quotation',{id},'POST');
  if(res.ok){showToast(dcT('msgDeleted'));await loadAllQuotations();renderSummary();renderCompanyCards();selectCompany(selectedCompanyId);}
  else showToast(dcT('msgFailed'));
}

/* ── Modal helpers ── */
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open')});
});

function esc(s){
  if(!s)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function safeClassToken(s){return String(s||'').replace(/[^a-zA-Z0-9_-]/g,'')}

/* ── Descriptions written before the material list had labels ───────────────
   A quotation item stores its description as it was built, so items saved
   under the older material vocabulary read back as "4140_HARDEN_G10_9 FULLSIZE
   L BOLT" — a database value on a screen staff use to answer a customer. This
   is the same normalisation index.php applies when it shows a saved item, kept
   deliberately identical so one item cannot read two ways in two places.

   It is a DISPLAY rewrite only: nothing is saved, no stored value is changed,
   and no price, size or weight is touched. */
/* ── An item's price, and what is inside it ─────────────────────────────────
   The same rule index.php prices by: everything bolted to an item is INSIDE its
   final unit price, and the accessory figure is a breakdown of that price
   rather than a charge beside it. These screens print "QTY 10 × RM 7.76", so
   they have to reach the same RM 7.76 index.php does — for all three vintages
   of saved item, which say it in three different ways:

     accessory-inclusive   finalUnitPrice IS the customer's price.
     bolt-separate         finalUnitPrice was the BOLT; lineUnitPrice was the
                           customer's price. Read the line.
     legacy (no model)     one figure, the charge already inside it — which is
                           what this rule asks for, so it is read as written,
                           and its accessory share stays unknowable.          */
function dcItemPricingModel(item){ return String((item&&item.pricingModel)||''); }
function dcItemAccUnit(item){
  const m=dcItemPricingModel(item);
  return (m==='accessory-inclusive'||m==='bolt-separate') ? (Number(item.accessoryUnitPrice)||0) : 0;
}
function dcItemFinalUnit(item){
  if(!item) return 0;
  if(dcItemPricingModel(item)==='bolt-separate'){
    const line=Number(item.lineUnitPrice);
    return (isFinite(line)&&line>0) ? line
         : (Number(item.finalUnitPrice)||0)+(Number(item.accessoryUnitPrice)||0);
  }
  return Number(item.finalUnitPrice)||0;
}
/* Named as what it IS — part of the figure printed beside it — so nobody adds
   it on a second time. */
function dcAccNote(item){
  const a=dcItemAccUnit(item);
  return a>0 ? ` (incl. RM${a.toFixed(2)} accessories)` : '';
}
function displayItemDesc(item){
  const desc=String(item&&item.desc?item.desc:'');
  if(desc.includes('4140_HARDEN_G10_9')) return desc.replace(/4140_HARDEN_G10_9/g,'4140 QT + HARDEN = G10.9');
  if(desc.includes('S45C_HARDEN_G8_8')) return desc.replace(/S45C_HARDEN_G8_8/g,'S45C + HARDEN = G8.8');
  /* "4140" and "Y BAR" are their own materials, separate from 4140 QT. An item
     on one of them already reads correctly and must never gain a QT it does
     not have. Only a desc that stored the raw internal value is repaired. */
  const mat=String(item&&item.material?item.material:'');
  if(mat==='4140_PLAIN'||mat==='Y_BAR') return desc;
  return desc
    .replace(/\b4140\b(?!\s+QT)/g,'4140 QT')
    .replace(/\b4340\b(?!\s+QT)/g,'4340 QT');
}

/* ── Init ── */
/* Quick Open hand-off: companies.php?open=Q-2026-0001 resolves the number and
   opens the EXISTING Quotation Detail modal (viewQuote). Nothing else changes. */
async function openByRefFromUrl(){
  let ref=null,openId=null;
  try{
    const p=new URLSearchParams(location.search);
    ref=p.get('open'); openId=p.get('openId');
  }catch(e){ return; }
  /* ?openId=<id> — the unambiguous hand-off used by Quick Open. Needed because a
     retired number can now match two quotations (the one that still carries it and
     the one it was renumbered to), so resolving by ref could no longer open either.
     ?open=<ref> stays supported for older links. */
  if(openId){
    try{ history.replaceState(null,'',location.pathname); }catch(e){}
    const id=parseInt(openId,10);
    if(id>0) viewQuote(id); else showToast(dcT('msgQuoteNotFound'));
    return;
  }
  if(!ref) return;
  // Drop the parameter so a refresh or back-navigation doesn't reopen it.
  try{ history.replaceState(null,'',location.pathname); }catch(e){}
  const res=await api('find_quotation&ref='+encodeURIComponent(ref));
  const hits=(res&&res.ok&&res.data)||[];
  if(hits.length===1){ viewQuote(hits[0].id); }
  else if(hits.length===0){ showToast(dcT('tQuoteNotFound').replace('{r}',ref)); }
  else {
    /* A retired number can match several quotations. If exactly one still carries
       this number as its CURRENT ref, open that one; otherwise fall back to search. */
    const current=hits.filter(h=>!h.matched_previous);
    if(current.length===1){ viewQuote(current[0].id); return; }
    showToast(dcT('cpManyMatch').replace('{n}',hits.length).replace('{r}',ref)); document.getElementById('searchInput').value=ref; renderCompanyCards();
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  loadCompanies();
  openByRefFromUrl();
});
/* ── Mobile tab switching ── */
/* Each tab keeps its own place: coming back to Recent after a look at
   Customers returns to the card you were on. */
const cpTabScroll={recent:0,customers:0};
let cpTabNow='recent';
function switchMobTab(tab){
  if(tab!==cpTabNow){ cpTabScroll[cpTabNow]=window.scrollY||0; }
  const goTo=(tab!==cpTabNow)?(cpTabScroll[tab]||0):null;
  cpTabNow=tab==='customers'?'customers':'recent';
  if(goTo!==null) requestAnimationFrame(()=>window.scrollTo({top:goTo,behavior:'instant'}));
  const custPane=document.getElementById('mobPaneCustomers');
  const recentPane=document.getElementById('mobPaneRecent');
  const tabCust=document.getElementById('mobTabCustomers');
  const tabRecent=document.getElementById('mobTabRecent');
  if(tab==='customers'){
    custPane.classList.add('mob-pane-active');
    recentPane.classList.remove('mob-pane-active');
    tabCust.classList.add('active');
    tabRecent.classList.remove('active');
  } else {
    recentPane.classList.add('mob-pane-active');
    custPane.classList.remove('mob-pane-active');
    tabRecent.classList.add('active');
    tabCust.classList.remove('active');
  }
}
/* ══ DNC shared desktop shell ═════════════════════════════════════════════
   The same core on both pages. Each page supplies dcShellNew, dcShellTool and
   dcShellLeave for what its own buttons do. */
function dcShellEl(id){ return document.getElementById(id); }
function dcShellInitials(n){
  const p=String(n||'').trim().split(/\s+/).filter(Boolean);
  if(!p.length) return '·';
  return (p[0].charAt(0)+(p.length>1?p[p.length-1].charAt(0):'')).toUpperCase();
}
function dcShellRenderUser(){
  const u=window.DC_SHELL_USER||null;
  const name=(u&&typeof u.name==='string')?u.name:'', user=(u&&typeof u.username==='string')?u.username:'';
  const n=dcShellEl('dncAcctName'), s=dcShellEl('dncAcctUser'), a=dcShellEl('dncAvatar');
  if(n) n.textContent=name; if(s) s.textContent=user; if(a) a.textContent=dcShellInitials(name||user);
  const ini=dcShellInitials(name||user);
  [['rspAcctName',name],['rspAcctUser',user],['rspAcctAvatar',ini],['rspAvatarTop',ini]].forEach(p=>{ const x=dcShellEl(p[0]); if(x) x.textContent=p[1]; });
}
/* What the shell's System Version row says: the short commit /version.php
   reports, and nothing else from it. Read once, when the menu first opens. */
let dcShellVerLoaded=false;
function dcShellLoadVersion(){
  if(dcShellVerLoaded) return;
  const out=dcShellEl('dncSysVer'); if(!out) return;
  const out2=dcShellEl('rspSysVer');
  fetch('version.php',{cache:'no-store',credentials:'same-origin'})
    .then(r=>r.ok?r.json():null)
    .then(d=>{ const c=(d&&typeof d.commit==='string')?d.commit.slice(0,7):''; out.textContent=c||'—'; if(out2) out2.textContent=c||'—'; dcShellVerLoaded=!!c; })
    .catch(()=>{ out.textContent='—'; if(out2) out2.textContent='—'; });
}
function dcShellToggleMenu(force){
  const m=dcShellEl('dncMenu'), b=dcShellEl('dncAcctBtn'); if(!m||!b) return;
  const open = force===undefined ? m.hidden : !!force;
  m.hidden=!open; b.setAttribute('aria-expanded',open?'true':'false');
  if(open) dcShellLoadVersion();
}
/* ══ DNC responsive shell — R1: the tablet drawer and the phone sheets ═════════
   One panel open at a time. The page behind goes inert and stops scrolling;
   Escape, the scrim and the close buttons put it all back. */
const RSP_PANELS={drawer:'dncShell',tools:'rspTools',account:'rspAcct'};
const RSP_TRIGGERS={drawer:['rspBurger'],tools:['rspNavTools'],account:['rspNavAccount','rspAvatarBtn']};
const RSP_INERT=['#rspTop','#rspNav','.app-shell','.wrap','.mobile-bar'];
let rspCur='', rspReturn=null;
function rspMark(name,on){
  (RSP_TRIGGERS[name]||[]).forEach(id=>{ const b=dcShellEl(id); if(b) b.setAttribute('aria-expanded',on?'true':'false'); });
}
function rspOpen(name){
  const p=dcShellEl(RSP_PANELS[name]); if(!p) return;
  if(rspCur===name){ rspClose(); return; }
  if(rspCur) rspClose(false);
  rspReturn=document.activeElement;
  rspCur=name;
  p.classList.add('is-open');
  const sc=dcShellEl('rspScrim'); if(sc) sc.classList.add('is-open');
  document.documentElement.classList.add('rsp-lock');
  RSP_INERT.forEach(s=>document.querySelectorAll(s).forEach(n=>{ n.inert=true; }));
  rspMark(name,true);
  if(name==='account') dcShellLoadVersion();
  if(name==='drawer') dcShellLoadVersion();
  requestAnimationFrame(()=>{
    const f=p.querySelector(name==='drawer'?'.rsp-close':'.rsp-x')||p;
    try{ f.focus({preventScroll:true}); }catch(e){ f.focus(); }
  });
}
function rspClose(restore){
  if(!rspCur) return;
  const p=dcShellEl(RSP_PANELS[rspCur]); if(p) p.classList.remove('is-open');
  const sc=dcShellEl('rspScrim'); if(sc) sc.classList.remove('is-open');
  document.documentElement.classList.remove('rsp-lock');
  RSP_INERT.forEach(s=>document.querySelectorAll(s).forEach(n=>{ n.inert=false; }));
  rspMark(rspCur,false);
  const back=rspReturn; rspCur=''; rspReturn=null;
  if(restore!==false&&back&&back.focus){ try{ back.focus({preventScroll:true}); }catch(e){} }
}
function rspTop(){ rspClose(false); window.scrollTo({top:0,behavior:'smooth'}); }
/* Esc comes first to an open account menu inside the drawer, then to the drawer. */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!rspCur) return;
  const m=dcShellEl('dncMenu'); if(m&&!m.hidden) return;
  rspClose();
},true);
/* Choosing something inside a panel closes it; the choice itself has already run. */
document.addEventListener('click',e=>{
  if(!rspCur||!e.target.closest) return;
  if(e.target.closest('.rsp-go, #dncShell .dnc-cta, #dncShell .dnc-link, #dncShell .dnc-back, #dncShell a.dnc-mi, #dncShell button.dnc-mi')) rspClose(false);
});
window.addEventListener('resize',()=>{
  if(!rspCur) return;
  const w=window.innerWidth;
  if(rspCur==='drawer'?(w<600||w>=1024):w>=600) rspClose(false);
});
document.addEventListener('click',e=>{
  const m=dcShellEl('dncMenu'); if(!m||m.hidden) return;
  if(e.target.closest&&(e.target.closest('#dncMenu')||e.target.closest('#dncAcctBtn'))) return;
  dcShellToggleMenu(false);
});
document.addEventListener('keydown',e=>{
  const m=dcShellEl('dncMenu');
  if(e.key==='Escape'&&m&&!m.hidden){ dcShellToggleMenu(false); const b=dcShellEl('dncAcctBtn'); if(b) b.focus(); }
},true);
dcShellRenderUser();

function dcShellIntentGo(k){
  try{ sessionStorage.setItem('dcShellIntent',k); }catch(e){}
  window.location.href='index.php';
}
function dcShellNew(){ dcShellToggleMenu(false); dcShellIntentGo('new'); }
function dcShellTool(k){ if(['dp','ds','ref','whatsnew'].indexOf(k)>=0) dcShellIntentGo(k); }
/* Nothing on this page is a draft, so another module is a plain link. */
function dcShellLeave(){ return true; }


/* ── R2.4 Session E — Heroicons (the same block in index.php and companies.php) ──
   dcIcon(name) gives an icon for HTML the page builds. dcIconize() turns a
   known emoji / symbol in DISPLAYED text into its Heroicon: the strings, the
   translations, the stored data, WhatsApp and Print text are not touched —
   only text nodes on screen, skipping script, style, textarea, options, SVG
   and print areas. A MutationObserver applies it to whatever is rendered
   later (toasts, cards, review rows). A button left with no text is given
   an accessible name. */
const DC_ICON_EMOJI=[['✅','check-circle','ok'],['⚠️','exclamation-triangle','warn'],['⚠','exclamation-triangle','warn'],['❌','x-circle','bad'],['✗','x-circle','bad'],
  ['✖️','x-mark',''],['✖','x-mark',''],['✕','x-mark',''],['ℹ️','information-circle','info'],['ℹ','information-circle','info'],['✓','check','ok'],['✨','sparkles','info'],
  ['💬','chat-bubble-left-right',''],['👤','user-circle',''],['🖼️','photo',''],['🖼','photo',''],['📋','clipboard-document-list',''],['🏢','building-office-2',''],
  ['🔍','magnifying-glass',''],['🗑️','trash',''],['🗑','trash',''],['📄','document-duplicate',''],['💡','light-bulb','info'],['💾','check',''],['📂','folder-open',''],
  ['📭','inbox',''],['✏️','pencil-square',''],['✏','pencil-square',''],['✎','pencil-square',''],['📦','cube',''],['👁️','eye',''],['👁','eye',''],['📅','calendar-days',''],
  ['➕','plus',''],['🧮','calculator',''],['🕘','clock','']];
const DC_ICON_RE=new RegExp('('+DC_ICON_EMOJI.map(x=>x[0]).sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\uFE0F? ?','g');
const DC_ICON_SKIP='script,style,textarea,option,title,svg,[data-no-icons],#printSummary,.print-card,.print-only,noscript';
function dcIcon(name,cls){ return '<svg class="hi'+(cls?' '+cls:'')+'" aria-hidden="true" focusable="false"><use href="#hi-'+name+'"/></svg>'; }
function dcIconNode(name,tone,trail){
  const ns='http://www.w3.org/2000/svg', s=document.createElementNS(ns,'svg'), u=document.createElementNS(ns,'use');
  s.setAttribute('class','dc-ic'+(tone?' ic-'+tone:'')+(trail?' ic-trail':'')); s.setAttribute('aria-hidden','true'); s.setAttribute('focusable','false');
  u.setAttribute('href','#hi-'+name); s.appendChild(u); return s;
}
function dcIconizeText(t){
  const p=t.parentNode; if(!p||p.nodeType!==1||p.closest(DC_ICON_SKIP)) return;
  const s=t.nodeValue; DC_ICON_RE.lastIndex=0; if(!DC_ICON_RE.test(s)) return;
  DC_ICON_RE.lastIndex=0;
  const frag=document.createDocumentFragment(); let last=0, m;
  while((m=DC_ICON_RE.exec(s))){
    if(m.index>last) frag.appendChild(document.createTextNode(s.slice(last,m.index)));
    const hit=DC_ICON_EMOJI.find(x=>x[0]===m[1]); frag.appendChild(dcIconNode(hit[1],hit[2],m.index>0&&!s.slice(m.index+m[0].length).trim()));
    last=m.index+m[0].length;
  }
  if(last<s.length) frag.appendChild(document.createTextNode(s.slice(last)));
  p.replaceChild(frag,t);
  const btn=p.closest('button,[role="button"]');
  if(btn && !btn.getAttribute('aria-label') && !btn.textContent.trim()) btn.setAttribute('aria-label',btn.getAttribute('title')||dcT('rspClose'));
}
function dcIconize(root){
  if(!root) return;
  if(root.nodeType===3){ dcIconizeText(root); return; }
  if(root.nodeType!==1 && root.nodeType!==9 && root.nodeType!==11) return;
  if(root.nodeType===1 && root.closest(DC_ICON_SKIP)) return;
  if(root.nodeType===1 && root.tagName==='SELECT'){ [...root.options].forEach(o=>{ const v=o.textContent.replace(DC_ICON_RE,''); if(v!==o.textContent) o.textContent=v; }); return; }
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), list=[]; let n;
  while((n=w.nextNode())) if(n.nodeValue && /[ℹ☀-➿\uD83C-\uD83E]/.test(n.nodeValue)) list.push(n);
  list.forEach(dcIconizeText);
  if(root.querySelectorAll) root.querySelectorAll('select').forEach(sel=>dcIconize(sel));
}
(function(){
  let q=[], raf=0;
  const flush=()=>{ raf=0; const l=q; q=[]; l.forEach(x=>{ if(x.isConnected) dcIconize(x); }); };
  const obs=new MutationObserver(recs=>{ recs.forEach(r=>{ if(r.type==='characterData') q.push(r.target); else r.addedNodes.forEach(x=>q.push(x)); }); if(!raf) raf=requestAnimationFrame(flush); });
  const start=()=>{ dcIconize(document.body); obs.observe(document.body,{childList:true,subtree:true,characterData:true}); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
/* R2.3 Session E — the keyboard, as on Quotation: while an on-screen keyboard
   covers the page (a text field is focused and the visible area shrank by
   more than 120px) html.kb-open is set, and the bottom navigation steps aside
   instead of riding up on top of the keyboard. Presentation only. */
(function(){
  const root=document.documentElement, vv=window.visualViewport;
  const isField=n=>n&&n.matches&&n.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]),select,textarea');
  let baseH=Math.max(window.innerHeight,vv?vv.height:0);
  function measure(){
    const vh=vv?vv.height:window.innerHeight, top=vv?vv.offsetTop:0;
    if(!root.classList.contains('kb-open')) baseH=Math.max(baseH,window.innerHeight,vh);
    const open=isField(document.activeElement) && (baseH-vh-top)>120 && window.innerWidth<=900;
    root.classList.toggle('kb-open',open);
  }
  document.addEventListener('focusin',e=>{ if(isField(e.target)) setTimeout(measure,320); });
  document.addEventListener('focusout',()=>setTimeout(()=>{ if(!isField(document.activeElement)){ root.classList.remove('kb-open'); baseH=Math.max(window.innerHeight,vv?vv.height:0); } },120));
  if(vv) vv.addEventListener('resize',measure);
  let lastW=window.innerWidth;
  window.addEventListener('resize',()=>{ if(window.innerWidth!==lastW){ lastW=window.innerWidth; root.classList.remove('kb-open'); baseH=Math.max(window.innerHeight,vv?vv.height:0); } });
})();

/* ── Smart Pull-to-Refresh (R2.2) — the same block in index.php and companies.php ──
   The installed Home Screen app has no browser pull-to-refresh, so the page
   offers its own — and only there (a browser tab keeps the browser's own).
   It never reloads the app: the page's dcPtrRefresh() fetches fresh data and
   replaces what is shown ONLY when every request succeeded; on any failure the
   page is left exactly as it was and Retry is offered.
   Before anything is fetched the page's dcPtrGuard() is asked; any reason
   (unsaved quotation, Quick Add open, AI reading, a window open, typing…)
   blocks it. A guard that is missing or throws blocks too: fail closed.
   The pull only starts at the very top of the page, from a plain part of the
   page: never inside a window, sheet, menu, table, scroll box or form field,
   never sideways, never with two fingers. One refresh at a time.          */
const dcPtr=(function(){
  const PULL=64, MAX=112;
  const S={force:false, busy:false, armed:false, pulling:false, y0:0, x0:0, d:0, el:null, hideT:0, runs:0};
  function standalone(){
    try{ if(window.navigator.standalone===true) return true; }catch(e){}
    try{ return window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches; }catch(e){ return false; }
  }
  function enabled(){ return S.force||standalone(); }
  function atTop(){ const se=document.scrollingElement||document.documentElement; return (window.scrollY||se.scrollTop||0)<=0; }
  const NO_START='.modal-overlay,.rsp-sheet,.rsp-scrim,.dnc-shell,.rsp-nav,.mobile-bar,#dncMenu,.ac-dropdown,select,input,textarea,[contenteditable],table,.dc-ptr';
  function plainTarget(t){
    if(!t||!t.closest) return false;
    if(t.closest(NO_START)) return false;
    for(let n=t;n&&n!==document.body&&n!==document.documentElement;n=n.parentElement){
      const cs=getComputedStyle(n);
      if(/(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+1) return false;
      if(/(auto|scroll)/.test(cs.overflowX)&&n.scrollWidth>n.clientWidth+1) return false;
    }
    return true;
  }
  function anyOverlay(){
    const r=document.documentElement;
    if(r.classList.contains('rsp-lock')||r.classList.contains('kb-open')) return true;
    if(typeof rspCur!=='undefined'&&rspCur) return true;
    return !!document.querySelector('.modal-overlay.open');
  }
  function ui(){
    if(S.el) return S.el;
    const st=document.createElement('style');
    st.textContent='.dc-ptr{position:fixed;left:50%;top:calc(var(--banner-h,0px) + var(--header-h,58px) + 8px);z-index:265;'
      +'display:flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);padding:7px 14px;border-radius:999px;'
      +'background:#fff;border:1px solid #e2e4ea;box-shadow:0 6px 20px rgb(22 26 35 / .14);color:#4d5463;'
      +'font:500 13px/1.25 "IBM Plex Sans",system-ui,sans-serif;transform:translate(-50%,-140%);opacity:0;pointer-events:none;'
      +'transition:transform .18s ease,opacity .18s ease}'
      +'.dc-ptr.is-on{opacity:1;transform:translate(-50%,0)}'
      +'.dc-ptr.is-drag{transition:none}'
      +'.dc-ptr.is-act{pointer-events:auto}'
      +'.dc-ptr-ico{width:16px;height:16px;flex:0 0 16px;border-radius:50%;border:2px solid #c7cbe9;border-top-color:#4338ca}'
      +'.dc-ptr.is-spin .dc-ptr-ico{animation:dcPtrSpin .7s linear infinite}'
      +'.dc-ptr.is-ok .dc-ptr-ico{border-color:#16a34a}'
      +'.dc-ptr.is-bad .dc-ptr-ico,.dc-ptr.is-block .dc-ptr-ico{border-color:#d97706}'
      +'.dc-ptr-msg{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.dc-ptr-retry{flex:0 0 auto;border:0;background:#eef0fd;color:#4338ca;font:inherit;font-weight:600;padding:4px 10px;border-radius:999px;cursor:pointer}'
      +'@keyframes dcPtrSpin{to{transform:rotate(360deg)}}'
      +'@media (prefers-reduced-motion:reduce){.dc-ptr{transition:none}.dc-ptr.is-spin .dc-ptr-ico{animation:none}}';
    document.head.appendChild(st);
    const d=document.createElement('div');
    d.className='dc-ptr'; d.id='dcPtr'; d.setAttribute('role','status'); d.setAttribute('aria-live','polite');
    d.innerHTML='<span class="dc-ptr-ico" aria-hidden="true"></span><span class="dc-ptr-msg"></span>';
    document.body.appendChild(d);
    S.el=d; return d;
  }
  function show(kind,msg,opts){
    const d=ui(); clearTimeout(S.hideT);
    d.className='dc-ptr is-on'+(kind?' is-'+kind:'')+(opts&&opts.drag?' is-drag':'');
    d.querySelector('.dc-ptr-msg').textContent=msg;
    const old=d.querySelector('.dc-ptr-retry'); if(old) old.remove();
    if(opts&&opts.retry){
      const b=document.createElement('button'); b.type='button'; b.className='dc-ptr-retry'; b.textContent=dcT('ptrRetry');
      b.onclick=()=>run(); d.appendChild(b); d.classList.add('is-act');
    }
    if(opts&&opts.drag) d.style.transform='translate(-50%,'+Math.round(Math.min(0,(S.d-PULL)))+'px)'; else d.style.transform='';
    if(opts&&opts.ms) S.hideT=setTimeout(hide,opts.ms);
  }
  function hide(){ if(!S.el) return; clearTimeout(S.hideT); S.el.className='dc-ptr'; S.el.style.transform=''; }
  function guard(){
    let r;
    try{
      if(typeof window.dcPtrGuard!=='function') return 'ptrBlockUnknown';
      r=window.dcPtrGuard();
    }catch(e){ return 'ptrBlockUnknown'; }
    if(typeof r!=='string') return 'ptrBlockUnknown';
    if(r) return r;
    return anyOverlay()?'ptrBlockOpen':'';
  }
  async function run(){
    if(S.busy) return 'busy';                       // one refresh at a time
    const why=guard();
    if(why){ show('block',dcT(why),{ms:3200}); return why; }
    S.busy=true; S.runs++;
    show('spin',dcT('ptrRefreshing'));
    let ok=false;
    try{ ok=(typeof window.dcPtrRefresh==='function')&&(await window.dcPtrRefresh())===true; }catch(e){ ok=false; }
    S.busy=false;
    if(ok){ show('ok',dcT('ptrDone'),{ms:1400}); return 'ok'; }
    show('bad',dcT('ptrFail'),{retry:true,ms:9000});
    return 'fail';
  }
  function reset(){ S.armed=false; S.pulling=false; S.d=0; }
  document.addEventListener('touchstart',e=>{
    reset();
    if(!enabled()||S.busy||e.touches.length!==1||!atTop()||anyOverlay()||!plainTarget(e.target)) return;
    S.armed=true; S.y0=e.touches[0].clientY; S.x0=e.touches[0].clientX;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!S.armed) return;
    if(e.touches.length!==1){ if(S.pulling) hide(); reset(); return; }
    const dy=e.touches[0].clientY-S.y0, dx=e.touches[0].clientX-S.x0;
    if(!S.pulling){
      if(Math.abs(dx)>10&&Math.abs(dx)>=Math.abs(dy)){ reset(); return; }   // sideways: not ours
      if(dy<0||!atTop()){ reset(); return; }                                  // scrolling up/away: not ours
      if(dy<10) return;
      S.pulling=true;
    }
    if(!atTop()){ hide(); reset(); return; }
    if(e.cancelable) e.preventDefault();
    S.d=Math.min(MAX,Math.max(0,dy)*0.55);
    show('',dcT(S.d>=PULL?'ptrRelease':'ptrPull'),{drag:true});
  },{passive:false});
  function end(){
    if(!S.armed) return;
    const go=S.pulling&&S.d>=PULL;
    const was=S.pulling; reset();
    if(go) run(); else if(was) hide();
  }
  document.addEventListener('touchend',end,{passive:true});
  document.addEventListener('touchcancel',()=>{ if(S.pulling) hide(); reset(); },{passive:true});
  return { run, guard, enabled, plainTarget, state:S, hide };
})();

/* Saved page: what blocks a pull-to-refresh, and what one refreshes. The
   companies and the first page of quotations are fetched together and shown
   only when both arrived; a selected company is then re-read the way a tap
   on it reads it. On any failure the lists on screen stay as they were. */
window.dcPtrGuard=function(){
  if(document.querySelector('.modal-overlay.open')) return 'ptrBlockOpen';
  if(recentQuotesLoading||companyQuotesLoading) return 'ptrBlockBusy';
  const typed=[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=button]),textarea')]
    .some(n=>n.offsetParent!==null&&String(n.value||'').trim()!=='');
  if(typed) return 'ptrBlockInput';
  const a=document.activeElement; if(a&&a.matches&&a.matches('input,select,textarea,[contenteditable]')) return 'ptrBlockInput';
  return '';
};
window.dcPtrRefresh=async function(){
  const r=await Promise.all([api('get_companies'),api('get_quotations&limit='+RECENT_QUOTES_PAGE_SIZE+'&offset=0')]);
  if(!r.every(x=>x&&x.ok===true)) return false;
  allCompaniesCache=r[0].data||[];
  applyRecentQuotations(r[1]);
  renderSummary();
  renderCompanyCards();
  if(selectedCompanyId===null){ renderRecentQuotations(); return true; }
  return (await selectCompany(selectedCompanyId))!==false;
};
</script>
</body>
</html>
