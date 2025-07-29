'use client';

import React, { useEffect } from 'react';
import * as d3 from 'd3';
import { gsap } from 'gsap';
import { uvmComponents, uvmConnections } from './uvm-data-model';

const UvmTestbenchVisualizer = () => {
  useEffect(() => {
    console.log('D3 version:', d3.version);
    console.log('GSAP object:', gsap);
    console.log('UVM Components:', uvmComponents);
    console.log('UVM Connections:', uvmConnections);
  }, []);

  return (
    <svg width="100%" height="500px" style={{ border: '1px solid #ccc' }}>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="20" fill="#888">
        UVM Visualizer Placeholder
      </text>
    </svg>
  );
};

export default UvmTestbenchVisualizer;
