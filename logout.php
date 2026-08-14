<?php
/**
 * Signs out ONLY this browser. Other staff and other devices signed in with
 * the same shared account keep their sessions — dc_logout() destroys just the
 * session belonging to this request's cookie.
 */
require_once __DIR__ . '/auth.php';
dc_logout();
header('Location: login.php?out=1', true, 302);
exit;
