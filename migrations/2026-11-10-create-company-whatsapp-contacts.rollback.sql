-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — ROLLBACK of 2026-11-10-create-company-whatsapp-contacts.sql
--
--   Runbook  : docs/SERVICE-API-MIGRATIONS.md
--   Applied  : NOT APPLIED. Run by hand, deliberately, and only when the table
--              is genuinely unwanted.
--
-- THE REAL ROLLBACK IS A SWITCH, NOT THIS FILE: set QQ_SERVICE_ENABLED to
-- 'false' in service_config.php (or remove that file). service.php then
-- answers 404 not_available and never reads or writes this table, which can
-- stay where it is with its links intact.
--
-- WHAT IS LOST BY DROPPING: every company ↔ WhatsApp link people have made.
-- They exist nowhere else (the QQ backend keeps no copy). So this script
-- REFUSES to drop a table that still holds rows unless the operator has
-- exported them and says so explicitly (step 2).
--
-- `companies` is not touched by this rollback, as it was not by the migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 · Look before dropping.
SELECT DATABASE() AS db_in_use;
SELECT COUNT(*) AS contact_rows, MIN(created_at) AS oldest, MAX(created_at) AS newest
FROM   company_whatsapp_contacts;

-- 2 · If contact_rows is above 0: EXPORT THE TABLE FIRST (phpMyAdmin → Export
--     → this table only → SQL, structure and data), check the file opens, and
--     only then un-comment the next line. With 0 rows it is not needed.
--
-- SET @cwc_export_verified := 'YES';

-- 3 · Drop. Fails with error 1242 ("Subquery returns more than 1 row") when
--     rows exist and step 2 was not confirmed: nothing is dropped.
-- >>> ROLLBACK BEGIN
SET @cwc_rows   := (SELECT COUNT(*) FROM company_whatsapp_contacts);
SET @cwc_refuse := IF(@cwc_rows = 0 OR IFNULL(@cwc_export_verified, '') = 'YES', 0, 1);
SELECT (SELECT g.n FROM (SELECT 1 AS n UNION ALL SELECT 2) g WHERE @cwc_refuse = 1) AS export_guard_null_means_ok;
DROP TABLE IF EXISTS company_whatsapp_contacts;
-- <<< ROLLBACK END

-- 4 · Verify. EXPECT 0 rows, and `companies` exactly as it was.
SELECT TABLE_NAME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'company_whatsapp_contacts';
SELECT COUNT(*) AS company_rows FROM companies;
