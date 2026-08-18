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
  /* Moved once, when UI POLISH 1 was accepted. e3d659b is the last commit
     that changed an application file; 7f5bc97 was the accepted commit before
     it and is recorded as superseded in CANONICAL-STATE. */
  APP_SHA:  'e3d659bba1636cd4cfc74cb89be1b52cf92aff67',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 37,
  BROWSER: 3613,
  TOTAL: 3958,
  FAILED: 0,
  SKIPPED: 0,

  /* Where this started, and how far it moved. Stated as three numbers whose
     arithmetic the checker verifies — BASELINE + DELTA must equal TOTAL — so
     a delta cannot drift away from the totals it sits between. The older
     per-round breakdowns are gone: they mixed absolutes with increments and
     stopped reconciling to anything. */
  BASELINE: 2810,
  DELTA: 1148,
  SIDE: { 'pricing-history-php.log': 161, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15 },

  KEYS: 862, COVERAGE: 100,
  P0: 0, P1: 13, P2: 24, P3: 2, FINDINGS: 39,
};
