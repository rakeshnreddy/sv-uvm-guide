"use client";

import React, { useState, useRef, MouseEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useExerciseProgress } from '@/hooks/useExerciseProgress';

interface Port {
  id: string;
  componentId: string;
  name: string; // e.g., "analysis_port", "data_imp"
  type: 'port' | 'export' | 'imp'; // Simplified type
  x: number; // Relative x within component
  y: number; // Relative y within component
  isOutput?: boolean; // true for port, false for imp/export (simplified)
}

interface Component {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ports: Port[];
}

interface Connection {
  fromComponentId: string;
  fromPortId: string;
  toComponentId: string;
  toPortId: string;
}

interface ConnectionFeedback {
  score: number;
  passed: boolean;
  message: string;
  incorrectConnections: number;
}

const initialComponents: Component[] = [
  {
    id: 'monitor', name: 'UVM Monitor', x: 50, y: 150, width: 150, height: 80,
    ports: [{ id: 'mon_ap', componentId: 'monitor', name: 'trans_ap', type: 'port', x: 145, y: 40, isOutput: true }],
  },
  {
    id: 'scoreboard', name: 'Scoreboard', x: 350, y: 50, width: 150, height: 80,
    ports: [{ id: 'sb_imp_actual', componentId: 'scoreboard', name: 'actual_trans_imp', type: 'imp', x: 5, y: 40, isOutput: false }],
  },
  {
    id: 'coverage', name: 'Coverage Collector', x: 350, y: 250, width: 150, height: 80,
    ports: [{ id: 'cov_imp', componentId: 'coverage', name: 'observed_trans_imp', type: 'imp', x: 5, y: 40, isOutput: false }],
  },
];

const portRadius = 8;
const portStrokeColor = "#4A5568"; // gray-700
const portFillColor = "#E2E8F0"; // gray-200
const portFillColorHover = "#CBD5E0"; // gray-300

const statusToneStyles = {
  info: 'border-white/15 bg-white/5 text-[rgba(230,241,255,0.75)]',
  error: 'border-amber-400/50 bg-amber-500/10 text-amber-100',
} as const;

const ScoreboardConnectorExercise: React.FC = () => {
  const [components, /* setComponents */] = useState<Component[]>(initialComponents);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [drawingLine, setDrawingLine] = useState<{ fromComponentId: string; fromPortId: string; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedPort, setSelectedPort] = useState<{ componentId: string; portId: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [feedback, setFeedback] = useState<ConnectionFeedback | null>(null);
  const {
    progress: savedProgress,
    recordAttempt,
    resetProgress,
    logInteraction,
    analytics,
  } = useExerciseProgress('scoreboard-connector');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'error'>('info');

  // Map of correct connections: output port -> valid input ports
  const referenceMap: Record<string, string[]> = {
    mon_ap: ['sb_imp_actual', 'cov_imp'],
  };

  const instructionId = 'scoreboard-connector-instructions';

  const isValidConnection = (conn: Connection) => {
    const targets = referenceMap[conn.fromPortId];
    if (targets && targets.includes(conn.toPortId)) return true;
    const reverseTargets = referenceMap[conn.toPortId];
    if (reverseTargets && reverseTargets.includes(conn.fromPortId)) return true;
    return false;
  };

  const getPortAbsolutePosition = (componentId: string, portId: string) => {
    const component = components.find(c => c.id === componentId);
    const port = component?.ports.find(p => p.id === portId);
    if (component && port) {
      return { x: component.x + port.x, y: component.y + port.y };
    }
    return { x: 0, y: 0 };
  };

  const handlePortClick = (componentId: string, portId: string) => {
    const component = components.find(c => c.id === componentId);
    const port = component?.ports.find(p => p.id === portId);
    if (!component || !port) return;

    logInteraction();

    const { x, y } = getPortAbsolutePosition(componentId, portId);

    if (!selectedPort) {
      setSelectedPort({ componentId, portId });
      setDrawingLine({ fromComponentId: componentId, fromPortId: portId, x1: x, y1: y, x2: x, y2: y });
      setStatusTone('info');
      setStatusMessage(`Selected ${port.name}. Choose a compatible partner port to complete the link.`);
    } else {
      if (selectedPort.componentId === componentId && selectedPort.portId === portId) {
        setSelectedPort(null);
        setDrawingLine(null);
        return;
      }

      const fromPortDetails = components
        .find(c => c.id === selectedPort.componentId)
        ?.ports.find(p => p.id === selectedPort.portId);

      if (fromPortDetails && fromPortDetails.isOutput === port.isOutput) {
        setStatusTone('error');
        setStatusMessage('Connect an analysis_port to an analysis_imp or export—outputs cannot connect to outputs.');
        setSelectedPort(null);
        setDrawingLine(null);
        return;
      }

      const newConnection: Connection = {
        fromComponentId: selectedPort.componentId,
        fromPortId: selectedPort.portId,
        toComponentId: componentId,
        toPortId: portId,
      };

      const alreadyExists = connections.some(conn =>
        (conn.fromPortId === newConnection.fromPortId && conn.toPortId === newConnection.toPortId) ||
        (conn.fromPortId === newConnection.toPortId && conn.toPortId === newConnection.fromPortId),
      );

      if (alreadyExists) {
        setStatusTone('error');
        setStatusMessage('That connection already exists. Try wiring the monitor to a new sink.');
      } else {
        setConnections(prev => [...prev, newConnection]);
        const fromLabel = fromPortDetails?.name ?? selectedPort.portId;
        setStatusTone('info');
        setStatusMessage(`Connected ${fromLabel} → ${port.name}.`);
      }
      setSelectedPort(null);
      setDrawingLine(null);
    }
  };

  const handlePortKeyDown = (
    event: React.KeyboardEvent<SVGCircleElement>,
    componentId: string,
    portId: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePortClick(componentId, portId);
    }
  };

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    if (drawingLine && svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      setDrawingLine(prev => prev ? { ...prev, x2: event.clientX - svgRect.left, y2: event.clientY - svgRect.top } : null);
    }
  };

  const handleSvgClick = (event: MouseEvent<SVGSVGElement>) => {
    // If clicking on SVG canvas itself (not a port) and a line is being drawn, cancel it.
    if (selectedPort && event.target === svgRef.current) {
        setSelectedPort(null);
        setDrawingLine(null);
    }
  };

  const totalExpectedConnections = Object.values(referenceMap).reduce((sum, targets) => sum + targets.length, 0);

  const checkConnections = () => {
    const correct = connections.filter(isValidConnection).length;
    const score = Math.round((correct / totalExpectedConnections) * 100);
    const incorrectConnections = totalExpectedConnections - correct;
    const passed = score === 100;
    const message = passed
      ? 'Great! The scoreboard and coverage collector both receive the monitor stream.'
      : 'Some listeners are still disconnected. Make sure every analysis_imp is wired to the monitor\'s analysis_port.';

    recordAttempt(score);
    setFeedback({ score, passed, message, incorrectConnections });
    setStatusMessage(null);
    setStatusTone('info');
  };

  const handleRetry = () => {
    setConnections([]);
    setFeedback(null);
    setStatusMessage(null);
    setStatusTone('info');
    logInteraction();

  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-[rgba(230,241,255,0.75)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-primary">Best score: {savedProgress.bestScore}%</p>
          <p>
            Attempts: {savedProgress.attempts}
            {savedProgress.lastPlayedLabel ? ` • Last played ${savedProgress.lastPlayedLabel}` : ''}
          </p>
          {savedProgress.attempts > 0 && (
            <p className="text-xs text-[rgba(230,241,255,0.65)]">
              Average score: {Math.round(analytics.competency)}% • Interactions: {analytics.engagement}
            </p>
          )}
        </div>
        {savedProgress.attempts > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetProgress}
            className="self-start text-xs text-[rgba(230,241,255,0.8)] hover:bg-white/10"
          >
            Clear saved progress
          </Button>
        )}
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${statusToneStyles[statusTone]}`}
          role="status"
          aria-live="polite"
          data-testid="status-banner"
        >
          {statusMessage}
        </div>
      )}

      <div className="rounded-lg border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-lg">
        <h3 className="mb-4 text-center text-lg font-semibold text-primary">Connect the UVM Components</h3>
        <p id={instructionId} className="mb-4 text-center text-sm text-muted-foreground">
          Click an analysis_port on the monitor, then wire it to each analysis_imp so both the scoreboard and coverage collector receive transactions.
        </p>
        <svg
          ref={svgRef}
          width="100%"
          height="400"
          viewBox="0 0 600 400"
          className="rounded border border-white/20 bg-white/10"
          onMouseMove={handleMouseMove}
          onClick={handleSvgClick}
          aria-describedby={instructionId}
          aria-label="Diagram showing monitor, scoreboard, and coverage components with ports to connect"
          role="group"
        >
          {connections.map((conn, index) => {
            const fromPos = getPortAbsolutePosition(conn.fromComponentId, conn.fromPortId);
            const toPos = getPortAbsolutePosition(conn.toComponentId, conn.toPortId);
            const strokeColor = feedback
              ? isValidConnection(conn)
                ? 'rgb(34 197 94)' // emerald-500
                : 'rgb(248 113 113)' // red-400
              : 'hsl(var(--accent))';
            return (
              <line
                key={`conn-${index}`}
                x1={fromPos.x} y1={fromPos.y}
                x2={toPos.x} y2={toPos.y}
                stroke={strokeColor}
                strokeWidth="2.5"
              />
            );
          })}

          {drawingLine && (
            <line
              x1={drawingLine.x1} y1={drawingLine.y1}
              x2={drawingLine.x2} y2={drawingLine.y2}
              stroke="hsl(var(--foreground))"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {components.map(comp => (
            <g key={comp.id} transform={`translate(${comp.x}, ${comp.y})`}>
              <rect
                width={comp.width}
                height={comp.height}
                rx="5"
                fill="hsla(var(--primary-foreground), 0.1)"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
              <text x={comp.width / 2} y="20" textAnchor="middle" fontSize="12" fill="hsl(var(--foreground))">
                {comp.name}
              </text>
              {comp.ports.map(port => (
                <circle
                  key={port.id}
                  cx={port.x}
                  cy={port.y}
                  r={portRadius}
                  fill={selectedPort?.portId === port.id ? "hsl(var(--accent))" : "hsl(var(--primary-foreground))"}
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                  className="cursor-pointer hover:fill-[hsl(var(--accent))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] focus-visible:ring-[hsl(var(--accent))]"
                  onClick={(e) => { e.stopPropagation(); handlePortClick(comp.id, port.id); }}
                  onKeyDown={(event) => handlePortKeyDown(event, comp.id, port.id)}
                  role="button"
                  tabIndex={0}
                  focusable="true"
                  aria-pressed={selectedPort?.portId === port.id}
                  aria-label={`Port ${port.name} on ${comp.name}`}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="flex justify-center gap-2">
        <Button onClick={checkConnections}>Check Connections</Button>
        <Button variant="outline" onClick={handleRetry}>Reset Board</Button>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border p-4 text-sm ${feedback.passed ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/50 bg-amber-500/10 text-amber-100'}`}
          role="status"
          aria-live="polite"
          data-testid="exercise-feedback"
        >
          <p className="text-lg font-semibold">Score: {feedback.score}%</p>
          <p className="mt-1">{feedback.message}</p>
          {!feedback.passed && (
            <p className="mt-2 text-xs">Missing links: {feedback.incorrectConnections}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ScoreboardConnectorExercise;
