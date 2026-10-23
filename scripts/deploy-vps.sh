#!/usr/bin/env bash
# =============================================================================
# CIIM 2026 — VPS Deployment & Update Script
# Run on VPS: bash scripts/deploy-vps.sh
# =============================================================================
set -e

echo "🚀 [1/5] Pulling latest code from main..."
git checkout main
git pull origin main

echo "🐳 [2/5] Building and starting Docker containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "⏳ [3/5] Waiting for backend API healthcheck..."
docker compose -f docker-compose.prod.yml ps

echo "🌱 [4/5] Seeding event database & admin account (idempotent)..."
docker compose -f docker-compose.prod.yml exec api npm run seed || true
docker compose -f docker-compose.prod.yml exec api npm run seed:admin || true

echo "✅ [5/5] Checking container status & API health:"
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1:2008/api/v1/health | grep '"status":"ok"' && echo "API is healthy!" || echo "Check API logs"

echo ""
echo "🎉 Deployment complete!"
echo "Public site: http://127.0.0.1:1008 (or https://ciim.prashanthhospitals.com)"
echo "Admin site:  http://127.0.0.1:1009 (or https://ciimadmin.prashanthhospitals.com)"
