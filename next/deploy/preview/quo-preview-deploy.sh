#!/bin/sh
# ════════════════════════════════════════════════════════════════════════════
#  QUOTATION NEXT — PREVIEW DEPLOY (Office side)
#
#  PREVIEW ONLY. Every run needs the owner's preview-deploy authorisation;
#  production is denied (DENY_HOSTS / DENY_PATHS) before anything else runs.
#  First used for Preview #1 (93bd869); see
#  docs/quotation-next/PREVIEW-DEPLOYMENT-READINESS.md.
#
#  sh next/deploy/preview/quo-preview-deploy.sh --sha <40-hex> [--dry-run]
#
#  1. refuses unless the checkout is clean and origin's branch is exactly --sha
#  2. builds the artefact OFF-server (scripts/build-release.sh): vendor/ and
#     public/build/ included — the server needs no Node and no Composer
#  3. resolves the remote base to an ABSOLUTE path here (scp never sees a
#     literal `$HOME`), re-checks it against the production denylist, and
#     uploads artefact + checksum + scripts into a fresh mode-700 run dir
#  4. runs the server script: precheck → extract → link shared .env/storage →
#     755/644 → caches → verify → atomically switch `current` → /health
#  --dry-run builds the artefact and makes READ-ONLY SSH probes (remote $HOME,
#  the state of `current`), then prints the plan; nothing is uploaded.
#  Rollback: quo-preview-server.sh rollback (repoints `current` at the previous
#  release; nothing is deleted).
#
#  POSIX sh only: no process substitution (ServerFreak CageFS has no /dev/fd),
#  no rsync. Never touches quo.dnchardware.com, any production docroot, any
#  database, DNS or cron. Runs no migration.
# ════════════════════════════════════════════════════════════════════════════
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
NEXT=$(cd "$HERE/../.." && pwd)
. "$HERE/quo-preview.conf"
. "$HERE/quo-preview-lib.sh"

SHA=""; DRY=0
while [ $# -gt 0 ]; do
    case "$1" in
        --sha) SHA=$2; shift 2 ;;
        --dry-run) DRY=1; shift ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done
printf '%s' "$SHA" | grep -Eq '^[0-9a-f]{40}$' || { echo "FATAL: --sha <40-hex> required" >&2; exit 2; }

# ── production deny, before anything else ──────────────────────────────────
qp_deny_check "$PREVIEW_HOST" "$PREVIEW_BASE" "$PREVIEW_DOCROOT_LINK" || exit 3

# ── exact commit ───────────────────────────────────────────────────────────
[ -z "$(git -C "$NEXT" status --porcelain)" ] || { echo "FATAL: working tree not clean" >&2; exit 4; }
[ "$(git -C "$NEXT" rev-parse HEAD)" = "$SHA" ] || { echo "FATAL: HEAD is not $SHA — check out the approved commit" >&2; exit 4; }
git -C "$NEXT" fetch -q origin
git -C "$NEXT" branch -r --contains "$SHA" | grep -q . || { echo "FATAL: $SHA is not on any origin branch" >&2; exit 4; }

# ── build off-server ───────────────────────────────────────────────────────
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT INT TERM
sh "$NEXT/scripts/build-release.sh" "$OUT"
SHORT=$(printf '%s' "$SHA" | cut -c1-12)
TAR="$OUT/quotation-next-$SHORT.tar.gz"
test -f "$TAR" && test -f "$TAR.sha256"

RUN="run-$(date -u +%Y%m%dT%H%M%SZ)-$SHORT"
echo "run id: $RUN"

# ── resolve the remote base to an absolute path (read-only probe) ──────────
RHOME=$(ssh -o BatchMode=yes "$PREVIEW_SSH" 'echo "$HOME"') || { echo "FATAL: cannot read the remote home over SSH" >&2; exit 5; }
RBASE=$(qp_resolve_base "$PREVIEW_BASE" "$RHOME") || exit 5
qp_deny_check "$PREVIEW_HOST" "$RBASE" || exit 3
SLOT=$({ cat "$HERE/quo-preview-lib.sh"; echo "qp_classify_current $RBASE"; } | ssh -o BatchMode=yes "$PREVIEW_SSH" sh -s) || SLOT=unknown
echo "remote base: $RBASE  (current: $SLOT)"
case "$SLOT" in
    symlink | absent | known-stub) ;;
    *) echo "FATAL: $RBASE/current is a real directory with unexpected content — inspect it by hand; nothing was uploaded" >&2; exit 6 ;;
esac
DEST="$RBASE/runs/$RUN"
if [ "$DRY" = 1 ]; then
    echo "DRY RUN: built $TAR; nothing uploaded."
    echo "  would upload to: $PREVIEW_SSH:$DEST/"
    echo "  would run:       sh $DEST/quo-preview-server.sh deploy $RUN $SHA"
    exit 0
fi

# ── upload (no secrets travel) and run the server script ───────────────────
ssh -o BatchMode=yes "$PREVIEW_SSH" "umask 077; mkdir -p '$DEST'"
scp -q "$TAR" "$TAR.sha256" "$HERE/quo-preview-server.sh" "$HERE/quo-preview-lib.sh" "$HERE/quo-preview.conf" "$PREVIEW_SSH:$DEST/"
ssh -o BatchMode=yes "$PREVIEW_SSH" "sh '$DEST/quo-preview-server.sh' deploy '$RUN' '$SHA'"
echo "Preview candidate deployed. Owner smoke: https://$PREVIEW_HOST/"
echo "Rollback: ssh $PREVIEW_SSH 'sh $DEST/quo-preview-server.sh rollback $RUN'"
