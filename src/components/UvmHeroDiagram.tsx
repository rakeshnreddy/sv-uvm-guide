'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const VisualizationFallback = () => (
  <div className="flex h-64 items-center justify-center">Loading visualization...</div>
);

const InteractiveUvmArchitectureDiagram = dynamic(
  () => import('./diagrams/InteractiveUvmArchitectureDiagram'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);

const UvmHeroDiagram: React.FC = () => {
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <InteractiveUvmArchitectureDiagram />
    </div>
  );
};

export default UvmHeroDiagram;
