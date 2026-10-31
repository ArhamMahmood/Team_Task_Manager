# syntax=docker/dockerfile:1

# ---- 1. Build the React SPA ----
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Install production backend dependencies ----
FROM node:22-slim AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---- 3. Runtime: distroless (no shell, no package manager, non-root) ----
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

COPY --from=deps --chown=nonroot:nonroot /app/backend/node_modules ./backend/node_modules
COPY --chown=nonroot:nonroot backend/package.json ./backend/package.json
COPY --chown=nonroot:nonroot backend/src ./backend/src
COPY --chown=nonroot:nonroot backend/migrations ./backend/migrations
COPY --from=frontend --chown=nonroot:nonroot /app/frontend/dist ./frontend/dist

USER nonroot
EXPOSE 8080

# Distroless already sets the node entrypoint, so CMD is just the script.
CMD ["backend/src/server.js"]
