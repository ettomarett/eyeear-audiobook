# Setup Guide for EyeEar Audiobook Generator

## Prerequisites Check

### ✓ Completed
- [x] Node.js dependencies installed
- [x] Project directories created (temp/, output/)
- [x] Google Cloud credentials found at `~/.eyeear/google_credentials.json`

### ⚠️ Required Actions

#### 1. Install FFmpeg (Required for audio merging)

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

#### 2. Environment Configuration

The application will use the credentials file at `~/.eyeear/google_credentials.json` by default.

To use a different path, create a `.env` file in the project root:
```bash
cd eyeear-audiobook
echo "GOOGLE_CREDENTIALS_PATH=/path/to/your/credentials.json" > .env
```

## Running the Application

### Development Mode

Start all services (React dev server, Express backend, Electron):
```bash
npm run dev
```

This will:
- Start Vite dev server on http://localhost:5173
- Start Express backend on http://localhost:3001
- Launch Electron app

### Individual Services

Start React dev server only:
```bash
npm run dev:react
```

Start backend only:
```bash
npm run dev:backend
```

Start Electron only (after React is running):
```bash
npm run dev:electron
```

## First Run Checklist

1. ✅ Install FFmpeg (see above)
2. ✅ Verify credentials file exists at `~/.eyeear/google_credentials.json`
3. ✅ Run `npm run dev` to start the application
4. ✅ Upload a test PDF or EPUB file
5. ✅ Wait for processing to complete
6. ✅ Play the generated audiobook

## Troubleshooting

### FFmpeg not found
- Install FFmpeg using the commands above
- Verify with `ffmpeg -version`

### Google Cloud authentication errors
- Verify credentials file exists and is valid JSON
- Ensure service account has "Cloud Text-to-Speech API User" role
- Check that Text-to-Speech API is enabled in Google Cloud Console

### Port already in use
- Change PORT in `.env` file or environment variable
- Kill process using port 3001: `lsof -ti:3001 | xargs kill -9`

### Module not found errors
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

## Project Structure

```
eyeear-audiobook/
├── backend/          # Express API server
├── electron/         # Electron main process
├── src/             # React frontend
├── temp/            # Temporary files (auto-created)
├── output/          # Generated audiobooks (auto-created)
└── package.json     # Dependencies and scripts
```

## Next Steps

Once setup is complete, you can:
1. Upload PDF or EPUB files
2. Generate audiobooks automatically
3. Play audiobooks with the built-in player
4. Adjust playback speed and volume

Enjoy your audiobook generator! 🎧

