const express = require('express');
const path = require('path');
const fs = require('fs');
const { chunkText } = require('../utils/chunker');
const { initializeTTS, generateSpeechForChunks } = require('../services/ttsService');
const { synthesizeLongAudio, initializeLongAudio, ensureInitialized: ensureLongAudioInitialized } = require('../services/longAudioService');
const { addToHistory } = require('../services/historyService');
const { saveMetadata, findMetadataByJobId } = require('../utils/metadataManager');
const settingsService = require('../services/settingsService');

const router = express.Router();

// Store job statuses (only for in-progress jobs, completed jobs use metadata files)
const jobStatuses = new Map();

router.post('/initialize', (req, res) => {
  try {
    const { credentialsPath } = req.body;
    
    // Use provided path, environment variable, or default location
    const os = require('os');
    const path = require('path');
    const homeDir = os.homedir();
    const credsPath = credentialsPath || 
      process.env.GOOGLE_CREDENTIALS_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(homeDir, '.eyeear', 'google_credentials.json');
    
    if (!credsPath) {
      return res.status(400).json({ 
        error: 'Google Cloud credentials not found. Please set GOOGLE_CREDENTIALS_PATH environment variable or place credentials at ~/.eyeear/google_credentials.json' 
      });
    }

    initializeTTS(credsPath);
    res.json({ success: true, message: 'TTS initialized' });
  } catch (error) {
    console.error('TTS initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint for long audio synthesis (recommended for audiobooks)
router.post('/generate-long', async (req, res) => {
  let jobId;
  try {
    const { jobId: reqJobId, text, options = {}, metadata = {} } = req.body;
    jobId = reqJobId;

    if (!jobId) {
      return res.status(400).json({ error: 'JobId is required' });
    }

    // Try to read text from temp file first (more efficient for large files)
    const textFilePath = path.join(__dirname, '../../temp', `${jobId}.txt`);
    let textContent = text;
    
    if (!textContent && fs.existsSync(textFilePath)) {
      // Read from temp file if text not provided in body
      textContent = fs.readFileSync(textFilePath, 'utf8');
    }

    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({ error: 'Text is empty. Please ensure text extraction completed successfully.' });
    }

    // Check text length - long audio supports up to 1 million characters
    if (textContent.length > 1000000) {
      return res.status(400).json({ error: 'Text is too long. Maximum 1 million characters for long audio synthesis.' });
    }

    // Initialize job status with metadata
    jobStatuses.set(jobId, {
      status: 'initializing',
      progress: 0,
      metadata: {
        bookTitle: metadata.bookTitle || 'Untitled Book',
        characterCount: textContent.length,
        uploadedFilename: metadata.uploadedFilename || null,
      },
    });

    // Ensure long audio client is initialized
    try {
      ensureLongAudioInitialized();
    } catch (initError) {
      jobStatuses.set(jobId, {
        status: 'error',
        error: `Initialization failed: ${initError.message}`,
      });
      return res.status(500).json({ error: initError.message });
    }

    // Start long audio synthesis (this is async, so we'll poll for status)
    jobStatuses.set(jobId, {
      status: 'synthesizing',
      progress: 10,
    });

    // Load settings for defaults
    const settings = settingsService.loadSettings();

    // Start synthesis in background
    synthesizeLongAudio({
      textContent: textContent,
      jobId,
      voiceName: options.voiceName || settings.voiceName || 'en-US-Chirp3-HD-Iapetus',
      languageCode: options.languageCode || settings.languageCode || 'en-US',
      speakingRate: options.speakingRate || settings.speakingRate || 1.0,
      pitch: options.pitch || settings.pitch || 0.0,
      bucketName: options.bucketName || settings.gcsBucketName || process.env.GCS_BUCKET_NAME || 'eyeear-ettomarett-app-bucket',
      progressCallback: (progress) => {
        const currentStatus = jobStatuses.get(jobId) || {};
        jobStatuses.set(jobId, {
          ...currentStatus,
          status: progress.step || 'synthesizing',
          progress: progress.progress || 0,
          operationName: progress.operationName,
          elapsed: progress.elapsed,
          estimated: progress.estimated,
        });
      },
    })
      .then((result) => {
        // Extract just the filename from the full path for serving
        const filename = path.basename(result.localPath);
        const currentStatus = jobStatuses.get(jobId) || {};
        let metadata = currentStatus.metadata || {};
        
        // Try to load original filename from info file if not in metadata
        if (!metadata.uploadedFilename) {
          try {
            const infoFilePath = path.join(__dirname, '../../temp', `${jobId}.info.json`);
            if (fs.existsSync(infoFilePath)) {
              const infoData = JSON.parse(fs.readFileSync(infoFilePath, 'utf8'));
              metadata.uploadedFilename = infoData.originalName || metadata.uploadedFilename;
              
              // Extract bookTitle from originalName if not set
              if (!metadata.bookTitle || metadata.bookTitle === 'Untitled Book') {
                if (infoData.originalName) {
                  metadata.bookTitle = infoData.originalName.replace(/\.[^/.]+$/, '') || 'Untitled Book';
                }
              }
            }
          } catch (infoError) {
            console.warn('Could not load original filename info:', infoError.message);
          }
        }
        
        // Save metadata to file for persistence
        const metadataToSave = {
          jobId,
          status: 'completed',
          progress: 100,
          outputPath: result.localPath,
          filename: filename,
          metadata: {
            bookTitle: metadata.bookTitle || 'Untitled Book',
            characterCount: metadata.characterCount || textContent.length,
            uploadedFilename: metadata.uploadedFilename || null,
          },
          createdAt: new Date().toISOString(),
        };
        
        saveMetadata(jobId, metadataToSave);
        
        // Keep status in memory for a short time so polling can get the correct filename
        // The metadata file is the source of truth, but we need to respond to the frontend first
        jobStatuses.set(jobId, {
          status: 'completed',
          progress: 100,
          outputPath: result.localPath,
          filename: filename,
          metadata: metadata,
        });
        
        // Remove from in-memory storage after 30 seconds (frontend should have received it by then)
        setTimeout(() => {
          jobStatuses.delete(jobId);
        }, 30000);

        // Save to history
        addToHistory({
          jobId,
          bookTitle: metadata.bookTitle || 'Untitled Book',
          filename: filename,
          filePath: result.localPath,
          characterCount: metadata.characterCount || text.length,
          uploadedFilename: metadata.uploadedFilename || null,
        });
      })
      .catch((error) => {
        console.error('Long audio synthesis error:', error);
        jobStatuses.set(jobId, {
          status: 'error',
          error: error.message || 'Long audio synthesis failed',
        });
      });

    // Return immediately - client will poll for status
    res.json({
      jobId,
      success: true,
      message: 'Long audio synthesis started. Poll /api/tts/status/:jobId for progress.',
    });
  } catch (error) {
    console.error('Long audio generation error:', error);
    if (jobId) {
      jobStatuses.set(jobId, {
        status: 'error',
        error: error.message || 'Unknown error',
      });
    }
    res.status(500).json({ error: error.message || 'Long audio generation failed' });
  }
});

// Legacy endpoint for chunked synthesis (fallback)
router.post('/generate', async (req, res) => {
  let jobId;
  try {
    const { jobId: reqJobId, text, options = {} } = req.body;
    jobId = reqJobId;

    if (!jobId || !text) {
      return res.status(400).json({ error: 'JobId and text are required' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is empty' });
    }

    // TTS will auto-initialize if needed in generateSpeechForChunks

    // Initialize job status
    jobStatuses.set(jobId, {
      status: 'chunking',
      progress: 0,
      total: 0,
      currentChunk: 0,
    });

    // Chunk the text
    let chunks;
    try {
      chunks = chunkText(text);
      if (chunks.length === 0) {
        throw new Error('No chunks created from text');
      }
    } catch (chunkError) {
      jobStatuses.set(jobId, {
        status: 'error',
        error: `Chunking failed: ${chunkError.message}`,
      });
      return res.status(500).json({ error: chunkError.message });
    }
    
    jobStatuses.set(jobId, {
      status: 'generating',
      progress: 0,
      total: chunks.length,
      currentChunk: 0,
    });

    // Generate speech for chunks
    const outputDir = path.join(__dirname, '../../temp', jobId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let results;
    try {
      results = await generateSpeechForChunks(
        chunks,
        {
          ...options,
          outputDir,
        },
        (progress) => {
          jobStatuses.set(jobId, {
            status: 'generating',
            progress: progress.current,
            total: progress.total,
            currentChunk: progress.chunkIndex,
          });
        }
      );
    } catch (ttsError) {
      jobStatuses.set(jobId, {
        status: 'error',
        error: `TTS generation failed: ${ttsError.message}`,
      });
      return res.status(500).json({ error: ttsError.message });
    }

    // Update status
    jobStatuses.set(jobId, {
      status: 'completed',
      progress: chunks.length,
      total: chunks.length,
      chunkFiles: results.map(r => r.outputPath),
    });

    res.json({
      jobId,
      success: true,
      chunkCount: chunks.length,
      chunkFiles: results.map(r => r.outputPath),
    });
  } catch (error) {
    console.error('TTS generation error:', error);
    if (jobId) {
      jobStatuses.set(jobId, {
        status: 'error',
        error: error.message || 'Unknown error',
      });
    }
    res.status(500).json({ error: error.message || 'TTS generation failed' });
  }
});

router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  // First check in-memory for in-progress jobs
  let status = jobStatuses.get(jobId);
  
  // If not in memory, check metadata files
  if (!status) {
    status = findMetadataByJobId(jobId);
  }

  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(status);
});

module.exports = router;

