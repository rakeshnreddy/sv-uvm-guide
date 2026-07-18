`include "uvm_macros.svh"
import uvm_pkg::*;

localparam int PACKET_COUNT = 5000;

class packet extends uvm_sequence_item;
  int unsigned id;
  int unsigned data;
  `uvm_object_utils_begin(packet)
    `uvm_field_int(id, UVM_ALL_ON)
    `uvm_field_int(data, UVM_ALL_ON)
  `uvm_object_utils_end
  function new(string name = "packet"); super.new(name); endfunction
endclass

class deterministic_packet_source extends uvm_component;
  `uvm_component_utils(deterministic_packet_source)
  uvm_analysis_port #(packet) expected_ap;
  uvm_analysis_port #(packet) actual_ap;

  function new(string name, uvm_component parent);
    super.new(name, parent);
    expected_ap = new("expected_ap", this);
    actual_ap = new("actual_ap", this);
  endfunction

  task run_phase(uvm_phase phase);
    for (int unsigned i = 0; i < PACKET_COUNT; i++) begin
      packet expected = packet::type_id::create("expected", this);
      packet actual = packet::type_id::create("actual", this);
      expected.id = i;
      expected.data = (i * 32'h45d9f3b) ^ 32'hA5A55A5A;
      actual.copy(expected);
      expected_ap.write(expected);
      actual_ap.write(actual);
      #1ns;
    end
  endtask
endclass

class my_fast_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(my_fast_scoreboard)

  uvm_get_port #(packet) expected_get_port;
  uvm_get_port #(packet) actual_get_port;
  packet expected_aa[int unsigned];
  int unsigned accepted_count;
  int unsigned matched_count;
  int unsigned peak_outstanding;
  time start_time;
  time end_time;
  event all_processed;

  function new(string name, uvm_component parent);
    super.new(name, parent);
    expected_get_port = new("expected_get_port", this);
    actual_get_port = new("actual_get_port", this);
  endfunction

  task run_phase(uvm_phase phase);
    packet expected;
    packet actual;
    start_time = $time;

    repeat (PACKET_COUNT) begin
      expected_get_port.get(expected);
      expected_aa[expected.id] = expected;
      accepted_count++;
      if (expected_aa.num() > peak_outstanding)
        peak_outstanding = expected_aa.num();

      actual_get_port.get(actual);
      if (!expected_aa.exists(actual.id)) begin
        `uvm_error("UNEXPECTED", $sformatf("Unexpected id=%0d", actual.id))
      end else begin
        expected = expected_aa[actual.id];
        expected_aa.delete(actual.id);
        if (!expected.compare(actual))
          `uvm_error("MISMATCH", actual.convert2string())
        else
          matched_count++;
      end
    end

    end_time = $time;
    -> all_processed;
  endtask

  task wait_until_complete();
    if (matched_count < PACKET_COUNT)
      @all_processed;
  endtask

  function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    if (expected_aa.num() != 0)
      `uvm_error("PENDING", $sformatf("%0d expected entries remain", expected_aa.num()))
    if (accepted_count != PACKET_COUNT || matched_count != PACKET_COUNT)
      `uvm_error("COUNT", $sformatf("accepted=%0d matched=%0d expected=%0d",
                                    accepted_count, matched_count, PACKET_COUNT))
  endfunction

  function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    `uvm_info("BENCHMARK", $sformatf(
      "packets=%0d matched=%0d peak_outstanding=%0d allocations=%0d wall_time=%0t",
      PACKET_COUNT, matched_count, peak_outstanding, PACKET_COUNT * 2,
      end_time - start_time), UVM_NONE)
  endfunction
endclass

class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  deterministic_packet_source source;
  my_fast_scoreboard scb;
  uvm_tlm_analysis_fifo #(packet) expected_fifo;
  uvm_tlm_analysis_fifo #(packet) actual_fifo;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    source = deterministic_packet_source::type_id::create("source", this);
    scb = my_fast_scoreboard::type_id::create("scb", this);
    expected_fifo = new("expected_fifo", this);
    actual_fifo = new("actual_fifo", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    source.expected_ap.connect(expected_fifo.analysis_export);
    source.actual_ap.connect(actual_fifo.analysis_export);
    scb.expected_get_port.connect(expected_fifo.get_export);
    scb.actual_get_port.connect(actual_fifo.get_export);
  endfunction
endclass

class performance_test extends uvm_test;
  `uvm_component_utils(performance_test)
  my_env env;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = my_env::type_id::create("env", this);
  endfunction
  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    env.scb.wait_until_complete();
    phase.drop_objection(this);
  endtask
endclass

module tb_top;
  initial run_test("performance_test");
endmodule
