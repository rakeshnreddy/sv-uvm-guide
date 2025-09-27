"use client";

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  TooltipProps, // Import
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'; // Import

interface DataTypeFeature {
  name: string;
  states: number; // 2 or 4
  isNet: number; // 0 for No (variable), 1 for Yes (net)
  allowsMultipleDrivers: number; // 0 for No, 1 for Yes
  primaryUseContext: string; // Short description
}

const data: DataTypeFeature[] = [
  { name: 'logic', states: 4, isNet: 0, allowsMultipleDrivers: 0, primaryUseContext: 'General purpose variable, single driver (procedural or continuous)' },
  { name: 'wire', states: 4, isNet: 1, allowsMultipleDrivers: 1, primaryUseContext: 'Net for connecting components, supports multiple drivers' },
  { name: 'reg', states: 4, isNet: 0, allowsMultipleDrivers: 0, primaryUseContext: 'Legacy variable for procedural assignment memory (largely replaceable by logic in SV)' },
  { name: 'bit', states: 2, isNet: 0, allowsMultipleDrivers: 0, primaryUseContext: '2-state variable, memory efficient, faster simulation' },
];

interface ComparisonTooltipPayloadItem {
  name: string; // Name of the Bar (e.g., "Number of States")
  value: number; // Value of this bar segment
  payload: DataTypeFeature; // The full data object for the XAxis category (e.g., logic, wire)
  dataKey: string; // e.g., "states", "isNet"
  color?: string; // Bar fill color
}

interface ComparisonCustomTooltipProps extends TooltipProps<ValueType, NameType> {
  payload?: ComparisonTooltipPayloadItem[];
  label?: string; // The XAxis label (e.g., "logic", "wire")
}

const CustomTooltipContent = ({ active, payload, label }: ComparisonCustomTooltipProps) => {
  if (active && payload && payload.length) {
    const dataPoint = data.find(d => d.name === label);
    return (
      <div className="p-3 bg-background/90 border border-border shadow-lg rounded-md max-w-xs">
        <p className="font-bold text-foreground mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm">
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
        {dataPoint && <p className="text-xs text-muted-foreground mt-1">Use: {dataPoint.primaryUseContext}</p>}
      </div>
    );
  }
  return null;
};


const DataTypeComparisonChart: React.FC = () => {
  return (
    <div data-testid="data-type-chart" style={{ width: '100%', height: 400 }} className="my-8">
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3}/>
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip content={<CustomTooltipContent />} />
          <Legend />
          <Bar dataKey="states" fill="#8884d8" name="Number of States (2 or 4)">
            <LabelList dataKey="states" position="top" style={{ fill: 'currentColor', fontSize: '0.8rem' }}/>
          </Bar>
          <Bar dataKey="isNet" fill="#82ca9d" name="Is a Net Type (1=Yes, 0=No)">
             <LabelList dataKey="isNet" position="top" style={{ fill: 'currentColor', fontSize: '0.8rem' }}/>
          </Bar>
          <Bar dataKey="allowsMultipleDrivers" fill="#ffc658" name="Allows Multiple Drivers (1=Yes, 0=No)">
            <LabelList dataKey="allowsMultipleDrivers" position="top" style={{ fill: 'currentColor', fontSize: '0.8rem' }}/>
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center mt-2">
        This chart provides a simplified comparison. &apos;reg&apos; behavior can be nuanced in SystemVerilog vs. traditional Verilog.
      </p>
    </div>
  );
};

export default DataTypeComparisonChart;
