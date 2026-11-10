# Service API migrations — runbook

Two migrations for `service.php` (see `docs/SERVICE-API.md`). **Neither has
been run on any server.** They have been run only on a local throwaway MySQL
8.4 during tests.

| Migration | Rollback | Creates |
|---|---|---|
| `migrations/2026-11-10-create-service-request-nonces.sql` | `migrations/2026-11-10-create-service-request-nonces.rollback.sql` | `service_request_nonces` |
| `migrations/2026-11-10-create-company-whatsapp-contacts.sql` | `migrations/2026-11-10-create-company-whatsapp-contacts.rollback.sql` | `company_whatsapp_contacts` |

Both only **add a new table**. No existing table, column, index or row is
changed. No foreign key is created. They are independent and may be run in
either order.

## 1. Before anything: the backup that must exist

Running these in production needs the Owner's instruction. Before section 2
of either file is run, all of this must be true:

1. A **full SQL export of the Quotation database** (structure and data, every
   table) taken the same day, after the last business change — phpMyAdmin →
   Export → Custom → all tables → SQL, or `mysqldump --single-transaction
   --routines --triggers <schema>`.
2. The export file has been **downloaded off the server**, its size is
   plausible, and it ends with the dump's completion line (it was not cut
   off). Record its file name and SHA-256 in the round's notes.
3. The export contains `CREATE TABLE` for `companies` and `quotations`.
4. Record, for comparison afterwards:
   `SELECT COUNT(*), MAX(updated_at) FROM companies;` and
   `SELECT COUNT(*), MAX(id) FROM quotations;`

The backup is never stored in the docroot, in Git or in a public folder.

## 2. Running a migration

In phpMyAdmin, with the **Quotation** database selected (the one `db.php`
opens — not the canonical users database):

1. Run **section 1 (preflight)** and read the output. Stop if any "EXPECT"
   is not met.
2. Run **section 2**, exactly the lines between `-- >>> SECTION 2 BEGIN` and
   `-- <<< SECTION 2 END`, as one batch.
   - The guard `SELECT` returns `NULL`: all is well, the table is created (or
     already existed with exactly this shape and is left alone, rows included).
   - The guard fails with **error 1242 "Subquery returns more than 1 row"**:
     a table of that name already exists with a different shape. Nothing was
     created or changed. Stop and report.
3. Run **section 3 (verify)** and compare with the "EXPECT" comments.
4. Re-run the two `SELECT`s of step 1.4. They must be unchanged.

Section 2 is safe to run again.

MySQL 8.0.16 or later is required for the `CHECK` constraints (production was
8.0.46 on 2026-11-10; the preflight shows the version).

## 3. Order relative to deploy and enabling

1. Backup (above).
2. Deploy the code. The service is off: no `service_config.php` exists.
3. Run both migrations.
4. Only then create `service_config.php` and enable (`docs/SERVICE-API.md` §2).

If the service is enabled without the tables it fails closed:
`service_request_nonces` missing → every request is 503;
`company_whatsapp_contacts` missing → only the two contact actions are 503.

## 4. Rollback

The real rollback is the switch: `QQ_SERVICE_ENABLED => 'false'` (or delete
`service_config.php`). The tables are then never read or written and can stay.

To remove the tables as well, switch the service off first, then run the
rollback file(s):

- **Nonces** — loses nothing a person needs.
- **Contacts** — loses every company ↔ WhatsApp link; they exist nowhere
  else. The script refuses (error 1242) to drop a table that still has rows
  until the table has been exported and the line
  `SET @cwc_export_verified := 'YES';` is un-commented.

Neither rollback touches `companies` or any other existing table.

## 5. Housekeeping

Since QQ R1 Loop #6 (Owner-approved), `service.php` prunes nonce rows itself:
on about one accepted request in `QQ_SERVICE_NONCE_PRUNE_EVERY` (default 50)
it runs one bounded statement

```sql
DELETE FROM service_request_nonces WHERE received_at < FROM_UNIXTIME(<now − keep>) ORDER BY received_at LIMIT <batch>;
```

with `keep` = `QQ_SERVICE_NONCE_KEEP_SECONDS` (default 600, never below 240)
and `batch` = `QQ_SERVICE_NONCE_PRUNE_BATCH` (default 500, at most 5000). It
uses the existing `idx_srn_received` index. **No migration, cron job or worker
is needed**, and nothing in sections 1–4 changes. Details and the safety
argument: `docs/SERVICE-API.md` §6.1.

To switch it off, set `QQ_SERVICE_NONCE_PRUNE_EVERY => 0`. Rows may still be
removed by hand at any time (anything older than a few minutes has no
function):

```sql
DELETE FROM service_request_nonces WHERE received_at < NOW() - INTERVAL 1 DAY;
```

Note: the comment block at the top of
`migrations/2026-11-10-create-service-request-nonces.sql` still says the
service never deletes from the table. That text predates Loop #6; the
migration's SQL is unchanged and still correct.
