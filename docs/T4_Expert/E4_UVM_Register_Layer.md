---
sidebar_position: 4
---

# E4: UVM Register Layer (UVM-RAL)

Virtually every modern DUT (Device Under Test) is configured and controlled via a set of registers. Verifying these registers is a fundamental task. The UVM Register Abstraction Layer (RAL), often called UVM-RAL, is the industry-standard solution for this challenge. It provides a powerful, object-oriented model of the DUT's register map, automating and abstracting the process of register access.

## 1. Why Do We Need RAL?

### The Problem: Manual Register Access

Imagine your DUT has a simple control register at address `0x04` with the following fields:
-   `[0]`: `enable` (RW)
-   `[3:1]`: `mode` (RW)
-   `[31:4]`: `RESERVED`

To write a value to the `mode` field without RAL, a sequence would have to:
1.  Create a bus transaction (e.g., an AXI-Lite sequence item).
2.  Set the transaction's address to `0x04`.
3.  Set the transaction's operation type to `WRITE`.
4.  Set the transaction's data to `(2 << 1)` to set `mode` to `2`.
5.  Send this transaction to the driver.
6.  Wait for the driver to complete the bus protocol.

This is tedious, error-prone (what if the address changes?), and completely non-reusable if the bus protocol changes from AXI-Lite to APB.

### The Solution: An Abstraction Layer

RAL solves this by creating a high-level model of the registers. Instead of creating bus transactions, you interact with register objects.

```systemverilog
// With RAL, the above operation becomes:
ral_model.control_reg.mode.write(status, 2);
```
This single line of code accomplishes the same goal. The RAL machinery automatically handles the creation, configuration, and execution of the underlying bus transactions.

**Key Benefits of RAL:**
-   **Abstraction:** Your tests are independent of register addresses and the bus protocol. If the address of `control_reg` changes from `0x04` to `0x100`, you only change it in one place (the register model), and none of your tests need to be modified.
-   **Automation:** RAL automates the generation of bus transactions.
-   **Maintainability:** The register model becomes the single source of truth for the register map.
-   **Built-in Tests:** RAL comes with a suite of pre-written, powerful sequences that can perform comprehensive self-tests on your registers (checking access policies, reset values, etc.).

## 2. Building the Register Model

A RAL model is a collection of UVM classes that mirrors the DUT's register map structure.

### The RAL Class Hierarchy

-   `uvm_reg_field`: Represents a single field within a register (e.g., `enable`).
-   `uvm_reg`: Represents a single register, which is a container for one or more fields (e.g., `control_reg`).
-   `uvm_reg_block`: Represents a collection of registers and other register blocks. This allows you to create a hierarchical model that mirrors the DUT's structure.
-   `uvm_reg_map`: Represents a specific address map. A register block can have multiple maps (e.g., one for AXI access, one for APB access). The map defines the address offsets of the registers.

### Manual Model Creation

Let's model a simple ALU with two control registers and one status register.

**Step 1: Define the Register Classes**
Each register is a class extending `uvm_reg`. Inside, you declare its fields as `rand uvm_reg_field`.

```systemverilog
// In tests/E4_ral_example/alu_reg_model.sv

// Register: ALU_OPCODE
class alu_opcode_reg extends uvm_reg;
  `uvm_object_utils(alu_opcode_reg)

  // Fields
  rand uvm_reg_field opcode;
  rand uvm_reg_field enable;

  function new(string name = "alu_opcode_reg");
    // 32 bits wide, no coverage
    super.new(name, 32, UVM_NO_COVERAGE);
  endfunction

  virtual function void build();
    // Define the fields: name, size, LSB position, access, volatility, reset value
    this.opcode = uvm_reg_field::type_id::create("opcode");
    this.opcode.configure(this, 4, 0, "RW", 0, 4'h0, 1, 0, 1);

    this.enable = uvm_reg_field::type_id::create("enable");
    this.enable.configure(this, 1, 4, "RW", 0, 1'h0, 1, 0, 1);
  endfunction
endclass

// Register: ALU_STATUS (Read-Only)
class alu_status_reg extends uvm_reg;
  // ... similar structure, but fields are configured with "RO" access ...
endclass
```

**Step 2: Define the Top-Level Register Block**
The block instantiates all the registers. In its `build()` method, it creates a `uvm_reg_map` and adds the registers to it, defining their address offsets.

```systemverilog
// In tests/E4_ral_example/alu_reg_model.sv

class alu_reg_block extends uvm_reg_block;
  `uvm_object_utils(alu_reg_block)

  // Instantiate the registers
  rand alu_opcode_reg ALU_OPCODE;
  rand uvm_reg        ALU_OPERAND_A; // Can be a generic uvm_reg
  rand uvm_reg        ALU_OPERAND_B;
  rand alu_status_reg ALU_STATUS;

  function new(string name = "alu_reg_block");
    super.new(name, UVM_NO_COVERAGE);
  endfunction

  virtual function void build();
    this.ALU_OPCODE = alu_opcode_reg::type_id::create("ALU_OPCODE");
    this.ALU_OPCODE.configure(this);
    this.ALU_OPCODE.build();

    // ... configure other registers ...

    // Create the address map
    this.default_map = create_map("default_map", 0, 4, UVM_LITTLE_ENDIAN);

    // Add registers to the map with their offsets
    this.default_map.add_reg(this.ALU_OPCODE,    'h00, "RW");
    this.default_map.add_reg(this.ALU_OPERAND_A, 'h04, "RW");
    this.default_map.add_reg(this.ALU_OPERAND_B, 'h08, "RW");
    this.default_map.add_reg(this.ALU_STATUS,    'h0C, "RO");
  endfunction
endclass
```

### Automation is Key

While it's crucial to understand the manual process, no one does this for a real DUT. Real-world register models are generated by tools (like `ralgen` from Synopsys, or other commercial/in-house solutions) from a specification format like IP-XACT, SystemRDL, or even a simple CSV or XML file. This ensures the model is always in sync with the design specification.

## 3. Integrating the RAL Model

Once the model is built, you need to connect it to your verification environment. This is done via a special **adapter** class.

### The Register Adapter (`uvm_reg_adapter`)

The adapter is the bridge between the generic RAL world and the specific bus protocol of your DUT. Its job is to translate a generic `uvm_reg_bus_op` (which just contains address, data, and operation type) into a bus-specific sequence item (e.g., `my_bus_tx`).

You must create a custom adapter class for your bus protocol by extending `uvm_reg_adapter`.

```systemverilog
// In tests/E4_ral_example/ral_adapter.sv

class ral_adapter extends uvm_reg_adapter;
  `uvm_object_utils(ral_adapter)

  function new(string name = "ral_adapter");
    super.new(name);
  endfunction

  // This function converts a generic RAL operation into a bus transaction
  virtual function uvm_sequence_item reg2bus(const ref uvm_reg_bus_op rw);
    my_bus_tx tx = my_bus_tx::type_id::create("tx");
    tx.addr = rw.addr;
    tx.data = rw.data;
    tx.kind = (rw.kind == UVM_READ) ? MY_BUS_READ : MY_BUS_WRITE;
    return tx;
  endfunction

  // This function converts a bus transaction back into a RAL operation
  virtual function void bus2reg(uvm_sequence_item bus_item, ref uvm_reg_bus_op rw);
    my_bus_tx tx;
    assert($cast(tx, bus_item)); // Should always be a my_bus_tx
    rw.kind = (tx.kind == MY_BUS_READ) ? UVM_READ : UVM_WRITE;
    rw.addr = tx.addr;
    rw.data = tx.data;
    rw.status = UVM_IS_OK; // Or UVM_NOT_OK on error
  endfunction
endclass
```

### Connecting the Model in the Environment

In your `uvm_env`'s `connect_phase`, you stitch everything together.

```systemverilog
// In your environment class
class my_env extends uvm_env;
  // ... agent, sequencer, etc. ...
  alu_reg_block ral_model;
  ral_adapter   adapter;

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // Build the RAL model and adapter
    this.ral_model = alu_reg_block::type_id::create("ral_model");
    this.ral_model.build();
    this.adapter = ral_adapter::type_id::create("adapter");
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    // Connect the RAL model to the bus sequencer via the adapter
    this.ral_model.default_map.set_sequencer(this.agent.sequencer, this.adapter);
  endfunction
endclass
```

### Integration Diagram

This diagram shows how a register `write()` call flows through the testbench:

```
+-----------------+      +-------------+      +-------------+      +-------------------+      +-------------+
|  Test Sequence  |----->|  Register   |----->|  Register   |----->|   RAL Adapter     |----->| Bus Sequencer |
| (ral.reg.write) |      | (RAL Model) |      |     Map     |      | (reg2bus method)  |      |               |
+-----------------+      +-------------+      +-------------+      +-------------------+      +-------------+
                                                                                                    |
                                                                                                    |
                                                                                                    v
                                                                                              +-------------+
                                                                                              |  Bus Driver |
                                                                                              +-------------+
```

## 4. Using the Register Model

With the model built and integrated, you can now use it in your sequences to control the DUT.

### Front-door Access

"Front-door" access means accessing the register by generating transactions on the physical bus, just like the real system would. RAL provides high-level `read()` and `write()` tasks for this.

```systemverilog
// In a test sequence
task my_alu_test_seq::body();
  uvm_status_e status;
  uvm_reg_data_t value;

  // Write to a register's field
  ral_model.ALU_OPCODE.opcode.write(status, 4'b0010); // Write '2' to the opcode field

  // Write to an entire register
  ral_model.ALU_OPERAND_A.write(status, 32'hCAFEF00D);

  // Read from a register
  ral_model.ALU_STATUS.read(status, value);
  `uvm_info(get_type_name(), $sformatf("Read status value: %h", value), UVM_MEDIUM)

  // You can also mirror and predict register values, a more advanced topic.
endtask
```
These tasks are blocking and will only complete once the corresponding bus transaction is finished.

### Back-door Access

"Back-door" access means directly reading or writing the register's value in the RTL using simulator-specific commands (like Verilog's DPI-C or tool-specific commands). This bypasses the entire bus protocol and is therefore **instantaneous** (zero simulation time). It is extremely useful for rapidly setting up DUT configurations or checking DUT state without the overhead of the bus.

RAL provides `peek()` (read) and `poke()` (write) tasks for back-door access.

```systemverilog
// Directly force a value into a register
ral_model.ALU_OPERAND_B.poke(status, 32'h12345678);

// Directly read the current value from the RTL
ral_model.ALU_STATUS.peek(status, value);
```
**Note:** To use back-door access, you must provide the path to the registers in the RTL to the register model, which is another part of the integration not covered in this brief introduction.

### Built-in RAL Sequences

One of the most powerful features of RAL is its library of pre-written test sequences. These sequences can be started on your sequencer and will automatically execute comprehensive tests on your register map.

-   `uvm_reg_hw_reset_seq`: Checks if all registers revert to their specified reset values after a hardware reset.
-   `uvm_reg_bit_bash_seq`: "Bit-bashes" all RW registers. It walks a '1' and a '0' through every bit position of every register, verifying that each bit can be individually set and cleared.
-   `uvm_reg_access_seq`: Verifies the access policy of every register (e.g., writing to a "RO" register should not change its value).

**Using a built-in sequence:**
```systemverilog
task my_ral_self_test::body();
  uvm_reg_hw_reset_seq reset_seq = new();
  reset_seq.model = ral_model; // Point it to our model
  reset_seq.start(m_sequencer); // Run it
endtask
```

## Conclusion: The Standard for Register Verification

The UVM Register Layer is not just a convenience; it is the cornerstone of modern, robust register verification. It provides the necessary abstraction, automation, and checking to thoroughly validate the hardware/software interface of any complex DUT. While the initial setup requires some effort, the payoff in terms of reusability, maintainability, and test quality is immense.
