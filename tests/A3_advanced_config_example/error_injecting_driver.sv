`ifndef ERROR_INJECTING_DRIVER_SV
`define ERROR_INJECTING_DRIVER_SV

class error_injecting_driver extends alu_driver;
  `uvm_component_utils(error_injecting_driver)

  function new(string name = "error_injecting_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual task drive_item(alu_transaction tx);
    if ($urandom_range(0, 9) == 0) begin // 10% chance to inject error
      `uvm_info("INJECT_ERROR", "Corrupting opcode!", UVM_MEDIUM)
      tx.op = alu_op_e'($urandom); // Corrupt the opcode
    end
    super.drive_item(tx);
  endtask

endclass

`endif // ERROR_INJECTING_DRIVER_SV
