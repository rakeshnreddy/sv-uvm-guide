import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function ProceduralSemanticsTopicPage() {
  const pageContent = {
    title: "SystemVerilog Procedural Semantics",
    elevatorPitch: {
      definition: "Procedural semantics in SystemVerilog define how statements within procedural blocks (like `always`, `always_comb`, `always_ff`, `always_latch`, `initial`) execute over time. This includes the critical distinction between blocking (=) and non-blocking (<=) assignments, which determines the order of operations and how hardware concurrency is modeled.",
      analogy: "Think of an `always` block like a recipe for a chef. **Blocking assignments (=)** are like steps the chef must complete fully before starting the next (e.g., 'chop all vegetables, then sauté onions'). The chef can't sauté onions if they are still chopping. **Non-blocking assignments (<=)** are like giving instructions to several assistant chefs simultaneously (e.g., 'Chef A, start preparing the sauce; Chef B, start grilling the meat'). All instructions are given (values calculated) in the current moment (timestep), but the actual actions (updates) happen a bit later, concurrently, as if at the same time once everyone knows their task.",
      why: "Understanding procedural semantics, especially blocking vs. non-blocking assignments, is absolutely critical for correctly modeling digital hardware. Using them incorrectly is a primary source of simulation/synthesis mismatches and race conditions. Non-blocking assignments are essential for modeling how synchronous hardware (like flip-flops) behaves, where all inputs are sampled simultaneously at a clock edge, and outputs change together after a delay. Blocking assignments are typically used for combinatorial logic within `always_comb` or for sequences of operations in testbench code."
    },
    practicalExplanation: {
      coreMechanics: `SystemVerilog's event scheduler controls when procedural blocks execute and when assignments update.
      - **Procedural Blocks:**
        - \`initial\`: Executes once at the beginning of the simulation. Used for initialization, stimulus generation, or testbench control.
        - \`always\`: A generic block that executes repeatedly based on its sensitivity list (e.g., \`@(posedge clk)\`, \`@(a or b)\`).
        - \`always_comb\`: Specifically for modeling combinational logic. The simulator infers the sensitivity list from the variables read inside the block. It executes if any of those variables change. Statements inside should use blocking assignments.
        - \`always_ff\`: Specifically for modeling sequential, edge-triggered logic (flip-flops). Requires a sensitivity list like \`@(posedge clk or negedge rst_n)\`. Statements inside should use non-blocking assignments for synchronous updates.
        - \`always_latch\`: Specifically for modeling transparent latches. The simulator infers sensitivities. Requires specific coding style to infer a latch correctly.

      - **The Verilog Event Scheduler & Assignment Types:**
        The simulation timestep is divided into regions. Key regions for understanding assignments:
        1.  **Active Region:** Blocking assignments (=) are evaluated and their Left-Hand Side (LHS) is updated immediately in this region. If multiple blocking assignments are in sequence, they occur in that order within the same timestep. The Right-Hand Side (RHS) of non-blocking assignments is also evaluated in this region.
        2.  **Inactive Region:** Holds events scheduled with #0 delay.
        3.  **Non-Blocking Assign (NBA) Update Region:** The LHS of all non-blocking assignments (<=) whose RHS was evaluated in the Active region are updated here. This happens *after* all RHS evaluations for the current timestep are complete. This separation is key to mimicking parallel hardware updates.
        4.  **Postponed Region:** Used for system tasks like $monitor, $strobe.

      - **Blocking Assignments (=):**
        - The expression on the RHS is evaluated, and the LHS variable is updated immediately.
        - Subsequent statements in the same procedural block will see the new value.
        - Used for:
          - Modeling combinational logic within an \`always_comb\` block.
          - Describing sequential behavior within a task or function in a testbench.
          - Variables that are local to a procedural block and don't represent state-holding elements.

      - **Non-Blocking Assignments (<=):**
        - The expression on the RHS is evaluated, but the LHS variable is scheduled to be updated later in the NBA Update Region of the current timestep.
        - Subsequent statements in the same procedural block (in the same timestep) will see the *old* value of the LHS.
        - Used for:
          - Modeling synchronous logic (flip-flops) in an \`always_ff\` block to ensure all flip-flops sample their inputs at the clock edge and update together.
          - Modeling concurrent data transfers where multiple signals should appear to update simultaneously.

      - **Specialized \`always\` blocks (\`always_comb\`, \`always_ff\`, \`always_latch\`):**
        - These were introduced in SystemVerilog to help enforce correct modeling styles.
        - \`always_comb\`: Automatically sensitive to all RHS variables. If you write to a variable that you also read from without proper conditions, it can infer a latch (often unintended). Good practice to ensure all paths assign to all outputs.
        - \`always_ff\`: Enforces synchronous design style. Typically expects non-blocking assignments.
        - \`always_latch\`: Explicitly for level-sensitive latches.
        Using these helps catch common errors at compile time or via linting tools.`,
      codeExamples: [
        {
          description: "Blocking vs. Non-Blocking in a simple sequence:",
          code:
`module blocking_vs_nonblocking;
  logic a, b, c;
  logic x, y, z;

  initial begin
    a = 0; b = 0; c = 0;
    x = 0; y = 0; z = 0;

    // Blocking assignments
    a = 1;
    b = a; // b gets the new value of a (1)
    c = b; // c gets the new value of b (1)
    $display("Blocking: a=%b, b=%b, c=%b", a, b, c); // Blocking: a=1, b=1, c=1

    // Non-blocking assignments
    // All RHS are evaluated first using old values (x=0, y=0, z=0)
    x <= 1;       // x scheduled to get 1
    y <= x;       // y scheduled to get current x (0)
    z <= y;       // z scheduled to get current y (0)

    // Values update in NBA region
    #1; // Wait for NBA updates to complete for display
    $display("Non-blocking: x=%b, y=%b, z=%b", x, y, z); // Non-blocking: x=1, y=0, z=0
  end
endmodule`
        },
        {
          description: "Modeling Synchronous Logic (Counter) with `always_ff` and Non-Blocking Assignments:",
          code:
`module counter (
  input  logic clk,
  input  logic rst_n,
  input  logic en,
  output logic [3:0] count
);

  // Use always_ff for sequential logic
  // Use non-blocking (<=) for outputs of flip-flops
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      count <= 4'b0;
    end else if (en) begin
      count <= count + 1; // RHS 'count' is the value from *before* this clock edge
    end else begin
      count <= count; // Explicitly hold the value if not enabled
    end
  end
endmodule`
        },
        {
          description: "Modeling Combinational Logic with `always_comb` and Blocking Assignments:",
          code:
`module combinational_logic (
  input  logic [3:0] a,
  input  logic [3:0] b,
  input  logic       sel,
  output logic [3:0] y
);

  // Use always_comb for combinational logic
  // Use blocking (=) for assignments
  always_comb begin
    if (sel == 1'b0) begin
      y = a + b;
    end else begin
      y = a - b;
    end
    // Note: if 'y' was not assigned in all paths (e.g. missing 'else'),
    // a latch would be inferred for 'y', which is usually not intended
    // in combinational logic.
  end
endmodule`
        }
      ],
      visualizations: [
        { description: "Diagram of the Verilog Event Scheduler Regions (Active, Inactive, NBA, Postponed).", altText: "Verilog Event Scheduler Diagram" },
        { description: "Flowchart illustrating how blocking assignments execute sequentially vs. how non-blocking assignments schedule updates.", altText: "Blocking vs Non-Blocking Flowchart" }
      ]
    },
    deepDive: {
      advancedScenarios: `A common bug is mixing blocking and non-blocking assignments to the same variable or using blocking assignments for flip-flop outputs, leading to race conditions and simulation-synthesis mismatches. For example, in an \`always_ff\` block: \`q1 = d; q2 = q1;\` (both blocking) would make \`q2\` get the *new* value of \`q1\` in the same clock cycle, which is not how pipelined flops behave. It should be \`q1 <= d; q2 <= q1;\`.
      Another subtle issue is intra-assignment delay with blocking assignments (e.g., \`a = #10 b;\`), which creates a temporary variable for 'b' and then assigns it to 'a' after 10 time units. This is different from \`#10 a = b;\`.
      Sensitivity list issues: Forgetting a signal in a classic \`always @(...)\` sensitivity list for combinational logic can lead to it not updating when expected. \`always_comb\` solves this.
      Accidental latch inference in \`always_comb\` is common if not all output variables are assigned in all possible execution paths of the block.
      Race conditions in testbenches: When multiple procedural blocks interact with the same signals without proper synchronization (e.g., one \`initial\` block reads a variable that another \`initial\` block writes at the same simulation time), the order of execution between blocks can be unpredictable.`,
      experienceView: `A senior engineer internalizes these rules:
      1.  **Synchronous Logic (\`always_ff\`):** ALWAYS use non-blocking (<=). This is rule #1 for synthesizable sequential logic.
      2.  **Combinational Logic (\`always_comb\`):** ALWAYS use blocking (=).
      3.  **Latches (\`always_latch\`):** Use blocking (=), and ensure the coding style correctly infers a latch.
      4.  **Mixing in one block:** Do not assign to the same variable using both blocking and non-blocking assignments within the same \`always\` block.
      5.  **Testbench code (\`initial\`, \`task\`):** Often uses blocking assignments for sequential operations. Non-blocking can be used if mimicking concurrent hardware updates or communicating with DUT via clocking blocks.
      They are vigilant about sensitivity lists (or prefer \`always_comb\`, \`always_ff\`). In code reviews, they scrutinize assignment types in procedural blocks, check for complete assignments in \`always_comb\` to avoid unintended latches, and look for potential race conditions between procedural blocks or with clocking block interactions. They ask: "What is the intent of this block – sequential or combinational?", "Why is this a blocking/non-blocking assignment?", "Will this synthesize as expected?".`,
      retentionTip: "Remember: **S**equential Logic (\`always_ff\`) uses **S**cheduled (Non-Blocking: <=) updates. **C**ombinational Logic (\`always_comb\`) uses **C**urrent (Blocking: =) updates. Think of '<=' as an arrow pointing to the future (scheduled update), and '=' as 'is currently'."
    }
  };

  return <TopicPage {...pageContent} />;
}
