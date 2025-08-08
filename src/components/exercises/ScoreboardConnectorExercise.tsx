"use client";

import React, { useState, useRef, MouseEvent } from 'react';
import { Button } from '@/components/ui/Button';

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

const ScoreboardConnectorExercise: React.FC = () => {
  const [components, /* setComponents */] = useState<Component[]>(initialComponents); // setComponents commented out
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionResults, setConnectionResults] = useState<boolean[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [drawingLine, setDrawingLine] = useState<{ fromComponentId: string; fromPortId: string; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedPort, setSelectedPort] = useState<{ componentId: string; portId: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Map of correct connections: output port -> valid input ports
  const referenceMap: Record<string, string[]> = {
    mon_ap: ['sb_imp_actual', 'cov_imp'],
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

    const { x, y } = getPortAbsolutePosition(componentId, portId);

    if (!selectedPort) {
      // Start drawing a line from this port
      setSelectedPort({ componentId, portId });
      setDrawingLine({ fromComponentId: componentId, fromPortId: portId, x1: x, y1: y, x2: x, y2: y });
    } else {
      // Finish drawing a line to this port, if it's not the same port
      if (selectedPort.componentId !== componentId || selectedPort.portId !== portId) {
        // Basic validation: prevent connecting output to output, input to input (simplified)
        const fromPortDetails = components.find(c => c.id === selectedPort.componentId)?.ports.find(p => p.id === selectedPort.portId);
        if (fromPortDetails && fromPortDetails.isOutput === port.isOutput) {
            alert("Cannot connect ports of the same type (e.g., output to output).");
            setSelectedPort(null);
            setDrawingLine(null);
            return;
        }

        // Prevent duplicate connections (simplified check)
        const newConnection: Connection = {
            fromComponentId: selectedPort.componentId,
            fromPortId: selectedPort.portId,
            toComponentId: componentId,
            toPortId: portId,
          };
        const alreadyExists = connections.some(conn =>
            (conn.fromPortId === newConnection.fromPortId && conn.toPortId === newConnection.toPortId) ||
            (conn.fromPortId === newConnection.toPortId && conn.toPortId === newConnection.fromPortId)
        );
        if (alreadyExists) {
            alert("This connection already exists.");
        } else {
             setConnections(prev => [...prev, newConnection]);
        }
      }
      setSelectedPort(null);
      setDrawingLine(null);
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
  }

  const resetExercise = () => {
    setConnections([]);
    setConnectionResults(null);
    setScore(null);
  };

  const handleCheckConnections = () => {
    const results = connections.map(conn => {
      // Determine which port is the output to canonicalize connection direction
      const fromDetails = components
        .find(c => c.id === conn.fromComponentId)?.ports.find(p => p.id === conn.fromPortId);
      const toDetails = components
        .find(c => c.id === conn.toComponentId)?.ports.find(p => p.id === conn.toPortId);

      if (!fromDetails || !toDetails) return false;

      const outputPortId = fromDetails.isOutput ? conn.fromPortId : conn.toPortId;
      const inputPortId = fromDetails.isOutput ? conn.toPortId : conn.fromPortId;

      return referenceMap[outputPortId]?.includes(inputPortId) ?? false;
    });

    setConnectionResults(results);
    setScore(results.filter(Boolean).length);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-center text-primary">Connect the UVM Components</h3>
      <p className="text-sm text-center text-muted-foreground mb-4">
        Click on an output port (e.g., an analysis_port on a monitor) and then click on a compatible input port
        (e.g., an analysis_imp on a scoreboard or coverage collector) to make a connection.
      </p>
      <svg
        ref={svgRef}
        width="100%"
        height="400"
        viewBox="0 0 600 400"
        className="border border-white/20 rounded bg-white/10"
        onMouseMove={handleMouseMove}
        onClick={handleSvgClick}
      >
        {/* Draw existing connections */}
        {connections.map((conn, index) => {
          const fromPos = getPortAbsolutePosition(conn.fromComponentId, conn.fromPortId);
          const toPos = getPortAbsolutePosition(conn.toComponentId, conn.toPortId);
          const strokeColor = connectionResults
            ? connectionResults[index]
              ? 'green'
              : 'red'
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

        {/* Draw line being currently drawn */}
        {drawingLine && (
          <line
            x1={drawingLine.x1} y1={drawingLine.y1}
            x2={drawingLine.x2} y2={drawingLine.y2}
            stroke="hsl(var(--foreground))"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}

        {/* Draw components and their ports */}
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
                className="cursor-pointer hover:fill-hsl(var(--accent))"
                onClick={(e) => { e.stopPropagation(); handlePortClick(comp.id, port.id);}}
                aria-label={`Port ${port.name} on ${comp.name}`}
              />
            ))}
          </g>
        ))}
      </svg>
       <div className="mt-4 flex justify-center gap-4">
        <Button
            onClick={resetExercise}
            variant="destructive"
        >
            Reset Connections
        </Button>
        <Button onClick={handleCheckConnections}>Check Connections</Button>
      </div>
      {score !== null && (
        <div className="mt-4 text-center space-y-2">
          <p>You got {score} out of {referenceMap['mon_ap'].length} connections correct.</p>
          <Button onClick={resetExercise} variant="secondary">Retry</Button>
        </div>
      )}
    </div>
  );
};

export default ScoreboardConnectorExercise;
