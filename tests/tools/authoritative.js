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
  /* Moved thirteen times. 5729ad5 is the last commit that changes an
     application file and carries NO-OP SUPPRESSION - an UPDATE that changes
     nothing now records nothing. The persisted BEFORE state, which is the row
     the transaction already holds FOR UPDATE, is compared against the persisted
     AFTER state read back once the UPDATE has run, and the accepted writer is
     called only if they differ. api.php is the only application file it
     touches, and dc_write_revision itself is BYTE-IDENTICAL - it is now called
     conditionally rather than unconditionally.

     THE COMPARISON SURFACE IS NOT A JUDGEMENT CALL: it is the nine columns of
     the UPDATE's own SET list. ref_no is not in it, id and created_at are never
     written, and there is no updated_at in this schema, so there is no
     save-only metadata to filter out. Items compare through item_uid with ORDER
     part of the comparison, because a reorder is the order printed on the
     quotation and therefore a change - though not a removal plus an addition.

     THE PERSISTED DIFF ENGINE WAS DEFERRED, on a fact rather than a preference:
     the accepted revision schema has no field for a diff and three authorities
     refuse a twelfth column. Nothing about the comparison is stored -
     snapshot_schema_version is still 1.

     631cb89 carried SNAPSHOT REVISION WRITER, 1ca6554 READ-BEFORE-WRITE /
     TRANSACTION FOUNDATION, 649f80a ITEM IDENTITY FOUNDATION, e76bb85 ACTOR
     IDENTITY FOUNDATION, 97a14cf the PHP 8.1+ mysqli compatibility fix,
     86cf262 the 1062 retry, 6bb5772 QUICK ADD STABILITY, cf92f27 UI POLISH 2A,
     3e89713 STAGE 1, 98a31e3 STAGE 0B, 33ae0da UI POLISH 2, e3d659b UI POLISH
     1, 7f5bc97 came before that; all thirteen are recorded as superseded in
     CANONICAL-STATE and must not be quoted as current.

     The BROWSER matrix did NOT move - 40 suites and 3,936 assertions, re-run
     twice because application code changed, returning the same figures and the
     same eight recorded environment failures. It could not have moved: the
     harness intercepts every api.php request, so the matrix never executes the
     one file this round changed. tests/php/noop_suppression.test.php is an
     ELEVENTH side group of 171, measured on MySQL 8.0.46 - the production
     engine - and again on 8.4.3. No accepted suite needed maintenance.

     TWO SHAs, AND THEY ARE STILL APART. APP_SHA is what has been ACCEPTED;
     DEPLOYED_SHA is what production actually runs, which is still 649f80a, the
     Item Identity build. Three accepted rounds now sit undeployed, and the
     revision writer among them cannot be deployed at all until
     migrations/2026-08-28-create-quotation-revisions.sql is APPLIED to
     production FIRST. */
  APP_SHA:  '5729ad5001694bc62370472277dc9e5860276408',
  DEPLOYED_SHA: '649f80a09f83a7201c0f3772e01fc270ccda3e05',
  BASELINE_SHA: 'f96714e33795e80b581b1d03deb9d04db1d94b8d',

  SUITES: 40,
  BROWSER: 3936,
  TOTAL: 5101,
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
  DELTA: 2291,
  SIDE: { 'pricing-history-php.log': 172, 'ai-extract-php.log': 107,
          'pricing-workbook.log': 62, 'translation-coverage.log': 15,
          'save-retry-php.log': 42, 'mysqli-compat-php.log': 94,
          'auth-identity-php.log': 150, 'item-identity-php.log': 159,
          'transaction-foundation-php.log': 92,
          'revision-writer-php.log': 101,
          'noop-suppression-php.log': 171 },

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
