# ─── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies (Express API server)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript → dist/
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Only copy what we need to run the API server
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Railway injects PORT; default to 3001 for local testing
EXPOSE 3001

CMD ["node", "dist/api-server.js"]
