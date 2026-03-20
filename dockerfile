# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Install dependencies only (layer-cached separately from source)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

# Non-root user for security
RUN addgroup -S lynkivo && adduser -S lynkivo -G lynkivo

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY server.js colors.js i18n.js package.json ./

# Data directory — mounted as a named volume in production
RUN mkdir -p /app/data/uploads \
    && chown -R lynkivo:lynkivo /app

USER lynkivo

# Tell the app where to store persistent data
ENV DATA_DIR=/app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/login > /dev/null || exit 1

CMD ["node", "server.js"]