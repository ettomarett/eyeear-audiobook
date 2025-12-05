const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getHistory, getHistoryEntry, deleteHistoryEntry, clearHistory, updateHistoryEntry, addToHistory } = require('../services/historyService');

const router = express.Router();

// Configure multer for audio file uploads
const outputDir = path.join(__dirname, '../../output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, outputDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${baseName}_${timestamp}${ext}`);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, WAV, M4A, OGG, FLAC, AAC) are allowed'), false);
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
  }
});

// Get all history entries
router.get('/', (req, res) => {
  try {
    const history = getHistory();
    res.json(history);
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific history entry by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const entry = getHistoryEntry(id);
    
    if (!entry) {
      return res.status(404).json({ error: 'History entry not found' });
    }

    // Check if file still exists
    if (entry.filePath && !fs.existsSync(entry.filePath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    res.json(entry);
  } catch (error) {
    console.error('Error getting history entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a history entry (rename, move to folder)
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = updateHistoryEntry(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: 'History entry not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating history entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a history entry
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteHistoryEntry(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'History entry not found' });
    }

    res.json({ success: true, message: 'History entry deleted' });
  } catch (error) {
    console.error('Error deleting history entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all history
router.delete('/', (req, res) => {
  try {
    clearHistory();
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    console.error('Error clearing history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import a local audio file to the library
router.post('/import', audioUpload.single('audioFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const bookTitle = req.body.bookTitle || path.basename(req.file.originalname, path.extname(req.file.originalname));
    const jobId = `import_${Date.now()}`;

    // Create metadata for the imported file
    const entry = addToHistory({
      jobId: jobId,
      bookTitle: bookTitle,
      filename: req.file.filename,
      filePath: req.file.path,
      characterCount: 0,
      createdAt: new Date().toISOString(),
      uploadedFilename: req.file.originalname,
      isImported: true, // Mark as imported (not generated)
    });

    // Also create a metadata file for consistency
    const metadataPath = path.join(outputDir, `${jobId}.metadata.json`);
    const metadata = {
      jobId: jobId,
      filename: req.file.filename,
      outputPath: req.file.path,
      status: 'completed',
      createdAt: new Date().toISOString(),
      metadata: {
        bookTitle: bookTitle,
        uploadedFilename: req.file.originalname,
        characterCount: 0,
        isImported: true,
      }
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`Imported audiobook: ${bookTitle} (${req.file.filename})`);
    
    res.json({
      success: true,
      message: 'Audiobook imported successfully',
      entry: entry
    });
  } catch (error) {
    console.error('Error importing audiobook:', error);
    // Clean up uploaded file if import failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

