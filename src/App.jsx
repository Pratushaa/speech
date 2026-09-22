import React, { useState, useEffect } from 'react';
import { Mic, Send, AlertCircle, FileText, Sparkles, Cpu } from 'lucide-react';
import PipelineDiagram from './components/PipelineDiagram';
import LanguageSelector from './components/LanguageSelector';
import ProviderSelector from './components/ProviderSelector';
import AudioRecorder from './components/AudioRecorder';
import ResultCard from './components/ResultCard';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [backendHealth, setBackendHealth] = useState({
    online: false,
    bhashini_configured: false,
    gemini_configured: false,
    mock_mode: true
  });

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 3000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const resp = await fetch(`${API_BASE}/health`);
      if (resp.ok) {
        const data = await resp.json();
        setBackendHealth({
          online: true,
          bhashini_configured: data.bhashini_configured,
          gemini_configured: data.gemini_configured,
          mock_mode: data.mock_mode
        });
      } else {
        setBackendHealth((prev) => ({ ...prev, online: false }));
      }
    } catch {
      try {
        const directResp = await fetch('http://127.0.0.1:8000/health');
        if (directResp.ok) {
          const data = await directResp.json();
          setBackendHealth({
            online: true,
            bhashini_configured: data.bhashini_configured,
            gemini_configured: data.gemini_configured,
            mock_mode: data.mock_mode
          });
        }
      } catch {
        setBackendHealth((prev) => ({ ...prev, online: false }));
      }
    }
  };

  const handleAudioReady = (file, url) => {
    setAudioFile(file);
    setAudioUrl(url);
    setErrorMessage(null);
    setPipelineStep(1);
  };

  const handleAudioCleared = () => {
    setAudioFile(null);
    setAudioUrl(null);
    setResult(null);
    setErrorMessage(null);
    setPipelineStep(0);
  };

  const handleRecordingStateChange = (recording) => {
    setIsRecording(recording);
    if (recording) {
      setPipelineStep(1);
      setResult(null);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async () => {
    if (!audioFile) {
      setErrorMessage("Please record audio or upload an audio file first.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setPipelineStep(2); // Step 2: sending to backend

    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('source_language', selectedLanguage);
    formData.append('target_language', 'en');
    formData.append('provider', selectedProvider);

    try {
      const stepTimer1 = setTimeout(() => setPipelineStep(3), 500); // ASR
      const stepTimer2 = setTimeout(() => setPipelineStep(4), 1100); // Translation

      let targetUrl = `${API_BASE}/transcribe`;
      let response;

      try {
        response = await fetch(targetUrl, {
          method: 'POST',
          body: formData,
        });
      } catch {
        targetUrl = 'http://127.0.0.1:8000/transcribe';
        response = await fetch(targetUrl, {
          method: 'POST',
          body: formData,
        });
      }

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setPipelineStep(5);
      setResult(data);
    } catch (err) {
      console.error("Transcription error:", err);
      let message = err.message || "Failed to process audio.";
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
        message = "FastAPI backend server is not reachable on port 8000. Please start the backend service: 'uvicorn main:app --reload --port 8000'.";
      }
      setErrorMessage(message);
      setPipelineStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-layout" id="app-root-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-icon-box">
            <Mic size={28} />
          </div>
          <div>
            <h1 className="brand-title">Multilingual Speech Hub</h1>
            <p className="brand-subtitle">
              Dual-Engine Speech-to-Text &amp; Translation: Bhashini AI + Google Gemini
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="header-status-badge" id="backend-status-indicator">
            <span
              className="status-dot"
              style={{
                backgroundColor: backendHealth.online ? '#10b981' : '#ef4444',
                boxShadow: backendHealth.online ? '0 0 10px #10b981' : '0 0 10px #ef4444'
              }}
            ></span>
            <span>
              {backendHealth.online
                ? (backendHealth.gemini_configured
                    ? "FastAPI (Gemini Key Live)"
                    : backendHealth.bhashini_configured
                    ? "FastAPI (Bhashini Live)"
                    : "FastAPI Online (Demo Mode)")
                : "Backend Offline (Port 8000)"}
            </span>
          </div>
        </div>
      </header>

      {/* Pipeline Diagram Component */}
      <PipelineDiagram currentStep={pipelineStep} provider={result?.provider || selectedProvider} />

      {/* Main Workspace (Two Columns) */}
      <main className="main-workspace-grid">
        {/* Left Column: Input Panel */}
        <section className="glass-panel" id="audio-input-panel">
          <h2 className="panel-title">
            <Mic size={20} />
            Voice Input &amp; Configuration
          </h2>

          <ProviderSelector
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProvider}
            providerStatus={backendHealth}
            disabled={isProcessing || isRecording}
          />

          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onSelectLanguage={setSelectedLanguage}
            disabled={isProcessing || isRecording}
          />

          <AudioRecorder
            onAudioReady={handleAudioReady}
            onAudioCleared={handleAudioCleared}
            onRecordingStateChange={handleRecordingStateChange}
            isProcessing={isProcessing}
          />

          {errorMessage && (
            <div className="alert-error" style={{ marginTop: '1rem' }} id="app-error-alert">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              id="transcribe-submit-btn"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!audioFile || isProcessing || isRecording}
            >
              {isProcessing ? (
                <>
                  <div className="spinner"></div>
                  <span>Processing Speech with AI...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Transcribe &amp; Translate</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Right Column: Results Panel */}
        <section className="glass-panel" id="results-display-panel">
          <h2 className="panel-title">
            <FileText size={20} />
            Transcription &amp; Translation Output
          </h2>

          {result ? (
            <ResultCard
              transcription={result.transcription}
              translation={result.translation}
              sourceLanguage={result.source_language || selectedLanguage}
              durationSeconds={result.duration_seconds}
              isMock={result.is_mock}
              provider={result.provider}
              modelInfo={result.model_info}
            />
          ) : (
            <div className="empty-placeholder" id="empty-state-placeholder">
              <FileText size={48} />
              <div>
                <h3 style={{ color: 'var(--text-main)', fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                  No Transcription Yet
                </h3>
                <p style={{ fontSize: '0.85rem' }}>
                  Speak or upload regional audio on the left, then click <strong>Transcribe &amp; Translate</strong> to see the results here.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
