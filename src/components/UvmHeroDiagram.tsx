'use client';

import React, 'react';
import InteractiveUvmDiagram from './InteractiveUvmDiagram';

const UvmHeroDiagram: React.FC = () => {
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <InteractiveUvmDiagram />
    </div>
  );
};

export default UvmHeroDiagram;
