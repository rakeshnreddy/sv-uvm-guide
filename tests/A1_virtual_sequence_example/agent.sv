`ifndef AGENT_SV
`define AGENT_SV

class agent extends uvm_agent;
  `uvm_component_utils(agent)

  sequencer m_sequencer;
  driver m_driver;
  monitor m_monitor;

  function new(string name = "agent", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_sequencer = sequencer::type_id::create("m_sequencer", this);
    m_driver = driver::type_id::create("m_driver", this);
    m_monitor = monitor::type_id::create("m_monitor", this);
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    m_driver.seq_item_port.connect(m_sequencer.seq_item_export);
  endfunction

endclass

`endif // AGENT_SV
