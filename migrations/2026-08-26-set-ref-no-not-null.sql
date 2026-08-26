-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — make quotations.ref_no NOT NULL
--
--   Accepted application : 97a14cf56bad6414e382c6f49f40d13eabd97dc9
--   Repository           : e7646c861976f3087f8f08f3dd653e3922fa4dd3
--   Prepared             : 2026-08-26
--   Applied              : NOT APPLIED — no database was reachable when this
--                          was written. Sections 1, 2 and 3 MUST be run and
--                          READ by a person before section 4.
--
-- WHY THIS IS WANTED
--   UNIQUE(ref_no) is already live as uq_quotations_ref, and in MySQL a UNIQUE
--   index permits any number of NULLs. So uniqueness today guarantees "no two
--   quotations share a number" but NOT "every quotation has a number". NOT NULL
--   is the half that says a quotation cannot exist without a reference.
--
-- WHAT THE SOURCE SAYS (verified at 97a14cf, not assumed)
--   Exactly ONE statement in the entire repository inserts into quotations:
--   the INSERT in save_quotation (api.php). It names ref_no explicitly in its
--   column list, so it never relies on a column default. The value it sends is
--   decided immediately above it:
--
--       $requested_ref = trim($input['ref_no'] ?? '');
--       if ($requested_ref !== '' && !ref_no_in_use($db, $requested_ref))
--            $ref_no = $requested_ref;          // non-empty by the test itself
--       else $ref_no = next_free_ref_no($db);   // sprintf('Q-%s-%04d', …)
--
--   Neither branch can yield NULL or ''. next_free_ref_no() returns a printf
--   of a 4-digit year and a zero-padded integer >= 1, so its shortest possible
--   result is 11 characters. update_quotation's SET list does not contain
--   ref_no at all — the source carries a comment saying so deliberately — so
--   no update can null it. There is no import path, no admin utility and no
--   legacy handler that writes the table.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   · It does not touch uq_quotations_ref. NOT NULL and UNIQUE are independent
--     and must coexist; nothing here drops, renames or recreates the index.
--   · It does not invent the column definition. See section 4 — the ALTER is
--     GENERATED from information_schema rather than typed from memory, because
--     MySQL's MODIFY replaces the whole definition and anything omitted
--     silently reverts to a default. A hand-typed "VARCHAR(100) NOT NULL"
--     would quietly change the charset or collation of a column nobody read.
--   · It does not clean, backfill or invent data. If section 3 finds anything,
--     STOP and report — do not write placeholder reference numbers.
--   · It does not touch previous_ref_no, which is a different column, is
--     read-only in this codebase, and is explicitly out of scope.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · SCHEMA — READ-ONLY. Run first and READ the output.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT VERSION() AS engine_version, DATABASE() AS db_in_use;

SHOW FULL COLUMNS FROM quotations LIKE 'ref_no';

SHOW CREATE TABLE quotations;

-- The same facts in a form that is easy to compare exactly.
SELECT COLUMN_NAME,
       COLUMN_TYPE,
       DATA_TYPE,
       CHARACTER_MAXIMUM_LENGTH,
       IS_NULLABLE,
       COLUMN_DEFAULT,
       CHARACTER_SET_NAME,
       COLLATION_NAME,
       EXTRA,
       COLUMN_COMMENT,
       GENERATION_EXPRESSION
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotations'
  AND  COLUMN_NAME IN ('ref_no', 'previous_ref_no');

-- EXPECTED, from the previous audit — but VERIFY, do not assume:
--     COLUMN_TYPE   varchar(100)
--     IS_NULLABLE   YES
-- If IS_NULLABLE is already NO, this migration is already applied. STOP.
-- If COLUMN_TYPE is anything other than what section 4 generates from it,
-- section 4 still handles it, because section 4 reads the real value.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · UNIQUE INDEX — READ-ONLY. Prove it exists BEFORE and expect it
--             to be identical AFTER.
-- ═════════════════════════════════════════════════════════════════════════════

SHOW INDEX FROM quotations;

SELECT INDEX_NAME,
       NON_UNIQUE,
       SEQ_IN_INDEX,
       COLUMN_NAME,
       NULLABLE,
       INDEX_TYPE
FROM   information_schema.STATISTICS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotations'
  AND  COLUMN_NAME  = 'ref_no'
ORDER  BY INDEX_NAME, SEQ_IN_INDEX;

-- EXPECTED: a row with INDEX_NAME = 'uq_quotations_ref' and NON_UNIQUE = 0.
-- If it is absent, STOP: the previous hardening round is not in the state this
-- one was written against.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · DATA GATE — READ-ONLY. Every count below MUST be 0.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT COUNT(*) AS total_rows FROM quotations;

SELECT COUNT(*) AS null_ref_no
FROM   quotations
WHERE  ref_no IS NULL;

SELECT COUNT(*) AS blank_ref_no
FROM   quotations
WHERE  ref_no IS NOT NULL
  AND  TRIM(ref_no) = '';

SELECT COUNT(*) AS untrimmed_ref_no
FROM   quotations
WHERE  ref_no IS NOT NULL
  AND  TRIM(ref_no) <> ref_no;

SELECT ref_no, COUNT(*) AS total
FROM   quotations
GROUP  BY ref_no
HAVING COUNT(*) > 1;

-- The offending rows themselves, so a person can look at them rather than at
-- a number. All three of these MUST return the empty set.
SELECT id, ref_no, quote_date, customer_name, created_at
FROM   quotations
WHERE  ref_no IS NULL
    OR TRIM(ref_no) = ''
    OR TRIM(ref_no) <> ref_no
ORDER  BY id
LIMIT  50;

-- ── GATE ─────────────────────────────────────────────────────────────────────
--   null_ref_no       MUST be 0   — NOT NULL cannot be applied otherwise; the
--                                   ALTER would either fail or, in a non-strict
--                                   session, silently rewrite NULLs to ''.
--   blank_ref_no      MUST be 0   — NOT NULL does not forbid '', so a blank
--                                   would survive and defeat the point.
--   untrimmed_ref_no  MUST be 0   — a padded number is a different string to
--                                   UNIQUE and would not be found by lookup.
--   duplicates        MUST be 0   — expected already, re-proven here.
--
--   If ANY of them is non-zero: STOP. Do not run section 4. Do not clean the
--   data from this file. Report the rows and let a person decide.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · THE MIGRATION — generate it from the live column, then run it.
--             DO NOT run this section until sections 1-3 have been read.
-- ═════════════════════════════════════════════════════════════════════════════

-- 4a · GENERATE the exact statement from the column that actually exists.
--      MySQL's MODIFY replaces the ENTIRE definition: any characteristic left
--      out reverts to a default. This builds the statement from COLUMN_TYPE,
--      the real charset and collation, and the real default, so applying it
--      changes NULLability and nothing else. A NOT NULL column cannot keep a
--      DEFAULT NULL, so that one default is dropped by design — it is the only
--      characteristic this migration is allowed to change.
SELECT CONCAT(
         'ALTER TABLE quotations MODIFY ', COLUMN_NAME, ' ', COLUMN_TYPE,
         IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME)),
         IF(COLLATION_NAME     IS NULL, '', CONCAT(' COLLATE ',       COLLATION_NAME)),
         ' NOT NULL',
         IF(COLUMN_DEFAULT IS NULL, '', CONCAT(' DEFAULT ', QUOTE(COLUMN_DEFAULT))),
         IF(COLUMN_COMMENT = '',    '', CONCAT(' COMMENT ', QUOTE(COLUMN_COMMENT))),
         ';'
       ) AS generated_alter_statement
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotations'
  AND  COLUMN_NAME  = 'ref_no';

-- 4b · READ what 4a printed. If production is what the previous audit saw, it
--      will read exactly:
--
--          ALTER TABLE quotations MODIFY ref_no varchar(100)
--            CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;
--
--      …with whatever charset and collation the column truly has. Compare it
--      against SHOW CREATE TABLE from section 1: everything except NULL/NOT
--      NULL must be identical. If it is not, STOP.

-- 4c · Refuse to proceed if the gate moved between reading and running. Run
--      this immediately before the ALTER; it errors rather than migrating if
--      a bad row appeared in the meantime.
SELECT IF(
         (SELECT COUNT(*) FROM quotations
           WHERE ref_no IS NULL OR TRIM(ref_no) = '' OR TRIM(ref_no) <> ref_no) = 0,
         'GATE OPEN - safe to run the generated statement',
         (SELECT CONCAT('GATE CLOSED - ',
                 (SELECT COUNT(*) FROM quotations
                   WHERE ref_no IS NULL OR TRIM(ref_no) = '' OR TRIM(ref_no) <> ref_no),
                 ' bad row(s). DO NOT MIGRATE.') FROM DUAL)
       ) AS gate;

-- 4d · Run the statement 4a generated. It is NOT written out here on purpose:
--      copying a definition into this file would be the guess this migration
--      exists to avoid.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 5 · VERIFY — READ-ONLY. Run after section 4.
-- ═════════════════════════════════════════════════════════════════════════════

SHOW FULL COLUMNS FROM quotations LIKE 'ref_no';
--   EXPECT: Null = NO, and Type / Collation IDENTICAL to section 1.

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
       CHARACTER_SET_NAME, COLLATION_NAME
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotations'
  AND  COLUMN_NAME  = 'ref_no';
--   EXPECT: IS_NULLABLE = 'NO'. COLUMN_TYPE, charset and collation unchanged.

SHOW INDEX FROM quotations;
--   EXPECT: uq_quotations_ref still present, still NON_UNIQUE = 0, same name.
--   NOT NULL and UNIQUE must coexist. If the index is gone or renamed, the
--   generated statement was not the one that ran — roll back (section 6).

SELECT COUNT(*) AS total_rows FROM quotations;
--   EXPECT: identical to section 3. A NULLability change must not lose a row.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 6 · ROLLBACK — prepared, NOT to be run unless section 5 fails.
-- ═════════════════════════════════════════════════════════════════════════════

-- Restoring "NULL allowed" is the same MODIFY with NULL instead of NOT NULL,
-- generated the same way from the live column so it cannot redefine anything
-- else. It touches no data and no index.
SELECT CONCAT(
         'ALTER TABLE quotations MODIFY ', COLUMN_NAME, ' ', COLUMN_TYPE,
         IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME)),
         IF(COLLATION_NAME     IS NULL, '', CONCAT(' COLLATE ',       COLLATION_NAME)),
         ' NULL',
         IF(COLUMN_COMMENT = '', '', CONCAT(' COMMENT ', QUOTE(COLUMN_COMMENT))),
         ';'
       ) AS generated_rollback_statement
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotations'
  AND  COLUMN_NAME  = 'ref_no';

-- Notes on the rollback:
--   · Run it against the POST-migration column, so it carries the same type,
--     charset and collation the migration preserved.
--   · It does not restore a DEFAULT NULL. A nullable column with no explicit
--     default already behaves as DEFAULT NULL in MySQL, so nothing is lost;
--     if section 1 recorded a different explicit default, add it by hand from
--     that record.
--   · It must NOT drop, rename or recreate uq_quotations_ref. Re-run the
--     SHOW INDEX in section 5 afterwards and confirm the index is untouched.
--   · No data is written, read back or deleted by the rollback.
