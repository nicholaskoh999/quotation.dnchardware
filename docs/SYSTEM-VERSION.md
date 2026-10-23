# System version: live deployment metadata (Quotation)

Branch `round/r5-system-version`, based on production `round/r5-c-portal-handoff` at `54cbc82`. Not deployed.

DNC Workspace System Details used to show Quotation's branch and commit from values typed into the Portal's `.env`.
Quotation now reports its own deployed version and the Portal reads it server-side. The contract is shared with
Internal PO's `GET /health/version` (internal-po, `docs/R5.1-SYSTEM-VERSION.md`); the Portal side is on
`round/r5.7-live-system-metadata`.

## Endpoint

`GET https://quo.dnchardware.com/version.php`

This is a plain file in the docroot, so no `.htaccess` rule is needed. The live `.htaccess` is not deployed, and
nothing has to be merged by hand.

**200 OK**, with exactly these six keys:

```json
{
  "system": "Quotation",
  "environment": "production",
  "release": null,
  "branch": "round/r5-system-version",
  "commit": "<40 lowercase hex>",
  "deployed_at": "2026-10-23T16:30:00+08:00"
}
```

- `release` is `null` until a real release tag of the form `quo-r…` points at the deployed commit. No release name is
  ever invented, and other tags (backups, archives) are ignored.
- `commit` is the commit cPanel actually deployed: HEAD of the server-side clone when "Deploy HEAD Commit" ran. It is
  never the remote branch's head.

**503**, when the metadata is missing, malformed, or no longer describes the live files:

```json
{"system": "Quotation", "environment": "production", "error": "deployment_metadata_unavailable"}
```

Both responses:

- answer GET and HEAD only; any other method gets 405 with `Allow: GET, HEAD`;
- send `Content-Type: application/json`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`;
- include **no other file** (not `auth.php`, `db.php` or `dnc_config.php`), so there is no session, no cookie and no
  database access;
- turn any error into the generic 503 (display_errors off, output discarded).

## Where the metadata lives, and who writes it

`~/quotation-deploy/version.json`, beside the docroot (`/home5/dnchardw/quotation-deploy/`), not inside it. The
deployment is the only writer.

`.cpanel.yml` gains three things:

1. **Phase 1 (preflight, before any copy).** It works out the commit (`git rev-parse HEAD`, which must be 40-hex), the
   branch (`git rev-parse --abbrev-ref HEAD`, which must be a real branch, not `HEAD`, with no `..`), the release (a
   `quo-r…` tag pointing at HEAD, or `null`), and the Malaysia-time clock (`TZ=Asia/Kuala_Lumpur date …%:z`). It also
   checks that `sha256sum` exists and that the stamp directory is writable. Any failure aborts **before anything is
   copied**.
2. **`version.php` is added to `APPFILES`.**
3. **Phase 2b (after every copy succeeded).** It hashes every deployed file, keeps the old stamp as
   `version.previous.json`, then writes `version.json.tmp` and `mv`s it into place (atomic).

The stamp also lists the SHA-256 of every file the deploy copied. `version.php` re-hashes the live files on each request
and answers 503 if any differs. The stamp therefore never describes code that is not live:

- **A deploy that failed half-way:** the stamp was not rewritten, so the copied files no longer match it.
- **A later deploy of an older commit whose own `.cpanel.yml` predates the stamp writer:** its files differ, so 503.
- **A hand edit on the server:** 503.

These fingerprints are never part of the response.

## Rollback

A Quotation rollback means pointing the cPanel clone at the older commit (on a branch) and pressing Deploy HEAD
Commit. That deploy rewrites the stamp with the older commit, its branch and its release, so the endpoint and the
Portal follow without any manual edit.

Rolling back to a commit older than this change (such as `54cbc82`) runs that commit's own `.cpanel.yml`, which writes
no stamp. If the copied files differ from the stamped ones, `version.php` answers 503 and the Portal shows Quotation's
deployment as unavailable or stale; it never shows the wrong commit. If they happen to be byte-identical (here: only
`version.php` and `.cpanel.yml` differ), the stamp still describes exactly the code that is live.

## Tests

`php tests/php/system_version.test.php` gives **84 assertions, 0 failed**. Run it on Linux or WSL: it needs bash, git,
GNU date and sha256sum, like the host. It runs the **real `.cpanel.yml` tasks** with only `DEPLOYPATH` and `STAMPDIR`
pointed at a sandbox. It covers:

- the stamp's keys, commit, branch, null release, `+08:00` time and fingerprints, with no `.tmp` left and nothing
  inside the docroot;
- the endpoint over real HTTP (`php -S`): the exact six keys, `Content-Type`, **no cookie**, no-store, nosniff, no leak
  of `db.php` or `dnc_config.php` secrets or of paths, private fingerprints, 405 with `Allow`, and `HEAD`;
- a live file that changed after the stamp gives 503;
- malformed stamps give 503: not JSON, a short commit, an invented release, a branch with `..`, UTC time, no
  fingerprints, a fingerprint outside the docroot, an oversized stamp, and no stamp at all;
- release tags: a non-`quo-r…` tag is ignored, a `quo-r…` tag is used;
- a detached checkout is refused before any copy or stamp change;
- rollback: deploying C2 then C1 restores C1's metadata, and `version.previous.json` is kept.

A mutation check removed the fingerprint comparison: the stale-file case failed, as it should.

The existing suites were run against a local MySQL 8.4 (each creates and drops its own throwaway database). They all
pass except two that fail **identically on production `54cbc82`**:

- `handoff_flow` (1 of 433): the local MySQL has no named time-zone tables.
- `mysqli_compat` (12 of 97): an environmental difference.

Standalone login and the Portal handoff code are untouched.

## Deploy

1. Merge this branch as the owner decides.
2. cPanel: Update from Remote, then Deploy HEAD Commit, as before.
3. Check `https://quo.dnchardware.com/version.php`: it should show this commit, its branch, `release: null` and a
   `+08:00` time.
4. `~/quotation-deploy/version.json` exists; on the first deploy there is no `version.previous.json` yet.

quo-preview is not touched.
