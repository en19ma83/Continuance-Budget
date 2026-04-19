#!/usr/bin/env bash
# =============================================================================
#  Continuance Finance — Deploy Script
#  Usage:
#    ./deploy.sh              # Standard redeploy (pull → rebuild → migrate → up)
#    ./deploy.sh --no-cache   # Same but forces a clean Docker image build
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
      echo "  --no-cache   Rebuilds Docker images from scratch (slower, ensures clean layers)"
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

# Must be run from repo root
if [ ! -f "docker-compose.yml" ]; then
  fail "Run this script from the repo root (docker-compose.yml not found)."
fi

# .env required
if [ ! -f ".env" ]; then
  echo ""
  warn ".env file not found."
  echo -e "${DIM}Run ${BOLD}./setup.sh${RESET}${DIM} first to create one, then re-run this script.${RESET}"
  echo ""
  fail "Cannot proceed without .env"
fi
ok ".env present"

# docker-compose (v1) required
if ! command -v docker &>/dev/null; then
  fail "Docker is not installed or not in PATH."
fi
if ! command -v docker-compose &>/dev/null; then
  fail "docker-compose not found. Install it with: apt-get install docker-compose  OR  pip install docker-compose==1.29.2"
fi
ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') + docker-compose $(docker-compose --version | awk '{print $3}' | tr -d ',') found"


# ── Fresh volume warning ───────────────────────────────────────────────────────
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
ok "Repository up to date: $(git log -1 --format='%h %s')"

# ── Step 2: Stop containers ───────────────────────────────────────────────────
step "Stopping existing containers"
if $FRESH; then
  docker-compose down --volumes --remove-orphans
  warn "Database volume destroyed (--fresh)"
else
  docker-compose down --remove-orphans
  ok "Containers stopped (data volume preserved)"
fi

# ── Step 3: Build images ──────────────────────────────────────────────────────
step "Building Docker images"
BUILD_ARGS=""
if $NO_CACHE; then
  BUILD_ARGS="--no-cache"
  warn "Building without cache — this will take longer"
fi

# shellcheck disable=SC2086
docker-compose build $BUILD_ARGS
ok "Images built"

# ── Step 4: Start database first, wait for health ─────────────────────────────
step "Starting database"
docker-compose up -d db
echo -n "  Waiting for PostgreSQL to be ready"

for i in $(seq 1 30); do
  if docker-compose exec -T db pg_isready -q 2>/dev/null; then
    echo ""
    ok "PostgreSQL is ready"
    break
  fi
  echo -n "."
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo ""
    fail "PostgreSQL did not become ready in 60 seconds."
  fi
done

# ── Step 5: Start all services ───────────────────────────────────────────────
# No --force-recreate needed — docker-compose down already removed all containers.
# --force-recreate is what triggers the ContainerConfig comparison that breaks
# docker-compose v1 on Docker Engine 25+. Fresh up after down is equivalent.
step "Starting all services"
docker-compose up -d

# ── Step 6: Wait for backend and confirm migrations ran ───────────────────────
step "Waiting for backend (migrations run on startup)"
BACKEND_URL="http://localhost:8000/health"
echo -n "  Polling $BACKEND_URL"

for i in $(seq 1 30); do
  if curl -sf "$BACKEND_URL" &>/dev/null; then
    echo ""
    ok "Backend is healthy"
    break
  fi
  echo -n "."
  sleep 3
  if [ "$i" -eq 30 ]; then
    echo ""
    warn "Backend did not respond after 90s — checking logs for errors:"
    docker-compose logs --tail=40 backend
    fail "Backend health check failed. Check the logs above."
  fi
done

# ── Step 7: Print migration log lines ─────────────────────────────────────────
step "Migration output (from backend startup log)"
divider
docker-compose logs backend 2>&1 \
  | grep -E "(Running upgrade|INFO \[alembic|alembic|Seed complete|Database ready|ERROR|Traceback)" \
  | tail -20 \
  || echo -e "${DIM}  (no migration lines found — backend may have started from a cached state)${RESET}"
divider

# ── Step 8: Final status ──────────────────────────────────────────────────────
step "Container status"
docker-compose ps

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
echo -e "${DIM}  Logs: docker-compose logs -f backend${RESET}"
echo ""
