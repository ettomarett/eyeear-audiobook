# Multi-stage build for EyeEar Audiobook Generator

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:react

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./
# Skip postinstall script (electron-builder not needed in Docker)
RUN npm ci --production --ignore-scripts

# Copy backend
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/dist ./frontend

# Create necessary directories
RUN mkdir -p /app/data /app/output /app/temp /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3003

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "backend/server.js"]

