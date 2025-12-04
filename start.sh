#!/bin/bash

# EyeEar Audiobook Generator - Quick Start Script

echo "🚀 Starting EyeEar Audiobook Generator..."
echo ""

# Check for FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg not found!"
    echo "   Please install FFmpeg first:"
    echo "   Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "   macOS: brew install ffmpeg"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for credentials
if [ ! -f "$HOME/.eyeear/google_credentials.json" ]; then
    echo "⚠️  Google Cloud credentials not found!"
    echo "   Expected location: $HOME/.eyeear/google_credentials.json"
    echo "   Please download your service account JSON key file"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create directories if they don't exist
mkdir -p temp output

# Start the application
echo "✓ Starting development servers..."
echo ""
npm run dev

