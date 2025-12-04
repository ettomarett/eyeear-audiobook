const express = require('express');
const path = require('path');
const fs = require('fs');
const { getHistory, getHistoryEntry, deleteHistoryEntry, clearHistory, updateHistoryEntry } = require('../services/historyService');

const router = express.Router();

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

module.exports = router;

