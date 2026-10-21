#!/bin/sh
# ════════════════════════════════════════════════════════════════════════════
#  QUOTATION NEXT — PREVIEW DEPLOY (server side, ServerFreak)
#  PROPOSED ONLY — NOT EXECUTED.
#
#  sh quo-preview-server.sh deploy   <run-id> <sha>
#  sh quo-preview-server.sh rollback <run-id>
#
#  Layout under $PREVIEW_BASE:
#    releases/<sha12>/   extracted artefact (vendor + public/build included)
#    shared/.env         server-owned, created by hand once (mode 600), never copied
#    shared/storage/     sessions, cache, logs — survives releases
#    current ->          releases/<sha12>   (document root = current/public)
#    runs/<run-id>/      artefact, checksum, record.log
#
#  POSIX sh. No /dev/fd, no process substitution, no rsync, no composer, no
#  npm, no migrate, no DB writes, no DNS/cron/.htaccess edits outside the
#  release. Nothing is ever deleted: rollback repoints `current`.
# ════════════════════════════════════════════════════════════════════════════
set -eu
umask 022

HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/quo-preview.conf"
BASE=$(eval echo "$PREVIEW_BASE")
PHP=$SERVER_PHP
CMD=${1:-}; RUN=${2:-}
LOG="$BASE/runs/$RUN/record.log"
say() { printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG"; }
die() { say "FAIL: $*"; exit 1; }

for p in $DENY_PATHS; do case "$BASE" in "$p"*) echo "FATAL: base $BASE is a denied path" >&2; exit 3;; esac; done

exec 9>"$BASE/.lock"
command -v flock >/dev/null && { flock -n 9 || die "another run holds the lock"; }

case "$CMD" in
deploy)
    SHA=${3:-}; SHORT=$(printf '%s' "$SHA" | cut -c1-12)
    TAR="$BASE/runs/$RUN/quotation-next-$SHORT.tar.gz"
    say "precheck run=$RUN sha=$SHA"
    "$PHP" -r 'exit(version_compare(PHP_VERSION,"8.4.0",">=")?0:1);' || die "CLI PHP < 8.4"
    ( cd "$BASE/runs/$RUN" && sha256sum -c "$(basename "$TAR").sha256" >/dev/null ) || die "checksum mismatch"
    test -f "$BASE/shared/.env" || die "shared/.env missing — create it by hand first (see readiness doc)"
    grep -q '^APP_ENV=production' "$BASE/shared/.env" || grep -q '^APP_ENV=preview' "$BASE/shared/.env" || die "APP_ENV not production/preview"
    grep -q '^APP_DEBUG=false' "$BASE/shared/.env" || die "APP_DEBUG must be false"
    grep -q '^QUOTATION_PRODUCTION_APPROVED=false' "$BASE/shared/.env" || die "production guard must be false on preview"
    grep -Eq '^APP_URL=https://quo\.dnchardware\.com' "$BASE/shared/.env" && die "APP_URL is the PRODUCTION host"
    FREE=$(df -Pm "$BASE" | awk 'NR==2{print $4}'); [ "$FREE" -ge "$MIN_FREE_MB" ] || die "low disk ${FREE}MB"

    REL="$BASE/releases/$SHORT"
    [ ! -e "$REL" ] || die "release $SHORT already exists (deploy a new commit or roll back)"
    mkdir -p "$BASE/releases" "$BASE/shared/storage/framework/sessions" "$BASE/shared/storage/framework/cache/data" \
             "$BASE/shared/storage/framework/views" "$BASE/shared/storage/logs" "$BASE/shared/storage/app/private"
    TMP="$BASE/releases/.incoming-$SHORT"
    mkdir "$TMP"
    tar -xzf "$TAR" -C "$TMP"
    mv "$TMP/next" "$REL" && rmdir "$TMP"
    grep -q "\"sha\": \"$SHA\"" "$REL/RELEASE.json" || die "RELEASE.json does not name $SHA"
    grep -q 'ea-php84' "$REL/public/.htaccess" || die "public/.htaccess lacks the ea-php84 handler (web would fall back to PHP 8.0)"

    rm -rf "$REL/storage"
    ln -s "$BASE/shared/storage" "$REL/storage"
    ln -s "$BASE/shared/.env" "$REL/.env"
    # umask 077 extraction leaves 600/700, which LiteSpeed refuses: normalise.
    find "$REL/public" -type d -exec chmod 755 {} +
    find "$REL/public" -type f -exec chmod 644 {} +
    chmod 755 "$REL"

    ( cd "$REL" && "$PHP" artisan config:cache >/dev/null && "$PHP" artisan route:cache >/dev/null && "$PHP" artisan view:cache >/dev/null ) \
        || die "artisan cache step failed"
    ( cd "$REL" && "$PHP" artisan about --only=environment >/dev/null ) || die "app does not boot"

    PREV=$(readlink "$BASE/current" 2>/dev/null || true)
    printf '%s\n' "$PREV" > "$BASE/runs/$RUN/previous"
    ln -sfn "$REL" "$BASE/current.new" && mv -T "$BASE/current.new" "$BASE/current"
    say "current -> $REL (previous: ${PREV:-none})"

    HOST=$(grep '^APP_URL=' "$BASE/shared/.env" | cut -d= -f2-)
    curl -fsS -m 15 "$HOST/health" | tee -a "$LOG" | grep -q '"app":"up"' || die "/health did not answer app up — run rollback"
    curl -fsS -m 15 "$HOST/health" | grep -q "\"sha\":\"$SHA\"" || die "/health does not report $SHA — run rollback"
    say "STATE: PREVIEW_CANDIDATE / OWNER_SMOKE_OPEN"
    ;;
rollback)
    PREV=$(cat "$BASE/runs/$RUN/previous" 2>/dev/null || true)
    [ -n "$PREV" ] && [ -d "$PREV" ] || die "no previous release recorded for $RUN"
    ln -sfn "$PREV" "$BASE/current.new" && mv -T "$BASE/current.new" "$BASE/current"
    say "ROLLED_BACK current -> $PREV"
    ;;
*) echo "usage: $0 deploy <run-id> <sha> | rollback <run-id>" >&2; exit 2 ;;
esac
