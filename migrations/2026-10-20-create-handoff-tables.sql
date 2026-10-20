-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — DNC Workspace handoff: replay and rate-limit tables
--
--   Round                : DNC WORKSPACE V1 — SESSION C: QUOTATION HANDOFF
--   Contract             : dnc-portal docs/HANDOFF-CONTRACT.md v2 (bab1b67) §7
--   Prepared             : 2026-10-20
--   Applied              : NOT APPLIED. Section 1 MUST be run and READ by a
--                          person before section 2.
--   Database             : Quotation's OWN database (the one db.php opens).
--                          NOT the canonical DNC users database — Quotation
--                          never writes there and holds no user table of its
--                          own for DNC identities.
--
-- WHY THIS IS WANTED
--   handoff_consumed_tokens  Every handoff token carries a one-time id (jti).
--                            Its PRIMARY KEY is the replay guarantee: of two
--                            concurrent callbacks with the same token, exactly
--                            one INSERT succeeds; the other gets error 1062
--                            and is refused as "replayed". Rows older than an
--                            hour past expiry are deleted after each success
--                            (no cron).
--   handoff_rate_limits      /auth/handoff/start and /callback answer at most
--                            30 requests per minute per IP each (contract
--                            §6.1 / §6.3). One row per endpoint + IP hash +
--                            minute; the IP is stored only as SHA-256.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   · It creates no users table and touches no existing table.
--   · It stores no token, no state, no secret and no raw IP address.
--   · No foreign keys: user_id is a canonical DNC users.id in ANOTHER database.
--
-- WITH THE TABLES ABSENT the handoff fails closed (the browser is sent to the
-- normal sign-in page) and nothing else in the application is affected. Apply
-- this BEFORE setting DNC_HANDOFF_ENABLED=true.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · PREFLIGHT — READ-ONLY. Run first and READ the output.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT VERSION() AS engine_version, DATABASE() AS db_in_use;

-- 1a · Neither table may already exist. If this returns a row, STOP and
--      inspect it with SHOW CREATE TABLE before going on.
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION, CREATE_TIME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME IN ('handoff_consumed_tokens', 'handoff_rate_limits');

-- 1b · This must be Quotation's database: it holds quotations and app_users.
--      EXPECT 2 rows. Anything else: wrong database, STOP.
SELECT TABLE_NAME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME IN ('quotations', 'app_users');


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · CREATE TABLES — run only after section 1 has been read.
-- ═════════════════════════════════════════════════════════════════════════════

-- >>> SECTION 2 BEGIN
CREATE TABLE IF NOT EXISTS handoff_consumed_tokens (
  -- 128-bit token id, 32 lowercase hex. THE uniqueness guarantee.
  jti          CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- The token's sub: a canonical DNC users.id (Internal PO), not app_users.
  user_id      BIGINT UNSIGNED NOT NULL,
  -- The token's exp. Written and compared with FROM_UNIXTIME, so the session
  -- time zone cancels out.
  expires_at   TIMESTAMP       NOT NULL,
  consumed_at  TIMESTAMP       NOT NULL,
  PRIMARY KEY (jti),
  KEY idx_handoff_consumed_tokens_expires (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS handoff_rate_limits (
  -- SHA-256 hex of "<endpoint>|<IP>". Never the IP itself.
  bucket        CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Unix seconds at the start of the one-minute window.
  window_start  INT UNSIGNED    NOT NULL,
  hits          INT UNSIGNED    NOT NULL,
  PRIMARY KEY (bucket, window_start),
  KEY idx_handoff_rate_limits_window (window_start)
) ENGINE=InnoDB;
-- <<< SECTION 2 END


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · VERIFY — READ-ONLY. Run after section 2.
-- ═════════════════════════════════════════════════════════════════════════════

SHOW CREATE TABLE handoff_consumed_tokens;
SHOW CREATE TABLE handoff_rate_limits;

-- EXPECT: PRIMARY on jti (NON_UNIQUE = 0) and PRIMARY on (bucket, window_start).
-- If either PRIMARY is absent, STOP: replay protection would not hold.
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM   information_schema.STATISTICS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME IN ('handoff_consumed_tokens', 'handoff_rate_limits')
ORDER  BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- EXPECT 0 and 0.
SELECT (SELECT COUNT(*) FROM handoff_consumed_tokens) AS consumed_rows,
       (SELECT COUNT(*) FROM handoff_rate_limits)     AS rate_rows;


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · ROLLBACK — explicit, and NOT run as part of normal execution.
-- ═════════════════════════════════════════════════════════════════════════════

-- The real rollback is DNC_HANDOFF_ENABLED=false (or the Portal switch): the
-- tables are then never read or written and can stay. Only if they are
-- genuinely unwanted, deliberately and by hand:
--
--     DROP TABLE handoff_rate_limits;
--     DROP TABLE handoff_consumed_tokens;
--
-- Both hold only short-lived bookkeeping; dropping them loses nothing a person
-- needs. Left commented out on purpose.
