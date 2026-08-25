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
  /* Moved seven times. 86cf262 is the last commit that changes an application
     file and carries API 1062 DUPLICATE RETRY HARDENING — a duplicate ref_no
     is now re-allocated once and retried instead of failing the whole save,
     and only errno 1062 is caught. api.php is the only application file it
     touches. The BROWSER matrix did not move with it, but the new PHP suite
     tests/php/save_retry.test.php adds 42, so TOTAL and DELTA did. 6bb5772
     carried QUICK ADD STABILITY, cf92f27 UI POLISH 2A, 3e89713 STAGE 1,
     98a31e3 STAGE 0B, 33ae0da UI POLISH 2, e3d659b UI POLISH 1, 7f5bc97 came
     before that; all seven are recorded as superseded in CANONICAL-STATE and
     must not be quoted as current. */
  APP_SHA:  '86cf2629a66434bf3bdffe2efc0acbe527c358ac',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 39,
  BROWSER: 3907,
  TOTAL: 4305,
  FAILED: 0,
  SKIPPED: 0,

  /* Where this started, and how far it moved. Stated as three numbers whose
     arithmetic the checker verifies — BASELINE + DELTA must equal TOTAL — so
     a delta cannot drift away from the totals it sits between. The older
     per-round breakdowns are gone: they mixed absolutes with increments and
     stopped reconciling to anything. */
  BASELINE: 2810,
  DELTA: 1495,
  SIDE: { 'pricing-history-php.log': 172, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15,
          'save-retry-php.log': 42 },

  KEYS: 862, COVERAGE: 100,
  P0: 0, P1: 13, P2: 24, P3: 2, FINDINGS: 39,
};
