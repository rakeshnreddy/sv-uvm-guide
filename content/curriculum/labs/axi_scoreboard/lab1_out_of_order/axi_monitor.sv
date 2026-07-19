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
      // TODO: on ARVALID && ARREADY, create a transaction, capture ARADDR/ARID,
      // set expected_beats to ARLEN + 1, and push_back into pending_reads[ARID].
    end
  endtask

  virtual task monitor_r_channel();
    forever begin
      @(posedge vif.ACLK);
      // TODO: on every RVALID && RREADY handshake:
      // - use pending_reads[RID][0] (same-ID responses remain ordered),
      // - append RDATA and RRESP,
      // - validate beat count and RLAST,
      // - publish and pop_front only when RLAST is accepted.
    end
  endtask
endclass
