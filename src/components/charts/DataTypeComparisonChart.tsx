"use client";

import React, { useEffect, useId, useState } from "react";
import { scalePoint } from "d3-scale";

interface DataTypeFeature {
  name: string;
  states: number;
  isNet: boolean;
  allowsMultipleDrivers: boolean;
  primaryUseContext: string;
}

const data: DataTypeFeature[] = [
  {
    name: "logic",
    states: 4,
    isNet: false,
    allowsMultipleDrivers: false,
    primaryUseContext: "General-purpose variable for single procedural or continuous assignments.",
  },
  {
    name: "wire",
    states: 4,
    isNet: true,
    allowsMultipleDrivers: true,
    primaryUseContext: "Resolved connectivity between modules; ideal for structural wiring.",
  },
  {
    name: "reg",
    states: 4,
    isNet: false,
    allowsMultipleDrivers: false,
    primaryUseContext: "Legacy procedural storage kept for compatibility; replaced by logic in new code.",
  },
  {
    name: "bit",
    states: 2,
    isNet: false,
    allowsMultipleDrivers: false,
    primaryUseContext: "Two-state storage for performance-critical modelling (no X/Z).",
  },
];

const stateSymbols = ["0", "1", "X", "Z"];
const card = {
  width: 280,
  height: 220,
  gutterX: 48,
  gutterY: 56,
  padding: 24,
};

const layout = {
  maxColumns: 2,
  margin: { top: 32, right: 32, bottom: 32, left: 32 },
};

const stateActiveColor = "#6366f1";
const stateInactiveColor = "#c7d2fe";
const netColor = "#0ea5e9";
const variableColor = "#8b5cf6";
const driverColor = "#f59e0b";
const labelClass = "fill-slate-700 dark:fill-slate-200";

const DataTypeComparisonChart: React.FC = () => {
  const titleId = useId();
  const [columns, setColumns] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? 1 : layout.maxColumns,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const nextColumns = window.innerWidth < 768 ? 1 : layout.maxColumns;
      setColumns((prev) => (prev === nextColumns ? prev : nextColumns));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rows = Math.ceil(data.length / columns);
  const innerWidth = columns * card.width + (columns - 1) * card.gutterX;
  const innerHeight = rows * card.height + (rows - 1) * card.gutterY;
  const width = innerWidth + layout.margin.left + layout.margin.right;
  const height = innerHeight + layout.margin.top + layout.margin.bottom;

  return (
    <div data-testid="data-type-chart" className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        role="application"
        aria-labelledby={titleId}
      >
        <title id={titleId}>SystemVerilog data type guide</title>
        <g transform={`translate(${layout.margin.left}, ${layout.margin.top})`}>
          <text x={0} y={-12} fontSize={16} fontWeight={600} className={labelClass}>
            Storage semantics across common SystemVerilog types
          </text>

          {data.map((datum, index) => {
            const row = Math.floor(index / columns);
            const column = index % columns;
            const x = column * (card.width + card.gutterX);
            const y = row * (card.height + card.gutterY);
            const activeStates = datum.states === 2 ? 2 : stateSymbols.length;
            const stateScale = scalePoint<string>()
              .domain(stateSymbols)
              .range([card.padding, card.width - card.padding]);
            const cardTitleId = `${titleId}-${datum.name}`;

            return (
              <g key={datum.name} transform={`translate(${x}, ${y})`} aria-labelledby={cardTitleId}>
                <rect
                  width={card.width}
                  height={card.height}
                  rx={18}
                  className="fill-white dark:fill-slate-900 stroke-slate-300/60 dark:stroke-slate-600/50"
                  strokeWidth={1.5}
                />
                <text id={cardTitleId} x={card.padding} y={card.padding} fontSize={18} fontWeight={700} className={labelClass}>
                  {datum.name.toUpperCase()}
                </text>
                <foreignObject
                  x={card.padding}
                  y={card.padding + 12}
                  width={card.width - card.padding * 2}
                  height={56}
                >
                  <div
                    className="text-xs leading-relaxed text-slate-600 dark:text-slate-300"
                  >
                    {datum.primaryUseContext}
                  </div>
                </foreignObject>

                <text
                  x={card.padding}
                  y={card.padding + 84}
                  fontSize={12}
                  fontWeight={600}
                  className={labelClass}
                >
                  State space
                </text>
                <g transform={`translate(0, ${card.padding + 92})`}>
                  {stateSymbols.map((symbol, symbolIndex) => {
                    const cx = stateScale(symbol) ?? card.width / 2;
                    const active = symbolIndex < activeStates;
                    return (
                      <g key={symbol} transform={`translate(${cx}, 0)`}>
                        <circle
                          r={18}
                          fill={active ? stateActiveColor : stateInactiveColor}
                          fillOpacity={active ? 1 : 0.4}
                          stroke={active ? stateActiveColor : stateInactiveColor}
                          strokeWidth={active ? 2 : 1}
                        />
                        <text
                          y={4}
                          textAnchor="middle"
                          fontSize={13}
                          fontWeight={600}
                          fill={active ? "#ffffff" : stateActiveColor}
                        >
                          {symbol}
                        </text>
                      </g>
                    );
                  })}
                </g>

                <text
                  x={card.padding}
                  y={card.padding + 142}
                  fontSize={12}
                  fontWeight={600}
                  className={labelClass}
                >
                  Signal model
                </text>
                <g transform={`translate(${card.width / 2}, ${card.padding + 152})`}>
                  <rect
                    x={-38}
                    y={18}
                    width={76}
                    height={20}
                    rx={10}
                    fill={datum.isNet ? netColor : variableColor}
                    fillOpacity={0.18}
                    stroke={datum.isNet ? netColor : variableColor}
                    strokeDasharray={datum.isNet ? "0" : "6 4"}
                    strokeWidth={datum.isNet ? 2 : 1.5}
                  />
                  <text
                    y={22}
                    fontSize={11}
                    textAnchor="middle"
                    fill={datum.isNet ? netColor : variableColor}
                    fontWeight={600}
                  >
                    {datum.isNet ? "Resolved net" : "Variable"}
                  </text>
                  {datum.allowsMultipleDrivers ? [-34, 34].map((offset) => (
                    <g key={offset}>
                      <line
                        x1={offset}
                        y1={-8}
                        x2={0}
                        y2={28}
                        stroke={driverColor}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                      <circle cx={offset} cy={-12} r={8} fill={driverColor} fillOpacity={0.9} />
                    </g>
                  )) : (
                    <g>
                      <line x1={0} y1={-12} x2={0} y2={28} stroke={driverColor} strokeWidth={2} strokeLinecap="round" />
                      <circle cx={0} cy={-16} r={9} fill={driverColor} fillOpacity={0.9} />
                    </g>
                  )}
                  <circle cx={0} cy={40} r={10} fill={datum.isNet ? netColor : variableColor} />
                </g>

                <text
                  x={card.padding}
                  y={card.padding + 188}
                  fontSize={12}
                  className="fill-slate-600 dark:fill-slate-300"
                >
                  {datum.isNet ? "Supports connect-by-resolution semantics." : "Treated as single-source storage."}
                </text>
                <text
                  x={card.padding}
                  y={card.padding + 204}
                  fontSize={12}
                  className="fill-slate-600 dark:fill-slate-300"
                >
                  {datum.allowsMultipleDrivers ? "Multiple structural drivers permitted." : "Single driver enforced."}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Each card highlights how the type stores values, resolves drivers, and why you would choose it in a verification environment.
      </p>
    </div>
  );
};

export default DataTypeComparisonChart;
