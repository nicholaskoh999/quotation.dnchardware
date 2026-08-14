<?php require_once __DIR__ . '/auth.php'; dc_require_login(); ?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#eef0f4;--surface:#fff;--surface2:#f6f7f9;--surface3:#f0f2f6;
  --border:#e0e4eb;--border-focus:#3b5bdb;
  --text:#111318;--text-2:#3d4452;--text-muted:#6b7280;
  --accent:#2547d0;--accent-2:#1c3faa;--accent-light:#eef1fd;--accent-mid:#c7d0f8;
  --green:#0e7a38;--green-light:#dcfce7;
  --red:#dc2626;--red-light:#fef2f2;--red-mid:#fecaca;
  --amber:#d97706;--amber-light:#fffbeb;--amber-mid:#fde68a;
  --purple:#7c3aed;--purple-light:#f5f3ff;
  --shadow:0 1px 3px rgba(0,0,0,.07),0 4px 20px rgba(0,0,0,.07);
  --shadow-md:0 4px 6px rgba(0,0,0,.07),0 10px 30px rgba(0,0,0,.09);
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
</style>
</head>
<body>

<div class="page-header">
  <a class="brand-link" href="index.php" aria-label="Der-Cheng Quotation — home">
    <img class="logo" src="/assets/icons/icon-192.png" alt="" width="32" height="32" decoding="async">
    <div class="header-text">
      <h1>Der-Cheng Quotation</h1>
      <p data-i18n="brandSub">Quotation System · v2.24.0</p>
    </div>
  </a>
  <!-- Global nav: identical to index.php -->
  <div class="header-actions">
    <div class="lang-switch" role="group" data-i18n-aria="langAria" aria-label="Language">
      <button type="button" class="lang-btn" data-lang-set="en" aria-pressed="true"  onclick="dcSetLang('en')">EN</button>
      <button type="button" class="lang-btn" data-lang-set="zh" aria-pressed="false" onclick="dcSetLang('zh')">中文</button>
    </div>
    <a href="index.php" class="nav-btn" data-i18n-title="navCalculatorTitle" title="Quotation Calculator" data-i18n="navCalculator">Calculator</a>
    <a href="companies.php" class="nav-btn is-active" aria-current="page" data-i18n="navCompanies">Companies</a>
    <a href="logout.php" class="nav-btn is-secondary" data-i18n-title="navSignOutTitle" title="Sign out on this device only" data-i18n="navSignOut">Sign Out</a>
  </div>
</div>

<div class="wrap" style="display:block;max-width:1240px">

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

  <!-- Dashboard summary -->
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
            <span class="icon">🔍</span>
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

      <button class="btn btn-primary" id="addCompanyToggleBtn" style="width:100%;margin-bottom:12px" onclick="toggleAddCompanyForm()"><span data-i18n="addCompanyBtn">＋ Add Company</span></button>

      <div class="card" id="addCompanyForm" hidden style="margin-bottom:14px">
        <div class="section-label"><span class="sl-icon">➕</span><span data-i18n="addCompany">Add Company</span></div>
        <div class="field"><label data-i18n="lblCompanyName">Company Name *</label><input type="text" id="c-name" data-i18n-ph="phCompanyEg" placeholder="e.g. SL Struktur Sdn Bhd"></div>
        <div class="field"><label data-i18n="lblShortCode">Short Code</label><input type="text" id="c-code" data-i18n-ph="phShortEg" placeholder="e.g. SLSPJ" style="text-transform:uppercase"></div>
        <div class="field"><label data-i18n="lblPhone">Phone</label><input type="text" id="c-phone" data-i18n-ph="phPhoneEg" placeholder="03-XXXX XXXX"></div>
        <div class="field"><label data-i18n="lblAddress">Address</label><textarea id="c-addr" rows="2" data-i18n-ph="phOptional" placeholder="Optional"></textarea></div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-primary" style="flex:1" onclick="addCompany()"><span data-i18n="addCompanyBtn">＋ Add Company</span></button>
          <button class="btn btn-ghost" style="flex:1" onclick="closeAddCompanyForm()" data-i18n="cancel">Cancel</button>
        </div>
      </div>

      <div class="list-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="section-label" style="margin-bottom:0;padding-bottom:0;border-bottom:none"><span class="sl-icon">🏢</span><span data-i18n="secCompanies">Companies</span></div>
        <span class="list-count" id="companyCount">0</span>
      </div>
      <div id="companyList"><div class="empty-state"><div class="icon">🏢</div><p><span data-i18n="msgNoCompanies">No companies yet</span> <span class="sub">还没有公司</span></p></div></div>
    </div>

    <!-- Right: Recent Quotations (default) or Selected company panel -->
    <div id="mobPaneRecent" class="mob-pane mob-pane-active">
    <!-- Item price-history search sits with the quotation history it searches.
         It never filters the Companies list and never switches panes. -->
    <div class="card item-search-tools">
      <div class="search-input-wrap">
        <span class="icon">🔍</span>
        <input type="text" id="itemSearchInput" data-i18n-ph="phSearchItem" placeholder="Search item, material, size, product..." autocomplete="off"
               oninput="onItemSearchInput()"
               onkeydown="if(event.key==='Enter'){event.preventDefault();itemSearchSubmit();}">
      </div>
      <p class="item-search-hint"><span data-i18n="itemSearchHint">Past quoted prices — try “M16 J BOLT”, “4140”, “Y BAR”</span></p>
      <div class="cp-search-result" id="itemSearchResult" hidden></div>
    </div>
    <div id="rightPanel">
      <div class="empty-state empty-state-compact">
        <div class="icon">📋</div>
        <p>Loading recent quotations…</p>
      </div>
    </div>
    </div><!-- /mobPaneRecent -->

  </div>

</div>

<!-- Edit Company Modal -->
<div class="modal-overlay" id="editCompanyModal">
  <div class="modal">
    <div class="modal-title">✏️ <span data-i18n="editCompany">Edit Company</span> <button class="modal-close" onclick="closeModal('editCompanyModal')">✕</button></div>
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
  <div class="modal" style="max-width:600px">
    <div class="modal-title">
      📋 <span data-i18n="quotationDetail">Quotation Detail</span>
      <button class="modal-close" onclick="closeModal('viewModal')">✕</button>
    </div>
    <div id="viewModalBody"></div>
    <div class="modal-btns" style="margin-top:16px">
      <button class="btn btn-primary" onclick="loadAndGo()">📂 <span data-i18n="loadAndEdit">Load &amp; Edit</span></button>
      <button class="btn btn-ghost" onclick="closeModal('viewModal')" data-i18n="close">Close</button>
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
    language:'Language', langAria:'Language', langSwitched:'Language set to English',
    navCalculator:'Calculator', navCalculatorTitle:'Quotation Calculator',
    navCompanies:'Companies', navSignOut:'Sign Out',
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
  },
  zh:{
    language:'语言', langAria:'语言', langSwitched:'已切换为中文',
    navCalculator:'计算器', navCalculatorTitle:'报价计算器',
    navCompanies:'公司', navSignOut:'退出',
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
    phPhoneEg:'03-XXXX XXXX', phOptional:'可选',
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
  dcApplyLang();
});
function dcSetLang(l){
  if(DC_LANGS.indexOf(l)<0) return;
  const before=dcLang();
  try{ localStorage.setItem(DC_LANG_KEY,l); }catch(e){}
  dcApplyLang();
  if(before!==l) dcRelabel();
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
async function api(action,data={},method='GET'){
  const url='api.php?action='+action;
  const opts=method==='GET'?{method:'GET'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
  const r=await fetch(url,opts);
  /* Session expired (or signed out in another tab) — go to login, then back. */
  if(r.status===401){
    location.href='login.php?next='+encodeURIComponent(location.pathname+location.search);
    return {ok:false,error:'Signed out'};
  }
  return r.json();
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
      <div class="card" style="margin-bottom:12px">
        <div class="section-label" style="margin-bottom:0;padding-bottom:0;border-bottom:none"><span class="sl-icon">📋</span>${dcT('secRecentQuotations')}</div>
      </div>
      <div class="empty-state empty-state-compact">
        <div class="icon">📭</div>
        <p>${dcT('msgNoRecent')}</p>
      </div>`;
    return;
  }

  const cardsHtml = recent.map(q=>{
    const items = q.items||[];
    const previewText = items.length
      ? items.slice(0,1).map(it=>it.desc||it.size||'').join('') + (items.length>1?` +${items.length-1} more`:'')
      : dcT('msgNoItems');
    return `
      <div class="rq-card">
        <div class="rq-card-top">
          <div class="rq-top">
            <div>
              <div class="rq-no">${esc(q.ref_no||'(No Ref)')}</div>
              <div class="rq-company">🏢 ${esc(q.company_name||'—')}</div>
              <div class="rq-date">📅 ${fmtDate(q.quote_date||q.created_at)}</div>
            </div>
          </div>
          <div class="rq-preview">${esc(previewText)}</div>
        </div>
        <div class="rq-card-bot">
          <div class="rq-total"><span class="ref-total-label">Reference Total</span> <b>${fmtMoneyCP(q.total_amount)}</b></div>
          <div class="rq-actions">
            <button class="btn btn-primary" onclick="viewQuote(${q.id})">👁️ View</button>
            <button class="btn btn-amber" onclick="loadQuoteToCalc(${q.id})">📂 Load</button>
          </div>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div class="section-label" style="margin-bottom:0;padding-bottom:0;border-bottom:none"><span class="sl-icon">📋</span>${dcT('secRecentQuotations')}</div>
    </div>
    <div class="q-helper">ℹ️ Select a company on the left to view all saved quotations for that company.</div>
    ${cardsHtml}
    <div id="recentQuotesMoreWrap" style="display:${recentQuotesHasMore?'block':'none'};text-align:center;margin-top:12px">
      <button class="btn btn-ghost" id="recentQuotesMoreBtn" onclick="loadMoreRecentQuotations()">Load More Quotations / 加载更多报价</button>
    </div>
    <div id="recentQuotesDone" class="q-helper" style="display:${!recentQuotesHasMore?'block':'none'};text-align:center;margin-top:12px">No more quotations / 没有更多报价</div>
  `;
}

async function loadAllQuotations(){
  recentQuotesOffset=0;
  recentQuotesHasMore=true;
  recentQuotesLoading=false;
  recentQuoteIds.clear();
  const res = await api('get_quotations&limit='+RECENT_QUOTES_PAGE_SIZE+'&offset=0');
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
    /* ref_no, date and company_name are stored data and pass through as-is. */
    { cls:"sc-purple", label:dcT('cardLatestSavedQuote'), value: latest?(latest.ref_no||'(No Ref)'):'—',
      sub: latest ? (fmtDate(latest.quote_date||latest.created_at)+' — '+esc(latest.company_name||'')) : dcT('cardNoQuotationsYet') }
  ];
  document.getElementById('summaryGrid').innerHTML = cards.map(c=>`
    <div class="summary-card ${c.cls}">
      <div class="summary-label">${c.label}</div>
      <div class="summary-value">${c.value}</div>
      <div class="summary-sub">${c.sub}</div>
    </div>`).join('');
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
  b.innerHTML='<div class="cp-hit-msg cp-hit-busy"><span data-i18n="msgLookingUp">Looking up quotation…</span></div>';
  b.hidden=false;
}
function cpNotFoundPanel(term){
  const b=document.getElementById('cpSearchResult');
  b.innerHTML='<div class="cp-empty"><div class="cp-empty-icon">🔍</div>'
    +'<p class="cp-empty-main">No quotation “'+esc(term)+'”</p>'
    +'<p class="cp-empty-sub">Looking for a past price instead? Use the item search under Recent Quotations.</p></div>';
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
  b.innerHTML='<div class="cp-hit-msg cp-hit-busy"><span data-i18n="msgSearchingHistory">Searching quotation history…</span></div>';
  b.hidden=false;
}
function itemEmptyPanel(term){
  const b=document.getElementById('itemSearchResult');
  b.innerHTML='<div class="cp-empty"><div class="cp-empty-icon">🔍</div>'
    +'<p class="cp-empty-main">No past items match “'+esc(term)+'”</p>'
    +'<p class="cp-empty-sub"><span data-i18n="msgTryFewer">Try fewer words, or a size and product like “M16 J BOLT”.</span></p></div>';
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
      ? `<span class="cp-hit-prev">Formerly ${esc(h.previous_ref_no)}</span>` : '';
    return `<button type="button" class="cp-hit" onclick="cpSearchClear();viewQuote(${parseInt(h.id,10)})">
        <span class="cp-hit-main"><span class="cp-hit-ref">${esc(h.ref_no)}</span>
        <span class="cp-hit-sub">${esc(who)} · ${esc(when)}</span>${prev}</span>
        <span class="cp-hit-amt">RM ${amt}</span></button>`;
  }).join('');
  const head=hits.length===1
    ? `Quotation ${esc(term)} was renumbered. / 此报价编号已更改：`
    : `${hits.length} quotations match “${esc(term)}”. Choose one: / 多个结果，请选择：`;
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
    const prev=h.previous_ref_no?`<span class="ih-prev">Formerly ${esc(h.previous_ref_no)}</span>`:'';
    return `<div class="ih-card">
      <div class="ih-desc">${esc(h.desc||'—')}${finish}</div>
      <div class="ih-size">${esc(h.size||'')}</div>
      <div class="ih-meta">${esc(h.customer||'—')} · ${esc(when)} · <strong>${esc(h.ref_no)}</strong>${prev}</div>
      <div class="ih-foot">
        <span class="ih-qty">Qty ${qty}</span>
        <span class="ih-price">Unit Price <strong>RM ${unit}</strong></span>
      </div>
      <button type="button" class="btn btn-primary ih-view" onclick="itemSearchClear();viewQuote(${parseInt(h.quotation_id,10)})">View Quotation</button>
    </div>`;
  }).join('');
  const more=meta&&meta.truncated?` (showing the newest ${hits.length})`:'';
  const b=document.getElementById('itemSearchResult');
  b.innerHTML=`<div class="cp-hit-msg">${hits.length} historical item${hits.length===1?'':'s'} match “${esc(term)}”${more} — newest first:</div>
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
    document.getElementById('companyList').innerHTML='<div class="empty-state"><div class="icon">🏢</div><p>'+dcT('msgNoCompanies')+' <span class="sub">还没有公司</span></p></div>';
    return;
  }
  if(!list.length){
    /* Item results live in the right pane now, so this only ever speaks for the
       Companies list and can say so plainly. */
    document.getElementById('companyList').innerHTML=
      '<div class="empty-state"><div class="icon">🏢</div><p>'+dcT('msgNoCompanyMatch')+'</p></div>';
    return;
  }

  document.getElementById('companyList').innerHTML = list.map(c=>{
    const qCount = exactQuoteCount(c.id);
    const lastDate = lastDateForCompany(c.id); // uses API exact date first
    const isRecent = lastDate && daysSinceCP(lastDate) <= 14;
    const hasRemarks = quotesForCompany(c.id).some(q=>q.remarks && q.remarks.trim().length>0);

    let badge = '<span class="status-badge badge-norecent">Active</span>';
    if(!lastDate || qCount === 0) badge = '<span class="status-badge badge-norecent">No Quotes</span>';
    else if(isRecent) badge = '<span class="status-badge badge-recent">Recent</span>';
    else if(hasRemarks) badge = '<span class="status-badge badge-remarks">Has Remarks</span>';

    const phoneLine = c.phone ? esc(c.phone) : '—';
    const quoteLine = qCount === 0
      ? 'No saved quotations'
      : `Saved quotes: <b>${qCount}</b> · Latest: ${lastDate ? fmtDate(lastDate) : '—'}`;

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
            <button class="cc-icon-btn" title="Edit" onclick="event.stopPropagation();openEditCompany(${c.id},'${esc(c.name)}','${esc(c.short_code||'')}','${esc(c.phone||'')}','${esc(c.address||'')}')">✏️</button>
            <button class="cc-icon-btn" title="Delete" onclick="event.stopPropagation();deleteCompany(${c.id},'${esc(c.name)}')">🗑️</button>
          </span>
        </div>
      </div>`;
  }).join('');
}

/* ── Add Company collapsible ── */
function toggleAddCompanyForm(){
  const f=document.getElementById('addCompanyForm');
  f.hidden=!f.hidden;
  if(!f.hidden){const n=document.getElementById('c-name');if(n)n.focus();}
}
function closeAddCompanyForm(){
  document.getElementById('addCompanyForm').hidden=true;
}

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
  } else showToast('❌ '+(res.error||'Error'));
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
  else showToast('❌ '+(res.error||'Error'));
}

async function deleteCompany(id,name){
  if(!confirm('Delete company "'+name+'"?\nAll linked quotations will be unlinked.'))return;
  const res=await api('delete_company',{id},'POST');
  if(res.ok){showToast(dcT('msgDeleted'));if(selectedCompanyId==id){selectedCompanyId=null;}loadCompanies();}
  else showToast('❌ '+(res.error||'Error'));
}

/* ── Quotations ── */
function renderCompanyQuoteCard(q){
  const items = q.items||[];
  const previewItems = items.slice(0,2);
  const moreCount = items.length - previewItems.length;
  const previewHtml = previewItems.map(it=>`
    <div class="item-line"><span>${esc(it.desc||it.size||'')} <span class="q-detail-chip chip-${safeClassToken(it.finish||'')}">${esc(it.finish||'')}</span></span><span style="flex-shrink:0;margin-left:8px">${parseInt(it.qty,10)||0} × RM${parseFloat(it.finalUnitPrice||0).toFixed(2)}</span></div>
  `).join('') + (moreCount>0 ? `<div class="item-more">+${moreCount} more item${moreCount===1?'':'s'}</div>` : '');

  return `
    <div class="q-card" data-quote-id="${q.id}">
      <div class="q-card-top">
        <div class="q-top">
          <div>
            <div class="q-no">${esc(q.ref_no||'(No Ref)')}</div>
            <div class="q-dates">Date: ${fmtDate(q.quote_date)}</div>
          </div>
        </div>
        <div class="q-meta">
          ${q.prepared_by?`<span>👤 ${esc(q.prepared_by)}</span>`:''}
          <span>📦 ${items.length} item${items.length===1?'':'s'}</span>
        </div>
        <div class="q-preview">${previewHtml || '<span style="opacity:.6">No items</span>'}</div>
        ${q.remarks ? `<div class="q-remarks">💬 ${esc(q.remarks)}</div>` : ''}
      </div>
      <div class="q-card-bottom">
        <div class="ref-total">
          <span class="ref-total-label">Reference Total</span><br>
          <b>${fmtMoneyCP(q.total_amount)}</b>
        </div>
        <div class="quote-actions">
          <button class="btn btn-primary" onclick="viewQuote(${q.id})">👁️ View</button>
          <button class="btn btn-amber" onclick="loadQuoteToCalc(${q.id})">📂 Load</button>
          <button class="btn btn-ghost" onclick="duplicateQuote(${q.id})">📄 Duplicate</button>
          <button class="btn btn-danger" onclick="deleteQuote(${q.id})">🗑️ Delete</button>
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
  if(!res.ok){showToast(dcT('msgFailLoadQuotes'));return}
  const quotes=(res.data||[]).sort((a,b)=>new Date(b.quote_date||b.created_at)-new Date(a.quote_date||a.created_at));
  const totalQuotesForCompany = Number.isFinite(Number(res.total)) ? Number(res.total) : quotes.length;
  companyQuotesOffset=quotes.length;
  companyQuotesHasMore=companyQuotesOffset<totalQuotesForCompany;
  quotes.forEach(q=>companyQuoteIds.add(String(q.id)));
  const c = allCompaniesCache.find(x=>x.id==id);
  if(!c) return;

  const lastDate = quotes.length ? (quotes[0].quote_date||quotes[0].created_at) : null;
  const latestProduct = (quotes.length && quotes[0].items && quotes[0].items[0]) ? quotes[0].items[0].desc : '—';
  const remarksList = quotes.filter(q=>q.remarks && q.remarks.trim().length>0).map(q=>q.remarks);
  const remarksHtml = remarksList.length ? `<div class="sp-remarks"><b>Remarks:</b> ${esc(remarksList[0])}${remarksList.length>1?` <span style="opacity:.7">(+${remarksList.length-1} more quote${remarksList.length-1===1?'':'s'} with remarks)</span>`:''}</div>` : '';

  let quotesHtml = quotes.length ? quotes.map(q=>{
    const items = q.items||[];
    const previewItems = items.slice(0,2);
    const moreCount = items.length - previewItems.length;
    const previewHtml = previewItems.map(it=>`
      <div class="item-line"><span>${esc(it.desc||it.size||'')} <span class="q-detail-chip chip-${safeClassToken(it.finish||'')}">${esc(it.finish||'')}</span></span><span style="flex-shrink:0;margin-left:8px">${parseInt(it.qty,10)||0} × RM${parseFloat(it.finalUnitPrice||0).toFixed(2)}</span></div>
    `).join('') + (moreCount>0 ? `<div class="item-more">+${moreCount} more item${moreCount===1?'':'s'}</div>` : '');

    return `
      <div class="q-card">
        <div class="q-top">
          <div>
            <div class="q-no">${esc(q.ref_no||'(No Ref)')}</div>
            <div class="q-dates">Date: ${fmtDate(q.quote_date)}</div>
          </div>
        </div>
        <div class="q-meta">
          ${q.prepared_by?`<span>👤 ${esc(q.prepared_by)}</span>`:''}
          <span>📦 ${items.length} item${items.length===1?'':'s'}</span>
        </div>
        <div class="q-preview">${previewHtml || '<span style="opacity:.6">No items</span>'}</div>
        <div class="ref-total">
          <span class="ref-total-label">Reference Total</span><br>
          <b>${fmtMoneyCP(q.total_amount)}</b>
        </div>
        ${q.remarks ? `<div class="q-remarks">💬 ${esc(q.remarks)}</div>` : ''}
        <div class="quote-actions">
          <button class="btn btn-primary" onclick="viewQuote(${q.id})">👁️ View</button>
          <button class="btn btn-amber" onclick="loadQuoteToCalc(${q.id})">📂 Load</button>
          <button class="btn btn-ghost" onclick="duplicateQuote(${q.id})">📄 Duplicate</button>
          <button class="btn btn-danger" onclick="deleteQuote(${q.id})">🗑️ Delete</button>
        </div>
      </div>`;
  }).join('') : '<div class="empty-state"><div class="icon">📭</div><p>'+dcT('msgNoSavedQuotes')+'</p></div>';

  quotesHtml = quotes.length ? quotes.map(renderCompanyQuoteCard).join('') : '<div class="empty-state"><div class="icon">📭</div><p>'+dcT('msgNoSavedQuotes')+'</p></div>';

  document.getElementById('rightPanel').innerHTML = `
    <div class="card selected-panel" style="margin-bottom:16px">
      <div class="sp-top">
        <div>
          <div class="sp-name">${esc(c.name)}${c.short_code?` <span class="company-code">${esc(c.short_code)}</span>`:''}</div>
          <div class="sp-phone">${c.phone?esc(c.phone):'No phone on file'}</div>
        </div>
        <button class="cp-back-btn" onclick="clearCompanySelection()">← Back to Recent Quotations</button>
      </div>
      <div class="sp-stats">
        <div class="sp-stat"><div class="sp-stat-label">Saved Quotations</div><div class="sp-stat-value">${totalQuotesForCompany}</div></div>
        <div class="sp-stat"><div class="sp-stat-label">Last Updated</div><div class="sp-stat-value">${lastDate?fmtDate(lastDate):'—'}</div></div>
        <div class="sp-stat"><div class="sp-stat-label">Contact</div><div class="sp-stat-value" style="font-size:12.5px">${c.phone?esc(c.phone):'—'}</div></div>
        <div class="sp-stat"><div class="sp-stat-label">Latest Product</div><div class="sp-stat-value" style="font-size:11px;line-height:1.4">${esc(latestProduct)}</div></div>
      </div>
      ${remarksHtml}
    </div>

    <div class="list-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="section-label" style="margin-bottom:0;padding-bottom:0;border-bottom:none"><span class="sl-icon">📋</span>Saved Quotations <span class="sub">报价记录</span></div>
      <span class="list-count">${totalQuotesForCompany}</span>
    </div>
    <div class="q-helper">ℹ️ Grand total is for quotation reference only. Actual order quantity may change.</div>
    <div id="companyQuotesList">${quotesHtml}</div>
    <div id="companyQuotesMoreWrap" style="display:${quotes.length&&companyQuotesHasMore?'block':'none'};text-align:center;margin-top:12px">
      <button class="btn btn-ghost" id="companyQuotesMoreBtn" onclick="loadMoreCompanyQuotations()">Load More Quotations / 加载更多报价</button>
    </div>
    <div id="companyQuotesDone" class="q-helper" style="display:${quotes.length&&!companyQuotesHasMore?'block':'none'};text-align:center;margin-top:12px">No more quotations / 没有更多报价</div>
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
      return `${day} ${months[m-1]} ${y}`;
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
  let rows=items.map(i=>`
    <div class="q-detail-item">
      <span>${esc(i.desc)} <span class="q-detail-chip chip-${safeClassToken(i.finish)}">${esc(i.finish)}</span></span>
      <span>${esc(i.size)}</span>
    </div>
    <div class="q-detail-item" style="background:var(--surface2);padding:4px 8px;border-radius:var(--r-xs);font-size:12px">
      <span style="color:var(--text-muted)">QTY ${parseInt(i.qty,10)||0} × RM ${parseFloat(i.finalUnitPrice||0).toFixed(2)}</span>
      <span style="font-weight:700;color:var(--green)">RM ${parseFloat(i.totalAmount||0).toFixed(2)}</span>
    </div>
  `).join('');
  document.getElementById('viewModalBody').innerHTML=`
    <div style="background:var(--surface2);border-radius:var(--r-sm);padding:12px 14px;margin-bottom:14px;font-size:13px">
      ${q.ref_no?`<div><strong>Ref:</strong> ${esc(q.ref_no)}</div>`:''}
      ${q.customer_name?`<div><strong>Customer:</strong> ${esc(q.customer_name)}</div>`:''}
      ${q.customer_phone?`<div><strong>Phone:</strong> ${esc(q.customer_phone)}</div>`:''}
      ${q.quote_date?`<div><strong>Date:</strong> ${fmtDate(q.quote_date)}</div>`:''}
      ${q.prepared_by?`<div><strong>By:</strong> ${esc(q.prepared_by)}</div>`:''}
      ${q.remarks?`<div><strong>Remarks:</strong> ${esc(q.remarks)}</div>`:''}
    </div>
    <div>${rows}</div>
    <div style="text-align:right;margin-top:12px;font-size:18px;font-weight:800;color:var(--green)">Total: RM ${parseFloat(q.total_amount||0).toFixed(2)}</div>
  `;
  openModal('viewModal');
}

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
  const saveRes=await api('save_quotation',q,'POST');
  if(saveRes.ok){showToast('📄 Duplicated as #'+saveRes.id);await loadAllQuotations();renderSummary();renderCompanyCards();selectCompany(selectedCompanyId);}
  else showToast(dcT('msgFailed'));
}

async function deleteQuote(id){
  if(!confirm('Delete this quotation?'))return;
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
  else if(hits.length===0){ showToast('Quotation '+ref+' not found'); }
  else {
    /* A retired number can match several quotations. If exactly one still carries
       this number as its CURRENT ref, open that one; otherwise fall back to search. */
    const current=hits.filter(h=>!h.matched_previous);
    if(current.length===1){ viewQuote(current[0].id); return; }
    showToast(hits.length+' quotations match '+ref+' — use search'); document.getElementById('searchInput').value=ref; renderCompanyCards();
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  loadCompanies();
  openByRefFromUrl();
});
/* ── Mobile tab switching ── */
function switchMobTab(tab){
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
</script>
</body>
</html>
