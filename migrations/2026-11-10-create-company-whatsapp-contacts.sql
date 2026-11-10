-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — service API: WhatsApp contact links (company_whatsapp_contacts)
--
--   Round                : QQ R1 LOOP #5 — QUO SERVICE READ
--   Contract             : docs/SERVICE-API.md §4.4, §4.5 and §6
--   Runbook              : docs/SERVICE-API-MIGRATIONS.md  (backup FIRST)
--   Prepared             : 2026-11-10
--   Applied              : NOT APPLIED. Section 1 MUST be run and READ by a
--                          person before section 2.
--   Database             : Quotation's OWN database (the one db.php opens).
--   Rollback             : 2026-11-10-create-company-whatsapp-contacts.rollback.sql
--
-- WHY THIS IS WANTED
--   One row links one QUO company (companies.id — the canonical identity) to
--   one WhatsApp identity: a normalized phone number and/or WhatsApp's own
--   chat identifier. One company may have many contacts; one contact may be
--   linked to several companies. Written only by service.php (contacts.link),
--   one INSERT per new link; read by contacts.lookup.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   · It does not touch `companies` (or any existing table): no column, no
--     index, no trigger, no data. companies.phone is never read or written.
--   · NO FOREIGN KEY to companies. The QUO schema has none, and one here
--     would change what the existing delete_company action does. The code
--     checks the company exists when linking, and every lookup JOINs
--     companies, so a link whose company was deleted can never match.
--   · linked_by_user_id is a canonical DNC users.id from ANOTHER database
--     (BIGINT UNSIGNED, like handoff_consumed_tokens.user_id): no key to it.
--
-- WITH THE TABLE ABSENT contacts.lookup and contacts.link answer 503
-- quo_unavailable; ping, diameter_settings.get and companies.search still
-- work, and nothing else in the application is affected.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · PREFLIGHT — READ-ONLY. Run first and READ the output.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1a · CHECK constraints are enforced from MySQL 8.0.16. EXPECT 8.0.16 or
--      later (production was 8.0.46 on 2026-11-10). Older: STOP.
SELECT VERSION() AS engine_version, DATABASE() AS db_in_use;

-- 1b · This must be Quotation's database: it holds quotations and companies.
--      EXPECT 2 rows. Anything else: wrong database, STOP.
SELECT TABLE_NAME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME IN ('quotations', 'companies');

-- 1c · company_id below is a signed INT because companies.id is. EXPECT
--      COLUMN_TYPE = int and the table collation utf8mb4_general_ci. Anything
--      else: STOP and report; the new table must match the one it joins.
SELECT c.COLUMN_TYPE AS companies_id_type, t.TABLE_COLLATION AS companies_collation
FROM   information_schema.COLUMNS c
JOIN   information_schema.TABLES t
       ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
WHERE  c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'companies' AND c.COLUMN_NAME = 'id';

-- 1d · The table should NOT exist yet. EXPECT 0 rows on a first run. A row
--      here on a first run means something else created it: STOP and inspect
--      it with SHOW CREATE TABLE. (Section 2 refuses a different shape by
--      itself, but a person should know before running it.)
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION, CREATE_TIME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'company_whatsapp_contacts';


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · CREATE — run only after section 1 has been read.
--   Safe to run again: an existing table of exactly this shape is left as it
--   is, rows included. An existing table of ANY OTHER shape stops the script
--   at the guard with error 1242 ("Subquery returns more than 1 row") before
--   CREATE runs.
-- ═════════════════════════════════════════════════════════════════════════════

-- >>> SECTION 2 BEGIN
SET @cwc_exists := (SELECT COUNT(*) FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_contacts');
SET @cwc_cols   := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_contacts');
SET @cwc_match  := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_contacts'
                      AND CONCAT(COLUMN_NAME, ':', COLUMN_TYPE, ':', IS_NULLABLE) IN
                          ('id:int:NO', 'company_id:int:NO', 'wa_phone:varchar(15):YES',
                           'wa_chat_id:varchar(64):YES', 'display_name:varchar(200):YES',
                           'is_active:tinyint(1):NO', 'source:varchar(20):NO',
                           'linked_by_user_id:bigint unsigned:YES', 'linked_by_username:varchar(64):YES',
                           'last_matched_at:datetime:YES', 'created_at:datetime:NO', 'updated_at:datetime:NO'));
SET @cwc_uniq   := (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_whatsapp_contacts'
                      AND NON_UNIQUE = 0
                      AND INDEX_NAME IN ('PRIMARY', 'uq_cwc_company_phone', 'uq_cwc_company_chat'));
SET @cwc_refuse := IF(@cwc_exists = 0 OR (@cwc_cols = 12 AND @cwc_match = 12 AND @cwc_uniq = 3), 0, 1);

-- THE GUARD. Returns NULL when all is well. Fails with error 1242 when the
-- table already exists with a different shape: STOP, change nothing.
SELECT (SELECT g.n FROM (SELECT 1 AS n UNION ALL SELECT 2) g WHERE @cwc_refuse = 1) AS shape_guard_null_means_ok;

CREATE TABLE IF NOT EXISTS company_whatsapp_contacts (
  -- The contact id returned to the caller.
  id                  INT             NOT NULL AUTO_INCREMENT,
  -- The QUO company: companies.id (signed INT). No foreign key, see above.
  company_id          INT             NOT NULL,
  -- Digits with country code, no "+", 8–15 digits. NULL when the chat hides
  -- the number.
  wa_phone            VARCHAR(15)     CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  -- WhatsApp's own identifier for a chat that shows no number. NULL otherwise.
  wa_chat_id          VARCHAR(64)     CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  -- A label for people. Never indexed, never used to match.
  display_name        VARCHAR(200)    DEFAULT NULL,
  -- Deactivate without deleting. Nothing in service.php changes it.
  is_active           TINYINT(1)      NOT NULL DEFAULT 1,
  -- Which system wrote the row: 'qq'.
  source              VARCHAR(20)     NOT NULL DEFAULT 'qq',
  -- Who linked it: canonical DNC users.id (another database) and username.
  linked_by_user_id   BIGINT UNSIGNED DEFAULT NULL,
  linked_by_username  VARCHAR(64)     DEFAULT NULL,
  -- Reserved for "most recently used first". Nothing writes it yet.
  last_matched_at     DATETIME        DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- One identity is linked to one company at most once. MySQL allows many
  -- NULLs in a unique key, which is what is wanted for the absent identifier.
  UNIQUE KEY uq_cwc_company_phone (company_id, wa_phone),
  UNIQUE KEY uq_cwc_company_chat  (company_id, wa_chat_id),
  KEY idx_cwc_phone (wa_phone),
  KEY idx_cwc_chat  (wa_chat_id),
  -- A row must identify someone: a display name alone is not an identity.
  CONSTRAINT chk_cwc_has_identity CHECK (wa_phone IS NOT NULL OR wa_chat_id IS NOT NULL),
  CONSTRAINT chk_cwc_phone_format CHECK (wa_phone IS NULL OR wa_phone REGEXP '^[1-9][0-9]{7,14}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- <<< SECTION 2 END


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · VERIFY — READ-ONLY. Run after section 2.
-- ═════════════════════════════════════════════════════════════════════════════

SHOW CREATE TABLE company_whatsapp_contacts;

-- EXPECT: PRIMARY (id), uq_cwc_company_phone (company_id, wa_phone) and
-- uq_cwc_company_chat (company_id, wa_chat_id) with NON_UNIQUE = 0;
-- idx_cwc_phone and idx_cwc_chat with NON_UNIQUE = 1.
SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM   information_schema.STATISTICS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'company_whatsapp_contacts'
ORDER  BY INDEX_NAME, SEQ_IN_INDEX;

-- EXPECT 2 rows, both ENFORCED = YES: chk_cwc_has_identity, chk_cwc_phone_format.
SELECT CONSTRAINT_NAME, ENFORCED
FROM   information_schema.TABLE_CONSTRAINTS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME = 'company_whatsapp_contacts'
  AND  CONSTRAINT_TYPE = 'CHECK'
ORDER  BY CONSTRAINT_NAME;

-- EXPECT 0 rows: no foreign key was created, to or from this table.
SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
FROM   information_schema.REFERENTIAL_CONSTRAINTS
WHERE  CONSTRAINT_SCHEMA = DATABASE()
  AND  (TABLE_NAME = 'company_whatsapp_contacts' OR REFERENCED_TABLE_NAME = 'company_whatsapp_contacts');

-- EXPECT 0 on a first run.
SELECT COUNT(*) AS contact_rows FROM company_whatsapp_contacts;

-- EXPECT the same figures as before the migration: `companies` is untouched.
SELECT COUNT(*) AS company_rows, MAX(updated_at) AS companies_last_updated FROM companies;


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · ROLLBACK — see 2026-11-10-create-company-whatsapp-contacts.rollback.sql
-- ═════════════════════════════════════════════════════════════════════════════

-- The real rollback is QQ_SERVICE_ENABLED=false: the table is then never read
-- or written and can stay, links included.
