"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';

const components = [
  { id: 'test', name: 'UVM Test', description: 'Top-level class that initiates and controls the test environment.', x: 250, y: 50, width: 100, height: 50 },
  { id: 'env', name: 'UVM Env', description: 'Encapsulates agents, scoreboard, and other environment components.', x: 250, y: 150, width: 100, height: 50 },
  { id: 'agent', name: 'UVM Agent', description: 'Manages a specific protocol interface (e.g., AHB, APB). Contains sequencer, driver, and monitor.', x: 100, y: 250, width: 100, height: 50 },
  { id: 'sequencer', name: 'Sequencer', description: 'Generates sequences of transactions.', x: 50, y: 350, width: 80, height: 40 },
  { id: 'driver', name: 'Driver', description: 'Drives transactions onto the DUT interface.', x: 150, y: 350, width: 80, height: 40 },
  { id: 'monitor', name: 'Monitor', description: 'Observes DUT interface activity and broadcasts transactions.', x: 100, y: 450, width: 100, height: 50 },
  { id: 'scoreboard', name: 'Scoreboard', description: 'Checks data integrity by comparing expected and actual transactions.', x: 400, y: 250, width: 100, height: 50 },
  { id: 'dut', name: 'DUT', description: 'Design Under Test. The actual hardware design being verified.', x: 250, y: 550, width: 100, height: 50 },
];

const connections = [
  { from: 'test', to: 'env' },
  { from: 'env', to: 'agent' },
  { from: 'env', to: 'scoreboard' },
  { from: 'agent', to: 'sequencer' },
  { from: 'agent', to: 'driver' },
  { from: 'agent', to: 'monitor' },
  { from: 'driver', to: 'dut' },
  { from: 'monitor', to: 'dut' },
  { from: 'monitor', to: 'scoreboard', type: 'analysis' },
];

const AnimatedUvmTestbenchDiagram: React.FC = () => {
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  return (
    <svg width="600" height="650" viewBox="0 0 600 650" style={{ border: '1px solid #ccc', borderRadius: '8px' }}>
      {/* Connection Lines */}
      {connections.map((conn, index) => {
        const fromComponent = components.find(c => c.id === conn.from);
        const toComponent = components.find(c => c.id === conn.to);
        if (!fromComponent || !toComponent) return null;

        const x1 = fromComponent.x + fromComponent.width / 2;
        const y1 = fromComponent.y + fromComponent.height;
        const x2 = toComponent.x + toComponent.width / 2;
        const y2 = toComponent.y;

        const isAnalysis = conn.type === 'analysis';

        return (
          <motion.line
            key={`conn-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isAnalysis ? "#2ecc71" : "#3498db"}
            strokeWidth="2"
            markerEnd={isAnalysis ? "url(#arrowhead-analysis)" : "url(#arrowhead-normal)"}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          />
        );
      })}

      {/* Components */}
      {components.map(comp => (
        <motion.g
          key={comp.id}
          onHoverStart={() => setHoveredComponent(comp.id)}
          onHoverEnd={() => setHoveredComponent(null)}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: components.indexOf(comp) * 0.1 }}
        >
          <motion.rect
            x={comp.x}
            y={comp.y}
            width={comp.width}
            height={comp.height}
            rx="5"
            fill={hoveredComponent === comp.id ? '#3498db' : '#ecf0f1'}
            stroke={hoveredComponent === comp.id ? '#2980b9' : '#bdc3c7'}
            strokeWidth="2"
            whileHover={{ scale: 1.05 }}
          />
          <text
            x={comp.x + comp.width / 2}
            y={comp.y + comp.height / 2 + 5} // Adjusted for better vertical centering
            textAnchor="middle"
            fill={hoveredComponent === comp.id ? '#fff' : '#2c3e50'}
            fontSize="12"
            fontWeight="bold"
            pointerEvents="none" // Ensure text doesn't block hover on rect
          >
            {comp.name}
          </text>
        </motion.g>
      ))}

      {/* Description Tooltip */}
      {hoveredComponent && components.find(c => c.id === hoveredComponent) && (
        <motion.g
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <rect
            x={components.find(c => c.id === hoveredComponent)!.x + components.find(c => c.id === hoveredComponent)!.width + 10}
            y={components.find(c => c.id === hoveredComponent)!.y}
            width="200" // Fixed width for tooltip
            height="auto" // Auto height based on text
            rx="5"
            fill="#2c3e50"
            opacity="0.9"
          />
          <text
            x={components.find(c => c.id === hoveredComponent)!.x + components.find(c => c.id === hoveredComponent)!.width + 20}
            y={components.find(c => c.id === hoveredComponent)!.y + 20}
            fill="#fff"
            fontSize="11"
            style={{ whiteSpace: 'pre-wrap' }} // Allows text wrapping
          >
            {components.find(c => c.id === hoveredComponent)!.description.split(' ').reduce((acc, word) => {
              const lastLine = acc[acc.length - 1];
              if (lastLine && lastLine.length + word.length < 25) { // Approx char limit per line
                acc[acc.length - 1] = lastLine + ' ' + word;
              } else {
                acc.push(word);
              }
              return acc;
            }, [] as string[]).map((line, i) => (
              <tspan key={i} x={components.find(c => c.id === hoveredComponent)!.x + components.find(c => c.id === hoveredComponent)!.width + 20} dy={i === 0 ? 0 : '1.2em'}>{line}</tspan>
            ))}
          </text>
        </motion.g>
      )}

      {/* Arrowhead definitions */}
      <defs>
        <marker id="arrowhead-normal" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#3498db" />
        </marker>
        <marker id="arrowhead-analysis" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#2ecc71" />
        </marker>
      </defs>
    </svg>
  );
};

export default AnimatedUvmTestbenchDiagram;
