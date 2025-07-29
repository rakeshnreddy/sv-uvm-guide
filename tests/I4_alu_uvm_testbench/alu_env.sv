`include "scoreboard.sv"
`include "coverage_collector.sv"
`include "alu_output_monitor.sv"

class alu_env extends uvm_env;
  `uvm_component_utils(alu_env)

  alu_agent m_agent;
  alu_output_monitor m_output_monitor;
  scoreboard m_scoreboard;
  coverage_collector m_coverage;

  function new(string name = "alu_env", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_agent = alu_agent::type_id::create("m_agent", this);
    m_output_monitor = alu_output_monitor::type_id::create("m_output_monitor", this);
    m_scoreboard = scoreboard::type_id::create("m_scoreboard", this);
    m_coverage = coverage_collector::type_id::create("m_coverage", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    m_agent.m_monitor.item_collected_port.connect(m_scoreboard.input_analysis_export);
    m_agent.m_monitor.item_collected_port.connect(m_coverage.analysis_export);
    m_output_monitor.item_collected_port.connect(m_scoreboard.output_analysis_export);
  endfunction
endclass
