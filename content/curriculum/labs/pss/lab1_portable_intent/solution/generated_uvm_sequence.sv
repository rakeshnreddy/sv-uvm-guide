// =============================================================
// Simplified generated target: UVM virtual sequence for mem_read_write_test
// Source intent: solution/mem_test.pss
//
// The PSS tool solved the scenario (here addr = 0x1040, data = 0xBEEF),
// then pasted each action's `exec body SV` template in the solved order,
// with every {{...}} reference replaced by its solved value.
// Real tools differ in naming and structure; some solve at run time instead.
// =============================================================

`include "uvm_macros.svh"
import uvm_pkg::*;

// ---- Supplied by your UVM environment (minimal stubs so this file compiles) ----

class mem_item extends uvm_sequence_item;
  `uvm_object_utils(mem_item)
  bit        is_write;
  bit [31:0] addr;
  bit [31:0] data;
  function new(string name = "mem_item"); super.new(name); endfunction
endclass

class mem_write_seq extends uvm_sequence #(mem_item);
  `uvm_object_utils(mem_write_seq)
  bit [31:0] addr;
  bit [31:0] data;
  function new(string name = "mem_write_seq"); super.new(name); endfunction
  task body();
    mem_item item = mem_item::type_id::create("item");
    start_item(item);
    item.is_write = 1'b1;
    item.addr     = addr;
    item.data     = data;
    finish_item(item);
  endtask
endclass

// The driver returns a response carrying the read data.
class mem_read_seq extends uvm_sequence #(mem_item);
  `uvm_object_utils(mem_read_seq)
  bit [31:0] addr;
  bit [31:0] data;
  function new(string name = "mem_read_seq"); super.new(name); endfunction
  task body();
    mem_item item = mem_item::type_id::create("item");
    start_item(item);
    item.is_write = 1'b0;
    item.addr     = addr;
    finish_item(item);
    get_response(rsp);
    data = rsp.data;
  endtask
endclass

class mem_virtual_sequencer extends uvm_sequencer;
  `uvm_component_utils(mem_virtual_sequencer)
  uvm_sequencer #(mem_item) mem_sqr;   // set by the env in connect_phase
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
endclass

// ---- Generated from mem_read_write_test ----

class mem_read_write_test_seq extends uvm_sequence;
  `uvm_object_utils(mem_read_write_test_seq)
  `uvm_declare_p_sequencer(mem_virtual_sequencer)

  function new(string name = "mem_read_write_test_seq");
    super.new(name);
  endfunction

  task body();
    // wr_a: do write_mem   (exec body SV, wr.addr/wr.data filled in)
    begin
      mem_write_seq wr_seq = mem_write_seq::type_id::create("wr_seq");
      wr_seq.addr = 32'h0000_1040;
      wr_seq.data = 32'h0000_BEEF;
      wr_seq.start(p_sequencer.mem_sqr);
    end

    // rd_a: do read_verify (bound to wr_a.wr, so the same address and data)
    begin
      mem_read_seq rd_seq = mem_read_seq::type_id::create("rd_seq");
      rd_seq.addr = 32'h0000_1040;
      rd_seq.start(p_sequencer.mem_sqr);
      if (rd_seq.data !== 32'h0000_BEEF)
        `uvm_error("PSS_MEM_VERIFY",
          $sformatf("addr=0x%08x expected=0x%08x actual=0x%08x",
                    32'h0000_1040, 32'h0000_BEEF, rd_seq.data))
    end
  endtask
endclass
