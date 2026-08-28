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
  /* Moved ten times. 649f80a is the last commit that changes an application
     file and carries ITEM IDENTITY FOUNDATION — every persisted quotation item
     holds a server-minted item_uid inside the existing items JSON, and
     update_quotation reconciles against what is STORED rather than against
     array position. api.php, index.php and the CLI backfill migration are the
     application files it touches. e76bb85 carried ACTOR IDENTITY FOUNDATION,
     97a14cf the PHP 8.1+ mysqli compatibility fix, 86cf262 the 1062 retry,
     6bb5772 QUICK ADD STABILITY, cf92f27 UI POLISH 2A, 3e89713 STAGE 1,
     98a31e3 STAGE 0B, 33ae0da UI POLISH 2, e3d659b UI POLISH 1, 7f5bc97 came
     before that; all ten are recorded as superseded in CANONICAL-STATE and
     must not be quoted as current.

     The BROWSER matrix moved with this one, for the first time in five rounds:
     tests/suites/40-item-identity.test.js is a fortieth suite of 29, and
     tests/php/item_identity.test.php is an eighth side group of 156.

     TWO SHAs, AND THEY ARE STILL TWO FIELDS EVEN WHEN THEY AGREE. APP_SHA is
     what has been ACCEPTED; DEPLOYED_SHA is what production actually runs.
     They are equal as of the 2026-08-28 rollout — backfill applied, 18/18
     deployed paths matching, smoke passed — and they were NOT equal the day
     before. Do not collapse them into one constant because they happen to
     agree today; the next accepted commit separates them again until it
     ships. */
  APP_SHA:  '649f80a09f83a7201c0f3772e01fc270ccda3e05',
  DEPLOYED_SHA: '649f80a09f83a7201c0f3772e01fc270ccda3e05',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 40,
  BROWSER: 3936,
  TOTAL: 4734,
  /* NOT zero, and not to be quietly restored to zero. Eight assertions in
     38-mobile-ui fail on the runtime this matrix was re-measured on. They are
     font metrics on the companies.php modal close control, not an application
     fault: companies.php is untouched by this round and a pristine worktree at
     ce26146 fails the same eight with the same numbers. CANONICAL-STATE
     records the whole exception under tests.browserFailureException. Relaxing
     those assertions to make this read 0 would delete a protected accepted
     dimension to tidy a number. */
  FAILED: 8,
  SKIPPED: 0,

  /* Where this started, and how far it moved. Stated as three numbers whose
     arithmetic the checker verifies — BASELINE + DELTA must equal TOTAL — so
     a delta cannot drift away from the totals it sits between. The older
     per-round breakdowns are gone: they mixed absolutes with increments and
     stopped reconciling to anything. */
  BASELINE: 2810,
  DELTA: 1924,
  SIDE: { 'pricing-history-php.log': 172, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15,
          'save-retry-php.log': 42, 'mysqli-compat-php.log': 94,
          'auth-identity-php.log': 150, 'item-identity-php.log': 156 },

  KEYS: 862, COVERAGE: 100,
  P0: 0, P1: 13, P2: 24, P3: 2, FINDINGS: 39,
};
