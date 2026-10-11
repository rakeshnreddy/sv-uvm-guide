// tb_top.sv: the testbench for lab assertions-1 (reference file; you do not edit it).
//
//   source --in_valid/in_ready/in_data--> hs_slice --out_valid/out_ready/out_data--> sink
//                                            |
//                     hs_slice_sva (u_sva) watches all eight signals
//
// - The source offers N_WORDS words (a0, a1, ... a5) back to back and obeys the
//   valid/ready rules: a word stays on in_data, with in_valid high, until an
//   edge where in_ready is 1.
// - The sink takes a word at every edge, except that after its second word it
//   holds out_ready low for pause_cycles edges (the backpressure, or "stall").
// - The scoreboard checks that the sink receives the words in the order the
//   source sent them, with a simple immediate assertion (a_sb_match).
// - At the end, a_end_of_test checks the word count, the scoreboard and the
//   checker's failure count, then the bench calls $finish.
//
// Driving convention (F4C): the source and the sink read and drive the design
// only through the clocking block cb. A clocking input is the value sampled
// just before the rising edge (default input skew 1step); a clocking output
// changes just after the edge, in the Re-NBA region (default output skew 0,
// IEEE 1800-2023 14.16). So the design and the assertions see a new value at
// the NEXT edge, and the bench never races the design. Reset is the one
// exception: rst_n is an asynchronous input, released between two edges.
//
// Plusargs (IEEE 1800-2023 21.6):
//   +NO_STALL    the sink never stalls
//   +PAUSE=<n>   the sink stalls for n edges instead of 2

module tb_top;
  timeunit 1ns;
  timeprecision 1ps;

  localparam int           W              = 8;
  localparam int           N_WORDS        = 6;
  localparam int           PAUSE_AFTER    = 2;    // the sink stalls after this many words
  localparam int           MAX_STALL      = 4;    // sink's promise: ready within 4 edges
  localparam int           TIMEOUT_CYCLES = 100;  // watchdog: the bench always terminates
  localparam logic [W-1:0] FIRST_WORD     = 8'hA0;

  logic         clk       = 1'b0;
  logic         rst_n;
  logic         in_valid  = 1'b0;     // idle values until the first drive through cb
  logic [W-1:0] in_data   = '0;
  logic         in_ready;
  logic         out_valid;
  logic         out_ready = 1'b1;
  logic [W-1:0] out_data;

  int unsigned  pause_cycles = 2;     // +PAUSE=<n> changes it; +NO_STALL sets it to 0
  int unsigned  paused       = 0;     // stalled edges the sink has inserted so far
  int unsigned  n_received   = 0;     // words the sink has taken
  int unsigned  n_mismatch   = 0;     // scoreboard mismatches
  logic [W-1:0] expected[$];          // words the source has offered, oldest first
  logic [W-1:0] exp_word;

  always #5 clk = ~clk;               // rising edges at 5, 15, 25, ... ns

  // The bench's view of the design: one clocking block for the source and the sink.
  clocking cb @(posedge clk);
    input  in_ready, out_valid, out_data;  // sampled just before each edge
    output in_valid, in_data;              // driven just after the edge
    inout  out_ready;                      // the sink drives it and reads its sample
  endclocking

  hs_slice #(.W(W)) dut (
    .clk       (clk),
    .rst_n     (rst_n),
    .in_valid  (in_valid),
    .in_ready  (in_ready),
    .in_data   (in_data),
    .out_valid (out_valid),
    .out_ready (out_ready),
    .out_data  (out_data)
  );

  hs_slice_sva #(.W(W), .MAX_STALL(MAX_STALL)) u_sva (
    .clk       (clk),
    .rst_n     (rst_n),
    .in_valid  (in_valid),
    .in_ready  (in_ready),
    .in_data   (in_data),
    .out_valid (out_valid),
    .out_ready (out_ready),
    .out_data  (out_data)
  );

  // Reset, run control and the end-of-test check.
  initial begin : main
    rst_n = 1'b0;                     // in reset from time 0
    if ($test$plusargs("NO_STALL")) begin
      pause_cycles = 0;
      $display("[TB] +NO_STALL: the sink never stalls");
    end else if ($value$plusargs("PAUSE=%d", pause_cycles)) begin
      $display("[TB] +PAUSE: the sink stalls for %0d edges", pause_cycles);
    end
    #22 rst_n = 1'b1;                 // released at 22 ns, between the edges at 15 and 25

    fork
      wait (n_received == N_WORDS);
      begin
        repeat (TIMEOUT_CYCLES) @(cb);
        $error("[%0d ns] [TB] TIMEOUT: %0d of %0d words received",
               $time, n_received, N_WORDS);
      end
    join_any
    disable fork;                     // stops the watchdog (or the wait)

    repeat (2) @(cb);                 // let the last attempts finish
    a_end_of_test:
      assert (n_received == N_WORDS && n_mismatch == 0 && u_sva.n_fail == 0)
        $display("[%0d ns] [TB] PASS: %0d words received in order, no assertion failures",
                 $time, n_received);
      else
        $error("[%0d ns] [TB] FAIL: %0d words received, %0d scoreboard mismatch(es), %0d assertion failure(s)",
               $time, n_received, n_mismatch, u_sva.n_fail);
    $finish;
  end

  // Source: offers FIRST_WORD, FIRST_WORD+1, ... and holds each one until it is taken.
  initial begin : source
    wait (rst_n == 1'b1);             // 22 ns
    @(cb);                            // first edge out of reset: 25 ns
    for (int i = 0; i < N_WORDS; i++) begin
      cb.in_valid <= 1'b1;
      cb.in_data  <= FIRST_WORD + W'(i);
      expected.push_back(FIRST_WORD + W'(i));
      do @(cb); while (!cb.in_ready); // taken at the first edge where in_ready was 1
    end
    cb.in_valid <= 1'b0;
  end

  // Sink and scoreboard.
  initial begin : sink
    forever begin
      @(cb);
      if (rst_n && cb.out_valid && cb.out_ready) begin  // a downstream transfer here
        exp_word = expected.pop_front();
        a_sb_match: assert (cb.out_data == exp_word)
          else begin
            n_mismatch++;
            $error("[%0d ns] [TB] scoreboard: expected %h, got %h",
                   $time, exp_word, cb.out_data);
          end
        n_received++;
      end
      // Choose out_ready for the next edge.
      if (n_received == PAUSE_AFTER && paused < pause_cycles) begin
        cb.out_ready <= 1'b0;
        paused++;
      end else begin
        cb.out_ready <= 1'b1;
      end
    end
  end

endmodule : tb_top
