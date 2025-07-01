// app/uvm-concepts/ral/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const UvmRalPage = () => {
  const pageTitle = "UVM Register Abstraction Layer (RAL)";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear definition of UVM RAL as a standardized way to model and access DUT registers from the testbench, abstracting physical bus details, from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for RAL, e.g., &quot;Think of RAL like a &apos;universal remote control&apos; for your DUT&apos;s registers. You know the button names (register names) and what they do, without needing to know the infrared codes (bus protocol) for each specific TV (DUT),&quot; from blueprint].</p>
      <p><strong>The &quot;Why&quot;:</strong> [Placeholder: Core problem RAL solves – simplifying register access, enabling reusable register tests (like frontdoor/backdoor access), integrating with functional coverage for register activity, and managing complex register maps, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics:</strong> [Placeholder: Detailed explanation of `uvm_reg`, `uvm_reg_field`, `uvm_reg_block`, `uvm_reg_map`. Adapter class for bus translation. Frontdoor vs. backdoor access. Built-in register test sequences (e.g., `uvm_reg_hw_reset_seq`). Integration with UVM environment, from blueprint].</p>
      <p><strong>RAL Model Generation:</strong> [Placeholder: Brief overview of how RAL models are often generated from register specification formats like IP-XACT, CSV, or proprietary tools, from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Conceptual RAL Model Structure (often auto-generated) from blueprint
class my_reg_block extends uvm_reg_block;
  \`uvm_object_utils(my_reg_block)

  rand logic [31:0] base_addr_ral; // Simplified: Was uvm_reg_addr_t, potential parse issue

  // Register definitions
  rand control_reg CTRL;
  rand status_reg  STATUS;
  // ... other registers ...

  uvm_reg_map   reg_map;

  function new(string name = "my_reg_block");
    super.new(name, get_full_name(), UVM_NO_COVERAGE); // Coverage setup would differ
  endfunction

  virtual function void build();
    // Create register map
    this.reg_map = create_map("reg_map", base_addr_ral, 4, UVM_LITTLE_ENDIAN, .byte_addressing(0));

    // Instantiate and configure registers
    this.CTRL = control_reg::type_id::create("CTRL",,get_full_name());
    this.CTRL.configure(this, null, ""); // this = parent block
    this.CTRL.build(); // Important for fields
    this.reg_map.add_reg(this.CTRL, 32'h00, "RW"); // Simplified: Was \`UVM_REG_ADDR_WIDTH'h00

    this.STATUS = status_reg::type_id::create("STATUS",,get_full_name());
    this.STATUS.configure(this, null, "");
    this.STATUS.build();
    this.reg_map.add_reg(this.STATUS, 32'h04, "RO"); // Simplified

    // lock_model(); // After all registers are added
  endfunction
endclass

// Placeholder: Accessing a register in a sequence/test from blueprint
// Assume 'ral_model' is a handle to the instantiated my_reg_block
// Assume 'reg_adapter' is an instantiated uvm_reg_adapter
// Assume 'reg_map' is the map inside ral_model (usually default_map)

// ral_model.default_map.set_sequencer(my_sequencer, reg_adapter); // In env connect phase

// In a sequence:
// uvm_status_e status;
// uvm_reg_data_t data_val;
// ral_model.CTRL.write(status, 8'hAB); // Frontdoor write
// ral_model.STATUS.read(status, data_val); // Frontdoor read
// ral_model.CTRL.poke(status, 8'hCD); // Backdoor write (if path configured)
// ral_model.STATUS.peek(status, data_val); // Backdoor peek
`}
        language="systemverilog"
        fileName="uvm_ral_example.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of the RAL block structure, register definition, map creation, and example register access methods, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="RAL Model and DUT Interaction" />
      <p>[Placeholder: Description of a diagram showing the RAL model in the testbench, its connection to the DUT via an adapter and bus agent, and the concept of frontdoor/backdoor paths, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of complex register types (aliased, indirect), memories within RAL, multi-map support, register coverage (`uvm_reg_cvr_t`), predicting register values, integrating RAL with Scoreboards, custom backdoor mechanisms, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer&apos;s best practices for RAL model development and integration. Strategies for handling complex register behaviors. Debugging RAL issues (e.g., bus errors, incorrect read/write values). Importance of accurate RAL model for verification quality, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for RAL. E.g., &quot;RAL: Your DUT&apos;s &apos;Control Panel&apos; in software. RegBlock=Panel, Reg=Button/Display, Field=Part of Button/Display. Map=Wiring Diagram. Adapter=Translator to Bus Language,&quot; from blueprint].</p>
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

export default UvmRalPage;
