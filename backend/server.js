require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploadRoutes = require('./routes/upload');
const extractRoutes = require('./routes/extract');
const ttsRoutes = require('./routes/tts');
const mergeRoutes = require('./routes/merge');
const historyRoutes = require('./routes/history');
const foldersRoutes = require('./routes/folders');
const bookmarksRoutes = require('./routes/bookmarks');
const settingsRoutes = require('./routes/settings');
const settingsService = require('./services/settingsService');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize settings on startup (applies saved settings to environment)
settingsService.initializeSettings();

// Ensure directories exist
const tempDir = path.join(__dirname, '../temp');
const outputDir = path.join(__dirname, '../output');
const dataDir = path.join(__dirname, '../data');

[tempDir, outputDir, dataDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/extract', extractRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/merge', mergeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/settings', settingsRoutes);

// Serve output files (audio files) with proper headers
app.use('/audio', express.static(outputDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.wav')) {
      res.setHeader('Content-Type', 'audio/wav');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  }
}));
app.use('/output', express.static(outputDir)); // Keep for backward compatibility

// Serve temp files (for text extraction)
app.use('/temp', express.static(tempDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

