#!/bin/sh
# Build a deployable QUOTATION NEXT release artefact — LOCALLY (Office / CI).
#
#   sh scripts/build-release.sh [outdir]
#
# Produces <outdir>/quotation-next-<shortsha>.tar.gz containing the Laravel
# application with production vendor/ and the built public/build assets, plus
# RELEASE.json naming the exact commit. The target shared host then needs only
# PHP: no Node, no Composer, no git.
#
# Written for /bin/sh: no bash-isms, no process substitution (CageFS on the
# shared host may lack /dev/fd), no rsync (the host has none). It runs on the
# BUILD machine and never contacts a server — uploading is a separate,
# owner-authorised step (docs/quotation-next/PREVIEW-DEPLOYMENT-READINESS.md).
set -eu

HERE=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-"$HERE/../release-out"}
SHA=$(git -C "$HERE" rev-parse HEAD)
SHORT=$(printf '%s' "$SHA" | cut -c1-12)

if [ -n "$(git -C "$HERE" status --porcelain -- .)" ]; then
    echo "FATAL: next/ has uncommitted changes — a release must be an exact commit." >&2
    exit 1
fi

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT INT TERM

# 1. exact tracked files of next/ at HEAD (no local junk, no .env)
git -C "$HERE/.." archive --format=tar "$SHA" next | tar -x -C "$STAGE"
APP="$STAGE/next"

# 2. production PHP dependencies
( cd "$APP" && composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --classmap-authoritative --no-progress )

# 3. frontend assets (Node runs HERE, never on the server)
( cd "$APP" && npm ci --no-audit --no-fund && GIT_SHA="$SHA" node scripts/release-stamp.mjs && npx vite build )
rm -rf "$APP/node_modules"

# 4. strip what a server must not carry
rm -rf "$APP/tests" "$APP/playwright.config.ts" "$APP/phpunit.xml" "$APP/.env.example.local" 2>/dev/null || true
test -f "$APP/public/build/manifest.json" || { echo "FATAL: build manifest missing" >&2; exit 1; }
test -f "$APP/RELEASE.json" || { echo "FATAL: RELEASE.json missing" >&2; exit 1; }
test ! -e "$APP/.env" || { echo "FATAL: an .env leaked into the artefact" >&2; exit 1; }

mkdir -p "$OUT"
TAR="$OUT/quotation-next-$SHORT.tar.gz"
tar -C "$STAGE" -czf "$TAR" next
( cd "$OUT" && sha256sum "$(basename "$TAR")" > "$(basename "$TAR").sha256" )
echo "built $TAR"
cat "$APP/RELEASE.json"
