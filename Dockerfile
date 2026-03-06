# ─── Stage 1: Build Node.js app ───────────────────────────────────────────────
FROM node:20-bookworm-slim AS js-builder
WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# VITE_ variables must be available at build time so Vite can embed them
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_CHAT_API_URL
ARG VITE_CHAT_API_KEY
ARG VITE_CHAT_ACCOUNT_ID

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_CHAT_API_URL=$VITE_CHAT_API_URL \
    VITE_CHAT_API_KEY=$VITE_CHAT_API_KEY \
    VITE_CHAT_ACCOUNT_ID=$VITE_CHAT_ACCOUNT_ID

# Build frontend (Vite → dist/public) + backend (esbuild → dist/index.js)
RUN npm run build

# ─── Stage 2: Production runtime ──────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Install Python 3.11 + build tools for native packages (crewai, httpx, etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      gcc g++ python3-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Node.js production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app from builder stage
COPY --from=js-builder /app/dist ./dist

# Copy AI service and install Python deps in an isolated venv
COPY ai_service ./ai_service
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir -r ai_service/requirements.txt

# Startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Runtime environment variables (set at docker run time, not build time)
ENV NODE_ENV=production \
    PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:${PORT:-5000}/ || exit 1

CMD ["./docker-entrypoint.sh"]
