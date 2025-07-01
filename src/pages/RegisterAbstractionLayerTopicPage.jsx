import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function RegisterAbstractionLayerTopicPage() {
  const pageContent = {
    title: "UVM Register Abstraction Layer (RAL)",
    elevatorPitch: {
      definition: "The UVM Register Abstraction Layer (RAL) provides a set of base classes and a methodology for creating a high-level, object-oriented model of the DUT's registers and memory-mapped resources. This model allows testbench sequences to interact with DUT registers (read, write, mirror, check) by name and field, abstracting away the underlying bus protocol details.",
      analogy: "Think of RAL like a 'Smart Remote Control' for your DUT's complex settings panel (its registers). Instead of manually flipping dozens of tiny switches (individual register bits via bus transactions), you have buttons on your remote labeled 'Set Volume' or 'Change Channel' (RAL methods like \`reg_A.field_X.write(value)\`). The remote knows how to translate your high-level command into the correct sequence of switch flips. It also has a 'Display' that shows the current settings (mirrored values) and can even 'Self-Test' if the display matches the actual panel (consistency checks).",
      why: "RAL is crucial for verifying designs with many registers because: \n1.  **Abstraction:** Simplifies test writing by allowing register access by name, not by address or bus protocol specifics. \n2.  **Reusability:** The register model can be reused across different tests and even projects if the register map is consistent. Bus-specific adapter code is localized. \n3.  **Maintainability:** If register addresses or bit fields change, only the RAL model needs updating, not every test sequence that accesses registers. \n4.  **Built-in Checks:** RAL provides mechanisms for checking register values against expected (mirrored) values, aiding in DUT state verification. \n5.  **Frontdoor/Backdoor Access:** Supports both realistic bus-based access (frontdoor) and faster, direct simulator access (backdoor) for different verification needs."
    },
    practicalExplanation: {
      coreMechanics: `UVM RAL consists of several key class types that model the DUT's register map:

**1. Register Field (\`uvm_reg_field\`):**
   - Represents an individual field within a register (a group of bits).
   - Stores properties like access policy (RW, RO, WO, etc.), reset value, size, LSB position.
   - Provides methods like \`write()\`, \`read()\`, \`get()\`, \`set()\`, \`mirror()\`.

**2. Register (\`uvm_reg\`):**
   - Represents a single DUT register.
   - Contains one or more \`uvm_reg_field\` objects.
   - Provides methods like \`write()\`, \`read()\`, \`update()\`, \`mirror()\`, \`predict()\`.
   - Manages the overall register value and interaction with fields.

**3. Register File (\`uvm_reg_file\`):**
   - An optional container for grouping related registers, potentially within a specific address range. Not always used.

**4. Register Block (\`uvm_reg_block\`):**
   - Represents a collection of registers, register files, and potentially other register blocks, forming a hierarchical model of the DUT's register space.
   - This is typically the top-level container for the RAL model.
   - It's where the address map is defined, mapping register names to their offsets.

**5. Register Map (\`uvm_reg_map\`):**
   - Contained within a \`uvm_reg_block\`.
   - Defines how registers are accessed over a specific bus interface (e.g., APB, AXI). It maps register addresses within the block to system-level addresses on the bus.
   - A block can have multiple maps if accessible via different bus interfaces or address schemes.

**RAL Model Generation:**
-   RAL models can be written manually, but this is tedious and error-prone for large designs.
-   More commonly, they are **auto-generated** from a specification format like IP-XACT, CSV, SystemRDL, or custom scripts. This ensures consistency with the design specification.

**Key Operations and Concepts:**

-   **Mirroring:** RAL maintains a "mirrored" value for each register, representing the testbench's belief about the register's current state in the DUT.
    -   **Explicit Prediction:** After a frontdoor write, the mirrored value is updated automatically if \`uvm_reg_predictor\` is used.
    -   **Passive Prediction:** A bus monitor can observe bus traffic and update mirrored values via a predictor.
    -   **Auto-Prediction:** The default. Mirrored value updated upon completion of \`read()\` or \`write()\` operations.
    -   \`reg_obj.mirror()\`: Reads the DUT register and updates the mirrored value. Useful for checking consistency.

-   **Frontdoor Access:**
    -   Register reads/writes are performed by converting the abstract register operation into actual bus transactions (sequence items) on the physical DUT interface.
    -   Requires a **Register Adapter (\`uvm_reg_adapter\`):** A user-written class that translates generic \`uvm_reg_bus_op\` (read/write operations with address, data, kind) into bus-specific sequence items (e.g., \`apb_transfer\`) and vice-versa.
    -   The adapter is associated with a \`uvm_reg_map\`.
    -   A **Sequencer Handle** for the bus agent must be provided to the RAL model (\`reg_model.map.set_sequencer(bus_agent.sequencer, adapter)\`) so it knows where to send the bus transactions.

-   **Backdoor Access:**
    -   Directly modifies or reads DUT register values using simulator mechanisms (e.g., SystemVerilog DPI, VPI/PLI), bypassing the bus protocol.
    -   Much faster than frontdoor access. Useful for initializing registers quickly or for debug.
    -   Requires user-written C code (for DPI) or specific tool commands linked via the UVM backdoor interface methods (\`uvm_reg::read_backdoor()\`, \`uvm_reg::write_backdoor()\`).
    -   \`reg_obj.write(status, value, UVM_BACKDOOR)\`; \`reg_obj.read(status, value, UVM_BACKDOOR)\`.

-   **Predictor Component (\`uvm_reg_predictor\`):**
    -   A component that connects to a bus monitor's analysis port.
    -   When the monitor broadcasts observed bus transactions, the predictor uses the adapter to convert them back into \`uvm_reg_bus_op\` and updates the mirrored values of the corresponding registers in the RAL model. This keeps the RAL model passively synchronized with DUT state changes caused by any bus master.

**Integration into UVM Environment:**
1.  Generate or write the RAL model (classes derived from \`uvm_reg_block\`, \`uvm_reg\`, \`uvm_reg_field\`).
2.  In the environment's \`build_phase\`, create an instance of the top-level register block.
3.  If using frontdoor access:
    -   Create and configure the bus agent (driver, sequencer, monitor).
    -   Create an instance of the register adapter.
    -   In the \`connect_phase\`, associate the adapter and the bus agent's sequencer with the RAL model's default map: \`ral_model.default_map.set_sequencer(bus_agent.sequencer, adapter_h);\`
    -   Optionally, connect a predictor to the bus monitor's analysis port and to the RAL model's map.
4.  Sequences can then get a handle to the RAL model (e.g., via \`uvm_config_db\` or \`p_sequencer\`) and perform register operations.
    -   Example: \`ral_model.reg_A.write(status, 8'h5A);\`
    -   Example: \`ral_model.reg_B.field_X.read(status, field_val);\`
`,
      codeExamples: [
        {
          description: "Simplified RAL Model Definition (Manual):",
          code:
`// --- Register Field Definition (Conceptual) ---
// In a real RAL model, uvm_reg_field objects are created inside uvm_reg.

// --- Register Definition ---
class my_reg_A extends uvm_reg;
  \`uvm_object_utils(my_reg_A)
  rand uvm_reg_field F1; // Field 1
  rand uvm_reg_field F2; // Field 2

  function new(string name = "my_reg_A");
    super.new(name, 16, UVM_CVR_ALL); // 16-bit register, all coverage types
  endfunction

  virtual function void build(); // Called by UVM RAL internally
    // field_name, size, lsb_pos, access, volatile, reset_val, has_reset, is_rand, individually_accessible
    this.F1 = uvm_reg_field::type_id::create("F1");
    this.F1.configure(this, 8, 0, "RW", 0, 8'h0, 1, 1, 1); // 8 bits, LSB 0

    this.F2 = uvm_reg_field::type_id::create("F2");
    this.F2.configure(this, 4, 8, "RO", 0, 4'hA, 1, 0, 1); // 4 bits, LSB 8, Read-Only
  endfunction
endclass

// --- Register Block Definition (Top Level RAL Model) ---
class my_ral_block extends uvm_reg_block;
  \`uvm_object_utils(my_ral_block)
  rand my_reg_A REG_A; // Instance of our register
  rand uvm_reg  OTHER_REG; // Another generic register

  function new(string name = "my_ral_block");
    super.new(name, UVM_CVR_ALL);
  endfunction

  virtual function void build(); // Called by UVM RAL internally
    this.REG_A = my_reg_A::type_id::create("REG_A");
    this.REG_A.configure(this, null, ""); // Parent=this, no regfile, path=""
    this.REG_A.build(); // Call register's build to create fields

    this.OTHER_REG = uvm_reg::type_id::create("OTHER_REG");
    this.OTHER_REG.configure(this, null, "");
    // OTHER_REG would also define its fields in its own build() if it were a custom class

    // Define the default address map for this block
    this.default_map = create_map(
      .name("default_map"),
      .base_addr(32'h0000),    // Base address for this block on the bus
      .n_bytes(4),            // Bus width in bytes
      .endian(UVM_LITTLE_ENDIAN)
    );
    // Add registers to the map with their offsets
    this.default_map.add_reg(this.REG_A,     \`uvm_reg_addr_t'(32'h04), "RW");
    this.default_map.add_reg(this.OTHER_REG, \`uvm_reg_addr_t'(32'h08), "RW");
    // ... add other registers ...

    // Lock the model after all additions
    this.lock_model();
  endfunction
endclass`
        },
        {
          description: "Register Adapter Example (Conceptual for APB):",
          code:
`// Assuming apb_transfer is a uvm_sequence_item for APB bus
class my_apb_adapter extends uvm_reg_adapter;
  \`uvm_object_utils(my_apb_adapter)

  function new(string name = "my_apb_adapter");
    super.new(name);
    provides_responses = 0; // APB typically doesn't have separate response phase for writes
    supports_byte_enable = 0;
  endfunction

  // Convert generic uvm_reg_bus_op to APB transaction
  virtual function uvm_sequence_item reg2bus(const ref uvm_reg_bus_op rw);
    apb_transfer apb = apb_transfer::type_id::create("apb_transfer_from_adapter");
    apb.addr   = rw.addr;
    apb.data   = rw.data; // For writes
    apb.kind   = (rw.kind == UVM_READ) ? apb_transfer::READ : apb_transfer::WRITE;
    // ... set other APB specific fields like prot, sel etc. ...
    return apb;
  endfunction

  // Convert APB transaction result back to uvm_reg_bus_op
  virtual function void bus2reg(uvm_sequence_item bus_item, ref uvm_reg_bus_op rw);
    apb_transfer apb;
    if (!$cast(apb, bus_item)) begin
      \`uvm_fatal("ADAPT_CAST", "Failed to cast bus_item to apb_transfer")
      return;
    end
    rw.kind = (apb.kind == apb_transfer::READ) ? UVM_READ : UVM_WRITE;
    rw.addr = apb.addr;
    rw.data = apb.data; // For reads, this is read data
    rw.status = UVM_IS_OK; // Or UVM_NOT_OK if APB had an error
  endfunction
endclass`
        },
        {
          description: "Using RAL model in a sequence:",
          code:
`class reg_access_seq extends uvm_sequence;
  \`uvm_object_utils(reg_access_seq)
  my_ral_block ral_model_h; // Handle to the RAL model

  function new(string name="reg_access_seq"); super.new(name); endfunction

  virtual task body();
    uvm_status_e status;
    uvm_reg_data_t read_val;

    // Get RAL model handle (e.g., from config_db or p_sequencer if set up)
    if (ral_model_h == null) begin
      // In a real test, this would be passed via config_db to the sequencer,
      // and the sequence would get it from p_sequencer.ral_model (if sequencer has such a handle)
      // or p_sequencer.get_ral_model() if a method exists.
      // For simplicity here, assume it's somehow set.
      uvm_config_db#(my_ral_block)::get(p_sequencer, "", "ral_model", ral_model_h);
      if (ral_model_h == null) \`uvm_fatal("RAL_SEQ", "RAL model handle not found")
    end

    \`uvm_info(get_name(), "Starting register access sequence", UVM_MEDIUM)

    // Write to REG_A.F1 field
    ral_model_h.REG_A.F1.write(status, 8'hA5, UVM_FRONTDOOR, ral_model_h.default_map, this);
    if (status != UVM_IS_OK) \`uvm_error("RAL_WRITE_FAIL", "Failed to write REG_A.F1")

    // Write to entire REG_A
    ral_model_h.REG_A.write(status, 16'h1234, UVM_FRONTDOOR, ral_model_h.default_map, this);

    // Read from REG_A.F2 field
    ral_model_h.REG_A.F2.read(status, read_val, UVM_FRONTDOOR, ral_model_h.default_map, this);
    \`uvm_info(get_name(), $sformatf("Read REG_A.F2 value: 0x%h", read_val), UVM_MEDIUM)

    // Mirror check (read from DUT and compare with mirrored value)
    ral_model_h.REG_A.mirror(status, UVM_CHECK, UVM_FRONTDOOR, ral_model_h.default_map, this);
    if (status != UVM_IS_OK) \`uvm_error("RAL_MIRROR_FAIL", "REG_A mirror check failed")

    // Example of updating a field and then the register
    ral_model_h.REG_A.F1.set(8'hC3); // Set desired value in RAL model for F1
    ral_model_h.REG_A.update(status, UVM_FRONTDOOR, ral_model_h.default_map, this); // Writes only if desired != mirrored

  endtask
endclass`
        }
      ],
      visualizations: [
        { description: "Block diagram of RAL components: Reg Block, Reg, Field, Map, Adapter, Sequencer, and Predictor, showing connections.", altText: "UVM RAL Component Diagram" },
        { description: "Flowchart of a RAL frontdoor write operation (Sequence -> RAL method -> Adapter -> Sequencer -> Driver -> DUT) and the predict path.", altText: "RAL Frontdoor Write Flow" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Register Callbacks:** \`uvm_reg_cb\` and \`uvm_reg_field_cb\` allow users to add custom actions before or after standard RAL operations (read, write). Useful for logging, injecting delays, or side effects.
      - **Indirect Register Access:** For registers accessed via pointer registers. RAL supports modeling this.
      - **Aliased Registers:** Multiple register definitions mapping to the same physical address.
      - **Banked Registers:** Register banks selected by some other register's field value.
      - **Wide Registers:** Registers wider than the physical bus, requiring multiple bus cycles. RAL can manage this.
      - **Volatile Fields/Registers:** Fields whose values can change spontaneously (e.g., status bits updated by HW). Marked volatile so RAL doesn't assume mirrored value is always correct without a read.
      - **Built-in Sequences:** RAL provides pre-defined sequences like \`uvm_reg_hw_reset_seq\`, \`uvm_reg_bit_bash_seq\`, \`uvm_reg_access_seq\` for common register testing tasks.
      - **Coverage with RAL:** RAL components (\`uvm_reg\`, \`uvm_reg_field\`) have built-in coverage options (\`uvm_coverage_model_e\`: UVM_CVR_REG_BITS, UVM_CVR_ADDR_MAP, UVM_CVR_FIELD_VALS) to automatically collect coverage on register access and field values.
      - **Multiple Maps/Interfaces:** A single RAL model can have multiple \`uvm_reg_map\` instances if registers are accessible via different bus interfaces or address schemes. Operations need to specify which map to use.
      Common Pitfalls:
      - **Adapter Bugs:** Incorrect translation in the \`reg2bus\` or \`bus2reg\` adapter methods is a common source of issues.
      - **Sequencer/Adapter Not Set:** Forgetting to call \`map.set_sequencer()\` means frontdoor access will fail.
      - **Mirror Value Desynchronization:** If the predictor is missing or incorrect, or if backdoor writes are not properly predicted, the RAL model's mirrored values can become out of sync with the actual DUT hardware. This leads to false positives/negatives in checks.
      - **Complexity in Auto-Generation:** While auto-generation is preferred, the input specification (e.g., IP-XACT) must be accurate, and the generator tool might have its own quirks.
      - **Backdoor Access Issues:** DPI/PLI functions for backdoor access can be complex to implement and debug.
      - **Performance:** Extensive frontdoor access for all register operations can be slow. A mix of backdoor (for setup) and frontdoor (for testing bus access) is often optimal.`,
      experienceView: `A senior UVM engineer considers RAL indispensable for any non-trivial DUT with registers.
      - **Single Source of Truth:** The RAL model (ideally auto-generated) becomes the definitive reference for the DUT's register map for the verification team.
      - **Test Abstraction & Reusability:** Sequences are written at the register/field level, making them independent of specific bus protocols and highly reusable.
      - **Comprehensive Register Testing:** They leverage built-in RAL sequences and coverage models to thoroughly test register accessibility, reset values, and field interactions.
      - **Debugging Register Issues:** RAL's mirroring and built-in checking capabilities significantly speed up debugging of register-related DUT bugs. If a \`reg.mirror(UVM_CHECK)\` fails, it points directly to a discrepancy.
      - **Strategic Access Methods:** They choose between frontdoor and backdoor access based on the verification goal (speed vs. accuracy of bus path testing).
      - **Predictor Importance:** For designs where other bus masters can modify registers, a robust predictor setup is critical for keeping the RAL model accurate.
      In code reviews: "Is the RAL model generated or manually written? If manual, how is consistency ensured?", "Is the adapter logic correct for this bus protocol?", "How is the RAL model connected and configured in the environment?", "Are mirror values being properly maintained and checked?", "Is there a good balance of frontdoor/backdoor access in sequences?". They focus on the accuracy, completeness, and proper integration of the RAL model.`,
      retentionTip: "UVM RAL = Your DUT's 'Digital Twin' for Registers. \n1. **Model It:** Define/generate Blocks, Regs, Fields. \n2. **Map It:** Tell RAL how addresses work on the bus (\`uvm_reg_map\`). \n3. **Adapt It:** Provide a 'translator' (\`uvm_reg_adapter\`) between generic RAL ops and specific bus transactions. \n4. **Access It:** Use \`reg.write()\`, \`field.read()\` in sequences. \n5. **Mirror It:** Keep RAL's view in sync with HW and use \`mirror(UVM_CHECK)\` to verify."
    }
  };

  return <TopicPage {...pageContent} />;
}
