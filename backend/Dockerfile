FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json backend/
RUN npm ci --workspace backend

COPY backend backend
RUN npm --workspace backend run build

EXPOSE 8080
CMD ["npm", "--workspace", "backend", "start"]
