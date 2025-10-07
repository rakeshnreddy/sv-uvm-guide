"use client";

import React from "react";
import { scaleLinear, scalePoint } from "d3-scale";
import { extent } from "d3-array";

type EventType = "Verilog" | "HVL" | "SystemVerilog" | "Methodology" | "UVM" | "Standard";

interface TimelineEvent {
  year: number;
  name: string;
  description: string;
  type: EventType;
  level: number;
  size?: number;
}

const timelineData: TimelineEvent[] = [
  {
    year: 1995,
    name: "Verilog IEEE 1364",
    description: "Verilog standardized as IEEE 1364, primarily for RTL design.",
    type: "Verilog",
    level: 1,
    size: 100,
  },
  {
    year: 2000,
    name: "Rise of HVLs",
    description: "Hardware Verification Languages (OpenVera, 'e') add OOP, randomization, coverage.",
    type: "HVL",
    level: 2,
    size: 100,
  },
  {
    year: 2005,
    name: "SystemVerilog IEEE 1800-2005",
    description: "SystemVerilog extends Verilog with advanced verification features.",
    type: "SystemVerilog",
    level: 1,
    size: 150,
  },
  {
    year: 2008,
    name: "Methodology Wars",
    description: "Competing SV methodologies: VMM (Synopsys) vs. OVM (Cadence/Mentor).",
    type: "Methodology",
    level: 2,
    size: 100,
  },
  {
    year: 2009,
    name: "OVM selected for UVM",
    description: "Accellera selects OVM 2.1.1 as the base for Universal Verification Methodology.",
    type: "Methodology",
    level: 1,
    size: 120,
  },
  {
    year: 2011,
    name: "UVM 1.0 Released",
    description: "Accellera approves UVM 1.0, unifying verification methodologies.",
    type: "UVM",
    level: 2,
    size: 150,
  },
  {
    year: 2017,
    name: "UVM IEEE 1800.2-2017",
    description: "UVM becomes an IEEE standard, cementing its adoption.",
    type: "UVM",
    level: 1,
    size: 120,
  },
  {
    year: 2020,
    name: "UVM IEEE 1800.2-2020",
    description: "Revision of the UVM IEEE standard.",
    type: "UVM",
    level: 2,
    size: 120,
  },
  {
    year: 2023,
    name: "SystemVerilog IEEE 1800-2023",
    description: "Latest revision of the SystemVerilog LRM.",
    type: "SystemVerilog",
    level: 1,
    size: 120,
  },
];

const typeColors: Record<EventType, string> = {
  Verilog: "#6366f1",
  HVL: "#0ea5e9",
  SystemVerilog: "#f59e0b",
  Methodology: "#ec4899",
  UVM: "#22c55e",
  Standard: "#14b8a6",
};

const chartDimensions = {
  width: 840,
  height: 420,
  margin: { top: 24, right: 24, bottom: 72, left: 72 },
};

const HistoryTimelineChart: React.FC = () => {
  const { width, height, margin } = chartDimensions;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const [minYear, maxYear] = extent(timelineData, (d) => d.year) as [number, number];
  const xScale = scaleLinear()
    .domain([minYear - 1, maxYear + 1])
    .range([0, innerWidth]);

  const levelValues = Array.from(new Set(timelineData.map((d) => d.level))).sort((a, b) => a - b);
  const yScale = scalePoint<number>()
    .domain(levelValues)
    .range([innerHeight, 0])
    .padding(0.5);

  const radiusScale = scaleLinear()
    .domain([0, 200])
    .range([8, 22]);

  const xTicks = xScale.ticks(Math.min(10, maxYear - minYear)).filter((year) => year >= minYear && year <= maxYear);

  return (
    <div className="w-full" data-testid="history-timeline-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="presentation">
        <title>SystemVerilog and UVM timeline</title>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="currentColor" strokeOpacity={0.2} />

          {xTicks.map((tick) => {
            const x = xScale(tick);
            return (
              <g key={tick} transform={`translate(${x}, 0)`}>
                <line y1={0} y2={innerHeight} stroke="currentColor" strokeOpacity={0.05} />
                <text
                  y={innerHeight + 24}
                  textAnchor="middle"
                  fontSize={12}
                  fill="currentColor"
                  fillOpacity={0.7}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {levelValues.map((level) => {
            const y = yScale(level) ?? 0;
            return (
              <g key={level} transform={`translate(0, ${y})`}>
                <line x1={0} x2={innerWidth} stroke="currentColor" strokeOpacity={0.04} />
              </g>
            );
          })}

          {timelineData.map((event) => {
            const x = xScale(event.year);
            const y = yScale(event.level) ?? innerHeight / 2;
            const radius = radiusScale(event.size ?? 100);
            const alignRight = x > innerWidth - 160;
            const alignLeft = x < 160;
            const anchor = alignRight ? "end" : alignLeft ? "start" : "start";
            const direction = alignRight ? -1 : 1;
            const connectorLength = radius + 12;
            const labelOffset = radius + 16;
            return (
              <g key={`${event.name}-${event.year}`} transform={`translate(${x}, ${y})`}>
                <circle r={radius} fill={typeColors[event.type]} fillOpacity={0.85} />
                <line
                  x1={0}
                  y1={0}
                  x2={connectorLength * direction}
                  y2={0}
                  stroke="currentColor"
                  strokeOpacity={0.25}
                />
                <g transform={`translate(${labelOffset * direction}, 0)`}>
                  <text
                    dy={-4}
                    textAnchor={anchor}
                    fontSize={12}
                    fill="currentColor"
                    fillOpacity={0.85}
                    fontWeight={600}
                  >
                    {event.name}
                  </text>
                  <text
                    dy={12}
                    textAnchor={anchor}
                    fontSize={11}
                    fill="currentColor"
                    fillOpacity={0.7}
                  >
                    {event.year}
                  </text>
                </g>
                <title>{`${event.name} (${event.year}) — ${event.description}`}</title>
              </g>
            );
          })}

          <text
            x={innerWidth / 2}
            y={innerHeight + 52}
            textAnchor="middle"
            fontSize={12}
            fill="currentColor"
            fillOpacity={0.65}
          >
            Year
          </text>

          <g transform={`translate(0, ${-margin.top / 2})`}>
            {Object.entries(typeColors).map(([type, color], index) => (
              <g key={type} transform={`translate(${index * 140}, 0)`}>
                <circle cx={0} cy={0} r={6} fill={color} />
                <text
                  x={12}
                  dy={4}
                  fontSize={12}
                  fill="currentColor"
                  fillOpacity={0.75}
                >
                  {type}
                </text>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
};

export default HistoryTimelineChart;
