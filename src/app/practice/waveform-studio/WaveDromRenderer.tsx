"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  createWaveDromIndex,
  parseWaveDromSource,
  renderWaveDromToElement,
} from '@/lib/wavedrom';

interface WaveDromRendererProps {
  waveJson: string;
}

const WaveDromRenderer: React.FC<WaveDromRendererProps> = ({ waveJson }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderIndexRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (renderIndexRef.current === undefined) {
    renderIndexRef.current = createWaveDromIndex();
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    try {
      const source = parseWaveDromSource(waveJson);
      renderWaveDromToElement({
        index: renderIndexRef.current ?? 0,
        source,
        outputElement: containerRef.current,
      });
      setError(null);
    } catch (renderError) {
      containerRef.current.replaceChildren();
      setError(renderError instanceof Error ? renderError.message : 'Invalid WaveJSON');
    }
  }, [waveJson]);

  return (
    <div>
      <div ref={containerRef} id="wavedrom-output" />
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default WaveDromRenderer;
