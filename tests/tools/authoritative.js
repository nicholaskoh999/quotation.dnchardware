/* ── The authoritative values for the closed round ──────────────────────────
   One file, required by both the consistency checker and the package builder,
   so a figure cannot be right in one and wrong in the other.

   PINNED, not derived. Earlier versions of the checker worked out what to
   expect from the same documents they were checking, which meant a number
   that was wrong everywhere agreed with itself and passed. These constants
   come from the round that was accepted and are changed deliberately, when a
   round closes — never to make a check go green.

   APP_SHA is the commit the accepted implementation and its test matrix were
   measured at. Deriving it from `git log` instead was what let it drift three
   times in one round: every commit that touched tests/ moved it out from
   under the reports that had just named it.                                */
'use strict';

module.exports = {
  /* Moved nine times. e76bb85 is the last commit that changes an application
     file and carries ACTOR IDENTITY FOUNDATION — authentication is DB-backed
     per individual person, dc_login() takes an injected handle so auth.php
     keeps its zero-DB property, and a successful session carries dc_user_id,
     dc_username, dc_display_name and dc_login_time. auth.php and login.php
     are the only application files it touches. The BROWSER matrix did not
     move with it, but the new PHP suite tests/php/auth_identity.test.php adds
     150, so TOTAL and DELTA did. 97a14cf carried the PHP 8.1+ mysqli
     compatibility fix, 86cf262 the 1062 retry, 6bb5772 QUICK ADD STABILITY,
     cf92f27 UI POLISH 2A, 3e89713 STAGE 1, 98a31e3 STAGE 0B, 33ae0da UI
     POLISH 2, e3d659b UI POLISH 1, 7f5bc97 came before that; all nine are
     recorded as superseded in CANONICAL-STATE and must not be quoted as
     current.

     ACCEPTED IN SOURCE IS NOT DEPLOYED. e76bb85 is the accepted application;
     production still runs the previous build, migrations/
     2026-08-26-create-app-users.sql is NOT APPLIED and no production user has
     been seeded. */
  APP_SHA:  'e76bb85d663f96fdce3ed6c0c70b72c49d84000a',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 39,
  BROWSER: 3907,
  TOTAL: 4549,
  FAILED: 0,
  SKIPPED: 0,

  /* Where this started, and how far it moved. Stated as three numbers whose
     arithmetic the checker verifies — BASELINE + DELTA must equal TOTAL — so
     a delta cannot drift away from the totals it sits between. The older
     per-round breakdowns are gone: they mixed absolutes with increments and
     stopped reconciling to anything. */
  BASELINE: 2810,
  DELTA: 1739,
  SIDE: { 'pricing-history-php.log': 172, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15,
          'save-retry-php.log': 42, 'mysqli-compat-php.log': 94,
          'auth-identity-php.log': 150 },

  KEYS: 862, COVERAGE: 100,
  P0: 0, P1: 13, P2: 24, P3: 2, FINDINGS: 39,
};
