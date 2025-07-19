"use client";

import React, { useState, useEffect, useRef } from 'react';
import wavedrom from 'wavedrom';

const sampleWaveJSONs = [
  {
    name: 'Simple Clock',
    json: `{ signal: [{ name: 'clk', wave: 'p.......' }] }`
  },
  {
    name: 'Bus',
    json: `{ signal: [
      { name: 'bus', wave: 'x.345x..', data: ['a', 'b', 'c'] },
    ]}`
  },
  {
    name: 'Handshake',
    json: `{ signal: [
      { name: 'req', wave: '0.1..0..' },
      { name: 'ack', wave: '1.0..1..' }
    ]}`
  }
];

export default function WaveformStudioPage() {
  const [waveJson, setWaveJson] = useState(sampleWaveJSONs[0].json);
  const waveformRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (waveformRef.current) {
      try {
        const parsedJson = JSON.parse(waveJson);
        waveformRef.current.innerHTML = '';
        wavedrom.renderWaveForm(waveformRef.current, parsedJson);
      } catch (error) {
        // Handle JSON parsing errors
        console.error("Invalid WaveJSON:", error);
      }
    }
  }, [waveJson]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Waveform Studio</h1>
      <div className="flex space-x-2 mb-4">
        {sampleWaveJSONs.map((sample) => (
          <button
            key={sample.name}
            className="px-4 py-2 border rounded"
            onClick={() => setWaveJson(sample.json)}
          >
            {sample.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-bold mb-2">WaveJSON</h2>
          <textarea
            className="w-full h-96 p-2 border rounded"
            value={waveJson}
            onChange={(e) => setWaveJson(e.target.value)}
          />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Waveform</h2>
          <div ref={waveformRef} className="p-2 border rounded" />
        </div>
      </div>
    </div>
  );
}
