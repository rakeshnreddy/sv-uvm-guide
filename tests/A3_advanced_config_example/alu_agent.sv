`ifndef ALU_AGENT_SV
`define ALU_AGENT_SV

`include "alu_agent_config.sv"

class alu_agent extends uvm_agent;
  `uvm_component_utils(alu_agent)

  alu_driver m_driver;
  alu_monitor m_monitor;
  uvm_sequencer #(alu_transaction) m_sequencer;
  alu_agent_config m_config;

  function new(string name = "alu_agent", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(alu_agent_config)::get(this, "", "config", m_config))
      `uvm_fatal("NO_CONFIG", "Agent config not found!")

    uvm_config_db#(virtual alu_if)::set(this, "*", "vif", m_config.vif);

    m_monitor = alu_monitor::type_id::create("m_monitor", this);

    if (m_config.is_active == UVM_ACTIVE) begin
      m_driver = alu_driver::type_id::create("m_driver", this);
      m_sequencer = uvm_sequencer #(alu_transaction)::type_id::create("m_sequencer", this);
    end
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    if (m_config.is_active == UVM_ACTIVE) begin
      m_driver.seq_item_port.connect(m_sequencer.seq_item_export);
    end
  endfunction

endclass

`endif // ALU_AGENT_SV
