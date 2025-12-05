/**
 * GCS Recovery Service
 * Scans GCS bucket for completed audiobooks and recovers jobs that completed after app shutdown
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');
const jobTrackingService = require('./jobTrackingService');

let storageClient = null;

/**
 * Initialize storage client
 */
function initializeStorage(credentialsPath) {
  if (!credentialsPath) {
    credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(os.homedir(), '.eyeear', 'google_credentials.json');
  }

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found: ${credentialsPath}`);
  }

  storageClient = new Storage({
    keyFilename: credentialsPath,
  });

  return storageClient;
}

/**
 * Ensure storage client is initialized
 */
function ensureStorage() {
  if (!storageClient) {
    initializeStorage();
  }
  return storageClient;
}

/**
 * List all audio files in the bucket's output folder
 */
async function listBucketAudioFiles(bucketName) {
  ensureStorage();

  try {
    const bucket = storageClient.bucket(bucketName);
    
    // List files in output/ prefix
    const [files] = await bucket.getFiles({
      prefix: 'output/',
    });

    const audioFiles = files
      .filter(file => file.name.endsWith('.wav') || file.name.endsWith('.mp3'))
      .map(file => ({
        name: file.name,
        fullPath: `gs://${bucketName}/${file.name}`,
        size: parseInt(file.metadata.size || '0'),
        created: file.metadata.timeCreated,
        updated: file.metadata.updated,
        // Parse jobId from filename (format: output/jobId_timestamp.wav)
        jobId: extractJobIdFromFilename(file.name),
      }));

    console.log(`Found ${audioFiles.length} audio files in bucket ${bucketName}`);
    return audioFiles;
  } catch (error) {
    console.error(`Error listing bucket files:`, error);
    throw error;
  }
}

/**
 * Extract jobId from GCS filename
 * Expected format: output/jobId_timestamp.wav
 */
function extractJobIdFromFilename(filename) {
  try {
    // Remove 'output/' prefix
    const name = filename.replace(/^output\//, '');
    // Remove extension
    const withoutExt = name.replace(/\.(wav|mp3)$/, '');
    // Extract jobId (everything before the last underscore + timestamp)
    const parts = withoutExt.split('_');
    if (parts.length >= 2) {
      // Last part is timestamp, join the rest as jobId
      parts.pop(); // Remove timestamp
      return parts.join('_');
    }
    return withoutExt;
  } catch (error) {
    return null;
  }
}

/**
 * Check if a file exists in GCS
 */
async function checkFileExists(bucketName, fileName) {
  ensureStorage();

  try {
    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error(`Error checking file existence:`, error);
    return false;
  }
}

/**
 * Download a file from GCS to local storage
 */
async function downloadFile(bucketName, gcsFileName, localPath) {
  ensureStorage();

  try {
    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(gcsFileName);

    // Ensure output directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Get file size for progress tracking
    const [metadata] = await file.getMetadata();
    const totalSize = parseInt(metadata.size || '0');

    // Download with progress streaming
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(localPath);
      const readStream = file.createReadStream();
      
      let downloadedBytes = 0;
      
      readStream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = totalSize > 0 ? Math.round((downloadedBytes / totalSize) * 100) : 0;
        console.log(`Download progress: ${progress}% (${downloadedBytes}/${totalSize} bytes)`);
      });
      
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      
      readStream.pipe(writeStream);
    });

    console.log(`Downloaded: ${gcsFileName} -> ${localPath}`);
    return localPath;
  } catch (error) {
    console.error(`Error downloading file:`, error);
    throw error;
  }
}

/**
 * Download file with progress callback (for real-time UI updates)
 */
async function downloadFileWithProgress(bucketName, gcsFileName, localPath, progressCallback) {
  ensureStorage();

  try {
    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(gcsFileName);

    // Ensure output directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Get file size for progress tracking
    const [metadata] = await file.getMetadata();
    const totalSize = parseInt(metadata.size || '0');

    // Download with progress streaming
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(localPath);
      const readStream = file.createReadStream();
      
      let downloadedBytes = 0;
      let lastReportedProgress = 0;
      
      readStream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = totalSize > 0 ? Math.round((downloadedBytes / totalSize) * 100) : 0;
        
        // Report progress at least every 1% or 500KB
        if (progress !== lastReportedProgress || downloadedBytes - lastReportedProgress > 500000) {
          lastReportedProgress = progress;
          if (progressCallback) {
            progressCallback({
              progress,
              downloadedBytes,
              totalSize,
              step: 'downloading',
            });
          }
        }
      });
      
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => {
        if (progressCallback) {
          progressCallback({
            progress: 100,
            downloadedBytes: totalSize,
            totalSize,
            step: 'downloaded',
          });
        }
        resolve();
      });
      
      readStream.pipe(writeStream);
    });

    console.log(`Downloaded: ${gcsFileName} -> ${localPath}`);
    return localPath;
  } catch (error) {
    console.error(`Error downloading file:`, error);
    throw error;
  }
}

/**
 * Delete a file from GCS
 */
async function deleteFile(bucketName, fileName) {
  ensureStorage();

  try {
    const bucket = storageClient.bucket(bucketName);
    await bucket.file(fileName).delete();
    console.log(`Deleted GCS file: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`Error deleting file:`, error);
    return false;
  }
}

/**
 * Check Google Cloud TTS operation status
 */
async function checkOperationStatus(operationName, credentialsPath) {
  if (!operationName) return null;

  if (!credentialsPath) {
    credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(os.homedir(), '.eyeear', 'google_credentials.json');
  }

  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      keyFilename: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    // Extract components from operation name
    // Format: projects/PROJECT/locations/LOCATION/operations/OPERATION_ID
    const parts = operationName.split('/');
    const projectId = parts[1];
    const location = parts[3];
    const operationId = parts[5];

    const apiUrl = `https://texttospeech.googleapis.com/v1beta1/${operationName}`;

    const https = require('https');
    const url = require('url');
    const parsedUrl = url.parse(apiUrl);

    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`API error: ${res.statusCode} - ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    return {
      done: response.done || false,
      progressPercent: response.metadata?.progressPercent || 0,
      error: response.error || null,
    };
  } catch (error) {
    console.error(`Error checking operation status:`, error);
    return null;
  }
}

/**
 * Find recoverable audiobooks - files on GCS that aren't downloaded locally
 * Combines tracked jobs with GCS bucket scan
 */
async function findRecoverableAudiobooks(bucketName, outputDir) {
  const recoverable = [];

  try {
    // 1. Get tracked jobs that might be recoverable
    const trackedJobs = jobTrackingService.getRecoverableJobs();
    console.log(`Found ${trackedJobs.length} tracked jobs to check`);

    // 2. Scan GCS bucket for audio files
    const gcsFiles = await listBucketAudioFiles(bucketName);
    console.log(`Found ${gcsFiles.length} audio files in GCS bucket`);

    // 3. Check each tracked job
    for (const job of trackedJobs) {
      if (job.gcsOutputUri && job.outputFileName) {
        const exists = await checkFileExists(bucketName, job.outputFileName);
        if (exists) {
          // Check if we already have it locally
          const localPath = path.join(outputDir, path.basename(job.outputFileName));
          const localMp3Path = localPath.replace('.wav', '.mp3');
          
          if (!fs.existsSync(localPath) && !fs.existsSync(localMp3Path)) {
            recoverable.push({
              ...job,
              source: 'tracked',
              gcsFileName: job.outputFileName,
            });
          }
        } else if (job.operationName) {
          // File doesn't exist yet - check if operation is still running
          const opStatus = await checkOperationStatus(job.operationName);
          if (opStatus) {
            if (opStatus.done && !opStatus.error) {
              // Operation completed - file should exist now, recheck
              const exists2 = await checkFileExists(bucketName, job.outputFileName);
              if (exists2) {
                recoverable.push({
                  ...job,
                  source: 'tracked',
                  gcsFileName: job.outputFileName,
                  justCompleted: true,
                });
              }
            }
            // NOTE: In-progress jobs are now shown in the RunningJobs component, not here
          }
        }
      }
    }

    // 4. Check GCS files that aren't in tracked jobs
    for (const gcsFile of gcsFiles) {
      const isTracked = trackedJobs.some(job => 
        job.outputFileName === gcsFile.name || 
        job.gcsOutputUri?.includes(gcsFile.name)
      );
      
      if (!isTracked) {
        // Check if we have it locally
        const localPath = path.join(outputDir, path.basename(gcsFile.name));
        const localMp3Path = localPath.replace('.wav', '.mp3');
        
        if (!fs.existsSync(localPath) && !fs.existsSync(localMp3Path)) {
          recoverable.push({
            jobId: gcsFile.jobId || 'unknown',
            gcsFileName: gcsFile.name,
            gcsOutputUri: gcsFile.fullPath,
            size: gcsFile.size,
            created: gcsFile.created,
            source: 'gcs_scan',
            bookTitle: `Recovered audiobook (${path.basename(gcsFile.name)})`,
          });
        }
      }
    }

    console.log(`Found ${recoverable.length} recoverable audiobooks`);
    return recoverable;
  } catch (error) {
    console.error('Error finding recoverable audiobooks:', error);
    throw error;
  }
}

/**
 * Recover an audiobook from GCS
 */
async function recoverAudiobook(bucketName, gcsFileName, outputDir, jobId, progressCallback) {
  try {
    // Generate local path
    const localWavPath = path.join(outputDir, path.basename(gcsFileName));
    
    // Download with progress
    await downloadFileWithProgress(bucketName, gcsFileName, localWavPath, progressCallback);
    
    // Try to convert to MP3
    let localOutputPath = localWavPath;
    try {
      const ffmpeg = require('fluent-ffmpeg');
      const localMp3Path = localWavPath.replace('.wav', '.mp3');
      
      await new Promise((resolve, reject) => {
        ffmpeg(localWavPath)
          .toFormat('mp3')
          .on('end', () => {
            console.log('Converted WAV to MP3 successfully');
            fs.unlinkSync(localWavPath);
            resolve();
          })
          .on('error', (err) => {
            console.warn('FFmpeg conversion failed, keeping WAV file:', err.message);
            resolve();
          })
          .save(localMp3Path);
      });
      
      if (fs.existsSync(localMp3Path)) {
        localOutputPath = localMp3Path;
      }
    } catch (ffmpegError) {
      console.warn('FFmpeg not available, keeping WAV file');
    }

    // Update job tracking
    if (jobId && jobId !== 'unknown') {
      jobTrackingService.markJobCompleted(jobId, localOutputPath, path.basename(localOutputPath));
    }

    return {
      success: true,
      localPath: localOutputPath,
      filename: path.basename(localOutputPath),
    };
  } catch (error) {
    console.error('Error recovering audiobook:', error);
    throw error;
  }
}

module.exports = {
  initializeStorage,
  listBucketAudioFiles,
  checkFileExists,
  downloadFile,
  downloadFileWithProgress,
  deleteFile,
  checkOperationStatus,
  findRecoverableAudiobooks,
  recoverAudiobook,
};

