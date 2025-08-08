"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/** Represents a single simulation frame that can be recorded or played back */
export interface SimulationFrame {
  /** Timestamp in ms when the frame was produced */
  timestamp: number;
  /** Arbitrary data describing the state of the simulation */
  data: unknown;
}

/**
 * Interface used by the engine to communicate with various simulation backends.
 * Implementations may target local, remote, or cloud-based simulators.
 */
export interface SimulatorBackend {
  /** Prepare backend resources (e.g., WebGL buffers, WASM modules) */
  init: (canvas: HTMLCanvasElement, wasmModule?: WebAssembly.Module) => Promise<void>;
  /** Perform a single simulation step using the provided parameters */
  step: (params: Record<string, number | string | boolean>) => Promise<void>;
  /** Release any resources held by the backend */
  dispose: () => void;
  /** Return the current frame for recording */
  getCurrentFrame: () => SimulationFrame;
}

interface InteractiveSimulationEngineProps {
  /** Backend implementation providing the simulation logic */
  backend?: SimulatorBackend;
  /** Optional WebAssembly module that can be used by the backend */
  wasmModule?: WebAssembly.Module;
}

/**
 * InteractiveSimulationEngine renders a WebGL canvas backed by an optional
 * WebAssembly module. It provides widgets for exploring timing diagrams,
 * circuit behaviour, protocol flows, debugging scenarios and architectural
 * exploration. The component exposes simple hooks for plugging in different
 * simulators while ensuring accessibility and performance.
 */
const InteractiveSimulationEngine: React.FC<InteractiveSimulationEngineProps> = ({
  backend,
  wasmModule,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const framesRef = useRef<SimulationFrame[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<
    "timing" | "circuit" | "protocol" | "debug" | "architecture"
  >("timing");
  const [params, setParams] = useState<Record<string, number>>({ speed: 1 });

  /** Main render loop scheduled via requestAnimationFrame */
  const renderLoop = useCallback(() => {
    if (!canvasRef.current || !backend) return;

    backend
      .step(params)
      .then(() => {
        const frame = backend.getCurrentFrame();
        if (running) {
          framesRef.current.push(frame);
        }

        // Basic WebGL clearing; specific rendering is delegated to the backend
        const gl = canvasRef.current!.getContext("webgl2");
        if (gl) {
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }

        animationRef.current = requestAnimationFrame(renderLoop);
      })
      .catch((err) => {
        console.error("Simulation step failed", err);
      });
  }, [backend, params, running]);

  /** Initialise backend on mount */
  useEffect(() => {
    if (canvasRef.current && backend) {
      backend.init(canvasRef.current, wasmModule).catch((err) => {
        console.error("Backend initialisation failed", err);
      });
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      backend?.dispose();
    };
  }, [backend, wasmModule]);

  /** Handle playback of recorded frames */
  useEffect(() => {
    if (playbackIndex === null) return;
    const frames = framesRef.current;
    if (playbackIndex >= frames.length) {
      setPlaybackIndex(null);
      return;
    }

    const frame = frames[playbackIndex];
    const gl = canvasRef.current?.getContext("webgl2");
    if (gl) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Backend-specific playback rendering could go here
    }

    const id = requestAnimationFrame(() =>
      setPlaybackIndex((idx) => (idx ?? 0) + 1)
    );
    return () => cancelAnimationFrame(id);
  }, [playbackIndex]);

  /** Start the render loop */
  const start = useCallback(() => {
    if (!running) {
      setRunning(true);
      animationRef.current = requestAnimationFrame(renderLoop);
    }
  }, [renderLoop, running]);

  /** Stop the render loop */
  const stop = useCallback(() => {
    setRunning(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, []);

  /** Begin playback of recorded frames */
  const startPlayback = useCallback(() => {
    stop();
    setPlaybackIndex(0);
  }, [stop]);

  /** Keyboard shortcuts for accessibility */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      running ? stop() : start();
    } else if (e.key === "r" && e.altKey) {
      startPlayback();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4 items-center">
        {/* Mode selector covers timing diagrams, circuit behaviour, etc. */}
        <label className="flex items-center gap-2">
          <span>Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className="border p-1 rounded"
          >
            <option value="timing">Timing</option>
            <option value="circuit">Circuit</option>
            <option value="protocol">Protocol</option>
            <option value="debug">Debug</option>
            <option value="architecture">Architecture</option>
          </select>
        </label>

        {/* Example parameter control */}
        <label className="flex items-center gap-2">
          <span>Speed</span>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={params.speed}
            onChange={(e) =>
              setParams({ ...params, speed: parseFloat(e.target.value) })
            }
          />
        </label>

        <button
          onClick={running ? stop : start}
          className="px-2 py-1 border rounded"
          aria-label={running ? "Pause simulation" : "Start simulation"}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={startPlayback}
          className="px-2 py-1 border rounded"
          aria-label="Playback recording"
        >
          Playback
        </button>
      </div>

      {/* Canvas element that receives keyboard focus for accessibility */}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="border w-full h-64"
        aria-label="Interactive simulation canvas"
      />
    </div>
  );
};

export default InteractiveSimulationEngine;

