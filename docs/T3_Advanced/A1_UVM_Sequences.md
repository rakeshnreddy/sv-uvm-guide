---
sidebar_label: 'A1 - UVM Sequences and Virtual Sequences'
sidebar_position: 1
---

# A1 – UVM Sequences and Virtual Sequences

Welcome to the Advanced tier of our UVM course. We'll start by diving deep into one of the most powerful aspects of UVM: stimulus generation using sequences. While the introductory module covered the basics, this section will explore advanced mechanics, layering, and the critical concept of virtual sequences for coordinating complex test scenarios.

## 1. Advanced Sequence Mechanics: Beyond the Basics

Let's move beyond the simple `start_item`/`finish_item` flow and explore more powerful and convenient ways to work with sequences.

### Recap: `start_item` and `finish_item`

As a quick refresher, the fundamental sequence-driver interaction involves two key steps:

1.  **`start_item(item)`**: The sequence creates a transaction (a `uvm_sequence_item`) and calls `start_item()`. This call blocks until the driver is ready to accept the item.
2.  **`finish_item(item)`**: After `start_item()` returns, the sequence randomizes the item and then calls `finish_item()`. This sends the randomized item to the driver and blocks until the driver signals its completion by calling `item_done()`.

```systemverilog
// Basic sequence body
task body();
  my_transaction_t tx;
  // 1. Create the transaction
  tx = my_transaction_t::type_id::create("tx");
  // 2. Start the handshake
  start_item(tx);
  // 3. Randomize and send to driver
  assert(tx.randomize());
  finish_item(tx);
endtask
```

This flow gives you fine-grained control, but it's verbose. UVM provides a set of macros to simplify this process.

### The `uvm_do` Macros: Convenient Shorthand

The `uvm_do` family of macros automates the `create`, `start_item`, `randomize`, and `finish_item` process into a single, convenient call.

| Macro | Action |
| :--- | :--- |
| **`uvm_do(item)`** | Performs `create`, `start_item`, `randomize`, and `finish_item` for the given item. |
| **`uvm_do_with(item, {constraints})`** | Same as `uvm_do`, but adds an inline `with` clause to the `randomize()` call. This is extremely useful for shaping the stimulus on the fly. |
| **`uvm_do_on(item, sequencer)`** | Same as `uvm_do`, but executes the sequence item on a specific sequencer. This is less common and is typically used in layered sequence scenarios. |

**Example:**

```systemverilog
// Using `uvm_do`
task body();
  `uvm_do(my_transaction_t) // Creates, randomizes, and sends a default transaction

  // Using `uvm_do_with` for targeted stimulus
  `uvm_do_with(my_transaction_t, {
    addr == 16'hBEEF;
    data < 8'h10;
    operation == WRITE;
  })
endtask
```

### The Sequence-Driver Handshake in Detail

The communication between `uvm_sequence` and `uvm_driver` is a well-defined, blocking handshake protocol.

1.  **Driver asks for data**: The driver calls `seq_item_port.get_next_item(req)`. This call blocks until a sequence has sent an item using `start_item`/`finish_item` (or a `uvm_do` macro).
2.  **Sequence provides data**: The sequence's `finish_item()` call sends the transaction, which unblocks the driver's `get_next_item()` call. The driver now has the `req` object.
3.  **Driver processes data**: The driver accesses the data in `req` and drives the DUT's pins accordingly.
4.  **Driver signals completion**: Once the pin-level activity is complete, the driver **must** call `seq_item_port.item_done()`. This call unblocks the sequence's `finish_item()` or `uvm_do` call, allowing the sequence to proceed.

**Non-Blocking Communication:**

-   **`try_next_item(req)`**: A non-blocking version of `get_next_item()`. The driver can use this to check if a sequence has an item ready without having to wait. It returns `null` if no item is available.
-   **`put(rsp)`**: The driver can use this method to send a response transaction back to the sequence. The sequence can then retrieve this response by calling `get_response(rsp)`.

### Layered Sequences: Building Complexity

A powerful feature of UVM sequences is their ability to execute other sequences. This allows you to build complex, hierarchical stimulus from smaller, reusable, and more manageable "building block" sequences.

A "super-sequence" or "parent sequence" can instantiate and start "sub-sequences".

**Example:**

Imagine you have a simple sequence for a memory write and another for a memory read. You can create a higher-level sequence that performs a write-then-read operation to verify data integrity.

```systemverilog
// Sub-sequence for a single write
class write_seq extends uvm_sequence #(my_transaction_t);
  // ... constructor, etc. ...
  task body();
    `uvm_do_with(my_transaction_t, { operation == WRITE; })
  endtask
endclass

// Sub-sequence for a single read
class read_seq extends uvm_sequence #(my_transaction_t);
  // ... constructor, etc. ...
  task body();
    `uvm_do_with(my_transaction_t, { operation == READ; })
  endtask
endclass

// Super-sequence to coordinate the two
class write_read_seq extends uvm_sequence #(my_transaction_t);
  // ... constructor, etc. ...
  task body();
    write_seq w_seq = write_seq::type_id::create("w_seq");
    read_seq r_seq = read_seq::type_id::create("r_seq");

    `uvm_info("SEQ", "Starting Write-Read sequence", UVM_MEDIUM)
    w_seq.start(m_sequencer); // Execute the write sequence
    r_seq.start(m_sequencer); // Execute the read sequence
    `uvm_info("SEQ", "Finished Write-Read sequence", UVM_MEDIUM)
  endtask
endclass
```

## 2. Virtual Sequences: Coordinating Multiple Agents

### The Problem

Modern SoCs are complex. A single DUT might have multiple interfaces: a processor with an instruction bus, a data bus, a debug interface, and a peripheral bus. Each of these interfaces will be handled by a separate UVM agent, each with its own sequencer and driver.

How do you synchronize stimulus across all these independent agents? For example, how do you configure a DMA controller over a register bus and then initiate a data transfer over a memory bus?

You **cannot** start a single sequence on multiple sequencers. This is where the virtual sequence pattern comes in.

### The Solution: Virtual Sequencer and Virtual Sequence

The solution is to add a layer of abstraction:

1.  **Virtual Sequencer (`uvm_sequencer`)**: This is not a real sequencer. It doesn't connect to a driver. Its sole purpose is to act as a container that holds handles (pointers) to the "real," physical sequencers in the testbench agents. It's typically instantiated in the environment.

2.  **Virtual Sequence (`uvm_sequence`)**: This sequence is designed to run on the virtual sequencer. Because it has access to the virtual sequencer, it can access the handles to all the real sequencers. In its `body()`, the virtual sequence doesn't generate transactions itself. Instead, it creates and starts other sequences on the target sequencers.

### Architecture Diagram

This diagram illustrates the relationship between the components:

```mermaid
graph TD
    subgraph Test
        A[Test (e.g., alu_test)]
    end

    subgraph Environment
        V_SEQ[Virtual Sequencer<br>(m_v_sequencer)]
        subgraph Agent A
            SEQ_A[Sequencer A] --> DRV_A[Driver A]
        end
        subgraph Agent B
            SEQ_B[Sequencer B] --> DRV_B[Driver B]
        end
    end

    subgraph Stimulus (Sequences)
        V_S[Virtual Sequence<br>(alu_virtual_sequence)]
        S_A[Sequence A<br>(a_sequence)]
        S_B[Sequence B<br>(b_sequence)]
    end

    A -- "starts" --> V_S
    V_S -- "runs on" --> V_SEQ
    V_SEQ -.-> SEQ_A
    V_SEQ -.-> SEQ_B
    V_S -- "starts" --> S_A
    V_S -- "starts" --> S_B
    S_A -- "runs on" --> SEQ_A
    S_B -- "runs on" --> SEQ_B

    style V_SEQ fill:#f9f,stroke:#333,stroke-width:2px
    style V_S fill:#ccf,stroke:#333,stroke-width:2px
```

### How it Works

1.  **Test**: The test case creates and starts the *virtual sequence* on the *virtual sequencer*.
2.  **Virtual Sequence**: The virtual sequence's `body()` method executes.
3.  **Coordination**: The virtual sequence creates sub-sequences (e.g., `a_sequence`, `b_sequence`).
4.  **Execution**: It uses the virtual sequencer's handles to start these sub-sequences on the appropriate real sequencers (`a_seq.start(m_v_sequencer.m_sequencer_a)`).
5.  **Parallelism**: By using `fork/join`, the virtual sequence can launch multiple sub-sequences on different agents simultaneously, achieving true multi-interface coordination.

## 3. Practical Example: ALU with Two Input Agents

Let's imagine our ALU now has two independent input ports, `A` and `B`, each controlled by its own agent. We want to drive random values to both ports at the same time.

### Directory Structure

All the example files will be placed in `tests/A1_virtual_sequence_example/`.

```
tests/A1_virtual_sequence_example/
├── agent.sv
├── a_sequence.sv
├── base_sequence.sv
├── b_sequence.sv
├── driver.sv
├── environment.sv
├── interface.sv
├── monitor.sv
├── sequencer.sv
├── sequence_item.sv
├── test.sv
├── top.sv
└── virtual_sequence.sv
```

### Code: The Components

We will now build the necessary components for this testbench.

**(The full code for each file will be provided in the collapsible sections below).**

### Key Components Explained

#### `virtual_sequencer.sv`

This is the central hub. It contains no logic, only handles to the sequencers for Agent A and Agent B.

```systemverilog
// In virtual_sequencer.sv
class virtual_sequencer extends uvm_sequencer;
  `uvm_component_utils(virtual_sequencer)

  // Handles to the real sequencers
  sequencer m_sequencer_a;
  sequencer m_sequencer_b;

  function new(string name = "virtual_sequencer", uvm_component parent = null);
    super.new(name, parent);
  endfunction
endclass
```

#### `environment.sv`

The environment instantiates the two agents (for port A and B) and the virtual sequencer. Crucially, it's responsible for connecting the virtual sequencer's handles to the real sequencers inside the agents.

```systemverilog
// In environment.sv (build_phase)
function void build_phase(uvm_phase phase);
  super.build_phase(phase);
  m_agent_a = agent::type_id::create("m_agent_a", this);
  m_agent_b = agent::type_id::create("m_agent_b", this);
  m_virtual_sequencer = virtual_sequencer::type_id::create("m_virtual_sequencer", this);
endfunction

function void connect_phase(uvm_phase phase);
  super.connect_phase(phase);
  // Connect the virtual sequencer handles
  m_virtual_sequencer.m_sequencer_a = m_agent_a.m_sequencer;
  m_virtual_sequencer.m_sequencer_b = m_agent_b.m_sequencer;
endfunction
```

#### `alu_virtual_sequence.sv`

This is the core of the stimulus coordination. It runs on the virtual sequencer. Notice how it gets the sequencer handles from `p_sequencer` (which is the virtual sequencer it's running on) and uses `fork/join` to launch the `a_sequence` and `b_sequence` in parallel.

```systemverilog
// In virtual_sequence.sv
class alu_virtual_sequence extends uvm_sequence;
  `uvm_object_utils(alu_virtual_sequence)

  function new(string name = "alu_virtual_sequence");
    super.new(name);
  endfunction

  virtual task body();
    // The `p_sequencer` is the virtual sequencer this sequence is running on.
    // We must cast it to the correct type to access its handles.
    virtual_sequencer v_sqr;
    if (!$cast(v_sqr, p_sequencer)) begin
      `uvm_fatal("VSEQ", "Failed to cast p_sequencer to virtual_sequencer type")
    end

    // Create the sequences to be run on the real sequencers
    a_sequence a_seq = a_sequence::type_id::create("a_seq");
    b_sequence b_seq = b_sequence::type_id::create("b_seq");

    `uvm_info("VSEQ", "Starting parallel sequences on Agent A and Agent B", UVM_MEDIUM)

    // Fork the two sequences to run in parallel
    fork
      a_seq.start(v_sqr.m_sequencer_a);
      b_seq.start(v_sqr.m_sequencer_b);
    join

    `uvm_info("VSEQ", "Finished parallel sequences", UVM_MEDIUM)
  endtask
endclass
```

#### `test.sv`

The test simply needs to configure the virtual sequence as the default sequence for the virtual sequencer's main phase.

```systemverilog
// In test.sv (build_phase)
function void build_phase(uvm_phase phase);
  super.build_phase(phase);
  uvm_config_db#(uvm_object_wrapper)::set(this,
    "m_env.m_virtual_sequencer.main_phase",
    "default_sequence",
    alu_virtual_sequence::type_id::get());
endfunction
```

## 4. Best Practices for Sequence Design

-   **Keep Sequences Focused**: A sequence should define *what* stimulus to generate, not *how* to drive the signals. The "how" is the driver's job. A sequence should deal with transactions and constraints.
-   **Parameterize Sequences**: Make sequences reusable by parameterizing them. Instead of hardcoding 10 transactions, pass `num_trans` as a parameter to the sequence.
-   **Use Layering**: Build complex scenarios from simple, reusable sequences. This makes your testbench easier to read, debug, and maintain.
-   **Virtual Sequences for Coordination**: Use virtual sequences *only* for synchronizing stimulus across different interfaces. They should not contain any transaction-level logic themselves.
-   **Clarity over cleverness**: Write sequences that are easy to understand. The goal is to create clear, maintainable, and effective stimulus.
