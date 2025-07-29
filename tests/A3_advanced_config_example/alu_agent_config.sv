`ifndef ALU_AGENT_CONFIG_SV
`define ALU_AGENT_CONFIG_SV

class alu_agent_config extends uvm_object;
  `uvm_object_utils(alu_agent_config)

  uvm_active_passive_enum is_active = UVM_ACTIVE;
  bit has_coverage = 1;
  virtual alu_if vif;

  function new(string name = "alu_agent_config");
    super.new(name);
  endfunction
endclass

`endif // ALU_AGENT_CONFIG_SV
