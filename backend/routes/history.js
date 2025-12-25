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

// Import a local audio file via upload (for browsers without File System Access API)
router.post('/import-upload', audioUpload.single('audioFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const bookTitle = req.body.bookTitle || path.basename(req.file.originalname, path.extname(req.file.originalname));
    const jobId = `import_upload_${Date.now()}`;

    // Create metadata for the uploaded file
    const entry = addToHistory({
      jobId: jobId,
      bookTitle: bookTitle,
      filename: req.file.filename,
      filePath: req.file.path,
      characterCount: 0,
      createdAt: new Date().toISOString(),
      uploadedFilename: req.file.originalname,
      isImported: true,
      isLocalPath: false, // File is on server, not local path
      isFileHandle: false, // Not a file handle import
    });

    // Create a metadata file for consistency
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
        isLocalPath: false,
        isFileHandle: false,
      }
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`Imported audiobook via upload: ${bookTitle} (${req.file.filename})`);
    
    res.json({
      success: true,
      message: 'Audiobook uploaded and imported successfully',
      entry: entry
    });
  } catch (error) {
    console.error('Error importing audiobook via upload:', error);
    // Clean up uploaded file if import failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Import a local audio file to the library by file path (no upload)
router.post('/import', (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath || !filePath.trim()) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Normalize the path - handle both Windows and Unix paths
    let normalizedPath = filePath.trim();
    
    // Replace backslashes with forward slashes for cross-platform compatibility
    normalizedPath = normalizedPath.replace(/\\/g, '/');
    
    // Remove any leading/trailing whitespace and normalize
    normalizedPath = path.normalize(normalizedPath);
    
    // Resolve relative paths to absolute (if needed)
    if (!path.isAbsolute(normalizedPath)) {
      // If it's a relative path, try to resolve it from common locations
      // But for now, we'll require absolute paths
      return res.status(400).json({ 
        error: `File path must be absolute. Received: ${filePath}` 
      });
    }
    
    console.log(`Checking file existence: ${normalizedPath}`);
    
    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return res.status(404).json({ 
        error: `File not found: ${normalizedPath}`,
        message: 'The file may have been moved, deleted, or the path is incorrect. Please verify the file exists and try again.'
      });
    }

    // Check if it's a file (not a directory)
    const stats = fs.statSync(normalizedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    // Validate file extension
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const ext = path.extname(normalizedPath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ 
        error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}` 
      });
    }

    // Extract book title from filename
    const bookTitle = req.body.bookTitle || path.basename(normalizedPath, ext);
    const jobId = `import_${Date.now()}`;
    const filename = path.basename(normalizedPath);

    // Create metadata for the imported file (using original path, not copied)
    const entry = addToHistory({
      jobId: jobId,
      bookTitle: bookTitle,
      filename: filename, // Just the filename for display
      filePath: normalizedPath, // Full path to original file
      characterCount: 0,
      createdAt: new Date().toISOString(),
      uploadedFilename: filename,
      isImported: true, // Mark as imported (not generated)
      isLocalPath: true, // Mark as local path (not uploaded to server)
    });

    // Create a metadata file for consistency
    const metadataPath = path.join(outputDir, `${jobId}.metadata.json`);
    const metadata = {
      jobId: jobId,
      filename: filename,
      outputPath: normalizedPath, // Store original path
      status: 'completed',
      createdAt: new Date().toISOString(),
      metadata: {
        bookTitle: bookTitle,
        uploadedFilename: filename,
        characterCount: 0,
        isImported: true,
        isLocalPath: true,
      }
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`Imported audiobook by path: ${bookTitle} (${normalizedPath})`);
    
    res.json({
      success: true,
      message: 'Audiobook imported successfully',
      entry: entry
    });
  } catch (error) {
    console.error('Error importing audiobook:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if a file exists for a history entry
router.get('/:id/check-file', (req, res) => {
  try {
    const { id } = req.params;
    const entry = getHistoryEntry(id);
    
    if (!entry) {
      return res.status(404).json({ error: 'History entry not found', exists: false });
    }

    // For file handle imports, the file is stored in browser's IndexedDB
    // We can't check its existence server-side, so we assume it exists if the entry exists
    if (entry.isFileHandle) {
      return res.json({ 
        exists: true, // Assume exists - browser will handle access
        filePath: null,
        filename: entry.filename,
        isFileHandle: true
      });
    }

    // Check if file exists at the stored path
    const filePath = entry.filePath || path.join(outputDir, entry.filename);
    const exists = fs.existsSync(filePath);
    
    res.json({ 
      exists,
      filePath: entry.filePath || null,
      filename: entry.filename,
      isFileHandle: false
    });
  } catch (error) {
    console.error('Error checking file:', error);
    res.status(500).json({ error: error.message, exists: false });
  }
});

// Serve the audio file from its original path (for imported files)
router.get('/:id/file', (req, res) => {
  try {
    const { id } = req.params;
    const entry = getHistoryEntry(id);
    
    if (!entry) {
      return res.status(404).json({ error: 'History entry not found' });
    }

    // Use filePath if available (for imported files), otherwise use filename in output dir
    const filePath = entry.filePath || path.join(outputDir, entry.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: `Audio file not found: ${filePath}`,
        message: 'The file may have been moved or deleted.'
      });
    }

    // Determine content type based on extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
    };
    const contentType = contentTypeMap[ext] || 'audio/mpeg';

    // Set headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import a local audio file using File System Access API (file handle stored in browser)
router.post('/import-handle', (req, res) => {
  try {
    const { bookId, fileName, bookTitle, fileSize, fileType } = req.body;
    
    if (!bookId || !fileName) {
      return res.status(400).json({ error: 'Book ID and file name are required' });
    }

    // Extract book title from filename if not provided
    const finalBookTitle = bookTitle || path.basename(fileName, path.extname(fileName));
    const ext = path.extname(fileName).toLowerCase();

    // Create metadata for the imported file (file handle is stored in browser's IndexedDB)
    const entry = addToHistory({
      jobId: bookId,
      bookTitle: finalBookTitle,
      filename: fileName,
      filePath: null, // No file path - using file handle instead
      characterCount: 0,
      createdAt: new Date().toISOString(),
      uploadedFilename: fileName,
      isImported: true,
      isLocalPath: false, // Not a local path, but a file handle
      isFileHandle: true, // Mark as file handle import
      fileSize: fileSize || 0,
      fileType: fileType || `audio/${ext.slice(1)}`,
    });

    // Create a metadata file for consistency
    const metadataPath = path.join(outputDir, `${bookId}.metadata.json`);
    const metadata = {
      jobId: bookId,
      filename: fileName,
      outputPath: null, // No server-side path
      status: 'completed',
      createdAt: new Date().toISOString(),
      metadata: {
        bookTitle: finalBookTitle,
        uploadedFilename: fileName,
        characterCount: 0,
        isImported: true,
        isLocalPath: false,
        isFileHandle: true,
        fileSize: fileSize || 0,
        fileType: fileType || `audio/${ext.slice(1)}`,
      }
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`Imported audiobook via file handle: ${finalBookTitle} (${fileName})`);
    
    res.json({
      success: true,
      message: 'Audiobook imported successfully (using File System Access API)',
      entry: entry
    });
  } catch (error) {
    console.error('Error importing audiobook via file handle:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

