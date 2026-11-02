# Quotation same-origin pilot — `https://portal.dnchardware.com/quo`

**Nothing here has been done on the server.** These are the owner's cPanel steps for the pilot.

## Why

The installed DNC Workspace app is `portal.dnchardware.com` with `scope: "/"`. When it opens `quo.dnchardware.com`,
Chromium treats that origin as out of scope and draws its own toolbar over the page. The same Quotation files, served
as a real directory at `portal.dnchardware.com/quo/`, stay inside that scope: no toolbar.

`quo.dnchardware.com` stays exactly as it is. The pilot is a **second, separate copy** of this branch's files. The
direct deployment, its `.cpanel.yml` target and its version stamp are not touched.

## What the code does (this branch)

| Concern | Direct `quo.dnchardware.com` | Mounted `portal.dnchardware.com/quo` |
| --- | --- | --- |
| Base path (`dc_base_path()`, from `SCRIPT_NAME`) | `''` | `/quo` |
| Redirects (`dc_url()`): home, sign-in, `next` | `/`, `/login.php`, any same-site path | `/quo/`, `/quo/login.php`, `next` kept inside `/quo` |
| Handoff routes (`dc_app_path()`) | `/auth/handoff/start`, `/callback` | `/quo/auth/handoff/start`, `/callback` (same handler) |
| Handoff authorize request | unchanged | adds `mount=portal` → Portal sends the token to `/quo/auth/handoff/callback` |
| Quotation manifest | linked | **not linked** (the Portal is the installed app) |
| Icons, `api.php`, `ai_extract.php`, forms | relative | relative (resolve under `/quo/`) |
| Session cookie | `__Host-DCQUOSESS` on `quo.dnchardware.com` | `__Host-DCQUOSESS` on `portal.dnchardware.com`, `Path=/` (forced by `__Host-`) — a **separate** session, also sent to the Portal's own requests, which ignore it |
| Browser storage (language, unsaved draft) | quo origin | Portal origin — a draft started on one is not offered on the other |

Both copies:

- **CSRF** (`docs/audit/2026-10-20-csrf-design.md`, layers 1 and 2). Every write in `api.php` must be a same-origin
  JSON `POST` with this session's `X-DC-CSRF` token. Refusals are 405, 415 or 403 `{"error":"csrf"}`, returned before
  the database is opened. `ai_extract.php` (multipart), `login.php` and `logout.php` check the token too.
  `logout.php` no longer signs out on a plain GET: the Sign Out links post the token. A GET shows a single Sign Out
  button. The handoff endpoints are **not** gated: the callback is a top-level GET from the Portal, and it is
  protected by its own signed token, bound to a state this session created.
- **CORS:** `Access-Control-Allow-Origin: *` has been removed from `api.php`. Nothing depended on it.
- **Rate limit:** the handoff limit still keys on `REMOTE_ADDR`. With a real directory there is no proxy, so this is
  unchanged. It becomes a concern only if this is ever reverse-proxied.
- **Cache:** a tab opened before the deploy has no token. Its next write is refused with "This page has expired.
  Please reload it and try again." Nothing is written, and a reload fixes it.

## Portal side (dnc-portal `round/quo-same-origin-handoff`)

`config/workspace.php` gains `systems.quotation.handoff.mount_url` = `WORKSPACE_QUOTATION_MOUNT_URL`, which is unset by
default (no mount). `mount=portal` selects it. Any other value is refused. The launcher card is unchanged and still
points at `quo.dnchardware.com`.

## cPanel steps (owner)

Run these in cPanel → Terminal as `dnchardw`. Every step only adds files. Stop at any check that fails.

```sh
# 0. Names. QUO_CLONE is the Quotation repository path shown in cPanel → Git Version Control.
QUO_CLONE=<path from Git Version Control>
COMMIT=<the Quotation pilot commit>
MOUNT=/home5/dnchardw/quo-portal-mount
PORTAL=/home5/dnchardw/repositories/dnc-portal
LIVE=/home5/dnchardw/quo.dnchardware.com

# 1. Fetch the commit (does not deploy anything)
git -C "$QUO_CLONE" fetch origin
git -C "$QUO_CLONE" cat-file -e "$COMMIT^{commit}" && echo "commit present"

# 2. The pilot copy: application files only, from that commit, into a NEW directory
test ! -e "$MOUNT" || { echo "STOP: $MOUNT already exists"; }
mkdir "$MOUNT"
git -C "$QUO_CLONE" archive "$COMMIT" index.php api.php companies.php ai_extract.php pricing_history.php \
    auth.php login.php logout.php handoff.php dnc_handoff.php version.php manifest.webmanifest \
    app/Handoff/Contract assets/icons | tar -x -C "$MOUNT"

# 3. Server-only settings: COPIED from the live site (same database, same handoff secret, same AI key)
cp -p "$LIVE/db.php" "$LIVE/ai_config.php" "$LIVE/dnc_config.php" "$MOUNT/"
cp -p "$LIVE/.htaccess" "$MOUNT/.htaccess"
#    The copied .htaccess must contain the handoff rule and nothing tied to the quo host:
grep -n 'RewriteRule ^auth/handoff/(start|callback)$ handoff.php' "$MOUNT/.htaccess"     # must print 1 line
grep -n -i -E 'quo\.dnchardware|HTTP_HOST|RewriteBase' "$MOUNT/.htaccess"               # must print nothing

# 4. Mount it in the Portal's document root, and keep it out of the Portal's git checks
test ! -e "$PORTAL/public/quo" || { echo "STOP: public/quo already exists"; }
ln -s "$MOUNT" "$PORTAL/public/quo"
echo '/public/quo' >> "$PORTAL/.git/info/exclude"
git -C "$PORTAL" ls-files --others --exclude-standard --directory    # must print nothing (the Portal release precheck needs this)
```

Step 4's exclude line is required. The Portal release precheck (`portal-release.sh`) aborts on any untracked file in
its checkout, and the Portal's document root is that checkout.

5. **Check the mount without signing in:**
   - `https://portal.dnchardware.com/quo/` → Quotation sign-in page, Quotation icons. It must not be the Portal SPA.
   - `https://portal.dnchardware.com/quo/auth/handoff/start` → while the Portal side below is not deployed yet: a
     303 to the Portal. With the Portal's mount unset, that ends at `/?handoff=unavailable`.
   - `https://quo.dnchardware.com/` → unchanged.
6. **Portal (for handoff into `/quo`):** release dnc-portal `round/quo-same-origin-handoff` through the normal
   Portal release. Then set, in the Portal's `.env`:

   ```
   WORKSPACE_QUOTATION_MOUNT_URL=https://portal.dnchardware.com/quo
   ```

   Then run `php artisan config:cache` (or whatever the release normally runs). That branch sits on top of
   `round/r5.9-payroll-handoff`, so releasing it releases R5.9 too.
7. **Owner smoke, from the installed DNC Workspace app:** open `portal.dnchardware.com/quo/auth/handoff/start` (or
   sign in on `/quo/login.php`). Quotation should open inside the same window, with **no Chromium out-of-scope
   toolbar**. Then check: quotation list, new quotation, Quick Add, AI extract, pricing, save, edit, History, print,
   CSV export, Sign Out.

## Rollback

```sh
rm "$PORTAL/public/quo"                                                       # the symlink only — never rm -r
sed -i '\#^/public/quo$#d' "$PORTAL/.git/info/exclude"
```

Then unset `WORKSPACE_QUOTATION_MOUNT_URL` and run `config:cache`. `/quo` goes back to the Portal's catch-all (its
SPA). The launcher never pointed there. `quo.dnchardware.com` was never touched. `$MOUNT` can stay, or the owner can
remove it later.

## Notes

- If `/quo/` answers 403 after step 4, the host is not following the symlink (cPanel's default
  `SymLinksIfOwnerMatch` needs the link and its target to have the same owner). The fallback is the "second
  deployment target" form: `rm "$PORTAL/public/quo"`, then run steps 2–3 with `MOUNT="$PORTAL/public/quo"`, a real
  directory. Keep the exclude line from step 4 either way.

- The mount runs under whatever PHP handler `/quo/.htaccess` (copied from the live site) or the Portal's document root
  selects. Check `PHP_VERSION` once if it matters. The code is written for PHP 8.0–8.4.
- Sessions on the two hosts are separate. Signing out on one does not sign out the other.
- Updating the pilot copy later means repeating step 2 for the new commit, into the same `$MOUNT`, overwriting the
  application files only.
