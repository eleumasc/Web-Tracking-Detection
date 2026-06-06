#!/bin/bash
set -euo pipefail

DATA_DIR="data"
SITE_FILE="${DATA_DIR}/example-site-list.txt"

cleanup() {
  echo "[+] Stopping trksim..."
  docker compose stop trksim >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "[+] Creating site list file..."

mkdir -p data

cat > "$SITE_FILE" <<EOF
1,www.internal
EOF

echo "[+] Starting trksim..."

docker compose up -d trksim

echo "[+] Waiting for trksim to be ready..."

# simple readiness wait (adjust endpoint if you have /health)
until docker compose exec trksim sh -c "curl -fsS http://localhost/ >/dev/null"; do
  sleep 1
done

echo "[+] Running analyze step..."

./start.sh analyze "$SITE_FILE"

ANALYZE_DIR="$(ls -1dt ${DATA_DIR}/*-Analyze 2>/dev/null | head -n 1 || true)"

if [[ -z "${ANALYZE_DIR}" ]]; then
  echo "Error: no *-Analyze directory found under ${DATA_DIR}" >&2
  exit 1
fi

echo "[+] Running process step..."

./start.sh process "${ANALYZE_DIR}"

PROCESS_DIR="$(ls -1dt ${DATA_DIR}/*-Process 2>/dev/null | head -n 1 || true)"

if [[ -z "${PROCESS_DIR}" ]]; then
  echo "Error: no *-Process directory found under ${DATA_DIR}" >&2
  exit 1
fi

echo "[+] Running measure step..."

./start.sh measure "${PROCESS_DIR}" --md

echo "[+] Done"
