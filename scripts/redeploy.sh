#!/usr/bin/env bash
#
# Redeploy roc_gms_v2 (production) after a `git pull`.
#
# Rebuilds the Next/Payload app image and restarts the web container.
# Postgres and Redis are left running untouched (no volume changes).
#
# Usage:
#   ./scripts/redeploy.sh           # rebuild + restart web
#   ./scripts/redeploy.sh --pull    # git pull first, then rebuild + restart
#   ./scripts/redeploy.sh --all     # recreate every service (still keeps volumes)
#   ./scripts/redeploy.sh --logs    # follow web logs after deploy (Ctrl-C to exit)
#
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
DO_PULL=false
FOLLOW=false
TARGET="app"

for arg in "$@"; do
  case "$arg" in
    --pull) DO_PULL=true ;;
    --logs) FOLLOW=true ;;
    --all)  TARGET="" ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing (needs PAYLOAD_SECRET and POSTGRES_PASSWORD)." >&2
  exit 1
fi

if $DO_PULL; then
  echo "==> git pull"
  git pull --ff-only
fi

echo "==> HEAD: $(git log -1 --format='%h %s')"

# Reminder: prod DB schema is applied by hand (no migration runner).
PENDING_SQL=$(git status --porcelain --untracked-files=all scripts/ | grep -E '\.sql$' || true)
if [[ -n "$PENDING_SQL" ]]; then
  echo "==> NOTE: untracked SQL scripts present — apply manually if not yet run:"
  echo "$PENDING_SQL" | sed 's/^/       /'
fi

echo "==> Building image (webpack build, host network)"
$COMPOSE build $TARGET

echo "==> Restarting container(s)"
$COMPOSE up -d $TARGET

echo "==> Pruning dangling images"
docker image prune -f >/dev/null

echo "==> Status"
$COMPOSE ps

if $FOLLOW; then
  echo "==> Following web logs (Ctrl-C to stop)"
  $COMPOSE logs -f --tail=40 app
else
  echo "==> Recent web logs"
  $COMPOSE logs --tail=40 app
fi
