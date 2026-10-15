# ---- Stage 1: build the React front-end ----
FROM node:22-alpine AS builder
WORKDIR /build/client

COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: minimal runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json ./
COPY server.js metrics.js links.js storage.js config.js ./
COPY --from=builder /build/client/dist ./client/dist

USER node                 
EXPOSE 1939
CMD ["node", "server.js"]