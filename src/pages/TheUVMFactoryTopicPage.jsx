import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function TheUVMFactoryTopicPage() {
  const pageContent = {
    title: "The UVM Factory",
    elevatorPitch: {
      definition: "The UVM factory is a central database and mechanism used to create UVM objects (data items like transactions) and components (structural elements like drivers or monitors) by their type name. Its primary power lies in enabling 'overrides,' where a test can instruct the factory to produce a modified or extended version of a component/object instead of the default one, without altering the core testbench code that requests the creation.",
      analogy: "Think of the UVM factory like a sophisticated 3D printer for testbench parts. You **register** your part designs (classes with `_utils` macros) with the printer's software. When you need a part, you ask the printer to **create** it by its design name (`type_id::create()`). The magic happens with **overrides**: for a special project (a specific test), you can tell the printer, 'When the blueprint calls for a standard 'WidgetA' (base class), actually print this enhanced 'WidgetA_Turbo' (derived class) instead.' The main assembly instructions (testbench environment) don't change, but they get the specialized part, enabling targeted testing.",
      why: "The UVM factory is crucial for building highly reusable and flexible verification environments. It allows for: \n1. **Test-Specific Behavior:** Easily substitute components (e.g., an error-injecting driver for a standard one) or transactions (e.g., a constrained packet type) on a per-test basis without changing common environment code. \n2. **Reduced Code Duplication:** Avoids copying and modifying entire environments for minor variations. \n3. **Scalability:** Makes it easier to manage complex environments by decoupling the basic structure from test-specific variations. \n4. **Polymorphism Enablement:** It's a key enabler of polymorphism in testbenches, as the requesting code uses a base type handle, but the factory can provide a derived type object."
    },
    practicalExplanation: {
      coreMechanics: `The UVM factory mechanism revolves around a few core operations:

**1. Registration (Making Types Known to the Factory):**
   - Before the factory can create an object or component of a certain class, that class must be 'registered' with the factory.
   - This is done using utility macros provided by UVM:
     - For classes derived from \`uvm_object\` (e.g., transactions, configurations): \`\`uvm_object_utils(class_name)\`
     - For classes derived from \`uvm_component\` (e.g., drivers, monitors, environments): \`\`uvm_component_utils(class_name)\`
   - These macros define static helper functions and a proxy object (e.g., \`type_id\`) for the class, and add the class type to the factory's internal registry, associating the class with its string name.

**2. Creation (Requesting Objects/Components from the Factory):**
   - Instead of calling the class constructor directly using \`new()\`, you request an instance from the factory using the static \`create()\` method, accessed via the \`type_id\` proxy.
   - For components: \`component_type::type_id::create(string instance_name, uvm_component parent);\`
     - Example: \`my_driver d = my_driver::type_id::create("d0", this);\`
   - For objects: \`object_type::type_id::create(string instance_name);\`
     - Example: \`my_transaction t = my_transaction::type_id::create("t1");\`
   - The \`create()\` method internally calls the constructor (\`new()\`) of the appropriate type after resolving any overrides.

**3. Overrides (Customizing What Gets Created):**
   - This is the factory's most powerful feature. Overrides allow you to change what type of object or component is created when a specific type is requested.
   - Overrides are typically configured in the \`build_phase\` of a higher-level component, usually the test (\`uvm_test\`).
   - **Type Override:** Replaces *all* requests for an original type with an override type, either globally or within a specific component hierarchy.
     - Global using factory instance: \`factory.set_type_override_by_type(original_type::get_type(), override_type::get_type(), replace = 1);\`
     - Global using type_id: \`original_type::type_id::set_type_override(override_type::get_type(), replace = 1);\`
   - **Instance Override:** Replaces a request for an original type only when it's for a *specific instance*, identified by its full hierarchical path.
     - Using factory instance: \`factory.set_inst_override_by_type(original_type::get_type(), override_type::get_type(), "uvm_test_top.env.agent.specific_component_name");\`
     - Using type_id: \`original_type::type_id::set_inst_override(override_type::get_type(), "uvm_test_top.env.agent.specific_component_name");\`
   - The \`replace\` flag (defaults to 1) in \`set_type_override_by_type\` and \`set_type_override\` controls whether this new override replaces a previous one for the same original type.

**4. The Factory Object (\`uvm_factory\`):**
   - The factory itself is a global singleton object. You can get a handle to it via \`uvm_factory::get();\`.
   - While overrides can often be set via the static \`type_id\` of the class being overridden, direct factory methods offer more detailed control and debugging capabilities.

**How Overrides are Resolved by \`create()\ `:**
   When \`original_type::type_id::create(name, parent)\` is called:
   1. The factory first checks for an **instance override** that matches the \`original_type\` and the full hierarchical path of the requested instance (\`parent.get_full_name() + "." + name\`). If found, an instance of the specified \`override_type_for_instance\` is created.
   2. If no instance override is found, the factory checks for a **type override** that matches the \`original_type\` and applies to the current hierarchical scope (or globally). If found, an instance of the specified \`override_type_for_type\` is created.
   3. If no overrides are found, an instance of the \`original_type\` is created.

**Requirements for an Override Type:**
   - The overriding class (e.g., \`error_driver\`) *must* be a subclass of (derived from) the original class (e.g., \`base_driver\`). This ensures that the code expecting the original type can use the overriding type polymorphically (i.e., the overriding type has all the methods and properties of the original, plus potentially more).

**Common Use Cases for Factory Overrides:**
-   **Error Injection:** Replacing a standard driver with one that injects errors into transactions.
-   **Extended Functionality:** Substituting a basic monitor with an advanced one that performs more complex checks or gathers more detailed coverage.
-   **Stimulus Variation:** Overriding a base sequence with a more specific or constrained sequence to target particular DUT features.
-   **Configuration Object Swapping:** Replacing a default configuration object with one tailored for a specific test scenario.
-   **Debugging:** Temporarily overriding a component with a version that has more diagnostic messages.`,
      codeExamples: [
        {
          description: "Registering classes and creating them with the factory (Type Override):",
          code:
`import uvm_pkg::*;
\`include "uvm_macros.svh"

// Base transaction
class base_pkt extends uvm_sequence_item;
  rand int data;
  \`uvm_object_utils_begin(base_pkt)
    \`uvm_field_int(data, UVM_DEFAULT)
  \`uvm_object_utils_end
  function new(string name="base_pkt"); super.new(name); endfunction
  virtual function string get_type_info(); return "base_pkt"; endfunction
  virtual function void display_content(); \`uvm_info("PKT_INFO", $sformatf("Type: %s, Data: %0d", get_type_info(), data), UVM_LOW); endfunction
endclass

// Extended transaction
class ext_pkt extends base_pkt;
  rand bit error_bit;
  \`uvm_object_utils_begin(ext_pkt)
    \`uvm_field_int(error_bit, UVM_DEFAULT)
  \`uvm_object_utils_end
  function new(string name="ext_pkt"); super.new(name); endfunction
  virtual function string get_type_info(); return "ext_pkt"; endfunction
  virtual function void display_content(); \`uvm_info("PKT_INFO", $sformatf("Type: %s, Data: %0d, Error: %b", get_type_info(), data, error_bit), UVM_LOW); endfunction
endclass

// Component that creates packets
class pkt_generator extends uvm_component;
  \`uvm_component_utils(pkt_generator)
  base_pkt pkt_handle; // Handle to hold created packet

  function new(string name="pkt_gen", uvm_component parent=null); super.new(name, parent); endfunction

  virtual task run_phase(uvm_phase phase);
    phase.raise_objection(this, "Starting packet generation");
    // Create packet using factory, requesting base_pkt
    pkt_handle = base_pkt::type_id::create("pkt_inst");
    if (pkt_handle == null) \`uvm_fatal("FACTORY_FAIL", "Factory failed to create packet")
    void'(pkt_handle.randomize());
    pkt_handle.display_content(); // Will show actual type created by factory
    #10;
    phase.drop_objection(this, "Finished packet generation");
  endtask
endclass

// Test that uses default packet type
class test_default_pkt extends uvm_test;
  \`uvm_component_utils(test_default_pkt)
  pkt_generator gen;
  function new(string name="test_default_pkt", uvm_component parent=null); super.new(name,parent); endfunction
  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    gen = pkt_generator::type_id::create("gen", this);
    \`uvm_info(get_name(), "Running with default packet type.", UVM_MEDIUM);
  endfunction
  virtual task run_phase(uvm_phase phase); phase.raise_objection(this); #20; phase.drop_objection(this); endtask
endclass

// Test that overrides base_pkt with ext_pkt for all instances
class test_override_pkt extends uvm_test;
  \`uvm_component_utils(test_override_pkt)
  pkt_generator gen;
  function new(string name="test_override_pkt", uvm_component parent=null); super.new(name,parent); endfunction
  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    \`uvm_info(get_name(), "Overriding base_pkt with ext_pkt globally.", UVM_MEDIUM);
    // Type override:
    base_pkt::type_id::set_type_override(ext_pkt::get_type());
    // Alternative: factory.set_type_override_by_type(base_pkt::get_type(), ext_pkt::get_type());
    gen = pkt_generator::type_id::create("gen", this);
  endfunction
  virtual task run_phase(uvm_phase phase); phase.raise_objection(this); #20; phase.drop_objection(this); endtask
endclass

module top_factory_example;
  import uvm_pkg::*;
  initial begin
    // To see default behavior:
    // run_test("test_default_pkt");
    // To see override behavior:
    run_test("test_override_pkt");
  end
endmodule`
        },
        {
          description: "Instance Override Example (Driver Scenario):",
          code:
`import uvm_pkg::*;
\`include "uvm_macros.svh"

// Base Driver
class base_driver extends uvm_driver;
  \`uvm_component_utils(base_driver)
  function new(string name="base_driver", uvm_component parent=null); super.new(name,parent); endfunction
  virtual task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    \`uvm_info(get_full_name(), "Base driver running.", UVM_MEDIUM);
    #10;
    phase.drop_objection(this);
  endtask
endclass

// Error Injecting Driver
class error_driver extends base_driver;
  \`uvm_component_utils(error_driver)
  function new(string name="error_driver", uvm_component parent=null); super.new(name,parent); endfunction
  virtual task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    \`uvm_info(get_full_name(), "*** Error Injector Driver running (OVERRIDDEN)! ***", UVM_MEDIUM);
    #10;
    phase.drop_objection(this);
  endtask
endclass

// Environment with two drivers
class my_env extends uvm_env;
  \`uvm_component_utils(my_env)
  base_driver driver0; // Will remain base_driver
  base_driver driver1; // Will be overridden to error_driver in a specific test

  function new(string name="my_env", uvm_component parent=null); super.new(name,parent); endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    driver0 = base_driver::type_id::create("driver0", this);
    driver1 = base_driver::type_id::create("driver1", this);
  endfunction
endclass

// Test that uses instance override
class test_inst_override extends uvm_test;
  \`uvm_component_utils(test_inst_override)
  my_env env_inst;
  function new(string name="test_inst_override", uvm_component parent=null); super.new(name,parent); endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env_inst = my_env::type_id::create("env_inst", this);

    // Instance override for "uvm_test_top.env_inst.driver1"
    // When base_driver is requested for this specific path, create error_driver.
    \`uvm_info(get_name(), "Setting instance override for env_inst.driver1 to error_driver.", UVM_MEDIUM);
    base_driver::type_id::set_inst_override(error_driver::get_type(), "uvm_test_top.env_inst.driver1");
    // Alternative: factory.set_inst_override_by_type(base_driver::get_type(), error_driver::get_type(), "uvm_test_top.env_inst.driver1");

    // Note: The env_inst.driver1 instance has already been created by env_inst's build_phase *before* this override.
    // For the override to take effect on env_inst.driver1, the override must be set *before* env_inst.driver1 is created.
    // This example illustrates where to set it, but a common pattern is for the test to create child components
    // or for the environment to check for overrides before creating its children if such dynamic behavior is needed post-construction.
    // A more typical scenario: the test sets overrides, then env is created, then env creates its children, picking up the overrides.
    // For this specific example to work as shown, env's build_phase would need to be called *after* this override is set,
    // or the component being overridden ("driver1") must be created by the test itself or after the override is set.
    // The key is: overrides must be in place *before* the factory 'create()' call they are meant to affect.
  endfunction
  virtual task run_phase(uvm_phase phase); phase.raise_objection(this); #50; phase.drop_objection(this); endtask
endclass

module top_factory_inst_example;
  import uvm_pkg::*;
  initial begin
    // To make the instance override effective as written, the test would typically
    // call the factory 'create' for the component it's overriding, or the environment
    // would be structured to allow overrides from parent tests before its own children are built.
    // For simplicity of this example, let's assume the override is set in a higher-level build_phase
    // or the component creation order allows it. The printout in error_driver will confirm if it worked.
    run_test("test_inst_override");
  end
endmodule`
        }
      ],
      visualizations: [
        { description: "Flowchart showing factory `create()` call with checks for instance and type overrides. Highlights the decision points.", altText: "UVM Factory Create Call Flow" },
        { description: "Diagram illustrating a testbench hierarchy. Shows ComponentA (base_driver) and ComponentB (base_driver). A type override changes both to error_driver. An instance override changes only ComponentB to error_driver.", altText: "Factory Overrides in Hierarchy: Type vs. Instance" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **String-based Overrides:** Types can be overridden by their string names (\`factory.set_type_override_by_name("original_type_str", "override_type_str")\`). This is less safe than \`::get_type()\` as it bypasses some compile-time checks and is prone to typos, but can be useful in scripts or tool-generated scenarios.
      - **Debugging the Factory:** UVM factory provides debugging capabilities. \`factory.print(printer)\` prints the factory's state (registered types, active overrides). Setting \`factory.set_ Ciò che segue è la continuazione della precedente risposta: debug_create_by_name("type_name", 1)\` or \`factory.set_debug_create_by_type(type_proxy, 1)\` enables verbose output when that type is created.
      - **Factory and \`uvm_config_db\`:** These are often used together. A test might override a component type and then use \`uvm_config_db\` to pass specific configuration parameters to that newly overridden instance.
      - **Order of Precedence for Overrides:** Instance overrides are more specific and take precedence over type overrides. If multiple overrides of the same kind (e.g., two type overrides for the same original type) are set, the last one set generally takes effect for the applicable scope.
      - **The \`replace\` argument:** When setting type overrides (e.g., \`factory.set_type_override_by_type(orig, over, replace=1)\`), the \`replace\` flag (defaults to 1) means this override will replace any existing type override for the same original type. If \`replace=0\`, it only takes effect if no override for that original type exists yet.
      - **Factory for Sequences (\`uvm_sequence_base\` derived):** Sequences are also \`uvm_object\`s and are typically started on a sequencer. The sequences themselves can be created by the factory, and thus overridden. This is a powerful way to change the stimulus generated in a test without altering the core sequencer or environment code. For example, a default sequence might be overridden by one that generates more complex or error-inducing scenarios.
      - **Hierarchical Override Paths:** Instance override paths are absolute from \`uvm_test_top\`. Careful construction of these paths is necessary. Wildcards are generally not supported in standard UVM factory instance override paths.
      - **Factory Callbacks:** While not strictly factory, UVM callbacks offer another way to modify component behavior non-intrusively, sometimes used as an alternative or complement to factory overrides for more fine-grained modifications of existing methods.
      Common Pitfalls:
      - **Forgetting \`_utils\` Macro:** If a class isn't registered with \`uvm_component_utils\` or \`uvm_object_utils\`, the factory won't know about it, and \`type_id::create()\` or overrides will fail.
      - **Incorrect Instance Path:** Typos or misunderstandings of the full hierarchical path for an instance override are common, leading to the override not taking effect.
      - **Invalid Subtype:** The overriding class *must* be a derivative of the original class. Attempting to override with an unrelated type will cause an error.
      - **Timing of Override Calls:** Overrides *must* be set *before* the factory \`create()\` call they are intended to affect. Setting an override after the object/component has already been created will have no effect on that instance. This is typically why overrides are done early in the \`build_phase\`.
      - **Global vs. Local Impact:** Misunderstanding whether a type override is global or scoped to a particular hierarchy if not set carefully.
      - **Overuse:** While powerful, relying too heavily on deeply nested or very numerous overrides can sometimes make testbench behavior harder to trace. A balance with clear configuration and well-structured base components is important.`,
      experienceView: `A senior UVM engineer views the factory as an indispensable tool for creating truly reusable and adaptable verification IP and test environments.
      - **Enabling Test Reusability:** The factory is key to writing one environment that can be easily specialized for hundreds of different tests just by changing overrides and configurations at the test level.
      - **Decoupling Tests from Environment:** Tests specify *what* to achieve (e.g., "test error handling") and use overrides to inject the necessary behavior, rather than having the environment contain complex conditional logic for every possible test scenario.
      - **Strategic Override Placement:** They understand where to set overrides (e.g., in a base test for common variations, or in specific leaf tests for unique scenarios) to manage complexity.
      - **Debugging Override Issues:** Proficient in using factory debug prints and hierarchical context to quickly resolve why an override isn't working as expected. They often check \`uvm_factory::print(1)\` to see the current state of overrides.
      - **Designing for Overridability:** When creating base components or sequences, they anticipate how they might be overridden and design them with clear virtual methods and extension points.
      In code reviews, they will scrutinize: "Is this factory override the cleanest way to achieve this customization?", "Is the instance path for this override robust?", "Is the overriding class a proper child of the original?", "Is the override being set at the correct point in the build sequence (before creation)?", "Are there any potential interactions with other overrides that might be confusing?". The goal is always clarity, maintainability, and achieving the desired test-specific behavior with minimal intrusion.`,
      retentionTip: "UVM Factory: Your Testbench's 'Master Polymorpher'. **1. Register** types (\`_utils\`). **2. Create** via \`type_id::create()\`. **3. Override** in tests (\`set_type_override\` for broad changes, \`set_inst_override\` for targeted swaps) *before creation*. This lets you swap a 'Toyota' for a 'Ferrari' without rewriting the 'rules of the road' (your environment code)."
    }
  };

  return <TopicPage {...pageContent} />;
}
