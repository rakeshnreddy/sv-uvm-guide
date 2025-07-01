import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function UVMCodingGuidelinesAndPatternsTopicPage() {
  const pageContent = {
    title: "UVM Coding Guidelines & Design Patterns",
    elevatorPitch: {
      definition: "UVM coding guidelines are conventions and best practices for writing UVM-based verification code to ensure clarity, maintainability, reusability, and interoperability. Design patterns in UVM are reusable solutions to commonly occurring problems within the framework, such as the Factory Pattern for object creation or the Singleton Pattern for global objects.",
      analogy: "Think of **Coding Guidelines** like the 'Highway Code' for UVM development. They dictate things like naming conventions ('all component names end in _c'), how to structure your code files ('one class per file'), and general rules of the road to ensure everyone drives (codes) in a predictable and safe manner. **Design Patterns** are like pre-fabricated, efficient 'intersection designs' (e.g., a roundabout for managing traffic flow - Singleton for a central config) or 'vehicle customization kits' (Factory for building specific car types on demand). They are proven solutions to common traffic engineering (verification environment) problems.",
      why: "Guidelines are essential for team-based projects to ensure consistency, making code easier to read, integrate, and debug. They also promote reusability as components written to a common standard are easier to plug into different environments. Design patterns provide elegant, tested solutions to recurring challenges, preventing engineers from reinventing the wheel and often leading to more robust and flexible architectures. Adhering to both leads to higher quality, more maintainable, and more efficient verification efforts."
    },
    practicalExplanation: {
      coreMechanics: `
**Common UVM Coding Guidelines:**

1.  **Naming Conventions:**
    -   **Packages:** \`_pkg\` suffix (e.g., \`my_agent_pkg\`).
    -   **Classes:** CamelCase or PascalCase (e.g., \`MyDriver\`, \`my_sequence_item\`). UVM base classes use \`uvm_lowercase_with_underscores\`. User-defined often follow this or CamelCase. Some teams use suffixes: \`_c\` for components, \`_s\` for sequences, \`_i\` for items, \`_cfg\` for configs. (The blueprint mentions \`m_\` for class members, \`_h\` for handles).
    -   **Methods & Tasks:** lowerCamelCase or lowercase_with_underscores (e.g., \`send_packet()\`, \`build_phase()\`).
    -   **Variables/Properties:** lowerCamelCase or lowercase_with_underscores. Prefixing member variables with \`m_\` (e.g., \`m_pkt_count\`) is common to distinguish from local variables. Handles often get an \`_h\` suffix (e.g., \`driver_h\`).
    -   **Constants & Enums:** ALL_CAPS_WITH_UNDERSCORES (e.g., \`MAX_RETRIES\`, \`READ_OP\`). Enum types often get \`_e\` suffix.
    -   **Macros:** \`\`ALL_CAPS_WITH_UNDERSCORES\` (e.g., \`\`MY_UVM_INFO\`). Often prefixed with a unique project/company identifier.

2.  **File Organization:**
    -   Typically, one UVM class per \`.sv\` file.
    -   File name often matches the class name (e.g., \`my_driver.sv\` contains \`class my_driver ...\`).
    -   Group related files into packages (e.g., agent files in an agent package).

3.  **UVM Macros:**
    -   Use \`\`uvm_component_utils()\` and \`\`uvm_object_utils()\` for factory registration.
    -   Use field automation macros (\`\`uvm_field_int\`, \`\`uvm_field_object\`, etc.) within \`\`uvm_*_utils_begin ... \`uvm_*_utils_end\` for common methods like \`copy\`, \`compare\`, \`print\`, \`pack\`, \`unpack\`.
    -   Use reporting macros (\`\`uvm_info\`, \`\`uvm_error\`, \`\`uvm_fatal\`, \`\`uvm_warning\`) for standardized messaging. Provide unique message IDs.

4.  **Phasing:**
    -   Implement functionality in the appropriate phase (e.g., component creation in \`build_phase\`, connections in \`connect_phase\`).
    -   Always call \`super.phase_method(phase);\` as the first line in overridden phase methods.
    -   Properly use objections (\`raise_objection\`, \`drop_objection\`) in run-time phases.

5.  **Factory Usage:**
    -   Create all \`uvm_object\`s and \`uvm_component\`s using the factory (\`type_id::create()\`) instead of \`new()\` directly to enable overrides.

6.  **Configuration (\`uvm_config_db\`):**
    -   Use \`uvm_config_db\` to pass configurations (virtual interface handles, parameters, object handles) down the hierarchy from tests to components.
    -   Use unique, well-defined string keys for configuration settings.

7.  **TLM Usage:**
    -   Use standard UVM TLM ports, exports, and imps for inter-component communication.

8.  **Virtual Interfaces:**
    -   Pass virtual interface handles via \`uvm_config_db\` to drivers and monitors.

9.  **Sequences:**
    -   Keep sequences focused on stimulus generation logic. Avoid putting DUT interaction (pin wiggling) directly in sequences; that's the driver's job.
    -   Use \`\`uvm_do\` macros or \`start_item\`/\`finish_item\` for sending transactions.

10. **Clarity and Comments:**
    -   Write clear, concise code.
    -   Use comments to explain complex logic, assumptions, or intent. Doxygen-style comments are often used.

**Common UVM Design Patterns (as mentioned or implied by the blueprint):**

1.  **Factory Pattern:** (Already covered in detail) Used for creating objects and components, enabling overrides. This is central to UVM.

2.  **Singleton Pattern:** (Mentioned in blueprint for central configuration object)
    -   Ensures a class has only one instance and provides a global point of access to it.
    -   Often used for global configuration objects, report servers, or resource managers.
    -   Implementation: Private constructor, static local instance, static \`get_instance()\` method.

3.  **Strategy Pattern (via Sequences/Overrides):**
    -   Define a family of algorithms (e.g., different ways to generate stimulus via sequences), encapsulate each one, and make them interchangeable. The factory override mechanism allows tests to select a specific strategy (sequence type) at runtime.

4.  **Observer Pattern (via Analysis Ports/Imps):**
    -   A subject (e.g., \`uvm_monitor\` with an \`uvm_analysis_port\`) maintains a list of its dependents (observers, e.g., scoreboards, coverage collectors with \`uvm_analysis_imp\`) and notifies them automatically of any state changes (by calling \`analysis_port.write()\`).

5.  **Layered Architecture Pattern:** (Already covered in detail) Organizes components into layers with distinct responsibilities (Test, Env, Agent, Driver/Monitor/Sequencer).

6.  **Adapter Pattern (\`uvm_reg_adapter\`):**
    -   Converts the interface of a class into another interface clients expect. \`uvm_reg_adapter\` adapts generic register operations (\`uvm_reg_bus_op\`) to specific bus protocol transactions.

7.  **Callback Pattern (\`uvm_callback\`):**
    -   Allows customizing or extending component behavior without modifying the component's source code directly. Users can define callback classes derived from \`uvm_callback\` and register them with a component that provides callback hooks (\`uvm_do_callbacks\`). More fine-grained than factory overrides.

8.  **Configuration Object Pattern:**
    -   Encapsulate configuration parameters for a component or agent into a separate \`uvm_object\` class. This object is then passed around using \`uvm_config_db\`. Makes configuration cleaner and more manageable.
`,
      codeExamples: [
        {
          description: "Naming Convention and File Organization (Conceptual):",
          code:
`// --- File: my_bus_agent_pkg.sv ---
package my_bus_agent_pkg;
  import uvm_pkg::*;
  \`include "uvm_macros.svh"

  // Include agent component files (each class in its own file typically)
  \`include "my_bus_transaction_i.sv" // _i for item/transaction
  \`include "my_bus_config_c.sv"     // _c for config object (though can be _o)
  \`include "my_bus_driver_c.sv"     // _c for component
  \`include "my_bus_monitor_c.sv"
  \`include "my_bus_sequencer_c.sv"
  \`include "my_bus_agent_c.sv"
endpackage

// --- File: my_bus_driver_c.sv ---
// class my_bus_driver_c extends uvm_driver #(my_bus_transaction_i);
//   \`uvm_component_utils(my_bus_driver_c)
//   my_bus_config_c m_cfg_h; // m_ prefix for member, _h for handle
//   // ...
// endclass`
        },
        {
          description: "Singleton Pattern for a Global Reporter:",
          code:
`import uvm_pkg::*;
\`include "uvm_macros.svh"

class global_reporter extends uvm_report_object;
  // 1. Static local instance handle
  private static global_reporter m_instance;
  protected int m_report_count = 0;

  // 2. Private constructor to prevent direct instantiation
  private function new(string name = "global_reporter_inst");
    super.new(name);
  endfunction

  // 3. Static public method to get the single instance
  public static function global_reporter get_instance();
    if (m_instance == null) begin
      m_instance = new();
    end
    return m_instance;
  endfunction

  // Example method
  function void issue_report(string msg);
    m_report_count++;
    \`uvm_info(get_name(), $sformatf("Global Report #%0d: %s", m_report_count, msg), UVM_LOW)
  endfunction
endclass

// Usage:
// initial begin
//   global_reporter reporter = global_reporter::get_instance();
//   reporter.issue_report("System initialization complete.");
//
//   global_reporter reporter2 = global_reporter::get_instance(); // Will be same instance
//   reporter2.issue_report("Another component reporting.");
// end
`
        },
        {
          description: "Configuration Object Pattern:",
          code:
`import uvm_pkg::*;
\`include "uvm_macros.svh"

// Configuration Object for an Agent
class my_agent_config_c extends uvm_object;
  \`uvm_object_utils(my_agent_config_c)

  // Configurable parameters
  rand int num_transactions_to_send;
  rand boolean error_injection_enable;
  uvm_active_passive_enum is_active = UVM_ACTIVE;
  virtual my_bus_if vif; // Virtual interface handle

  constraint c_num_trans { num_transactions_to_send inside {[1:100]}; }

  function new(string name = "my_agent_config_c");
    super.new(name);
  endfunction
endclass

// Agent using the Configuration Object
class my_agent_c extends uvm_agent;
  \`uvm_component_utils(my_agent_c)
  my_agent_config_c m_cfg_h; // Handle for its configuration object

  // ... driver, monitor, sequencer ...

  function new(string name="my_agent_c", uvm_component parent=null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // Get the configuration object from uvm_config_db
    if (!uvm_config_db#(my_agent_config_c)::get(this, "", "agent_config", m_cfg_h)) begin
      \`uvm_fatal(get_name(), "Failed to get agent_config from config_db")
    end
    this.is_active = m_cfg_h.is_active; // Set agent's active/passive state from config

    // Now create other components based on m_cfg_h.is_active and other params
    // For example, pass m_cfg_h.vif to driver and monitor via config_db
  endfunction
endclass

// Test setting the configuration
class my_test_c extends uvm_test;
  \`uvm_component_utils(my_test_c)
  my_agent_c agent_h;
  my_agent_config_c agent_cfg_h; // Test creates and configures the config object

  function new(string name="my_test_c", uvm_component parent=null); super.new(name,parent); endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // 1. Create the config object
    agent_cfg_h = my_agent_config_c::type_id::create("agent_cfg_h");
    // 2. Configure it for this test
    agent_cfg_h.is_active = UVM_ACTIVE;
    agent_cfg_h.num_transactions_to_send = 10;
    agent_cfg_h.error_injection_enable = (this.get_name() == "error_test"); // Example
    // (Assume virtual interface 'dut_vif' is available in test)
    // if (!uvm_config_db#(virtual my_bus_if)::get(this, "", "DUT_VIF", agent_cfg_h.vif))
    //   \`uvm_fatal("NOVIF", "Virtual interface not found for config")

    // 3. Set it into config_db for the agent instance to get
    uvm_config_db#(my_agent_config_c)::set(this, "agent_h*", "agent_config", agent_cfg_h);
    // ("agent_h*" means it applies to agent_h and any component below it)

    // 4. Create the agent - it will pick up the config in its build_phase
    agent_h = my_agent_c::type_id::create("agent_h", this);
  endfunction
  // ... run_phase etc. ...
endclass`
        }
      ],
      visualizations: [
        { description: "Diagram showing a typical UVM package structure with included files.", altText: "UVM Package Structure" },
        { description: "UML diagram illustrating the Singleton pattern: private constructor, static instance, static getInstance() method.", altText: "Singleton Pattern UML" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Policy Pattern (via Callbacks or Strategy):** Defining a family of policies (e.g., different arbitration schemes for a sequencer, different error handling policies) and allowing them to be selected or plugged in at runtime.
      - **Abstract Factory Pattern:** Provides an interface for creating families of related or dependent objects without specifying their concrete classes. Can be used for creating sets of related protocol components.
      - **Resource Management Patterns:** For shared resources (e.g., memory managers, scoreboards managing expected transactions), patterns like resource pooling or semaphores/mutexes for controlled access are important. UVM provides \`uvm_pool\`, \`uvm_semaphore\`.
      - **"Easier UVM" / "Cool UVM" Guidelines:** Community-driven efforts (like those by Doulos, referenced in the blueprint) that suggest additional conventions or utility classes to reduce boilerplate and simplify common UVM tasks. These often focus on improved macros or base classes.
      - **Linting and Style Checking:** Using tools like Verible, SVFormat, or commercial linters to automatically enforce coding style and detect common UVM pitfalls.
      - **Documentation Generation:** Using Doxygen or similar tools with structured comments to automatically generate documentation for the UVM environment.
      Common Pitfalls in Applying Guidelines/Patterns:
      - **Over-Engineering:** Applying complex design patterns where simpler solutions would suffice, making the code harder to understand.
      - **Inconsistent Application:** Applying naming conventions or patterns sporadically, reducing their benefits.
      - **"Macro Magic" Obscurity:** Over-reliance on complex macros can sometimes make code harder to debug if their expansion isn't well understood.
      - **Ignoring Team Conventions:** Prioritizing personal preferences over established team or project guidelines, leading to integration issues.
      - **Pattern Misunderstanding:** Incorrectly implementing a design pattern, leading to bugs or unintended behavior.`,
      experienceView: `A senior UVM engineer understands that guidelines and patterns are not just rules for rules' sake, but tools for building robust, maintainable, and scalable verification environments.
      - **Pragmatism:** They apply guidelines and patterns pragmatically, understanding when a strict rule might be bent for a good reason, or when a pattern adds unnecessary complexity.
      - **Consistency is Key:** Even if a specific naming convention isn't their personal favorite, they adhere to the team/project standard for overall code coherence.
      - **Mentoring:** They actively mentor junior engineers on UVM best practices and the rationale behind common design patterns.
      - **Evolving Standards:** They keep up-to-date with evolving UVM best practices and community discussions (e.g., from Accellera, conferences like DVCon).
      - **Tooling for Enforcement:** They advocate for and use tools (linters, formatters) to automate the enforcement of coding standards.
      - **Designing for Testability and Debuggability:** Guidelines often implicitly support this – clear names, modular components, and standardized reporting make debugging much easier.
      In code reviews: "Does this code adhere to our project's UVM naming conventions?", "Is the factory being used correctly here?", "Could this complex logic be simplified by applying a known design pattern like Strategy or Observer?", "Is this component configurable enough via its config object?", "Are there sufficient comments and clear logging?". They look for code that is not only functional but also clean, understandable, and easy for others to maintain and extend.`,
      retentionTip: "UVM Guidelines & Patterns: **Guidelines** = 'UVM Grammar & Punctuation' (write clearly so others understand). **Patterns** = 'UVM Power Tools' (use proven solutions for common jobs). \n- **Naming:** Be consistent (project rules > personal preference). \n- **Factory:** Always use it for UVM things (\`type_id::create\`). \n- **Config Objects:** Bundle settings for components. \n- **Singleton:** One global boss for a specific task. \n- **Callbacks/Strategy:** Flexible plugins for varying behavior. \nGood code is like good writing: clear, structured, and easy to follow."
    }
  };

  return <TopicPage {...pageContent} />;
}
