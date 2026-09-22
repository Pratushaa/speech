import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Trash2, Volume2, Music, AlertCircle, RefreshCw } from 'lucide-react';

export default function AudioRecorder({
  onAudioReady,
  onAudioCleared,
  onRecordingStateChange,
  isProcessing = false
}) {
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'upload'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      stopTracks();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage("Audio recording is not supported in this browser. Please use the Upload Audio tab.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // Audio Context for Visualizer
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          audioContextRef.current = audioCtx;

          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          drawVisualizer();
        }
      } catch (e) {
        console.warn("Visualizer audio context init notice:", e);
      }

      // Determine the best supported audio MIME type across Chrome, Firefox, Edge, Safari
      let mimeType = '';
      let extension = 'webm';

      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
          extension = 'webm';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
          extension = 'webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
          extension = 'mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
          extension = 'ogg';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
          extension = 'wav';
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // High-fidelity audio buffer downsampling & WAV encoding using OfflineAudioContext
      async function convertBufferToCleanWav(audioBuffer, targetSampleRate = 16000) {
        let processedBuffer = audioBuffer;
        
        // Use OfflineAudioContext for hardware-accelerated anti-aliased resampling
        const AudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (AudioContextClass) {
          try {
            const targetLength = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate));
            const offlineCtx = new AudioContextClass(1, targetLength, targetSampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineCtx.destination);
            source.start(0);
            processedBuffer = await offlineCtx.startRendering();
          } catch (resampleErr) {
            console.warn("OfflineAudioContext resampling notice, falling back to direct channel:", resampleErr);
          }
        }

        const channelData = processedBuffer.getChannelData(0);
        const actualSampleRate = processedBuffer.sampleRate;
        const sampleCount = channelData.length;
        const byteLength = sampleCount * 2;
        const buffer = new ArrayBuffer(44 + byteLength);
        const view = new DataView(buffer);

        const writeString = (v, offset, str) => {
          for (let i = 0; i < str.length; i++) {
            v.setUint8(offset + i, str.charCodeAt(i));
          }
        };

        /* RIFF header */
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + byteLength, true);
        writeString(view, 8, 'WAVE');
        /* fmt chunk */
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);          // 16 for PCM
        view.setUint16(20, 1, true);           // Format 1 = PCM
        view.setUint16(22, 1, true);           // 1 channel (mono)
        view.setUint32(24, actualSampleRate, true);
        view.setUint32(28, actualSampleRate * 2, true); // Byte rate
        view.setUint16(32, 2, true);           // Block align
        view.setUint16(34, 16, true);          // 16-bit
        /* data chunk */
        writeString(view, 36, 'data');
        view.setUint32(40, byteLength, true);

        // 16-bit PCM conversion with soft limiting to prevent harsh digital clipping
        let offset = 44;
        for (let i = 0; i < sampleCount; i++) {
          const s = Math.max(-1, Math.min(1, channelData[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
          offset += 2;
        }

        return new Blob([view], { type: 'audio/wav' });
      }

      recorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });

        let finalBlob = rawBlob;
        let finalExt = extension;
        let finalMime = rawBlob.type || 'audio/webm';

        try {
          // Convert to clean 16kHz mono WAV for high-accuracy speech recognition
          const arrayBuffer = await rawBlob.arrayBuffer();
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const tempCtx = new AudioContextClass();
            const decoded = await tempCtx.decodeAudioData(arrayBuffer);
            finalBlob = await convertBufferToCleanWav(decoded, 16000);
            finalExt = 'wav';
            finalMime = 'audio/wav';
            if (tempCtx.state !== 'closed') {
              tempCtx.close();
            }
          }
        } catch (convErr) {
          console.warn("WAV conversion notice (retaining pristine recording):", convErr);
        }

        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);

        const file = new File(
          [finalBlob],
          `recording-${Date.now()}.${finalExt}`,
          { type: finalMime }
        );
        setAudioFile(file);

        if (onAudioReady) {
          onAudioReady(file, url);
        }

        stopTracks();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      if (onRecordingStateChange) {
        onRecordingStateChange(true);
      }

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access error:", err);
      let msg = "Could not access microphone.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Microphone permission denied. Please allow microphone access in your browser settings.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = "No microphone hardware detected on this device.";
      }
      setErrorMessage(msg);
      setIsRecording(false);
      if (onRecordingStateChange) onRecordingStateChange(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (typeof mediaRecorderRef.current.requestData === 'function') {
          mediaRecorderRef.current.requestData();
        }
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Recorder stop error:", e);
      }
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    if (onRecordingStateChange) {
      onRecordingStateChange(false);
    }
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.6;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * (canvas.height * 0.85);

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#00f2fe');
        gradient.addColorStop(1, '#7928ca');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, Math.max(1, barWidth - 2), barHeight);

        x += barWidth;
      }
    };

    render();
  };

  const clearAudio = () => {
    if (audioUrl) {
      try { URL.revokeObjectURL(audioUrl); } catch {}
    }
    setAudioUrl(null);
    setAudioFile(null);
    setRecordingDuration(0);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onAudioCleared) onAudioCleared();
  };

  const handleFileProcess = (file) => {
    if (!file) return;

    const validExtensions = /\.(wav|mp3|m4a|mp4|ogg|webm|flac|aac)$/i;
    if (!file.type.startsWith('audio/') && !file.name.match(validExtensions)) {
      setErrorMessage("Please select a supported audio file (.wav, .mp3, .webm, .m4a, .ogg, .flac)");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage("Audio file exceeds the 25MB limit. Please choose a smaller recording.");
      return;
    }

    setErrorMessage(null);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioFile(file);

    if (onAudioReady) {
      onAudioReady(file, url);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    handleFileProcess(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileProcess(file);
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recorder-hub-wrapper" id="audio-input-hub">
      {/* Tabs */}
      <div className="tab-switcher" id="audio-input-mode-tabs">
        <button
          type="button"
          id="tab-btn-mic"
          className={`tab-btn ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => setActiveTab('record')}
          disabled={isRecording || isProcessing}
        >
          <Mic size={15} />
          Record Voice
        </button>
        <button
          type="button"
          id="tab-btn-upload"
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
          disabled={isRecording || isProcessing}
        >
          <Upload size={15} />
          Upload Audio File
        </button>
      </div>

      {errorMessage && (
        <div className="alert-error" id="recorder-error-alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Record Mode */}
      {activeTab === 'record' && (
        <div className="recorder-hub">
          <div className="record-btn-container">
            {isRecording && <div className="record-pulse-ring"></div>}
            <button
              type="button"
              id="main-record-toggle-btn"
              className={`record-main-btn ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              {isRecording ? <Square size={26} /> : <Mic size={30} />}
            </button>
          </div>

          <div className={`recording-timer ${isRecording ? 'live' : ''}`} id="recording-timer-display">
            {isRecording && <span className="status-dot"></span>}
            {formatTimer(recordingDuration)}
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isRecording
              ? "Listening... Speak clearly in your selected regional language."
              : audioUrl
              ? "Audio clip recorded! Ready for transcription."
              : "Click the microphone button to start speaking"}
          </p>

          <canvas
            ref={canvasRef}
            className="visualizer-canvas"
            width={400}
            height={64}
            id="audio-visualizer-canvas"
            style={{ display: isRecording ? 'block' : 'none' }}
          />
        </div>
      )}

      {/* Upload Mode */}
      {activeTab === 'upload' && (
        <div
          className={`file-drop-area ${isDragging ? 'dragover' : ''}`}
          id="file-drop-zone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.mp4,.flac,.aac"
            style={{ display: 'none' }}
            id="audio-file-input"
          />
          <div style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: isDragging ? 'rgba(0, 242, 254, 0.2)' : 'rgba(0, 242, 254, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <Music size={22} />
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            {audioFile ? audioFile.name : (isDragging ? "Drop audio file here..." : "Click or drag audio file here")}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Supports WAV, MP3, WebM, M4A, OGG up to 25MB
          </div>
        </div>
      )}

      {/* Audio Playback & Preview */}
      {audioUrl && (
        <div className="audio-preview-card" id="audio-playback-preview">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Volume2 size={14} />
              Audio Clip Ready ({audioFile?.name || 'Voice recording'})
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={clearAudio}
              disabled={isProcessing}
              title="Remove audio"
              id="clear-audio-btn"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <audio controls src={audioUrl} id="audio-player-element" />
        </div>
      )}
    </div>
  );
}
