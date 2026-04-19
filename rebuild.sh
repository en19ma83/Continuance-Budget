#!/bin/bash

# Continuance Finance - Production Update & Rebuild Script
echo "============================================="
echo "   REBUILDING CONTINUANCE FINANCE"
echo "============================================="

# 1. Synchronize with GitHub
echo "Fetching latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

# 2. Clean up and Rebuild
echo "Restarting containers..."

# FIX: Disable BuildKit to prevent 'KeyError: ContainerConfig' in legacy docker-compose
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

docker-compose down
docker-compose up -d --build

echo ""
echo "---------------------------------------------"
echo "SUCCESS: Application updated and restarted!"
echo "---------------------------------------------"
echo "Status check:"
docker-compose ps
