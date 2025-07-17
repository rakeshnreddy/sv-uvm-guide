"use client";

import React, { useEffect, useRef } from "react";

interface WaveDromRendererProps {
  waveJson: string;
}

declare global {
  interface Window {
    WaveDrom: {
      ProcessAll: () => void;
    };
  }
}

const WaveDromRenderer: React.FC<WaveDromRendererProps> = ({ waveJson }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderWaveDrom = () => {
      if (containerRef.current) {
        try {
          const parsedJson = JSON.parse(waveJson);
          const script = document.createElement("script");
          script.type = "text/json";
          script.innerHTML = JSON.stringify(parsedJson);

          // Clear previous content
          while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
          }

          const container = document.createElement('div');
          container.id = `wavedrom-container-${Date.now()}`;
          container.className = 'wavedrom-container';

          const scriptContainer = document.createElement('div');
          scriptContainer.style.display = 'none';
          scriptContainer.appendChild(script);

          container.appendChild(scriptContainer);
          containerRef.current.appendChild(container);

          if (window.WaveDrom) {
            window.WaveDrom.ProcessAll();
          }
        } catch (error) {
          console.error("Invalid WaveJSON:", error);
          if (containerRef.current) {
            containerRef.current.innerHTML = "<p class='text-red-500'>Invalid WaveJSON</p>";
          }
        }
      }
    };

    if (window.WaveDrom) {
      renderWaveDrom();
    } else {
      const script = document.querySelector('script[src*="wavedrom"]');
      if (script) {
        script.addEventListener('load', renderWaveDrom);
        return () => script.removeEventListener('load', renderWaveDrom);
      }
    }
  }, [waveJson]);

  return <div ref={containerRef} id="wavedrom-output"></div>;
};

export default WaveDromRenderer;
