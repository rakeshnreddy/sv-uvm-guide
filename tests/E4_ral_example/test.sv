`include "uvm_macros.svh"
`include "bus_seq_item.sv"
`include "driver.sv"
`include "ral_adapter.sv"
`include "reg_model.sv"

class base_test extends uvm_test;
  `uvm_component_utils(base_test)

  alu_reg_block ral_model;
  ral_adapter adapter;
  uvm_sequencer #(bus_seq_item) sequencer;
  driver drv;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);

    ral_model = alu_reg_block::type_id::create("ral_model");
    ral_model.build();

    adapter = ral_adapter::type_id::create("adapter");
    sequencer = uvm_sequencer #(bus_seq_item)::type_id::create("sequencer", this);
    drv = driver::type_id::create("driver", this);
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    drv.seq_item_port.connect(sequencer.seq_item_export);
    ral_model.default_map.set_sequencer(sequencer, adapter);
  endfunction

  virtual task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    `uvm_info(get_type_name(), "Starting test", UVM_LOW)

    // Run a built-in sequence
    uvm_reg_hw_reset_seq reset_seq = new();
    reset_seq.model = ral_model;
    reset_seq.start(sequencer);

    // Example of writing and reading
    uvm_status_e status;
    ral_model.ALU_OPERAND_A.write(status, 32'hdeadbeef);
    uvm_reg_data_t data;
    ral_model.ALU_OPERAND_A.read(status, data);
    `uvm_info(get_type_name(), $sformatf("Read back data: %h", data), UVM_LOW)

    phase.drop_objection(this);
  endtask
endclass
