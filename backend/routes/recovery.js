/**
 * Recovery Routes
 * Endpoints for discovering and recovering audiobooks from GCS
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const gcsRecoveryService = require('../services/gcsRecoveryService');
const jobTrackingService = require('../services/jobTrackingService');
const settingsService = require('../services/settingsService');
const { addToHistory } = require('../services/historyService');

const router = express.Router();

// Track active recovery downloads for progress
const recoveryProgress = new Map();

/**
 * GET /api/recovery/scan
 * Scan GCS bucket for recoverable audiobooks
 */
router.get('/scan', async (req, res) => {
  try {
    const settings = settingsService.loadSettings();
    const bucketName = settings.gcsBucketName || 'eyeear-ettomarett-app-bucket';
    const outputDir = path.join(__dirname, '../../output');

    const recoverable = await gcsRecoveryService.findRecoverableAudiobooks(bucketName, outputDir);
    
    // Enrich recoverable items with tracked job information
    const trackedJobs = jobTrackingService.loadJobs();
    const enrichedRecoverable = recoverable.map(item => {
      // Try to find matching tracked job
      let matchedJob = null;
      
      if (item.jobId && trackedJobs[item.jobId]) {
        matchedJob = trackedJobs[item.jobId];
      } else {
        // Try to match by GCS filename
        for (const [jobId, job] of Object.entries(trackedJobs)) {
          if (job.outputFileName === item.gcsFileName || 
              job.gcsOutputUri?.includes(item.gcsFileName)) {
            matchedJob = job;
            item.jobId = jobId;
            break;
          }
        }
      }
      
      // Enrich with tracked job data
      if (matchedJob) {
        return {
          ...item,
          bookTitle: matchedJob.bookTitle || item.bookTitle,
          characterCount: matchedJob.characterCount || item.characterCount,
          uploadedFilename: matchedJob.uploadedFilename,
          source: item.source === 'gcs_scan' ? 'tracked' : item.source,
        };
      }
      
      return item;
    });

    res.json({
      success: true,
      recoverable: enrichedRecoverable,
      bucketName,
    });
  } catch (error) {
    console.error('Error scanning for recoverable audiobooks:', error);
    res.status(500).json({
      error: error.message || 'Failed to scan for recoverable audiobooks',
    });
  }
});

/**
 * GET /api/recovery/bucket-files
 * List all audio files in the GCS bucket
 */
router.get('/bucket-files', async (req, res) => {
  try {
    const settings = settingsService.loadSettings();
    const bucketName = settings.gcsBucketName || 'eyeear-ettomarett-app-bucket';

    const files = await gcsRecoveryService.listBucketAudioFiles(bucketName);

    res.json({
      success: true,
      files,
      bucketName,
    });
  } catch (error) {
    console.error('Error listing bucket files:', error);
    res.status(500).json({
      error: error.message || 'Failed to list bucket files',
    });
  }
});

/**
 * POST /api/recovery/download
 * Download a specific file from GCS
 */
router.post('/download', async (req, res) => {
  try {
    const { gcsFileName, jobId, bookTitle } = req.body;

    if (!gcsFileName) {
      return res.status(400).json({ error: 'gcsFileName is required' });
    }

    const settings = settingsService.loadSettings();
    const bucketName = settings.gcsBucketName || 'eyeear-ettomarett-app-bucket';
    const outputDir = path.join(__dirname, '../../output');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate a recovery ID for tracking
    const recoveryId = jobId || `recovery_${Date.now()}`;
    recoveryProgress.set(recoveryId, {
      status: 'downloading',
      progress: 0,
    });

    // Try to look up the book title from tracked jobs
    let finalTitle = bookTitle;
    let characterCount = 0;
    
    if (!finalTitle || finalTitle.startsWith('Recovered')) {
      // Try to find job info from tracking
      const trackedJob = jobTrackingService.getJob(jobId);
      if (trackedJob && trackedJob.bookTitle) {
        finalTitle = trackedJob.bookTitle;
        characterCount = trackedJob.characterCount || 0;
      }
    }
    
    // If still no good title, parse from filename
    if (!finalTitle || finalTitle === 'Untitled Book') {
      const baseName = path.basename(gcsFileName, path.extname(gcsFileName));
      // Remove UUID and timestamp patterns
      const cleanName = baseName
        .replace(/^[a-f0-9-]{36}_\d+$/i, '') // Full UUID_timestamp
        .replace(/_\d{13,}$/, '') // Timestamp suffix
        .replace(/^output\//, '');
      finalTitle = cleanName || `Recovered Audiobook`;
    }

    // Start download with progress tracking
    const result = await gcsRecoveryService.recoverAudiobook(
      bucketName,
      gcsFileName,
      outputDir,
      jobId,
      (progress) => {
        recoveryProgress.set(recoveryId, {
          status: progress.step,
          progress: progress.progress,
          downloadedBytes: progress.downloadedBytes,
          totalSize: progress.totalSize,
        });
      }
    );

    // Add to history
    addToHistory({
      jobId: jobId || recoveryId,
      bookTitle: finalTitle,
      filename: result.filename,
      filePath: result.localPath,
      characterCount: characterCount,
      uploadedFilename: null,
      recovered: true,
    });

    // Clean up progress tracking
    recoveryProgress.delete(recoveryId);

    res.json({
      success: true,
      ...result,
      recoveryId,
      bookTitle: finalTitle,
    });
  } catch (error) {
    console.error('Error downloading recovered audiobook:', error);
    res.status(500).json({
      error: error.message || 'Failed to download audiobook',
    });
  }
});

/**
 * GET /api/recovery/progress/:recoveryId
 * Get download progress for a recovery operation
 */
router.get('/progress/:recoveryId', (req, res) => {
  const { recoveryId } = req.params;
  const progress = recoveryProgress.get(recoveryId);

  if (!progress) {
    return res.status(404).json({ error: 'Recovery not found or completed' });
  }

  res.json(progress);
});

/**
 * GET /api/recovery/check-operation/:jobId
 * Check the status of a Google TTS operation
 */
router.get('/check-operation/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobTrackingService.getJob(jobId);

    if (!job || !job.operationName) {
      return res.status(404).json({ error: 'Job or operation not found' });
    }

    const status = await gcsRecoveryService.checkOperationStatus(job.operationName);

    res.json({
      success: true,
      jobId,
      operationName: job.operationName,
      operationStatus: status,
      job,
    });
  } catch (error) {
    console.error('Error checking operation status:', error);
    res.status(500).json({
      error: error.message || 'Failed to check operation status',
    });
  }
});

/**
 * GET /api/recovery/tracked-jobs
 * Get all tracked jobs
 */
router.get('/tracked-jobs', (req, res) => {
  try {
    const jobs = jobTrackingService.loadJobs();
    res.json({
      success: true,
      jobs,
    });
  } catch (error) {
    console.error('Error loading tracked jobs:', error);
    res.status(500).json({
      error: error.message || 'Failed to load tracked jobs',
    });
  }
});

/**
 * DELETE /api/recovery/gcs-file
 * Delete a file from GCS bucket
 */
router.delete('/gcs-file', async (req, res) => {
  try {
    const { gcsFileName } = req.body;

    if (!gcsFileName) {
      return res.status(400).json({ error: 'gcsFileName is required' });
    }

    const settings = settingsService.loadSettings();
    const bucketName = settings.gcsBucketName || 'eyeear-ettomarett-app-bucket';

    const success = await gcsRecoveryService.deleteFile(bucketName, gcsFileName);

    res.json({
      success,
      message: success ? 'File deleted' : 'Failed to delete file',
    });
  } catch (error) {
    console.error('Error deleting GCS file:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete file',
    });
  }
});

module.exports = router;

