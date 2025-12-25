const fs = require('fs');
const path = require('path');
const { loadMetadata } = require('../utils/metadataManager');

const HISTORY_FILE = path.join(__dirname, '../../data/history.json');
const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize history file if it doesn't exist
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
}

/**
 * Load history from file
 */
function loadHistory() {
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading history:', error);
    return [];
  }
}

/**
 * Save history to file
 */
function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving history:', error);
    return false;
  }
}

/**
 * Add an audiobook to history
 */
function addToHistory(metadata) {
  const history = loadHistory();
  
  const entry = {
    id: metadata.jobId || metadata.id || Date.now().toString(),
    bookTitle: metadata.bookTitle || 'Untitled Book',
    filename: metadata.filename,
    filePath: metadata.filePath,
    characterCount: metadata.characterCount || 0,
    createdAt: metadata.createdAt || new Date().toISOString(),
    uploadedFilename: metadata.uploadedFilename || null,
    isImported: metadata.isImported || false,
    isLocalPath: metadata.isLocalPath || false,
    isFileHandle: metadata.isFileHandle || false,
    fileSize: metadata.fileSize || null,
    fileType: metadata.fileType || null,
  };

  // Check if entry already exists (by id) and update it, otherwise add new
  const existingIndex = history.findIndex(item => item.id === entry.id);
  if (existingIndex >= 0) {
    history[existingIndex] = entry;
  } else {
    history.unshift(entry); // Add to beginning (most recent first)
  }

  // Keep only last 100 entries
  if (history.length > 100) {
    history.splice(100);
  }

  saveHistory(history);
  return entry;
}

/**
 * Get all history entries, enriched with metadata from metadata files
 */
function getHistory() {
  const history = loadHistory();
  const outputDir = path.join(__dirname, '../../output');
  
  // Helper function to extract book title from filename
  const extractBookTitleFromFilename = (filename) => {
    if (!filename) return 'Untitled Book';
    // Remove extension
    const nameWithoutExt = filename.replace(/\.(pdf|epub|mp3|wav)$/i, '');
    // Remove timestamp pattern (e.g., "book_1234567890" -> "book")
    const nameWithoutTimestamp = nameWithoutExt.replace(/_\d+$/, '');
    // If it's a UUID or jobId, return "Untitled Book"
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameWithoutTimestamp)) {
      return 'Untitled Book';
    }
    return nameWithoutTimestamp || 'Untitled Book';
  };
  
  // Helper function to extract book title from uploaded filename
  const extractBookTitleFromUploadedFilename = (uploadedFilename) => {
    if (!uploadedFilename) return null;
    // Remove extension (e.g., "mybook.pdf" -> "mybook")
    return uploadedFilename.replace(/\.[^/.]+$/, '') || null;
  };

  // Enrich history entries with metadata from metadata files
  const enrichedHistory = history.map(entry => {
    // Try to load metadata file for this entry
    const metadata = loadMetadata(entry.id);
    
    if (metadata && metadata.metadata) {
      // Get bookTitle from metadata, or extract from uploadedFilename, or from filename, or use entry's bookTitle
      let bookTitle = metadata.metadata.bookTitle;
      if (!bookTitle || bookTitle === 'Untitled Book') {
        // Try to extract from uploadedFilename first (original filename)
        const titleFromUploaded = extractBookTitleFromUploadedFilename(metadata.metadata.uploadedFilename);
        if (titleFromUploaded) {
          bookTitle = titleFromUploaded;
        } else {
          // Fall back to extracting from audio filename
          bookTitle = extractBookTitleFromFilename(metadata.filename || entry.filename);
        }
      }
      
      // Check if this is a file handle import (stored in browser's IndexedDB, not on server)
      const isFileHandle = metadata.metadata.isFileHandle || entry.isFileHandle || false;
      
      // Check if file exists (only for local path imports, not file handle imports)
      const filePath = metadata.outputPath || entry.filePath;
      let fileExists = true;
      if (isFileHandle) {
        // File handle imports are stored in browser's IndexedDB, not on server
        // We can't check their existence server-side, so we assume they exist
        // The frontend will check IndexedDB for the actual file handle
        fileExists = true;
      } else if (filePath) {
        fileExists = fs.existsSync(filePath);
      } else if (entry.filename) {
        const defaultPath = path.join(outputDir, entry.filename);
        fileExists = fs.existsSync(defaultPath);
      }
      
      // Update entry with metadata from file (prefer metadata file over history.json)
      return {
        ...entry,
        bookTitle: bookTitle,
        characterCount: metadata.metadata.characterCount || entry.characterCount,
        filename: metadata.filename || entry.filename,
        filePath: filePath,
        uploadedFilename: metadata.metadata.uploadedFilename || entry.uploadedFilename,
        isImported: metadata.metadata.isImported || entry.isImported || false,
        isLocalPath: metadata.metadata.isLocalPath || entry.isLocalPath || false,
        isFileHandle: isFileHandle,
        fileExists: fileExists, // Add file existence status
      };
    }
    
    // If no metadata file, try to extract bookTitle from uploadedFilename or filename
    if (entry.bookTitle === 'Untitled Book') {
      const titleFromUploaded = extractBookTitleFromUploadedFilename(entry.uploadedFilename);
      if (titleFromUploaded) {
        entry.bookTitle = titleFromUploaded;
      } else if (entry.filename) {
        entry.bookTitle = extractBookTitleFromFilename(entry.filename);
      }
    }
    
    // Check if file exists for entries without metadata
    // Skip check for file handle imports (stored in browser's IndexedDB)
    let fileExists = true;
    if (entry.isFileHandle) {
      // File handle imports are stored in browser's IndexedDB, not on server
      fileExists = true; // Assume exists, frontend will check IndexedDB
    } else if (entry.filePath) {
      fileExists = fs.existsSync(entry.filePath);
    } else if (entry.filename) {
      const defaultPath = path.join(outputDir, entry.filename);
      fileExists = fs.existsSync(defaultPath);
    }
    entry.fileExists = fileExists;
    
    return entry;
  });
  
  // Also check for metadata files that might not be in history.json yet
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    const metadataFiles = files.filter(file => file.endsWith('.metadata.json'));
    
    metadataFiles.forEach(metadataFile => {
      const jobId = metadataFile.replace('.metadata.json', '');
      const existingEntry = enrichedHistory.find(entry => entry.id === jobId);
      
      if (!existingEntry) {
        // Add entry from metadata file if not in history
        try {
          const metadata = loadMetadata(jobId);
          if (metadata && metadata.status === 'completed') {
            // Extract bookTitle from metadata, uploadedFilename, or filename
            let bookTitle = metadata.metadata?.bookTitle;
            if (!bookTitle || bookTitle === 'Untitled Book') {
              // Try to extract from uploadedFilename first (original filename)
              const titleFromUploaded = extractBookTitleFromUploadedFilename(metadata.metadata?.uploadedFilename);
              if (titleFromUploaded) {
                bookTitle = titleFromUploaded;
              } else {
                // Fall back to extracting from audio filename
                const nameWithoutExt = (metadata.filename || '').replace(/\.(mp3|wav)$/, '');
                const nameWithoutTimestamp = nameWithoutExt.replace(/_\d+$/, '');
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameWithoutTimestamp)) {
                  bookTitle = nameWithoutTimestamp || 'Untitled Book';
                } else {
                  bookTitle = 'Untitled Book';
                }
              }
            }
            
            enrichedHistory.unshift({
              id: jobId,
              bookTitle: bookTitle,
              filename: metadata.filename,
              filePath: metadata.outputPath,
              characterCount: metadata.metadata?.characterCount || 0,
              createdAt: metadata.createdAt || new Date().toISOString(),
              uploadedFilename: metadata.metadata?.uploadedFilename || null,
            });
          }
        } catch (err) {
          console.error(`Error loading metadata from ${metadataFile}:`, err);
        }
      }
    });
  }
  
  return enrichedHistory;
}

/**
 * Get a specific history entry by ID
 */
function getHistoryEntry(id) {
  const history = loadHistory();
  return history.find(item => item.id === id);
}

/**
 * Update a history entry (rename, move to folder, etc.)
 */
function updateHistoryEntry(id, updates) {
  const history = loadHistory();
  const index = history.findIndex(item => item.id === id);
  
  if (index === -1) {
    return null;
  }

  // Only allow certain fields to be updated
  const allowedUpdates = ['bookTitle', 'folderId'];
  const safeUpdates = {};
  
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      safeUpdates[key] = updates[key];
    }
  }

  history[index] = { ...history[index], ...safeUpdates };
  saveHistory(history);

  // Also update the metadata file if it exists
  const outputDir = path.join(__dirname, '../../output');
  const metadataPath = path.join(outputDir, `${id}.metadata.json`);
  if (fs.existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (safeUpdates.bookTitle) {
        metadata.metadata = metadata.metadata || {};
        metadata.metadata.bookTitle = safeUpdates.bookTitle;
      }
      if (safeUpdates.folderId !== undefined) {
        metadata.folderId = safeUpdates.folderId;
      }
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (e) {
      console.warn('Error updating metadata file:', e.message);
    }
  }

  return history[index];
}

/**
 * Delete a history entry and its associated files
 * Note: For local path imports (isLocalPath=true), only removes from history, doesn't delete the original file
 */
function deleteHistoryEntry(id) {
  const outputDir = path.join(__dirname, '../../output');
  let deleted = false;
  
  // Get the entry first to check if it's a local path import
  const history = loadHistory();
  const entry = history.find(item => item.id === id);
  const isLocalPath = entry?.isLocalPath || false;
  
  // Remove from history.json
  const filtered = history.filter(item => item.id !== id);
  if (filtered.length < history.length) {
    saveHistory(filtered);
    deleted = true;
  }
  
  // For local path imports, don't delete the original file, just remove from history
  if (isLocalPath) {
    console.log(`Removed local path import from history (file not deleted): ${entry?.filePath || id}`);
    // Still delete metadata file
    const metadataPath = path.join(outputDir, `${id}.metadata.json`);
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
      console.log(`Deleted metadata file: ${metadataPath}`);
    }
    return deleted;
  }
  
  // For uploaded files, delete the actual files
  // Also try to delete the metadata file
  const metadataPath = path.join(outputDir, `${id}.metadata.json`);
  if (fs.existsSync(metadataPath)) {
    // First, get the audio filename from metadata before deleting
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (metadata.filename) {
        const audioPath = path.join(outputDir, metadata.filename);
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
          console.log(`Deleted audio file: ${audioPath}`);
          deleted = true;
        }
      }
      // Only delete outputPath if it's in the output directory (not a local path)
      if (metadata.outputPath && fs.existsSync(metadata.outputPath)) {
        const outputPathNormalized = path.normalize(metadata.outputPath);
        const outputDirNormalized = path.normalize(outputDir);
        // Only delete if it's within the output directory
        if (outputPathNormalized.startsWith(outputDirNormalized)) {
          fs.unlinkSync(metadata.outputPath);
          console.log(`Deleted audio file: ${metadata.outputPath}`);
          deleted = true;
        } else {
          console.log(`Skipped deleting local path file: ${metadata.outputPath}`);
        }
      }
    } catch (e) {
      console.warn('Error reading metadata for deletion:', e.message);
    }
    
    // Delete the metadata file
    fs.unlinkSync(metadataPath);
    console.log(`Deleted metadata file: ${metadataPath}`);
    deleted = true;
  }
  
  // Also scan for audio files that match the ID pattern (in case metadata was missing)
  try {
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      if (file.startsWith(id) && (file.endsWith('.mp3') || file.endsWith('.wav'))) {
        const audioPath = path.join(outputDir, file);
        fs.unlinkSync(audioPath);
        console.log(`Deleted audio file: ${audioPath}`);
        deleted = true;
      }
    }
  } catch (e) {
    console.warn('Error scanning output directory:', e.message);
  }
  
  return deleted;
}

/**
 * Clear all history and delete all audio/metadata files
 */
function clearHistory() {
  const outputDir = path.join(__dirname, '../../output');
  
  // Delete all audio and metadata files in output directory
  try {
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      for (const file of files) {
        if (file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.metadata.json')) {
          const filePath = path.join(outputDir, file);
          fs.unlinkSync(filePath);
          console.log(`Deleted: ${filePath}`);
        }
      }
    }
  } catch (e) {
    console.error('Error clearing output directory:', e.message);
  }
  
  // Clear history.json
  saveHistory([]);
  return true;
}

module.exports = {
  addToHistory,
  getHistory,
  getHistoryEntry,
  updateHistoryEntry,
  deleteHistoryEntry,
  clearHistory,
};

