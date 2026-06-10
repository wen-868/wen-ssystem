FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY store-terminal/package*.json store-terminal/
RUN npm ci --workspace store-terminal
COPY store-terminal store-terminal
RUN npm --workspace store-terminal run build

FROM nginx:1.27-alpine
COPY --from=builder /app/store-terminal/dist /usr/share/nginx/html
EXPOSE 80
