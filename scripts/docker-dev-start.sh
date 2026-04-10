#!/bin/sh
set -eu

cd /app

STAMP_FILE="node_modules/.package-lock.hash"

if [ ! -d node_modules ] || [ ! -f "$STAMP_FILE" ] || ! cmp -s package-lock.json "$STAMP_FILE"; then
  echo "[dev] Installing Node dependencies..."
  npm ci
  cp package-lock.json "$STAMP_FILE"
else
  echo "[dev] Reusing existing node_modules volume"
fi

echo "[dev] Starting Express + Vite in development mode on port ${PORT:-5000}..."
exec npm run dev