import React from 'react';
import { Mic, ArrowRight, Server, AudioLines, Languages, MonitorCheck, Check, Sparkles } from 'lucide-react';

export default function PipelineDiagram({ currentStep = 0, provider = 'auto' }) {
  const isGemini = provider === 'gemini';
  const asrTitle = isGemini ? "Gemini Audio ASR" : "Bhashini ASR";
  const asrDesc = isGemini ? "Gemini Multimodal extracts speech" : "BHASHINI ASR converts speech to text";
  
  const transTitle = isGemini ? "Gemini NMT Translation" : "Bhashini Translation";
  const transDesc = isGemini ? "Gemini translates text to English" : "BHASHINI translation tool to English";

  const steps = [
    {
      id: 1,
      name: "User Input",
      desc: "User speaks regional language",
      icon: <Mic size={18} />,
    },
    {
      id: 2,
      name: "Frontend & Backend",
      desc: "React frontend sends to FastAPI",
      icon: <Server size={18} />,
    },
    {
      id: 3,
      name: asrTitle,
      desc: asrDesc,
      icon: <AudioLines size={18} />,
    },
    {
      id: 4,
      name: transTitle,
      desc: transDesc,
      icon: <Languages size={18} />,
    },
    {
      id: 5,
      name: "Display Result",
      desc: "Model displays English text",
      icon: <MonitorCheck size={18} />,
    }
  ];

  return (
    <div className="glass-panel pipeline-container" id="pipeline-diagram-section">
      <div className="pipeline-header">
        <h2 className="panel-title" style={{ margin: 0 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-cyan)' }}></span>
          Generative AI &amp; Speech Pipeline Architecture
        </h2>
        <span className="pipeline-header-subtitle">
          Audio &rarr; FastAPI &rarr; {isGemini ? "Google Gemini Multimodal" : "Bhashini ULCA"} &rarr; English Output
        </span>
      </div>

      <div className="pipeline-steps-wrapper" id="pipeline-steps-grid">
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div
              key={step.id}
              className={`pipeline-step-box ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              id={`pipeline-step-${step.id}`}
            >
              <div className="pipeline-step-number">
                <span>Step {step.id}</span>
                {isCompleted ? (
                  <Check size={14} style={{ color: 'var(--accent-green)' }} />
                ) : (
                  step.icon
                )}
              </div>
              <h3 className="pipeline-step-title">{step.name}</h3>
              <p className="pipeline-step-desc">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
