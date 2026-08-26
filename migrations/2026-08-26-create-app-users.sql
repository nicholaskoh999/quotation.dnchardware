-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — individual staff accounts (app_users)
--
--   Accepted application : 97a14cf56bad6414e382c6f49f40d13eabd97dc9
--   Repository           : e7646c861976f3087f8f08f3dd653e3922fa4dd3
--   Prepared             : 2026-08-26
--   Applied              : NOT APPLIED — no database was reachable when this
--                          was written. Section 1 MUST be run and READ by a
--                          person before section 2.
--
-- WHY THIS IS WANTED
--   Authentication is one shared 'admin' account, so the server cannot tell one
--   member of staff from another. A quotation's history can only say WHO edited
--   it if the session carries an identity. This table is that identity, and
--   nothing more: no roles, no permissions, no password reset, no tokens.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   · It creates NO accounts. Structure only. Section 4 tells an operator how
--     to generate a hash and insert their own rows. No password and no hash —
--     real or otherwise — belongs in Git.
--   · It does not touch quotations, companies or any existing table.
--   · It does not delete anything. Deactivate with enabled = 0; a user_id may
--     be referenced by history forever, so rows must not be removed.
--   · It does not assume a charset or collation. Section 1 reads what this
--     database actually uses and section 2 inherits it.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · PREFLIGHT — READ-ONLY. Run first and READ the output.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT VERSION() AS engine_version, DATABASE() AS db_in_use;

-- 1a · Does app_users already exist? If this returns a row, STOP.
--      Do not recreate or mutate a table nobody has inspected — read it with
--      1b and decide by hand.
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION, CREATE_TIME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'app_users';

-- 1b · Only if 1a returned a row.
--      SHOW CREATE TABLE app_users;

-- 1c · The database's own defaults. Section 2 states no CHARACTER SET, so the
--      table inherits these — read them and confirm they are what you want.
SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM   information_schema.SCHEMATA
WHERE  SCHEMA_NAME = DATABASE();

-- 1d · What the existing tables use, for comparison.
SELECT TABLE_NAME, TABLE_COLLATION
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME IN ('quotations', 'companies');

-- ── GATE ─────────────────────────────────────────────────────────────────────
--   app_users must NOT already exist. If it does: STOP, inspect it with 1b,
--   and do not run section 2.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · CREATE TABLE — run only after section 1 has been read.
-- ═════════════════════════════════════════════════════════════════════════════

-- IF NOT EXISTS is a seatbelt, not a substitute for section 1: it stops this
-- from destroying an existing table, but it would also silently do nothing and
-- leave you believing the schema below is what is there. Section 1 is what
-- tells you the truth; section 3 confirms it afterwards.
CREATE TABLE IF NOT EXISTS app_users (
  id             INT UNSIGNED    NOT NULL AUTO_INCREMENT,

  -- Stored lowercase and looked up lowercase, so Nicholas / NICHOLAS /
  -- nicholas are ONE identity. The UNIQUE key is what enforces that; the
  -- application normalises with dc_normalize_username() on both sides.
  username       VARCHAR(64)     NOT NULL,

  -- What the person is CALLED. Free casing — never normalised.
  display_name   VARCHAR(100)    NOT NULL,

  -- bcrypt from password_hash(). 255 leaves room for a future algorithm
  -- without another migration. NEVER a plaintext password.
  password_hash  VARCHAR(255)    NOT NULL,

  -- 1 = may sign in, 0 = may not. Deactivation instead of deletion, because a
  -- user_id may be referenced by quotation history forever.
  enabled        TINYINT(1)      NOT NULL DEFAULT 1,

  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Maintained by the database on any row change, so "when was this account
  -- last touched" needs no application discipline to stay true.
  updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_app_users_username (username)
) ENGINE=InnoDB;
-- No CHARACTER SET / COLLATE clause: the table inherits the database defaults
-- read in section 1c, which is what every other table here already does.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · VERIFY — READ-ONLY. Run after section 2.
-- ═════════════════════════════════════════════════════════════════════════════

SHOW CREATE TABLE app_users;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA,
       CHARACTER_SET_NAME, COLLATION_NAME
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'app_users'
ORDER  BY ORDINAL_POSITION;
--   EXPECT exactly: id, username, display_name, password_hash, enabled,
--   created_at, updated_at.

-- The UNIQUE username protection — the one constraint this table must have.
SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM   information_schema.STATISTICS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'app_users'
ORDER  BY INDEX_NAME, SEQ_IN_INDEX;
--   EXPECT: uq_app_users_username, NON_UNIQUE = 0, on username.
--   If NON_UNIQUE is 1 or the index is absent, STOP: two people could take the
--   same username and history could not tell them apart.

SELECT COUNT(*) AS rows_now FROM app_users;
--   EXPECT 0. This migration creates no accounts.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · SEED INSTRUCTIONS — for the operator. NOT part of this file's
--             execution, and NOTHING here may be committed to Git.
-- ═════════════════════════════════════════════════════════════════════════════

-- 4a · Generate a hash on the server, one per person. Choose a real password
--      per person; do not reuse the old shared one.
--
--          php -r 'echo password_hash("the-password", PASSWORD_DEFAULT), PHP_EOL;'
--
--      The output starts with $2y$ and is ~60 characters.
--
--      Do not paste any real password or any real hash into Git, into a
--      migration, into a test, into a ticket or into a chat message.

-- 4b · Insert each account. USERNAME MUST BE LOWERCASE — the application
--      lowercases what is typed at sign-in, so a row stored as 'Nicholas'
--      can never be matched.
--
--      The values below are OBVIOUS PLACEHOLDERS. Replace all three.
--
--          INSERT INTO app_users
--            (username, display_name, password_hash, enabled)
--          VALUES
--            ('example-user', 'Example User', '$2y$FAKE_REPLACE_ME', 1);

-- 4c · Confirm what you created, without printing hashes:
--
--          SELECT id, username, display_name, enabled, created_at
--          FROM app_users ORDER BY id;

-- 4d · Deactivate someone later WITHOUT deleting them:
--
--          UPDATE app_users SET enabled = 0 WHERE username = 'example-user';

-- 4e · Change a password later:
--
--          UPDATE app_users SET password_hash = '$2y$FAKE_REPLACE_ME'
--          WHERE username = 'example-user';

-- ── ORDER OF ROLLOUT ─────────────────────────────────────────────────────────
--   Sections 1-3 and the seeding in 4 happen while the OLD shared-login
--   application is still live and unaffected — an unused app_users table
--   changes nothing for it. Only afterwards is the new application deployed.
--   Rolling the application back restores shared login; the table may stay.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 5 · ROLLBACK — explicit, and NOT run as part of normal execution.
-- ═════════════════════════════════════════════════════════════════════════════

-- Rolling back the APPLICATION is the real rollback: the previous accepted
-- release uses shared login and never reads app_users, so the table can simply
-- stay. Prefer that. Nothing below is needed to restore service.
--
-- DROP TABLE destroys every account row permanently, and any future history
-- referring to a user_id would lose the name behind it. Run it ONLY when the
-- table is genuinely unwanted, and only after checking what is in it:
--
--     SELECT id, username, display_name, enabled, created_at
--     FROM app_users ORDER BY id;
--
-- Then, deliberately and by hand:
--
--     DROP TABLE app_users;
--
-- It is left commented out on purpose. This file must never drop a production
-- table by being executed from top to bottom.
