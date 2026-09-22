import React from 'react';
import { Globe } from 'lucide-react';

export const INDIAN_LANGUAGES = [
  { code: 'auto', name: 'Auto-Detect', native: 'Auto-Detect (স্বয়ংক্রিয় / स्वचालित)' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
];

export default function LanguageSelector({
  selectedLanguage,
  onSelectLanguage,
  disabled = false
}) {
  return (
    <div className="input-group" id="language-selector-group">
      <label className="input-label" htmlFor="source-language-select">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Globe size={15} style={{ color: 'var(--accent-cyan)' }} />
          Select Spoken Regional Language
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
          {INDIAN_LANGUAGES.find(l => l.code === selectedLanguage)?.native || ''}
        </span>
      </label>

      <div className="select-wrapper">
        <select
          id="source-language-select"
          value={selectedLanguage}
          onChange={(e) => onSelectLanguage(e.target.value)}
          disabled={disabled}
        >
          {INDIAN_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} — {lang.native} ({lang.code})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
