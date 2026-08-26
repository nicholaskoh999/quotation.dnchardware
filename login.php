<?php
require_once __DIR__ . '/auth.php';
dc_session_start();

$next  = dc_safe_next($_GET['next'] ?? ($_POST['next'] ?? '/index.php'));
$error = '';
$errorCode = '';

// Already signed in? Go straight through.
if (dc_is_logged_in() && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    header('Location: ' . $next, true, 302);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $u = trim((string)($_POST['username'] ?? ''));
    $p = (string)($_POST['password'] ?? '');
    if ($u === '' || $p === '') {
        $error = 'Please enter both username and password.';
        $errorCode = 'errLoginMissing';
    } elseif (dc_login(dc_login_db(), $u, $p)) {
        header('Location: ' . $next, true, 302);
        exit;
    } else {
        $error = 'Wrong username or password.';
        $errorCode = 'errLoginBad';
    }
}

$justLoggedOut = isset($_GET['out']);

/**
 * The database handle, opened ONLY to check a password, and only on a POST.
 *
 * Loaded lazily inside this function rather than at the top of the file so a
 * plain GET of the sign-in page — which is most of its traffic, including the
 * redirect when someone is already signed in — still opens no connection.
 *
 * mysqli_report(MYSQLI_REPORT_OFF) runs BEFORE db.php is required, exactly as
 * api.php does it. getDB() checks $conn->connect_error and dc_login() checks
 * return values; under the PHP 8.1+ default those would throw first and both
 * checks would be dead code, turning a database hiccup into an uncaught
 * mysqli_sql_exception on the sign-in page.
 *
 * Returns null when the database cannot be reached, and dc_login() fails closed
 * on null. Authentication never succeeds because a lookup could not be made.
 */
function dc_login_db() {
    static $db = null;
    if ($db !== null) return $db;
    mysqli_report(MYSQLI_REPORT_OFF);
    $path = __DIR__ . '/db.php';
    if (!is_file($path)) return null;
    require_once $path;
    if (!function_exists('getDB')) return null;
    $db = getDB();
    return $db;
}
?><!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
/* Same dc_lang key as index.php / companies.php, read before first paint. */
(function(){try{
  var l=localStorage.getItem('dc_lang'); if(l!=='zh'&&l!=='en') l='en';
  var r=document.documentElement;
  r.setAttribute('data-lang',l);
  r.setAttribute('lang', l==='zh' ? 'zh-Hans' : 'en');
}catch(e){}})();
</script>
<title>Sign In · Der-Cheng Quotation</title>
<link rel="icon" href="/assets/icons/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
<meta name="theme-color" content="#ffffff">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex,nofollow">
<style>
  /* Login page is intentionally light-only — it must not follow the device's
     dark mode. color-scheme:light also keeps form controls light on iOS/macOS. */
  :root{
    color-scheme: light;
    /* v2.24.1: the card stays white, the ground behind it does not. */
    --page:#e8ecf3;
    --card:#ffffff;
    --border:#d9dfe9;
    --border-strong:#d5d9e0;
    --text:#111827;
    --muted:#6b7280;
    --field:#f3f5f8;
    --brand:#5b7af5;
    --brand-dark:#4a67e8;
    --red:#b91c1c;
    --red-bg:#fef2f2;
    --red-border:#fecaca;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{
    min-height:100vh;
    min-height:100dvh;
    background:var(--page);
    color:var(--text);
    font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
    display:flex;
    align-items:center;
    justify-content:center;
    /* No horizontal padding here — the 16px side margins come from
       .wrap's calc(100% - 32px), so the two never compound. */
    padding:32px 0;
    -webkit-font-smoothing:antialiased;
    -moz-osx-font-smoothing:grayscale;
  }

  /* ── Card ────────────────────────────────────────────────────────────── */
  .wrap{
    width:calc(100% - 32px);        /* mobile: exactly 16px each side */
    max-width:380px;                /* desktop / tablet */
    margin-left:auto;
    margin-right:auto;
  }
  .brand{
    display:flex;align-items:center;justify-content:center;gap:11px;
    margin-bottom:20px;
  }
  .logo{
    width:42px;height:42px;flex:0 0 auto;border-radius:12px;
    background:linear-gradient(140deg,var(--brand),#8b6ef5);
    color:#fff;font-weight:800;font-size:16px;letter-spacing:.4px;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 6px rgba(91,122,245,.28);
  }
  .brand-txt strong{display:block;font-size:16px;font-weight:800;line-height:1.3;letter-spacing:-.01em}
  .brand-txt span{display:block;font-size:12px;color:var(--muted);font-weight:600;line-height:1.35}

  .card{
    background:var(--card);
    border:1px solid var(--border);
    border-radius:14px;
    padding:26px 24px;
    /* very soft, two-layer shadow */
    box-shadow:0 1px 2px rgba(16,24,40,.04), 0 10px 28px -6px rgba(16,24,40,.08);
  }
  h1{font-size:19px;font-weight:800;line-height:1.3;letter-spacing:-.01em}
  h1 .zh{font-weight:600;color:var(--muted);font-size:15px}
  .sub{font-size:13px;color:var(--muted);margin:5px 0 20px;line-height:1.45}

  /* ── Fields ──────────────────────────────────────────────────────────── */
  .field{margin-bottom:14px}
  label{
    display:block;font-size:11px;font-weight:700;letter-spacing:.06em;
    text-transform:uppercase;color:var(--muted);margin-bottom:6px;
  }
  label .zh{text-transform:none;letter-spacing:0;font-weight:600}
  input[type=text],input[type=password]{
    width:100%;
    height:48px;                    /* >= 46-48px touch target */
    padding:0 14px;
    font-size:16px;                 /* 16px stops iOS zooming on focus */
    font-family:inherit;
    color:var(--text);
    background:var(--field);
    border:1.5px solid var(--border);
    border-radius:10px;
    outline:none;
    transition:border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
  }
  input::placeholder{color:#9ca3af}
  .lang-switch{display:inline-flex;margin:14px auto 0;border:1.5px solid var(--line,#d8dee9);
    border-radius:999px;overflow:hidden}
  .lang-btn{background:#fff;border:0;color:var(--muted,#6b7280);font-family:inherit;font-size:12.5px;
    font-weight:700;padding:9px 16px;min-height:44px;cursor:pointer;line-height:1}
  .lang-btn+.lang-btn{border-left:1.5px solid var(--line,#d8dee9)}
  .lang-btn.is-on{background:var(--brand,#1d4ed8);color:#fff}
  .lang-btn:focus-visible{outline:2px solid var(--brand,#1d4ed8);outline-offset:2px}
  input:hover{border-color:var(--border-strong)}
  input:focus{
    background:#fff;
    border-color:var(--brand);
    box-shadow:0 0 0 3px rgba(91,122,245,.15);
  }

  .row{display:flex;align-items:center;gap:9px;margin:2px 0 18px}
  .row input[type=checkbox]{
    width:17px;height:17px;flex:0 0 auto;accent-color:var(--brand);cursor:pointer;
  }
  .row label{
    margin:0;font-size:13px;font-weight:600;color:var(--text);
    text-transform:none;letter-spacing:0;cursor:pointer;user-select:none;
  }

  button[type=submit]{
    display:block;width:100%;                /* full width on every size */
    height:48px;
    font-size:15px;font-weight:700;font-family:inherit;
    color:#fff;
    background:linear-gradient(140deg,var(--brand),var(--brand-dark));
    border:0;border-radius:10px;cursor:pointer;
    box-shadow:0 1px 2px rgba(16,24,40,.05);
    transition:filter .15s ease, transform .05s ease;
  }
  button[type=submit]:hover{filter:brightness(1.05)}
  button[type=submit]:active{transform:translateY(1px)}
  button[type=submit]:focus-visible{outline:3px solid rgba(91,122,245,.4);outline-offset:2px}

  /* ── Messages ────────────────────────────────────────────────────────── */
  .msg{
    display:flex;gap:9px;align-items:flex-start;
    font-size:13px;font-weight:600;line-height:1.45;
    padding:11px 13px;border-radius:10px;margin-bottom:16px;
  }
  .msg span:first-child{flex:0 0 auto;line-height:1.3}
  .msg.err{background:var(--red-bg);color:var(--red);border:1px solid var(--red-border)}
  .msg.ok{background:#f0f4ff;color:var(--brand-dark);border:1px solid #d5deff}

  .foot{
    text-align:center;font-size:11.5px;color:var(--muted);
    margin-top:15px;line-height:1.55;
  }

  /* ── Responsive ──────────────────────────────────────────────────────── */
  /* Small phones (<=430px): keep everything compact, full-width button */
  @media (max-width:430px){
    body{padding:24px 0}
    /* On phones the calc governs, so the side margins stay exactly 16px
       (358px wide at 390, 398px at 430) instead of being capped to 380. */
    .wrap{max-width:none}
    .card{padding:22px 18px;border-radius:13px}
    .brand{margin-bottom:17px;gap:10px}
    .logo{width:38px;height:38px;border-radius:11px;font-size:15px}
    .brand-txt strong{font-size:15px}
    .brand-txt span{font-size:11.5px}
    h1{font-size:17.5px}
    h1 .zh{font-size:14px}
    .sub{font-size:12.5px;margin-bottom:18px}
  }
  /* Very short screens — don't force vertical centring */
  @media (max-height:600px){
    body{align-items:flex-start;padding-top:24px;padding-bottom:24px}
  }
  /* Tablet and up: a touch more breathing room */
  @media (min-width:768px){
    .wrap{max-width:390px}
    .card{padding:30px 28px}
  }
  /* Large desktop */
  @media (min-width:1280px){
    .wrap{max-width:400px}
  }
  @media (prefers-reduced-motion:reduce){
    *{transition:none !important}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <div class="logo">DC</div>
    <div class="brand-txt">
      <strong>Der-Cheng Quotation</strong>
      <span data-i18n="brandSub">Quotation System</span>
    </div>
  </div>

  <div class="card">
    <h1 data-i18n="signIn">Sign In</h1>
    <p class="sub" data-i18n="signInSub">Sign in with your own account to continue.</p>

    <?php if ($error !== ''): ?>
      <div class="msg err" role="alert"><span>⚠️</span><span data-i18n="<?= htmlspecialchars($errorCode, ENT_QUOTES, 'UTF-8') ?>"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></span></div>
    <?php elseif ($justLoggedOut): ?>
      <div class="msg ok" role="status"><span>✓</span><span data-i18n="signedOut">You have been signed out on this device.</span></div>
    <?php endif; ?>

    <form method="post" action="login.php" autocomplete="on">
      <input type="hidden" name="next" value="<?= htmlspecialchars($next, ENT_QUOTES, 'UTF-8') ?>">
      <div class="field">
        <label for="username" data-i18n="lblUsername">Username</label>
        <input type="text" id="username" name="username" autocomplete="username"
               autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus>
      </div>
      <div class="field">
        <label for="password" data-i18n="lblPassword">Password</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required>
      </div>
      <div class="row">
        <input type="checkbox" id="showpw" onclick="document.getElementById('password').type=this.checked?'text':'password'">
        <label for="showpw" data-i18n="showPassword">Show password</label>
      </div>
      <button type="submit" data-i18n="signIn">Sign In</button>
    </form>

    <p class="foot" data-i18n="stays7Days">Stays signed in for about 7 days on this device.</p>
  </div>
  <div class="lang-switch" role="group" data-i18n-aria="langAria" aria-label="Language">
    <button type="button" class="lang-btn" data-lang-set="en" aria-pressed="true"  onclick="dcSetLang('en')">EN</button>
    <button type="button" class="lang-btn" data-lang-set="zh" aria-pressed="false" onclick="dcSetLang('zh')">中文</button>
  </div>
</div>
<script>
/* Same contract and storage key as the other two pages; page-scoped dictionary. */
const DC_LANG_KEY='dc_lang', DC_LANGS=['en','zh'];
const I18N={
  en:{ langAria:'Language',
       brandSub:'Quotation System', signIn:'Sign In',
       signInSub:'Sign in with your own account to continue.',
       signedOut:'You have been signed out on this device.',
       lblUsername:'Username', lblPassword:'Password', showPassword:'Show password',
       stays7Days:'Stays signed in for about 7 days on this device.',
       errLoginMissing:'Please enter both username and password.',
       errLoginBad:'Wrong username or password.' },
  zh:{ langAria:'语言',
       brandSub:'报价系统', signIn:'登录',
       signInSub:'使用您的个人账号登录以继续。',
       signedOut:'已在此设备登出。',
       lblUsername:'用户名', lblPassword:'密码', showPassword:'显示密码',
       stays7Days:'此设备约保持登录 7 天。',
       errLoginMissing:'请输入用户名和密码。',
       errLoginBad:'用户名或密码错误。' },
};
function dcLang(){
  try{ const v=localStorage.getItem(DC_LANG_KEY); if(DC_LANGS.indexOf(v)>=0) return v; }catch(e){}
  return 'en';
}
function dcT(k,fb){
  const l=dcLang();
  const hit=(I18N[l]&&I18N[l][k])!==undefined ? I18N[l][k]
          : (I18N.en&&I18N.en[k])!==undefined ? I18N.en[k] : undefined;
  return hit!==undefined ? hit : (fb!==undefined ? fb : k);
}
function dcApplyLang(){
  const l=dcLang(), r=document.documentElement;
  r.setAttribute('data-lang',l);
  r.setAttribute('lang', l==='zh' ? 'zh-Hans' : 'en');
  /* An empty data-i18n means PHP rendered no error code — leave that node alone
     rather than blanking whatever the server put there. */
  document.querySelectorAll('[data-i18n]').forEach(n=>{
    const k=n.getAttribute('data-i18n'); if(k) n.textContent=dcT(k); });
  document.querySelectorAll('[data-i18n-aria]').forEach(n=>{ n.setAttribute('aria-label',dcT(n.getAttribute('data-i18n-aria'))); });
  document.querySelectorAll('[data-lang-set]').forEach(b=>{
    const on=b.getAttribute('data-lang-set')===l;
    b.classList.toggle('is-on',on);
    b.setAttribute('aria-pressed',on?'true':'false');
  });
}
function dcSetLang(l){
  if(DC_LANGS.indexOf(l)<0) return;
  try{ localStorage.setItem(DC_LANG_KEY,l); }catch(e){}
  dcApplyLang();
}
dcApplyLang();
</script>
</body>
</html>
