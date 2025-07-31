export interface UvmComponent {
  id: string; // Unique identifier (e.g., 'test')
  name: string; // Display name (e.g., 'UVM Test')
  type: string; // UVM class (e.g., 'uvm_test')
  description: string; // Tooltip text
  parent?: string; // ID of the parent component
  children?: string[]; // IDs of child components
}

export interface UvmConnection {
  source: string; // ID of the source component
  target: string;   // ID of the target component
  type: 'seq_item' | 'analysis' | 'parent_child'; // Type of connection
  description: string; // Tooltip text for the connection
}

export const uvmComponents: UvmComponent[] = [
  {
    id: 'test',
    name: 'Test',
    type: 'uvm_test',
    description: 'Top-level class that configures and runs the test environment. It instantiates the environment and applies configuration settings.',
    children: ['env']
  },
  {
    id: 'env',
    name: 'Environment',
    type: 'uvm_env',
    parent: 'test',
    description: 'A container component that encapsulates agents, scoreboard, and other analysis components like functional coverage collectors.',
    children: ['agent_active', 'agent_passive', 'scoreboard', 'coverage_collector']
  },
  {
    id: 'agent_active',
    name: 'Active Agent',
    type: 'uvm_agent',
    parent: 'env',
    description: 'An agent that actively drives stimulus to the DUT. It contains a sequencer, driver, and monitor.',
    children: ['sequencer_active', 'driver_active', 'monitor_active']
  },
  {
    id: 'agent_passive',
    name: 'Passive Agent',
    type: 'uvm_agent',
    parent: 'env',
    description: 'An agent that only monitors DUT activity and does not drive stimulus. It typically contains only a monitor.',
    children: ['monitor_passive']
  },
  {
    id: 'sequencer_active',
    name: 'Sequencer',
    type: 'uvm_sequencer',
    parent: 'agent_active',
    description: 'Generates sequences of transactions (seq_items) and sends them to the driver for execution.'
  },
  {
    id: 'driver_active',
    name: 'Driver',
    type: 'uvm_driver',
    parent: 'agent_active',
    description: 'Receives transaction items from the sequencer and drives them onto the DUT interface pins.'
  },
  {
    id: 'monitor_active',
    name: 'Monitor (Active)',
    type: 'uvm_monitor',
    parent: 'agent_active',
    description: 'Observes the DUT interface signals, collects transactions, and broadcasts them to analysis components like the scoreboard.'
  },
  {
    id: 'monitor_passive',
    name: 'Monitor (Passive)',
    type: 'uvm_monitor',
    parent: 'agent_passive',
    description: 'Observes a different DUT interface, collects transactions, and broadcasts them for analysis. Does not participate in driving stimulus.'
  },
  {
    id: 'scoreboard',
    name: 'Scoreboard',
    type: 'uvm_scoreboard',
    parent: 'env',
    description: 'An analysis component that receives transactions from monitors, compares them against a golden reference model, and reports any discrepancies.'
  },
  {
    id: 'coverage_collector',
    name: 'Functional Coverage',
    type: 'uvm_subscriber',
    parent: 'env',
    description: 'An analysis component that subscribes to transaction streams from monitors and uses them to sample functional coverage points.'
  },
];

export const uvmConnections: UvmConnection[] = [
  { source: 'test', target: 'env', type: 'parent_child', description: 'Test instantiates the Environment.' },
  { source: 'env', target: 'agent_active', type: 'parent_child', description: 'Environment instantiates the Active Agent.' },
  { source: 'env', target: 'agent_passive', type: 'parent_child', description: 'Environment instantiates the Passive Agent.' },
  { source: 'env', target: 'scoreboard', type: 'parent_child', description: 'Environment instantiates the Scoreboard.' },
  { source: 'env', target: 'coverage_collector', type: 'parent_child', description: 'Environment instantiates the Coverage Collector.' },
  { source: 'agent_active', target: 'sequencer_active', type: 'parent_child', description: 'Active Agent instantiates the Sequencer.' },
  { source: 'agent_active', target: 'driver_active', type: 'parent_child', description: 'Active Agent instantiates the Driver.' },
  { source: 'agent_active', target: 'monitor_active', type: 'parent_child', description: 'Active Agent instantiates the Monitor.' },
  { source: 'agent_passive', target: 'monitor_passive', type: 'parent_child', description: 'Passive Agent instantiates the Monitor.' },
  { source: 'sequencer_active', target: 'driver_active', type: 'seq_item', description: 'Sequencer sends transaction items to the Driver for execution.' },
  { source: 'monitor_active', target: 'scoreboard', type: 'analysis', description: 'Active Monitor sends observed transactions to the Scoreboard for checking.' },
  { source: 'monitor_passive', target: 'scoreboard', type: 'analysis', description: 'Passive Monitor sends observed transactions to the Scoreboard for checking.' },
  { source: 'monitor_active', target: 'coverage_collector', type: 'analysis', description: 'Active Monitor sends observed transactions to the Functional Coverage collector.' },
  { source: 'monitor_passive', target: 'coverage_collector', type: 'analysis', description: 'Passive Monitor sends observed transactions to the Functional Coverage collector.' }
];
