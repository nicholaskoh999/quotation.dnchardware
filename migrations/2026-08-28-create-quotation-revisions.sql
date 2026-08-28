-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — revision storage (quotation_revisions)
--
--   Accepted application : 649f80a09f83a7201c0f3772e01fc270ccda3e05
--   Prepared             : 2026-08-28
--   Applied              : NOT APPLIED — no database was reachable when this
--                          was written. Section 1 MUST be run and READ by a
--                          person before section 2.
--   Round                : REVISION STORAGE FOUNDATION (candidate)
--   Target               : MySQL 8.0.46 (production). Verified on 8.4.3.
--
-- WHY THIS IS WANTED
--   Actor Identity answers WHO. Item Identity answers WHICH ITEM. Neither can
--   answer WHAT CHANGED, because nothing keeps the previous state: every save
--   overwrites the quotation row in place. This table is the place an immutable
--   snapshot can live, and nothing more.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   · It writes NO revisions. Structure only. Nothing in the application reads
--     or writes this table after this migration — the Snapshot Revision Writer
--     is a later round and does not exist yet.
--   · It does not backfill history. An empty table is the correct outcome; the
--     quotations that exist today have no recorded past and inventing one would
--     be fabricating history.
--   · It does not touch quotations, app_users, companies or any existing table.
--   · It creates no item table. Item identity stays inside the snapshot JSON,
--     exactly as it lives inside quotations.items today.
--   · It adds no triggers and no foreign keys. See the two notes below.
--   · It does not assume a charset or collation. Section 1 reads what this
--     database actually uses, section 2 inherits it, and section 3 CHECKS the
--     one place where inheriting could be wrong.
--
-- APPEND-ONLY IS A CONTRACT, NOT A TRIGGER
--   This table is conceptually append-only: a revision, once written, is never
--   updated and never deleted. That is NOT enforced here with BEFORE UPDATE /
--   BEFORE DELETE triggers, deliberately. Triggers on shared hosting need
--   privileges this project has not established, they are awkward to inspect
--   and reverse, and a trigger that refuses a DELETE would also refuse the
--   Baseline / Delete Policy round its own decisions. The contract is stated
--   here and in PROJECT-GUARDRAILS; the writer round is where it is enforced,
--   by there being exactly one INSERT and no UPDATE or DELETE in the code.
--
-- NO FOREIGN KEYS, AND THAT IS THE DESIGN
--   quotation_id is a LOGICAL, IMMUTABLE reference. It is not a DB-enforced FK,
--   because every available FK action is wrong today:
--
--       ON DELETE CASCADE   would destroy the history of a deleted quotation —
--                           the exact record that makes a deletion auditable
--       ON DELETE RESTRICT  would change today's deletion behaviour, which is
--                           an application change this round is not scoped for
--       ON DELETE SET NULL  would orphan a revision from the thing it describes
--                           and break "which quotation was this" forever
--
--   The application can physically delete quotations today, and what history
--   should do about that is the Baseline / Delete Policy round. Choosing an FK
--   action now would decide that policy by accident, in DDL, where nobody would
--   look for it. quotation_ref_no is stored alongside precisely so a revision
--   still names its quotation after the row is gone.
--
--   actor_user_id is the same: no FK to app_users until user-retention policy
--   is decided. app_users rows are never deleted today (enabled = 0 instead),
--   but that is a convention, not a constraint, and history must survive it
--   changing. actor_username and actor_display_name are snapshotted beside the
--   id for the same reason — a renamed user must not rewrite the past.
--
--   This is recorded as a DECISION. It is not missing work.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · PREFLIGHT — READ-ONLY. Run first and READ the output.
-- ═════════════════════════════════════════════════════════════════════════════

SELECT VERSION() AS engine_version, DATABASE() AS db_in_use;

-- 1a · Does quotation_revisions already exist? If this returns a row, STOP.
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION, CREATE_TIME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotation_revisions';

-- 1b · Only if 1a returned a row.
--      SHOW CREATE TABLE quotation_revisions;

-- 1c · The types this table has to match. Section 2 states them explicitly, so
--      READ this and confirm before running it.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, EXTRA,
       CHARACTER_SET_NAME, COLLATION_NAME
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  ((TABLE_NAME = 'quotations' AND COLUMN_NAME IN ('id', 'ref_no'))
    OR  (TABLE_NAME = 'app_users'  AND COLUMN_NAME IN ('id', 'username', 'display_name')));
--   EXPECTED, from the previous audits:
--       quotations.id            int unsigned, auto_increment
--       quotations.ref_no        varchar(100) utf8mb4 / utf8mb4_general_ci
--       app_users.id             int unsigned, auto_increment
--       app_users.username       varchar(64)
--       app_users.display_name   varchar(100)
--
--   GATE: if quotations.id is WIDER than int unsigned (bigint), stop and widen
--   quotation_id in section 2 to match. A narrower reference silently truncates.
--   If quotations.ref_no is wider than varchar(100), widen quotation_ref_no.

-- 1d · The database's own defaults. Section 2 states no CHARACTER SET, so the
--      table inherits these — read them, and read 1e beside them.
SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM   information_schema.SCHEMATA
WHERE  SCHEMA_NAME = DATABASE();

-- 1e · The one place inheriting could be wrong. quotation_ref_no will be
--      compared against quotations.ref_no, and MySQL refuses to compare two
--      columns whose collations differ ("Illegal mix of collations"). On MySQL
--      8 the database default is often utf8mb4_0900_ai_ci while an older table
--      is utf8mb4_general_ci — the same charset, a different collation.
--      Section 3 checks this AFTER the table exists and generates the fix.
SELECT c.COLLATION_NAME AS ref_no_collation,
       s.DEFAULT_COLLATION_NAME AS db_default_collation,
       IF(c.COLLATION_NAME = s.DEFAULT_COLLATION_NAME,
          'MATCH — section 2 may inherit',
          'DIFFERENT — section 3 will generate an ALTER; run it') AS verdict
FROM   information_schema.COLUMNS c
JOIN   information_schema.SCHEMATA s ON s.SCHEMA_NAME = DATABASE()
WHERE  c.TABLE_SCHEMA = DATABASE()
  AND  c.TABLE_NAME   = 'quotations'
  AND  c.COLUMN_NAME  = 'ref_no';

-- ── GATE ─────────────────────────────────────────────────────────────────────
--   quotation_revisions must NOT already exist. If it does: STOP, inspect it
--   with 1b, and do not run section 2.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · CREATE TABLE — run only after section 1 has been read.
--
--   The BEGIN/END markers below are load-bearing: tests/php/revision_storage.test.php
--   lifts exactly this block out of this file and executes it, so the test
--   proves the shipped migration rather than a copy of it. Do not remove them.
-- ═════════════════════════════════════════════════════════════════════════════

-- >>> SECTION 2 BEGIN
CREATE TABLE IF NOT EXISTS quotation_revisions (
  -- The revision row's own identity. Never reused, never reordered.
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- LOGICAL reference to quotations.id. Deliberately not a foreign key; see
  -- the header. int unsigned matches quotations.id as observed in section 1c.
  quotation_id             INT UNSIGNED    NOT NULL,

  -- Monotonically increasing PER QUOTATION, starting at 1. The writer round
  -- allocates it; this table only guarantees it is never duplicated within one
  -- quotation, which is what UNIQUE below is for.
  revision_no              INT UNSIGNED    NOT NULL,

  -- The quotation number as it was AT THAT REVISION. A lookup aid, and the
  -- reason a revision still names its quotation after the row is deleted.
  -- Length matches quotations.ref_no; collation is verified in section 3.
  quotation_ref_no         VARCHAR(100)    NOT NULL,

  -- A generic label, NOT an enum and NOT constrained. This round stores
  -- history; it does not decide which events exist. Widening a CHECK or an
  -- ENUM later is a migration on a table that by then holds real history, so
  -- the cheap thing now is to decide nothing.
  event_type               VARCHAR(32)     NOT NULL,

  -- Actor Identity, as it was at that moment. The id is the identity; the two
  -- names are SNAPSHOTS so a later rename or deactivation cannot rewrite the
  -- past. All three are nullable: a revision written by a migration, a script
  -- or a future system actor has no signed-in person behind it, and NULL says
  -- that honestly where a placeholder user id would lie.
  actor_user_id            INT UNSIGNED        NULL,
  actor_username           VARCHAR(64)         NULL,
  actor_display_name       VARCHAR(100)        NULL,

  -- Which shape snapshot_json is in. NOT NULL and with NO DEFAULT on purpose:
  -- a writer must state the version it wrote, because a default would let a
  -- future format be stored silently under the old number, and the one thing
  -- a version column must never do is be wrong.
  snapshot_schema_version  SMALLINT UNSIGNED NOT NULL,

  -- The whole quotation as it was. Native JSON, so MySQL validates it on the
  -- way in: an unparseable snapshot is refused at the column rather than
  -- discovered years later by whatever tries to read the history.
  -- No item table: item_uid stays inside this JSON, exactly as it lives inside
  -- quotations.items today.
  snapshot_json            JSON            NOT NULL,

  -- DATETIME, not TIMESTAMP, and the deviation from app_users is deliberate:
  --   · TIMESTAMP stops in 2038, and this is the one table designed never to
  --     be rewritten;
  --   · TIMESTAMP is converted by the SESSION time zone. api.php sets
  --     +08:00 per request, but the CLI migrations connect without setting it,
  --     so the same instant written by one path and read by another would not
  --     agree. DATETIME stores the literal value it was given.
  created_at               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- The one guarantee this table makes about revision numbering: two revisions
  -- of ONE quotation can never share a number. Different quotations may of
  -- course both have a revision 1.
  UNIQUE KEY uq_quotation_revisions_no (quotation_id, revision_no),

  -- Deliberately NO separate KEY (quotation_id): it is the leftmost column of
  -- the UNIQUE above, so MySQL already uses that index for lookups by
  -- quotation, and a second index on the same prefix would cost writes and
  -- buy nothing.

  -- "Show me the history of quotation Q-2026-0693" — the History API's lookup,
  -- and the only way to find revisions of a quotation row that no longer exists.
  KEY idx_quotation_revisions_ref (quotation_ref_no),

  -- "What did this person change" — the question Actor Identity was built to
  -- make answerable.
  KEY idx_quotation_revisions_actor (actor_user_id),

  -- Most-recent-first across quotations, and "revisions older than X" for the
  -- Baseline / Delete Policy round. Two named future queries, not a guess.
  KEY idx_quotation_revisions_created (created_at)
) ENGINE=InnoDB;
-- No CHARACTER SET / COLLATE clause: the table inherits the database defaults
-- read in section 1d, which is what app_users does. Section 3 checks the one
-- column where that could be the wrong answer.
-- <<< SECTION 2 END


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · VERIFY — READ-ONLY. Run after section 2.
-- ═════════════════════════════════════════════════════════════════════════════

SHOW CREATE TABLE quotation_revisions;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA,
       CHARACTER_SET_NAME, COLLATION_NAME
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotation_revisions'
ORDER  BY ORDINAL_POSITION;
--   EXPECT exactly these ELEVEN, in this order: id, quotation_id, revision_no,
--   quotation_ref_no, event_type, actor_user_id, actor_username,
--   actor_display_name, snapshot_schema_version, snapshot_json, created_at.
--   A twelfth column means something other than this file created it.

SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM   information_schema.STATISTICS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotation_revisions'
ORDER  BY INDEX_NAME, SEQ_IN_INDEX;
--   EXPECT: PRIMARY on id; uq_quotation_revisions_no NON_UNIQUE=0 on
--   (quotation_id, revision_no); and three ordinary keys on quotation_ref_no,
--   actor_user_id and created_at.
--   If uq_quotation_revisions_no is absent or NON_UNIQUE=1, STOP: one
--   quotation could then hold two revision 4s and its history would be
--   unorderable.

SELECT COUNT(*) AS rows_now FROM quotation_revisions;
--   EXPECT 0. This migration records no history and backfills none.

-- 3a · The collation check section 1e set up. If ref_no and quotation_ref_no
--      disagree, comparing them raises "Illegal mix of collations", and this
--      GENERATES the exact statement that fixes it rather than having anyone
--      hand-type a charset.
SELECT CASE WHEN q.COLLATION_NAME = r.COLLATION_NAME
            THEN 'MATCH — nothing to do'
            ELSE CONCAT('ALTER TABLE quotation_revisions MODIFY quotation_ref_no ',
                        r.COLUMN_TYPE, ' CHARACTER SET ', q.CHARACTER_SET_NAME,
                        ' COLLATE ', q.COLLATION_NAME, ' NOT NULL;')
       END AS collation_action
FROM   information_schema.COLUMNS q
JOIN   information_schema.COLUMNS r
       ON r.TABLE_SCHEMA = q.TABLE_SCHEMA
      AND r.TABLE_NAME   = 'quotation_revisions'
      AND r.COLUMN_NAME  = 'quotation_ref_no'
WHERE  q.TABLE_SCHEMA = DATABASE()
  AND  q.TABLE_NAME   = 'quotations'
  AND  q.COLUMN_NAME  = 'ref_no';
--   Run whatever this prints, if it prints an ALTER. It changes collation and
--   nothing else — the type comes from the column as it exists.

-- 3b · Prove this migration touched nothing else. Compare against what you
--      recorded in section 1c.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  ((TABLE_NAME = 'quotations' AND COLUMN_NAME IN ('id', 'ref_no'))
    OR  (TABLE_NAME = 'app_users'  AND COLUMN_NAME IN ('id', 'username', 'display_name')));


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · RE-RUNNING THIS FILE
-- ═════════════════════════════════════════════════════════════════════════════
--   Section 2 is CREATE TABLE IF NOT EXISTS, so running this file twice creates
--   the table once and leaves it alone the second time. Sections 1 and 3 are
--   read-only and may be run as often as you like.
--
--   IF NOT EXISTS is a seatbelt, not a substitute for section 1: it stops this
--   from destroying an existing table, but it would also silently do nothing
--   and leave you believing the schema above is what is there. Section 1 tells
--   you the truth; section 3 confirms it afterwards.
--
--   NOTHING HERE WRITES A ROW. There is no INSERT in this file, and there is no
--   code anywhere in the application that writes to quotation_revisions — the
--   Snapshot Revision Writer round does not exist yet.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 5 · ROLLBACK — explicit, and NOT run as part of normal execution.
-- ═════════════════════════════════════════════════════════════════════════════
--   While this table is empty, dropping it is harmless and reverses this
--   migration completely: nothing reads it, nothing writes it, and no other
--   table references it — which is one practical benefit of having added no
--   foreign key.
--
--   Once the writer round ships and real revisions exist, DROP TABLE destroys
--   history that cannot be reconstructed from anywhere. Check first:
--
--       SELECT COUNT(*) FROM quotation_revisions;
--
--   Then, deliberately and by hand, and only if that count is 0 or the history
--   is genuinely unwanted:
--
--       DROP TABLE quotation_revisions;
--
--   It is left commented out on purpose. This file must never drop a table by
--   being executed from top to bottom.
