// fifo_tb_pkg.sv: the starter class-based bench for lab fifo-1 (see README.md).
// It compiles and runs, but it drives nothing and checks nothing. Each
// "TODO step N" comment marks code you write in step N of the README.
// Compile order: sync_fifo.sv, fifo_if.sv, fifo_tb_pkg.sv, tb_top.sv.
//
// The layers, each a class:
//   fifo_item  one cycle of stimulus: wr_en, wr_data, rd_en
//   fifo_obs   a fifo_item plus what the monitor saw on the outputs
//   fifo_gen   builds the list of items for a test, cloning a blueprint
//   fifo_drv   drives one item per clock through the virtual interface
//   fifo_mon   samples the interface on every edge into a NEW fifo_obs
//   fifo_sb    the reference model (a queue), the checks and the verdict
//   fifo_env   creates the layers and runs them (given)
package fifo_tb_pkg;
  timeunit 1ns; timeprecision 1ps;

  localparam int W     = 8;
  localparam int DEPTH = 4;

  // ------------------------------------------------- step 2: the transactions
  // One clock cycle of stimulus.
  class fifo_item;
    bit           wr_en;
    logic [W-1:0] wr_data;
    bit           rd_en;

    // Copy this class's three fields from rhs.
    virtual function void copy(fifo_item rhs);
      // TODO step 2
    endfunction

    // Return a NEW fifo_item with the same field values: create it, then
    // call its copy() with this object.
    virtual function fifo_item clone();
      // TODO step 2
      return null;
    endfunction

    virtual function string convert2string();
      // TODO step 2: for example "wr_en=1 wr_data=0x10 rd_en=0"
      return "";
    endfunction
  endclass

  // What the monitor saw on one edge: the inputs the DUT sampled, plus the
  // outputs as they were just before that edge.
  class fifo_obs extends fifo_item;
    logic [W-1:0] rd_data;
    logic         full;
    logic         empty;
    int unsigned  cycle;              // edges since reset, for messages

    // TODO step 2: override copy() (super.copy first, then a checked $cast of
    // rhs to fifo_obs, then the four new fields), clone() (it must create a
    // fifo_obs) and convert2string() (add the new fields to
    // super.convert2string()).
  endclass

  // ---------------------------------------------------- step 3: the generator
  class fifo_gen;
    fifo_item     items[$];           // the stimulus, one item per cycle
    fifo_item     blueprint = new();  // edited in place, then cloned
    logic [W-1:0] next_data = 8'h10;  // every write carries a new value
    bit [15:0]    lfsr      = 16'hACE1;

    // Set the blueprint's fields (wr_data = next_data when wr is 1, else 0;
    // then next_data++ if wr), and push a CLONE of the blueprint onto items.
    function void add(bit wr, bit rd);
      // TODO step 3
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
      // TODO step 3: see the plan table in the README
    endfunction

    // A write and a read on one edge at every level.
    function void simultaneous();
      // TODO step 3: see the plan table in the README
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

    // One item per rising edge: wait for @(posedge vif.clk), then drive
    // wr_en, wr_data and rd_en with <=. After the last item, one more edge
    // and drive both enables to 0.
    task run(fifo_item items[$]);
      // TODO step 4
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
    // just before the edge, so compare it with the model's state BEFORE the
    // model takes this edge's write and read.
    function void write(fifo_obs o);
      // TODO step 6:
      //   1. if rd_pending: compare o.rd_data with exp_rd.wr_data using !==
      //   2. compare o.full and o.empty with the model's level (ref_q.size())
      //   3. update the corner counters, then let the MODEL decide: pop a read
      //      (rd_en and not empty), push the write (wr_en and not full)
    endfunction

    // The verdict (given). all_tests asks that every corner was exercised.
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

    // Forever: wait for a rising edge; skip it (and restart the cycle count)
    // while vif.rst_n is not 1; otherwise create a NEW fifo_obs, fill in the
    // cycle number and all six signals from vif, and call sb.write().
    task run();
      // TODO step 5
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
