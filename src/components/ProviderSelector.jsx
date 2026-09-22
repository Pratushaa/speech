import React from 'react';
import { Cpu, Sparkles, Building2, Layers } from 'lucide-react';

export default function ProviderSelector({
  selectedProvider,
  onSelectProvider,
  providerStatus = {},
  disabled = false
}) {
  const providers = [
    {
      id: 'auto',
      name: 'Auto / Smart',
      sub: 'Best active engine',
      icon: <Sparkles size={16} />,
      badge: 'Auto'
    },
    {
      id: 'bhashini',
      name: 'Bhashini AI',
      sub: 'Govt. of India ULCA',
      icon: <Building2 size={16} />,
      isLive: providerStatus.bhashini_configured,
      badge: providerStatus.bhashini_configured ? 'Live Key' : 'Demo Mode'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      sub: 'Multimodal Audio AI',
      icon: <Cpu size={16} />,
      isLive: providerStatus.gemini_configured,
      badge: providerStatus.gemini_configured ? 'Live Key' : 'Demo Mode'
    }
  ];

  return (
    <div className="input-group" id="provider-selector-container">
      <label className="input-label">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Layers size={15} style={{ color: 'var(--accent-cyan)' }} />
          Select AI Engine
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {selectedProvider === 'gemini' ? 'Google Cloud' : selectedProvider === 'bhashini' ? 'Bhashini ULCA' : 'Auto Routing'}
        </span>
      </label>

      <div className="provider-grid" id="provider-options-grid">
        {providers.map((p) => {
          const isSelected = selectedProvider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              id={`provider-btn-${p.id}`}
              className={`provider-card-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectProvider(p.id)}
              disabled={disabled}
            >
              <div className="provider-icon-title">
                <div className="provider-mini-icon">
                  {p.icon}
                </div>
                <div>
                  <div className="provider-name">{p.name}</div>
                  <div className="provider-sub">{p.sub}</div>
                </div>
              </div>

              <span className={`provider-badge ${p.isLive ? 'live' : ''}`}>
                {p.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
