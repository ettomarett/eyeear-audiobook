import React, { useState, useEffect } from 'react';
import './Settings.css';

const API_BASE_URL = '/api';

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
  // Chirp HD (older version)
  { group: 'Chirp HD Voices ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'en-US-Chirp-HD-D', label: 'Chirp HD D (Male)' },
    { value: 'en-US-Chirp-HD-F', label: 'Chirp HD F (Female)' },
    { value: 'en-US-Chirp-HD-O', label: 'Chirp HD O (Female)' },
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
  // Polyglot Voices ($16/1M chars)
  { group: 'Polyglot Voices ($16/1M)', type: 'polyglot', voices: [
    { value: 'en-US-Polyglot-1', label: 'Polyglot 1 (Male)' },
    { value: 'en-AU-Polyglot-1', label: 'Polyglot 1 - AU (Male)' },
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
  // News Voices (WaveNet pricing)
  { group: 'News Voices ($4/1M)', type: 'wavenet', voices: [
    { value: 'en-US-News-K', label: 'News K (Female)' },
    { value: 'en-US-News-L', label: 'News L (Female)' },
    { value: 'en-US-News-N', label: 'News N (Male)' },
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
  // UK English voices
  { group: 'English UK - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'en-GB-Chirp3-HD-Aoede', label: 'UK - Aoede (Female)' },
    { value: 'en-GB-Chirp3-HD-Charon', label: 'UK - Charon (Male)' },
    { value: 'en-GB-Chirp3-HD-Fenrir', label: 'UK - Fenrir (Male)' },
    { value: 'en-GB-Chirp3-HD-Iapetus', label: 'UK - Iapetus (Male)' },
    { value: 'en-GB-Chirp3-HD-Kore', label: 'UK - Kore (Female)' },
    { value: 'en-GB-Chirp3-HD-Puck', label: 'UK - Puck (Male)' },
  ]},
  { group: 'English UK - Neural2 ($16/1M)', type: 'neural2', voices: [
    { value: 'en-GB-Neural2-A', label: 'UK Neural2 A (Female)' },
    { value: 'en-GB-Neural2-B', label: 'UK Neural2 B (Male)' },
    { value: 'en-GB-Neural2-C', label: 'UK Neural2 C (Female)' },
    { value: 'en-GB-Neural2-D', label: 'UK Neural2 D (Male)' },
    { value: 'en-GB-Neural2-F', label: 'UK Neural2 F (Female)' },
  ]},
  // Australian English
  { group: 'English AU - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'en-AU-Chirp3-HD-Aoede', label: 'AU - Aoede (Female)' },
    { value: 'en-AU-Chirp3-HD-Charon', label: 'AU - Charon (Male)' },
    { value: 'en-AU-Chirp3-HD-Iapetus', label: 'AU - Iapetus (Male)' },
    { value: 'en-AU-Chirp3-HD-Kore', label: 'AU - Kore (Female)' },
  ]},
  // Spanish
  { group: 'Spanish - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'es-ES-Chirp3-HD-Aoede', label: 'ES - Aoede (Female)' },
    { value: 'es-ES-Chirp3-HD-Charon', label: 'ES - Charon (Male)' },
    { value: 'es-ES-Chirp3-HD-Iapetus', label: 'ES - Iapetus (Male)' },
    { value: 'es-ES-Chirp3-HD-Kore', label: 'ES - Kore (Female)' },
    { value: 'es-US-Chirp3-HD-Aoede', label: 'ES-US - Aoede (Female)' },
    { value: 'es-US-Chirp3-HD-Charon', label: 'ES-US - Charon (Male)' },
    { value: 'es-US-Chirp3-HD-Iapetus', label: 'ES-US - Iapetus (Male)' },
  ]},
  // French
  { group: 'French - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'fr-FR-Chirp3-HD-Aoede', label: 'FR - Aoede (Female)' },
    { value: 'fr-FR-Chirp3-HD-Charon', label: 'FR - Charon (Male)' },
    { value: 'fr-FR-Chirp3-HD-Iapetus', label: 'FR - Iapetus (Male)' },
    { value: 'fr-FR-Chirp3-HD-Kore', label: 'FR - Kore (Female)' },
    { value: 'fr-CA-Chirp3-HD-Aoede', label: 'FR-CA - Aoede (Female)' },
    { value: 'fr-CA-Chirp3-HD-Charon', label: 'FR-CA - Charon (Male)' },
  ]},
  // German
  { group: 'German - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'de-DE-Chirp3-HD-Aoede', label: 'DE - Aoede (Female)' },
    { value: 'de-DE-Chirp3-HD-Charon', label: 'DE - Charon (Male)' },
    { value: 'de-DE-Chirp3-HD-Iapetus', label: 'DE - Iapetus (Male)' },
    { value: 'de-DE-Chirp3-HD-Kore', label: 'DE - Kore (Female)' },
  ]},
  // Italian
  { group: 'Italian - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'it-IT-Chirp3-HD-Aoede', label: 'IT - Aoede (Female)' },
    { value: 'it-IT-Chirp3-HD-Charon', label: 'IT - Charon (Male)' },
    { value: 'it-IT-Chirp3-HD-Iapetus', label: 'IT - Iapetus (Male)' },
    { value: 'it-IT-Chirp3-HD-Kore', label: 'IT - Kore (Female)' },
  ]},
  // Portuguese
  { group: 'Portuguese - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'pt-BR-Chirp3-HD-Aoede', label: 'PT-BR - Aoede (Female)' },
    { value: 'pt-BR-Chirp3-HD-Charon', label: 'PT-BR - Charon (Male)' },
    { value: 'pt-BR-Chirp3-HD-Iapetus', label: 'PT-BR - Iapetus (Male)' },
    { value: 'pt-BR-Chirp3-HD-Kore', label: 'PT-BR - Kore (Female)' },
  ]},
  // Japanese
  { group: 'Japanese - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'ja-JP-Chirp3-HD-Aoede', label: 'JP - Aoede (Female)' },
    { value: 'ja-JP-Chirp3-HD-Charon', label: 'JP - Charon (Male)' },
    { value: 'ja-JP-Chirp3-HD-Iapetus', label: 'JP - Iapetus (Male)' },
    { value: 'ja-JP-Chirp3-HD-Kore', label: 'JP - Kore (Female)' },
  ]},
  // Korean
  { group: 'Korean - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'ko-KR-Chirp3-HD-Aoede', label: 'KR - Aoede (Female)' },
    { value: 'ko-KR-Chirp3-HD-Charon', label: 'KR - Charon (Male)' },
    { value: 'ko-KR-Chirp3-HD-Iapetus', label: 'KR - Iapetus (Male)' },
    { value: 'ko-KR-Chirp3-HD-Kore', label: 'KR - Kore (Female)' },
  ]},
  // Chinese
  { group: 'Chinese - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'cmn-CN-Chirp3-HD-Aoede', label: 'CN - Aoede (Female)' },
    { value: 'cmn-CN-Chirp3-HD-Charon', label: 'CN - Charon (Male)' },
    { value: 'cmn-CN-Chirp3-HD-Iapetus', label: 'CN - Iapetus (Male)' },
    { value: 'cmn-CN-Chirp3-HD-Kore', label: 'CN - Kore (Female)' },
  ]},
  // Hindi
  { group: 'Hindi - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'hi-IN-Chirp3-HD-Aoede', label: 'HI - Aoede (Female)' },
    { value: 'hi-IN-Chirp3-HD-Charon', label: 'HI - Charon (Male)' },
    { value: 'hi-IN-Chirp3-HD-Iapetus', label: 'HI - Iapetus (Male)' },
    { value: 'hi-IN-Chirp3-HD-Kore', label: 'HI - Kore (Female)' },
  ]},
  // Arabic
  { group: 'Arabic - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'ar-XA-Chirp3-HD-Aoede', label: 'AR - Aoede (Female)' },
    { value: 'ar-XA-Chirp3-HD-Charon', label: 'AR - Charon (Male)' },
    { value: 'ar-XA-Chirp3-HD-Iapetus', label: 'AR - Iapetus (Male)' },
    { value: 'ar-XA-Chirp3-HD-Kore', label: 'AR - Kore (Female)' },
  ]},
  // Dutch
  { group: 'Dutch - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'nl-NL-Chirp3-HD-Aoede', label: 'NL - Aoede (Female)' },
    { value: 'nl-NL-Chirp3-HD-Charon', label: 'NL - Charon (Male)' },
    { value: 'nl-NL-Chirp3-HD-Iapetus', label: 'NL - Iapetus (Male)' },
  ]},
  // Russian
  { group: 'Russian - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'ru-RU-Chirp3-HD-Aoede', label: 'RU - Aoede (Female)' },
    { value: 'ru-RU-Chirp3-HD-Charon', label: 'RU - Charon (Male)' },
    { value: 'ru-RU-Chirp3-HD-Fenrir', label: 'RU - Fenrir (Male)' },
    { value: 'ru-RU-Chirp3-HD-Kore', label: 'RU - Kore (Female)' },
  ]},
  // Turkish
  { group: 'Turkish - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'tr-TR-Chirp3-HD-Aoede', label: 'TR - Aoede (Female)' },
    { value: 'tr-TR-Chirp3-HD-Charon', label: 'TR - Charon (Male)' },
    { value: 'tr-TR-Chirp3-HD-Iapetus', label: 'TR - Iapetus (Male)' },
  ]},
  // Polish
  { group: 'Polish - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'pl-PL-Chirp3-HD-Aoede', label: 'PL - Aoede (Female)' },
    { value: 'pl-PL-Chirp3-HD-Charon', label: 'PL - Charon (Male)' },
    { value: 'pl-PL-Chirp3-HD-Iapetus', label: 'PL - Iapetus (Male)' },
  ]},
  // Swedish
  { group: 'Swedish - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'sv-SE-Chirp3-HD-Aoede', label: 'SV - Aoede (Female)' },
    { value: 'sv-SE-Chirp3-HD-Charon', label: 'SV - Charon (Male)' },
    { value: 'sv-SE-Chirp3-HD-Iapetus', label: 'SV - Iapetus (Male)' },
  ]},
  // Norwegian
  { group: 'Norwegian - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'nb-NO-Chirp3-HD-Aoede', label: 'NO - Aoede (Female)' },
    { value: 'nb-NO-Chirp3-HD-Charon', label: 'NO - Charon (Male)' },
    { value: 'nb-NO-Chirp3-HD-Iapetus', label: 'NO - Iapetus (Male)' },
  ]},
  // Danish
  { group: 'Danish - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'da-DK-Chirp3-HD-Aoede', label: 'DA - Aoede (Female)' },
    { value: 'da-DK-Chirp3-HD-Charon', label: 'DA - Charon (Male)' },
    { value: 'da-DK-Chirp3-HD-Iapetus', label: 'DA - Iapetus (Male)' },
  ]},
  // Finnish
  { group: 'Finnish - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'fi-FI-Chirp3-HD-Aoede', label: 'FI - Aoede (Female)' },
    { value: 'fi-FI-Chirp3-HD-Charon', label: 'FI - Charon (Male)' },
    { value: 'fi-FI-Chirp3-HD-Iapetus', label: 'FI - Iapetus (Male)' },
  ]},
  // Greek
  { group: 'Greek - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'el-GR-Chirp3-HD-Aoede', label: 'EL - Aoede (Female)' },
    { value: 'el-GR-Chirp3-HD-Charon', label: 'EL - Charon (Male)' },
    { value: 'el-GR-Chirp3-HD-Iapetus', label: 'EL - Iapetus (Male)' },
  ]},
  // Hebrew
  { group: 'Hebrew - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'he-IL-Chirp3-HD-Aoede', label: 'HE - Aoede (Female)' },
    { value: 'he-IL-Chirp3-HD-Charon', label: 'HE - Charon (Male)' },
    { value: 'he-IL-Chirp3-HD-Iapetus', label: 'HE - Iapetus (Male)' },
  ]},
  // Czech
  { group: 'Czech - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'cs-CZ-Chirp3-HD-Aoede', label: 'CS - Aoede (Female)' },
    { value: 'cs-CZ-Chirp3-HD-Charon', label: 'CS - Charon (Male)' },
    { value: 'cs-CZ-Chirp3-HD-Iapetus', label: 'CS - Iapetus (Male)' },
  ]},
  // Romanian
  { group: 'Romanian - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'ro-RO-Chirp3-HD-Aoede', label: 'RO - Aoede (Female)' },
    { value: 'ro-RO-Chirp3-HD-Charon', label: 'RO - Charon (Male)' },
    { value: 'ro-RO-Chirp3-HD-Iapetus', label: 'RO - Iapetus (Male)' },
  ]},
  // Hungarian
  { group: 'Hungarian - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'hu-HU-Chirp3-HD-Aoede', label: 'HU - Aoede (Female)' },
    { value: 'hu-HU-Chirp3-HD-Charon', label: 'HU - Charon (Male)' },
    { value: 'hu-HU-Chirp3-HD-Iapetus', label: 'HU - Iapetus (Male)' },
  ]},
  // Ukrainian
  { group: 'Ukrainian - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'uk-UA-Chirp3-HD-Aoede', label: 'UK - Aoede (Female)' },
    { value: 'uk-UA-Chirp3-HD-Charon', label: 'UK - Charon (Male)' },
    { value: 'uk-UA-Chirp3-HD-Iapetus', label: 'UK - Iapetus (Male)' },
  ]},
  // Vietnamese
  { group: 'Vietnamese - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'vi-VN-Chirp3-HD-Aoede', label: 'VI - Aoede (Female)' },
    { value: 'vi-VN-Chirp3-HD-Charon', label: 'VI - Charon (Male)' },
    { value: 'vi-VN-Chirp3-HD-Iapetus', label: 'VI - Iapetus (Male)' },
  ]},
  // Thai
  { group: 'Thai - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'th-TH-Chirp3-HD-Aoede', label: 'TH - Aoede (Female)' },
    { value: 'th-TH-Chirp3-HD-Charon', label: 'TH - Charon (Male)' },
    { value: 'th-TH-Chirp3-HD-Iapetus', label: 'TH - Iapetus (Male)' },
  ]},
  // Indonesian
  { group: 'Indonesian - Chirp 3 HD ($30/1M)', type: 'chirp3hd', voices: [
    { value: 'id-ID-Chirp3-HD-Aoede', label: 'ID - Aoede (Female)' },
    { value: 'id-ID-Chirp3-HD-Charon', label: 'ID - Charon (Male)' },
    { value: 'id-ID-Chirp3-HD-Iapetus', label: 'ID - Iapetus (Male)' },
  ]},
];

function Settings() {
  const [settings, setSettings] = useState({
    googleCredentialsPath: '',
    gcsBucketName: '',
    gcsLocation: 'global',
    googleCloudProject: '',
    voiceName: 'en-US-Chirp3-HD-Iapetus',
    languageCode: 'en-US',
    speakingRate: 1.0,
    pitch: 0.0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!window.confirm('Reset all settings to defaults? This will restore the original configuration.')) {
      return;
    }
    
    try {
      setResetting(true);
      setMessage({ type: '', text: '' });

      const response = await fetch(`${API_BASE_URL}/settings/reset`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        setMessage({ type: 'success', text: 'Settings reset to defaults!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to reset settings' });
      }
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setMessage({ type: 'error', text: 'Failed to reset settings: ' + err.message });
    } finally {
      setResetting(false);
    }
  };

  const testConnection = async () => {
    try {
      setTestingConnection(true);
      setMessage({ type: '', text: '' });

      const response = await fetch(`${API_BASE_URL}/settings/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setMessage({ type: 'success', text: `✓ Connection successful! Project: ${result.projectId}` });
      } else {
        setMessage({ type: 'error', text: result.error || 'Connection test failed' });
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setMessage({ type: 'error', text: 'Connection test failed: ' + err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleFileSelect = async () => {
    const path = prompt(
      'Enter the full path to your Google Cloud credentials JSON file:\n\n' +
      'Example: /home/user/.eyeear/google_credentials.json\n\n' +
      'You can download this file from:\n' +
      'Google Cloud Console → IAM & Admin → Service Accounts → Keys'
    );
    if (path) {
      setSettings(prev => ({ ...prev, googleCredentialsPath: path }));
    }
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-4.242 0L5.636 18.364m12.728 0l-4.243-4.243m-4.242 0L5.636 5.636"></path>
          </svg>
          Settings
        </h2>
        <p>Configure your Google Cloud Text-to-Speech settings</p>
      </div>

      {message.text && (
        <div className={`settings-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-sections">
        {/* Voice Settings Section - FIRST */}
        <div className="settings-section voice-settings">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            Voice Settings
          </h3>
          <p className="section-description">
            Configure the default voice and audio settings for TTS generation. Prices shown per 1M characters.
          </p>

          <div className="form-group">
            <label htmlFor="voiceName">Voice Name</label>
            <select
              id="voiceName"
              name="voiceName"
              value={settings.voiceName}
              onChange={handleChange}
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
            <span className="help-text">
              Choose the voice for text-to-speech synthesis
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="languageCode">Language</label>
            <select
              id="languageCode"
              name="languageCode"
              value={settings.languageCode}
              onChange={handleChange}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="en-AU">English (Australia)</option>
              <option value="en-IN">English (India)</option>
              <option value="es-ES">Spanish (Spain)</option>
              <option value="es-US">Spanish (US)</option>
              <option value="fr-FR">French (France)</option>
              <option value="fr-CA">French (Canada)</option>
              <option value="de-DE">German (Germany)</option>
              <option value="it-IT">Italian (Italy)</option>
              <option value="pt-BR">Portuguese (Brazil)</option>
              <option value="pt-PT">Portuguese (Portugal)</option>
              <option value="ja-JP">Japanese (Japan)</option>
              <option value="ko-KR">Korean (Korea)</option>
              <option value="cmn-CN">Chinese (Mandarin)</option>
              <option value="hi-IN">Hindi (India)</option>
              <option value="ar-XA">Arabic</option>
              <option value="nl-NL">Dutch (Netherlands)</option>
              <option value="ru-RU">Russian</option>
              <option value="pl-PL">Polish</option>
              <option value="tr-TR">Turkish</option>
              <option value="sv-SE">Swedish</option>
              <option value="nb-NO">Norwegian</option>
              <option value="da-DK">Danish</option>
              <option value="fi-FI">Finnish</option>
              <option value="el-GR">Greek</option>
              <option value="he-IL">Hebrew</option>
              <option value="cs-CZ">Czech</option>
              <option value="ro-RO">Romanian</option>
              <option value="hu-HU">Hungarian</option>
              <option value="uk-UA">Ukrainian</option>
              <option value="vi-VN">Vietnamese</option>
              <option value="th-TH">Thai</option>
              <option value="id-ID">Indonesian</option>
            </select>
            <span className="help-text">
              Language for text-to-speech synthesis
            </span>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label htmlFor="speakingRate">Speaking Rate</label>
              <div className="range-input">
                <input
                  type="range"
                  id="speakingRate"
                  name="speakingRate"
                  min="0.25"
                  max="4.0"
                  step="0.05"
                  value={settings.speakingRate}
                  onChange={handleChange}
                />
                <span className="range-value">{settings.speakingRate.toFixed(2)}x</span>
              </div>
              <span className="help-text">0.25x to 4.0x (1.0 = normal)</span>
            </div>

            <div className="form-group half">
              <label htmlFor="pitch">Pitch</label>
              <div className="range-input">
                <input
                  type="range"
                  id="pitch"
                  name="pitch"
                  min="-20"
                  max="20"
                  step="0.5"
                  value={settings.pitch}
                  onChange={handleChange}
                />
                <span className="range-value">{settings.pitch > 0 ? '+' : ''}{settings.pitch.toFixed(1)}</span>
              </div>
              <span className="help-text">-20 to +20 semitones (0 = default)</span>
            </div>
          </div>
        </div>

        {/* Google Cloud Credentials Section */}
        <div className="settings-section">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Google Cloud Credentials
          </h3>
          <p className="section-description">
            Configure your Google Cloud service account credentials for Text-to-Speech API access.
          </p>

          <div className="form-group">
            <label htmlFor="googleCredentialsPath">
              Credentials JSON File Path
              <span className="required">*</span>
            </label>
            <div className="file-input-group">
              <input
                type="text"
                id="googleCredentialsPath"
                name="googleCredentialsPath"
                value={settings.googleCredentialsPath}
                onChange={handleChange}
                placeholder="/path/to/google_credentials.json"
              />
              <button type="button" className="browse-btn" onClick={handleFileSelect}>
                Browse...
              </button>
            </div>
            <span className="help-text">
              Path to your Google Cloud service account JSON key file
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="googleCloudProject">
              Project ID
              <span className="optional">(auto-detected from credentials)</span>
            </label>
            <input
              type="text"
              id="googleCloudProject"
              name="googleCloudProject"
              value={settings.googleCloudProject}
              onChange={handleChange}
              placeholder="my-project-id"
            />
            <span className="help-text">
              Your Google Cloud project ID (usually auto-detected from credentials file)
            </span>
          </div>
        </div>

        {/* GCS Storage Section */}
        <div className="settings-section">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            Google Cloud Storage
          </h3>
          <p className="section-description">
            Configure the GCS bucket for storing audio files during long audio synthesis.
          </p>

          <div className="form-group">
            <label htmlFor="gcsBucketName">
              Bucket Name
              <span className="required">*</span>
            </label>
            <input
              type="text"
              id="gcsBucketName"
              name="gcsBucketName"
              value={settings.gcsBucketName}
              onChange={handleChange}
              placeholder="my-audiobook-bucket"
            />
            <span className="help-text">
              GCS bucket name for storing temporary audio files (must exist in your project)
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="gcsLocation">Location</label>
            <select
              id="gcsLocation"
              name="gcsLocation"
              value={settings.gcsLocation}
              onChange={handleChange}
            >
              <option value="global">Global</option>
              <option value="us-central1">US Central (us-central1)</option>
              <option value="us-east1">US East (us-east1)</option>
              <option value="us-west1">US West (us-west1)</option>
              <option value="europe-west1">Europe West (europe-west1)</option>
              <option value="asia-east1">Asia East (asia-east1)</option>
            </select>
            <span className="help-text">
              Region for long audio synthesis operations
            </span>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button
          className="reset-btn"
          onClick={resetToDefaults}
          disabled={resetting}
        >
          {resetting ? 'Resetting...' : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Reset to Defaults
            </>
          )}
        </button>
        <button
          className="test-btn"
          onClick={testConnection}
          disabled={testingConnection || !settings.googleCredentialsPath}
        >
          {testingConnection ? 'Testing...' : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Test Connection
            </>
          )}
        </button>
        <button
          className="save-btn"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Save Settings
            </>
          )}
        </button>
      </div>

      <div className="settings-help">
        <h4>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          Setup Guide
        </h4>
        <ol>
          <li>
            <strong>Create a Google Cloud Project</strong> at{' '}
            <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
              console.cloud.google.com
            </a>
          </li>
          <li>
            <strong>Enable the Text-to-Speech API</strong> in your project's API Library
          </li>
          <li>
            <strong>Create a Service Account</strong> with "Cloud Text-to-Speech API User" role
          </li>
          <li>
            <strong>Download the JSON key</strong> and save it to a secure location
          </li>
          <li>
            <strong>Create a GCS Bucket</strong> for storing audio files during synthesis
          </li>
          <li>
            <strong>Grant Storage permissions</strong> to your service account:
            <ul>
              <li>Storage Object Admin</li>
              <li>Storage Object Creator</li>
              <li>Storage Object Viewer</li>
            </ul>
          </li>
        </ol>
      </div>
    </div>
  );
}

export default Settings;
