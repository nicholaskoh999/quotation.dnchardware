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
  /* Moved eight times. 97a14cf is the last commit that changes an application
     file and carries PHP 8.1+ MYSQLI EXCEPTION COMPATIBILITY — api.php calls
     mysqli_report(MYSQLI_REPORT_OFF) before db.php is required, so the
     return-value-and-errno contract every helper is written against survives
     PHP 8.1 and later, and the 1062 retry still runs; the three default CSV
     $escape arguments are now stated. api.php is the only application file it
     touches. The BROWSER matrix did not move with it, but the new PHP suite
     tests/php/mysqli_compat.test.php adds 94, so TOTAL and DELTA did. 86cf262
     carried the 1062 retry, 6bb5772 QUICK ADD STABILITY, cf92f27 UI POLISH 2A,
     3e89713 STAGE 1, 98a31e3 STAGE 0B, 33ae0da UI POLISH 2, e3d659b UI POLISH
     1, 7f5bc97 came before that; all eight are recorded as superseded in
     CANONICAL-STATE and must not be quoted as current. */
  APP_SHA:  '97a14cf56bad6414e382c6f49f40d13eabd97dc9',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 39,
  BROWSER: 3907,
  TOTAL: 4399,
  FAILED: 0,
  SKIPPED: 0,

  /* Where this started, and how far it moved. Stated as three numbers whose
     arithmetic the checker verifies — BASELINE + DELTA must equal TOTAL — so
     a delta cannot drift away from the totals it sits between. The older
     per-round breakdowns are gone: they mixed absolutes with increments and
     stopped reconciling to anything. */
  BASELINE: 2810,
  DELTA: 1589,
  SIDE: { 'pricing-history-php.log': 172, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15,
          'save-retry-php.log': 42, 'mysqli-compat-php.log': 94 },

  KEYS: 862, COVERAGE: 100,
  P0: 0, P1: 13, P2: 24, P3: 2, FINDINGS: 39,
};
