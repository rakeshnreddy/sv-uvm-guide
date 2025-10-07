"use client";

import React from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { max } from "d3-array";

interface DataTypeFeature {
  name: string;
  states: number;
  isNet: number;
  allowsMultipleDrivers: number;
  primaryUseContext: string;
}

const data: DataTypeFeature[] = [
  {
    name: "logic",
    states: 4,
    isNet: 0,
    allowsMultipleDrivers: 0,
    primaryUseContext: "General purpose variable, single driver (procedural or continuous)",
  },
  {
    name: "wire",
    states: 4,
    isNet: 1,
    allowsMultipleDrivers: 1,
    primaryUseContext: "Net for connecting components, supports multiple drivers",
  },
  {
    name: "reg",
    states: 4,
    isNet: 0,
    allowsMultipleDrivers: 0,
    primaryUseContext: "Legacy variable for procedural assignment memory (largely replaceable by logic in SV)",
  },
  {
    name: "bit",
    states: 2,
    isNet: 0,
    allowsMultipleDrivers: 0,
    primaryUseContext: "2-state variable, memory efficient, faster simulation",
  },
];

const series = [
  { key: "states", label: "Number of States", color: "#6366f1" },
  { key: "isNet", label: "Is Net (1=Yes)", color: "#10b981" },
  {
    key: "allowsMultipleDrivers",
    label: "Allows Multiple Drivers (1=Yes)",
    color: "#f59e0b",
  },
] as const;

const chartDimensions = {
  width: 760,
  height: 420,
  margin: { top: 36, right: 24, bottom: 88, left: 64 },
};

const toTitle = (name: string) => name.toUpperCase();

const DataTypeComparisonChart: React.FC = () => {
  const { width, height, margin } = chartDimensions;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x0 = scaleBand<string>()
    .domain(data.map((d) => d.name))
    .range([0, innerWidth])
    .padding(0.25);

  const x1 = scaleBand<string>()
    .domain(series.map((s) => s.key))
    .range([0, x0.bandwidth()])
    .padding(0.15);

  const maxValue = max(series, (s) => max(data, (d) => d[s.key]) ?? 0) ?? 1;
  const yScale = scaleLinear()
    .domain([0, Math.max(4, maxValue)])
    .range([innerHeight, 0])
    .nice();

  const yTicks = yScale.ticks(4);

  return (
    <div data-testid="data-type-chart" className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="presentation">
        <title>SystemVerilog data type comparison</title>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {yTicks.map((tick) => {
            const y = yScale(tick);
            return (
              <g key={tick} transform={`translate(0, ${y})`}>
                <line x1={0} x2={innerWidth} stroke="currentColor" strokeOpacity={0.05} />
                <text
                  x={-12}
                  dy="0.32em"
                  fontSize={12}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.7}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {data.map((datum) => {
            const xGroup = x0(datum.name);
            if (xGroup == null) return null;
            return (
              <g key={datum.name} transform={`translate(${xGroup}, 0)`}>
                <title>{`${toTitle(datum.name)} — ${datum.primaryUseContext}`}</title>
                {series.map((serie) => {
                  const xBar = x1(serie.key);
                  if (xBar == null) return null;
                  const value = datum[serie.key];
                  const barHeight = innerHeight - yScale(value);
                  return (
                    <g key={serie.key} transform={`translate(${xBar}, ${yScale(value)})`}>
                      <rect
                        width={x1.bandwidth()}
                        height={Math.max(0, barHeight)}
                        fill={serie.color}
                        rx={4}
                      >
                        <title>
                          {`${toTitle(datum.name)} – ${serie.label}: ${value}`}
                        </title>
                      </rect>
                      <text
                        x={x1.bandwidth() / 2}
                        y={-6}
                        textAnchor="middle"
                        fontSize={11}
                        fill="currentColor"
                        fillOpacity={0.75}
                      >
                        {value}
                      </text>
                    </g>
                  );
                })}

                <text
                  x={x0.bandwidth() / 2}
                  y={innerHeight + 12}
                  dy={20}
                  textAnchor="middle"
                  fontSize={12}
                  fill="currentColor"
                  fillOpacity={0.8}
                  fontWeight={600}
                >
                  {datum.name}
                </text>
              </g>
            );
          })}

          <text
            x={-margin.left + 14}
            y={-16}
            fontSize={12}
            fill="currentColor"
            fillOpacity={0.75}
            textAnchor="start"
          >
            Feature value
          </text>

          <g transform={`translate(0, ${innerHeight + 56})`}>
            {series.map((serie, index) => (
              <g key={serie.key} transform={`translate(${index * 180}, 0)`}>
                <rect width={14} height={14} fill={serie.color} rx={3} />
                <text
                  x={20}
                  y={11}
                  fontSize={12}
                  fill="currentColor"
                  fillOpacity={0.75}
                >
                  {serie.label}
                </text>
              </g>
            ))}
          </g>
        </g>
      </svg>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        The chart highlights how each SystemVerilog type differs in state space, net behaviour, and driver rules. Values are simplified for instruction.
      </p>
    </div>
  );
};

export default DataTypeComparisonChart;
