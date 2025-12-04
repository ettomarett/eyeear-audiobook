import React, { useState, useEffect } from 'react';
import './ExtractionPreview.css';

const API_BASE_URL = 'http://localhost:3001/api';

// Voice pricing per character (in USD) - matches backend
const VOICE_PRICING = {
  standard: { rate: 0.000004, perMillion: 4 },
  wavenet: { rate: 0.000004, perMillion: 4 },
  neural2: { rate: 0.000016, perMillion: 16 },
  polyglot: { rate: 0.000016, perMillion: 16 },
  chirp3hd: { rate: 0.00003, perMillion: 30 },
  studio: { rate: 0.00016, perMillion: 160 },
};

function getVoiceType(voiceName) {
  const name = voiceName.toLowerCase();
  if (name.includes('studio')) return 'studio';
  if (name.includes('chirp3-hd') || name.includes('chirp3hd') || name.includes('chirp-hd')) return 'chirp3hd';
  if (name.includes('neural2')) return 'neural2';
  if (name.includes('polyglot')) return 'polyglot';
  if (name.includes('wavenet') || name.includes('news')) return 'wavenet';
  return 'standard';
}

function calculatePrice(characterCount, voiceName) {
  const voiceType = getVoiceType(voiceName);
  const pricing = VOICE_PRICING[voiceType] || VOICE_PRICING.standard;
  const totalPrice = characterCount * pricing.rate;
  return {
    price: totalPrice,
    priceFormatted: totalPrice < 0.01 ? `$${totalPrice.toFixed(4)}` : `$${totalPrice.toFixed(2)}`,
    voiceType,
    pricePerMillion: pricing.perMillion,
  };
}

function getVoiceTypeLabel(type) {
  const labels = {
    standard: 'Standard',
    wavenet: 'WaveNet',
    neural2: 'Neural2',
    polyglot: 'Polyglot',
    chirp3hd: 'Chirp 3 HD',
    studio: 'Studio',
  };
  return labels[type] || type;
}

function ExtractionPreview({ bookTitle, characterCount, onGenerateSpeech, onCancel }) {
  const [voiceName, setVoiceName] = useState(null);
  const [priceInfo, setPriceInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load settings every time component mounts or characterCount changes (new extraction)
  useEffect(() => {
    console.log('ExtractionPreview: Loading voice settings...');
    loadVoiceSetting();
  }, [characterCount]);

  useEffect(() => {
    if (voiceName && characterCount) {
      console.log('ExtractionPreview: Calculating price for voice:', voiceName);
      setPriceInfo(calculatePrice(characterCount, voiceName));
    }
  }, [voiceName, characterCount]);

  const loadVoiceSetting = async (retries = 3, delay = 500) => {
    setLoading(true);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      const url = `${API_BASE_URL}/settings?_t=${Date.now()}`;
      console.log(`ExtractionPreview: Fetching settings (attempt ${attempt}/${retries})...`);
      
      try {
        const response = await fetch(url);
        
        if (response.ok) {
          const settings = await response.json();
          console.log('ExtractionPreview: Got settings:', settings.voiceName);
          
          if (settings.voiceName) {
            setVoiceName(settings.voiceName);
            setLoading(false);
            return; // Success!
          }
        }
        console.warn(`ExtractionPreview: Attempt ${attempt} failed, status:`, response.status);
      } catch (err) {
        console.warn(`ExtractionPreview: Attempt ${attempt} error:`, err.message);
      }
      
      // Wait before retry (except on last attempt)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All retries failed, use default
    console.error('ExtractionPreview: All retries failed, using default voice');
    setVoiceName('en-US-Chirp3-HD-Iapetus');
    setLoading(false);
  };

  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const estimatedMinutes = Math.ceil(characterCount / 1000); // Rough estimate: ~1000 chars per minute
  const estimatedHours = Math.floor(estimatedMinutes / 60);
  const remainingMinutes = estimatedMinutes % 60;

  const isOverLimit = characterCount > 1000000; // 1 million character limit for long audio

  return (
    <div className="extraction-preview">
      <h2>Text Extraction Complete</h2>
      <div className="book-info">
        <h3>{bookTitle}</h3>
      </div>

      <div className="stats-box">
        <div className="stat-item">
          <div className="stat-label">Characters</div>
          <div className="stat-value">{formatNumber(characterCount)}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Estimated Duration</div>
          <div className="stat-value">
            {estimatedHours > 0 ? `${estimatedHours}h ` : ''}
            {remainingMinutes > 0 ? `${remainingMinutes}m` : '~1m'}
          </div>
        </div>
        {loading ? (
          <div className="stat-item stat-price">
            <div className="stat-label">Estimated Cost</div>
            <div className="stat-value price-value">Loading...</div>
          </div>
        ) : priceInfo && (
          <div className="stat-item stat-price">
            <div className="stat-label">Estimated Cost</div>
            <div className="stat-value price-value">{priceInfo.priceFormatted}</div>
            <div className="stat-subtitle">
              {getVoiceTypeLabel(priceInfo.voiceType)} · ${priceInfo.pricePerMillion}/1M chars
            </div>
            <div className="stat-voice-name">
              Voice: {voiceName}
            </div>
          </div>
        )}
      </div>

      {isOverLimit && (
        <div className="warning-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <strong>Warning:</strong> This book exceeds the 1 million character limit for long audio synthesis.
          The text will need to be split into multiple parts.
        </div>
      )}

      {!isOverLimit && characterCount > 500000 && (
        <div className="info-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <strong>Note:</strong> Large books may take several minutes to process.
        </div>
      )}

      <div className="action-buttons">
        <button className="btn-generate" onClick={onGenerateSpeech}>
          Generate Speech
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ExtractionPreview;
