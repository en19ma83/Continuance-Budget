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
# Switching to modern 'docker compose' to avoid KeyError: 'ContainerConfig'
docker compose down
docker compose up -d --build

echo ""
echo "---------------------------------------------"
echo "SUCCESS: Application updated and restarted!"
echo "---------------------------------------------"
echo "Status check:"
docker compose ps
