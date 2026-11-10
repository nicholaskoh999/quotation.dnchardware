-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — ROLLBACK of 2026-11-10-create-service-request-nonces.sql
--
--   Runbook  : docs/SERVICE-API-MIGRATIONS.md
--   Applied  : NOT APPLIED. Run by hand, deliberately, and only when the table
--              is genuinely unwanted.
--
-- THE REAL ROLLBACK IS A SWITCH, NOT THIS FILE: set QQ_SERVICE_ENABLED to
-- 'false' in service_config.php (or remove that file). service.php then
-- answers 404 not_available and never reads or writes this table, which can
-- stay where it is.
--
-- ORDER: switch the service OFF first. Dropping the table while the service is
-- on does not open anything — service.php fails closed with 503 — but every
-- QQ request fails until the table is back.
--
-- WHAT IS LOST: short-lived replay bookkeeping only. Nothing a person needs.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 · Look before dropping.
SELECT DATABASE() AS db_in_use;
SELECT COUNT(*) AS nonce_rows, MIN(received_at) AS oldest, MAX(received_at) AS newest
FROM   service_request_nonces;

-- 2 · Drop.
-- >>> ROLLBACK BEGIN
DROP TABLE IF EXISTS service_request_nonces;
-- <<< ROLLBACK END

-- 3 · Verify. EXPECT 0 rows.
SELECT TABLE_NAME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'service_request_nonces';
