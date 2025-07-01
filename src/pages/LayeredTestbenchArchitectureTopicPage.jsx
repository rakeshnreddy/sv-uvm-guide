import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function LayeredTestbenchArchitectureTopicPage() {
  const pageContent = {
    title: "UVM Layered Testbench Architecture",
    elevatorPitch: {
      definition: "A UVM layered testbench architecture organizes verification components into hierarchical layers, promoting modularity, reusability, and separation of concerns. Typically, this involves a signal/physical layer (driver/monitor interacting with DUT), a transaction/functional layer (sequences, sequencers operating on abstract data), a checking layer (scoreboards), and a test control layer (test case selecting stimulus and configuring the environment).",
      analogy: "Think of a UVM layered architecture like a well-organized restaurant kitchen. \n- **Signal Layer (Driver/Monitor):** The 'Line Cooks' who directly handle the food (signals) on the grill (DUT interface). The Driver puts food on, the Monitor watches what comes off.\n- **Transaction Layer (Sequencer/Sequences):** The 'Sous Chefs' who prepare ingredients and create dish components (transactions) based on recipes (sequences). They don't cook directly but pass prepared items to the line cooks.\n- **Checking Layer (Scoreboard):** The 'Expediter/Quality Control' who checks if the final dish (DUT output) matches the order (expected results based on input transactions).\n- **Environment Layer:** The 'Kitchen Manager' who oversees all sections and ensures they work together.\n- **Test Layer:** The 'Head Chef' who decides the menu for the day (specific test scenario), telling the Sous Chefs what dishes (sequences) to prepare and any special instructions (configurations).",
      why: "Layered architecture is essential for managing the complexity of modern verification. It allows different aspects of the testbench (e.g., driving pins vs. generating abstract stimulus vs. checking data) to be developed and maintained independently. This separation leads to: \n1.  **Reusability:** Protocol-specific agents (driver, monitor, sequencer for an interface like APB or AXI) can be reused across different DUTs. \n2.  **Scalability:** Easier to add new interfaces or features without disrupting the entire testbench. \n3.  **Maintainability:** Changes to one layer (e.g., DUT interface timing) have minimal impact on other layers (e.g., stimulus generation logic). \n4.  **Abstraction:** Enables writing tests at a higher level (e.g., 'send these types of packets') without worrying about pin-level details."
    },
    practicalExplanation: {
      coreMechanics: `A standard UVM environment is highly structured, typically comprising several key component layers:

**1. Test Case Layer (\`uvm_test\`):**
   - The top-level component that orchestrates a specific test scenario.
   - **Responsibilities:**
     - Instantiates the top-level environment (\`uvm_env\`).
     - Configures the environment and its sub-components using \`uvm_config_db\` or by setting parameters.
     - Selects and starts the main stimulus (sequences) on the appropriate sequencers within the environment.
     - May contain test-specific checks or overrides.
   - Each test (\`my_error_test extends base_test\`) defines a unique scenario.

**2. Environment Layer (\`uvm_env\`):**
   - A container component that instantiates and coordinates one or more agents, scoreboards, and potentially other environment-level components like virtual sequencers or reference models.
   - **Responsibilities:**
     - Instantiate protocol-specific agents (\`uvm_agent\`) for each interface of the DUT.
     - Instantiate scoreboards (\`uvm_scoreboard\`) for end-to-end checking.
     - Instantiate coverage collectors.
     - Make TLM connections between agents' analysis ports and scoreboards/coverage collectors.
     - May contain a virtual sequencer to coordinate stimulus across multiple agents.

**3. Agent Layer (\`uvm_agent\`):**
   - Encapsulates all components needed to manage a specific interface protocol (e.g., APB agent, AXI agent).
   - Can be configured as an **active** agent (generates stimulus and monitors) or a **passive** agent (only monitors). This is controlled by its \`is_active\` property (an enum \`UVM_ACTIVE\` or \`UVM_PASSIVE\`).
   - **Typical components within an agent:**
     - **Sequencer (\`uvm_sequencer # (REQ, RSP)\`):**
       - Part of an active agent.
       - Arbitrates between multiple sequences and sends transactions (REQ items) to the driver.
       - May receive responses (RSP items) from the driver.
     - **Driver (\`uvm_driver # (REQ, RSP)\`):**
       - Part of an active agent.
       - Receives transactions from the sequencer.
       - Drives these transactions onto the DUT's physical interface signals (via a virtual interface).
       - May collect responses from the DUT and send them back to the sequencer.
     - **Monitor (\`uvm_monitor\`):**
       - Present in both active and passive agents.
       - Passively observes DUT interface signals (via a virtual interface).
       - Converts observed signal activity back into transactions.
       - Broadcasts these transactions via one or more analysis ports (\`uvm_analysis_port\`) to components like scoreboards and coverage collectors.
   - An agent often has an agent-specific configuration object.

**4. Transaction Layer (Sequences & Sequence Items):**
   - **Sequence Item / Transaction (\`uvm_sequence_item\`):** An object (\`uvm_object\`) that represents an abstract data item or operation related to a specific protocol (e.g., a bus read/write, a network packet). Contains properties (address, data, type, etc.) and can be randomized with constraints.
   - **Sequence (\`uvm_sequence # (REQ, RSP)\`):** An object (\`uvm_object\`) that generates a series of sequence items (transactions) and sends them to a sequencer.
     - Contains a \`body()\` task where the stimulus generation logic resides.
     - Uses macros like \`\`uvm_do\`, \`\`uvm_do_with\`, \`\`uvm_create\`, \`\`uvm_send\` to interact with the sequencer.
     - Can be hierarchical (sequences calling other sub-sequences).

**5. Signal/Physical Layer (Interface & DUT):**
   - **Virtual Interface (\`virtual <interface_name>\`):** A SystemVerilog construct used by drivers and monitors (which are classes) to access the physical interface signals of the DUT. The actual interface instance resides in the static module top-level. Handles to these virtual interfaces are passed to drivers/monitors via \`uvm_config_db\`.
   - **DUT (Design Under Test):** The actual hardware design being verified.

**6. Checking Layer (Scoreboards & Coverage Collectors):**
   - **Scoreboard (\`uvm_scoreboard\`):**
     - Receives transactions from one or more monitors (e.g., input agent monitor, output agent monitor).
     - Compares actual DUT behavior against expected behavior (which might come from a reference model, input transactions, or predefined rules).
     - Reports discrepancies.
   - **Coverage Collector / Subscriber (\`uvm_subscriber\`):**
     - Receives transactions from monitors.
     - Contains \`covergroup\`s to sample these transactions and collect functional coverage data.

This layered approach ensures that each component has a well-defined role and interacts with other components through standardized interfaces (TLM ports, virtual interfaces).
`,
      codeExamples: [
        {
          description: "High-level structure of a UVM test, environment, and agent:",
          code:
`// --- test_lib.sv ---
class base_test extends uvm_test;
  my_env env_h;
  // ... uvm_component_utils, new ...
  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env_h = my_env::type_id::create("env_h", this);
    // Configure env_h and its sub-components via uvm_config_db
  endfunction
  // run_phase would start sequences on env_h's sequencers
endclass

class test1 extends base_test;
  \`uvm_component_utils(test1)
  function new(string name="test1", uvm_component parent=null); super.new(name,parent); endfunction
  virtual task run_phase(uvm_phase phase);
    // Start specific sequences for test1
    my_sequence seq = my_sequence::type_id::create("seq");
    phase.raise_objection(this);
    seq.start(env_h.agent_h.sequencer_h); // Assuming path to sequencer
    phase.drop_objection(this);
  endtask
endclass

// --- env_pkg.sv ---
class my_env extends uvm_env;
  my_agent agent_h;
  my_scoreboard scb_h;
  // ... uvm_component_utils, new ...
  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    agent_h = my_agent::type_id::create("agent_h", this);
    scb_h   = my_scoreboard::type_id::create("scb_h", this);
  endfunction
  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    // Connect agent's analysis port to scoreboard's analysis export
    agent_h.monitor_h.item_collected_port.connect(scb_h.actual_item_export);
  endfunction
endclass

// --- agent_pkg.sv ---
class my_agent extends uvm_agent;
  my_driver driver_h;
  my_monitor monitor_h;
  uvm_sequencer #(my_transaction) sequencer_h; // Typed for my_transaction
  // ... uvm_component_utils, new, is_active check ...
  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    monitor_h = my_monitor::type_id::create("monitor_h", this);
    if (is_active == UVM_ACTIVE) {
      driver_h    = my_driver::type_id::create("driver_h", this);
      sequencer_h = uvm_sequencer#(my_transaction)::type_id::create("sequencer_h", this);
    }
  endfunction
  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    if (is_active == UVM_ACTIVE) {
      driver_h.seq_item_port.connect(sequencer_h.seq_item_export);
    }
  endfunction
endclass

// --- sequence_lib.sv ---
class my_sequence extends uvm_sequence #(my_transaction);
  // ... uvm_object_utils, new ...
  virtual task body();
    my_transaction req_pkt;
    repeat(5) begin
      req_pkt = my_transaction::type_id::create("req_pkt");
      start_item(req_pkt); // Request sequencer access
      assert(req_pkt.randomize());
      finish_item(req_pkt); // Send to driver, wait for item_done
      // \`uvm_do(req_pkt) or \`uvm_do_with(req_pkt, {constraints}) are common shortcuts
    end
  endtask
endclass

// Other classes (my_transaction, my_driver, my_monitor, my_scoreboard) would be defined elsewhere.
// Top module would use run_test("test1");`
        },
        {
          description: "Conceptual data flow through layers for a stimulus item:",
          code:
`// 1. Test (run_phase):
//    my_seq.start(env.agent.sequencer);
//
// 2. Sequence (body() task):
//    \`uvm_do_with(req_item, { req_item.addr == 'h10; });
//      |
//      V
// 3. Sequencer (uvm_sequencer):
//    - Arbitrates, sends req_item to Driver via TLM port (seq_item_export)
//      |
//      V
// 4. Driver (uvm_driver):
//    - Receives req_item (e.g., via seq_item_port.get_next_item())
//    - Translates req_item fields to pin wiggles on virtual interface
//    - Drives DUT signals (e.g., vif.cb.addr <= req_item.addr;)
//      |
//      V
// 5. Interface (SystemVerilog Interface):
//    - Physical pins connected to DUT
//      |
//      V
// 6. DUT:
//    - Reacts to driven signals
//      |
//      V (DUT output signals)
// 7. Interface (SystemVerilog Interface):
//    - DUT output signals change
//      |
//      V
// 8. Monitor (uvm_monitor):
//    - Observes interface signals (via virtual interface)
//    - Reconstructs an observed_item (transaction) from pin activity
//    - Broadcasts observed_item via analysis_port (e.g., item_collected_port.write(observed_item))
//      |
//      V
// 9. Scoreboard (uvm_scoreboard):
//    - Receives observed_item via its analysis_export
//    - Compares with expected data (from reference model or input item)
//    - Reports pass/fail
//
// 10. Coverage Collector (uvm_subscriber):
//    - Also receives observed_item via its analysis_export
//    - Samples item fields into covergroups`
        }
      ],
      visualizations: [
        { description: "Standard UVM Testbench Block Diagram showing Test, Env, Agent (Seqr, Drv, Mon), Scoreboard, and DUT with Interface connections.", altText: "UVM Testbench Block Diagram" },
        { description: "Diagram illustrating the 'stimulus pipe' from Sequence -> Sequencer -> Driver -> DUT, and the 'feedback pipe' from DUT -> Monitor -> Scoreboard.", altText: "UVM Stimulus and Feedback Flow" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Virtual Sequencers:** Used to coordinate stimulus across multiple agents/interfaces. A virtual sequence runs on a virtual sequencer and contains handles to the actual sequencers of different agents. It starts sub-sequences on these agent-specific sequencers.
      - **Layered Agents:** An agent itself might be layered, containing sub-agents for different sub-protocols or functionalities within a complex interface.
      - **Reference Models:** Often included in the environment layer. They mimic DUT behavior (usually at a higher abstraction level) to predict expected outputs for the scoreboard.
      - **Passive vs. Active Mode:** Agents can be configured to be \`UVM_PASSIVE\` (only monitor, no driver/sequencer created) or \`UVM_ACTIVE\` (full stimulus generation and monitoring). This allows reusing the same agent in different contexts (e.g., block-level active testing vs. system-level passive monitoring).
      - **Configuration Space:** The \`uvm_config_db\` is heavily used to pass configurations (virtual interface handles, agent active/passive mode, scoreboard parameters, etc.) down the hierarchy from the test to the specific components.
      - **Abstraction Levels:** Different layers operate at different levels of abstraction. Sequences deal with abstract transactions. Drivers deal with timed pin wiggles. This separation is key.
      - **End-to-End Phasing:** All components from test to driver/monitor participate in UVM phasing, ensuring orderly build, connect, run, and cleanup.
      Common Pitfalls:
      - Incorrect TLM connections (e.g., port/export mismatches, forgetting to connect).
      - Issues with \`uvm_config_db\` set/get paths or type mismatches, leading to components not being configured correctly.
      - Virtual interface handles not being passed down correctly, resulting in null interface errors in drivers/monitors.
      - Overly monolithic components that don't adhere to the layering principle, reducing reusability.
      - Forgetting to raise/drop objections in run_phase, leading to premature test termination or hangs.`,
      experienceView: `A senior UVM engineer deeply appreciates the layered architecture for its power in organizing complexity.
      - **Design for Reuse:** They build agents and environments with reuse as a primary goal. This means generic agents parameterized by configuration objects and clear TLM interfaces.
      - **Separation of Concerns:** Strict adherence to keeping protocol-specific logic within agents, stimulus generation within sequences, and checking within scoreboards.
      - **Scalability:** The architecture allows them to scale from verifying small IP blocks to large SoCs by instantiating and connecting multiple reusable agents and environments.
      - **Debugging:** The layered structure aids debugging. If there's a protocol violation, the issue is likely in the driver or DUT interface. If data is wrong, it could be the sequencer, DUT logic, or scoreboard.
      - **Team Collaboration:** Different engineers can work on different layers or agents simultaneously with well-defined interfaces between them.
      In code reviews: "Does this component fit its intended layer and responsibility?", "Are TLM connections correct and complete?", "Is configuration being handled cleanly via config_db?", "Is this agent designed to be reusable (active/passive modes, configurable)?", "How does this layer interact with the layers above and below it?". They emphasize clear boundaries and standardized communication between layers.`,
      retentionTip: "UVM Layers: Imagine building a skyscraper. **Test** = Architect's Master Plan. **Env** = General Contractor. **Agent** = Specialized Sub-Contractor (e.g., 'Plumbing Agent,' 'Electrical Agent'). Each Agent has its **Sequencer** (Foreman planning tasks), **Driver** (Worker installing pipes/wires), **Monitor** (Inspector checking installations). **Scoreboard** = Chief Inspector verifying overall system. Each layer depends on the one below but focuses on its own job."
    }
  };

  return <TopicPage {...pageContent} />;
}
