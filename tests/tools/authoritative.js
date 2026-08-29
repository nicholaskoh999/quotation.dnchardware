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
  /* Moved twelve times. 631cb89 is the last commit that changes an
     application file and carries SNAPSHOT REVISION WRITER - every successful
     save_quotation and update_quotation now writes exactly ONE immutable
     snapshot of what was actually persisted, inside the transaction that
     persisted it, so a quotation and its history commit together or not at
     all. api.php is the only application file it touches.

     It also fixed a defect it did not create, because the round's acceptance
     gate covered it. The one-and-only-one 1062 retry accepted at 86cf262
     became unreachable when 1ca6554 wrapped save_quotation in a transaction:
     under REPEATABLE READ the reallocating SELECT read the transaction's
     original snapshot and returned the same number the INSERT had just been
     refused for. The create transaction now opens at READ COMMITTED, so the
     retry can see what it collided with. Maximum retry is still one and still
     only 1062.

     1ca6554 carried READ-BEFORE-WRITE / TRANSACTION FOUNDATION, 649f80a ITEM
     IDENTITY FOUNDATION, e76bb85 ACTOR IDENTITY FOUNDATION,
     97a14cf the PHP 8.1+ mysqli compatibility fix, 86cf262 the 1062 retry,
     6bb5772 QUICK ADD STABILITY, cf92f27 UI POLISH 2A, 3e89713 STAGE 1,
     98a31e3 STAGE 0B, 33ae0da UI POLISH 2, e3d659b UI POLISH 1, 7f5bc97 came
     before that; all twelve are recorded as superseded in CANONICAL-STATE and
     must not be quoted as current.

     The BROWSER matrix did NOT move with this one - 40 suites and 3,936
     assertions, re-run because application code changed and returning the same
     figures and the same eight recorded environment failures. It could not
     have moved: the harness intercepts every api.php request, so the matrix
     never executes the one file this round changed.
     tests/php/revision_writer.test.php is a TENTH side group of 101, measured
     on MySQL 8.0.46 and 8.4.3, and transaction foundation moved 85 -> 92
     because its fixture was completed and its two "no writer exists" guards
     became the writer contract.

     TWO SHAs, AND THEY ARE STILL APART. APP_SHA is what has been ACCEPTED;
     DEPLOYED_SHA is what production actually runs, which is still 649f80a, the
     Item Identity build. Neither the transaction foundation nor the revision
     writer has been deployed - and the writer cannot be, in either order:
     migrations/2026-08-28-create-quotation-revisions.sql must be APPLIED to
     production FIRST, because with the table absent a save fails and rolls
     back, deliberately. */
  APP_SHA:  '631cb8945406a934b351e476ec71330ed23a2d27',
  DEPLOYED_SHA: '649f80a09f83a7201c0f3772e01fc270ccda3e05',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 40,
  BROWSER: 3936,
  TOTAL: 4930,
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
  DELTA: 2120,
  SIDE: { 'pricing-history-php.log': 172, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15,
          'save-retry-php.log': 42, 'mysqli-compat-php.log': 94,
          'auth-identity-php.log': 150, 'item-identity-php.log': 159,
          'transaction-foundation-php.log': 92,
          'revision-writer-php.log': 101 },

  /* The Revision Storage round's own figure, kept OUT of TOTAL on purpose.
     TOTAL describes the application measured at APP_SHA; a suite that measures
     a migration is not an application assertion, and folding it in would make
     TOTAL mean two things at once — the same reason check-control's own tests
     are not in it. Recorded here so it cannot drift unnoticed either.

     writerStarted is now TRUE and the figure still stays out, which is not a
     contradiction: the WRITER's own suite measures api.php and is in SIDE
     above, at 101. This one still measures a migration. The storage suite was
     maintained by the writer round — its "nothing writes to this table"
     guard became the writer contract — and did not move from 198. */
  REVISION_STORAGE: { assertions: 198, failed: 0,
                      engines: ['8.0.46', '8.4.3'],
                      migrationApplied: false, writerStarted: true },

  KEYS: 862, COVERAGE: 100,
  P0: 0, P1: 13, P2: 24, P3: 2, FINDINGS: 39,
};
