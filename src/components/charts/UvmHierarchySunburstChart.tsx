"use client";

import React from 'react'; // Removed useState
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    TooltipProps // Added import
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'; // Added import


interface SunburstNode {
  name: string;
  value: number; // Determines segment size; can be arbitrary if structure is key
  children?: SunburstNode[];
  fill?: string; // Optional: if specific colors are desired per node
  description?: string; // For tooltip
}

// Simplified UVM Hierarchy for Sunburst
// Values are arbitrary for now, just to give some size to segments.
const uvmHierarchyData: SunburstNode[] = [
  {
    name: 'uvm_object',
    value: 100,
    description: 'Base class for all UVM data and component classes (excluding uvm_void).',
    children: [
      {
        name: 'uvm_transaction',
        value: 20,
        description: 'Base class for transactions passed between components.',
        children: [
          { name: 'uvm_sequence_item', value: 10, description: 'Often used interchangeably with uvm_transaction; base for sequence transactions.' },
        ],
      },
      {
        name: 'uvm_sequence_base',
        value: 20,
        description: 'Base class for sequences that generate transactions.',
         children: [
          { name: 'uvm_sequence #(REQ,RSP)', value: 10, description: 'Parameterized sequence class.' },
        ],
      },
      {
        name: 'uvm_report_object',
        value: 60, // Larger because uvm_component is under it
        description: 'Provides messaging and reporting capabilities.',
        children: [
          {
            name: 'uvm_component',
            value: 50,
            description: 'Base class for all static, structural UVM components that participate in phasing.',
            children: [
              { name: 'uvm_driver', value: 5, description: 'Drives transactions to the DUT.' },
              { name: 'uvm_monitor', value: 5, description: 'Observes DUT signals and creates transactions.' },
              { name: 'uvm_sequencer', value: 5, description: 'Controls item flow from sequences to drivers.' },
              { name: 'uvm_scoreboard', value: 5, description: 'Checks DUT behavior.' },
              { name: 'uvm_agent', value: 10, description: 'Encapsulates driver, sequencer, monitor for an interface.' },
              { name: 'uvm_env', value: 10, description: 'Top-level environment component, contains agents and scoreboards.' },
              { name: 'uvm_test', value: 10, description: 'Top-level component that initiates the test scenario.' },
            ],
          },
        ],
      },
    ],
  },
];

// Colors for different levels or types - can be expanded
const COLORS_LEVEL_1 = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const COLORS_LEVEL_2 = ['#8884d8', '#82ca9d', '#ffc658', '#ff85c0', '#a4de6c'];
const COLORS_LEVEL_3 = ['#d0ed57', '#ffc658', '#8dd1e1', '#83a6ed', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];

// ... (SunburstNode and uvmHierarchyData definitions remain the same) ...

// Colors for different levels or types - can be expanded
// ... (COLORS_LEVEL_1 etc. remain the same) ...

interface CustomTooltipPayloadItem { // Renamed from previous example to avoid conflict if any
  name: string; // Corresponds to the nameKey of the Pie segment
  value: number; // Corresponds to the dataKey of the Pie segment
  payload: SunburstNode; // This is the actual node from our data
  // Recharts might add other properties like color, fill, etc.
  fill?: string;
}

interface ResolvedTooltipProps extends TooltipProps<ValueType, NameType> {
  // active and label are already in TooltipProps from Recharts
  payload?: CustomTooltipPayloadItem[]; // Use the more specific payload type
}

const CustomTooltipContent: React.FC<ResolvedTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataNode = payload[0].payload; // Access the SunburstNode directly
      const nodeName = dataNode.name;
      const nodeDescription = dataNode.description || "UVM class.";

      return (
        <div className="p-3 bg-background/95 border border-border shadow-lg rounded-md max-w-xs">
          <p className="font-bold text-foreground mb-1">{nodeName}</p>
          <p className="text-sm text-muted-foreground">{nodeDescription}</p>
        </div>
      );
    }
    return null;
};


const UvmHierarchySunburstChart: React.FC = () => {
  // Note: Recharts doesn't have a native Sunburst chart.
  // This implementation uses nested Pie charts to simulate a sunburst.
  // True drill-down interactivity is complex and not implemented here.
  // This will show up to 3 levels.

  // const [tooltipData, setTooltipData] = useState(null); // Removed unused state

  return (
    <div style={{ width: '100%', height: 500 }} className="my-8">
      <ResponsiveContainer>
        <PieChart>
          <Tooltip content={<CustomTooltipContent />} />
          {/* Level 1 Pie (Innermost) */}
          <Pie
            data={uvmHierarchyData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="25%"
            fill="#8884d8"
            paddingAngle={2}
          >
            {uvmHierarchyData.map((entry, index) => (
              <Cell key={`cell-l1-${index}`} fill={entry.fill || COLORS_LEVEL_1[index % COLORS_LEVEL_1.length]} />
            ))}
          </Pie>

          {/* Level 2 Pie */}
          <Pie
            data={uvmHierarchyData.flatMap(l1 => l1.children || [])}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="30%"
            outerRadius="50%"
            fill="#82ca9d"
            paddingAngle={2}
          >
            {uvmHierarchyData.flatMap(l1 => l1.children || []).map((entry, index) => (
              <Cell key={`cell-l2-${index}`} fill={entry.fill || COLORS_LEVEL_2[index % COLORS_LEVEL_2.length]} />
            ))}
          </Pie>

          {/* Level 3 Pie (Outermost) */}
          <Pie
            data={uvmHierarchyData.flatMap(l1 => (l1.children || []).flatMap(l2 => l2.children || []))}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="75%"
            fill="#ffc658"
            paddingAngle={1}
            labelLine={false}
            // label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} // Example label
          >
            {uvmHierarchyData.flatMap(l1 => (l1.children || []).flatMap(l2 => l2.children || [])).map((entry, index) => (
              <Cell key={`cell-l3-${index}`} fill={entry.fill || COLORS_LEVEL_3[index % COLORS_LEVEL_3.length]} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default UvmHierarchySunburstChart;
