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
  /* Moved three times. 98a31e3 is the last commit that changed an application
     file and carries STAGE 0B — the first of the three that changes BEHAVIOUR
     rather than presentation: accessories now belong to the parent item's final
     customer price. 33ae0da carried UI POLISH 2, e3d659b UI POLISH 1, 7f5bc97
     came before that; all three are recorded as superseded in CANONICAL-STATE
     and must not be quoted as current. */
  APP_SHA:  '98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 37,
  BROWSER: 3714,
  TOTAL: 4070,
  FAILED: 0,
  SKIPPED: 0,

  /* Where this started, and how far it moved. Stated as three numbers whose
     arithmetic the checker verifies — BASELINE + DELTA must equal TOTAL — so
     a delta cannot drift away from the totals it sits between. The older
     per-round breakdowns are gone: they mixed absolutes with increments and
     stopped reconciling to anything. */
  BASELINE: 2810,
  DELTA: 1260,
  SIDE: { 'pricing-history-php.log': 172, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15 },

  KEYS: 862, COVERAGE: 100,
  P0: 0, P1: 13, P2: 24, P3: 2, FINDINGS: 39,
};
