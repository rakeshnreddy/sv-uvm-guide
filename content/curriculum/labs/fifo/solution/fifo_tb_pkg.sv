// fifo_tb_pkg.sv: reference solution for lab fifo-1 (see README.md).
// Compile it with work/sync_fifo.sv, work/fifo_if.sv and work/tb_top.sv, in
// place of work/fifo_tb_pkg.sv.
//
// The layers, each a class:
//   fifo_item  one cycle of stimulus: wr_en, wr_data, rd_en
//   fifo_obs   a fifo_item plus what the monitor saw on the outputs
//   fifo_gen   builds the list of items for a test, cloning a blueprint
//   fifo_drv   drives one item per clock through the virtual interface
//   fifo_mon   samples the interface on every edge into a NEW fifo_obs
//   fifo_sb    the reference model (a queue), the checks and the verdict
//   fifo_env   creates the layers and runs them
package fifo_tb_pkg;
  timeunit 1ns; timeprecision 1ps;

  localparam int W     = 8;
  localparam int DEPTH = 4;

  // ------------------------------------------------- step 2: the transactions
  // One clock cycle of stimulus.
  class fifo_item;
    bit         wr_en;
    logic [W-1:0] wr_data;
    bit         rd_en;

    // Copy this class's fields from rhs. Virtual, so a derived class can add
    // its own fields and still be copied through a fifo_item handle (8.20).
    virtual function void copy(fifo_item rhs);
      wr_en   = rhs.wr_en;
      wr_data = rhs.wr_data;
      rd_en   = rhs.rd_en;
    endfunction

    // A new object of the same class with the same field values. A handle
    // assignment (b = a) copies only the handle: both names then reach the
    // one object (8.12).
    virtual function fifo_item clone();
      fifo_item c = new();
      c.copy(this);
      return c;
    endfunction

    virtual function string convert2string();
      return $sformatf("wr_en=%0b wr_data=0x%02h rd_en=%0b", wr_en, wr_data, rd_en);
    endfunction
  endclass

  // What the monitor saw on one edge: the inputs the DUT sampled, plus the
  // outputs as they were just before that edge.
  class fifo_obs extends fifo_item;
    logic [W-1:0] rd_data;
    logic         full;
    logic         empty;
    int unsigned  cycle;              // edges since reset, for messages

    // rhs arrives as a fifo_item handle. $cast, called as a function, returns
    // 0 instead of stopping the run when rhs is not a fifo_obs (6.24.2, 8.16).
    virtual function void copy(fifo_item rhs);
      fifo_obs o;
      super.copy(rhs);                // the base class copies its own fields
      if (!$cast(o, rhs)) $fatal(1, "fifo_obs::copy: rhs is not a fifo_obs");
      rd_data = o.rd_data;
      full    = o.full;
      empty   = o.empty;
      cycle   = o.cycle;
    endfunction

    // Overrides fifo_item::clone so the copy is a fifo_obs: the base version would
    // create a fifo_item, and fifo_item::copy would silently drop rd_data, full, empty and cycle.
    virtual function fifo_item clone();
      fifo_obs c = new();
      c.copy(this);
      return c;
    endfunction

    virtual function string convert2string();
      return $sformatf("cycle %0d: %s full=%0b empty=%0b rd_data=0x%02h",
                       cycle, super.convert2string(), full, empty, rd_data);
    endfunction
  endclass

  // ---------------------------------------------------- step 3: the generator
  class fifo_gen;
    fifo_item     items[$];           // the stimulus, one item per cycle
    fifo_item     blueprint = new();  // edited in place, then cloned
    logic [W-1:0] next_data = 8'h10;  // every write carries a new value
    bit [15:0]    lfsr      = 16'hACE1;

    // Store a copy of the blueprint. Storing the blueprint itself would put
    // the same handle in every slot, so every item would show the last edit.
    function void add(bit wr, bit rd);
      blueprint.wr_en   = wr;
      blueprint.wr_data = wr ? next_data : '0;
      blueprint.rd_en   = rd;
      if (wr) next_data++;
      items.push_back(blueprint.clone());
    endfunction

    function void write(int n = 1); repeat (n) add(1, 0); endfunction
    function void read (int n = 1); repeat (n) add(0, 1); endfunction
    function void both (int n = 1); repeat (n) add(1, 1); endfunction
    function void idle (int n = 1); repeat (n) add(0, 0); endfunction

    // A 16-bit Fibonacci LFSR (taps 16, 14, 13, 11), so the "mixed" stimulus
    // is the same on every simulator. Randomization proper is I-SV-2A.
    function void step_lfsr();
      lfsr = {lfsr[14:0], lfsr[15] ^ lfsr[13] ^ lfsr[12] ^ lfsr[10]};
    endfunction

    function void smoke();
      write(3);
      read(3);
      idle();
    endfunction

    // Fill to full, try to overflow, drain to empty, try to underflow.
    function void fill_drain();
      write(DEPTH);
      write(2);                       // full: both writes must be dropped (F4)
      read(DEPTH);
      read(2);                        // empty: both reads must be ignored (F4)
      idle();
    endfunction

    // A write and a read on one edge at every level.
    function void simultaneous();
      both();                         // empty: the write only (F4)
      write(1);                       // now 2 held
      both(2);                        // middle: both, the level holds
      write(DEPTH - 2);               // now full
      both(2);                        // full: the read only (3 held), then both (still 3)
      read(DEPTH);                    // drain, and one read while empty
      idle();
    endfunction

    function void mixed(int cycles = 64);
      repeat (cycles) begin
        step_lfsr();
        add(lfsr[0] | lfsr[1], lfsr[2]); // write 3 cycles in 4, read 1 in 2: it fills
      end
      read(DEPTH);                    // leave the FIFO empty
      idle();
    endfunction

    // Returns 0 for an unknown test name.
    function bit build(string test);
      case (test)
        "smoke":        smoke();
        "fill_drain":   fill_drain();
        "simultaneous": simultaneous();
        "mixed":        mixed();
        "all": begin
          smoke(); fill_drain(); simultaneous(); mixed();
        end
        default: return 0;
      endcase
      return 1;
    endfunction
  endclass

  // ------------------------------------------------------- step 4: the driver
  class fifo_drv;
    virtual fifo_if #(W) vif;

    function new(virtual fifo_if #(W) bus);
      vif = bus;
    endfunction

    task reset(int cycles = 2);
      vif.rst_n   <= 1'b0;
      vif.wr_en   <= 1'b0;
      vif.rd_en   <= 1'b0;
      vif.wr_data <= '0;
      repeat (cycles) @(posedge vif.clk);
      vif.rst_n   <= 1'b1;            // just after an edge: seen on the next one
    endtask

    // One item per rising edge, driven with <= so the DUT samples it on the
    // next edge whatever order the processes run in (4.9.4). Ends idle.
    task run(fifo_item items[$]);
      foreach (items[i]) begin
        @(posedge vif.clk);
        vif.wr_en   <= items[i].wr_en;
        vif.wr_data <= items[i].wr_data;
        vif.rd_en   <= items[i].rd_en;
      end
      @(posedge vif.clk);
      vif.wr_en <= 1'b0;
      vif.rd_en <= 1'b0;
    endtask
  endclass

  // ----------------------------------------------------- step 6: scoreboard
  // (declared before the monitor, which holds a handle to it)
  class fifo_sb;
    fifo_item    ref_q[$];            // the model: the entries the FIFO holds
    fifo_item    exp_rd;              // the entry a read took on the last edge
    bit          rd_pending;
    int          pass_cnt, fail_cnt;
    // corner counters: how often each case was really exercised
    int          n_wr, n_rd, n_wr_full, n_rd_empty, n_rw_empty, n_rw_mid, n_rw_full, n_hit_full;

    // Called by the monitor once per edge after reset. o holds the values
    // just before the edge, so it is compared with the model's state before
    // the model takes this edge's write and read.
    function void write(fifo_obs o);
      bit model_full  = (ref_q.size() == DEPTH);
      bit model_empty = (ref_q.size() == 0);

      // 1. A read accepted on the previous edge put its data on rd_data (F3).
      if (rd_pending) begin
        if (o.rd_data !== exp_rd.wr_data) begin
          fail_cnt++;
          $error("CHK cycle %0d: rd_data=0x%02h, expected 0x%02h", o.cycle, o.rd_data, exp_rd.wr_data);
        end else pass_cnt++;
        rd_pending = 0;
      end

      // 2. The flags must match the model's level (F5).
      if (o.full !== model_full || o.empty !== model_empty) begin
        fail_cnt++;
        $error("CHK cycle %0d: full=%0b empty=%0b, expected full=%0b empty=%0b (%0d held)",
               o.cycle, o.full, o.empty, model_full, model_empty, ref_q.size());
      end else pass_cnt++;

      // 3. The model decides what this edge accepts, from its own level (F2-F4).
      if (o.wr_en && model_full)  n_wr_full++;
      if (o.rd_en && model_empty) n_rd_empty++;
      if (o.wr_en && o.rd_en) begin
        if (model_empty)     n_rw_empty++;
        else if (model_full) n_rw_full++;
        else                 n_rw_mid++;
      end
      if (o.rd_en && !model_empty) begin
        exp_rd     = ref_q.pop_front();
        rd_pending = 1;
        n_rd++;
      end
      if (o.wr_en && !model_full) begin
        ref_q.push_back(o);           // stores the handle: o must not change later
        n_wr++;
        if (ref_q.size() == DEPTH) n_hit_full++;
      end
    endfunction

    // The verdict. all_tests asks that every corner was exercised.
    function void report(bit all_tests);
      $display("CORNERS writes=%0d reads=%0d full=%0d wr_full=%0d rd_empty=%0d rw_empty=%0d rw_mid=%0d rw_full=%0d",
               n_wr, n_rd, n_hit_full, n_wr_full, n_rd_empty, n_rw_empty, n_rw_mid, n_rw_full);
      if (rd_pending) begin
        fail_cnt++;
        $error("CHK a read was accepted but its data was never checked");
      end
      if (ref_q.size() != 0) begin
        fail_cnt += ref_q.size();
        $error("CHK %0d written entries were never read", ref_q.size());
      end
      if (all_tests && (n_hit_full == 0 || n_wr_full == 0 || n_rd_empty == 0 ||
                        n_rw_empty == 0 || n_rw_mid == 0 || n_rw_full == 0)) begin
        fail_cnt++;
        $error("CORNER a full/empty corner case was never exercised");
      end
      if (n_rd == 0) begin            // flag checks alone prove no data path
        fail_cnt++;
        $error("CHK no data was read back, so no data was checked");
      end
      $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);
    endfunction
  endclass

  // ------------------------------------------------------ step 5: the monitor
  class fifo_mon;
    virtual fifo_if #(W) vif;
    fifo_sb              sb;

    function new(virtual fifo_if #(W) bus, fifo_sb scoreboard);
      vif = bus;
      sb  = scoreboard;
    endfunction

    // On every rising edge after reset, record the values just before the
    // edge (the bench and the DUT both assign with <=, so nothing has changed
    // yet) in a NEW object, and hand it to the scoreboard.
    task run();
      int unsigned cycle = 0;
      forever begin
        fifo_obs o;
        @(posedge vif.clk);
        if (vif.rst_n !== 1'b1) begin
          cycle = 0;
          continue;
        end
        o         = new();            // a new object on every edge
        o.cycle   = ++cycle;
        o.wr_en   = vif.wr_en;
        o.wr_data = vif.wr_data;
        o.rd_en   = vif.rd_en;
        o.rd_data = vif.rd_data;
        o.full    = vif.full;
        o.empty   = vif.empty;
        sb.write(o);
      end
    endtask
  endclass

  // ----------------------------------------------- the environment (given)
  class fifo_env;
    fifo_gen gen;
    fifo_drv drv;
    fifo_mon mon;
    fifo_sb  sb;

    function new(virtual fifo_if #(W) bus);
      gen = new();
      sb  = new();
      drv = new(bus);
      mon = new(bus, sb);
    endfunction

    // Build the stimulus, reset, then drive it while the monitor watches.
    // Two more edges let the last read's data reach the scoreboard. It returns
    // at a falling edge, so the monitor has finished with the last rising
    // edge whatever order the simulator ran the two processes in.
    task run(string test);
      if (!gen.build(test)) $fatal(1, "TEST unknown test %s", test);
      $display("%0t TEST %s: %0d cycles of stimulus", $realtime, test, gen.items.size());
      fork
        mon.run();
      join_none
      drv.reset();
      drv.run(gen.items);
      repeat (2) @(posedge drv.vif.clk);
      @(negedge drv.vif.clk);
    endtask
  endclass
endpackage
