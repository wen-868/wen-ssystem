FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY admin-web/package*.json admin-web/
RUN npm ci --workspace admin-web
COPY admin-web admin-web
RUN npm --workspace admin-web run build

FROM nginx:1.27-alpine
COPY --from=builder /app/admin-web/dist /usr/share/nginx/html
EXPOSE 80
