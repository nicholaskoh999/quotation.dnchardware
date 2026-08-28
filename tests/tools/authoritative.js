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
  /* Moved eleven times. 1ca6554 is the last commit that changes an
     application file and carries READ-BEFORE-WRITE / TRANSACTION FOUNDATION —
     save_quotation and update_quotation are each one transaction, and the
     persisted read that update reconciles against now happens INSIDE that
     transaction, holding the row FOR UPDATE. api.php is the only application
     file it touches. 649f80a carried ITEM IDENTITY FOUNDATION, e76bb85 ACTOR
     IDENTITY FOUNDATION,
     97a14cf the PHP 8.1+ mysqli compatibility fix, 86cf262 the 1062 retry,
     6bb5772 QUICK ADD STABILITY, cf92f27 UI POLISH 2A, 3e89713 STAGE 1,
     98a31e3 STAGE 0B, 33ae0da UI POLISH 2, e3d659b UI POLISH 1, 7f5bc97 came
     before that; all eleven are recorded as superseded in CANONICAL-STATE and
     must not be quoted as current.

     The BROWSER matrix did NOT move with this one — 40 suites and 3,936
     assertions, re-run because application code changed and returning the same
     figures and the same eight recorded environment failures.
     tests/php/transaction_foundation.test.php is a ninth side group of 85, and
     item identity moved 156 -> 159 because one assertion that measured a
     superseded contract became four stricter ones.

     TWO SHAs, AND THEY HAVE SEPARATED AGAIN. APP_SHA is what has been
     ACCEPTED; DEPLOYED_SHA is what production actually runs. They were equal
     for exactly one round after the 2026-08-28 rollout, and accepting
     1ca6554 parted them: production still runs 649f80a, the Item Identity
     build. The transaction foundation is accepted in source and NOT deployed.
     This is the ordinary state, not the exception. */
  APP_SHA:  '1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a',
  DEPLOYED_SHA: '649f80a09f83a7201c0f3772e01fc270ccda3e05',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 40,
  BROWSER: 3936,
  TOTAL: 4822,
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
  DELTA: 2012,
  SIDE: { 'pricing-history-php.log': 172, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15,
          'save-retry-php.log': 42, 'mysqli-compat-php.log': 94,
          'auth-identity-php.log': 150, 'item-identity-php.log': 159,
          'transaction-foundation-php.log': 85 },

  /* The Revision Storage round's own figure, kept OUT of TOTAL on purpose.
     TOTAL describes the application measured at APP_SHA; a suite that measures
     a migration is not an application assertion, and folding it in would make
     TOTAL mean two things at once — the same reason check-control's own tests
     are not in it. Recorded here so it cannot drift unnoticed either. */
  REVISION_STORAGE: { assertions: 198, failed: 0,
                      engines: ['8.0.46', '8.4.3'],
                      migrationApplied: false, writerStarted: false },

  KEYS: 862, COVERAGE: 100,
  P0: 0, P1: 13, P2: 24, P3: 2, FINDINGS: 39,
};
