const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const FOLDERS_FILE = path.join(__dirname, '../../data/folders.json');
const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize folders file if it doesn't exist
if (!fs.existsSync(FOLDERS_FILE)) {
  fs.writeFileSync(FOLDERS_FILE, JSON.stringify([], null, 2));
}

function loadFolders() {
  try {
    const data = fs.readFileSync(FOLDERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading folders:', error);
    return [];
  }
}

function saveFolders(folders) {
  try {
    fs.writeFileSync(FOLDERS_FILE, JSON.stringify(folders, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving folders:', error);
    return false;
  }
}

// Get all folders
router.get('/', (req, res) => {
  try {
    const folders = loadFolders();
    res.json(folders);
  } catch (error) {
    console.error('Error getting folders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new folder
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folders = loadFolders();
    
    const newFolder = {
      id: Date.now().toString(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };

    folders.push(newFolder);
    saveFolders(folders);

    res.status(201).json(newFolder);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a folder (rename)
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folders = loadFolders();
    const folderIndex = folders.findIndex(f => f.id === id);

    if (folderIndex === -1) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    folders[folderIndex].name = name.trim();
    saveFolders(folders);

    res.json(folders[folderIndex]);
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a folder (moves books back to "All Books")
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const folders = loadFolders();
    const filtered = folders.filter(f => f.id !== id);

    if (filtered.length === folders.length) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    saveFolders(filtered);

    // Update history to remove folder references
    const historyFile = path.join(DATA_DIR, 'history.json');
    if (fs.existsSync(historyFile)) {
      try {
        const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        const updatedHistory = history.map(book => {
          if (book.folderId === id) {
            const { folderId, ...rest } = book;
            return rest;
          }
          return book;
        });
        fs.writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2));
      } catch (e) {
        console.warn('Error updating history after folder deletion:', e.message);
      }
    }

    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

