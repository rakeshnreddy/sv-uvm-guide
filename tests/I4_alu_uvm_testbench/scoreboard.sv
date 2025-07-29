`ifndef SCOREBOARD_SV
`define SCOREBOARD_SV

class scoreboard extends uvm_scoreboard;
  `uvm_component_utils(scoreboard)

  uvm_analysis_imp #(alu_transaction, scoreboard) input_analysis_export;
  uvm_analysis_imp #(alu_transaction, scoreboard) output_analysis_export;

  uvm_tlm_analysis_fifo #(alu_transaction) input_fifo;
  uvm_tlm_analysis_fifo #(alu_transaction) output_fifo;

  function new(string name = "scoreboard", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    input_analysis_export = new("input_analysis_export", this);
    output_analysis_export = new("output_analysis_export", this);
    input_fifo = new("input_fifo", this);
    output_fifo = new("output_fifo", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    input_analysis_export.connect(input_fifo.analysis_export);
    output_analysis_export.connect(output_fifo.analysis_export);
  endfunction

  task run_phase(uvm_phase phase);
    alu_transaction input_tx, output_tx;
    alu_transaction expected_tx;

    forever begin
      input_fifo.get(input_tx);
      output_fifo.get(output_tx);

      `uvm_info("SCOREBOARD", $sformatf("Checking transaction: op=%s, a=%0h, b=%0h",
                input_tx.op.name(), input_tx.a, input_tx.b), UVM_HIGH)

      expected_tx = new();
      predict_result(input_tx, expected_tx);

      if (!expected_tx.compare(output_tx)) begin
        `uvm_error("SCOREBOARD_MISMATCH", $sformatf("Scoreboard check FAILED. Expected: %s, Actual: %s",
                   expected_tx.convert2string(), output_tx.convert2string()))
      end else begin
        `uvm_info("SCOREBOARD_MATCH", "Scoreboard check PASSED.", UVM_HIGH)
      end
    end
  endtask

  function void predict_result(alu_transaction in_tx, ref alu_transaction out_tx);
    out_tx.op = in_tx.op;
    case (in_tx.op)
      ADD: out_tx.result = in_tx.a + in_tx.b;
      SUB: out_tx.result = in_tx.a - in_tx.b;
      MUL: out_tx.result = in_tx.a * in_tx.b;
      default: out_tx.result = 'x;
    endcase
  endfunction

endclass

`endif // SCOREBOARD_SV
