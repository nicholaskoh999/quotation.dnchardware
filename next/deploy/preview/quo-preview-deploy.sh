#!/bin/sh
# ════════════════════════════════════════════════════════════════════════════
#  QUOTATION NEXT — PREVIEW DEPLOY (Office side)
#
#  PROPOSED ONLY — NOT EXECUTED. Written during the W1 autopilot, never run
#  against a server. The first run requires the owner's separate
#  "QUO PREVIEW DEPLOY #1" instruction and the owner actions listed in
#  docs/quotation-next/PREVIEW-DEPLOYMENT-READINESS.md §H.
#
#  sh next/deploy/preview/quo-preview-deploy.sh --sha <40-hex> [--dry-run]
#
#  1. refuses unless the checkout is clean and origin's branch is exactly --sha
#  2. builds the artefact OFF-server (scripts/build-release.sh): vendor/ and
#     public/build/ included — the server needs no Node and no Composer
#  3. uploads artefact + checksum + server script into a fresh mode-700 run dir
#  4. runs the server script: precheck → extract → link shared .env/storage →
#     755/644 → caches → verify → atomically switch `current` → /health
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
for d in $DENY_HOSTS; do
    case " $PREVIEW_HOST " in *" $d "*) echo "FATAL: $PREVIEW_HOST is a denied (production) host" >&2; exit 3;; esac
done
for p in $DENY_PATHS; do
    case "$PREVIEW_BASE $PREVIEW_DOCROOT_LINK" in *"$p"*) echo "FATAL: target path touches denied $p" >&2; exit 3;; esac
done

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
if [ "$DRY" = 1 ]; then echo "DRY RUN: built $TAR; nothing uploaded."; exit 0; fi

# ── upload (no secrets travel) and run the server script ───────────────────
ssh -o BatchMode=yes "$PREVIEW_SSH" "umask 077; mkdir -p \"$PREVIEW_BASE/runs/$RUN\""
scp -q "$TAR" "$TAR.sha256" "$HERE/quo-preview-server.sh" "$HERE/quo-preview.conf" "$PREVIEW_SSH:$PREVIEW_BASE/runs/$RUN/"
ssh -o BatchMode=yes "$PREVIEW_SSH" "sh \"$PREVIEW_BASE/runs/$RUN/quo-preview-server.sh\" deploy \"$RUN\" \"$SHA\""
echo "Preview candidate deployed. Owner smoke: https://$PREVIEW_HOST/"
echo "Rollback: ssh $PREVIEW_SSH 'sh $PREVIEW_BASE/runs/$RUN/quo-preview-server.sh rollback $RUN'"
