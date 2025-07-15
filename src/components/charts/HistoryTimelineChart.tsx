"use client";

import React from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis, // Can be used for bubble size if desired
  CartesianGrid,
  Tooltip,
  LabelList,
  Legend,
  TooltipProps, // Import TooltipProps
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'; // For payload structure


interface TimelineEvent {
  year: number;
  name: string;
  description: string;
  type: 'Verilog' | 'HVL' | 'SystemVerilog' | 'Methodology' | 'UVM' | 'Standard';
  level: number; // To stagger items on Y-axis for readability
  size?: number; // For ZAxis, if used
}

const timelineData: TimelineEvent[] = [
  { year: 1995, name: 'Verilog IEEE 1364', description: 'Verilog standardized as IEEE 1364, primarily for RTL design. Basic verification capabilities.', type: 'Verilog', level: 1, size: 100 },
  { year: 2000, name: 'Rise of HVLs', description: "Specialized Hardware Verification Languages (OpenVera, 'e') emerge with OOP, randomization, coverage.", type: 'HVL', level: 2, size: 100 },
  { year: 2005, name: 'SystemVerilog IEEE 1800-2005', description: 'SystemVerilog standard released, extending Verilog with advanced verification features.', type: 'SystemVerilog', level: 1, size: 150 },
  { year: 2008, name: 'Methodology Wars', description: 'Competing SV methodologies: VMM (Synopsys) and OVM (Cadence, Mentor). (Approx. period)', type: 'Methodology', level: 2, size: 100 },
  { year: 2009, name: 'OVM 2.1.1 chosen for UVM', description: 'Accellera selects OVM 2.1.1 as the base for the upcoming Universal Verification Methodology.', type: 'Methodology', level: 1, size: 120 },
  { year: 2011, name: 'UVM 1.0 Released', description: 'Accellera approves and releases UVM 1.0, unifying verification methodologies.', type: 'UVM', level: 2, size: 150 },
  { year: 2017, name: 'UVM IEEE 1800.2-2017', description: 'UVM becomes an IEEE standard, further solidifying its industry adoption.', type: 'UVM', level: 1, size: 120},
  { year: 2020, name: 'UVM IEEE 1800.2-2020', description: 'Revision of the UVM IEEE standard.', type: 'UVM', level: 2, size: 120},
  { year: 2023, name: 'SystemVerilog IEEE 1800-2023', description: 'Latest revision of the SystemVerilog Language Reference Manual (LRM).', type: 'SystemVerilog', level: 1, size: 120 },
];

const typeColors = {
  Verilog: '#8884d8',
  HVL: '#82ca9d',
  SystemVerilog: '#ffc658',
  Methodology: '#ff7300',
  UVM: '#d0ed57',
  Standard: '#a4de6c',
};

// For the payload structure, assuming 'data.payload' is our TimelineEvent
interface CustomTooltipPayloadItem {
  payload: TimelineEvent; // The actual data object for the point
  name: string;
  value: number | string;
  color: string;
  dataKey: string;
  // Add other properties if Recharts includes them and they are needed
}

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  payload?: CustomTooltipPayloadItem[];
}

const CustomTooltipContent: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload; // dataPoint is now TimelineEvent
    return (
      <div className="p-3 bg-background/90 border border-border shadow-lg rounded-md">
        <p className="font-bold text-foreground">{`${dataPoint.name} (${dataPoint.year})`}</p>
        <p className="text-sm text-muted-foreground">{dataPoint.description}</p>
      </div>
    );
  }
  return null;
};

const HistoryTimelineChart: React.FC = () => {
  // Determine domain for XAxis based on data
  const years = timelineData.map(d => d.year);
  const minYear = Math.min(...years) - 2;
  const maxYear = Math.max(...years) + 2;

  return (
    <div style={{ width: '100%', height: 500 }} className="my-8">
      <ResponsiveContainer>
        <ScatterChart
          margin={{
            top: 20,
            right: 30,
            bottom: 40, // Increased bottom margin for XAxis labels
            left: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3}/>
          <XAxis
            type="number"
            dataKey="year"
            name="Year"
            domain={[minYear, maxYear]}
            tickCount={Math.min(10, maxYear - minYear +1)}
            tickFormatter={(tick) => String(tick)}
            allowDecimals={false}
            label={{ value: "Year", position: 'insideBottom', offset: -25, style: { fill: 'currentColor', fontSize: '0.9rem' } }}
          />
          <YAxis
            type="number"
            dataKey="level"
            name="Event Track" // Using 'level' to stagger points
            domain={[0, 3]} // Adjust based on max level + buffer
            tickCount={3}
            tick={false} // Hide Y-axis ticks
            axisLine={false} // Hide Y-axis line
            // label={{ value: 'Timeline', angle: -90, position: 'insideLeft', style: { fill: 'currentColor', fontSize: '0.9rem' } }}
          />
          <ZAxis type="number" dataKey="size" range={[50, 200]} name="Impact" unit="" />

          <Tooltip content={<CustomTooltipContent />} cursor={{ strokeDasharray: '3 3' }} />
          <Legend verticalAlign="top" height={36} />

          {(Object.keys(typeColors) as Array<keyof typeof typeColors>).map((type) => (
            <Scatter
              key={type}
              name={type}
              data={timelineData.filter(d => d.type === type)}
              fill={typeColors[type]}
              shape="circle" // or "star", "triangle", etc.
            >
              <LabelList dataKey="name" position="top" angle={-30} fontSize={10} offset={10} />
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistoryTimelineChart;
