// =============================================================
// Lab Solution: Building a Self-Checking Scoreboard
// File: solution.sv — completed alu_scoreboard + wiring
// =============================================================

`include "uvm_macros.svh"
import uvm_pkg::*;

`ifndef ALU_TRANSACTION_DEFINED
class alu_transaction extends uvm_sequence_item;
  `uvm_object_utils(alu_transaction)
  rand logic [7:0] op_a;
  rand logic [7:0] op_b;
  rand logic [1:0] opcode;
  logic [15:0] result;
  function new(string name = "alu_transaction"); super.new(name); endfunction
  function string convert2string();
    return $sformatf("op_a=%0d op_b=%0d opcode=%0d result=%0d",
                     op_a, op_b, opcode, result);
  endfunction
endclass
`endif

// ------ Scoreboard (SOLUTION) ------
class alu_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(alu_scoreboard)

  uvm_tlm_analysis_fifo #(alu_transaction) analysis_fifo;

  int pass_count = 0;
  int fail_count = 0;
  int accepted_count = 0;
  int processed_count = 0;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    analysis_fifo = new("analysis_fifo", this);
  endfunction

  function logic [15:0] reference_model(alu_transaction txn);
    unique case (txn.opcode)
      2'b00: return txn.op_a + txn.op_b;
      2'b01: return txn.op_a - txn.op_b;
      2'b10: return txn.op_a * txn.op_b;
      2'b11: return {8'b0, txn.op_a & txn.op_b};
      default: begin
        `uvm_error("BAD_OPCODE", txn.convert2string())
        return 'x;
      end
    endcase
  endfunction

  task run_phase(uvm_phase phase);
    alu_transaction txn;
    logic [15:0] expected;

    forever begin
      analysis_fifo.get(txn);
      accepted_count++;
      expected = reference_model(txn);

      if (txn.result === expected) begin
        pass_count++;
        `uvm_info("SCB_PASS",
          $sformatf("MATCH: %s -> expected=%0d, actual=%0d",
                    txn.convert2string(), expected, txn.result),
          UVM_MEDIUM)
      end else begin
        fail_count++;
        `uvm_error("SCB_FAIL",
          $sformatf("MISMATCH: %s -> expected=%0d, actual=%0d",
                    txn.convert2string(), expected, txn.result))
      end
      processed_count++;
    end
  endtask

  function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    if (!analysis_fifo.is_empty())
      `uvm_error("PENDING", "Unprocessed transactions remain")
    if (processed_count == 0)
      `uvm_error("NO_TRAFFIC", "Scoreboard processed no transactions")
    if (accepted_count != processed_count)
      `uvm_error("COUNT", $sformatf("accepted=%0d processed=%0d",
                                    accepted_count, processed_count))
  endfunction

  function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    `uvm_info("SCB_REPORT",
      $sformatf("Scoreboard Summary: %0d PASS, %0d FAIL out of %0d total",
                pass_count, fail_count, pass_count + fail_count),
      UVM_NONE)
  endfunction
endclass

// ------ Environment (SOLUTION — with scoreboard wired in) ------
// In alu_env:
//   build_phase: scoreboard = alu_scoreboard::type_id::create("scoreboard", this);
//   connect_phase: monitor.ap.connect(scoreboard.analysis_fifo.analysis_export);
