#!/usr/bin/env bash
# =============================================================================
#  Continuance Finance — Deploy Script (Docker Compose v2)
#  Usage:
#    ./deploy.sh              # Standard redeploy (pull → build → migrate → up)
#    ./deploy.sh --no-cache   # Force a clean image build (ignores layer cache)
#    ./deploy.sh --fresh      # ⚠ Destroys DB volume — full reset (use with care)
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RESET="\033[0m"
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
DIM="\033[2m"

# ── Flags ────────────────────────────────────────────────────────────────────
NO_CACHE=false
FRESH=false

for arg in "$@"; do
  case $arg in
    --no-cache) NO_CACHE=true ;;
    --fresh)    FRESH=true ;;
    --help|-h)
      echo "Usage: $0 [--no-cache] [--fresh]"
      echo ""
      echo "  --no-cache   Rebuilds Docker images from scratch (ignores layer cache)"
      echo "  --fresh      ⚠  Destroys the PostgreSQL volume — all data will be lost"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown flag: $arg${RESET}"
      exit 1
      ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
step()    { echo -e "\n${CYAN}${BOLD}▶ $1${RESET}"; }
ok()      { echo -e "${GREEN}✓ $1${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $1${RESET}"; }
fail()    { echo -e "${RED}✗ $1${RESET}"; exit 1; }
divider() { echo -e "${DIM}─────────────────────────────────────────────────${RESET}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${CYAN}   Continuance Finance — Deploy Script         ${RESET}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════${RESET}"
echo ""

# ── Preflight checks ─────────────────────────────────────────────────────────
step "Preflight checks"

if [ ! -f "docker-compose.yml" ]; then
  fail "Run this script from the repo root (docker-compose.yml not found)."
fi

if [ ! -f ".env" ]; then
  warn ".env file not found."
  echo -e "${DIM}Run ${BOLD}./setup.sh${RESET}${DIM} first to create one, then re-run this script.${RESET}"
  fail "Cannot proceed without .env"
fi
ok ".env present"

if ! command -v docker &>/dev/null; then
  fail "Docker is not installed or not in PATH."
fi

if ! docker compose version &>/dev/null; then
  fail "Docker Compose v2 plugin not found. Update Docker: https://docs.docker.com/compose/install/"
fi

DOCKER_VER=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
ok "Docker ${DOCKER_VER} + Compose v${COMPOSE_VER}"

# ── Fresh volume warning ──────────────────────────────────────────────────────
if $FRESH; then
  echo ""
  echo -e "${RED}${BOLD}  ⚠  WARNING: --fresh will permanently destroy the PostgreSQL data volume.${RESET}"
  echo -e "${RED}     All database data (users, rules, ledger, assets) will be DELETED.${RESET}"
  echo ""
  read -rp "  Type 'yes-delete-everything' to confirm: " CONFIRM
  if [ "$CONFIRM" != "yes-delete-everything" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# ── Step 1: Pull latest ───────────────────────────────────────────────────────
step "Pulling latest from GitHub (origin/main)"
git fetch origin
git reset --hard origin/main
ok "$(git log -1 --format='%h — %s (%cr)')"

# ── Step 2: Stop and remove containers ───────────────────────────────────────
step "Stopping existing containers"
if $FRESH; then
  docker compose down --volumes --remove-orphans
  warn "Database volume destroyed (--fresh)"
else
  docker compose down --remove-orphans
  ok "Containers stopped, data volume preserved"
fi

# ── Step 3: Reclaim disk space ────────────────────────────────────────────────
step "Pruning unused Docker objects (build cache, dangling images)"
docker image prune -f
docker builder prune -f
ok "Docker cache cleared"

# Show available disk so it's visible in the deploy log
DISK_FREE=$(df -h / | awk 'NR==2 {print $4}')
ok "Disk free: ${DISK_FREE}"

# ── Step 4: Build images ──────────────────────────────────────────────────────
# BuildKit is on by default in Compose v2 — faster, better caching, parallel builds.
step "Building images"
BUILD_ARGS=""
if $NO_CACHE; then
  BUILD_ARGS="--no-cache"
  warn "Cache disabled — full rebuild"
fi

# shellcheck disable=SC2086
docker compose build --pull $BUILD_ARGS
ok "Images built"

# ── Step 5: Start all services and wait for healthchecks ─────────────────────
# --force-recreate ensures containers are replaced even if the image tag hasn't changed.
# --wait blocks until every service with a healthcheck reports healthy (or times out).
# Compose v2 dependency ordering (depends_on: condition: service_healthy) ensures:
#   db becomes healthy → backend starts → runs alembic upgrade head → becomes healthy
step "Starting services (waiting for healthchecks)"
docker compose up -d --force-recreate --wait
ok "All services healthy"

# ── Step 6: Confirm migrations ran ───────────────────────────────────────────
step "Migration log (backend startup)"
divider
docker compose logs backend 2>&1 \
  | grep -E "(Running upgrade|INFO \[alembic|alembic\.runtime|Seed complete|Database ready|ERROR|Traceback)" \
  | tail -20 \
  || echo -e "${DIM}  (no alembic lines captured — migrations may have run on a prior start)${RESET}"
divider

# ── Step 7: Final status ──────────────────────────────────────────────────────
step "Container status"
docker compose ps

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}   ✓  Deploy complete!${RESET}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Frontend  →  ${BOLD}http://localhost:3000${RESET}"
echo -e "  API       →  ${BOLD}http://localhost:8000${RESET}"
echo -e "  API Docs  →  ${BOLD}http://localhost:8000/docs${RESET}"
echo -e "  pgAdmin   →  ${BOLD}http://localhost:5050${RESET}"
echo ""
echo -e "${DIM}  Tail logs:  docker compose logs -f backend${RESET}"
echo -e "${DIM}  Shell in:   docker compose exec backend bash${RESET}"
echo ""
