"use client";

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export interface EngagementActivityChartProps {
  data: { name: string; activity: number }[];
}

const tooltipStyles = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
};

export const EngagementActivityChart: React.FC<EngagementActivityChartProps> = ({ data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip contentStyle={tooltipStyles} />
      <Legend />
      <Bar dataKey="activity" fill="hsl(var(--primary))" name="Activity Units" />
    </BarChart>
  </ResponsiveContainer>
);

export default EngagementActivityChart;
