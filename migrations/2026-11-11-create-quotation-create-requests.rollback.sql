-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — ROLLBACK of 2026-11-11-create-quotation-create-requests.sql
--
--   Runbook  : docs/QUOTATION-STORE.md §5
--   Applied  : NOT APPLIED. Run by hand, deliberately, and only when the table
--              is genuinely unwanted.
--
-- ORDER: nothing may be creating quotations with an idempotency key when this
-- runs (today nothing can: no create action is exposed). Dropping the table
-- under a keyed caller does not corrupt anything — the keyed create fails
-- closed and rolls back — but every keyed create fails until it is back.
--
-- WHAT IS LOST BY DROPPING: the record of which quotations were created by
-- which client, user and code version, and the ability to answer a retry with
-- the original quotation. The quotations themselves are NOT touched. So this
-- script REFUSES to drop a table that still holds rows unless the operator has
-- exported them and says so explicitly (step 2).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 · Look before dropping.
SELECT DATABASE() AS db_in_use;
SELECT COUNT(*) AS request_rows, MIN(created_at) AS oldest, MAX(created_at) AS newest
FROM   quotation_create_requests;

-- 2 · If request_rows is above 0: EXPORT THE TABLE FIRST (phpMyAdmin → Export
--     → this table only → SQL, structure and data), check the file opens, and
--     only then un-comment the next line. With 0 rows it is not needed.
--
-- SET @qcr_export_verified := 'YES';

-- 3 · Drop. Fails with error 1242 ("Subquery returns more than 1 row") when
--     rows exist and step 2 was not confirmed: nothing is dropped.
-- >>> ROLLBACK BEGIN
SET @qcr_rows   := (SELECT COUNT(*) FROM quotation_create_requests);
SET @qcr_refuse := IF(@qcr_rows = 0 OR IFNULL(@qcr_export_verified, '') = 'YES', 0, 1);
SELECT (SELECT g.n FROM (SELECT 1 AS n UNION ALL SELECT 2) g WHERE @qcr_refuse = 1) AS export_guard_null_means_ok;
DROP TABLE IF EXISTS quotation_create_requests;
-- <<< ROLLBACK END

-- 4 · Verify. EXPECT 0 rows, and `quotations` exactly as it was.
SELECT TABLE_NAME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'quotation_create_requests';
SELECT COUNT(*) AS quotation_rows FROM quotations;
