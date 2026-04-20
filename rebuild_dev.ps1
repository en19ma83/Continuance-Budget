# Continuance Finance - Rebuild Script (PowerShell)
# Usage:
#   .\rebuild_dev.ps1              # Standard rebuild (down -> build -> up)
#   .\rebuild_dev.ps1 -NoCache     # Force a clean image build
#   .\rebuild_dev.ps1 -Fresh       # ! Destroys DB volume - full reset
# -----------------------------------------------------------------------------

param (
    [switch]$NoCache,
    [switch]$Fresh
)

$ErrorActionPreference = "Stop"

# -- Helpers --
function Write-Step ($msg) {
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

function Write-Ok ($msg) {
    Write-Host "[OK] $msg" -ForegroundColor Green
}

function Write-Warn ($msg) {
    Write-Host "[!!] $msg" -ForegroundColor Yellow
}

function Write-Fail ($msg) {
    Write-Host "[XX] $msg" -ForegroundColor Red
    exit 1
}

# -- Banner --
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Continuance Finance - Rebuild Script (PS)    " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# -- Preflight --
Write-Step "Preflight checks"

if (-not (Test-Path "docker-compose.yml")) {
    Write-Fail "Run this script from the repo root (docker-compose.yml not found)."
}

if (-not (Test-Path ".env")) {
    Write-Warn ".env file not found. Proceeding with Docker Compose defaults..."
} else {
    Write-Ok ".env present"
}

# Check for Docker
try {
    $dockerVer = docker version --format '{{.Server.Version}}'
    $composeVer = docker compose version --short
    Write-Ok "Docker $dockerVer + Compose $composeVer"
} catch {
    Write-Fail "Docker is not running or not in PATH."
}

# -- Fresh Volume Warning --
if ($Fresh) {
    Write-Host "" 
    Write-Host "  !!  WARNING: -Fresh will permanently destroy the PostgreSQL data volume." -ForegroundColor Red
    Write-Host "      All database data (users, rules, ledger, assets) will be DELETED." -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "  Type 'yes-delete-everything' to confirm"
    if ($confirm -ne "yes-delete-everything") {
        Write-Host "Aborted."
        exit 0
    }
}

# -- Step 1: Stop Containers --
Write-Step "Stopping existing containers"
if ($Fresh) {
    docker compose down --volumes --remove-orphans
    Write-Warn "Database volume destroyed (-Fresh)"
} else {
    docker compose down --remove-orphans
    Write-Ok "Containers stopped, data volume preserved"
}

# -- Step 2: Build Images --
Write-Step "Building images"
$buildArgs = @()
if ($NoCache) {
    $buildArgs += "--no-cache"
    Write-Warn "Cache disabled - full rebuild"
}

docker compose build --pull $buildArgs
Write-Ok "Images built"

# -- Step 3: Start Services --
Write-Step "Starting services (waiting for healthchecks)"
docker compose up -d --force-recreate --wait
Write-Ok "All services healthy"

# -- Step 4: Display Status & Mobile Info --
Write-Step "Final Status"
docker compose ps

# Identify Local IP for Mobile Testing
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | 
            Where-Object { $_.InterfaceAlias -match "Ethernet|Wi-Fi|vEthernet" -and $_.IPAddress -notmatch "^127\.|^169\.254\.|^172\." } | 
            Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "   OK: Rebuild complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  ->  http://localhost:3000"
Write-Host "  API       ->  http://localhost:8000"
Write-Host "  API Docs  ->  http://localhost:8000/docs"
Write-Host ""
Write-Host "  [MOBILE TESTING]" -ForegroundColor Yellow

if ($localIP) {
    Write-Host "  Your Local IP:  $localIP" -ForegroundColor Cyan
    Write-Host "  Mobile API URL: http://$($localIP):8000" -ForegroundColor Cyan
    Write-Host "  (Ensure mobile app backend URL is set to this IP)" -ForegroundColor Gray
} else {
    Write-Host "  Could not auto-detect local IP. Use 'ipconfig' to find it." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Tail logs:  docker compose logs -f backend" -ForegroundColor Gray
Write-Host ""
