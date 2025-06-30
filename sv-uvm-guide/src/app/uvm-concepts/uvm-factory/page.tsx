// app/uvm-concepts/uvm-factory/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const UVMFactoryPage = () => {
  const pageTitle = "The UVM Factory";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear definition of the UVM factory as a mechanism for creating UVM objects and components by type or by registered string name, enabling late binding and overrides, from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for UVM factory, e.g., "Think of the UVM factory like a car factory that can produce different models (base car, sports car, luxury car) from the same 'car' blueprint, and you can request specific models or even swap them out without changing the assembly line instructions," from blueprint].</p>
      <p><strong>The "Why":</strong> [Placeholder: Core problem the factory solves – enabling test-specific customization and replacement of components/objects without modifying the original testbench code, promoting reusability and flexibility, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics:</strong> [Placeholder: Detailed explanation of factory registration macros (`uvm_object_utils`, `uvm_component_utils`). `create()` method. Type overrides (`set_type_override_by_type`, `set_type_override_by_name`). Instance overrides (`set_inst_override_by_type`, `set_inst_override_by_name`). Debugging factory operations, from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Example of classes and factory registration from blueprint
import uvm_pkg::*;
\`include "uvm_macros.svh"

class base_transaction extends uvm_sequence_item;
  rand int data;
  \`uvm_object_utils_begin(base_transaction)
    \`uvm_field_int(data, UVM_DEFAULT)
  \`uvm_object_utils_end
  function new(string name = "base_transaction"); super.new(name); endfunction
endclass

class extended_transaction extends base_transaction;
  rand int extra_field;
  \`uvm_object_utils_begin(extended_transaction)
    \`uvm_field_int(extra_field, UVM_DEFAULT)
  \`uvm_object_utils_end
  function new(string name = "extended_transaction"); super.new(name); endfunction
endclass

class my_driver extends uvm_driver #(base_transaction);
  \`uvm_component_utils(my_driver)
  // ... constructor ...
  virtual task run_phase(uvm_phase phase);
    base_transaction tr;
    // Instead of: tr = new();
    tr = base_transaction::type_id::create("tr"); // Create via factory
    assert(tr.randomize());
    // ... drive tr ...
  endtask
endclass

// Placeholder: Example of an override in a test from blueprint
class test_with_override extends uvm_test;
  \`uvm_component_utils(test_with_override)
  my_driver driver; // Assume this is instantiated in build_phase

  function new(string name = "test_with_override", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // Override all base_transactions with extended_transactions
    factory.set_type_override_by_type(base_transaction::get_type(), extended_transaction::get_type());

    // Instance override for a specific path (if driver path is "env.agent.driver")
    // factory.set_inst_override_by_type("env.agent.driver.tr",
    //                                   base_transaction::get_type(),
    //                                   extended_transaction::get_type());
    driver = my_driver::type_id::create("driver", this);
  endfunction
  // ...
endclass`}
        language="systemverilog"
        fileName="uvm_factory_example.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of factory registration, creation by type, and type/instance overrides, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="UVM Factory Override Mechanism" />
      <p>[Placeholder: Description of a diagram illustrating how the factory checks for overrides before creating an object/component instance, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of factory patterns like abstract factory, debugging factory issues (`+uvm_factory_trace`), string-based vs. type-based creation/overrides, factory verbosity control, limitations, and interactions with parameterized classes, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer's perspective on effective factory usage. When to use type vs. instance overrides. Strategies for managing overrides in large projects. Performance considerations of factory lookups. Common pitfalls, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for remembering factory concepts. E.g., "Factory = UVM's 'Switchboard Operator' for object creation. `_utils` macros 'register' your type, `create()` 'dials the number', overrides 'redirect the call'," from blueprint].</p>
    </>
  );

  return (
    <TopicPage
      title={pageTitle}
      level1Content={level1Content}
      level2Content={level2Content}
      level3Content={level3Content}
    />
  );
};

export default UVMFactoryPage;
