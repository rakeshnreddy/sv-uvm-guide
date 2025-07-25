"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';

const steps = [
  { from: 'Sequence', to: 'Sequencer', action: 'start_item(seq_item)', description: 'Sequence requests to send a new item.' },
  { from: 'Sequencer', to: 'Driver', action: 'get_next_item(req)', description: 'Sequencer arbitrates and sends item to Driver.' },
  { from: 'Driver', to: 'DUT', action: 'Drive Pins', description: 'Driver translates item to pin wiggles.' },
  { from: 'DUT', to: 'Driver', action: 'DUT Responds', description: 'DUT processes data and responds.' },
  { from: 'Driver', to: 'Sequencer', action: 'item_done(rsp)', description: 'Driver signals completion, optionally with response data.' },
  { from: 'Sequencer', to: 'Sequence', action: 'finish_item(seq_item)', description: 'Sequencer informs Sequence item is complete.' },
];

const participants = [
  { id: 'Sequence', name: 'Sequence', x: 100 },
  { id: 'Sequencer', name: 'Sequencer', x: 300 },
  { id: 'Driver', name: 'Driver', x: 500 },
  { id: 'DUT', name: 'DUT', x: 700 },
];

export const AnimatedUvmSequenceDriverHandshakeDiagram: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNextStep = () => {
    setCurrentStep((prev) => (prev < steps.length -1 ? prev + 1 : prev));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleReset = () => {
    setCurrentStep(0);
  };

  const lifelineHeight = 400;
  const messageSpacing = 60;

  return (
    <div style={{ textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <svg className="w-full h-auto" height={lifelineHeight + 100} viewBox={`0 0 800 ${lifelineHeight + 100}`} role="img" aria-label="UVM sequence-driver handshake diagram"> 
        {/* Participants and Lifelines */}
        {participants.map(p => (
          <g key={p.id}>
            <text x={p.x} y="30" textAnchor="middle" fontWeight="bold">{p.name}</text>
            <line
              x1={p.x}
              y1="50"
              x2={p.x}
              y2={lifelineHeight}
              stroke="#aaa"
              strokeDasharray="5,5"
            />
          </g>
        ))}

        {/* Messages */}
        {steps.slice(0, currentStep + 1).map((step, index) => {
          const fromParticipant = participants.find(p => p.id === step.from);
          const toParticipant = participants.find(p => p.id === step.to);
          if (!fromParticipant || !toParticipant) return null;

          const yPos = 70 + index * messageSpacing;
          // const isForward = fromParticipant.x < toParticipant.x; // Potentially for directional styling

          return (
            <motion.g
              key={`msg-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <line
                x1={fromParticipant.x}
                y1={yPos}
                x2={toParticipant.x}
                y2={yPos}
                stroke="#3498db"
                strokeWidth="2"
                markerEnd="url(#arrowhead-seq)"
              />
              <text
                x={(fromParticipant.x + toParticipant.x) / 2}
                y={yPos - 10}
                textAnchor="middle"
                fontSize="12"
                fill="#2c3e50"
              >
                {step.action}
              </text>
            </motion.g>
          );
        })}

        {/* Current Step Description */}
        {currentStep < steps.length && (
            <motion.text
             x="400"
             y={lifelineHeight + 30}
             textAnchor="middle"
             fontSize="14"
             fill="#333"
             initial={{ opacity: 0}}
             animate={{ opacity: 1}}
             key={currentStep} // Ensures re-render on change
            >
            Step {currentStep + 1}: {steps[currentStep].description}
          </motion.text>
        )}


        <defs>
          <marker id="arrowhead-seq" markerWidth="10" markerHeight="7" refX="9.5" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3498db" />
          </marker>
        </defs>
      </svg>
      <div style={{ marginTop: '20px' }}>
        <button onClick={handlePrevStep} disabled={currentStep === 0} style={buttonStyle} >Previous</button>
        <button onClick={handleNextStep} disabled={currentStep === steps.length -1} style={buttonStyle} >Next</button>
        <button onClick={handleReset} style={buttonStyle} >Reset</button>
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 15px',
  margin: '0 10px',
  fontSize: '16px',
  cursor: 'pointer',
  backgroundColor: '#3498db',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  opacity: 1,
};

