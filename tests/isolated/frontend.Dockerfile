FROM node:22-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d
WORKDIR /work
COPY hotel-reservation-system-frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY hotel-reservation-system-frontend/src ./src
COPY hotel-reservation-system-frontend/public ./public
COPY hotel-reservation-system-frontend/*.json hotel-reservation-system-frontend/*.js hotel-reservation-system-frontend/*.ts hotel-reservation-system-frontend/index.html ./
COPY tests/isolated/frontend-check.sh /checks/frontend-check.sh
