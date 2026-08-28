-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTATION.DNC — revision storage (quotation_revisions)
--
--   Accepted application : 649f80a09f83a7201c0f3772e01fc270ccda3e05
--   Prepared             : 2026-08-28
--   Applied              : NOT APPLIED — no database was reachable when this
--                          was written. Section 1 MUST be run and READ by a
--                          person before section 2.
--   Round                : REVISION STORAGE FOUNDATION (candidate)
--   Target               : MySQL 8.0.46 (production).
--
-- THE COMPLETE PROCEDURE IS SECTIONS 2 AND 3. Not section 2 alone.
--   Section 2 creates the table. Section 3 aligns one column's collation and is
--   REQUIRED, not conditional. Section 4 refuses to say the migration is done
--   until the result matches what is written below.
--
-- THE AUTHORITATIVE POST-MIGRATION STATE
--   After sections 2 and 3, exactly one thing is true of the column that gets
--   compared across tables:
--
--       quotation_revisions.quotation_ref_no
--           has the SAME COLUMN_TYPE, CHARACTER_SET_NAME and COLLATION_NAME
--           as quotations.ref_no
--
--   Not "inherits the database default", which is only where section 2 starts.
--   MySQL refuses to compare two columns whose collations differ, so a
--   revision could not be joined to its quotation — and on MySQL 8 the database
--   default is commonly utf8mb4_0900_ai_ci while an older table is
--   utf8mb4_general_ci. Same charset, different collation, dead join.
--
--   The values are NOT hard-coded here. Section 3 reads them off
--   quotations.ref_no and generates the statement, so this file cannot be wrong
--   about a database it has never seen. Section 4 then asserts equality.
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
--
-- APPEND-ONLY IS A CONTRACT, NOT A TRIGGER
--   This table is conceptually append-only: a revision, once written, is never
--   updated and never deleted. That is NOT enforced here with BEFORE UPDATE /
--   BEFORE DELETE triggers, deliberately. Triggers on shared hosting need
--   privileges this project has not established, they are awkward to inspect
--   and reverse, and a trigger that refuses a DELETE would also refuse the
--   Baseline / Delete Policy round its own decisions. The contract is stated
--   here; the writer round enforces it by there being exactly one INSERT and no
--   UPDATE or DELETE in the code.
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

-- 1a · Does quotation_revisions already exist?
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION, CREATE_TIME
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = DATABASE()
  AND  TABLE_NAME   = 'quotation_revisions';

-- 1b · THE CONFORMANCE GATE — the one check CREATE TABLE IF NOT EXISTS cannot
--      make for you.
--
--      IF NOT EXISTS protects an existing table from being replaced. It does
--      NOT tell you whether the table that is there is the RIGHT ONE. Run it
--      against a quotation_revisions built by hand, or by an older draft of
--      this file, or by something else entirely, and it will succeed, change
--      nothing, and leave you believing the schema below is what you have.
--      That is a silent pass over a wrong schema, and this query is what stops
--      it.
--
--      CONFORMS means THE TABLE IS ALREADY IN THE COMPLETE AUTHORITATIVE
--      FINAL STATE — not "section 2's CREATE looks about right". It compares
--      every expected column by name, TYPE, nullability, EXTRA and
--      COLUMN_DEFAULT; every expected index by name, uniqueness and column
--      list and order; counts anything unexpected as well as anything missing;
--      and checks quotation_ref_no against quotations.ref_no on COLUMN_TYPE,
--      CHARACTER_SET_NAME and COLLATION_NAME.
--
--      COLUMN_DEFAULT is in there deliberately. snapshot_schema_version must
--      have NO default, and a table that is correct in every other respect but
--      carries DEFAULT 1 is a different contract: it would let a future
--      snapshot format be stored silently under the old version number. That
--      one difference alone reads NO-GO.
--
--      The charset and collation are read from quotations.ref_no at run time.
--      Nothing here hard-codes them, so CONFORMS cannot be true while
--      section 4a says MISMATCH — both ask the same live question.
--
--      ABSENT   → section 2 will create it. Proceed.
--      CONFORMS → the right table is already there. Section 2 is a no-op and
--                 re-running the file is safe.
--      NO-GO    → STOP. Do not run section 2; it would do nothing and you
--                 would carry on believing it had worked. Inspect with 1c and
--                 decide by hand.
--
--      Note on EXTRA for created_at: MySQL reports DEFAULT_GENERATED for a
--      column with DEFAULT CURRENT_TIMESTAMP from 8.0.13 onward. Production is
--      8.0.46. On anything older this reads NO-GO for that one column, which
--      is a version signal rather than a schema fault — check the engine
--      version printed above before acting on it.
-- >>> CONFORMANCE BEGIN
SELECT CASE
         WHEN present = 0 THEN 'ABSENT — section 2 will create it'
         WHEN ref_authority = 0
           THEN 'NO-GO — quotations.ref_no was not found, so the authoritative type, charset and collation for quotation_ref_no cannot be read. Do NOT run section 2.'
         WHEN bad_cols = 0 AND extra_cols = 0 AND bad_idx = 0 AND extra_idx = 0 AND bad_ref = 0
           THEN 'CONFORMS — the expected table is already there; re-running is safe'
         ELSE CONCAT('NO-GO — an existing quotation_revisions does not match: ',
                     bad_cols,   ' wrong or missing column(s), ',
                     extra_cols, ' unexpected column(s), ',
                     bad_idx,    ' wrong or missing index(es), ',
                     extra_idx,  ' unexpected index(es), ',
                     bad_ref,    ' quotation_ref_no mismatch(es) against quotations.ref_no.',
                     ' Do NOT run section 2.')
       END AS conformance
FROM (
  SELECT
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_revisions') AS present,
    /* The authority for quotation_ref_no is the live quotations.ref_no. If it
       cannot be read, nothing below can be judged and the answer is NO-GO
       rather than a CONFORMS reached by comparing against nothing. */
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations'
        AND COLUMN_NAME = 'ref_no') AS ref_authority,
    (SELECT COUNT(*) FROM (
        SELECT 'id' AS col, 'bigint unsigned' AS typ, 'NO' AS nul,
               'auto_increment' AS ext, CAST(NULL AS CHAR(64)) AS def
        UNION ALL SELECT 'quotation_id',            'int unsigned',      'NO',  '', NULL
        UNION ALL SELECT 'revision_no',             'int unsigned',      'NO',  '', NULL
        /* The expected TYPE of quotation_ref_no is read from quotations.ref_no,
           never hard-coded. Its charset and collation are checked by bad_ref. */
        UNION ALL SELECT 'quotation_ref_no',
                         (SELECT LOWER(COLUMN_TYPE) FROM information_schema.COLUMNS
                           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations'
                             AND COLUMN_NAME = 'ref_no'),
                                                    'NO',  '', NULL
        UNION ALL SELECT 'event_type',              'varchar(32)',       'NO',  '', NULL
        UNION ALL SELECT 'actor_user_id',           'int unsigned',      'YES', '', NULL
        UNION ALL SELECT 'actor_username',          'varchar(64)',       'YES', '', NULL
        UNION ALL SELECT 'actor_display_name',      'varchar(100)',      'YES', '', NULL
        /* NO DEFAULT is part of the contract, not a detail: a default would let
           a future snapshot format be stored silently under the old version
           number. COLUMN_DEFAULT must be NULL, and <=> is what compares it. */
        UNION ALL SELECT 'snapshot_schema_version', 'smallint unsigned', 'NO',  '', NULL
        UNION ALL SELECT 'snapshot_json',           'json',              'NO',  '', NULL
        /* DATETIME, defaulting to CURRENT_TIMESTAMP. A TIMESTAMP here is a
           different contract — it stops in 2038 and shifts with the session
           time zone — and reads NO-GO. */
        UNION ALL SELECT 'created_at',              'datetime',          'NO',
                         'DEFAULT_GENERATED', 'CURRENT_TIMESTAMP'
      ) e
      LEFT JOIN information_schema.COLUMNS c
             ON c.TABLE_SCHEMA = DATABASE()
            AND c.TABLE_NAME   = 'quotation_revisions'
            AND c.COLUMN_NAME  = e.col
      WHERE (SELECT COUNT(*) FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_revisions') > 0
        AND (c.COLUMN_NAME IS NULL
          OR NOT (LOWER(c.COLUMN_TYPE)      <=> e.typ)
          OR NOT (c.IS_NULLABLE             <=> e.nul)
          OR NOT (c.EXTRA                   <=> e.ext)
          OR NOT (UPPER(c.COLUMN_DEFAULT)   <=> e.def))) AS bad_cols,
    (SELECT COUNT(*) FROM information_schema.COLUMNS c
      WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'quotation_revisions'
        AND c.COLUMN_NAME NOT IN ('id','quotation_id','revision_no','quotation_ref_no',
                                  'event_type','actor_user_id','actor_username',
                                  'actor_display_name','snapshot_schema_version',
                                  'snapshot_json','created_at')) AS extra_cols,
    /* The authoritative final state of the one column compared across tables.
       Read dynamically from quotations.ref_no — this file states no charset and
       no collation of its own, so it cannot be wrong about a database it has
       never seen. */
    (SELECT COUNT(*) FROM information_schema.COLUMNS r
       JOIN information_schema.COLUMNS q
         ON  q.TABLE_SCHEMA = DATABASE()
         AND q.TABLE_NAME   = 'quotations'
         AND q.COLUMN_NAME  = 'ref_no'
      WHERE r.TABLE_SCHEMA = DATABASE()
        AND r.TABLE_NAME   = 'quotation_revisions'
        AND r.COLUMN_NAME  = 'quotation_ref_no'
        AND NOT (r.COLUMN_TYPE         <=> q.COLUMN_TYPE
             AND r.CHARACTER_SET_NAME  <=> q.CHARACTER_SET_NAME
             AND r.COLLATION_NAME      <=> q.COLLATION_NAME)) AS bad_ref,
    (SELECT COUNT(*) FROM (
        SELECT 'PRIMARY' AS idx, 0 AS nu, 'id' AS cols
        UNION ALL SELECT 'uq_quotation_revisions_no',       0, 'quotation_id,revision_no'
        UNION ALL SELECT 'idx_quotation_revisions_ref',     1, 'quotation_ref_no'
        UNION ALL SELECT 'idx_quotation_revisions_actor',   1, 'actor_user_id'
        UNION ALL SELECT 'idx_quotation_revisions_created', 1, 'created_at'
      ) e
      LEFT JOIN (SELECT INDEX_NAME,
                        MIN(NON_UNIQUE) AS nu,
                        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
                 FROM   information_schema.STATISTICS
                 WHERE  TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_revisions'
                 GROUP  BY INDEX_NAME) s ON s.INDEX_NAME = e.idx
      WHERE (SELECT COUNT(*) FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_revisions') > 0
        AND (s.INDEX_NAME IS NULL OR s.nu <> e.nu OR s.cols <> e.cols)) AS bad_idx,
    /* Anything not in the accepted five, INCLUDING a standalone index on
       quotation_id, which the UNIQUE already covers as its leftmost column. */
    (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_revisions'
        AND INDEX_NAME NOT IN ('PRIMARY','uq_quotation_revisions_no',
                               'idx_quotation_revisions_ref','idx_quotation_revisions_actor',
                               'idx_quotation_revisions_created')) AS extra_idx
) q;
-- <<< CONFORMANCE END

-- 1c · Only if 1b said NO-GO, or you want to see it in full.
--      SHOW CREATE TABLE quotation_revisions;

-- 1d · The types this table has to match. Section 2 states them explicitly, so
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

-- 1e · The database's own defaults, for reference. Section 2 inherits these;
--      section 3 then overrides the one column that must not.
SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM   information_schema.SCHEMATA
WHERE  SCHEMA_NAME = DATABASE();

-- ── GATE ─────────────────────────────────────────────────────────────────────
--   Proceed to section 2 only if 1b said ABSENT.
--   If it said CONFORMS, the table is already correct and nothing needs doing.
--   If it said NO-GO, STOP.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · CREATE TABLE — run only after section 1 has been read.
--
--   The BEGIN/END markers below are load-bearing: tests/php/revision_storage.test.php
--   lifts exactly this block out of this file and executes it, so the test
--   proves the shipped migration rather than a copy of it. Do not remove them.
--
--   This is where the definition of record lives. It is NOT the finished state:
--   section 3 still has to align one collation.
-- ═════════════════════════════════════════════════════════════════════════════

-- >>> SECTION 2 BEGIN
CREATE TABLE IF NOT EXISTS quotation_revisions (
  -- The revision row's own identity. Never reused, never reordered.
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- LOGICAL reference to quotations.id. Deliberately not a foreign key; see
  -- the header. int unsigned matches quotations.id as observed in section 1d.
  quotation_id             INT UNSIGNED    NOT NULL,

  -- Monotonically increasing PER QUOTATION, starting at 1. The writer round
  -- allocates it; this table only guarantees it is never duplicated within one
  -- quotation, which is what UNIQUE below is for.
  revision_no              INT UNSIGNED    NOT NULL,

  -- The quotation number as it was AT THAT REVISION. A lookup aid, and the
  -- reason a revision still names its quotation after the row is deleted.
  -- Length matches quotations.ref_no. Its CHARACTER SET and COLLATION are set
  -- by section 3, which reads them off quotations.ref_no — they are not
  -- guessed here and the value this inherits from the database default is not
  -- the final state.
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
-- <<< SECTION 2 END


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · ALIGN THE COLLATION — REQUIRED. Not optional, not conditional.
--
--   quotation_ref_no is the one column compared across tables, and MySQL
--   refuses to compare columns whose collations differ. Section 2 left it on
--   the database default; this makes it match quotations.ref_no.
--
--   The statement is GENERATED from the column it has to match, so nobody
--   hand-types a charset and this file cannot be wrong about a database it has
--   never seen — the same discipline the NOT NULL(ref_no) migration used.
--
--   It is UNCONDITIONAL by design. When the collations already agree it sets
--   them to what they already are, which is a harmless no-op, and that is
--   better than a branch an operator has to decide about at 11pm.
-- ═════════════════════════════════════════════════════════════════════════════

-- 3a · Generate it. RUN WHAT THIS PRINTS.
-- >>> SECTION 3 GENERATE BEGIN
SELECT CONCAT('ALTER TABLE quotation_revisions MODIFY quotation_ref_no ',
              r.COLUMN_TYPE,
              ' CHARACTER SET ', q.CHARACTER_SET_NAME,
              ' COLLATE ',       q.COLLATION_NAME,
              ' NOT NULL;') AS run_this
FROM   information_schema.COLUMNS q
JOIN   information_schema.COLUMNS r
       ON  r.TABLE_SCHEMA = q.TABLE_SCHEMA
       AND r.TABLE_NAME   = 'quotation_revisions'
       AND r.COLUMN_NAME  = 'quotation_ref_no'
WHERE  q.TABLE_SCHEMA = DATABASE()
  AND  q.TABLE_NAME   = 'quotations'
  AND  q.COLUMN_NAME  = 'ref_no';
-- <<< SECTION 3 GENERATE END
--   The type comes from the column as it exists, so this changes collation and
--   nothing else.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · VERIFY AND GATE — READ-ONLY. Run after sections 2 and 3.
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

SELECT COUNT(*) AS rows_now FROM quotation_revisions;
--   EXPECT 0 on a first run. This migration records no history and backfills
--   none. On a re-run it is whatever the writer has since put there, and this
--   file must not change it.

-- 4a · THE COLLATION GATE. This is the authoritative post-migration state.
-- >>> SECTION 4 GATE BEGIN
SELECT CASE
         WHEN q.COLUMN_TYPE = r.COLUMN_TYPE
          AND q.CHARACTER_SET_NAME = r.CHARACTER_SET_NAME
          AND q.COLLATION_NAME     = r.COLLATION_NAME
           THEN CONCAT('MATCH — quotation_ref_no is ', r.COLUMN_TYPE, ' ',
                       r.CHARACTER_SET_NAME, ' / ', r.COLLATION_NAME,
                       ', the same as quotations.ref_no. Migration complete.')
         ELSE CONCAT('NO-GO — quotation_ref_no is ', r.COLUMN_TYPE, ' ',
                     r.CHARACTER_SET_NAME, ' / ', r.COLLATION_NAME,
                     ' but quotations.ref_no is ', q.COLUMN_TYPE, ' ',
                     q.CHARACTER_SET_NAME, ' / ', q.COLLATION_NAME,
                     '. Run section 3 (again) before calling this done.')
       END AS collation_gate
FROM   information_schema.COLUMNS q
JOIN   information_schema.COLUMNS r
       ON  r.TABLE_SCHEMA = q.TABLE_SCHEMA
       AND r.TABLE_NAME   = 'quotation_revisions'
       AND r.COLUMN_NAME  = 'quotation_ref_no'
WHERE  q.TABLE_SCHEMA = DATABASE()
  AND  q.TABLE_NAME   = 'quotations'
  AND  q.COLUMN_NAME  = 'ref_no';
-- <<< SECTION 4 GATE END

-- 4b · Re-run the conformance query from section 1b. After a complete
--      migration it must read CONFORMS.

-- 4c · Prove this migration touched nothing else. Compare against what you
--      recorded in section 1d.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  ((TABLE_NAME = 'quotations' AND COLUMN_NAME IN ('id', 'ref_no'))
    OR  (TABLE_NAME = 'app_users'  AND COLUMN_NAME IN ('id', 'username', 'display_name')));


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 5 · RE-RUNNING THIS FILE
-- ═════════════════════════════════════════════════════════════════════════════
--   Section 2 is CREATE TABLE IF NOT EXISTS and section 3 sets a collation to
--   what it should already be, so running the whole file twice creates the
--   table once, re-applies an identical column definition, and changes no row.
--
--   IF NOT EXISTS is a seatbelt, not a substitute for section 1b. It stops this
--   from destroying an existing table, but on its own it would also silently do
--   nothing against a WRONG table and leave you believing the schema above is
--   what you have. 1b is the check that tells you the truth; 4a and 4b confirm
--   it afterwards.
--
--   NOTHING HERE WRITES A ROW. There is no INSERT in this file, and there is no
--   code anywhere in the application that writes to quotation_revisions — the
--   Snapshot Revision Writer round does not exist yet.


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 6 · ROLLBACK — explicit, and NOT run as part of normal execution.
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
