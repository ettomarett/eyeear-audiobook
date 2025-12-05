#!/bin/bash

# EyeEar Audiobook Generator Launcher
# This script starts the Vite dev server, backend server, and Electron app

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill any existing processes on the ports
fuser -k 3001/tcp 2>/dev/null
fuser -k 5173/tcp 2>/dev/null
pkill -f "electron.*eyeear" 2>/dev/null

sleep 1

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down EyeEar..."
    kill $VITE_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    kill $ELECTRON_PID 2>/dev/null
    fuser -k 3001/tcp 2>/dev/null
    fuser -k 5173/tcp 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "╔═══════════════════════════════════════╗"
echo "║   👁️👂 EyeEar Audiobook Generator     ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Start Vite dev server in background
echo "📦 Starting frontend server..."
npm run dev:react > /dev/null 2>&1 &
VITE_PID=$!

# Start backend server in background with increased memory limit
echo "🔧 Starting backend server..."
node --max-old-space-size=4096 backend/server.js > /dev/null 2>&1 &
BACKEND_PID=$!

# Wait for Vite to be ready
echo "⏳ Waiting for frontend..."
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ Frontend ready!"
        break
    fi
    sleep 0.5
done

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Backend ready!"
        break
    fi
    sleep 0.5
done

echo ""
echo "🚀 Launching EyeEar..."
echo ""

# Start Electron app
ELECTRON_DISABLE_SANDBOX=1 START_BACKEND=false npx electron --no-sandbox . &
ELECTRON_PID=$!

# Wait for Electron to exit
wait $ELECTRON_PID

# Cleanup will be called automatically via trap
