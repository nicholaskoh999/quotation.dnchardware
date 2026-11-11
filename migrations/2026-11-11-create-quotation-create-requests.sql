-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — idempotent quotation create (quotation_create_requests)
--
--   Round                : QQ R1 LOOP #6 — SAVE FOUNDATION
--   Contract             : docs/QUOTATION-STORE.md §3 and §5
--   Runbook              : docs/QUOTATION-STORE.md §5  (BACKUP FIRST)
--   Prepared             : 2026-11-11
--   Applied              : NOT APPLIED. Section 1 MUST be run and READ by a
--                          person before section 2.
--   Database             : Quotation's OWN database (the one db.php opens).
--   Rollback             : 2026-11-11-create-quotation-create-requests.rollback.sql
--
-- WHY THIS IS WANTED
--   A create that carries an idempotency key (a UUID v4, made once per draft by
--   the client and reused for every retry) records it here IN THE SAME
--   TRANSACTION as the quotation and its 'create' revision. UNIQUE
--   (actor_user_id, idempotency_key) makes a second create with the same key
--   by the same user impossible: the retry gets the first quotation back.
--   payload_sha256 tells a true retry from "same key, different content".
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   · It touches no existing table and creates no foreign key (quotation_id
--     and wa_contact_id are plain INTs, like quotations.id / the contact id).
--   · It stores no quotation content, no customer, no price and no secret:
--     the key, a hash, who, which code produced it, and the result.
--   · Nothing writes to it yet. The browser save path never uses a key, and
--     service.php exposes no create action. With the table absent the
--     application is unaffected; only a keyed create (not reachable yet)
--     would fail closed and roll back.
--   · Rows are kept. Nothing in the application deletes them.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · PREFLIGHT — READ-ONLY. Run first and READ the output.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT VERSION() AS engine_version, DATABASE() AS db_in_use;

-- 1a · This must be Quotation's database: it holds quotations, companies and
--      quotation_revisions. EXPECT 3 rows. Anything else: wrong database, STOP.
SELECT TABLE_NAME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME IN ('quotations', 'companies', 'quotation_revisions');

-- 1b · The table should NOT exist yet. EXPECT 0 rows on a first run. A row
--      here on a first run means something else created it: STOP and inspect
--      it with SHOW CREATE TABLE. (Section 2 refuses a different shape by
--      itself, but a person should know before running it.)
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION, CREATE_TIME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'quotation_create_requests';

-- 1c · quotations.id should be an INT (signed or unsigned): quotation_id below
--      is a signed INT, which holds every value either can reach in practice.
--      EXPECT one row, DATA_TYPE = int.
SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'id';


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · CREATE — run only after section 1 has been read.
--   Safe to run again: an existing table of exactly this shape is left as it
--   is. An existing table of ANY OTHER shape stops the script at the guard
--   with error 1242 ("Subquery returns more than 1 row") before CREATE runs.
-- ═════════════════════════════════════════════════════════════════════════════

-- >>> SECTION 2 BEGIN
SET @qcr_exists := (SELECT COUNT(*) FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_create_requests');
SET @qcr_cols   := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_create_requests');
SET @qcr_match  := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_create_requests'
                      AND CONCAT(COLUMN_NAME, ':', COLUMN_TYPE, ':', IS_NULLABLE) IN
                          ('id:bigint unsigned:NO', 'source:varchar(20):NO',
                           'idempotency_key:char(36):NO', 'payload_sha256:char(64):NO',
                           'actor_user_id:bigint unsigned:NO', 'actor_username:varchar(64):NO',
                           'ext_version:varchar(20):YES', 'parser_core_sha256:char(64):YES',
                           'pricing_core_sha256:char(64):YES', 'settings_version:varchar(40):YES',
                           'wa_contact_id:int:YES', 'quotation_id:int:YES',
                           'ref_no:varchar(100):YES', 'created_at:datetime:NO'));
-- The idempotency guarantee: a UNIQUE index named uq_qcr_actor_key on exactly
-- (actor_user_id, idempotency_key), in that order.
SET @qcr_uq     := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_create_requests'
                      AND INDEX_NAME = 'uq_qcr_actor_key' AND NON_UNIQUE = 0
                      AND CONCAT(SEQ_IN_INDEX, ':', COLUMN_NAME) IN ('1:actor_user_id', '2:idempotency_key'));
SET @qcr_uq_all := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_create_requests'
                      AND INDEX_NAME = 'uq_qcr_actor_key');
SET @qcr_refuse := IF(@qcr_exists = 0
                      OR (@qcr_cols = 14 AND @qcr_match = 14 AND @qcr_uq = 2 AND @qcr_uq_all = 2), 0, 1);

-- THE GUARD. Returns NULL when all is well. Fails with error 1242 when the
-- table already exists with a different shape: STOP, change nothing.
SELECT (SELECT g.n FROM (SELECT 1 AS n UNION ALL SELECT 2) g WHERE @qcr_refuse = 1) AS shape_guard_null_means_ok;

CREATE TABLE IF NOT EXISTS quotation_create_requests (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Which client sent it ('qq' for the Quick Quote extension).
  source              VARCHAR(20)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- UUID v4, lowercase, made by the client once per draft.
  idempotency_key     CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- SHA-256 (hex) of the canonical JSON of the request payload.
  payload_sha256      CHAR(64)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Canonical DNC users.id (BIGINT UNSIGNED, as handoff_consumed_tokens.user_id)
  -- and the username at the time, readable without a cross-database lookup.
  actor_user_id       BIGINT UNSIGNED NOT NULL,
  actor_username      VARCHAR(64)  COLLATE utf8mb4_general_ci NOT NULL,
  -- Which code and which Diameter Settings produced the prices. Optional.
  ext_version         VARCHAR(20)  CHARACTER SET ascii COLLATE ascii_bin NULL,
  parser_core_sha256  CHAR(64)     CHARACTER SET ascii COLLATE ascii_bin NULL,
  pricing_core_sha256 CHAR(64)     CHARACTER SET ascii COLLATE ascii_bin NULL,
  settings_version    VARCHAR(40)  CHARACTER SET ascii COLLATE ascii_bin NULL,
  -- company_whatsapp_contacts.id when known. No foreign key.
  wa_contact_id       INT          NULL,
  -- The result, filled before COMMIT; a committed row always has both.
  quotation_id        INT          NULL,
  ref_no              VARCHAR(100) COLLATE utf8mb4_general_ci NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_qcr_actor_key (actor_user_id, idempotency_key),
  KEY idx_qcr_quotation (quotation_id),
  KEY idx_qcr_contact (wa_contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- <<< SECTION 2 END


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · VERIFY — READ-ONLY. Run after section 2.
-- ═════════════════════════════════════════════════════════════════════════════

SHOW CREATE TABLE quotation_create_requests;

-- EXPECT: PRIMARY on id; uq_qcr_actor_key (NON_UNIQUE = 0) on actor_user_id,
-- idempotency_key; idx_qcr_quotation; idx_qcr_contact. If uq_qcr_actor_key is
-- absent or not unique, STOP: idempotency would not hold.
SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM   information_schema.STATISTICS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'quotation_create_requests'
ORDER  BY INDEX_NAME, SEQ_IN_INDEX;

-- EXPECT 0 on a first run.
SELECT COUNT(*) AS request_rows FROM quotation_create_requests;


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · ROLLBACK — see 2026-11-11-create-quotation-create-requests.rollback.sql
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Nothing reads or writes this table until a keyed create is exposed. While
-- that is so, the table can simply stay.
