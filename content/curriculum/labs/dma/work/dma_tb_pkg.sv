// Lab dma-1, starter: a UVM bench for dma_copy with a layered register
// sequence, a memory-model responder, a virtual sequencer and a scoreboard.
// The agents, the environment and the tests are complete. You write the parts
// marked TODO step N, in the order of the README's steps. The bench compiles and
// runs as it is, and reports FAIL: read the README's Step 1 to see why.
//
// Stimulus uses $urandom_range rather than rand fields and constraints, so the
// bench runs on Verilator without an external constraint solver. The seed comes
// from the simulator (Verilator: +verilator+seed+<n>).
package dma_tb_pkg;
  import uvm_pkg::*;
  `include "uvm_macros.svh"

  // ---------------------------------------------------------------------------
  // Register map and address windows (README: Specification)
  // ---------------------------------------------------------------------------
  localparam bit [7:0] REG_SRC    = 8'h00;
  localparam bit [7:0] REG_DST    = 8'h04;
  localparam bit [7:0] REG_LEN    = 8'h08;
  localparam bit [7:0] REG_CTRL   = 8'h0C;
  localparam bit [7:0] REG_STATUS = 8'h10;

  localparam bit [31:0] SRC_BASE  = 32'h0000_1000;  // sources live in 0x1000..0x13FF
  localparam int        SRC_WORDS = 256;
  localparam bit [31:0] DST_BASE  = 32'h0000_8000;  // destinations live in 0x8000..0x8FFF
  localparam bit [31:0] DST_ALT   = 32'h0000_9000;  // the address dma_busy_vseq tries to switch to

  // ---------------------------------------------------------------------------
  // Memory model: shared by the responder (which serves the DMA from it) and the
  // scoreboard (which predicts from it). Keys are word-aligned byte addresses.
  // ---------------------------------------------------------------------------
  class dma_mem_model extends uvm_object;
    `uvm_object_utils(dma_mem_model)
    protected bit [31:0] words[bit [31:0]];

    function new(string name = "dma_mem_model");
      super.new(name);
    endfunction

    function void poke(bit [31:0] addr, bit [31:0] data);
      words[addr] = data;
    endfunction

    // Reading an address that nothing wrote is a bench bug: say so.
    function bit [31:0] peek(bit [31:0] addr);
      if (!words.exists(addr)) begin
        `uvm_error("MEM", $sformatf("read of 0x%08h, which nothing has written", addr))
        return 32'hDEAD_BEEF;
      end
      return words[addr];
    endfunction

    function int unsigned num_words();
      return words.num();
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------
  typedef enum {CFG_ACCESS, CFG_DONE} cfg_kind_e;

  // One register access (driver and monitor), or a done pulse (monitor only).
  class dma_cfg_item extends uvm_sequence_item;
    `uvm_object_utils(dma_cfg_item)
    cfg_kind_e kind = CFG_ACCESS;
    bit        write;
    bit [7:0]  addr;
    bit [31:0] data;   // write data, or read data after the driver returns it

    function new(string name = "dma_cfg_item");
      super.new(name);
    endfunction

    virtual function string convert2string();
      if (kind == CFG_DONE) return "DONE pulse";
      return $sformatf("%s 0x%02h data 0x%08h", write ? "WRITE" : "READ ", addr, data);
    endfunction
  endclass

  // Timing for one memory access, chosen by the responder sequence.
  class dma_mem_rsp_item extends uvm_sequence_item;
    `uvm_object_utils(dma_mem_rsp_item)
    int unsigned gnt_delay;     // cycles between seeing mem_req and raising mem_gnt
    int unsigned rdata_delay;   // extra cycles before mem_rvalid on a read

    function new(string name = "dma_mem_rsp_item");
      super.new(name);
    endfunction
  endclass

  // One completed memory access, as the monitor saw it.
  class dma_mem_item extends uvm_sequence_item;
    `uvm_object_utils(dma_mem_item)
    bit        we;
    bit [31:0] addr;
    bit [31:0] data;

    function new(string name = "dma_mem_item");
      super.new(name);
    endfunction

    virtual function string convert2string();
      return $sformatf("%s 0x%08h data 0x%08h", we ? "WRITE" : "READ ", addr, data);
    endfunction
  endclass

  // The upper layer: one whole copy, as a test writer thinks of it.
  class dma_xfer_item extends uvm_sequence_item;
    `uvm_object_utils(dma_xfer_item)
    bit [31:0] src;
    bit [31:0] dst;
    bit [7:0]  len;   // words

    function new(string name = "dma_xfer_item");
      super.new(name);
    endfunction

    // A legal random transfer: aligned, source inside the preloaded window,
    // destination inside the destination window, so the two never overlap.
    function void pick(int unsigned min_len, int unsigned max_len);
      len = 8'($urandom_range(max_len, min_len));
      src = SRC_BASE + 4 * $urandom_range(SRC_WORDS - int'(len), 0);
      dst = DST_BASE + 4 * $urandom_range(1023 - int'(len), 0);
    endfunction

    virtual function string convert2string();
      return $sformatf("copy %0d words 0x%08h -> 0x%08h", len, src, dst);
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Register agent: driver, monitor, sequencer
  // ---------------------------------------------------------------------------
  class dma_cfg_driver extends uvm_driver #(dma_cfg_item);
    `uvm_component_utils(dma_cfg_driver)
    virtual dma_cfg_if vif;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual dma_cfg_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "no dma_cfg_if under the key vif")
    endfunction

    task run_phase(uvm_phase phase);
      vif.cfg_valid <= 1'b0;
      vif.cfg_write <= 1'b0;
      vif.cfg_addr  <= '0;
      vif.cfg_wdata <= '0;
      do @(posedge vif.clk); while (vif.rst_n !== 1'b1);
      forever begin
        seq_item_port.get_next_item(req);
        vif.cfg_valid <= 1'b1;
        vif.cfg_write <= req.write;
        vif.cfg_addr  <= req.addr;
        vif.cfg_wdata <= req.write ? req.data : '0;
        @(posedge vif.clk);                        // the DMA samples the access here
        if (!req.write) req.data = vif.cfg_rdata;  // R2: read data is valid on the same edge
        vif.cfg_valid <= 1'b0;
        seq_item_port.item_done();
      end
    endtask
  endclass

  class dma_cfg_monitor extends uvm_monitor;
    `uvm_component_utils(dma_cfg_monitor)
    virtual dma_cfg_if vif;
    uvm_analysis_port #(dma_cfg_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
      ap = new("ap", this);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual dma_cfg_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "no dma_cfg_if under the key vif")
    endfunction

    task run_phase(uvm_phase phase);
      dma_cfg_item t;
      forever begin
        @(posedge vif.clk);
        if (vif.rst_n !== 1'b1) continue;
        // A done pulse is published before an access on the same edge: the
        // access on that edge already sees the finished status.
        if (vif.done_o === 1'b1) begin
          t = dma_cfg_item::type_id::create("done");
          t.kind = CFG_DONE;
          ap.write(t);
        end
        if (vif.cfg_valid === 1'b1) begin
          t = dma_cfg_item::type_id::create("access");
          t.write = vif.cfg_write;
          t.addr  = vif.cfg_addr;
          t.data  = vif.cfg_write ? vif.cfg_wdata : vif.cfg_rdata;
          ap.write(t);
        end
      end
    endtask
  endclass

  class dma_cfg_agent extends uvm_agent;
    `uvm_component_utils(dma_cfg_agent)
    dma_cfg_driver                 drv;
    dma_cfg_monitor                mon;
    uvm_sequencer #(dma_cfg_item)  sqr;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      drv = dma_cfg_driver::type_id::create("drv", this);
      mon = dma_cfg_monitor::type_id::create("mon", this);
      sqr = uvm_sequencer#(dma_cfg_item)::type_id::create("sqr", this);
    endfunction

    function void connect_phase(uvm_phase phase);
      drv.seq_item_port.connect(sqr.seq_item_export);
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Memory agent: a responder (reactive driver) that serves the DMA from the
  // memory model, a monitor, and a sequencer that supplies the timing.
  // ---------------------------------------------------------------------------
  class dma_mem_responder extends uvm_driver #(dma_mem_rsp_item);
    `uvm_component_utils(dma_mem_responder)
    virtual dma_mem_if vif;
    dma_mem_model      mem;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual dma_mem_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "no dma_mem_if under the key vif")
      if (!uvm_config_db#(dma_mem_model)::get(this, "", "mem", mem))
        `uvm_fatal("NOMEM", "no dma_mem_model under the key mem")
    endfunction

    task run_phase(uvm_phase phase);
      bit [31:0] rdata;
      vif.mem_gnt    <= 1'b0;
      vif.mem_rvalid <= 1'b0;
      vif.mem_rdata  <= '0;
      forever begin
        seq_item_port.get_next_item(req);          // timing for the next access
        do @(posedge vif.clk); while (!(vif.rst_n === 1'b1 && vif.mem_req === 1'b1));
        repeat (req.gnt_delay) @(posedge vif.clk);
        vif.mem_gnt <= 1'b1;
        @(posedge vif.clk);                        // M1: the access is accepted on this edge
        vif.mem_gnt <= 1'b0;
        if (vif.mem_we === 1'b1) begin
          mem.poke(vif.mem_addr, vif.mem_wdata);
        end else begin
          rdata = mem.peek(vif.mem_addr);
          repeat (req.rdata_delay) @(posedge vif.clk);
          vif.mem_rvalid <= 1'b1;
          vif.mem_rdata  <= rdata;
          @(posedge vif.clk);                      // M2: the DMA takes the data on this edge
          vif.mem_rvalid <= 1'b0;
        end
        seq_item_port.item_done();
      end
    endtask
  endclass

  class dma_mem_monitor extends uvm_monitor;
    `uvm_component_utils(dma_mem_monitor)
    virtual dma_mem_if vif;
    uvm_analysis_port #(dma_mem_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
      ap = new("ap", this);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual dma_mem_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "no dma_mem_if under the key vif")
    endfunction

    task run_phase(uvm_phase phase);
      dma_mem_item t;
      bit [31:0]   rd_addr;
      forever begin
        @(posedge vif.clk);
        if (vif.rst_n !== 1'b1) continue;
        if (vif.mem_rvalid === 1'b1) begin         // read data for the read accepted earlier
          t = dma_mem_item::type_id::create("rd");
          t.we = 1'b0;
          t.addr = rd_addr;
          t.data = vif.mem_rdata;
          ap.write(t);
        end
        if (vif.mem_req === 1'b1 && vif.mem_gnt === 1'b1) begin
          if (vif.mem_we === 1'b1) begin
            t = dma_mem_item::type_id::create("wr");
            t.we = 1'b1;
            t.addr = vif.mem_addr;
            t.data = vif.mem_wdata;
            ap.write(t);
          end else begin
            rd_addr = vif.mem_addr;
          end
        end
      end
    endtask
  endclass

  class dma_mem_agent extends uvm_agent;
    `uvm_component_utils(dma_mem_agent)
    dma_mem_responder                  drv;
    dma_mem_monitor                    mon;
    uvm_sequencer #(dma_mem_rsp_item)  sqr;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      drv = dma_mem_responder::type_id::create("drv", this);
      mon = dma_mem_monitor::type_id::create("mon", this);
      sqr = uvm_sequencer#(dma_mem_rsp_item)::type_id::create("sqr", this);
    endfunction

    function void connect_phase(uvm_phase phase);
      drv.seq_item_port.connect(sqr.seq_item_export);
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Scoreboard: a shadow of the programming model predicts every destination
  // write and every register read; a done pulse closes the books on a transfer.
  // ---------------------------------------------------------------------------
  `uvm_analysis_imp_decl(_cfg)
  `uvm_analysis_imp_decl(_mem)

  typedef struct {
    bit [31:0] addr;
    bit [31:0] data;
  } dma_word_t;

  class dma_scoreboard extends uvm_scoreboard;
    `uvm_component_utils(dma_scoreboard)
    uvm_analysis_imp_cfg #(dma_cfg_item, dma_scoreboard) cfg_export;
    uvm_analysis_imp_mem #(dma_mem_item, dma_scoreboard) mem_export;
    dma_mem_model mem;

    // Shadow of the programming model (R1..R6)
    bit [31:0] src, dst;
    bit [7:0]  len;
    bit        busy, done;

    dma_word_t   exp_q[$];      // destination writes still expected, in order
    int unsigned n_started, n_checked, n_words, n_reads;

    function new(string name, uvm_component parent);
      super.new(name, parent);
      cfg_export = new("cfg_export", this);
      mem_export = new("mem_export", this);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(dma_mem_model)::get(this, "", "mem", mem))
        `uvm_fatal("NOMEM", "no dma_mem_model under the key mem")
    endfunction

    function void write_cfg(dma_cfg_item t);
      if (t.kind == CFG_DONE) begin
        end_of_transfer();
        return;
      end
      if (!t.write) begin
        check_read(t);
        return;
      end
      case (t.addr)
        REG_SRC:  if (!busy) src = {t.data[31:2], 2'b00};   // R1, R3
        REG_DST:  if (!busy) dst = {t.data[31:2], 2'b00};
        REG_LEN:  if (!busy) len = t.data[7:0];
        REG_CTRL: if (t.data[0] && !busy) begin             // R4
          busy = 1'b1;
          done = 1'b0;
          predict_transfer();
        end
        default: ;
      endcase
    endfunction

    // TODO step 4: predict the destination writes of the transfer that just started (R5).
    // For each of the len words, push_back onto exp_q the address the DMA must write
    // (dst + 4*i) and the data it must write there (the source word, read with mem.peek).
    function void predict_transfer();
      n_started++;
      // TODO step 4: your loop here
      `uvm_info("SB", $sformatf("transfer %0d started: %0d words 0x%08h -> 0x%08h",
                                n_started, len, src, dst), UVM_MEDIUM)
    endfunction

    // TODO step 4: a done pulse ends the transfer; every predicted write must have happened (R5, R6).
    // Report an error for a done pulse while no transfer is running. Report an error if
    // exp_q still holds words (name how many, and the first missing address); otherwise
    // count the transfer in n_checked. Then empty exp_q. The two shadow updates below
    // are given, because register reads are checked against them.
    function void end_of_transfer();
      // TODO step 4: your checks here
      busy = 1'b0;
      done = 1'b1;
    endfunction

    function void write_mem(dma_mem_item t);
      dma_word_t e;
      if (!t.we) return;   // reads are checked through the data they produce
      if (exp_q.size() == 0) begin
        `uvm_error("SB", $sformatf("unexpected write: %s", t.convert2string()))
        return;
      end
      e = exp_q.pop_front();
      if (t.addr !== e.addr || t.data !== e.data)
        `uvm_error("SB", $sformatf("transfer %0d: wrote 0x%08h = 0x%08h, expected 0x%08h = 0x%08h",
                                   n_started, t.addr, t.data, e.addr, e.data))
      else
        n_words++;
    endfunction

    function bit [31:0] expected_read(bit [7:0] addr);
      case (addr)
        REG_SRC:    return src;
        REG_DST:    return dst;
        REG_LEN:    return {24'h0, len};
        REG_STATUS: return {30'h0, done, busy};
        default:    return '0;                              // CTRL and unmapped addresses (R2)
      endcase
    endfunction

    function void check_read(dma_cfg_item t);
      bit [31:0] exp = expected_read(t.addr);
      if (t.data !== exp)
        `uvm_error("SB", $sformatf("read 0x%02h returned 0x%08h, expected 0x%08h", t.addr, t.data, exp))
      else
        n_reads++;
    endfunction

    function void check_phase(uvm_phase phase);
      super.check_phase(phase);
      if (busy)
        `uvm_error("SB", $sformatf("transfer %0d was still running at the end of the test (%0d words outstanding)",
                                   n_started, exp_q.size()))
      if (n_checked == 0)
        `uvm_error("SB", "no transfer was checked: a run that checks nothing is not a pass")
    endfunction

    function void report_phase(uvm_phase phase);
      `uvm_info("SB", $sformatf("transfers started %0d, checked %0d; words matched %0d; register reads checked %0d",
                                n_started, n_checked, n_words, n_reads), UVM_NONE)
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Virtual sequencer: handles only, no driver
  // ---------------------------------------------------------------------------
  class dma_vsequencer extends uvm_sequencer;
    `uvm_component_utils(dma_vsequencer)
    uvm_sequencer #(dma_cfg_item)      cfg_sqr;
    uvm_sequencer #(dma_mem_rsp_item)  mem_sqr;
    uvm_sequencer #(dma_xfer_item)     xfer_sqr;
    dma_mem_model                      mem;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Environment
  // ---------------------------------------------------------------------------
  class dma_env extends uvm_env;
    `uvm_component_utils(dma_env)
    dma_cfg_agent                   cfg_agt;
    dma_mem_agent                   mem_agt;
    uvm_sequencer #(dma_xfer_item)  xfer_sqr;   // upper layer: no driver; the translation sequence pulls from it
    dma_vsequencer                  vsqr;
    dma_scoreboard                  sb;
    dma_mem_model                   mem;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      mem = dma_mem_model::type_id::create("mem");
      uvm_config_db#(dma_mem_model)::set(this, "*", "mem", mem);
      cfg_agt  = dma_cfg_agent::type_id::create("cfg_agt", this);
      mem_agt  = dma_mem_agent::type_id::create("mem_agt", this);
      xfer_sqr = uvm_sequencer#(dma_xfer_item)::type_id::create("xfer_sqr", this);
      vsqr     = dma_vsequencer::type_id::create("vsqr", this);
      sb       = dma_scoreboard::type_id::create("sb", this);
    endfunction

    function void connect_phase(uvm_phase phase);
      cfg_agt.mon.ap.connect(sb.cfg_export);
      mem_agt.mon.ap.connect(sb.mem_export);
      vsqr.cfg_sqr  = cfg_agt.sqr;
      vsqr.mem_sqr  = mem_agt.sqr;
      vsqr.xfer_sqr = xfer_sqr;
      vsqr.mem      = mem;
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Sequences
  // ---------------------------------------------------------------------------

  // Memory responder timing: runs forever, one item per memory access.
  class dma_mem_rsp_seq extends uvm_sequence #(dma_mem_rsp_item);
    `uvm_object_utils(dma_mem_rsp_seq)
    int unsigned max_gnt_delay   = 3;
    int unsigned max_rdata_delay = 2;

    function new(string name = "dma_mem_rsp_seq");
      super.new(name);
    endfunction

    task body();
      forever begin
        req = dma_mem_rsp_item::type_id::create("req");
        start_item(req);
        req.gnt_delay   = $urandom_range(max_gnt_delay, 0);
        req.rdata_delay = $urandom_range(max_rdata_delay, 0);
        finish_item(req);
      end
    endtask
  endclass

  // One register access on the register sequencer, for use by any sequence.
  class dma_cfg_base_seq extends uvm_sequence #(dma_cfg_item);
    `uvm_object_utils(dma_cfg_base_seq)

    function new(string name = "dma_cfg_base_seq");
      super.new(name);
    endfunction

    task cfg_write(bit [7:0] addr, bit [31:0] data);
      dma_cfg_item it = dma_cfg_item::type_id::create("wr");
      start_item(it);
      it.write = 1'b1;
      it.addr  = addr;
      it.data  = data;
      finish_item(it);
    endtask

    task cfg_read(bit [7:0] addr, output bit [31:0] data);
      dma_cfg_item it = dma_cfg_item::type_id::create("rd");
      start_item(it);
      it.write = 1'b0;
      it.addr  = addr;
      finish_item(it);   // returns after the driver's item_done, with the read data filled in
      data = it.data;
    endtask
  endclass

  // A single register access, started by a virtual sequence on cfg_sqr.
  class dma_cfg_access_seq extends dma_cfg_base_seq;
    `uvm_object_utils(dma_cfg_access_seq)
    bit        write;
    bit [7:0]  addr;
    bit [31:0] data;

    function new(string name = "dma_cfg_access_seq");
      super.new(name);
    endfunction

    task body();
      if (write) cfg_write(addr, data);
      else       cfg_read(addr, data);
    endtask
  endclass

  // TODO step 2: the translation sequence. It runs on the register sequencer,
  // pulls whole transfers from the upper-layer sequencer, and turns each into
  // register accesses: program, start, then poll STATUS until DONE.
  class dma_xfer_to_cfg_seq extends dma_cfg_base_seq;
    `uvm_object_utils(dma_xfer_to_cfg_seq)
    uvm_sequencer #(dma_xfer_item) up_sqr;   // set by whoever starts this sequence
    int unsigned poll_limit = 200;

    function new(string name = "dma_xfer_to_cfg_seq");
      super.new(name);
    endfunction

    task body();
      dma_xfer_item x;
      bit [31:0]    status;
      if (up_sqr == null) `uvm_fatal("LAYER", "up_sqr is null: set it before starting the translation sequence")
      forever begin
        up_sqr.get_next_item(x);
        `uvm_info("LAYER", x.convert2string(), UVM_MEDIUM)
        // TODO step 2: program SRC, DST and LEN with cfg_write, start the copy by writing 1
        // to CTRL, then cfg_read STATUS until its DONE bit (bit 1) is 1. Give up with
        // `uvm_fatal after poll_limit reads, so a DMA that never finishes cannot hang the run.
        status = '0;
        up_sqr.item_done();                         // the upper layer's finish_item returns now
      end
    endtask
  endclass

  // Upper-layer sequence: directed corners first (LEN 0, LEN 1, the longest), then random.
  class dma_xfer_seq extends uvm_sequence #(dma_xfer_item);
    `uvm_object_utils(dma_xfer_seq)
    int unsigned n_random = 6;

    function new(string name = "dma_xfer_seq");
      super.new(name);
    endfunction

    task send(int unsigned min_len, int unsigned max_len);
      req = dma_xfer_item::type_id::create("req");
      start_item(req);
      req.pick(min_len, max_len);
      finish_item(req);   // returns when the translation sequence calls item_done: the copy is finished
    endtask

    task body();
      send(0, 0);
      send(1, 1);
      send(16, 16);
      repeat (n_random) send(2, 16);
    endtask
  endclass

  // Fills the whole source window with known data (backdoor: straight into the model).
  function automatic void dma_preload_sources(dma_mem_model mem);
    for (int i = 0; i < SRC_WORDS; i++)
      mem.poke(SRC_BASE + 4 * i, {16'hC0DE, 16'(i)} ^ $urandom);
  endfunction

  // Base virtual sequence: brings up the memory responder and the translation sequence.
  class dma_base_vseq extends uvm_sequence;
    `uvm_object_utils(dma_base_vseq)
    `uvm_declare_p_sequencer(dma_vsequencer)

    function new(string name = "dma_base_vseq");
      super.new(name);
    endfunction

    // TODO step 3: the ordering rule. Memory is loaded and the responder is running
    // before anything can start the DMA; the translation sequence then runs in the background.
    task start_background();
      dma_mem_rsp_seq     rsp_seq   = dma_mem_rsp_seq::type_id::create("rsp_seq");
      dma_xfer_to_cfg_seq translate = dma_xfer_to_cfg_seq::type_id::create("translate");
      // TODO step 3: preload the sources (dma_preload_sources), point the translation sequence at
      // the upper-layer sequencer (translate.up_sqr), then start rsp_seq on the memory
      // sequencer and translate on the register sequencer, both in the background.
    endtask
  endclass

  // TODO step 3: smoke test stimulus.
  class dma_smoke_vseq extends dma_base_vseq;
    `uvm_object_utils(dma_smoke_vseq)

    function new(string name = "dma_smoke_vseq");
      super.new(name);
    endfunction

    task body();
      dma_xfer_seq xfers = dma_xfer_seq::type_id::create("xfers");
      // TODO step 3: bring up the background sequences, then run xfers on the
      // upper-layer sequencer. Its start returns after the last copy has finished.
    endtask
  endclass

  // TODO step 5: reprogram while busy. One long copy runs through the layers while this
  // sequence, in parallel, waits for BUSY and then writes DST on the same register
  // sequencer. R3 says the write is ignored: the copy must still land at the first DST.
  class dma_busy_vseq extends dma_base_vseq;
    `uvm_object_utils(dma_busy_vseq)

    function new(string name = "dma_busy_vseq");
      super.new(name);
    endfunction

    task body();
      dma_xfer_seq       first  = dma_xfer_seq::type_id::create("first");
      dma_cfg_access_seq access;
      bit [31:0]         status;
      // TODO step 5: bring up the background sequences and set first.n_random = 0, so
      // first sends LEN 0, LEN 1 and then one 16-word copy. In a fork...join, run first on
      // the upper-layer sequencer and, in parallel, poll STATUS and LEN with
      // dma_cfg_access_seq on the register sequencer until the DMA is BUSY with LEN 16;
      // then write DST_ALT to DST. After the join, read DST back.
      status = '0;
    endtask
  endclass

  // ---------------------------------------------------------------------------
  // Tests
  // ---------------------------------------------------------------------------
  class dma_base_test extends uvm_test;
    `uvm_component_utils(dma_base_test)
    dma_env env;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      env = dma_env::type_id::create("env", this);
      uvm_top.set_timeout(100us, 0);   // a hang ends the run instead of running forever
    endfunction

    virtual task run_vseq(uvm_phase phase);
    endtask

    task run_phase(uvm_phase phase);
      phase.raise_objection(this);
      run_vseq(phase);
      repeat (5) @(posedge env.cfg_agt.drv.vif.clk);   // let the last monitor samples land
      phase.drop_objection(this);
    endtask

    function void report_phase(uvm_phase phase);
      uvm_report_server rs = uvm_report_server::get_server();
      int unsigned errors = rs.get_severity_count(UVM_ERROR) + rs.get_severity_count(UVM_FATAL);
      if (errors == 0) `uvm_info("RESULT", "PASS", UVM_NONE)
      else             `uvm_info("RESULT", $sformatf("FAIL: %0d errors", errors), UVM_NONE)
    endfunction
  endclass

  class dma_smoke_test extends dma_base_test;
    `uvm_component_utils(dma_smoke_test)

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual task run_vseq(uvm_phase phase);
      dma_smoke_vseq vseq = dma_smoke_vseq::type_id::create("vseq");
      vseq.start(env.vsqr);
    endtask
  endclass

  class dma_busy_test extends dma_base_test;
    `uvm_component_utils(dma_busy_test)

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual task run_vseq(uvm_phase phase);
      dma_busy_vseq vseq = dma_busy_vseq::type_id::create("vseq");
      vseq.start(env.vsqr);
    endtask
  endclass
endpackage
