#!/bin/sh
set -e

echo "[entrypoint] Starting AI Summary Service (Python/FastAPI) on port 8000..."
cd /app/ai_service
/app/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
AI_PID=$!

echo "[entrypoint] Waiting for AI service to initialize..."
sleep 3

echo "[entrypoint] Starting Express server on port ${PORT:-5000}..."
cd /app
exec node dist/index.js
