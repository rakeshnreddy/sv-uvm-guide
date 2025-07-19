"use client";
import React from 'react';
import { motion } from 'framer-motion';

const participants = [
  { id: 'virtual_seq', name: 'Virtual Sequence', x: 150, y: 50 },
  { id: 'virtual_sequencer', name: 'Virtual Sequencer', x: 150, y: 150 },
  { id: 'pci_sequencer', name: 'PCIe Sequencer', x: 400, y: 150 },
  { id: 'eth_sequencer', name: 'Ethernet Sequencer', x: 650, y: 150 },
  { id: 'pci_driver', name: 'PCIe Driver', x: 400, y: 250 },
  { id: 'eth_driver', name: 'Ethernet Driver', x: 650, y: 250 },
];

const connections = [
  { from: 'virtual_seq', to: 'virtual_sequencer', label: 'runs on' },
  { from: 'virtual_sequencer', to: 'pci_sequencer', label: 'controls' },
  { from: 'virtual_sequencer', to: 'eth_sequencer', label: 'controls' },
  { from: 'pci_sequencer', to: 'pci_driver', label: 'drives' },
  { from: 'eth_sequencer', to: 'eth_driver', label: 'drives' },
];

const UvmVirtualSequencerDiagram: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <svg width="800" height="400" viewBox="0 0 800 400">
        {/* Participants */}
        {participants.map(p => (
          <g key={p.id}>
            <motion.rect
              x={p.x - 75}
              y={p.y - 25}
              width="150"
              height="50"
              rx="10"
              fill="#f0f0f0"
              stroke="#333"
              strokeWidth="2"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            />
            <motion.text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              alignmentBaseline="middle"
              fontWeight="bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {p.name}
            </motion.text>
          </g>
        ))}

        {/* Connections */}
        {connections.map((c, index) => {
          const from = participants.find(p => p.id === c.from);
          const to = participants.find(p => p.id === c.to);
          if (!from || !to) return null;

          return (
            <motion.g
              key={`conn-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <line
                x1={from.x}
                y1={from.y + 25}
                x2={to.x}
                y2={to.y - 25}
                stroke="#3498db"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2}
                textAnchor="middle"
                fontSize="12"
                fill="#2c3e50"
              >
                {c.label}
              </text>
            </motion.g>
          );
        })}

        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9.5" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3498db" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};

export default UvmVirtualSequencerDiagram;
