"use client";

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// Mock Data
const completionData = [
  { module: 'SV Basics', completion: 100 },
  { module: 'UVM Intro', completion: 85 },
  { module: 'Coverage', completion: 70 },
  { module: 'Assertions', completion: 90 },
  { module: 'Advanced UVM', completion: 45 },
];

const engagementData = [
  { date: new Date(2023, 1, 1), minutes: 30 },
  { date: new Date(2023, 1, 2), minutes: 45 },
  { date: new Date(2023, 1, 3), minutes: 60 },
  { date: new Date(2023, 1, 4), minutes: 20 },
  { date: new Date(2023, 1, 5), minutes: 75 },
  { date: new Date(2023, 1, 6), minutes: 90 },
  { date: new Date(2023, 1, 7), minutes: 55 },
];

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white/10 p-4 rounded-lg text-center">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold text-primary">{value}</p>
  </div>
);

export const ProgressAnalytics = () => {
  const barChartRef = useRef<SVGSVGElement | null>(null);
  const lineChartRef = useRef<SVGSVGElement | null>(null);

  // Bar Chart for Module Completion
  useEffect(() => {
    if (!barChartRef.current) return;
    const svg = d3.select(barChartRef.current);
    const width = 350, height = 200, margin = { top: 20, right: 20, bottom: 30, left: 40 };

    svg.selectAll('*').remove();

    const x = d3.scaleBand().domain(completionData.map(d => d.module)).range([margin.left, width - margin.right]).padding(0.1);
    const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);

    svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x));
    svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y));

    svg.append('g')
      .selectAll('rect')
      .data(completionData)
      .join('rect')
        .attr('x', d => x(d.module)!)
        .attr('y', d => y(d.completion))
        .attr('height', d => y(0) - y(d.completion))
        .attr('width', x.bandwidth())
        .attr('fill', 'rgba(59, 130, 246, 0.7)');
  }, []);

  // Line Chart for Engagement
  useEffect(() => {
    if (!lineChartRef.current) return;
    const svg = d3.select(lineChartRef.current);
    const width = 350, height = 200, margin = { top: 20, right: 20, bottom: 30, left: 40 };

    svg.selectAll('*').remove();

    const x = d3.scaleTime().domain(d3.extent(engagementData, d => d.date) as [Date, Date]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, d3.max(engagementData, d => d.minutes) as number]).range([height - margin.bottom, margin.top]);

    svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y));

    const line = d3.line<{ date: Date, minutes: number }>()
      .x(d => x(d.date))
      .y(d => y(d.minutes));

    svg.append('path')
      .datum(engagementData)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(59, 130, 246, 1)')
      .attr('stroke-width', 2)
      .attr('d', line);
  }, []);

  return (
    <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
      <h2 className="text-2xl font-bold text-primary mb-4">Progress Analytics</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Time Spent" value="12h 45m" />
        <StatCard label="Modules Completed" value="4 / 7" />
        <StatCard label="Average Score" value="88%" />
        <StatCard label="Current Streak" value="5 days" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Module Completion</h3>
          <div className="bg-white/5 p-2 rounded-lg">
            <svg ref={barChartRef} viewBox={`0 0 350 200`}></svg>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Daily Engagement (minutes)</h3>
          <div className="bg-white/5 p-2 rounded-lg">
            <svg ref={lineChartRef} viewBox={`0 0 350 200`}></svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressAnalytics;
