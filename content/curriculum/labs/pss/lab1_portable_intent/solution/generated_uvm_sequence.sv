// =============================================================
// Simplified generated target: UVM sequence for mem_read_write_test
// Source intent: solution/mem_test.pss
// =============================================================

class mem_read_write_test_seq extends uvm_sequence #(uvm_sequence_item);
  `uvm_object_utils(mem_read_write_test_seq)

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
