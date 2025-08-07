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
  type: 'seq_item' | 'analysis' | 'composition' | 'inheritance'; // Type of connection
  phase?: string; // Optional phase information for overlaying execution order
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
  // Base UVM class nodes for inheritance relationships
  { id: 'uvm_component', name: 'uvm_component', type: 'uvm_class', description: 'Base class for all UVM components.' },
  { id: 'uvm_test', name: 'uvm_test', type: 'uvm_class', description: 'Base class for tests.' },
  { id: 'uvm_env', name: 'uvm_env', type: 'uvm_class', description: 'Base class for environments.' },
  { id: 'uvm_agent', name: 'uvm_agent', type: 'uvm_class', description: 'Base class for agents.' },
  { id: 'uvm_sequencer', name: 'uvm_sequencer', type: 'uvm_class', description: 'Base class for sequencers.' },
  { id: 'uvm_driver', name: 'uvm_driver', type: 'uvm_class', description: 'Base class for drivers.' },
  { id: 'uvm_monitor', name: 'uvm_monitor', type: 'uvm_class', description: 'Base class for monitors.' },
  { id: 'uvm_scoreboard', name: 'uvm_scoreboard', type: 'uvm_class', description: 'Base class for scoreboards.' },
  { id: 'uvm_subscriber', name: 'uvm_subscriber', type: 'uvm_class', description: 'Base class for subscribers.' },
];

export const uvmConnections: UvmConnection[] = [
  // Composition relationships happen during build_phase
  { source: 'test', target: 'env', type: 'composition', phase: 'build_phase', description: 'Test instantiates the Environment.' },
  { source: 'env', target: 'agent_active', type: 'composition', phase: 'build_phase', description: 'Environment instantiates the Active Agent.' },
  { source: 'env', target: 'agent_passive', type: 'composition', phase: 'build_phase', description: 'Environment instantiates the Passive Agent.' },
  { source: 'env', target: 'scoreboard', type: 'composition', phase: 'build_phase', description: 'Environment instantiates the Scoreboard.' },
  { source: 'env', target: 'coverage_collector', type: 'composition', phase: 'build_phase', description: 'Environment instantiates the Coverage Collector.' },
  { source: 'agent_active', target: 'sequencer_active', type: 'composition', phase: 'build_phase', description: 'Active Agent instantiates the Sequencer.' },
  { source: 'agent_active', target: 'driver_active', type: 'composition', phase: 'build_phase', description: 'Active Agent instantiates the Driver.' },
  { source: 'agent_active', target: 'monitor_active', type: 'composition', phase: 'build_phase', description: 'Active Agent instantiates the Monitor.' },
  { source: 'agent_passive', target: 'monitor_passive', type: 'composition', phase: 'build_phase', description: 'Passive Agent instantiates the Monitor.' },
  // Port connections occur during the run_phase
  { source: 'sequencer_active', target: 'driver_active', type: 'seq_item', phase: 'run_phase', description: 'Sequencer sends transaction items to the Driver for execution.' },
  { source: 'monitor_active', target: 'scoreboard', type: 'analysis', phase: 'run_phase', description: 'Active Monitor sends observed transactions to the Scoreboard for checking.' },
  { source: 'monitor_passive', target: 'scoreboard', type: 'analysis', phase: 'run_phase', description: 'Passive Monitor sends observed transactions to the Scoreboard for checking.' },
  { source: 'monitor_active', target: 'coverage_collector', type: 'analysis', phase: 'run_phase', description: 'Active Monitor sends observed transactions to the Functional Coverage collector.' },
  { source: 'monitor_passive', target: 'coverage_collector', type: 'analysis', phase: 'run_phase', description: 'Passive Monitor sends observed transactions to the Functional Coverage collector.' },
  // Inheritance relationships are compile-time
  { source: 'test', target: 'uvm_test', type: 'inheritance', phase: 'compile', description: 'Test extends uvm_test.' },
  { source: 'env', target: 'uvm_env', type: 'inheritance', phase: 'compile', description: 'Environment extends uvm_env.' },
  { source: 'agent_active', target: 'uvm_agent', type: 'inheritance', phase: 'compile', description: 'Active Agent extends uvm_agent.' },
  { source: 'agent_passive', target: 'uvm_agent', type: 'inheritance', phase: 'compile', description: 'Passive Agent extends uvm_agent.' },
  { source: 'sequencer_active', target: 'uvm_sequencer', type: 'inheritance', phase: 'compile', description: 'Sequencer extends uvm_sequencer.' },
  { source: 'driver_active', target: 'uvm_driver', type: 'inheritance', phase: 'compile', description: 'Driver extends uvm_driver.' },
  { source: 'monitor_active', target: 'uvm_monitor', type: 'inheritance', phase: 'compile', description: 'Active Monitor extends uvm_monitor.' },
  { source: 'monitor_passive', target: 'uvm_monitor', type: 'inheritance', phase: 'compile', description: 'Passive Monitor extends uvm_monitor.' },
  { source: 'scoreboard', target: 'uvm_scoreboard', type: 'inheritance', phase: 'compile', description: 'Scoreboard extends uvm_scoreboard.' },
  { source: 'coverage_collector', target: 'uvm_subscriber', type: 'inheritance', phase: 'compile', description: 'Functional Coverage extends uvm_subscriber.' },
  { source: 'uvm_test', target: 'uvm_component', type: 'inheritance', phase: 'compile', description: 'uvm_test extends uvm_component.' },
  { source: 'uvm_env', target: 'uvm_component', type: 'inheritance', phase: 'compile', description: 'uvm_env extends uvm_component.' },
  { source: 'uvm_agent', target: 'uvm_component', type: 'inheritance', phase: 'compile', description: 'uvm_agent extends uvm_component.' },
  { source: 'uvm_sequencer', target: 'uvm_component', type: 'inheritance', phase: 'compile', description: 'uvm_sequencer extends uvm_component.' },
  { source: 'uvm_driver', target: 'uvm_component', type: 'inheritance', phase: 'compile', description: 'uvm_driver extends uvm_component.' },
  { source: 'uvm_monitor', target: 'uvm_component', type: 'inheritance', phase: 'compile', description: 'uvm_monitor extends uvm_component.' },
  { source: 'uvm_scoreboard', target: 'uvm_component', type: 'inheritance', phase: 'compile', description: 'uvm_scoreboard extends uvm_component.' },
  { source: 'uvm_subscriber', target: 'uvm_component', type: 'inheritance', phase: 'compile', description: 'uvm_subscriber extends uvm_component.' }
];
