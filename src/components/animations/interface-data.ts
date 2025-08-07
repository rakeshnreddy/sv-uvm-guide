export interface InterfaceExample {
  name: string;
  code: string;
  steps: string[];
  signals: { name: string; direction: 'in' | 'out' | 'inout' }[];
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
      { name: 'clk', direction: 'in' },
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
];
