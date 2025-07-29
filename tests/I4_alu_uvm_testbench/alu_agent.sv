class alu_agent extends uvm_agent;
  `uvm_component_utils(alu_agent)

  alu_driver m_driver;
  alu_monitor m_monitor;
  uvm_sequencer #(alu_transaction) m_sequencer;

  function new(string name = "alu_agent", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_driver = alu_driver::type_id::create("m_driver", this);
    m_monitor = alu_monitor::type_id::create("m_monitor", this);
    m_sequencer = uvm_sequencer #(alu_transaction)::type_id::create("m_sequencer", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    m_driver.seq_item_port.connect(m_sequencer.seq_item_export);
    m_monitor.item_collected_port.connect(this.analysis_port);
  endfunction
endclass
