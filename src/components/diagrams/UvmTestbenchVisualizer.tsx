'use client';

import React from 'react';
import { uvmComponents, uvmConnections } from './uvm-data-model';

const UvmTestbenchVisualizer = () => {
  console.log('UVM Components:', uvmComponents);
  console.log('UVM Connections:', uvmConnections);

  return (
    <svg width="100%" height="500px" style={{ border: '1px solid #ccc' }}>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="20" fill="#888">
        UVM Visualizer Placeholder
      </text>
    </svg>
  );
};

export default UvmTestbenchVisualizer;
