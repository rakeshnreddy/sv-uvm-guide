'use client';

import React from 'react';
import InteractiveUvmArchitectureDiagram from './diagrams/InteractiveUvmArchitectureDiagram';

const UvmHeroDiagram: React.FC = () => {
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <InteractiveUvmArchitectureDiagram />
    </div>
  );
};

export default UvmHeroDiagram;
