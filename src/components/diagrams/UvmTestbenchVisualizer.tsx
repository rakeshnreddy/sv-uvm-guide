"use client";
import React from 'react';
import { motion } from 'framer-motion';

const UvmTestbenchVisualizer = () => {
  return (
    <svg className="w-full h-auto" viewBox="0 0 800 600" style={{ border: '1px solid hsl(var(--border))', borderRadius: '8px' }} role="img" aria-label="Interactive UVM Testbench Visualizer">
      <style>
        {`
          .background { fill: hsl(var(--background)); }
          .title { font-size: 24px; font-weight: bold; fill: hsl(var(--foreground)); text-anchor: middle; }
          .subtitle { font-size: 16px; fill: hsl(var(--muted-foreground)); text-anchor: middle; }
        `}
      </style>

      {/* Background */}
      <rect width="100%" height="100%" className="background" />

      {/* Placeholder Text */}
      <text x="400" y="280" className="title">
        Interactive UVM Testbench Visualizer
      </text>
      <text x="400" y="310" className="subtitle">
        (Component Under Construction)
      </text>

      {/* Example Interactive Element */}
      <motion.g
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        drag
        dragConstraints={{ left: 0, right: 700, top: 0, bottom: 500 }}
      >
        <rect x="350" y="400" width="100" height="50" rx="5" fill="hsl(var(--primary))" />
        <text x="400" y="430" textAnchor="middle" fill="hsl(var(--primary-foreground))">
          Drag Me
        </text>
      </motion.g>
    </svg>
  );
};

export default UvmTestbenchVisualizer;
