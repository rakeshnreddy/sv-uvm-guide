`ifndef COVERAGE_COLLECTOR_SV
`define COVERAGE_COLLECTOR_SV

class coverage_collector extends uvm_subscriber #(alu_transaction);
  `uvm_component_utils(coverage_collector)

  covergroup alu_op_cg with function sample(alu_transaction trans);
    option.per_instance = 1;
    OP_CP: coverpoint trans.op;
  endgroup

  function new(string name = "coverage_collector", uvm_component parent = null);
    super.new(name, parent);
    alu_op_cg = new();
  endfunction

  function void write(alu_transaction t);
    `uvm_info("COVERAGE", "Sampling transaction in covergroup", UVM_HIGH)
    alu_op_cg.sample(t);
  endfunction

endclass

`endif // COVERAGE_COLLECTOR_SV
