import React, { useState, useEffect } from 'react';
import './PriceEstimator.css';

const API_BASE_URL = 'http://localhost:3003/api';

// Voice pricing per character (in USD) - matches backend
const VOICE_PRICING = {
  standard: { rate: 0.000004, perMillion: 4 },
  wavenet: { rate: 0.000004, perMillion: 4 },
  neural2: { rate: 0.000016, perMillion: 16 },
  polyglot: { rate: 0.000016, perMillion: 16 },
  chirp3hd: { rate: 0.00003, perMillion: 30 },
  studio: { rate: 0.00016, perMillion: 160 },
};

// Complete voice options from Google Cloud TTS
const VOICE_OPTIONS = [
  // Chirp 3 HD Voices - Premium ($30/1M chars)
  { group: 'Chirp 3 HD Voices - Female ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'en-US-Chirp3-HD-Achernar', label: 'Achernar (Female)' },
    { value: 'en-US-Chirp3-HD-Aoede', label: 'Aoede (Female, Warm)' },
    { value: 'en-US-Chirp3-HD-Autonoe', label: 'Autonoe (Female)' },
    { value: 'en-US-Chirp3-HD-Callirrhoe', label: 'Callirrhoe (Female)' },
    { value: 'en-US-Chirp3-HD-Despina', label: 'Despina (Female)' },
    { value: 'en-US-Chirp3-HD-Erinome', label: 'Erinome (Female)' },
    { value: 'en-US-Chirp3-HD-Gacrux', label: 'Gacrux (Female)' },
    { value: 'en-US-Chirp3-HD-Kore', label: 'Kore (Female, Friendly)' },
    { value: 'en-US-Chirp3-HD-Laomedeia', label: 'Laomedeia (Female)' },
    { value: 'en-US-Chirp3-HD-Leda', label: 'Leda (Female)' },
    { value: 'en-US-Chirp3-HD-Pulcherrima', label: 'Pulcherrima (Female)' },
    { value: 'en-US-Chirp3-HD-Sulafat', label: 'Sulafat (Female)' },
    { value: 'en-US-Chirp3-HD-Vindemiatrix', label: 'Vindemiatrix (Female)' },
    { value: 'en-US-Chirp3-HD-Zephyr', label: 'Zephyr (Female)' },
  ]},
  { group: 'Chirp 3 HD Voices - Male ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'en-US-Chirp3-HD-Achird', label: 'Achird (Male)' },
    { value: 'en-US-Chirp3-HD-Algenib', label: 'Algenib (Male)' },
    { value: 'en-US-Chirp3-HD-Algieba', label: 'Algieba (Male)' },
    { value: 'en-US-Chirp3-HD-Alnilam', label: 'Alnilam (Male)' },
    { value: 'en-US-Chirp3-HD-Charon', label: 'Charon (Male, Deep)' },
    { value: 'en-US-Chirp3-HD-Enceladus', label: 'Enceladus (Male)' },
    { value: 'en-US-Chirp3-HD-Fenrir', label: 'Fenrir (Male, Authoritative)' },
    { value: 'en-US-Chirp3-HD-Iapetus', label: 'Iapetus (Male, Warm)' },
    { value: 'en-US-Chirp3-HD-Orus', label: 'Orus (Male)' },
    { value: 'en-US-Chirp3-HD-Puck', label: 'Puck (Male, Playful)' },
    { value: 'en-US-Chirp3-HD-Rasalgethi', label: 'Rasalgethi (Male)' },
    { value: 'en-US-Chirp3-HD-Sadachbia', label: 'Sadachbia (Male)' },
    { value: 'en-US-Chirp3-HD-Sadaltager', label: 'Sadaltager (Male)' },
    { value: 'en-US-Chirp3-HD-Schedar', label: 'Schedar (Male)' },
    { value: 'en-US-Chirp3-HD-Umbriel', label: 'Umbriel (Male)' },
    { value: 'en-US-Chirp3-HD-Zubenelgenubi', label: 'Zubenelgenubi (Male)' },
  ]},
  // Studio Voices - Premium ($160/1M chars)
  { group: 'Studio Voices ($160/1M)', type: 'studio', voices: [
    { value: 'en-US-Studio-O', label: 'Studio O (Female)' },
    { value: 'en-US-Studio-Q', label: 'Studio Q (Male)' },
    { value: 'en-GB-Studio-B', label: 'Studio B - UK (Male)' },
    { value: 'en-GB-Studio-C', label: 'Studio C - UK (Female)' },
  ]},
  // Neural2 Voices ($16/1M chars)
  { group: 'Neural2 Voices ($16/1M)', type: 'neural2', voices: [
    { value: 'en-US-Neural2-A', label: 'Neural2 A (Male)' },
    { value: 'en-US-Neural2-C', label: 'Neural2 C (Female)' },
    { value: 'en-US-Neural2-D', label: 'Neural2 D (Male)' },
    { value: 'en-US-Neural2-E', label: 'Neural2 E (Female)' },
    { value: 'en-US-Neural2-F', label: 'Neural2 F (Female)' },
    { value: 'en-US-Neural2-G', label: 'Neural2 G (Female)' },
    { value: 'en-US-Neural2-H', label: 'Neural2 H (Female)' },
    { value: 'en-US-Neural2-I', label: 'Neural2 I (Male)' },
    { value: 'en-US-Neural2-J', label: 'Neural2 J (Male)' },
  ]},
  // WaveNet Voices ($4/1M chars)
  { group: 'WaveNet Voices ($4/1M)', type: 'wavenet', voices: [
    { value: 'en-US-Wavenet-A', label: 'Wavenet A (Male)' },
    { value: 'en-US-Wavenet-B', label: 'Wavenet B (Male)' },
    { value: 'en-US-Wavenet-C', label: 'Wavenet C (Female)' },
    { value: 'en-US-Wavenet-D', label: 'Wavenet D (Male)' },
    { value: 'en-US-Wavenet-E', label: 'Wavenet E (Female)' },
    { value: 'en-US-Wavenet-F', label: 'Wavenet F (Female)' },
    { value: 'en-US-Wavenet-G', label: 'Wavenet G (Female)' },
    { value: 'en-US-Wavenet-H', label: 'Wavenet H (Female)' },
    { value: 'en-US-Wavenet-I', label: 'Wavenet I (Male)' },
    { value: 'en-US-Wavenet-J', label: 'Wavenet J (Male)' },
  ]},
  // Standard Voices ($4/1M chars)
  { group: 'Standard Voices ($4/1M)', type: 'standard', voices: [
    { value: 'en-US-Standard-A', label: 'Standard A (Male)' },
    { value: 'en-US-Standard-B', label: 'Standard B (Male)' },
    { value: 'en-US-Standard-C', label: 'Standard C (Female)' },
    { value: 'en-US-Standard-D', label: 'Standard D (Male)' },
    { value: 'en-US-Standard-E', label: 'Standard E (Female)' },
    { value: 'en-US-Standard-F', label: 'Standard F (Female)' },
    { value: 'en-US-Standard-G', label: 'Standard G (Female)' },
    { value: 'en-US-Standard-H', label: 'Standard H (Female)' },
    { value: 'en-US-Standard-I', label: 'Standard I (Male)' },
    { value: 'en-US-Standard-J', label: 'Standard J (Male)' },
  ]},
];

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

function PriceEstimator() {
  const [calcCharacters, setCalcCharacters] = useState('');
  const [calcVoice, setCalcVoice] = useState('en-US-Chirp3-HD-Iapetus');
  const [calcResult, setCalcResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load current voice setting on mount
  useEffect(() => {
    loadCurrentVoice();
  }, []);

  // Update calculation when voice or characters change
  useEffect(() => {
    if (calcCharacters) {
      const chars = parseInt(calcCharacters.replace(/,/g, ''), 10);
      if (!isNaN(chars) && chars > 0) {
        setCalcResult(calculatePrice(chars, calcVoice));
      }
    }
  }, [calcVoice, calcCharacters]);

  const loadCurrentVoice = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.voiceName) {
          setCalcVoice(data.voiceName);
        }
      }
    } catch (err) {
      console.error('Failed to load current voice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCalcCharactersChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    const formatted = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setCalcCharacters(formatted);
    
    if (value) {
      const chars = parseInt(value, 10);
      if (!isNaN(chars) && chars > 0) {
        setCalcResult(calculatePrice(chars, calcVoice));
      }
    } else {
      setCalcResult(null);
    }
  };

  // Quick preset buttons
  const presets = [
    { label: '100K', chars: 100000 },
    { label: '250K', chars: 250000 },
    { label: '500K', chars: 500000 },
    { label: '1M', chars: 1000000 },
  ];

  const applyPreset = (chars) => {
    const formatted = chars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setCalcCharacters(formatted);
    setCalcResult(calculatePrice(chars, calcVoice));
  };

  return (
    <div className="price-estimator-container">
      <div className="price-estimator-header">
        <h2>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          Price Estimator
        </h2>
        <p>Calculate the estimated cost for text-to-speech conversion</p>
      </div>

      <div className="price-estimator-content">
        <div className="price-calculator-card">
          <div className="price-inputs">
            <div className="form-group">
              <label htmlFor="calcCharacters">Number of Characters</label>
              <input
                type="text"
                id="calcCharacters"
                value={calcCharacters}
                onChange={handleCalcCharactersChange}
                placeholder="e.g., 500,000"
              />
              <div className="preset-buttons">
                {presets.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    className="preset-btn"
                    onClick={() => applyPreset(preset.chars)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="calcVoice">Voice Type</label>
              <select
                id="calcVoice"
                value={calcVoice}
                onChange={(e) => setCalcVoice(e.target.value)}
                disabled={loading}
              >
                {VOICE_OPTIONS.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.voices.map(voice => (
                      <option key={voice.value} value={voice.value}>
                        {voice.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="price-result-section">
            {calcResult ? (
              <div className="price-result-card">
                <div className="price-main">
                  <span className="price-label">Estimated Cost</span>
                  <span className="price-amount">{calcResult.priceFormatted}</span>
                </div>
                <div className="price-details">
                  <div className="detail-row">
                    <span className="detail-label">Voice Type</span>
                    <span className="detail-value">{calcResult.voiceType.replace('chirp3hd', 'Chirp 3 HD')}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Rate</span>
                    <span className="detail-value">${calcResult.pricePerMillion}/1M chars</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Characters</span>
                    <span className="detail-value">{calcCharacters}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="price-result-placeholder">
                <svg className="placeholder-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <span className="placeholder-text">Enter character count to see estimate</span>
              </div>
            )}
          </div>
        </div>

        <div className="pricing-reference">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Voice Pricing Reference
          </h3>
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Voice Type</th>
                <th>Per Character</th>
                <th>Per 1M Characters</th>
                <th>Best For</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="voice-badge standard">Standard</span></td>
                <td>$0.000004</td>
                <td className="price-cell">$4</td>
                <td>Basic narration, drafts</td>
              </tr>
              <tr>
                <td><span className="voice-badge wavenet">WaveNet</span></td>
                <td>$0.000004</td>
                <td className="price-cell">$4</td>
                <td>Natural sounding, good quality</td>
              </tr>
              <tr>
                <td><span className="voice-badge neural2">Neural2</span></td>
                <td>$0.000016</td>
                <td className="price-cell">$16</td>
                <td>High quality, expressive</td>
              </tr>
              <tr className="highlight">
                <td><span className="voice-badge chirp3hd">Chirp 3 HD ⭐</span></td>
                <td>$0.00003</td>
                <td className="price-cell">$30</td>
                <td>Premium quality, best for audiobooks</td>
              </tr>
              <tr>
                <td><span className="voice-badge studio">Studio</span></td>
                <td>$0.00016</td>
                <td className="price-cell">$160</td>
                <td>Professional studio quality</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pricing-examples">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            Typical Book Lengths
          </h3>
          <div className="examples-grid">
            <div className="example-card">
              <svg className="example-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              <span className="example-title">Short Story</span>
              <span className="example-chars">~50,000 chars</span>
              <span className="example-price">$1.50 (Chirp 3 HD)</span>
            </div>
            <div className="example-card">
              <svg className="example-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              <span className="example-title">Novel</span>
              <span className="example-chars">~400,000 chars</span>
              <span className="example-price">$12.00 (Chirp 3 HD)</span>
            </div>
            <div className="example-card">
              <svg className="example-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              <span className="example-title">Long Novel</span>
              <span className="example-chars">~800,000 chars</span>
              <span className="example-price">$24.00 (Chirp 3 HD)</span>
            </div>
            <div className="example-card">
              <svg className="example-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              <span className="example-title">Epic</span>
              <span className="example-chars">~1,500,000 chars</span>
              <span className="example-price">$45.00 (Chirp 3 HD)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PriceEstimator;

