export interface InterfaceExample {
  name: string;
  code: string;
  steps: string[];
  signals: {
    name: string;
    direction: 'in' | 'out' | 'inout';
    /** Marks signals the current modport cannot drive */
    restricted?: boolean;
    /** Timing markers for clocking block sample/drive phases */
    timing?: { sample?: number; drive?: number };
    /** Visual indicator for signal glitches */
    glitch?: boolean;
    /** Adds a propagation delay to the signal animation */
    delay?: boolean;
  }[];
  /** Number of interface instances when demonstrating arrayed interfaces */
  arraySize?: number;
  /** Parameter values used when the interface is parameterized */
  parameters?: Record<string, number | string>;
}

export const interfaceData: InterfaceExample[] = [
  {
    name: 'Simple Interface',
    code: 'interface simple_bus;\n  logic clk;\n  logic rw;\n  logic [7:0] data;\nendinterface',
    steps: [
      'An interface `simple_bus` is defined.',
      'It contains three signals: `clk`, `rw`, and `data`.',
      'This interface can be instantiated in the design and testbench.',
    ],
    signals: [
      { name: 'clk', direction: 'in' },
      { name: 'rw', direction: 'in' },
      { name: 'data', direction: 'inout' },
    ],
  },
  {
    name: 'Modports',
    code: 'interface simple_bus;\n  logic clk;\n  logic rw;\n  logic [7:0] data;\n\n  modport TB (input clk, output rw, inout data);\n  modport DUT (input clk, input rw, inout data);\nendinterface',
    steps: [
      'Modports `TB` and `DUT` are added to the interface.',
      'The `TB` modport defines the direction of the signals from the testbench\'s perspective.',
      'The `DUT` modport defines the direction of the signals from the DUT\'s perspective.',
      'Modport restrictions prevent the testbench from driving `clk`.',
    ],
    signals: [
      { name: 'clk', direction: 'in', restricted: true },
      { name: 'rw', direction: 'out' },
      { name: 'data', direction: 'inout' },
    ],
  },
  {
    name: 'Virtual Interface Binding',
    code: 'interface simple_bus;\n  logic clk;\n  logic rw;\n  logic [7:0] data;\n\n  modport TB (input clk, output rw, inout data);\n  modport DUT (input clk, input rw, inout data);\nendinterface\n\nclass driver;\n  virtual simple_bus.TB vif;\n  task drive();\n    @(posedge vif.clk);\n    vif.rw <= 1\'b1;\n  endtask\nendclass\n\nmodule top;\n  simple_bus bus();\n  driver drv;\n  initial begin\n    drv = new();\n    drv.vif = bus;\n  end\nendmodule',
    steps: [
      'A virtual interface is declared in the driver class.',
      'The driver binds to the interface instance in the testbench.',
      'Signals are driven through the virtual interface on clock edges.',
    ],
    signals: [
      { name: 'clk', direction: 'in' },
      { name: 'rw', direction: 'out' },
      { name: 'data', direction: 'inout' },
    ],
  },
  {
    name: 'Clocking Block',
    code: 'interface simple_bus(input logic clk);\n  logic rw;\n  logic [7:0] data;\n  clocking cb @(posedge clk);\n    input rw;\n    output #1 data;\n  endclocking\nendinterface',
    steps: [
      'A clocking block synchronizes sampling and driving with the clock.',
      'Timing markers show when `rw` is sampled and `data` is driven.',
    ],
    signals: [
      { name: 'clk', direction: 'in' },
      { name: 'rw', direction: 'in', timing: { sample: 0.2 } },
      { name: 'data', direction: 'out', timing: { drive: 0.7 } },
    ],
  },
  {
    name: 'Parameterized & Arrayed Interface',
    code: 'interface param_bus #(parameter WIDTH = 8) (input logic clk);\n  logic rw;\n  logic [WIDTH-1:0] data;\nendinterface\n\nmodule top;\n  param_bus #(.WIDTH(16)) bus[3] (.*);\nendmodule',
    steps: [
      'The interface `param_bus` is parameterized with a width.',
      'Three instances form an arrayed interface accessed via indexing.',
      'Glitches on `rw` and delays on `data` highlight signal integrity.',
    ],
    signals: [
      { name: 'clk', direction: 'in' },
      { name: 'rw', direction: 'in', glitch: true },
      { name: 'data', direction: 'inout', delay: true },
    ],
    arraySize: 3,
    parameters: { WIDTH: 16 },
  },
];
