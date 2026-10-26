FROM mcr.microsoft.com/playwright:v1.60.0-noble
WORKDIR /work
COPY hotel-reservation-system-frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY tests/isolated/e2e /checks/e2e
COPY tests/isolated/playwright.config.ts /checks/playwright.config.ts
ENV NODE_PATH=/work/node_modules
