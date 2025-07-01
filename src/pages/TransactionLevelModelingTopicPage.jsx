import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function TransactionLevelModelingTopicPage() {
  const pageContent = {
    title: "UVM Transaction-Level Modeling (TLM)",
    elevatorPitch: {
      definition: "Transaction-Level Modeling (TLM) in UVM is a high-level communication mechanism where components exchange data as whole 'transactions' (objects) rather than individual pin wiggles. UVM provides a standard set of TLM interfaces, ports, and exports to facilitate this abstract communication, primarily between sequencers, drivers, monitors, and scoreboards.",
      analogy: "Think of TLM like sending packages (transactions) through a postal system instead of spelling out messages letter by letter over a walkie-talkie (pin-level signals). \n- A **Sequencer** is like a 'Mailroom Clerk' who prepares a package (transaction object) and wants to send it. \n- A **Driver** is like a 'Delivery Truck Driver' who has a specific route. \n- The Sequencer uses a 'Shipping Label' (\`uvm_seq_item_pull_port\`) to indicate it has a package. The Driver uses a 'Receiving Dock' (\`uvm_seq_item_pull_export\`) to accept it. \n- A **Monitor** is like a 'Package Scanner' observing packages on a conveyor belt. It uses an 'Announcement System' (\`uvm_analysis_port\`) to tell everyone interested (Scoreboards, Coverage Collectors) about the packages it sees. \n- **Scoreboards** have 'Listening Posts' (\`uvm_analysis_imp\`) to hear these announcements.",
      why: "TLM is fundamental to UVM's layered architecture because it decouples components by abstracting communication. Instead of a monitor needing to know the exact methods of a scoreboard to send it data, they both agree on a standard TLM interface. This enables: \n1.  **Reusability:** Components can be connected more easily if they use standard communication interfaces. \n2.  **Modularity:** The internal implementation of one component can change without affecting others, as long as the TLM interface remains the same. \n3.  **Scalability:** Simplifies complex testbenches by reducing direct, hardwired connections and method calls between components. \n4.  **Abstraction:** Allows focus on data flow (transactions) rather than low-level signal details when designing component interactions."
    },
    practicalExplanation: {
      coreMechanics: `UVM TLM is based on the concepts of ports, exports, and imps, which implement standard transaction-level interfaces. The communication is typically between a component that initiates a transaction (initiator) and one that receives or acts upon it (target), or a component that broadcasts information (producer) to interested listeners (subscribers).

**Key TLM Interfaces and Ports/Exports:**

1.  **Blocking Transport (Get/Put/Transport):** Used for point-to-point, typically blocking, communication.
    -   **`uvm_blocking_put_if #(type T = uvm_object)`:** Interface for sending a transaction. Method: \`task put (T t)\`.
        -   Port: \`uvm_blocking_put_port #(type T)\` (used by initiator)
        -   Export: \`uvm_blocking_put_export #(type T)\` (used by target, forwards to an imp)
        -   Imp: \`uvm_blocking_put_imp #(type T, type IMP)\` (in target, implements the \`put\` task)
    -   **`uvm_blocking_get_if #(type T = uvm_object)`:** Interface for receiving a transaction. Method: \`task get (output T t)\`.
        -   Ports/Exports/Imps similar to put.
    -   **`uvm_blocking_peek_if #(type T = uvm_object)`:** Interface for looking at a transaction without consuming it. Method: \`task peek (output T t)\`.
    -   **`uvm_transport_if #(type REQ = uvm_object, type RSP = uvm_object)`:** For bidirectional blocking communication (send request, get response). Method: \`task transport (REQ req, output RSP rsp)\`.

2.  **Non-Blocking Transport:** Similar to blocking, but methods are functions that return immediately (e.g., \`function bit try_put(T t)\`).
    -   \`uvm_nonblocking_put_if\`, \`uvm_nonblocking_get_if\`, etc.

3.  **Sequencer-Driver TLM (Pull & Push):** Standardized for sequencer-driver communication. The driver *pulls* items from the sequencer.
    -   **`uvm_seq_item_pull_if #(type REQ = uvm_sequence_item, type RSP = uvm_sequence_item)`:** The primary interface.
        -   Port on Driver: \`uvm_seq_item_pull_port #(REQ, RSP) seq_item_port;\`
        -   Export on Sequencer: \`uvm_seq_item_pull_export #(REQ, RSP) seq_item_export;\`
    -   Methods used by Driver: \`task get_next_item(output REQ t)\`, \`task item_done(input RSP t = null)\`.
    -   The sequencer also has methods like \`send_request\`, \`get_response\` used by sequences.
    -   Push mode (\`uvm_seq_item_push_port/export\`) is less common for driver-sequencer.

4.  **Analysis Communication (Broadcast):** Used for one-to-many, non-blocking broadcast of observed transactions (e.g., from monitor to scoreboard and coverage collectors).
    -   **`uvm_analysis_if #(type T = uvm_object)`:** Interface with a single method: \`function void write(T t)\`.
    -   **Port on Producer (e.g., Monitor):** \`uvm_analysis_port #(type T) analysis_port;\`
        -   A monitor calls: \`analysis_port.write(observed_transaction);\`
    -   **Export on intermediate components (e.g., Agent, Env):** \`uvm_analysis_export #(type T) analysis_export;\`
        -   Used to pass the connection up the hierarchy.
    -   **Imp on Subscriber/Listener (e.g., Scoreboard, Coverage Collector):** \`uvm_analysis_imp #(type T, type IMP) analysis_imp;\`
        -   The \`IMP\` class implements the actual \`function void write(T t)\` method that gets called when the monitor broadcasts. An analysis port can be connected to multiple imps.

**Connecting Ports and Exports:**
-   Connections are made in the \`connect_phase\` of a parent component.
-   An initiator's port connects to a target's export (or directly to an imp if they are siblings and the imp is not further down).
    -   \`initiator.port.connect(target.export);\`
-   An export must ultimately be connected to an imp that implements the interface methods.
    -   \`target_component.export_on_parent.connect(actual_imp_provider.imp_handle);\`

**Example Flow (Monitor to Scoreboard):**
1.  Monitor has an \`item_collected_port = new("item_collected_port", this);\` (\`uvm_analysis_port\`).
2.  When monitor observes a transaction \`tx\`, it calls \`item_collected_port.write(tx);\`.
3.  Agent (parent of monitor) might have an \`agent_ap = new("agent_ap", this);\` (\`uvm_analysis_export\`).
    -   In agent's \`connect_phase\`: \`monitor.item_collected_port.connect(this.agent_ap);\`
4.  Environment (parent of agent and scoreboard) connects agent's export to scoreboard's imp.
    -   In env's \`connect_phase\`: \`agent.agent_ap.connect(scoreboard.actual_item_export);\` (assuming scoreboard also uses an export to forward to its internal imp) or directly \`agent.agent_ap.connect(scoreboard.analysis_imp_instance);\`
5.  Scoreboard has an \`analysis_imp = new ("analysis_imp", this);\` and implements \`function void write(my_transaction t); ... endfunction\`.
`,
      codeExamples: [
        {
          description: "Monitor broadcasting using `uvm_analysis_port` and Scoreboard receiving with `uvm_analysis_imp`:",
          code:
`import uvm_pkg::*;
\`include "uvm_macros.svh"

// Transaction
class my_txn extends uvm_sequence_item;
  rand int data;
  \`uvm_object_utils_begin(my_txn) \`uvm_field_int(data, UVM_DEFAULT) \`uvm_object_utils_end
  function new(string name="my_txn"); super.new(name); endfunction
endclass

// Monitor
class my_monitor extends uvm_monitor;
  \`uvm_component_utils(my_monitor)
  uvm_analysis_port #(my_txn) item_collected_port; // Analysis Port

  function new(string name="my_monitor", uvm_component parent=null);
    super.new(name, parent);
    item_collected_port = new("item_collected_port", this);
  endfunction

  virtual task run_phase(uvm_phase phase);
    // Simplified: Pretend to observe transactions
    repeat(3) begin
      my_txn observed_pkt = my_txn::type_id::create("observed_pkt");
      void'(observed_pkt.randomize());
      \`uvm_info(get_name(), $sformatf("Observed and broadcasting: %s", observed_pkt.sprint()), UVM_MEDIUM)
      item_collected_port.write(observed_pkt); // Broadcast
      #20;
    end
  endtask
endclass

// Scoreboard
class my_scoreboard extends uvm_scoreboard;
  \`uvm_component_utils(my_scoreboard)
  uvm_analysis_imp #(my_txn, my_scoreboard) item_listener_imp; // Analysis Imp

  function new(string name="my_scoreboard", uvm_component parent=null);
    super.new(name, parent);
    item_listener_imp = new("item_listener_imp", this);
  endfunction

  // This 'write' method is called when monitor broadcasts
  virtual function void write(my_txn t);
    \`uvm_info(get_name(), $sformatf("Received transaction in scoreboard: %s", t.sprint()), UVM_MEDIUM)
    // ... Add checking logic here ...
  endfunction
endclass

// Environment to connect them
class my_env extends uvm_env;
  \`uvm_component_utils(my_env)
  my_monitor monitor0;
  my_scoreboard scb0;
  function new(string name="my_env", uvm_component parent=null); super.new(name,parent); endfunction

  virtual function void build_phase(uvm_phase phase);
    monitor0 = my_monitor::type_id::create("monitor0", this);
    scb0     = my_scoreboard::type_id::create("scb0", this);
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    // Connect monitor's port to scoreboard's imp
    monitor0.item_collected_port.connect(scb0.item_listener_imp);
  endfunction
endclass

// Test
class test1 extends uvm_test;
  \`uvm_component_utils(test1)
  my_env env0;
  function new(string name="test1", uvm_component parent=null); super.new(name,parent); endfunction
  virtual function void build_phase(uvm_phase phase); env0 = my_env::type_id::create("env0", this); endfunction
  virtual task run_phase(uvm_phase phase); phase.raise_objection(this); #100; phase.drop_objection(this); endtask
endclass

module top_tlm_analysis;
  import uvm_pkg::*;
  initial run_test("test1");
endmodule`
        },
        {
          description: "Sequencer-Driver TLM connection (conceptual, driver side shown):",
          code:
`// In Driver class (e.g., my_driver extends uvm_driver #(my_req_txn, my_rsp_txn))
// Port to get items from sequencer:
uvm_seq_item_pull_port #(my_req_txn, my_rsp_txn) seq_item_port;

// In new() constructor:
// seq_item_port = new("seq_item_port", this);

// In run_phase():
// forever begin
//   my_req_txn req;
//   my_rsp_txn rsp; // Optional, if driver sends responses
//
//   seq_item_port.get_next_item(req); // Blocking call, waits for sequence to send item
//   // ... Drive req to DUT via virtual interface ...
//   // ... If DUT provides response data ...
//   // rsp = new("rsp");
//   // rsp.data = vif.rdata; // Get data from interface
//   seq_item_port.item_done(rsp); // Unblocks sequence, optionally sends response
// end

// In Sequencer class (e.g., my_sequencer extends uvm_sequencer #(my_req_txn, my_rsp_txn))
// Export for driver to connect to:
// uvm_seq_item_pull_export #(my_req_txn, my_rsp_txn) seq_item_export;
// In new(): seq_item_export = new("seq_item_export", this);
// (Built-in uvm_sequencer already has seq_item_export)

// In Agent's connect_phase():
// driver_h.seq_item_port.connect(sequencer_h.seq_item_export);`
        }
      ],
      visualizations: [
        { description: "Diagram showing an `uvm_analysis_port` on a Monitor connecting to multiple `uvm_analysis_imp`s on a Scoreboard and a Coverage Collector.", altText: "UVM Analysis Port/Imp Connection" },
        { description: "Diagram illustrating the `get_next_item`/`item_done` handshake between a Driver's `seq_item_pull_port` and a Sequencer's `seq_item_pull_export`.", altText: "UVM Sequencer-Driver TLM Handshake" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **TLM2 (IEEE 1666-2011):** UVM TLM is based on OSCI TLM-1. TLM-2.0 is a more advanced standard, offering generic payload, blocking/non-blocking transport interfaces, and debug transport. While UVM primarily uses TLM1-style interfaces, understanding TLM2 concepts can be beneficial for SystemC co-simulation or more complex modeling. UVM does provide some TLM2 sockets (\`uvm_tlm_b_initiator_socket\`, \`uvm_tlm_b_target_socket\`) for basic blocking transport.
      - **Multiple Analysis Ports/Imps:** A component can have multiple analysis ports (e.g., a monitor distinguishing between different types of observed items) or multiple imps (e.g., a scoreboard listening to different interfaces).
      - **Layered TLM Connections:** Exports are used to chain connections up the hierarchy. For example, a monitor's port connects to its agent's export, which then connects from the agent (as a port from the agent's perspective if re-exporting) to the environment's export, and finally to a scoreboard imp in the environment.
      - **FIFOs as TLM Targets/Initiators:** \`uvm_tlm_fifo\` and \`uvm_tlm_analysis_fifo\` are utility classes that act as simple storage elements with TLM interfaces, useful for buffering transactions or synchronizing between processes.
      - **Blocking vs. Non-Blocking Choice:** The choice depends on the required synchronization. Sequencer-driver is typically blocking for \`get_next_item\`. Analysis ports are non-blocking (fire-and-forget).
      - **Transaction Type Matching:** TLM connections are type-safe. The transaction type \`T\` specified in the port, export, and imp must match or be compatible (e.g., imp receives a base class, port sends a derived class).
      Common Pitfalls:
      - **Forgetting to connect ports:** If a port is not connected, calls on it may result in null pointer errors or simply do nothing.
      - **Mismatched Transaction Types:** Connecting a port of type \`X\` to an imp expecting type \`Y\` (where X and Y are incompatible) will cause a compile-time or run-time error.
      - **Incorrect Imp Implementation:** The \`_imp\` class must correctly implement all methods of the TLM interface it's providing (e.g., the \`write()\` function for an analysis imp).
      - **Connecting port to port, or export to export directly (usually incorrect):** Connections are typically port-to-export or port-to-imp.
      - **Deadlock with blocking TLM calls:** If two components are waiting on each other via blocking TLM calls without a proper sequence of operations.`,
      experienceView: `A senior UVM engineer considers TLM the "glue" that holds a layered testbench together in a clean and maintainable way.
      - **Standardized Interfaces:** They rely on the standard UVM TLM interfaces (\`uvm_analysis_if\`, \`uvm_seq_item_pull_if\`) to ensure components are interoperable.
      - **Decoupling Components:** The primary benefit is that a monitor doesn't need to know the specific class name or methods of the scoreboard; it just "writes" to its analysis port. This allows scoreboards to be swapped or modified without changing the monitor.
      - **Clarity of Data Flow:** TLM connections in the \`connect_phase\` clearly document how transactions flow between high-level components.
      - **Designing Reusable Components:** Components are designed with clear TLM ports/exports for their inputs and outputs, making them easy to integrate into different environments.
      - **Debugging Connectivity:** They use UVM's built-in port/export connection information (often printed by default or accessible via debug commands) to verify that the testbench is wired correctly.
      In code reviews: "Is this the correct TLM port/export/imp type for this interaction?", "Are all necessary TLM connections made in the connect_phase?", "Is the transaction type consistent across the connection?", "Could this direct method call be replaced by a more standard TLM communication channel for better decoupling?". They push for using TLM for inter-component communication wherever appropriate.`,
      retentionTip: "UVM TLM: Think 'Transaction Post Office'. \n- **Analysis Port/Imp** (\`write\`): Monitor 'shouts' (broadcasts) info about a package; Scoreboard 'listens'. (Fire-and-forget).\n- **SeqItem Pull Port/Export** (\`get_next_item\`, \`item_done\`): Driver 'pulls' the next package from Sequencer's 'outbox'. (Blocking, point-to-point).\n- **Ports** are like 'mail slots' (initiators/producers), **Exports** are 'forwarding addresses', **Imps** are the 'final mailbox' (targets/implementers)."
    }
  };

  return <TopicPage {...pageContent} />;
}
