const express = require('express');
const path = require('path');
const fs = require('fs');
const { mergeAudioFiles, cleanupChunkFiles } = require('../services/audioMerger');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { jobId, chunkFiles, bookTitle } = req.body;

    if (!jobId || !chunkFiles || !Array.isArray(chunkFiles) || chunkFiles.length === 0) {
      return res.status(400).json({ error: 'JobId and chunkFiles array are required' });
    }

    // Create output filename
    const timestamp = Date.now();
    const safeTitle = (bookTitle || 'audiobook').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outputFilename = `${safeTitle}_${timestamp}.mp3`;
    const outputPath = path.join(__dirname, '../../output', outputFilename);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Merge audio files
    await mergeAudioFiles(chunkFiles, outputPath);

    // Clean up chunk files
    cleanupChunkFiles(chunkFiles);

    res.json({
      jobId,
      success: true,
      outputPath,
      outputFilename,
      url: `/output/${outputFilename}`,
    });
  } catch (error) {
    console.error('Audio merging error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

