<?php
/**
 * Signs out ONLY this browser. Other staff and other devices signed in with
 * the same shared account keep their sessions — dc_logout() destroys just the
 * session belonging to this request's cookie.
 *
 * POST with this session's CSRF token only (docs/audit/2026-10-20-csrf-design.md
 * §4): the Sign Out links in index.php and companies.php post it for the user
 * in one click. A plain GET — an old tab, a bookmark, or a link from another
 * site — signs nobody out; it shows one Sign Out button that posts the token.
 */
require_once __DIR__ . '/auth.php';

if (!dc_is_logged_in()) {
    header('Location: login.php?out=1', true, 302);
    exit;
}
if (dc_csrf_refusal($_POST['csrf'] ?? null, false) === null) {
    dc_logout();
    header('Location: login.php?out=1', true, 302);
    exit;
}
header('Cache-Control: no-store, private');
$token = htmlspecialchars(dc_csrf_token(), ENT_QUOTES, 'UTF-8');
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign out — DNC QUOTATION</title>
<link rel="icon" href="assets/icons/favicon.ico" sizes="any">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f6f8;color:#1f2933}
  form{background:#fff;border:1px solid #d9dee3;border-radius:12px;padding:28px 32px;text-align:center;max-width:320px}
  p{margin:0 0 18px}
  button{font:inherit;padding:10px 22px;border-radius:8px;border:0;background:#1f2933;color:#fff;cursor:pointer}
  a{display:block;margin-top:14px;color:#52606d}
</style>
</head>
<body>
<form method="post" action="logout.php">
  <p>Sign out of Quotation on this device? / 在此设备登出报价系统？</p>
  <input type="hidden" name="csrf" value="<?= $token ?>">
  <button type="submit">Sign out / 登出</button>
  <a href="index.php">Cancel / 取消</a>
</form>
</body>
</html>
