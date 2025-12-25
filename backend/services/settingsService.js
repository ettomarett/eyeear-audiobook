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
  const result = {
    success: false,
    projectId: null,
    ttsApiEnabled: false,
    storageApiEnabled: false,
    billingEnabled: null, // null = unknown, true = enabled, false = disabled
    bucketAccessible: false,
    voicesAvailable: 0,
    warnings: [],
    errors: [],
  };

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
      result.errors.push('Google credentials path is required');
      return result;
    }
    
    if (!fs.existsSync(settings.googleCredentialsPath)) {
      result.errors.push(`Credentials file not found: ${settings.googleCredentialsPath}`);
      return result;
    }
    
    // Try to read and parse the credentials file
    const credsContent = fs.readFileSync(settings.googleCredentialsPath, 'utf-8');
    const credentials = JSON.parse(credsContent);
    
    if (!credentials.project_id) {
      result.errors.push('Invalid credentials file: missing project_id');
      return result;
    }
    
    result.projectId = credentials.project_id;
    
    // Test TTS API
    try {
      const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
      const ttsClient = new TextToSpeechClient({
        keyFilename: settings.googleCredentialsPath,
      });
      
      const [ttsResult] = await ttsClient.listVoices({ languageCode: 'en-US' });
      
      if (ttsResult.voices && ttsResult.voices.length > 0) {
        result.ttsApiEnabled = true;
        result.voicesAvailable = ttsResult.voices.length;
      } else {
        result.warnings.push('TTS API connected but no voices found');
      }
    } catch (ttsError) {
      result.errors.push(`TTS API: ${ttsError.message}`);
      if (ttsError.message.includes('API not enabled') || ttsError.message.includes('not enabled')) {
        result.warnings.push('Text-to-Speech API may not be enabled. Enable it in Google Cloud Console.');
      }
    }
    
    // Test Storage API
    try {
      const { Storage } = require('@google-cloud/storage');
      const storage = new Storage({
        keyFilename: settings.googleCredentialsPath,
      });
      
      if (settings.gcsBucketName) {
        const bucket = storage.bucket(settings.gcsBucketName);
        try {
          const [files] = await bucket.getFiles({ maxResults: 1 });
          result.storageApiEnabled = true;
          result.bucketAccessible = true;
        } catch (bucketError) {
          result.storageApiEnabled = true; // API is enabled, but bucket access may be restricted
          if (bucketError.message.includes('PERMISSION_DENIED') || bucketError.message.includes('does not have')) {
            result.warnings.push('Storage API enabled but bucket access denied. Check service account permissions.');
          } else if (bucketError.message.includes('not exist')) {
            result.warnings.push(`Bucket "${settings.gcsBucketName}" does not exist. Create it in Google Cloud Console.`);
          } else {
            result.warnings.push(`Bucket access: ${bucketError.message}`);
          }
        }
      } else {
        result.warnings.push('GCS bucket name not configured');
      }
    } catch (storageError) {
      result.errors.push(`Storage API: ${storageError.message}`);
      if (storageError.message.includes('API not enabled') || storageError.message.includes('not enabled')) {
        result.warnings.push('Cloud Storage API may not be enabled. Enable it in Google Cloud Console.');
      }
    }
    
    // Check billing status (try to make a simple API call that requires billing)
    // Note: This is a best-effort check, as billing API requires special permissions
    try {
      // Try to use a premium voice feature that requires billing
      if (result.ttsApiEnabled) {
        const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
        const ttsClient = new TextToSpeechClient({
          keyFilename: settings.googleCredentialsPath,
        });
        
        // Try to list Chirp 3 HD voices (premium, requires billing)
        try {
          const [premiumResult] = await ttsClient.listVoices({ languageCode: 'en-US' });
          const hasPremiumVoices = premiumResult.voices?.some(v => 
            v.name?.includes('Chirp3-HD') || v.name?.includes('Studio')
          );
          
          if (hasPremiumVoices) {
            result.billingEnabled = true;
          } else {
            // If we can list voices but no premium voices, billing might not be enabled
            result.billingEnabled = false;
            result.warnings.push('Premium voices (Chirp 3 HD, Studio) not available. Billing may not be enabled.');
          }
        } catch (billingError) {
          // If we get a billing-related error, billing is likely not enabled
          if (billingError.message.includes('billing') || billingError.message.includes('quota') || 
              billingError.message.includes('PERMISSION_DENIED')) {
            result.billingEnabled = false;
            result.warnings.push('Billing may not be enabled. Enable billing in Google Cloud Console to use premium features.');
          }
        }
      }
    } catch (billingCheckError) {
      // Billing check failed, but that's okay
      result.warnings.push('Could not verify billing status. Ensure billing is enabled for premium features.');
    }
    
    // Determine overall success
    result.success = result.ttsApiEnabled && result.storageApiEnabled && result.errors.length === 0;
    
    // Restore original env
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key]) {
        process.env[key] = originalEnv[key];
      }
    });
    
    return result;
  } catch (err) {
    console.error('Connection test failed:', err);
    result.errors.push(err.message);
    return result;
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
