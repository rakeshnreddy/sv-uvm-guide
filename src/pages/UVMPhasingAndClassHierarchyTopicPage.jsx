import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function UVMPhasingAndClassHierarchyTopicPage() {
  const pageContent = {
    title: "UVM Phasing & Class Hierarchy",
    elevatorPitch: {
      definition: "The UVM class hierarchy provides a set of base classes for creating reusable verification components. UVM Phasing is a mechanism that orchestrates the execution of these components through a standardized sequence of predefined phases, ensuring an orderly setup, execution, and cleanup of the testbench.",
      analogy: "Think of the **UVM Class Hierarchy** like a company's org chart: \`uvm_object\` is the CEO (the ultimate base for everything), \`uvm_component\` is a Department Head (persistent parts of the testbench like drivers, monitors), and other utility classes are specialized staff. **UVM Phasing** is like the company's project lifecycle: 'Planning Phase' (build_phase), 'Resource Allocation Phase' (connect_phase), 'Execution Phase' (run_phase), and 'Post-mortem/Reporting Phase' (report_phase). Every department (component) knows what tasks to do during each project phase, ensuring everyone works in sync.",
      why: "The class hierarchy promotes code reuse and standardization. Phasing solves the critical problem of coordinating when different parts of a complex testbench should perform their actions (e.g., building component structure, making connections, running stimulus, checking results). Without phasing, managing the setup and execution order in a large, dynamic testbench would be chaotic, leading to race conditions and unpredictable behavior. Phasing provides a robust framework for synchronized, ordered testbench execution."
    },
    practicalExplanation: {
      coreMechanics: `
**UVM Class Hierarchy:**
UVM classes are broadly categorized:
1.  **\`uvm_void\`**: The absolute base, rarely used directly.
2.  **\`uvm_object\`**: Base class for data objects (transactions, configurations) that are transient or passed between components. They do not have a persistent place in the testbench hierarchy and do not participate in phasing directly (though their methods might be called *during* phases).
    -   Provides utility methods like \`copy()\`, \`clone()\`, \`compare()\`, \`print()\`, \`pack\`, \`unpack\`.
    -   Sequence items (\`uvm_sequence_item\`) are derived from \`uvm_object\`.
3.  **\`uvm_report_object\`**: Derived from \`uvm_object\`. Base for any class that issues UVM reports (\`uvm_info\`, \`uvm_error\`, etc.).
4.  **\`uvm_component\`**: Derived from \`uvm_report_object\`. Base class for all quasi-static verification components that form the testbench structure (e.g., drivers, monitors, agents, environments, tests).
    -   These components have a unique hierarchical path name.
    -   They **participate in the UVM phasing mechanism**.
    -   They are constructed with a name and a parent component, forming the testbench hierarchy.

**UVM Phasing:**
Phasing controls the execution flow of \`uvm_component\` methods. Phases are methods that are called in a specific order.
-   **Standard Phases (executed in order):**
    1.  **Build Phases (Top-down):** Executed from the top of the hierarchy (uvm_test) downwards.
        -   \`build_phase(uvm_phase phase)\`: Primary purpose is to construct child components and configuration objects. Get configuration settings from \`uvm_config_db\`.
    2.  **Connect Phases (Bottom-up):** Executed from the bottom of the hierarchy upwards.
        -   \`connect_phase(uvm_phase phase)\`: Primary purpose is to make TLM connections between components (e.g., monitor's analysis port to scoreboard's export).
    3.  **End of Elaboration Phases (Bottom-up):**
        -   \`end_of_elaboration_phase(uvm_phase phase)\`: For final adjustments or checks before simulation starts. All connections should be made.
    4.  **Start of Simulation Phases (Bottom-up):**
        -   \`start_of_simulation_phase(uvm_phase phase)\`: For actions that need to happen just before time-consuming tasks begin (e.g., display component topology, final debug messages).
    5.  **Run-Time Phases (Parallel):** These execute in parallel, consuming simulation time. A test ends when all run-time phases complete or \`global_stop_request()\` is called.
        -   \`pre_reset_phase\`, \`reset_phase\`, \`post_reset_phase\`
        -   \`pre_configure_phase\`, \`configure_phase\`, \`post_configure_phase\`
        -   \`pre_main_phase\`, \`main_phase\`, \`post_main_phase\`
        -   \`pre_shutdown_phase\`, \`shutdown_phase\`, \`post_shutdown_phase\`
        -   The \`run_phase\` is the main time-consuming phase where stimulus is applied and DUT behavior is checked. The other run-time phases (reset, configure, main, shutdown and their pre/post versions) allow for more granular control over the test flow, often used for things like applying reset sequences, configuring the DUT, running primary stimulus, and then gracefully shutting down.
        -   Components typically implement only the \`run_phase\` or one of the main sub-phases (e.g., \`main_phase\`).
        -   **Objections:** Components use objections (\`phase.raise_objection(this)\`, \`phase.drop_objection(this)\`) during these phases to prevent the phase (and thus the test) from ending prematurely while they still have work to do.
    6.  **Clean Up Phases (Bottom-up):** Executed after run-time phases complete.
        -   \`extract_phase(uvm_phase phase)\`: Extract simulation results, calculate statistics.
        -   \`check_phase(uvm_phase phase)\`: Check for simulation errors, compare results against expected values.
        -   \`report_phase(uvm_phase phase)\`: Generate final reports, summarize test results.
    7.  **Final Phase (Bottom-up):**
        -   \`final_phase(uvm_phase phase)\`: Last chance to do anything before simulation terminates (e.g., close files, final cleanup).

-   **Phase Execution Order:**
    -   Build phases run top-down.
    -   Connect, End of Elaboration, Start of Simulation, Clean Up, and Final phases run bottom-up.
    -   Run-time phases (and their sub-phases) run in parallel for all components that implement them.

-   **User-Defined Phases:** UVM allows defining custom phases and inserting them into the schedule if needed.
`,
      codeExamples: [
        {
          description: "Simplified UVM Component showing build and run phases:",
          code:
`// Assume this is my_driver.sv
import uvm_pkg::*;
\`include "uvm_macros.svh"

class my_driver extends uvm_driver #(my_transaction); // my_transaction is a uvm_sequence_item
  \`uvm_component_utils(my_driver)

  my_config m_cfg; // Configuration object

  function new(string name = "my_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    \`uvm_info("BUILD", "Driver build_phase executing", UVM_MEDIUM)
    // Get configuration from uvm_config_db
    if (!uvm_config_db#(my_config)::get(this, "", "config_handle", m_cfg)) begin
      \`uvm_fatal("NO_CONFIG", "Failed to get config object")
    end
    // Child components could be created here if this driver had any
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    \`uvm_info("CONNECT", "Driver connect_phase executing", UVM_MEDIUM)
    // TLM connections would be made here if this driver had ports/exports
  endfunction

  virtual task run_phase(uvm_phase phase);
    phase.raise_objection(this, "Driver starting main stimulus");
    \`uvm_info("RUN", "Driver run_phase starting", UVM_MEDIUM)
    // Main driver logic: get transactions and drive them
    forever begin
      seq_item_port.get_next_item(req); // 'req' is inherited from uvm_driver
      // ... drive req to virtual interface ...
      \`uvm_info("DRV_PKT", $sformatf("Driving packet: %s", req.sprint()), UVM_LOW)
      #10; // Simulate time to drive
      seq_item_port.item_done();
      if (m_cfg.max_packets > 0 && m_cfg.packets_driven++ >= m_cfg.max_packets)
        break;
    end
    \`uvm_info("RUN", "Driver run_phase finishing", UVM_MEDIUM)
    phase.drop_objection(this, "Driver finished main stimulus");
  endtask
endclass

// Dummy transaction and config for context
class my_transaction extends uvm_sequence_item;
  rand int data;
  \`uvm_object_utils_begin(my_transaction)
    \`uvm_field_int(data, UVM_DEFAULT)
  \`uvm_object_utils_end
  function new(string name="my_transaction"); super.new(name); endfunction
endclass

class my_config extends uvm_object;
  int max_packets = 5;
  \`uvm_object_utils(my_config)
  function new(string name="my_config"); super.new(name); endfunction
endclass

// Test to run the driver (simplified)
class my_test extends uvm_test;
  \`uvm_component_utils(my_test)
  my_driver driver;
  my_config cfg;

  function new(string name = "my_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    cfg = my_config::type_id::create("cfg");
    cfg.max_packets = 3; // Configure max packets for this test
    uvm_config_db#(my_config)::set(this, "driver", "config_handle", cfg);
    driver = my_driver::type_id::create("driver", this);
  endfunction

  // In a real test, a sequence would be started on the driver's sequencer
  // For simplicity, we'll skip that here and assume driver's run_phase has basic logic.
  virtual task run_phase(uvm_phase phase);
    phase.raise_objection(this, "Test starting");
    #200; // Let simulation run for a bit
    phase.drop_objection(this, "Test finishing");
  endtask
endclass

module top_uvm_phasing;
  import uvm_pkg::*;
  initial begin
    // UVM test execution starts here
    run_test("my_test");
  end
endmodule`
        },
        {
          description: "Illustration of phase execution order (conceptual):",
          code:
`// Conceptual - Not directly executable as a whole, but shows methods
class my_component extends uvm_component;
  // ... new, uvm_component_utils ...

  function void build_phase(uvm_phase phase);     $display("%m: build_phase"); super.build_phase(phase); endfunction
  function void connect_phase(uvm_phase phase);   $display("%m: connect_phase"); super.connect_phase(phase); endfunction
  function void end_of_elaboration_phase(uvm_phase phase); $display("%m: end_of_elaboration_phase"); super.end_of_elaboration_phase(phase); endfunction
  function void start_of_simulation_phase(uvm_phase phase); $display("%m: start_of_simulation_phase"); super.start_of_simulation_phase(phase); endfunction

  task run_phase(uvm_phase phase);                 $display("%m: run_phase START"); #10; $display("%m: run_phase END"); endtask
  // Or, using fine-grained run-time phases:
  // task main_phase(uvm_phase phase);            $display("%m: main_phase START"); #10; $display("%m: main_phase END"); endtask

  function void extract_phase(uvm_phase phase);   $display("%m: extract_phase"); super.extract_phase(phase); endfunction
  function void check_phase(uvm_phase phase);     $display("%m: check_phase"); super.check_phase(phase); endfunction
  function void report_phase(uvm_phase phase);    $display("%m: report_phase"); super.report_phase(phase); endfunction
  function void final_phase(uvm_phase phase);     $display("%m: final_phase"); super.final_phase(phase); endfunction
endclass`
        }
      ],
      visualizations: [
        { description: "Diagram of the UVM Class Hierarchy (uvm_void, uvm_object, uvm_component, etc.).", altText: "UVM Class Hierarchy Diagram" },
        { description: "Flowchart illustrating the sequence of standard UVM phases and their execution direction (top-down, bottom-up, parallel).", altText: "UVM Phasing Flowchart" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Phase Jumping/Synchronization:** While not common for standard phases, UVM provides mechanisms to synchronize between user-defined phases or specific points using \`uvm_objection\` and \`uvm_barrier\`, or by using phase-specific events like \`phase.phase_done\`.
      - **Phase Domains:** UVM supports multiple phase domains that can run different phasing schedules concurrently (e.g., a separate power-up domain). This is an advanced feature.
      - **Run-time Sub-Phases (reset, configure, main, shutdown):** These provide a more structured way to organize the \`run_phase\`. Components can choose to implement, e.g., only the \`main_phase\`. Objections can be raised/dropped for these sub-phases.
      - **`uvm_phase::get_objection_count()`:** Useful for debugging why a phase might be stuck (waiting for an objection to be dropped).
      - **Order of Execution within a Phase:** For parallel phases (like \`run_phase\`), the order in which different components' \`run_phase\` tasks start is not guaranteed by UVM and depends on the simulator. For bottom-up/top-down phases, the hierarchy dictates order.
      - **Non-\`uvm_component\` classes in Phasing:** Data objects (\`uvm_object\`) don't have phase methods themselves, but their methods are often called *by* \`uvm_component\` phase methods (e.g., a component's \`build_phase\` might create and configure \`uvm_object\` based configuration items).
      - **`uvm_root`:** The implicit top-level component in any UVM testbench, from which \`run_test()\` starts the phasing.
      Common Pitfalls:
      - Forgetting to call \`super.phase_method(phase)\` in overridden phase methods, which can break UVM's internal phase mechanics or skip base class functionality.
      - Raising an objection but never dropping it, causing the simulation to hang.
      - Trying to access components in \`build_phase\` that haven't been created yet (due to top-down nature). E.g., a child trying to access a sibling that's created later.
      - Making TLM connections in \`build_phase\` (should be in \`connect_phase\`).
      - Time-consuming operations in non-run-time phases (these should be quick setup/cleanup tasks).`,
      experienceView: `A senior engineer relies on the UVM class hierarchy and phasing as the fundamental backbone of the testbench.
      - **Predictable Execution:** Phasing ensures that all components initialize, connect, run, and report in a predictable and synchronized manner.
      - **Modularity:** They design components to perform specific tasks within specific phases (e.g., configuration in \`build_phase\`, TLM connections in \`connect_phase\`).
      - **Objection Management:** Careful management of objections is critical for controlling test duration and ensuring all components complete their tasks. Debugging hung tests often involves tracking down missing \`drop_objection\` calls.
      - **Hierarchy for Configuration/Connection:** The component hierarchy is leveraged by \`uvm_config_db\` for passing configurations and is essential for tracing paths during debugging.
      - **Customization vs. Standardization:** While UVM is flexible, they adhere to standard phase usage unless there's a compelling reason for custom phases or domains, to maintain interoperability and clarity.
      In code reviews: "Is this logic in the correct phase?", "Is \`super.phase_method()\` being called?", "Are objections being properly raised and dropped?", "Is component construction happening in \`build_phase\` and connections in \`connect_phase\`?", "Is there any blocking code in non-time-consuming phases?". They ensure adherence to the phasing model for robust testbench operation.`,
      retentionTip: "UVM Hierarchy & Phasing: **Hierarchy** is 'Who's Who' in your testbench zoo (components like drivers, monitors). **Phasing** is 'What They Do, And When.' Remember the main flow: **B**uild (top-down), **C**onnect (bottom-up), **E**laborate, **S**tart Sim, **R**un (parallel, with objections!), **E**xtract, **C**heck, **R**eport. **BCES RECR** - 'Because Everyone Can Really Enjoy UVM Eventually, Carefully Reviewing Each Component's Role.'"
    }
  };

  return <TopicPage {...pageContent} />;
}
