import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function SystemVerilogAssertionsTopicPage() {
  const pageContent = {
    title: "SystemVerilog Assertions (SVA)",
    elevatorPitch: {
      definition: "SystemVerilog Assertions (SVA) are a declarative part of the SystemVerilog language used to specify temporal behavior and properties of a design. They allow engineers to define rules about how signals should behave over time, which are then automatically checked by simulation tools, formal verification tools, or even synthesized into hardware checkers.",
      analogy: "Think of SVA like a set of 'traffic laws' for your design's signals. Instead of manually watching every car (signal change) to see if it obeys the speed limit or stops at a red light (a specific behavior), you write down the traffic laws (assertions) once. Then, automated cameras and police (simulation/formal tools) constantly monitor the traffic (signals) and flag any violations (assertion failures).",
      why: "SVA exists to improve verification quality and efficiency. Manually checking complex temporal behaviors in waveforms is error-prone and time-consuming. Assertions provide a concise, formal, and unambiguous way to capture design intent and functional requirements. They help detect bugs closer to their source, provide excellent documentation of expected behavior, and are crucial for coverage-driven verification (e.g., covering that a specific asserted property was indeed checked and passed under various conditions)."
    },
    practicalExplanation: {
      coreMechanics: `SVA has several key components:
-   **Boolean Expressions:** The simplest check, evaluating a condition at a specific point in time (usually tied to a clock edge).
-   **Sequences (\`sequence ... endsequence\`):** Define a pattern of events or conditions over one or more clock cycles.
    -   Can use time delays like \`##N\` (N clock cycles) or \`##[M:N]\` (between M and N cycles).
    -   Logical operators: \`and\`, \`or\`, \`intersect\`.
    -   Repetition operators: \`[*N]\` (N times), \`[->N]\` (goto N times), \`[=N]\` (non-consecutive N times).
    -   \`.triggered\` method: Checks if a sequence endpoint has occurred.
-   **Properties (\`property ... endproperty\`):** Specify the behavior of sequences. They define what should happen when a sequence (or its antecedent) occurs.
    -   **Implication Operators:**
        -   Overlapping implication: \`s1 |-> p1\` (If sequence \`s1\` is true, property \`p1\` must also be true, starting evaluation in the same clock cycle \`s1\` ends).
        -   Non-overlapping implication: \`s1 |=> p1\` (If sequence \`s1\` is true, property \`p1\` must also be true, starting evaluation in the next clock cycle after \`s1\` ends).
    -   Can use operators like \`not\`, \`and\`, \`or\`, \`if/else\`.
    -   Can be disabled with \`disable iff (condition)\`.
-   **Assertion Directives:** Tell the tool what to do with a property:
    -   \`assert property (@(posedge clk) my_prop);\` : Check \`my_prop\` on every positive clock edge. If it fails, report an error.
    -   \`assume property (@(posedge clk) my_prop);\` : Assume \`my_prop\` is true. Used by formal verification tools as constraints.
    -   \`cover property (@(posedge clk) my_prop);\` : Monitor \`my_prop\` and collect coverage data when it passes. Does not report an error on failure (though the property itself might fail internally).
    -   \`restrict property (@(posedge clk) my_prop);\` : Used by formal tools to constrain inputs for liveness properties.

-   **Immediate Assertions:** Check a boolean expression at a specific point in procedural code (not temporal).
    -   \`assert (condition) else $error("Message");\`
    -   Execute like any other procedural statement.

-   **Concurrent Assertions:** The more powerful type, evaluated concurrently with the design based on clock edges. These are the ones using sequences and properties. They are typically placed in modules, interfaces, or program blocks.

-   **Clocking Event:** Concurrent assertions are almost always tied to a clocking event (e.g., \`@(posedge clk)\`).

-   **Local Variables:** Sequences and properties can declare local variables to store values captured at one point in a sequence for use later in that sequence or property.
    -   \`(seq_expr, local_var = value_expr) #1 (another_expr && local_var == some_value)\`

-   **Severity System Tasks:** Control error reporting: \`$fatal\`, \`$error\`, \`$warning\`, \`$info\`.
`,
      codeExamples: [
        {
          description: "Simple Concurrent Assertion: Acknowledgment must follow a request within 1 to 3 cycles.",
          code:
`module req_ack_check (
  input logic clk,
  input logic rst_n,
  input logic req,
  input logic ack
);

  property p_ack_follows_req;
    @(posedge clk) disable iff (!rst_n) // Disable property during reset
      req |-> ##[1:3] ack; // If req is high, ack must be high 1 to 3 cycles later
  endproperty

  ap_ack_follows_req: assert property (p_ack_follows_req)
    else $error("SVA Error: Ack did not follow Req within 1-3 cycles.");

endmodule`
        },
        {
          description: "Sequence and Property for a bus protocol: Grant only if request was high in the previous cycle.",
          code:
`module bus_protocol_check (
  input logic clk,
  input logic rst_n,
  input logic req,
  input logic gnt
);

  sequence s_req_prev_cycle;
    // True if req was high, and then one cycle passed.
    // We are interested in the state of 'req' at the point 'gnt' is checked.
    // A better way to capture req is using local variables.
    req ##1 !req; // Example: req then not req (can be more complex)
  endsequence

  // A more robust way with local variable:
  property p_gnt_if_req_prev;
    logic prev_req_val;
    @(posedge clk) disable iff (!rst_n)
      (1, prev_req_val = req) ##1 (gnt |-> prev_req_val);
      // At any cycle (1), capture req into prev_req_val.
      // Then, one cycle later (##1), if gnt is asserted,
      // prev_req_val (which is req from the previous cycle) must have been true.
  endproperty

  ap_gnt_rule: assert property (p_gnt_if_req_prev)
    else $error("SVA Error: Grant asserted without request in previous cycle.");

endmodule`
        },
        {
          description: "Cover Property: Check if a full handshake (req -> ack) ever occurs.",
          code:
`module handshake_coverage (
  input logic clk,
  input logic rst_n,
  input logic req,
  input logic ack
);

  property p_handshake_occurs;
    @(posedge clk) disable iff (!rst_n)
      req ##1 ack; // A simple sequence: req followed by ack on the next cycle
  endproperty

  cp_handshake: cover property (p_handshake_occurs)
    $info("SVA Cover: req->ack handshake occurred.");

endmodule`
        },
        {
          description: "Immediate Assertion in procedural code:",
          code:
`module immediate_assert_example;
  initial begin
    int data = 5;
    int max_val = 10;

    // ... some operations ...
    data = data * 3; // data becomes 15

    // Immediate assertion to check data is within bounds
    assert (data <= max_val) else begin
      $error("Immediate Assert Failed: data (%0d) exceeds max_val (%0d)", data, max_val);
    end
    // This will trigger the $error message.
    #10 $finish;
  end
endmodule`
        }
      ],
      visualizations: [
        { description: "Timeline diagram showing a sequence (req ##[1:3] ack) with passing and failing scenarios.", altText: "SVA Sequence Timeline" },
        { description: "Block diagram showing how SVA fits into Simulation, Formal Verification, and Emulation/FPGA.", altText: "SVA in Verification Flow" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Liveness vs. Safety Properties:** Safety properties state that "something bad should never happen" (e.g., \`never gnt && !req\`). Liveness properties state that "something good must eventually happen" (e.g., \`req |-> s_eventually ack\`). Liveness is harder to verify in simulation (when is "eventually"?) and is often a focus for formal verification.
      - **Multiple Clock Support:** Assertions can handle multiple clocks, but it requires careful clock domain specification.
      - **Assertions in Interfaces:** Very common for defining protocol rules directly within the interface that carries the protocol signals.
      - **Formal Verification Specifics:** \`assume\` is critical for constraining formal tools. \`restrict\` is used for liveness. Formal tools explore all possible states, so well-written assertions are key to meaningful results.
      - **Action Blocks:** Besides \`else $error\`, assertion directives can have pass action blocks too (e.g., \`assert property (p) $info("P passed"); else $error("P failed");\`).
      - **System Functions in SVA:** \`$rose(sig)\`, \`$fell(sig)\`, \`$stable(sig)\`, \`$past(sig, N)\`, \`$isunknown()\`, \`$countones()\` are very useful within assertion expressions.
      - **Recursion in Properties/Sequences:** Possible but use with care to avoid infinite loops or excessive complexity.
      - **Debugging Assertion Failures:** Simulators provide waveform debugging that highlights the sequence leading to an assertion failure. Understanding the sequence evaluation (threads/attempts) is crucial.
      Common Bugs:
      - Off-by-one errors in cycle delays (\`##N\`).
      - Incorrect implication operator (\`|->\` vs \`|=>\`).
      - Overly complex sequences that are hard to debug or have poor simulation performance.
      - Forgetting \`disable iff\` for reset conditions, leading to spurious failures at time 0.
      - Incorrectly specified clocking event.`,
      experienceView: `A senior engineer considers SVA a cornerstone of modern verification.
      - **Design Intent Capture:** They write assertions concurrently with RTL design or from a specification to capture critical design intent and interface protocols.
      - **Shift-Left Verification:** Assertions help find bugs earlier in the design process, often directly by the RTL designer.
      - **Formal-Friendly Assertions:** They write assertions with formal verification in mind, even if only simulation is used initially. This means clear, concise properties.
      - **Assertion Density & Quality:** Strive for good assertion coverage of critical properties rather than just a high quantity of trivial assertions.
      - **Integration with Test Plan:** Assertion results (pass/fail/covered) are often tied back to the verification plan items. Coverage of assertions (\`cover property\`) is a key metric.
      - **Performance:** Very complex or numerous assertions can impact simulation speed. They might be profiled or selectively enabled.
      In code reviews: "Is this property correctly capturing the spec requirement?", "Is the clocking event correct?", "Is the \`disable iff\` condition appropriate?", "Could this sequence be simplified?", "Is this assertion better for simulation or formal (or both)?", "What does a failure of this assertion imply about the design?". They look for clarity, correctness, and completeness of the assertions.`,
      retentionTip: "SVA: **S**pecify **V**erification **A**utomatically. Think of it as: **WHEN** (clock event) **IF** (antecedent sequence) **THEN** (consequent property/sequence must hold). The core is building temporal 'IF-THEN' rules for your signals."
    }
  };

  return <TopicPage {...pageContent} />;
}
