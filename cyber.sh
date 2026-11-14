#!/usr/bin/env bash
# Petit lanceur : ./cyber.sh <commande>. Aucune installation de Node/Python requise.
set -euo pipefail
cd "$(dirname "$0")"

load_env() { [ -f .env ] || { echo "⚠️  .env manquant : cp .env.example .env puis édite-le"; exit 1; }; set -a; . ./.env; set +a; }

case "${1:-help}" in
  up)      load_env; docker compose up -d --build ;;
  update)  git pull && docker compose up -d --build ;;
  logs)    docker compose logs -f --tail=100 "${2:-app}" ;;
  ps)      docker compose ps ;;
  down)    docker compose down ;;
  reset)
    # Reset de fin de journée : efface la base (visiteurs, scores, surcharges) puis relance l'app.
    read -r -p "Effacer TOUTES les données de la journée ? [o/N] " a
    [ "$a" = "o" ] || { echo "Annulé."; exit 0; }
    docker compose exec -T app sh -c 'rm -f /data/cyber.db /data/cyber.db-wal /data/cyber.db-shm'
    docker compose restart app
    echo "✅ Reset effectué." ;;
  kiosk)
    load_env
    URL="http://localhost:${HTTP_PORT:-80}/screen"
    for b in chromium chromium-browser google-chrome; do
      if command -v "$b" >/dev/null; then
        exec "$b" --kiosk --noerrdialogs --disable-infobars --no-first-run \
          --user-data-dir="${TMPDIR:-/tmp}/cyber-kiosk" "$URL"
      fi
    done
    echo "Chromium introuvable. Ouvre $URL en plein écran (F11)."; exit 1 ;;
  test)
    # Tests dans des conteneurs jetables (rien à installer sur le PC).
    docker run --rm -v "$PWD/frontend:/f" -w /f node:22-alpine sh -c "npm ci --no-audit --no-fund && npm test"
    docker run --rm -v "$PWD/backend:/b" -w /b python:3.12-slim sh -c "pip install -q -r requirements-dev.txt && pytest -q"
    docker run --rm -v "$PWD/chaos-agent:/c" -w /c python:3.12-slim sh -c "pip install -q pytest==8.3.4 && pytest -q" ;;
  *)
    echo "Usage: ./cyber.sh {up|update|logs [service]|ps|down|reset|kiosk|test}" ;;
esac
