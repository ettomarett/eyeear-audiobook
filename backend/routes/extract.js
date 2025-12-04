const express = require('express');
const path = require('path');
const fs = require('fs');
const { extractTextFromEpub } = require('../services/epubExtractor');
const { extractTextFromPdf } = require('../services/pdfExtractor');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { filename, jobId, originalName } = req.body;

    if (!filename || !jobId) {
      return res.status(400).json({ error: 'Filename and jobId are required' });
    }

    const filePath = path.join(__dirname, '../../temp', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    let extractedText;

    try {
      if (ext === '.epub') {
        extractedText = await extractTextFromEpub(filePath);
      } else if (ext === '.pdf') {
        extractedText = await extractTextFromPdf(filePath);
      } else if (ext === '.txt') {
        // TXT files - just read the content directly
        extractedText = fs.readFileSync(filePath, 'utf8');
      } else {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(400).json({ error: 'No text could be extracted from the file' });
      }

      // Save extracted text to temp file
      const textFilePath = path.join(__dirname, '../../temp', `${jobId}.txt`);
      fs.writeFileSync(textFilePath, extractedText, 'utf8');

      // Save original filename info for later use
      if (originalName) {
        const infoFilePath = path.join(__dirname, '../../temp', `${jobId}.info.json`);
        fs.writeFileSync(infoFilePath, JSON.stringify({
          originalName,
          jobId,
          uploadedAt: new Date().toISOString(),
        }), 'utf8');
      }

      res.json({
        jobId,
        textLength: extractedText.length,
        textFilePath,
        originalName: originalName || null,
        success: true,
      });
    } catch (extractError) {
      console.error('Text extraction error:', extractError);
      // Clean up file on error
      try {
        if (fs.existsSync(filePath)) {
          // Keep file for retry, but log error
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      throw extractError;
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    res.status(500).json({ error: error.message || 'Text extraction failed' });
  }
});

module.exports = router;

