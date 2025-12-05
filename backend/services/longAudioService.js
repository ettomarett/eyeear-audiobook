const textToSpeech = require('@google-cloud/text-to-speech');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize clients
let longAudioClient = null;
let storageClient = null;

/**
 * Initialize the long audio synthesis client
 */
function initializeLongAudio(credentialsPath) {
  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    throw new Error(`Google Cloud credentials file not found: ${credentialsPath}`);
  }

  try {
    const clientOptions = {
      keyFilename: credentialsPath,
    };

    // Try to use v1beta1 client for long audio synthesis
    // If that's not available, we'll fall back to standard client
    try {
      const { TextToSpeechLongAudioSynthesizeClient } = require('@google-cloud/text-to-speech').v1beta1;
      longAudioClient = new TextToSpeechLongAudioSynthesizeClient(clientOptions);
      console.log('Using v1beta1 Long Audio Synthesis client');
    } catch (v1beta1Error) {
      // Fallback to standard client if v1beta1 is not available
      console.warn('v1beta1 client not available, using standard client:', v1beta1Error.message);
      longAudioClient = new textToSpeech.TextToSpeechClient(clientOptions);
    }
    
    // Initialize Storage client for GCS operations
    storageClient = new Storage(clientOptions);

    console.log(`Long Audio TTS initialized with credentials: ${credentialsPath}`);
  } catch (error) {
    console.error('Error initializing Long Audio TTS client:', error);
    throw new Error(`Failed to initialize Long Audio TTS client: ${error.message}`);
  }
}

/**
 * Ensure clients are initialized
 */
function ensureInitialized() {
  if (!longAudioClient || !storageClient) {
    const homeDir = os.homedir();
    const credsPath = process.env.GOOGLE_CREDENTIALS_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(homeDir, '.eyeear', 'google_credentials.json');
    
    if (credsPath && fs.existsSync(credsPath)) {
      console.log(`Auto-initializing Long Audio TTS with credentials: ${credsPath}`);
      initializeLongAudio(credsPath);
    } else {
      throw new Error(`Long Audio TTS not initialized. Credentials file not found at: ${credsPath}.`);
    }
  }
}

/**
 * Get or create a GCS bucket for EyeEar
 */
async function getOrCreateBucket(bucketName) {
  ensureInitialized();

  try {
    const bucket = storageClient.bucket(bucketName);
    
    // Try to check if bucket exists
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        console.log(`Using existing GCS bucket: ${bucketName}`);
        return bucket;
      }
    } catch (checkError) {
      // If we can't check (permission denied), assume bucket exists and try to use it
      // The actual error will surface when we try to write/read
      if (checkError.message && checkError.message.includes('Permission')) {
        console.warn(`Cannot check bucket existence (permission issue). Assuming bucket exists: ${bucketName}`);
        return bucket;
      }
      throw checkError;
    }

    // Bucket doesn't exist, try to create it
    try {
      console.log(`Creating GCS bucket: ${bucketName}`);
      await bucket.create({
        location: 'US', // You can change this to your preferred location
        storageClass: 'STANDARD',
      });
      console.log(`Bucket ${bucketName} created successfully`);
      return bucket;
    } catch (createError) {
      // If creation fails due to permissions, assume bucket exists
      if (createError.message && createError.message.includes('Permission')) {
        console.warn(`Cannot create bucket (permission issue). Assuming bucket exists: ${bucketName}`);
        return bucket;
      }
      throw createError;
    }
  } catch (error) {
    console.error(`Error getting/creating bucket ${bucketName}:`, error);
    throw new Error(`GCS bucket error: ${error.message}. Please ensure your service account has Storage permissions on bucket '${bucketName}'. Required roles: Storage Object Creator, Storage Object Viewer, and Storage Object Admin (for bucket operations).`);
  }
}

/**
 * Upload text file to GCS
 */
async function uploadTextToGCS(bucketName, textContent, fileName) {
  ensureInitialized();

  try {
    const bucket = await getOrCreateBucket(bucketName);
    const file = bucket.file(fileName);

    await file.save(textContent, {
      contentType: 'text/plain',
    });

    const gcsUri = `gs://${bucketName}/${fileName}`;
    console.log(`Text uploaded to GCS: ${gcsUri}`);
    return gcsUri;
  } catch (error) {
    console.error('Error uploading text to GCS:', error);
    throw error;
  }
}

/**
 * Download audio file from GCS
 */
async function downloadAudioFromGCS(bucketName, fileName, localPath) {
  ensureInitialized();

  try {
    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.download({ destination: localPath });
    console.log(`Audio downloaded from GCS to: ${localPath}`);
    return localPath;
  } catch (error) {
    console.error('Error downloading audio from GCS:', error);
    throw error;
  }
}

/**
 * Get project ID from credentials
 */
function getProjectId(credentialsPath) {
  try {
    const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    return creds.project_id;
  } catch (error) {
    console.warn('Could not read project ID from credentials:', error);
    return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  }
}

/**
 * Synthesize long audio using synthesizeLongAudio
 * According to docs, input can be text directly (up to 1MB) or GCS URI
 */
async function synthesizeLongAudio(options = {}) {
  ensureInitialized();

  const {
    textContent,
    jobId,
    voiceName = 'en-US-Chirp3-HD-Iapetus', // Chirp 3 HD Iapetus Male
    languageCode = 'en-US',
    speakingRate = 1.0,
    pitch = 0.0,
    bucketName = process.env.GCS_BUCKET_NAME || 'eyeear-ettomarett-app-bucket',
    location = process.env.GCS_LOCATION || 'global', // or 'us-central1'
    progressCallback,
  } = options;

  if (!textContent || !jobId) {
    throw new Error('textContent and jobId are required');
  }

  try {
    // Get project ID from credentials
    const credsPath = process.env.GOOGLE_CREDENTIALS_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(os.homedir(), '.eyeear', 'google_credentials.json');
    const projectId = getProjectId(credsPath);
    
    if (!projectId) {
      throw new Error('Could not determine Google Cloud project ID. Set GOOGLE_CLOUD_PROJECT environment variable or ensure credentials file contains project_id.');
    }

    // Prepare output GCS URI with timestamp to ensure uniqueness
    // Note: Long Audio Synthesis outputs LINEAR16 (WAV), not MP3
    const timestamp = Date.now();
    const outputFileName = `output/${jobId}_${timestamp}.wav`;
    const outputGcsUri = `gs://${bucketName}/${outputFileName}`;
    
    // Check if file already exists and delete it if it does
    try {
      const bucket = storageClient.bucket(bucketName);
      const file = bucket.file(outputFileName);
      const [exists] = await file.exists();
      if (exists) {
        console.log(`Output file already exists, deleting: ${outputFileName}`);
        await file.delete();
      }
    } catch (cleanupError) {
      console.warn('Could not check/delete existing file (may not exist):', cleanupError.message);
      // Continue anyway - the API will error if file exists
    }

    // Ensure bucket exists
    await getOrCreateBucket(bucketName);

    if (progressCallback) {
      progressCallback({ step: 'preparing', progress: 10 });
    }

    // Step 3: Create synthesis request
    // According to docs, input can be text directly (up to 1MB) - no need for GCS upload!
    const parent = `projects/${projectId}/locations/${location}`;
    
    const request = {
      parent: parent,
      input: {
        text: textContent, // Direct text input (up to 1MB)
      },
      voice: {
        languageCode,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16', // Long Audio Synthesis only supports LINEAR16, not MP3
        speakingRate,
        pitch,
      },
      outputGcsUri: outputGcsUri,
    };

    // Step 4: Start long audio synthesis
    console.log(`Starting long audio synthesis for project ${projectId}...`);
    const [operation] = await longAudioClient.synthesizeLongAudio(request);

    if (progressCallback) {
      progressCallback({ step: 'synthesizing', progress: 20, operationName: operation.name });
    }

    console.log(`Long audio synthesis operation started: ${operation.name}`);

    // Step 5: Wait for operation to complete with progress updates
    console.log('Waiting for long audio synthesis to complete...');
    
    try {
      const timeoutSeconds = 1800; // 30 minutes max timeout
      const startTime = Date.now();
      
      console.log(`Starting synthesis for ${textContent.length} characters...`);
      
      // Poll for completion using Google's actual progressPercent
      let completed = false;
      let lastProgressPercent = 0;
      
      while (!completed) {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        
        // Check for timeout
        if (elapsedSeconds > timeoutSeconds) {
          throw new Error(`Operation timed out after ${timeoutSeconds} seconds`);
        }
        
        // Get operation metadata with actual progress
        try {
          const [metadata] = await longAudioClient.checkSynthesizeLongAudioProgress(operation.name);
          
          if (metadata) {
            // Extract progressPercent from metadata (Google provides this!)
            const progressPercent = metadata.progressPercent || metadata.metadata?.progressPercent || 0;
            lastProgressPercent = progressPercent;
            
            // Map Google's 0-100 progress to our display range (20-90%)
            const displayProgress = 20 + Math.floor((progressPercent / 100) * 70);
            
            if (progressCallback) {
              progressCallback({ 
                step: 'synthesizing', 
                progress: displayProgress,
                operationName: operation.name,
                elapsed: Math.floor(elapsedSeconds),
                googleProgress: progressPercent
              });
            }
            
            console.log(`Synthesis progress: ${progressPercent}% (elapsed: ${Math.floor(elapsedSeconds)}s)`);
            
            if (metadata.done) {
              completed = true;
              if (metadata.error) {
                throw new Error(`Long audio synthesis failed: ${metadata.error.message || JSON.stringify(metadata.error)}`);
              }
            }
          }
        } catch (checkError) {
          // Fallback: try to get metadata from operation directly
          console.log('checkSynthesizeLongAudioProgress not available, using operation.getOperation...');
          
          try {
            const [opResult] = await longAudioClient.getOperation({ name: operation.name });
            if (opResult) {
              const progressPercent = opResult.metadata?.progressPercent || lastProgressPercent;
              const displayProgress = 20 + Math.floor((progressPercent / 100) * 70);
              
              if (progressCallback) {
                progressCallback({ 
                  step: 'synthesizing', 
                  progress: displayProgress,
                  operationName: operation.name,
                  elapsed: Math.floor(elapsedSeconds),
                  googleProgress: progressPercent
                });
              }
              
              if (opResult.done) {
                completed = true;
                if (opResult.error) {
                  throw new Error(`Long audio synthesis failed: ${opResult.error.message || JSON.stringify(opResult.error)}`);
                }
              }
            }
          } catch (getOpError) {
            // Last fallback: just wait for operation.promise()
            console.log('getOperation not available, waiting for operation promise...');
            const displayProgress = 20 + Math.floor((lastProgressPercent / 100) * 70);
            if (progressCallback) {
              progressCallback({ 
                step: 'synthesizing', 
                progress: Math.max(displayProgress, 25),
                operationName: operation.name,
                elapsed: Math.floor(elapsedSeconds)
              });
            }
          }
        }
        
        // Wait 3 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Also wait for operation.promise() to ensure full completion
      await operation.promise();
      
      console.log('Long audio synthesis completed!');
      
      if (progressCallback) {
        progressCallback({ step: 'downloading', progress: 90 });
      }

      // Step 6: Download audio from GCS
      const outputDir = path.join(__dirname, '../../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Download as WAV (LINEAR16 format) - use timestamped filename
      const localWavPath = path.join(outputDir, `${jobId}_${timestamp}.wav`);
      await downloadAudioFromGCS(bucketName, outputFileName, localWavPath);
      
      // Convert WAV to MP3 using ffmpeg (if available) for better compatibility
      let localOutputPath = localWavPath;
      try {
        const ffmpeg = require('fluent-ffmpeg');
        const localMp3Path = path.join(outputDir, `${jobId}_${timestamp}.mp3`);
        
        await new Promise((resolve, reject) => {
          ffmpeg(localWavPath)
            .toFormat('mp3')
            .on('end', () => {
              console.log('Converted WAV to MP3 successfully');
              // Delete WAV file after conversion
              fs.unlinkSync(localWavPath);
              resolve();
            })
            .on('error', (err) => {
              console.warn('FFmpeg conversion failed, keeping WAV file:', err.message);
              // If conversion fails, keep the WAV file
              resolve();
            })
            .save(localMp3Path);
        });
        
        if (fs.existsSync(localMp3Path)) {
          localOutputPath = localMp3Path;
        }
      } catch (ffmpegError) {
        console.warn('FFmpeg not available or conversion failed, keeping WAV file:', ffmpegError.message);
        // Keep WAV file if conversion fails
      }

      // Clean up GCS output file (no input file to clean since we used direct text)
      try {
        const bucket = storageClient.bucket(bucketName);
        await bucket.file(outputFileName).delete();
        console.log('Cleaned up GCS output file');
      } catch (cleanupError) {
        console.warn('Failed to clean up GCS file:', cleanupError);
      }

      if (progressCallback) {
        progressCallback({ step: 'downloaded', progress: 100 });
      }

      return {
        success: true,
        localPath: localOutputPath,
        gcsUri: outputGcsUri,
      };
    } catch (error) {
      // If result() doesn't work or times out, try manual polling
      console.log('Operation.result() failed or timed out, using manual polling...', error.message);
      
      const credsPath = process.env.GOOGLE_CREDENTIALS_PATH || 
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        path.join(os.homedir(), '.eyeear', 'google_credentials.json');
      
      // Use HTTP polling instead of OperationsClient (which doesn't exist in this package)
      const operationsClient = null; // We'll use HTTP polling

      let completed = false;
      let attempts = 0;
      const maxAttempts = 600; // 30 minutes max (3 second intervals)

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

        try {
          let updatedOperation;
          
          if (operationsClient) {
            // Use operations client if available
            [updatedOperation] = await operationsClient.getOperation({
              name: operation.name,
            });
          } else {
            // Fallback: poll using HTTP request to Google Cloud API
            const projectId = getProjectId(credsPath);
            const location = process.env.GCS_LOCATION || 'global';
            const operationName = operation.name;
            
            // Extract operation ID from full name (format: projects/.../operations/...)
            const operationId = operationName.split('/').pop();
            const apiUrl = `https://texttospeech.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/operations/${operationId}`;
            
            const { GoogleAuth } = require('google-auth-library');
            const auth = new GoogleAuth({
              keyFilename: credsPath,
              scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });
            const authClient = await auth.getClient();
            const accessToken = await authClient.getAccessToken();
            
            // Use Node.js built-in https module for HTTP requests
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
                  resolve({
                    ok: res.statusCode === 200,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    json: () => Promise.resolve(JSON.parse(data)),
                  });
                });
              });
              req.on('error', reject);
              req.end();
            });
            
            if (!response.ok) {
              throw new Error(`Failed to check operation status: ${response.status} ${response.statusText}`);
            }
            
            updatedOperation = await response.json();
          }
          
          // Extract progressPercent from operation metadata (Google provides this!)
          const progressPercent = updatedOperation.metadata?.progressPercent || 0;
          const elapsedSeconds = attempts * 3; // 3 second intervals
          
          // Map Google's 0-100 progress to our display range (20-90%)
          const displayProgress = 20 + Math.floor((progressPercent / 100) * 70);
          
          if (progressCallback && !updatedOperation.done) {
            progressCallback({ 
              step: 'synthesizing', 
              progress: displayProgress,
              operationName: operation.name,
              elapsed: elapsedSeconds,
              googleProgress: progressPercent
            });
          }
          
          console.log(`Synthesis progress (HTTP poll): ${progressPercent}% (attempt ${attempts})`);
          
          if (updatedOperation.done) {
            completed = true;
            
            if (updatedOperation.error) {
              throw new Error(`Long audio synthesis failed: ${updatedOperation.error.message}`);
            }

            console.log('Long audio synthesis completed!');
            
            if (progressCallback) {
              progressCallback({ step: 'completed', progress: 90 });
            }

            // Download audio from GCS
            const outputDir = path.join(__dirname, '../../output');
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            // Download as WAV (LINEAR16 format) - use timestamped filename
            const localWavPath = path.join(outputDir, `${jobId}_${timestamp}.wav`);
            await downloadAudioFromGCS(bucketName, outputFileName, localWavPath);
            
            // Convert WAV to MP3 using ffmpeg (if available) for better compatibility
            let localOutputPath = localWavPath;
            try {
              const ffmpeg = require('fluent-ffmpeg');
              const localMp3Path = path.join(outputDir, `${jobId}_${timestamp}.mp3`);
              
              await new Promise((resolve, reject) => {
                ffmpeg(localWavPath)
                  .toFormat('mp3')
                  .on('end', () => {
                    console.log('Converted WAV to MP3 successfully');
                    // Delete WAV file after conversion
                    fs.unlinkSync(localWavPath);
                    resolve();
                  })
                  .on('error', (err) => {
                    console.warn('FFmpeg conversion failed, keeping WAV file:', err.message);
                    // If conversion fails, keep the WAV file
                    resolve();
                  })
                  .save(localMp3Path);
              });
              
              if (fs.existsSync(localMp3Path)) {
                localOutputPath = localMp3Path;
              }
            } catch (ffmpegError) {
              console.warn('FFmpeg not available or conversion failed, keeping WAV file:', ffmpegError.message);
              // Keep WAV file if conversion fails
            }

            // Clean up GCS output file
            try {
              const bucket = storageClient.bucket(bucketName);
              await bucket.file(outputFileName).delete();
              console.log('Cleaned up GCS output file');
            } catch (cleanupError) {
              console.warn('Failed to clean up GCS file:', cleanupError);
            }

            if (progressCallback) {
              progressCallback({ step: 'downloaded', progress: 100 });
            }

            return {
              success: true,
              localPath: localOutputPath,
              gcsUri: outputGcsUri,
            };
          } else {
            // Still processing - update progress from metadata if available
            const metadata = updatedOperation.metadata;
            let progress = 20;
            if (metadata && metadata.progressPercentage !== undefined) {
              progress = 20 + Math.floor(metadata.progressPercentage * 0.7); // 20-90%
            } else {
              progress = 20 + Math.floor((attempts / maxAttempts) * 70);
            }
            
            if (progressCallback) {
              progressCallback({ step: 'synthesizing', progress, operationName: operation.name });
            }
          }
        } catch (pollError) {
          console.error('Error polling operation status:', pollError);
          throw pollError;
        }

        attempts++;
      }

      if (!completed) {
        throw new Error('Long audio synthesis timed out after 20 minutes');
      }
    }
  } catch (error) {
    console.error('Error in long audio synthesis:', error);
    throw error;
  }
}

module.exports = {
  initializeLongAudio,
  synthesizeLongAudio,
  ensureInitialized,
  getOrCreateBucket,
  uploadTextToGCS,
  downloadAudioFromGCS,
  getProjectId,
};

