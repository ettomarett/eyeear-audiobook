const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');
const os = require('os');
const RateLimiter = require('../utils/rateLimiter');

// Initialize TTS client
let ttsClient = null;
let rateLimiter = null;

function initializeTTS(credentialsPath) {
  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    throw new Error(`Google Cloud credentials file not found: ${credentialsPath}`);
  }

  try {
    ttsClient = new textToSpeech.TextToSpeechClient({
      keyFilename: credentialsPath,
    });

    rateLimiter = new RateLimiter(200); // 200 RPM for Chirp 3 HD
    console.log(`TTS initialized with credentials: ${credentialsPath}`);
  } catch (error) {
    console.error('Error initializing TTS client:', error);
    throw new Error(`Failed to initialize TTS client: ${error.message}`);
  }
}

function isInitialized() {
  return ttsClient !== null && rateLimiter !== null;
}

function ensureInitialized() {
  if (!isInitialized()) {
    // Try to auto-initialize with default path
    const homeDir = os.homedir();
    const credsPath = process.env.GOOGLE_CREDENTIALS_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(homeDir, '.eyeear', 'google_credentials.json');
    
    if (credsPath && fs.existsSync(credsPath)) {
      console.log(`Auto-initializing TTS with credentials: ${credsPath}`);
      initializeTTS(credsPath);
    } else {
      throw new Error(`TTS not initialized. Credentials file not found at: ${credsPath}. Please call /api/tts/initialize with a valid credentials path or set GOOGLE_CREDENTIALS_PATH environment variable.`);
    }
  }
}

/**
 * Generate speech for a text chunk
 */
async function generateSpeech(chunk, options = {}) {
  ensureInitialized(); // Auto-initialize if needed

  const {
    voiceName = 'en-US-Chirp3-HD-Iapetus',
    languageCode = 'en-US',
    speakingRate = 1.0,
    pitch = 0.0,
    outputPath,
  } = options;

  // Validate chunk size before sending
  const chunkByteSize = Buffer.from(chunk.text, 'utf8').length;
  if (chunkByteSize > 5000) {
    throw new Error(`Chunk ${chunk.index} is too large: ${chunkByteSize} bytes (max 5000). This should not happen - chunking logic needs fixing.`);
  }

  const request = {
    input: { text: chunk.text },
    voice: {
      languageCode,
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate,
      pitch,
    },
  };

  try {
    const [response] = await rateLimiter.executeWithRetry(async () => {
      return await ttsClient.synthesizeSpeech(request);
    });

    const audioContent = response.audioContent;

    if (outputPath) {
      fs.writeFileSync(outputPath, audioContent, 'binary');
    }

    return {
      audioContent,
      outputPath,
      chunkIndex: chunk.index,
      byteSize: chunk.byteSize,
    };
  } catch (error) {
    console.error(`Error generating speech for chunk ${chunk.index}:`, error);
    throw error;
  }
}

/**
 * Generate speech for multiple chunks sequentially
 */
async function generateSpeechForChunks(chunks, options = {}, progressCallback) {
  const results = [];
  const outputDir = options.outputDir || path.join(__dirname, '../../temp');

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const outputPath = path.join(outputDir, `chunk_${String(chunk.index).padStart(4, '0')}.mp3`);

    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: chunks.length,
        chunkIndex: chunk.index,
        status: 'generating',
      });
    }

    try {
      const result = await generateSpeech(chunk, {
        ...options,
        outputPath,
      });

      results.push(result);
    } catch (error) {
      console.error(`Failed to generate speech for chunk ${chunk.index}:`, error);
      throw error;
    }
  }

  return results;
}

module.exports = {
  initializeTTS,
  generateSpeech,
  generateSpeechForChunks,
  isInitialized,
  ensureInitialized,
};

