-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — service API: replay table (service_request_nonces)
--
--   Round                : QQ R1 LOOP #5 — QUO SERVICE READ
--   Contract             : docs/SERVICE-API.md §3 (check 5) and §6
--   Runbook              : docs/SERVICE-API-MIGRATIONS.md  (backup FIRST)
--   Prepared             : 2026-11-10
--   Applied              : NOT APPLIED. Section 1 MUST be run and READ by a
--                          person before section 2.
--   Database             : Quotation's OWN database (the one db.php opens).
--   Rollback             : 2026-11-10-create-service-request-nonces.rollback.sql
--
-- WHY THIS IS WANTED
--   Every signed request to service.php carries a one-time nonce. Its PRIMARY
--   KEY is the replay guarantee: of two requests with the same nonce exactly
--   one INSERT succeeds; the other gets error 1062 and is refused as
--   "replayed". Same technique as handoff_consumed_tokens.jti.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   · It touches no existing table and creates no foreign key.
--   · It stores no secret, no signature, no request body, no IP address and
--     no user: a random nonce, the key id and the time it arrived.
--   · service.php never deletes from it (that door holds exactly two write
--     statements). Old rows are removed by hand, section 5.
--
-- WITH THE TABLE ABSENT service.php fails closed (503 quo_unavailable) and
-- nothing else in the application is affected. Apply this BEFORE setting
-- QQ_SERVICE_ENABLED=true.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · PREFLIGHT — READ-ONLY. Run first and READ the output.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT VERSION() AS engine_version, DATABASE() AS db_in_use;

-- 1a · This must be Quotation's database: it holds quotations and companies.
--      EXPECT 2 rows. Anything else: wrong database, STOP.
SELECT TABLE_NAME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME IN ('quotations', 'companies');

-- 1b · The table should NOT exist yet. EXPECT 0 rows on a first run. A row
--      here on a first run means something else created it: STOP and inspect
--      it with SHOW CREATE TABLE. (Section 2 refuses a different shape by
--      itself, but a person should know before running it.)
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION, CREATE_TIME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'service_request_nonces';


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · CREATE — run only after section 1 has been read.
--   Safe to run again: an existing table of exactly this shape is left as it
--   is. An existing table of ANY OTHER shape stops the script at the guard
--   with error 1242 ("Subquery returns more than 1 row") before CREATE runs.
-- ═════════════════════════════════════════════════════════════════════════════

-- >>> SECTION 2 BEGIN
SET @srn_exists := (SELECT COUNT(*) FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_request_nonces');
SET @srn_cols   := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_request_nonces');
SET @srn_match  := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_request_nonces'
                      AND CONCAT(COLUMN_NAME, ':', COLUMN_TYPE, ':', IS_NULLABLE) IN
                          ('nonce:char(32):NO', 'key_id:varchar(32):NO', 'received_at:timestamp:NO'));
SET @srn_pk     := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_request_nonces'
                      AND INDEX_NAME = 'PRIMARY');
SET @srn_pk_ok  := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_request_nonces'
                      AND INDEX_NAME = 'PRIMARY' AND COLUMN_NAME = 'nonce');
SET @srn_refuse := IF(@srn_exists = 0 OR (@srn_cols = 3 AND @srn_match = 3 AND @srn_pk = 1 AND @srn_pk_ok = 1), 0, 1);

-- THE GUARD. Returns NULL when all is well. Fails with error 1242 when the
-- table already exists with a different shape: STOP, change nothing.
SELECT (SELECT g.n FROM (SELECT 1 AS n UNION ALL SELECT 2) g WHERE @srn_refuse = 1) AS shape_guard_null_means_ok;

CREATE TABLE IF NOT EXISTS service_request_nonces (
  -- 128-bit request nonce, 32 lowercase hex. THE uniqueness guarantee.
  nonce        CHAR(32)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Which signing key id the request named (helps during a rotation).
  key_id       VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Written with FROM_UNIXTIME, so the session time zone cancels out.
  received_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (nonce),
  KEY idx_srn_received (received_at)
) ENGINE=InnoDB;
-- <<< SECTION 2 END


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · VERIFY — READ-ONLY. Run after section 2.
-- ═════════════════════════════════════════════════════════════════════════════

SHOW CREATE TABLE service_request_nonces;

-- EXPECT exactly: PRIMARY on nonce (NON_UNIQUE = 0) and idx_srn_received on
-- received_at. If PRIMARY is absent, STOP: replay protection would not hold.
SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM   information_schema.STATISTICS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'service_request_nonces'
ORDER  BY INDEX_NAME, SEQ_IN_INDEX;

-- EXPECT 0 on a first run.
SELECT COUNT(*) AS nonce_rows FROM service_request_nonces;


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · ROLLBACK — see 2026-11-10-create-service-request-nonces.rollback.sql
-- ═════════════════════════════════════════════════════════════════════════════

-- The real rollback is QQ_SERVICE_ENABLED=false: the table is then never read
-- or written and can stay.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 5 · HOUSEKEEPING — optional, by hand, NOT part of the migration.
-- ═════════════════════════════════════════════════════════════════════════════

-- A nonce only matters while its timestamp is still acceptable (±60 s).
-- Anything older than a day is dead weight and may be removed at any time,
-- with the service on or off:
--
--     DELETE FROM service_request_nonces WHERE received_at < NOW() - INTERVAL 1 DAY;
--
-- Left commented out on purpose.
