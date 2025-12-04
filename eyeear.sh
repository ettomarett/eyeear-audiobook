#!/bin/bash

# EyeEar Audiobook Generator Launcher
# This script starts both the backend server and the Electron app

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill any existing processes on the ports
fuser -k 3001/tcp 2>/dev/null
fuser -k 5173/tcp 2>/dev/null

# Function to cleanup on exit
cleanup() {
    echo "Shutting down EyeEar..."
    kill $BACKEND_PID 2>/dev/null
    kill $ELECTRON_PID 2>/dev/null
    fuser -k 3001/tcp 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start backend server in background
echo "Starting backend server..."
node backend/server.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 0.5
done

# Start Electron app
echo "Starting EyeEar..."
ELECTRON_DISABLE_SANDBOX=1 npx electron --no-sandbox . &
ELECTRON_PID=$!

# Wait for Electron to exit
wait $ELECTRON_PID

# Cleanup will be called automatically via trap

