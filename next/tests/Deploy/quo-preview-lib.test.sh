#!/bin/sh
# Tests for next/deploy/preview/quo-preview-lib.sh and the preview deploy
# scripts' safety properties. POSIX sh; run by tests/Feature/DeployToolingTest.php
# (or directly: sh tests/Deploy/quo-preview-lib.test.sh). Touches only a temp dir.
set -u
# Git Bash on Windows copies on `ln -s` unless told to make real symlinks.
MSYS=${MSYS:+$MSYS }winsymlinks:nativestrict; export MSYS

NEXT=$(cd "$(dirname "$0")/../.." && pwd)
D="$NEXT/deploy/preview"
. "$D/quo-preview.conf"
. "$D/quo-preview-lib.sh"

PASS=0; FAIL=0
ok()   { PASS=$((PASS + 1)); }
bad()  { FAIL=$((FAIL + 1)); echo "FAIL: $*"; }
eq()   { if [ "$1" = "$2" ]; then ok; else bad "$3: expected '$2', got '$1'"; fi; }
fails(){ if "$@" >/dev/null 2>&1; then bad "expected failure: $*"; else ok; fi; }
code() { _want=$1; shift; "$@" >/dev/null 2>&1; _got=$?; eq "$_got" "$_want" "exit code of $*"; }

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT INT TERM

# Symlink checks need a filesystem that makes real symlinks (Linux CI, the
# server, WSL). Windows without Developer Mode cannot: those checks are
# reported as SKIP there, never as passed.
SKIP=0
if ln -s "$T" "$T/.probe" 2>/dev/null && [ -L "$T/.probe" ]; then HAVE_LN=1; else HAVE_LN=0; fi
rm -rf "$T/.probe"
sym() { if [ "$HAVE_LN" = 1 ]; then "$@"; else SKIP=$((SKIP + 1)); fi; }

# ── 9A: remote base resolves to an absolute path before scp ────────────────
eq "$(qp_resolve_base "$PREVIEW_BASE" /home5/dnchardw)" /home5/dnchardw/quo-next-preview 'configured $HOME base'
eq "$(qp_resolve_base '$HOME/quo-next-preview' /home5/dnchardw/)" /home5/dnchardw/quo-next-preview 'home with trailing slash'
eq "$(qp_resolve_base '~/quo-next-preview' /home5/dnchardw)" /home5/dnchardw/quo-next-preview 'tilde base'
eq "$(qp_resolve_base /home5/dnchardw/quo-next-preview/ /ignored)" /home5/dnchardw/quo-next-preview 'absolute base'
case "$(qp_resolve_base "$PREVIEW_BASE" /home5/dnchardw)" in *'$'*) bad 'resolved base still holds a literal $' ;; *) ok ;; esac
fails qp_resolve_base 'quo-next-preview' /home5/dnchardw
fails qp_resolve_base '$HOME/quo-next-preview' 'relative/home'
fails qp_resolve_base '$HOME/quo-next-preview' ''
fails qp_resolve_base '$HOME' /home5/dnchardw
fails qp_resolve_base '$HOME/../etc' /home5/dnchardw
fails qp_resolve_base '$HOME/a b' /home5/dnchardw
fails qp_resolve_base '$HOME/$OTHER' /home5/dnchardw

# the Office script hands scp only the resolved destination
grep -q '^scp .*"\$PREVIEW_SSH:\$DEST/"' "$D/quo-preview-deploy.sh" && ok || bad 'scp destination is not the resolved $DEST'
grep -n '^scp ' "$D/quo-preview-deploy.sh" | grep -q 'PREVIEW_BASE' && bad 'scp still uses the unresolved PREVIEW_BASE' || ok
grep -q 'RBASE=$(qp_resolve_base "$PREVIEW_BASE" "$RHOME")' "$D/quo-preview-deploy.sh" && ok || bad 'deploy script does not resolve the base'
grep -q 'qp_deny_check "$PREVIEW_HOST" "$RBASE"' "$D/quo-preview-deploy.sh" && ok || bad 'resolved base is not re-checked against the denylist'

# ── production deny ────────────────────────────────────────────────────────
code 3 qp_deny_check quo.dnchardware.com /home5/dnchardw/quo-next-preview
code 3 qp_deny_check www.quo.dnchardware.com /home5/dnchardw/quo-next-preview
code 3 qp_deny_check quo-preview.dnchardware.com /home5/dnchardw/quo.dnchardware.com
code 3 qp_deny_check quo-preview.dnchardware.com /home5/dnchardw/quo.dnchardware.com/next
code 3 qp_deny_check quo-preview.dnchardware.com /home5/dnchardw/public_html
code 3 qp_deny_check quo-preview.dnchardware.com /home5/dnchardw/quo-next-preview /home5/dnchardw/public_html/x
code 0 qp_deny_check quo-preview.dnchardware.com /home5/dnchardw/quo-next-preview
code 0 qp_deny_check "$PREVIEW_HOST" "$(qp_resolve_base "$PREVIEW_BASE" /home5/dnchardw)"
grep -q 'qp_deny_check "$PREVIEW_HOST" "$PREVIEW_BASE" "$PREVIEW_DOCROOT_LINK" || exit 3' "$D/quo-preview-deploy.sh" && ok || bad 'deploy script lost its first deny check'
grep -q 'qp_deny_check "${PREVIEW_HOST:-}" "$BASE" || exit 3' "$D/quo-preview-server.sh" && ok || bad 'server script lost its deny check'
grep -q "APP_URL is the PRODUCTION host" "$D/quo-preview-server.sh" && ok || bad 'server script lost the production APP_URL refusal'
grep -qF 'QUOTATION_PRODUCTION_APPROVED=false' "$D/quo-preview-server.sh" && ok || bad 'server script lost the production guard check'

# ── exact SHA (refused before any build or network) ────────────────────────
code 2 sh "$D/quo-preview-deploy.sh" --sha 93bd869 --dry-run
code 2 sh "$D/quo-preview-deploy.sh" --dry-run
code 4 sh "$D/quo-preview-deploy.sh" --sha 0000000000000000000000000000000000000000 --dry-run
grep -q 'RELEASE.json does not name' "$D/quo-preview-server.sh" && ok || bad 'server no longer checks RELEASE.json names the SHA'
grep -q '"sha\\":\\"$SHA\\"' "$D/quo-preview-server.sh" && ok || bad 'server no longer checks /health reports the SHA'

# ── 9B: current/ stub detection ────────────────────────────────────────────
B="$T/base"; mkdir -p "$B/releases/r1/public" "$B/shared"
eq "$(qp_classify_current "$B")" absent 'no current'
symlink_current() {
    ln -s "$B/releases/r1" "$B/current"
    eq "$(qp_classify_current "$B")" symlink 'current symlink'
    rm "$B/current"
}
sym symlink_current

mk_cpanel_stub() {
    mkdir -p "$1/current/public/cgi-bin" "$1/current/public/.well-known/acme-challenge"
    printf '# BEGIN cPanel-generated php ini directives, do not edit\n' > "$1/current/public/.htaccess"
    printf '; cPanel-generated php ini directives, do not edit\n' > "$1/current/public/php.ini"
    printf '; cPanel-generated php ini directives, do not edit\n' > "$1/current/public/.user.ini"
}
mk_cpanel_stub "$B"
eq "$(qp_classify_current "$B")" known-stub 'cPanel docroot stub'
printf 'token-a\n' > "$B/current/public/.well-known/acme-challenge/tokA"
eq "$(qp_classify_current "$B")" known-stub 'stub with an ACME token'
rm -rf "$B/current"
mkdir -p "$B/current/public/.well-known/acme-challenge"
eq "$(qp_classify_current "$B")" known-stub 'AutoSSL-only stub'
rm -rf "$B/current"

unknown_case() {
    rm -rf "$B/current"; mk_cpanel_stub "$B"
    "$@"
    eq "$(qp_classify_current "$B")" unknown "unknown content: $*"
}
unknown_case touch "$B/current/public/index.php"
unknown_case sh -c "printf 'Deny from all\n' > '$B/current/public/.htaccess'"
unknown_case mkdir -p "$B/current/public/.well-known/acme-challenge/nested"
unknown_case touch "$B/current/public/cgi-bin/script.cgi"
sym unknown_case ln -s /etc "$B/current/public/.well-known/acme-challenge/link"
unknown_case mkdir "$B/current/storage"
rm -rf "$B/current"
printf 'x' > "$B/current"
eq "$(qp_classify_current "$B")" unknown 'current is a plain file'
rm -f "$B/current"

# unknown content is never moved
mk_cpanel_stub "$B"; touch "$B/current/public/index.php"
fails qp_park_stub "$B" run-x
[ -d "$B/current" ] && [ -f "$B/current/public/index.php" ] && ok || bad 'unknown current/ was moved'
rm -rf "$B/current"

# known stub: ACME tokens kept (no overwrite), stub moved aside, not deleted
mk_cpanel_stub "$B"
printf 'new\n' > "$B/current/public/.well-known/acme-challenge/tokA"
printf 'other\n' > "$B/current/public/.well-known/acme-challenge/tokB"
mkdir -p "$B/shared/well-known/acme-challenge"; printf 'keep\n' > "$B/shared/well-known/acme-challenge/tokA"
P=$(qp_park_stub "$B" run-1)
eq "$P" "$B/stubs/current.stub-run-1" 'parked path'
[ ! -e "$B/current" ] && ok || bad 'current still present after parking'
[ -f "$B/stubs/current.stub-run-1/public/.htaccess" ] && ok || bad 'stub content was not preserved'
eq "$(cat "$B/shared/well-known/acme-challenge/tokA")" keep 'existing shared token overwritten'
eq "$(cat "$B/shared/well-known/acme-challenge/tokB")" other 'stub token not kept'
mk_cpanel_stub "$B"
fails qp_park_stub "$B" run-1
[ -d "$B/current" ] && ok || bad 'second park with the same tag moved current'
rm -rf "$B/current"

# ── 9C: stable shared ACME path per release ────────────────────────────────
acme_link() {
    qp_link_acme "$B" "$B/releases/r1" && ok || bad 'link_acme failed'
    [ -L "$B/releases/r1/public/.well-known" ] && ok || bad 'release has no .well-known link'
    eq "$(readlink "$B/releases/r1/public/.well-known")" "$B/shared/well-known" 'ACME link target'
    [ -d "$B/releases/r1/public/.well-known/acme-challenge" ] && ok || bad 'acme-challenge not reachable through the release'
    fails qp_link_acme "$B" "$B/releases/r1"
}
sym acme_link
mkdir -p "$B/releases/r2/public/.well-known"
fails qp_link_acme "$B" "$B/releases/r2"
grep -q 'qp_link_acme "$BASE" "$REL"' "$D/quo-preview-server.sh" && ok || bad 'server script does not link the ACME dir'
grep -q 'qp_park_stub "$BASE" "$RUN"' "$D/quo-preview-server.sh" && ok || bad 'server script does not park a known stub'
grep -q 'real directory with unexpected content' "$D/quo-preview-server.sh" && ok || bad 'server script does not stop on unknown current/'

# ── no migrations, no remote Node/Composer, no rsync / process substitution ─
code_only() { grep -v '^[[:space:]]*#' "$1"; }
for f in "$D"/*.sh; do
    if code_only "$f" | grep -Eq 'artisan[[:space:]]+(migrate|db:)'; then bad "$f runs a migration"; else ok; fi
    if code_only "$f" | grep -Eq '<\(|>\('; then bad "$f uses process substitution"; else ok; fi
    if code_only "$f" | grep -Eq '\brsync\b'; then bad "$f uses rsync"; else ok; fi
    if head -1 "$f" | grep -qx '#!/bin/sh'; then ok; else bad "$f is not #!/bin/sh"; fi
done
for f in "$D/quo-preview-server.sh" "$D/quo-preview-lib.sh"; do
    if code_only "$f" | grep -Eq '\b(npm|npx|node|composer)\b'; then bad "$f needs Node/Composer on the server"; else ok; fi
done
if grep -q 'composer install' "$NEXT/scripts/build-release.sh" && grep -q 'npx vite build' "$NEXT/scripts/build-release.sh"; then ok; else bad 'build no longer happens off-server'; fi

echo "passed: $PASS  failed: $FAIL  skipped (no symlinks here): $SKIP"
[ "$FAIL" -eq 0 ] && echo "ALL PASS"
[ "$FAIL" -eq 0 ]
