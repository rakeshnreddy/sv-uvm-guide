// This file contains runnable examples for the E2 Customizing UVM module.
// Since these are conceptual, they are not intended to be a self-contained,
// compilable unit without a surrounding testbench.

`include "uvm_macros.svh"
import uvm_pkg::*;

// Base transaction
class my_transaction extends uvm_sequence_item;
  rand bit[31:0] addr;
  rand bit[31:0] data;

  `uvm_object_utils_begin(my_transaction)
    `uvm_field_int(addr, UVM_ALL_ON)
    `uvm_field_int(data, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "my_transaction");
    super.new(name);
  endfunction
endclass

// Forward declaration for the callback class
class my_driver;
class my_driver_callbacks;

//----------------------------------------------------------------//
// 1. Report Catcher Example
//----------------------------------------------------------------//

// The custom report catcher
class demote_error_catcher extends uvm_report_catcher;
  function new(string name="demote_error_catcher");
    super.new(name);
  endfunction

  // The core logic: demote a specific error to a warning
  function action_e catch();
    if (get_severity() == UVM_ERROR && get_id() == "MY_COMP_ERR") begin
      `uvm_info(get_name(), "Caught and demoted specific error.", UVM_LOW)
      set_severity(UVM_WARNING);
    end
    return THROW;
  endfunction
endclass

//----------------------------------------------------------------//
// 2. UVM Callbacks Example
//----------------------------------------------------------------//

// The abstract callback class definition
class my_driver_callbacks extends uvm_callback;
  `uvm_object_utils(my_driver_callbacks)

  virtual task pre_drive(my_driver drv, my_transaction tx); endtask
  virtual task post_drive(my_driver drv, my_transaction tx); endtask

  function new(string name = "my_driver_callbacks");
    super.new(name);
  endfunction
endclass

// The driver class with callback hooks
class my_driver extends uvm_driver #(my_transaction);
  `uvm_component_utils(my_driver)

  // Register the callback type with this component
  `uvm_register_cb(my_driver, my_driver_callbacks)

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      my_transaction req;
      seq_item_port.get_next_item(req);

      // Invoke the pre_drive hook
      `uvm_do_callbacks(my_driver, my_driver_callbacks, pre_drive(this, req))

      `uvm_info(get_type_name(), $sformatf("Driving transaction: %s", req.sprint()), UVM_HIGH)

      // Invoke the post_drive hook
      `uvm_do_callbacks(my_driver, my_driver_callbacks, post_drive(this, req))

      seq_item_port.item_done();
    end
  endtask
endclass

// A concrete callback implementation for error injection
class error_injector_cb extends my_driver_callbacks;
  `uvm_object_utils(error_injector_cb)

  function new(string name = "error_injector_cb");
    super.new(name);
  endfunction

  virtual task pre_drive(my_driver drv, my_transaction tx);
    if (tx.addr == 32'hBAD_ADDR) begin
      `uvm_info("CB/INJECT", "Injecting error for bad address", UVM_MEDIUM)
      tx.data = 32'hBAADF00D;
    end
  endtask
endclass

// A test showing how to use the catcher and callback
class my_test extends uvm_test;
  `uvm_component_utils(my_test)

  my_driver driver;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    driver = my_driver::type_id::create("driver", this);

    // Add the report catcher
    demote_error_catcher catcher;
    catcher = demote_error_catcher::type_id::create("catcher");
    uvm_report_cb::add(null, catcher);

    // Add the callback
    error_injector_cb cb = error_injector_cb::type_id::create("cb");
    uvm_callback_pool#(my_driver, my_driver_callbacks)::add(driver, cb);
  endfunction

  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    // This would normally come from a sequencer
    `uvm_info(get_type_name(), "Issuing a benign error that will be demoted", UVM_MEDIUM)
    `uvm_error("MY_COMP_ERR", "This is a test error.")
    phase.drop_objection(this);
  endtask
endclass
