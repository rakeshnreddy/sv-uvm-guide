// Reference overlay: use this file instead of axi_monitor.sv and axi_scoreboard.sv.
`include "uvm_macros.svh"
import uvm_pkg::*;

`uvm_analysis_imp_decl(_expected)
`uvm_analysis_imp_decl(_actual)

`ifndef AXI_SCOREBOARD_INTERFACE_DEFINED
`define AXI_SCOREBOARD_INTERFACE_DEFINED
interface axi_if(input bit ACLK);
  logic ARVALID, ARREADY;
  logic [31:0] ARADDR;
  logic [3:0] ARID;
  logic [7:0] ARLEN;
  logic RVALID, RREADY;
  logic [31:0] RDATA;
  logic [3:0] RID;
  logic [1:0] RRESP;
  logic RLAST;
endinterface
`endif

class axi_transaction extends uvm_sequence_item;
  `uvm_object_utils(axi_transaction)

  bit [31:0] addr;
  int unsigned id;
  int unsigned expected_beats;
  bit [31:0] data_beats[$];
  bit [1:0] responses[$];
  bit is_write;

  function new(string name = "axi_transaction");
    super.new(name);
  endfunction

  virtual function string convert2string();
    return $sformatf("%s ID=%0d ADDR=0x%08h BEATS=%0d/%0d",
      is_write ? "WRITE" : "READ", id, addr, data_beats.size(), expected_beats);
  endfunction

  virtual function bit do_compare(uvm_object rhs, uvm_comparer comparer);
    axi_transaction other;
    if (!$cast(other, rhs)) return 1'b0;
    if (!super.do_compare(rhs, comparer)) return 1'b0;
    return id == other.id && addr == other.addr && is_write == other.is_write &&
      expected_beats == other.expected_beats && data_beats == other.data_beats &&
      responses == other.responses;
  endfunction
endclass

class axi_monitor extends uvm_monitor;
  `uvm_component_utils(axi_monitor)

  uvm_analysis_port #(axi_transaction) ap;
  virtual axi_if vif;

  // Each ID owns an ordered queue because AXI permits multiple outstanding
  // requests with the same ID while preserving response order within that ID.
  axi_transaction pending_reads[int unsigned][$];

  function new(string name, uvm_component parent);
    super.new(name, parent);
    ap = new("ap", this);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual axi_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "axi_monitor virtual interface is not configured")
  endfunction

  virtual task run_phase(uvm_phase phase);
    fork
      monitor_ar_channel();
      monitor_r_channel();
    join
  endtask

  virtual task monitor_ar_channel();
    forever begin
      @(posedge vif.ACLK);
      if (vif.ARVALID && vif.ARREADY) begin
        axi_transaction txn = axi_transaction::type_id::create($sformatf("ar_%0d", vif.ARID), this);
        txn.addr = vif.ARADDR;
        txn.id = vif.ARID;
        txn.expected_beats = int'(vif.ARLEN) + 1;
        txn.is_write = 1'b0;
        pending_reads[txn.id].push_back(txn);
      end
    end
  endtask

  virtual task monitor_r_channel();
    forever begin
      @(posedge vif.ACLK);
      if (vif.RVALID && vif.RREADY) begin
        int unsigned id = vif.RID;
        if (!pending_reads.exists(id) || pending_reads[id].size() == 0) begin
          `uvm_error("UNEXPECTED_R", $sformatf("Response beat for ID %0d has no pending request", id))
        end else begin
          axi_transaction txn = pending_reads[id][0];
          txn.data_beats.push_back(vif.RDATA);
          txn.responses.push_back(vif.RRESP);

          if (vif.RLAST != (txn.data_beats.size() == txn.expected_beats))
            `uvm_error("RLAST", $sformatf("ID %0d: RLAST=%0b at beat %0d of %0d", id, vif.RLAST, txn.data_beats.size(), txn.expected_beats))
          if (vif.RRESP inside {2'b10, 2'b11})
            `uvm_error("RRESP", $sformatf("ID %0d returned error response %0b", id, vif.RRESP))

          if (vif.RLAST) begin
            void'(pending_reads[id].pop_front());
            if (pending_reads[id].size() == 0) pending_reads.delete(id);
            ap.write(txn);
          end
        end
      end
    end
  endtask
endclass

class axi_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(axi_scoreboard)

  uvm_analysis_imp_expected #(axi_transaction, axi_scoreboard) expected_export;
  uvm_analysis_imp_actual #(axi_transaction, axi_scoreboard) actual_export;
  axi_transaction expected_reads[int unsigned][$];

  function new(string name, uvm_component parent);
    super.new(name, parent);
    expected_export = new("expected_export", this);
    actual_export = new("actual_export", this);
  endfunction

  virtual function void write_expected(axi_transaction txn);
    if (!txn.is_write) expected_reads[txn.id].push_back(txn);
  endfunction

  virtual function void write_actual(axi_transaction txn);
    axi_transaction expected;
    uvm_comparer comparer = new();
    if (txn.is_write) return;

    if (!expected_reads.exists(txn.id) || expected_reads[txn.id].size() == 0) begin
      `uvm_error("UNEXPECTED", $sformatf("Unexpected read: %s", txn.convert2string()))
      return;
    end

    expected = expected_reads[txn.id].pop_front();
    if (expected_reads[txn.id].size() == 0) expected_reads.delete(txn.id);
    if (!expected.compare(txn, comparer))
      `uvm_error("MISMATCH", $sformatf("Expected %s; actual %s; %s", expected.convert2string(), txn.convert2string(), comparer.miscompares))
    else
      `uvm_info("MATCH", txn.convert2string(), UVM_LOW)
  endfunction

  virtual function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    foreach (expected_reads[id]) begin
      if (expected_reads[id].size() != 0)
        `uvm_error("MISSING", $sformatf("ID %0d still has %0d expected read(s)", id, expected_reads[id].size()))
    end
  endfunction
endclass
