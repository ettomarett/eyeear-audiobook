const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');
const DATA_DIR = path.join(__dirname, '../../data');

// Voice pricing per character (in USD)
const VOICE_PRICING = {
  standard: 0.000004,    // $4 per 1M chars
  wavenet: 0.000004,     // $4 per 1M chars
  neural2: 0.000016,     // $16 per 1M chars
  polyglot: 0.000016,    // $16 per 1M chars
  chirp3hd: 0.00003,     // $30 per 1M chars
  studio: 0.00016,       // $160 per 1M chars
};

// Voice type detection from voice name
function getVoiceType(voiceName) {
  const name = voiceName.toLowerCase();
  if (name.includes('studio')) return 'studio';
  if (name.includes('chirp3-hd') || name.includes('chirp3hd') || name.includes('chirp-hd')) return 'chirp3hd';
  if (name.includes('neural2')) return 'neural2';
  if (name.includes('polyglot')) return 'polyglot';
  if (name.includes('wavenet') || name.includes('news')) return 'wavenet';
  return 'standard';
}

// Calculate estimated price based on characters and voice
function calculatePrice(characterCount, voiceName) {
  const voiceType = getVoiceType(voiceName);
  const pricePerChar = VOICE_PRICING[voiceType] || VOICE_PRICING.standard;
  const totalPrice = characterCount * pricePerChar;
  return {
    price: totalPrice,
    priceFormatted: totalPrice < 0.01 ? `$${totalPrice.toFixed(4)}` : `$${totalPrice.toFixed(2)}`,
    voiceType,
    pricePerMillion: (pricePerChar * 1000000).toFixed(0),
  };
}

// Default settings - these are your preferred defaults
const defaultSettings = {
  googleCredentialsPath: '/home/ettomar/.eyeear/google_credentials.json',
  gcsBucketName: 'eyeear-ettomarett-app-bucket',
  gcsLocation: 'us-east1',
  googleCloudProject: 'absolute-garden-428804-e8',
  voiceName: 'en-US-Chirp3-HD-Iapetus',
  languageCode: 'en-US',
  speakingRate: 1.0,
  pitch: 0.0,
};

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load settings from file
function loadSettings() {
  ensureDataDir();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(data);
      return { ...defaultSettings, ...settings };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return { ...defaultSettings };
}

// Save settings to file
function saveSettings(settings) {
  ensureDataDir();
  try {
    const settingsToSave = { ...defaultSettings, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2));
    
    // Also update environment variables for immediate use
    applySettings(settingsToSave);
    
    return true;
  } catch (err) {
    console.error('Error saving settings:', err);
    throw err;
  }
}

// Reset settings to defaults
function resetToDefaults() {
  ensureDataDir();
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    applySettings(defaultSettings);
    return { ...defaultSettings };
  } catch (err) {
    console.error('Error resetting settings:', err);
    throw err;
  }
}

// Apply settings to environment variables
function applySettings(settings) {
  if (settings.googleCredentialsPath) {
    process.env.GOOGLE_CREDENTIALS_PATH = settings.googleCredentialsPath;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = settings.googleCredentialsPath;
  }
  if (settings.gcsBucketName) {
    process.env.GCS_BUCKET_NAME = settings.gcsBucketName;
  }
  if (settings.gcsLocation) {
    process.env.GCS_LOCATION = settings.gcsLocation;
  }
  if (settings.googleCloudProject) {
    process.env.GOOGLE_CLOUD_PROJECT = settings.googleCloudProject;
    process.env.GCLOUD_PROJECT = settings.googleCloudProject;
  }
}

// Load and apply settings on startup
function initializeSettings() {
  const settings = loadSettings();
  applySettings(settings);
  console.log('Settings initialized from:', SETTINGS_FILE);
  return settings;
}

// Test connection with Google Cloud
async function testConnection(settings) {
  try {
    // Temporarily apply settings for testing
    const originalEnv = {
      GOOGLE_CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
      GCS_LOCATION: process.env.GCS_LOCATION,
    };
    
    applySettings(settings);
    
    // Check if credentials file exists
    if (!settings.googleCredentialsPath) {
      throw new Error('Google credentials path is required');
    }
    
    if (!fs.existsSync(settings.googleCredentialsPath)) {
      throw new Error(`Credentials file not found: ${settings.googleCredentialsPath}`);
    }
    
    // Try to read and parse the credentials file
    const credsContent = fs.readFileSync(settings.googleCredentialsPath, 'utf-8');
    const credentials = JSON.parse(credsContent);
    
    if (!credentials.project_id) {
      throw new Error('Invalid credentials file: missing project_id');
    }
    
    // Try to initialize TTS client
    const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
    const client = new TextToSpeechClient({
      keyFilename: settings.googleCredentialsPath,
    });
    
    // List voices to verify connection
    const [result] = await client.listVoices({ languageCode: 'en-US' });
    
    if (!result.voices || result.voices.length === 0) {
      throw new Error('No voices available - API may not be enabled');
    }
    
    // Restore original env
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key]) {
        process.env[key] = originalEnv[key];
      }
    });
    
    return {
      success: true,
      projectId: credentials.project_id,
      voicesAvailable: result.voices.length,
    };
  } catch (err) {
    console.error('Connection test failed:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

// Get a specific setting value
function getSetting(key) {
  const settings = loadSettings();
  return settings[key];
}

module.exports = {
  loadSettings,
  saveSettings,
  resetToDefaults,
  initializeSettings,
  testConnection,
  getSetting,
  calculatePrice,
  getVoiceType,
  defaultSettings,
  VOICE_PRICING,
};
