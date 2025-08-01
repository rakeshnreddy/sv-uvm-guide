import React from 'react';
import { motion } from 'framer-motion';

const InteractiveUvmDiagram = () => {
  return (
    <svg className="w-full h-auto" viewBox="0 0 850 650" xmlns="http://www.w3.org/2000/svg" fontFamily="Arial, sans-serif" fontSize="14px" role="img" aria-label="UVM component interactions diagram">
      <style>
        {`
          .block { stroke: hsl(var(--primary)); strokeWidth: 1.5; fill: hsl(var(--primary-foreground)); }
          .dark .block { stroke: hsl(var(--primary)); fill: hsl(var(--background)); }
          .label { text-anchor: middle; fill: hsl(var(--foreground)); }
          .line { stroke: hsl(var(--foreground)); strokeWidth: 1; marker-end: url(#arrowhead); }
          .data-flow { stroke: hsl(var(--accent)); strokeWidth: 1.5; marker-end: url(#arrowhead-data); }
          .passive { stroke-dasharray: 4 2; }
        `}
      </style>

      <defs>
        <motion.marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--foreground))" />
        </motion.marker>
        <motion.marker id="arrowhead-data" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--accent))" />
        </motion.marker>
      </defs>

      <motion.g
        id="test"
        data-description="The Test instantiates the environment and sequences, and configures the testbench."
        whileHover={{ scale: 1.05 }}
      >
        <rect x="325" y="20" width="200" height="60" rx="5" className="block" />
        <text x="425" y="55" className="label">Test (uvm_test)</text>
      </motion.g>

      <motion.g
        id="environment"
        data-description="The Environment (Env) encapsulates agents, scoreboards, and other environment components."
        whileHover={{ scale: 1.02 }}
      >
        <rect x="50" y="120" width="750" height="400" rx="5" className="block" style={{ fill: 'hsla(var(--primary), 0.1)' }} />
        <text x="425" y="145" className="label">Environment (uvm_env)</text>
      </motion.g>

      <motion.g
        id="agent-active"
        data-description="The Active Agent drives stimulus to the DUT and may monitor its outputs."
        whileHover={{ scale: 1.05 }}
      >
        <rect x="100" y="180" width="300" height="150" rx="5" className="block" style={{ fill: 'hsla(var(--accent), 0.1)' }} />
        <text x="250" y="200" className="label">Agent (Active)</text>
      </motion.g>

      <motion.g
        id="sequencer"
        data-description="The Sequencer controls the flow of sequence items to the Driver."
        whileHover={{ scale: 1.1 }}
      >
        <rect x="120" y="220" width="120" height="50" rx="5" className="block" />
        <text x="180" y="250" className="label">Sequencer</text>
      </motion.g>

      <motion.g
        id="driver"
        data-description="The Driver converts sequence items into pin-level activity on the DUT interface."
        whileHover={{ scale: 1.1 }}
      >
        <rect x="120" y="290" width="120" height="50" rx="5" className="block" />
        <text x="180" y="320" className="label">Driver</text>
      </motion.g>

      <motion.g
        id="monitor-active"
        data-description="The Active Monitor observes DUT interface signals, typically associated with the active agent."
        whileHover={{ scale: 1.1 }}
      >
        <rect x="260" y="220" width="120" height="50" rx="5" className="block" />
        <text x="320" y="250" className="label">Monitor (Active)</text>
      </motion.g>

      <motion.g
        id="agent-passive"
        data-description="The Passive Agent only monitors DUT interfaces and does not drive stimulus."
        whileHover={{ scale: 1.05 }}
      >
        <rect x="450" y="180" width="300" height="100" rx="5" className="block passive" style={{ fill: 'hsla(var(--accent), 0.1)' }} />
        <text x="600" y="200" className="label">Agent (Passive)</text>
      </motion.g>

      <motion.g
        id="monitor-passive"
        data-description="The Passive Monitor observes DUT interface signals, typically for checking or coverage."
        whileHover={{ scale: 1.1 }}
      >
        <rect x="540" y="220" width="120" height="50" rx="5" className="block passive" />
        <text x="600" y="250" className="label">Monitor (Passive)</text>
      </motion.g>

      <motion.g
        id="scoreboard"
        data-description="The Scoreboard checks the DUT's behavior by comparing expected data (often from monitors) against actual data."
        whileHover={{ scale: 1.05 }}
      >
        <rect x="325" y="400" width="200" height="60" rx="5" className="block" style={{ fill: 'hsla(var(--accent), 0.2)' }} />
        <text x="425" y="435" className="label">Scoreboard</text>
      </motion.g>

      {/* Connections */}
      <line x1="425" y1="80" x2="425" y2="120" className="line" />
      <line x1="180" y1="270" x2="180" y2="290" className="data-flow" />
      <line x1="180" y1="340" x2="180" y2="370" className="data-flow" />
      <text x="190" y="365" fontSize="12px" fill="hsl(var(--accent))" className="font-mono">DUT I/F</text>
      <line x1="320" y1="270" x2="320" y2="300" className="data-flow passive" />
      <text x="330" y="295" fontSize="12px" fill="hsl(var(--accent))" className="font-mono">DUT I/F</text>
      <line x1="320" y1="300" x2="425" y2="400" className="data-flow" />
      <line x1="600" y1="270" x2="600" y2="300" className="data-flow passive" />
      <text x="610" y="295" fontSize="12px" fill="hsl(var(--accent))" className="font-mono">DUT I/F</text>
      <line x1="600" y1="300" x2="425" y2="400" className="data-flow" />
      <path d="M 425 165 Q 250 160 250 180" stroke="hsl(var(--foreground))" stroke-width="1" fill="none" />
      <path d="M 425 165 Q 600 160 600 180" stroke="hsl(var(--foreground))" stroke-width="1" fill="none" />
      <path d="M 425 380 Q 425 390 425 400" stroke="hsl(var(--foreground))" stroke-width="1" fill="none" />
    </svg>
  );
};

export default InteractiveUvmDiagram;
