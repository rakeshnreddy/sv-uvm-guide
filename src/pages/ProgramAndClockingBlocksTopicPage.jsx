import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function ProgramAndClockingBlocksTopicPage() {
  const pageContent = {
    title: "Program and Clocking Blocks",
    elevatorPitch: {
      definition: "Program blocks and clocking blocks are SystemVerilog constructs designed to create race-free testbench interaction with a Design Under Test (DUT). Program blocks separate testbench execution into a distinct region of the SystemVerilog event schedule, while clocking blocks specify synchronous signal sampling and driving behavior relative to a clock.",
      analogy: "Think of a **program block** like a dedicated 'test conductor's podium' next to the main 'orchestra stage' (the DUT/hardware). The conductor (testbench code in the program block) operates in their own time slightly offset from the orchestra, ensuring they don't interfere with the musicians' performance. A **clocking block** is like the conductor's sheet music for a specific instrument section (e.g., the strings). It tells the conductor exactly when to listen (sample inputs) to the strings and when to give them cues (drive outputs), all perfectly synchronized with the music's tempo (the clock).",
      why: "These constructs exist to solve the critical problem of timing races and non-determinism in testbenches. Before them, testbenches often had ambiguous timing for when they sampled DUT outputs or drove DUT inputs relative to clock edges. This led to simulations that might pass sometimes and fail others, or worse, simulations that passed but didn't match actual hardware behavior. Program and clocking blocks provide explicit mechanisms to ensure testbench operations are synchronized predictably with the DUT's clock, leading to more robust and reliable verification."
    },
    practicalExplanation: {
      coreMechanics: `
**Program Blocks (\`program ... endprogram\`):**
-   **Purpose:** To encapsulate testbench code and isolate its execution from the DUT's hardware-centric event regions.
-   **Event Region:** Program blocks execute primarily in the "Reactive Region" (also sometimes referred to as Program Region or Re-PRG) of the SystemVerilog event scheduler. This region typically executes *after* the Active, Inactive, and NBA regions where DUT logic is evaluated and updated. This helps avoid races by ensuring the DUT has 'settled' for the current timestep before the testbench reacts.
-   **Execution:** Code within a program block (e.g., in an \`initial\` block) starts execution once at the beginning of the simulation.
-   **Interaction with DUT:**
    -   Can instantiate modules/interfaces, but typically drive/sample DUT signals through interfaces and clocking blocks.
    -   Cannot contain \`always\` blocks (use \`initial\`, \`task\`, \`function\`).
    -   Use blocking assignments for procedural test flow.
-   **Final Block:** A program block can contain a \`final\` block, which executes at the very end of simulation, useful for printing summary messages.
-   **Implicit \`$exit\`:** An implicit \`$exit()\` is called when all \`initial\` blocks within a program finish, terminating the simulation unless other processes are active or \`$finish\` is explicitly called.

**Clocking Blocks (\`clocking ... endclocking\`):**
-   **Purpose:** To specify the timing of testbench interaction with the DUT signals relative to a specific clock. They define which signals are inputs or outputs from the testbench's perspective and when they should be sampled or driven.
-   **Defined within:** Typically defined within an interface, but can also be in a module or program block.
-   **Clock Event:** Associated with a clock signal (\`@(posedge clk)\`). All timing within the clocking block is relative to this event.
-   **Input (Sampling) Skew:** Specifies when input signals are sampled.
    -   \`input #<skew> signal_name;\`
    -   A positive skew (e.g., \`#1step\`, \`#0ps\`, or just \`#1ns\` if timescale allows) means sampling occurs slightly *before* the clock edge in the current timestep's Preponed region (for #1step) or in previous timesteps' Postponed regions. The goal is to sample the value that *will be* present at the DUT's input setup time or the value that *was* stable from the DUT's output.
    -   Default input skew is \`#1step\` if not specified, meaning signals are sampled just before the clock edge in the current timestep.
-   **Output (Driving) Skew:** Specifies when output signals are driven.
    -   \`output #<skew> signal_name;\`
    -   A positive skew (e.g., \`#0ns\`, \`#2ns\`) means the signal is driven *after* the clock edge in the current timestep's Post-active regions. The goal is to drive values after the DUT's hold time requirement.
    -   Default output skew is \`#0\` if not specified (or if a default output skew is set), meaning signals are driven at the clock edge (but scheduled in a way to avoid races, often in the Re-PRG or later regions if from a program block).
-   **Accessing Signals:** Signals within a clocking block are accessed using the clocking block instance name (e.g., \`cb_name.signal_name\`).
-   **Synchronization:** Driving signals via a clocking block (e.g., \`cb.my_output <= value;\`) automatically synchronizes the drive to the specified output skew relative to the clocking event. Waiting for a clocking block event (\`@(cb_name)\`) synchronizes procedural code to the clock.
-   **Default Skews:** \`default input #<skew>; default output #<skew>;\` can set default skews for all signals in the clocking block.
-   **Cycle Delay (\`##\`):** \`##N\` means wait for N clocking block events. \`cb.sig <= ##1 data;\` means drive 'data' to 'sig' on the next clock cycle at its specified output skew.
`,
      codeExamples: [
        {
          description: "Program block with an interface and a simple initial block:",
          code:
`interface my_if(input logic clk);
  logic req;
  logic gnt;
  // Clocking block will be added in the next example
endinterface

program test(my_if dif); // 'dif' is the interface instance
  initial begin
    $display("@%0t: Program block started.", $time);
    dif.req = 1'b0;
    #10;
    dif.req = 1'b1;
    $display("@%0t: Program block: Sent req=1", $time);
    // Wait for grant or timeout (simplified)
    wait(dif.gnt == 1'b1);
    $display("@%0t: Program block: Received gnt=1", $time);
    #20 dif.req = 1'b0;
    $display("@%0t: Program block finished.", $time);
  end

  final
    $display("Simulation finished at %0t", $time);

endmodule

module dut(my_if mif);
  // Simple DUT logic
  always_ff @(posedge mif.clk) begin
    if (mif.req)
      mif.gnt <= mif.req; // Grant if request
    else
      mif.gnt <= 1'b0;
  end

  initial begin
    // Monitor DUT signals
    $monitor("@%0t: DUT: clk=%b, req=%b, gnt=%b", $time, mif.clk, mif.req, mif.gnt);
  end
endmodule

module top;
  logic clk = 0;
  always #5 clk = ~clk; // Clock generator

  my_if if_inst(clk);    // Instantiate interface
  dut my_dut(if_inst);   // Connect DUT
  test my_test(if_inst); // Connect Program Block
endmodule`
        },
        {
          description: "Clocking block within an interface, used by a program block:",
          code:
`interface bus_if(input logic clk);
  logic        addr;
  logic        wr;
  logic [7:0]  wdata;
  logic [7:0]  rdata;
  logic        rdy;

  // Clocking block from testbench's perspective
  clocking tb_cb @(posedge clk);
    default input #1step output #2ns; // Default skews

    output addr, wr, wdata; // Testbench drives these
    input  rdata, rdy;      // Testbench samples these
  endclocking

  // Modport for the DUT
  modport DUT (input clk, addr, wr, wdata, output rdata, rdy);
  // Modport for the Testbench (using the clocking block)
  modport TB (clocking tb_cb, input clk);

endinterface

program test_with_cb(bus_if.TB bus); // Use TB modport which includes clocking block 'tb_cb'
  initial begin
    $display("@%0t: Test with CB started.", $time);
    // Wait for initial reset/settling if any (not shown)
    @(bus.tb_cb); // Synchronize to the first clock edge

    // Drive signals via clocking block
    bus.tb_cb.addr  <= 1'b1;
    bus.tb_cb.wr    <= 1'b1;
    bus.tb_cb.wdata <= 8'hAB;
    $display("@%0t: Test: Drove addr, wr, wdata", $time);

    @(bus.tb_cb); // Wait for next clock cycle
    bus.tb_cb.wr <= 1'b0; // Stop writing
    $display("@%0t: Test: Drove wr=0. Waiting for rdy...", $time);

    // Wait for rdy to be asserted (sampled by clocking block)
    wait(bus.tb_cb.rdy == 1'b1);
    // Could also use: @(bus.tb_cb iff bus.tb_cb.rdy == 1'b1);
    $display("@%0t: Test: rdy is asserted. Sampled rdata = %h", $time, bus.tb_cb.rdata);

    @(bus.tb_cb); // One more cycle
    $display("@%0t: Test finished.", $time);
  end
endprogram

// Simplified DUT using the interface
module simple_dut (bus_if.DUT bus);
  logic [7:0] mem[1];

  always_ff @(posedge bus.clk) begin
    bus.rdy <= 1'b0; // Default ready to low
    if (bus.wr) begin
      mem[bus.addr] <= bus.wdata;
      $display("@%0t: DUT: Wrote %h to addr %b", $time, bus.wdata, bus.addr);
    end else if (!bus.wr && bus.rdy == 1'b0) begin // Simple read logic
      bus.rdata <= mem[bus.addr];
      bus.rdy   <= 1'b1; // Signal data is ready
      $display("@%0t: DUT: Read %h from addr %b, set rdy", $time, mem[bus.addr], bus.addr);
    end
  end
endmodule

module top_cb;
  logic clk = 0;
  always #5 clk = ~clk;

  bus_if b_if(clk);
  simple_dut s_dut(b_if);
  test_with_cb test(b_if); // Connects to TB modport
endmodule`
        }
      ],
      visualizations: [
        { description: "Diagram showing SystemVerilog event scheduler regions with Program Region highlighted.", altText: "Event Scheduler with Program Region" },
        { description: "Timing diagram illustrating input and output skews of a clocking block relative to the clock edge.", altText: "Clocking Block Skews Timing Diagram" }
      ]
    },
    deepDive: {
      advancedScenarios: `Common issues:
      - Forgetting to use the clocking block prefix to access signals (e.g., writing \`my_if.req <= 1\` instead of \`my_if.cb.req <= 1\`) bypasses the clocking block synchronization.
      - Incorrect skews leading to continued race conditions or missing setup/hold times. \`#1step\` for input is usually safe as it samples in the preponed region before any delta-cycle activity at that time. Output skews need to consider DUT hold times.
      - Trying to use \`always\` blocks inside a \`program\` block (not allowed).
      - Confusion between module/interface signals and clocking block signals if they have the same name (they are distinct).
      - Program blocks terminate simulation with \`$exit\` if all initial blocks finish. If you have other always-on processes (e.g., a scoreboarding module not in a program block), the simulation might continue. Using a controlling process to call \`$finish\` is more explicit.
      - Driving clocking block inputs or sampling clocking block outputs is illegal and will result in an error. Directionality is key.
      - Multiple clocking blocks in an interface for different clocks or different synchronous interaction points.`,
      experienceView: `A senior engineer views program and clocking blocks as essential for 'clean room' testbench design.
      - **Separation of Concerns:** Program blocks keep testbench stimulus/control logic separate from DUT timing.
      - **Explicit Synchronization:** Clocking blocks make the timing relationship between testbench and DUT explicit and verifiable. They are the primary mechanism for cycle-accurate testbenches.
      - **Default Skews:** Carefully chosen default input/output skews in a clocking block are critical for reusability and correctness. \`input #1step\` is a common safe default for sampling. Output skews often default to \`#0\` or a small delay if driving from a program block, ensuring drive happens after the clock edge.
      - **Modports:** Clocking blocks are often bundled into modports to define clear testbench-facing or DUT-facing views of an interface.
      - **Assertions:** Clocking blocks are also used by SystemVerilog Assertions (SVA) to define when properties should be evaluated.
      In code reviews, they check: "Are all DUT interactions through a clocking block?", "Are the skews appropriate for the interface protocol?", "Is the clocking event correctly specified?", "Is the program block correctly interfaced (e.g., via modports)?", "How is simulation termination handled?"`,
      retentionTip: "Remember: **Program Block** = Testbench's private 'Control Room', scheduled after DUT activity. **Clocking Block** = Testbench's 'Synchronized Glasses & Gloves' for interacting with the DUT on exact clock ticks, defining *when* to look (input skew) and *when* to touch (output skew)."
    }
  };

  return <TopicPage {...pageContent} />;
}
