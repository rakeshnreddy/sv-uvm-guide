"use client";

import React from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { max } from "d3-array";

export interface EngagementActivityChartProps {
  data: { name: string; activity: number }[];
}

const chartDimensions = {
  width: 640,
  height: 240,
  margin: { top: 20, right: 16, bottom: 48, left: 48 },
};

export const EngagementActivityChart: React.FC<EngagementActivityChartProps> = ({ data }) => {
  const { width, height, margin } = chartDimensions;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const domain = data.map((d) => d.name);
  const maxValue = max(data, (d) => d.activity) ?? 0;
  const yDomainMax = maxValue === 0 ? 1 : maxValue;

  const xScale = scaleBand<string>()
    .domain(domain)
    .range([0, innerWidth])
    .padding(0.2);

  const yScale = scaleLinear()
    .domain([0, yDomainMax])
    .range([innerHeight, 0])
    .nice();

  const yTicks = yScale.ticks(4);

  const barColor = "hsl(var(--primary))";

  return (
    <div className="w-full" aria-label="Engagement activity chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="application"
        className="h-full w-full"
        style={{ maxHeight: 260 }}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="currentColor" strokeOpacity={0.15} />

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
                  fillOpacity={0.6}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {data.map((d) => {
            const x = xScale(d.name);
            if (x == null) return null;
            const barHeight = innerHeight - yScale(d.activity);
            return (
              <g key={d.name} transform={`translate(${x}, ${yScale(d.activity)})`}>
                <rect
                  width={xScale.bandwidth()}
                  height={Math.max(0, barHeight)}
                  fill={barColor}
                  fillOpacity={0.85}
                  rx={4}
                >
                  <title>{`${d.name}: ${d.activity}`}</title>
                </rect>
                <text
                  x={xScale.bandwidth() / 2}
                  y={-6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="currentColor"
                  fillOpacity={0.75}
                >
                  {d.activity}
                </text>
              </g>
            );
          })}

          {domain.map((label) => {
            const x = xScale(label);
            if (x == null) return null;
            return (
              <text
                key={label}
                x={x + xScale.bandwidth() / 2}
                y={innerHeight + 12}
                dy={16}
                textAnchor="middle"
                fontSize={12}
                fill="currentColor"
                fillOpacity={0.7}
              >
                {label}
              </text>
            );
          })}

          <text
            x={-margin.left + 8}
            y={-8}
            fontSize={12}
            fill="currentColor"
            fillOpacity={0.7}
            textAnchor="start"
          >
            Activity Units
          </text>
        </g>
      </svg>
    </div>
  );
};

export default EngagementActivityChart;
