import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function UVMSequencesAndSequencerHandshakeTopicPage() {
  const pageContent = {
    title: "UVM Sequences & Sequencer Handshake",
    elevatorPitch: {
      definition: "UVM Sequences are class-based objects (\`uvm_sequence\`) that generate streams of transaction data (\`uvm_sequence_item\`s) to stimulate the DUT. The Sequencer (\`uvm_sequencer\`) is a component that arbitrates between multiple sequences, selects transactions, and forwards them to a Driver. The 'Sequencer-Driver Handshake' is the standardized TLM-based protocol they use for this communication.",
      analogy: "Think of a **Sequence** as a 'Recipe' for a series of dishes (transactions). A **Sequencer** is like a 'Head Chef' in a busy kitchen who has multiple cooks (sequences) submitting dish orders. The Head Chef decides which dish to prepare next (arbitration) and hands the specific order (transaction) to the 'Line Cook' (Driver). The **Handshake** is the process: \n1. Cook (Sequence) says, 'I have a dish ready!' (\`start_item\`). \n2. Head Chef (Sequencer) says, 'Okay, you're next, give me the details.' (grants access). \n3. Cook provides the dish details (randomizes item, \`finish_item\`). \n4. Line Cook (Driver) gets the order (\`get_next_item\`), prepares it, and when done, says 'Dish served!' (\`item_done\`), signaling the Head Chef and original Cook that they can proceed with the next part of the recipe.",
      why: "Sequences provide a powerful and flexible way to define complex stimulus scenarios, separate from the driver's DUT-specific pin-wiggling logic. This abstraction allows stimulus to be reusable and easily modified or extended (e.g., through inheritance or layering). The Sequencer manages concurrent sequence execution and ensures orderly transaction flow. The standardized handshake decouples sequences and drivers, meaning a driver doesn't need to know which sequence generated a transaction, and a sequence doesn't need to know driver internals."
    },
    practicalExplanation: {
      coreMechanics: `
**1. Sequence Item (\`uvm_sequence_item\` or user-defined derived class):**
   - Represents a single transaction (e.g., a bus read/write, a network packet).
   - Derived from \`uvm_object\`.
   - Contains data fields (e.g., address, data, kind), often declared as \`rand\` for constrained randomization.
   - Typically registered with the factory using \`\`uvm_object_utils\`.

**2. Sequence (\`uvm_sequence #(REQ = uvm_sequence_item, RSP = REQ)\`):**
   - Derived from \`uvm_object\`.
   - Its primary role is to generate REQ (request) type transactions and optionally receive RSP (response) type transactions.
   - The core logic is in its virtual \`task body();\` method.
   - **Starting a Sequence:** A sequence is started on a sequencer, usually from a test case or a parent sequence.
     - \`my_seq_h.start(sequencer_handle, parent_sequence_handle, priority, call_pre_post_body);\`
   - **Pointer to Sequencer (\`p_sequencer\`):** When a sequence is running, its \`p_sequencer\` handle is automatically set to point to the sequencer it's running on. This typed handle allows the sequence to access sequencer properties or other testbench components if needed (though direct access outside the sequencer is often discouraged for strict layering).

**3. Sequencer (\`uvm_sequencer #(REQ = uvm_sequence_item, RSP = REQ)\`):**
   - Derived from \`uvm_component\`.
   - Acts as an arbiter if multiple sequences are trying to send transactions simultaneously. Common arbitration algorithms include FIFO, weighted, strict_random.
   - Has a TLM export (\`seq_item_export\`) to which a driver's TLM port connects. This is the channel for sending REQ items to the driver.
   - Can also have a TLM analysis port to broadcast transactions it processes.

**4. Driver (\`uvm_driver #(REQ = uvm_sequence_item, RSP = REQ)\`):**
   - Derived from \`uvm_component\`.
   - Has a TLM port (\`seq_item_port\`) to connect to the sequencer's export.

**The Sequencer-Driver Handshake (using \`uvm_seq_item_pull_port\` on Driver):**

   **From the Sequence's perspective (inside \`body()\` task):**
   - **\`REQ req_item = REQ::type_id::create("req_item");\`**: Create a transaction object (often using the factory).
   - **\`start_item(req_item, priority);\`**:
     - Signals intent to send \`req_item\` to the sequencer.
     - Blocks until the sequencer grants access (arbitration).
     - Once granted, \`req_item\` is available to be randomized or modified.
   - **\`assert(req_item.randomize() with { constraints });\`**: Randomize the transaction (optional, but common).
   - **\`finish_item(req_item, end_req_priority);\`**:
     - Sends the (now finalized) \`req_item\` to the driver via the sequencer.
     - Blocks until the driver calls \`item_done()\`.
     - The driver might have modified \`req_item\` if it's a bidirectional transaction, or a separate response item might be involved.
   - **Getting a Response (if driver sends one):**
     - \`get_response(rsp_item, transaction_id);\` (if \`req_item.set_id_info()\` was used) or simply \`get_response(rsp_item);\` if responses are in order. This blocks until the driver calls \`item_done(rsp_item_from_driver)\`.

   **Simplified Macros (common usage):**
   - **\`\`uvm_do(SEQ_OR_ITEM)\`**: Shortcut for \`create\`, \`start_item\`, \`randomize\`, \`finish_item\`.
   - **\`\`uvm_do_with(SEQ_OR_ITEM, {constraints})\`**: Same as \`\`uvm_do\` but with inline constraints for randomization.
   - **\`\`uvm_create(ITEM)\`**: Factory create.
   - **\`\`uvm_send(SEQ_OR_ITEM)\`**: Sends a pre-existing, randomized item (no \`start_item\`, \`randomize\`, \`finish_item\` calls by the macro itself, assumes item is ready).

   **From the Driver's perspective (inside \`run_phase\` task):**
   - **\`seq_item_port.get_next_item(REQ req_argument);\`**:
     - Sends a request to the sequencer for a new transaction.
     - Blocks until a sequence has completed \`finish_item(req_item)\` and the sequencer forwards \`req_item\`.
     - \`req_argument\` becomes a handle to this \`req_item\`.
   - **(Driver now processes \`req_argument\`, drives DUT signals based on its content)**
   - **\`seq_item_port.item_done(RSP rsp_argument = null);\`**:
     - Signals to the sequencer (and thus the originating sequence) that the driver has finished processing the current \`req_argument\`.
     - This unblocks the \`finish_item()\` call in the sequence.
     - Optionally, the driver can send a response transaction (\`rsp_argument\`) back.

**Layering Sequences:**
-   A sequence's \`body()\` task can create and start other sub-sequences on the *same* sequencer.
   - \`sub_seq_h = sub_seq_type::type_id::create("sub_seq_h");\`
   - \`sub_seq_h.start(m_sequencer, this, ...);\` (Note: \`m_sequencer\` is the default name for \`p_sequencer\` in \`uvm_sequence\`)
-   Or use \`\`uvm_do(sub_seq_h)\`.

**Virtual Sequences & Virtual Sequencers:**
-   Used to coordinate stimulus across *multiple* different sequencers (and thus different DUT interfaces).
-   A **Virtual Sequence** runs on a **Virtual Sequencer**.
-   The Virtual Sequencer doesn't connect to a driver but holds handles to the actual target sequencers (e.g., \`apb_sequencer_h\`, \`axi_sequencer_h\`).
-   The Virtual Sequence's \`body()\` then starts sub-sequences on these target sequencers.
   - E.g., \`apb_seq.start(p_sequencer.apb_sequencer_h);\`
`,
      codeExamples: [
        {
          description: "Simple Sequence Item, Sequence, and Driver interaction:",
          code:
`import uvm_pkg::*;
\`include "uvm_macros.svh"

// Sequence Item (Transaction)
class blocking_trans extends uvm_sequence_item;
  rand int addr;
  rand int data;
  \`uvm_object_utils_begin(blocking_trans)
    \`uvm_field_int(addr, UVM_DEFAULT)
    \`uvm_field_int(data, UVM_DEFAULT)
  \`uvm_object_utils_end
  function new(string name="blocking_trans"); super.new(name); endfunction
endclass

// Sequence
class simple_seq extends uvm_sequence #(blocking_trans);
  \`uvm_object_utils(simple_seq)
  function new(string name="simple_seq"); super.new(name); endfunction

  virtual task body();
    blocking_trans pkt;
    \`uvm_info(get_name(), "Sequence body started", UVM_MEDIUM)
    repeat(2) begin
      // Using uvm_do macro for create, start_item, randomize, finish_item
      \`uvm_do_with(pkt, { pkt.addr == ($urandom_range(0,15)); pkt.data == ($urandom_range(0,255)); })
      \`uvm_info(get_name(), $sformatf("Sent packet: %s", pkt.sprint()), UVM_LOW)
    end
    \`uvm_info(get_name(), "Sequence body finished", UVM_MEDIUM)
  endtask
endclass

// Driver
class my_driver extends uvm_driver #(blocking_trans);
  \`uvm_component_utils(my_driver)
  function new(string name="my_driver", uvm_component parent=null); super.new(name,parent); endfunction

  virtual task run_phase(uvm_phase phase);
    blocking_trans current_pkt;
    forever begin
      \`uvm_info(get_name(), "Waiting for item...", UVM_MEDIUM)
      seq_item_port.get_next_item(current_pkt); // Pull item from sequencer
      \`uvm_info(get_name(), $sformatf("Got item: %s. Driving to DUT...", current_pkt.sprint()), UVM_MEDIUM)
      // (Simulate driving to DUT)
      #10;
      \`uvm_info(get_name(), "Finished driving item.", UVM_MEDIUM)
      seq_item_port.item_done(); // Indicate completion
    end
  endtask
endclass

// Test to run the sequence
class test_seq extends uvm_test;
  \`uvm_component_utils(test_seq)
  my_driver driver_h;
  uvm_sequencer #(blocking_trans) sequencer_h; // Generic sequencer

  function new(string name="test_seq", uvm_component parent=null); super.new(name,parent); endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    driver_h    = my_driver::type_id::create("driver_h", this);
    sequencer_h = uvm_sequencer#(blocking_trans)::type_id::create("sequencer_h", this);
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    driver_h.seq_item_port.connect(sequencer_h.seq_item_export);
  endfunction

  virtual task run_phase(uvm_phase phase);
    simple_seq seq_h;
    phase.raise_objection(this, "Test starting");
    seq_h = simple_seq::type_id::create("seq_h");
    seq_h.start(sequencer_h); // Start the sequence on the sequencer
    #50; // Allow time for sequence to complete
    phase.drop_objection(this, "Test finished");
  endtask
endclass

module top_seq_handshake;
  import uvm_pkg::*;
  initial run_test("test_seq");
endmodule`
        }
      ],
      visualizations: [
        { description: "Flowchart of the `start_item`/`finish_item` (sequence) and `get_next_item`/`item_done` (driver) handshake, showing blocking points.", altText: "UVM Sequencer-Driver Handshake Flow" },
        { description: "Diagram showing a Virtual Sequence controlling two different agent-specific sequences running on their respective sequencers.", altText: "UVM Virtual Sequence Diagram" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Responses (RSP):** If a driver needs to send data back to a sequence (e.g., read data from DUT), the \`RSP\` type parameter in \`uvm_sequence\`, \`uvm_sequencer\`, and \`uvm_driver\` is used.
        - Sequence: \`finish_item(req); get_response(rsp);\` or \`rsp = req.get_response();\`
        - Driver: \`item_done(rsp_pkt_from_dut);\`
      - **Sequence Interleaving & Arbitration:** The sequencer handles arbitration when multiple sequences run concurrently on it. Common modes: \`UVM_SEQ_ARB_FIFO\` (default), \`UVM_SEQ_ARB_WEIGHTED\`, \`UVM_SEQ_ARB_RANDOM\`, \`UVM_SEQ_ARB_STRICT_FIFO\`, \`UVM_SEQ_ARB_STRICT_RANDOM\`. Can be set via \`sequencer.set_arbitration()\`.
      - **Locking/Grabbing a Sequencer:** A sequence can exclusively grab the sequencer using \`sequencer.lock(this)\` or \`sequencer.grab(this)\` to prevent other sequences from being arbitrated until \`unlock()\` or \`ungrab()\` is called. Grab is higher priority than lock. Use with caution as it can starve other sequences.
      - **`is_relevant()` and `wait_for_relevant()`:** For advanced sequence control, where a sequence might only proceed if certain conditions are met, often used with sequencer events or shared data.
      - **Sequence Priority:** Passed as an argument to \`start()\`. Higher numbers typically mean higher priority in arbitration.
      - **Sequence Libraries:** A \`uvm_sequence_library\` can be used to group multiple sequences and run them in various orders (e.g., random, user-defined).
      - **`pre_body()`, `post_body()`, `pre_do()`, `post_do()`:** Callback-like methods in sequences that allow actions before/after the main \`body()\` or before/after each transaction sent via \`\`uvm_do\` macros.
      - **`uvm_sequence::get_full_name()`:** Important for debugging, as sequences are objects and their "path" is built from their parent sequence(s).
      Common Pitfalls:
      - Forgetting to call \`item_done()\` in the driver, causing the sequence to hang at \`finish_item()\`.
      - Mismatched REQ/RSP types between sequence, sequencer, and driver.
      - Incorrectly using \`p_sequencer\` (e.g., if it's not yet set, or trying to access things that should be passed via configuration or TLM).
      - Deadlocks if sequences are waiting on each other or resources in a circular manner.
      - Overuse of grab/lock, reducing the benefits of concurrent stimulus.`,
      experienceView: `A senior UVM engineer leverages sequences as the primary engine for stimulus generation and control.
      - **Layered Stimulus:** They build complex scenarios by layering sequences: base sequences for common operations, extended sequences for specific variations or error conditions.
      - **Constrained Random Power:** Sequences are tightly coupled with constrained randomization of sequence items to generate rich and varied stimulus.
      - **Response Handling:** They meticulously handle response data in sequences, ensuring that read-back data is checked or used to inform subsequent stimulus.
      - **Sequencer as a Resource Manager:** They understand the sequencer's role in arbitration and use it effectively, sometimes customizing arbitration if needed.
      - **Virtual Sequences for System-Level Control:** Virtual sequences are critical for synchronizing operations across multiple DUT interfaces in system-level tests.
      - **Debugging Sequences:** They are skilled at using UVM's sequence debugging features, message verbosity, and waveform analysis to trace sequence execution and transaction flow.
      In code reviews: "Is this sequence logic clear and maintainable?", "Are constraints on sequence items appropriate for the intended stimulus?", "Is the sequencer-driver handshake correctly implemented?", "Are responses being handled if expected?", "Is there a need for locking/grabbing, or can it be avoided for better concurrency?", "Could this be a virtual sequence for better coordination?". They focus on creating robust, reusable, and effective stimulus.`,
      retentionTip: "UVM Sequences & Sequencer: **Sequence** = The 'Chef's Detailed Recipe' (generates transaction items). **Sequencer** = The 'Restaurant Expediter' (chooses which chef's order goes next). **Handshake** = 'Order Up!' & 'Order Done!' \n  - Sequence: \`start_item\` (I'm ready!) -> \`finish_item\` (Here's the order! Wait for 'done').\n  - Driver: \`get_next_item\` (Gimme an order!) -> (Process) -> \`item_done\` (Order complete!). \n  Use \`\`uvm_do\` as your all-in-one 'prepare and send' macro."
    }
  };

  return <TopicPage {...pageContent} />;
}
