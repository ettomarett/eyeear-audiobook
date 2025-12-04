const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const BOOKMARKS_FILE = path.join(__dirname, '../../data/bookmarks.json');
const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize bookmarks file if it doesn't exist
if (!fs.existsSync(BOOKMARKS_FILE)) {
  fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify({}, null, 2));
}

function loadAllBookmarks() {
  try {
    const data = fs.readFileSync(BOOKMARKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    return {};
  }
}

function saveAllBookmarks(bookmarks) {
  try {
    fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving bookmarks:', error);
    return false;
  }
}

// Get bookmarks for a specific book
router.get('/:bookId', (req, res) => {
  try {
    const { bookId } = req.params;
    const allBookmarks = loadAllBookmarks();
    const bookmarks = allBookmarks[bookId] || [];
    res.json({ bookmarks });
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save/update bookmarks for a specific book
router.put('/:bookId', (req, res) => {
  try {
    const { bookId } = req.params;
    const { bookmarks } = req.body;

    if (!Array.isArray(bookmarks)) {
      return res.status(400).json({ error: 'Bookmarks must be an array' });
    }

    const allBookmarks = loadAllBookmarks();
    allBookmarks[bookId] = bookmarks;
    saveAllBookmarks(allBookmarks);

    res.json({ success: true, bookmarks });
  } catch (error) {
    console.error('Error saving bookmarks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete all bookmarks for a specific book
router.delete('/:bookId', (req, res) => {
  try {
    const { bookId } = req.params;
    const allBookmarks = loadAllBookmarks();
    
    if (allBookmarks[bookId]) {
      delete allBookmarks[bookId];
      saveAllBookmarks(allBookmarks);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bookmarks:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

