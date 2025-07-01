import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function FunctionalCoverageTopicPage() {
  const pageContent = {
    title: "SystemVerilog Functional Coverage",
    elevatorPitch: {
      definition: "Functional coverage in SystemVerilog is a user-defined metric that measures how thoroughly the *functionality* of a Design Under Test (DUT) has been exercised by a testbench, according to a verification plan. It involves defining specific features, data values, and combinations of conditions (coverpoints, crosses) that need to be observed during simulation.",
      analogy: "Think of functional coverage like a 'feature checklist' for testing a new smartphone. Code coverage might tell you if all lines of software code *ran*, but functional coverage tells you if you've actually tested specific features like 'making a call with Wi-Fi calling enabled,' 'taking a panoramic photo,' 'pairing with Bluetooth headphones AND playing music,' or 'sending an emoji in a text message.' You define what features and scenarios matter, and functional coverage tracks if your tests hit them.",
      why: "Functional coverage exists because simply executing all lines of code (code coverage) doesn't guarantee all design *functionality* has been tested. A complex conditional statement might be executed, but were all its important branches and input combinations tested? Functional coverage answers: 'Have I exercised all the specified features and corner cases of my design as outlined in the verification plan?' It's a primary metric for verification completeness and helps guide the test writing process to fill coverage holes, ultimately ensuring higher confidence in the design's correctness."
    },
    practicalExplanation: {
      coreMechanics: `The core construct for functional coverage in SystemVerilog is the \`covergroup\`.
-   **\`covergroup <name> [(arguments)] @(event);\`**:
    -   A \`covergroup\` is a user-defined type that encapsulates a set of coverage points related to a specific functionality or interface.
    -   It can take arguments, often class handles or interface signals, to access the values to be covered.
    -   It's typically sampled based on an event (e.g., \`@(posedge clk)\`, \`@(my_interface.cb)\`, or a named event). Alternatively, the \`.sample()\` method can be called procedurally.

-   **\`coverpoint <name>: coverpoint <expression> [iff (condition)] { bins ... }\`**:
    -   Defines a specific item to be covered, usually a variable or an expression.
    -   \`iff (condition)\`: Optionally samples the coverpoint only when the condition is true.
    -   **Bins:** Define the distinct values or ranges of values for the expression that constitute coverage.
        -   \`bins low = {[0:10]};\` (Values from 0 to 10)
        -   \`bins specific_vals[] = {1, 3, 5};\` (Array of bins for individual values)
        -   \`bins others = default;\` (Catches all values not covered by other bins)
        -   \`bins transition_bin = (1 => 2, 3 => 4);\` (Value transitions)
        -   \`wildcard bins wc_bin = {3'b1x0};\` (Using X and Z as wildcards)
        -   \`ignore_bins ignore_this = {0};\` (Values to exclude from coverage calculation)
        -   \`illegal_bins error_val = {15};\` (Values that, if hit, should flag an error)

-   **\`cross <name>: cross <coverpoint1_name>, <coverpoint2_name> [, ... ] [iff (condition)] { bins ... }\`**:
    -   Defines coverage for combinations of values across multiple coverpoints. This is crucial for testing interactions between different features or parameters.
    -   Bins for crosses can be explicitly defined or automatically generated.
    -   \`ignore_bins\`, \`illegal_bins\` can also be used with crosses.
    -   Example: \`cross op_type, data_size;\` will create bins for all combinations of \`op_type\` bins and \`data_size\` bins.

-   **Coverage Options (\`option.<member> = value;\`):**
    -   Control aspects like naming, comments, goal percentage, weighting per bin.
    -   \`option.per_instance = 1;\`: If the covergroup is defined in a class, each instance of the class will have its own coverage statistics.
    -   \`option.goal = 90;\`: Sets the desired coverage percentage for this group.
    -   \`option.comment = "Coverage for packet types";\`

-   **Procedural Sampling (\`.sample()\`)**:
    -   Instead of or in addition to event-based sampling, a covergroup's \`.sample()\` method can be called from procedural code (e.g., in a monitor class when a transaction is observed).

-   **Coverage Database & Reporting:**
    -   Simulators collect coverage data into a database (e.g., UCDB - Unified Coverage Database).
    -   Reporting tools then process this database to generate human-readable reports showing percentages, hit bins, missed bins, etc. This helps identify "coverage holes."

-   **Instantiation:** A \`covergroup\` is a type; it must be instantiated (e.g., \`my_cg_type cg_inst = new();\`). If defined within a class, it's typically instantiated in the class constructor.
`,
      codeExamples: [
        {
          description: "Covergroup for a simple packet type and length:",
          code:
`class packet_monitor;
  // Assume 'pkt' is a transaction object available in this class
  // with members 'type' (an enum) and 'length' (an int)
  typedef enum {READ, WRITE, IDLE} pkt_type_e;
  transaction pkt; // This would be passed or set

  covergroup packet_cg @(posedge clk) iff (pkt_received_event); // Sample on clk if event triggered
    // Coverpoint for packet type
    cp_type: coverpoint pkt.type {
      bins read_type  = {READ};
      bins write_type = {WRITE};
      bins idle_type  = {IDLE};
      // No 'others' bin here means we only care about these defined types
    }

    // Coverpoint for packet length
    cp_length: coverpoint pkt.length {
      bins small = {[1:63]};
      bins medium = {[64:511]};
      bins large = {[512:1500]};
      bins jumbo = {[1501:$]}; // $ means max value
      bins zero_len = {0};
      illegal_bins negative_len = {[-\$:-1]}; // Negative length is illegal
    }

    // Cross coverage for type and length
    cross_type_length: cross cp_type, cp_length {
      // Example of ignoring specific cross products
      ignore_bins no_idle_data = binsof(cp_type.idle_type) && !binsof(cp_length.zero_len);
      // (If type is IDLE, length must be zero, so ignore IDLE with non-zero length)
    }

    option.per_instance = 1;
    option.goal = 100;
  endgroup

  // Constructor
  function new();
    // Instantiate the covergroup if it's not event-based or needs arguments
    // If event-based and no args, it's implicitly constructed.
    // If it takes arguments, they are passed here:
    // packet_cg_inst = new(pkt_to_monitor);
    // For this example, assuming pkt_received_event and pkt are handled externally for sampling
    // Or, if using procedural sampling:
    packet_cg_inst = new();
  endfunction

  // Method to be called to sample coverage (if not purely event-based)
  task sample_coverage(transaction current_pkt);
    this.pkt = current_pkt; // Make current_pkt available for covergroup expressions
    // If not event-triggered, or to force sampling:
    // packet_cg_inst.sample();
    // If event-triggered, just ensure pkt is up-to-date before the event.
  endtask

  // Placeholder for where sampling happens
  logic pkt_received_event; // This would be triggered by actual packet reception
  logic clk; // Clock signal
  packet_monitor mon;

  // Example usage snippet (would be in a testbench)
  initial begin
    clk = 0; forever #5 clk = ~clk;
    mon = new();
    // ...
    // Simulate receiving a packet:
    // transaction tx = new_packet(type=READ, length=32);
    // mon.pkt = tx; // Ensure 'pkt' in monitor is set
    // pkt_received_event = 1; @(posedge clk); pkt_received_event = 0; // Trigger sampling
    // ... or ...
    // mon.sample_coverage(tx); // If using procedural sample
  end

endclass`
        },
        {
          description: "Coverpoint with transitions and wildcard bins:",
          code:
`module state_machine_coverage (input logic clk, input state_enum current_state, input logic err_code [2:0]);

  typedef enum {S_IDLE, S_FETCH, S_DECODE, S_EXEC} state_enum;

  covergroup sm_cov @(posedge clk);
    cp_state_transitions: coverpoint current_state {
      bins idle_to_fetch = (S_IDLE => S_FETCH);
      bins fetch_to_decode = (S_FETCH => S_DECODE);
      bins decode_to_execute = (S_DECODE => S_EXEC);
      bins execute_to_idle = (S_EXEC => S_IDLE);
      bins any_to_idle = (S_FETCH => S_IDLE, S_DECODE => S_IDLE, S_EXEC => S_IDLE);
    }

    cp_error_codes: coverpoint err_code {
      wildcard bins parity_errors = {3'b1x0}; // Covers 100, 110
      bins timeout_error = {3'b011};
      bins others_default;
    }
  endgroup

  // Instantiate the covergroup
  sm_cov sm_cg_inst = new();

endmodule`
        }
      ],
      visualizations: [
        { description: "Flowchart of the Functional Coverage Closure Loop (Plan, Stimulate, Measure, Analyze, Refine).", altText: "Functional Coverage Closure Loop" },
        { description: "Example of a coverage report snippet showing hit and missed bins.", altText: "Coverage Report Snippet" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Coverage Closure:** This is an iterative process. 1. Run regressions. 2. Merge coverage databases. 3. Analyze reports for holes. 4. Determine if a hole is due to a bug in DUT/testbench, missing stimulus, or an unreachable/irrelevant scenario (then waive it). 5. Write new tests or refine constraints to hit the holes. Repeat until coverage goals are met.
      - **Weighting Bins (\`option.weight\`):** Important bins can be given higher weight, so hitting them contributes more to the overall percentage.
      - **Coverage Goals (\`option.goal\`):** Typically set to 100%, but sometimes less for non-critical items or known unreachable bins.
      - **Instance vs. Type Coverage:** \`option.per_instance\` determines if coverage is collected per instance of the class containing the covergroup or aggregated across all instances (type coverage).
      - **Procedural Control of Coverage:** \`.start()\`, \`.stop()\` methods can enable/disable coverage collection for a covergroup instance. \`get_coverage()\`, \`get_inst_coverage()\` can query coverage percentage procedurally.
      - **Covering Transitions on Multiple Variables:** \`coverpoint tr_var { bins b = (A => B) with (tr_var_extra == X); }\`
      - **Using functions in coverpoint expressions:** \`coverpoint my_func(var1, var2)\` - the function return value is covered.
      - **Merging Coverage Databases:** Tools allow merging results from multiple simulation runs to get an aggregate view.
      - **Waivers:** Justifying and documenting why certain coverage bins will not be hit (e.g., architecturally impossible scenarios).
      Common Pitfalls:
      - Poorly defined bins that don't accurately reflect the verification plan.
      - Forgetting to sample the covergroup or incorrect sampling event/condition.
      - "Over-coverage": Defining too many trivial or irrelevant coverpoints/crosses, making reports noisy and closure difficult.
      - Misinterpreting coverage reports (e.g., 100% coverage doesn't mean bug-free, only that defined items were hit).
      - Not regularly reviewing and refining the coverage model as design/verification plan evolves.`,
      experienceView: `A senior engineer sees functional coverage as the primary quantitative measure of verification progress against the functional specification.
      - **Plan-Driven:** Functional coverage points are derived directly from the verification plan, which itself is derived from the design specification.
      - **Quality of Coverage:** Focus is not just on hitting 100%, but on the quality and relevance of the covered items. Are the most critical functionalities and corner cases represented?
      - **Collaboration:** Functional coverage definitions are often reviewed by design engineers to ensure they accurately reflect design intent and important scenarios.
      - **Automation:** Scripts are used to merge coverage data from regressions and generate reports.
      - **Coverage-Driven Stimulus:** Advanced techniques use coverage feedback to guide constrained-random generation towards unhit coverage regions.
      - **Debugging Holes:** Analyzing coverage holes is a significant debug task. Is it a stimulus problem, a DUT bug preventing the condition, or an issue with the coverage definition itself?
      In code reviews of coverage models: "Does this covergroup align with the verification plan items?", "Are the bins meaningful and comprehensive for this feature?", "Are there important cross-interactions missing?", "Is the sampling event/condition correct and robust?", "Are there any illegal or ignore bins that simplify analysis?". They emphasize clarity, relevance, and completeness of the coverage model.`,
      retentionTip: "Functional Coverage = Answering 'Did I **DO** that?' for your DUT's features. **DO**: **D**efine what matters (covergroups, coverpoints, crosses). **O**bserve during tests (sampling). If you didn't define it, you can't measure it. If you didn't measure it, you don't know if you tested it."
    }
  };

  return <TopicPage {...pageContent} />;
}
