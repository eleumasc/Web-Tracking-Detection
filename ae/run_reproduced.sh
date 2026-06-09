#!/bin/bash
set -euo pipefail

ANALYZE_URL="https://zenodo.org/records/20593708/files/1771085049936-Analyze.7z"
DISCONNECT_URL="https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/ea1d534182be4977861682de4408c8f250865b7c/services.json"

DATA_DIR="data"
ANALYZE_ARCHIVE="${DATA_DIR}/1771085049936-Analyze.7z"
ANALYZE_DIR="${DATA_DIR}/1771085049936-Analyze-10k"
DISCONNECT_PATH="${DATA_DIR}/disconnect-ea1d534.json"

mkdir -p "${DATA_DIR}"

echo "[+] Downloading dataset..."

docker compose run --rm \
  --entrypoint bash \
  -e ANALYZE_URL="${ANALYZE_URL}" \
  -e DISCONNECT_URL="${DISCONNECT_URL}" \
  -e DATA_DIR="${DATA_DIR}" \
  -e ANALYZE_ARCHIVE="${ANALYZE_ARCHIVE}" \
  -e ANALYZE_DIR="${ANALYZE_DIR}" \
  -e DISCONNECT_PATH="${DISCONNECT_PATH}" \
  wtd -c '
set -euo pipefail

if [[ -d "$ANALYZE_DIR" ]]; then
  echo "Analyze directory already exists"
else
  if [[ -f "$ANALYZE_ARCHIVE" ]]; then
    echo "Analyze archive already exists"
  else
    curl -L "$ANALYZE_URL" -o "$ANALYZE_ARCHIVE"
  fi
  7z x "$ANALYZE_ARCHIVE" -o"$DATA_DIR"
fi

if [[ -f "${DISCONNECT_PATH}" ]]; then
  echo "Disconnect tracker list already exists"
else
  curl -L "${DISCONNECT_URL}" -o "${DISCONNECT_PATH}"
fi
'

echo "[+] Running process step..."

CPU_CORES="$(nproc)"

./start.sh process "${ANALYZE_DIR}" --maxTasks "${CPU_CORES}"

PROCESS_DIR="$(ls -1dt ${DATA_DIR}/*-Process 2>/dev/null | head -n 1 || true)"

if [[ -z "${PROCESS_DIR}" ]]; then
  echo "Error: no *-Process directory found under ${DATA_DIR}" >&2
  exit 1
fi

echo "[+] Running measure step..."

./start.sh measure "${PROCESS_DIR}" --disconnectPath "${DISCONNECT_PATH}" --md

echo "[+] Done"
