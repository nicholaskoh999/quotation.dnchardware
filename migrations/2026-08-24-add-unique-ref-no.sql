-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — add database-level uniqueness for quotations.ref_no
--
--   Accepted application : cf92f27feb629134a61801dc120eba79c54fb5f6
--   Repository           : 34bdbf345f886008fea40fdbcd8ab948994a291f
--   Prepared             : 2026-08-24
--   Applied              : NOT APPLIED — no database was reachable when this
--                          was written. Sections 1 and 2 MUST be run and read
--                          by a person before section 3.
--
-- WHY THIS IS WANTED
--   api.php allocates the number under a named lock — GET_LOCK('dc_quotation_
--   ref_alloc', 10) — and there is exactly ONE statement in the codebase that
--   writes ref_no (the INSERT in save_quotation; update_quotation deliberately
--   never touches it). That lock is good discipline, but it is advisory and
--   application-side: it protects against two PHP requests racing, not against
--   a second application, an import, a manual phpMyAdmin insert, or a request
--   that dies between allocation and insert. A UNIQUE index is the only thing
--   that makes a duplicate quotation number impossible rather than unlikely.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   · It does not redefine the column. The datatype and length are whatever
--     production has; ADD UNIQUE KEY does not need to know, and rewriting a
--     column definition that nobody has read would be guessing.
--   · It does not add NOT NULL. That was asked for "only if confirmed
--     compatible", and it could not be confirmed — see section 2. A UNIQUE
--     index in MySQL permits multiple NULLs, so uniqueness works either way.
--     NOT NULL is a separate, later decision that needs the section 2 result.
--   · It does not touch `previous_ref_no`, which is a different column holding
--     the number a quotation had before a historical renumber. It is read by
--     Quick Open and is NOT required to be unique.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · PREFLIGHT — READ-ONLY. Run this first and read the output.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT VERSION() AS engine_version;

SHOW CREATE TABLE quotations;

SHOW INDEX FROM quotations;

SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE,
       COLUMN_DEFAULT, COLLATION_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'quotations'
   AND COLUMN_NAME IN ('ref_no', 'previous_ref_no');

-- THE GATE. This must return ZERO ROWS.
-- If it returns anything, STOP: the duplicates must be resolved by a person who
-- knows which quotation is the real one. Do not "fix" them automatically —
-- a quotation number is what a customer quotes back at you.
SELECT ref_no, COUNT(*) AS n, GROUP_CONCAT(id ORDER BY id) AS ids
  FROM quotations
 GROUP BY ref_no
HAVING COUNT(*) > 1
 ORDER BY n DESC, ref_no;


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · NULL / EMPTY AUDIT — READ-ONLY.
--
-- Decides whether NOT NULL is safe. It is NOT part of this migration either
-- way; this only produces the number the decision needs.
--
--   nulls  > 0  → NOT NULL would fail. Leave the column nullable.
--   blanks > 0  → worse than NULL: '' is a real value, so two blank rows are a
--                 UNIQUE violation and would block this migration. Resolve them
--                 first, exactly as duplicates are resolved.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT COUNT(*)                                                AS total_rows,
       SUM(ref_no IS NULL)                                     AS nulls,
       SUM(ref_no IS NOT NULL AND TRIM(ref_no) = '')           AS blanks,
       SUM(ref_no IS NOT NULL AND TRIM(ref_no) <> ref_no)      AS untrimmed,
       MAX(CHAR_LENGTH(ref_no))                                AS longest
  FROM quotations;

-- Blank and NULL rows, named, so a person can look at them.
SELECT id, ref_no, quote_date, customer_name, total_amount
  FROM quotations
 WHERE ref_no IS NULL OR TRIM(ref_no) = ''
 ORDER BY id;


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · THE MIGRATION
--
-- Run ONLY when section 1's gate returned zero rows and section 2's `blanks`
-- is zero. Take a backup first — this is a schema change on a live table.
--
--   mysqldump --single-transaction --routines <db> quotations > quotations-backup.sql
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE quotations
  ADD UNIQUE KEY uq_quotations_ref_no (ref_no);


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · VERIFY
-- ═════════════════════════════════════════════════════════════════════════════

SHOW INDEX FROM quotations;
-- EXPECT a row with:  Key_name = uq_quotations_ref_no,  Non_unique = 0,
--                     Column_name = ref_no,  Seq_in_index = 1

-- Proof the constraint actually refuses. Wrapped in a transaction and rolled
-- back, so it proves the behaviour without leaving a row behind. EXPECT the
-- second INSERT to fail with ERROR 1062 (23000) Duplicate entry.
--
--   START TRANSACTION;
--   INSERT INTO quotations (ref_no, quote_date, customer_name, items, total_amount)
--        VALUES ('Q-9999-9001', CURDATE(), 'MIGRATION TEST', '[]', 0);
--   INSERT INTO quotations (ref_no, quote_date, customer_name, items, total_amount)
--        VALUES ('Q-9999-9001', CURDATE(), 'MIGRATION TEST', '[]', 0);
--   -- ^ must fail 1062
--   ROLLBACK;
--
-- Left commented deliberately: it writes to the live table, and whether that is
-- acceptable is a decision for whoever runs it, not for this file.


-- ═════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═════════════════════════════════════════════════════════════════════════════

-- ALTER TABLE quotations DROP INDEX uq_quotations_ref_no;
