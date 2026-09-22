import React, { useState } from 'react';
import { Copy, Check, Volume2, Sparkles, Clock, Cpu, Building2 } from 'lucide-react';

export default function ResultCard({
  transcription,
  translation,
  sourceLanguage,
  durationSeconds,
  isMock,
  provider = 'bhashini',
  modelInfo
}) {
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedTranslation, setCopiedTranslation] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'transcript') {
        setCopiedTranscript(true);
        setTimeout(() => setCopiedTranscript(false), 2000);
      } else {
        setCopiedTranslation(true);
        setTimeout(() => setCopiedTranslation(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const isGemini = provider === 'gemini';

  return (
    <div className="results-stack" id="transcription-results-container">
      {isMock && (
        <div style={{
          padding: '0.6rem 1rem',
          borderRadius: '8px',
          background: 'rgba(234, 179, 8, 0.15)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          color: '#fef08a',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>⚠️ <strong>Demo Mode:</strong> Displaying simulated speech data because real provider credentials are unavailable or mock mode is enabled.</span>
        </div>
      )}

      {/* Original Transcription Card */}
      <div className="result-card" id="card-original-transcription">
        <div className="result-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="result-badge transcription">1. Original Transcription</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ({sourceLanguage?.toUpperCase() || 'REGIONAL'})
            </span>
          </div>
          <div className="result-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => copyToClipboard(transcription, 'transcript')}
              title="Copy transcript"
              id="copy-transcript-btn"
            >
              {copiedTranscript ? <Check size={14} style={{ color: 'var(--accent-green)' }} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="result-text-content" id="transcription-text-display">
          {transcription || "No transcription generated."}
        </div>

        <div className="result-meta-footer">
          <span>Words: {transcription ? transcription.trim().split(/\s+/).length : 0}</span>
          <span>Chars: {transcription ? transcription.length : 0}</span>
        </div>
      </div>

      {/* English Translation Card */}
      <div className="result-card highlight" id="card-english-translation">
        <div className="result-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="result-badge translation">2. English Translation</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
              (EN)
            </span>
            <span className="result-badge-provider" style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: isGemini ? 'rgba(121, 40, 202, 0.2)' : 'rgba(0, 242, 254, 0.15)',
              color: isGemini ? '#c084fc' : '#00f2fe',
              border: `1px solid ${isGemini ? 'rgba(121, 40, 202, 0.4)' : 'rgba(0, 242, 254, 0.3)'}`
            }}>
              {isGemini ? 'Google Gemini' : 'Bhashini AI'}
            </span>
          </div>
          <div className="result-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => speakText(translation)}
              title={isSpeaking ? "Stop Speaking" : "Read Aloud"}
              id="tts-translation-btn"
              style={{ color: isSpeaking ? 'var(--accent-cyan)' : 'inherit' }}
            >
              <Volume2 size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => copyToClipboard(translation, 'translation')}
              title="Copy translation"
              id="copy-translation-btn"
            >
              {copiedTranslation ? <Check size={14} style={{ color: 'var(--accent-green)' }} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="result-text-content" id="translation-text-display" style={{ color: '#e0f2fe' }}>
          {translation || "No translation generated."}
        </div>

        <div className="result-meta-footer">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={12} />
            {durationSeconds ? `${durationSeconds}s` : '< 1s'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {isGemini ? <Cpu size={12} /> : <Building2 size={12} />}
            {isMock ? `${isGemini ? "Gemini" : "Bhashini"} (Demo Mode)` : (modelInfo || "Live AI Model")}
          </span>
        </div>
      </div>
    </div>
  );
}
