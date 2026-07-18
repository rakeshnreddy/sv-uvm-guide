// =============================================================
// Simplified generated target: UVM sequence for mem_read_write_test
// Source intent: solution/mem_test.pss
// =============================================================

`include "uvm_macros.svh"
import uvm_pkg::*;

virtual class generated_memory_agent_api extends uvm_object;
  function new(string name = "generated_memory_agent_api"); super.new(name); endfunction
  pure virtual task write(bit [31:0] addr, bit [31:0] data);
  pure virtual task read(bit [31:0] addr, output bit [31:0] data);
endclass

class generated_pss_sequencer extends uvm_sequencer #(uvm_sequence_item);
  `uvm_component_utils(generated_pss_sequencer)
  generated_memory_agent_api mem_agent;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
endclass

class mem_read_write_test_seq extends uvm_sequence #(uvm_sequence_item);
  `uvm_object_utils(mem_read_write_test_seq)
  `uvm_declare_p_sequencer(generated_pss_sequencer)

  rand bit [31:0] addr;
  rand bit [31:0] data;

  constraint pss_legal_write {
    addr >= 32'h0000_1000;
    addr <= 32'h0000_1fff;
    addr[1:0] == 2'b00;
    data <= 32'h0000_ffff;
  }

  function new(string name = "mem_read_write_test_seq");
    super.new(name);
  endfunction

  task body();
    bit [31:0] actual;

    if (!randomize()) begin
      `uvm_fatal("PSS_RAND", "Unable to randomize generated PSS memory test")
    end

    if (p_sequencer == null || p_sequencer.mem_agent == null)
      `uvm_fatal("PSS_CFG", "Generated memory-agent API is not configured")

    p_sequencer.mem_agent.write(addr, data);
    p_sequencer.mem_agent.read(addr, actual);

    if (actual !== data) begin
      `uvm_error("PSS_MEM_VERIFY",
        $sformatf("addr=0x%08x expected=0x%08x actual=0x%08x",
                  addr, data, actual))
    end else begin
      `uvm_info("PSS_MEM_VERIFY",
        $sformatf("PASS addr=0x%08x data=0x%08x", addr, data),
        UVM_MEDIUM)
    end
  endtask
endclass
