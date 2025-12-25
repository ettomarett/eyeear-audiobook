const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const router = express.Router();
const settingsService = require('../services/settingsService');

// GET /api/settings - Get current settings
router.get('/', (req, res) => {
  try {
    // Disable caching to always return fresh settings
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const settings = settingsService.loadSettings();
    console.log('Returning settings:', JSON.stringify(settings));
    res.json(settings);
  } catch (err) {
    console.error('Error loading settings:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// GET /api/settings/defaults - Get default settings
router.get('/defaults', (req, res) => {
  try {
    res.json(settingsService.defaultSettings);
  } catch (err) {
    console.error('Error getting defaults:', err);
    res.status(500).json({ error: 'Failed to get default settings' });
  }
});

// GET /api/settings/pricing - Get voice pricing info
router.get('/pricing', (req, res) => {
  try {
    res.json({
      pricing: settingsService.VOICE_PRICING,
      description: {
        standard: 'Standard voices - $4 per 1M characters',
        wavenet: 'WaveNet voices - $4 per 1M characters',
        neural2: 'Neural2 voices - $16 per 1M characters',
        polyglot: 'Polyglot voices - $16 per 1M characters',
        chirp3hd: 'Chirp 3 HD voices - $30 per 1M characters',
        studio: 'Studio voices - $160 per 1M characters',
      }
    });
  } catch (err) {
    console.error('Error getting pricing:', err);
    res.status(500).json({ error: 'Failed to get pricing info' });
  }
});

// POST /api/settings - Save settings
router.post('/', (req, res) => {
  try {
    const settings = req.body;
    settingsService.saveSettings(settings);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Failed to save settings: ' + err.message });
  }
});

// POST /api/settings/reset - Reset to default settings
router.post('/reset', (req, res) => {
  try {
    const defaults = settingsService.resetToDefaults();
    res.json({ success: true, message: 'Settings reset to defaults', settings: defaults });
  } catch (err) {
    console.error('Error resetting settings:', err);
    res.status(500).json({ error: 'Failed to reset settings: ' + err.message });
  }
});

// POST /api/settings/import-omars-creds - Import Omar's default credentials
router.post('/import-omars-creds', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Verify password (using SHA256 hash)
    // You can set an environment variable OMARS_CREDS_PASSWORD or use default
    const expectedPassword = process.env.OMARS_CREDS_PASSWORD || 'omarscreds2024';
    const providedHash = crypto.createHash('sha256').update(password).digest('hex');
    const expectedHash = crypto.createHash('sha256').update(expectedPassword).digest('hex');
    
    if (providedHash !== expectedHash) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Import Omar's default credentials
    // On VPS/Docker, the path should be /app/data/google_credentials.json
    // On local, it should be /home/ettomar/.eyeear/google_credentials.json
    const isDocker = process.env.NODE_ENV === 'production' || fs.existsSync('/app/data');
    const credentialsPath = isDocker 
      ? '/app/data/google_credentials.json'
      : '/home/ettomar/.eyeear/google_credentials.json';
    
    const omarsSettings = {
      googleCredentialsPath: credentialsPath,
      gcsBucketName: 'eyeear-ettomarett-app-bucket',
      gcsLocation: 'us-east1',
      googleCloudProject: 'absolute-garden-428804-e8',
      voiceName: 'en-US-Chirp3-HD-Iapetus',
      languageCode: 'en-US',
      speakingRate: 1.0,
      pitch: 0.0,
    };
    
    settingsService.saveSettings(omarsSettings);
    res.json({ success: true, message: 'Omar\'s credentials imported successfully', settings: omarsSettings });
  } catch (err) {
    console.error('Error importing Omar\'s credentials:', err);
    res.status(500).json({ error: 'Failed to import credentials: ' + err.message });
  }
});

// POST /api/settings/calculate-price - Calculate price estimate
router.post('/calculate-price', (req, res) => {
  try {
    const { characterCount, voiceName } = req.body;
    
    if (!characterCount || characterCount < 0) {
      return res.status(400).json({ error: 'Valid character count is required' });
    }
    
    const voice = voiceName || settingsService.getSetting('voiceName') || 'en-US-Chirp3-HD-Iapetus';
    const priceInfo = settingsService.calculatePrice(characterCount, voice);
    
    res.json({
      characterCount,
      voiceName: voice,
      ...priceInfo,
    });
  } catch (err) {
    console.error('Error calculating price:', err);
    res.status(500).json({ error: 'Failed to calculate price: ' + err.message });
  }
});

// POST /api/settings/test-connection - Test Google Cloud connection
router.post('/test-connection', async (req, res) => {
  try {
    const settings = req.body;
    const result = await settingsService.testConnection(settings);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error('Error testing connection:', err);
    res.status(500).json({ error: 'Failed to test connection: ' + err.message });
  }
});

// GET /api/settings/:key - Get a specific setting
router.get('/:key', (req, res) => {
  try {
    const value = settingsService.getSetting(req.params.key);
    if (value === undefined) {
      res.status(404).json({ error: 'Setting not found' });
    } else {
      res.json({ key: req.params.key, value });
    }
  } catch (err) {
    console.error('Error getting setting:', err);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

module.exports = router;
