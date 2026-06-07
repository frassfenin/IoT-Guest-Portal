# Stage 1: Build React/Vite client
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root and client package files
COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/

# Install dependencies for both root and client
RUN npm install
RUN npm install --prefix client

# Copy remaining codebase and build client
COPY . .
RUN npm run build

# Stage 2: Production runtime environment
FROM node:20-alpine
WORKDIR /app

# Copy package files and install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server application and pre-built client dist assets
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

# Expose Express server port
EXPOSE 3001

# Run server in production mode
CMD ["npm", "run", "start"]
