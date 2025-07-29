---
sidebar_label: 'A2 - Scoreboards and Functional Coverage'
sidebar_position: 2
---

# A2 – Scoreboards and Functional Coverage in UVM

A testbench that only generates stimulus is incomplete. The true power of a UVM environment lies in its ability to automatically check the DUT's behavior and measure how thoroughly it has been tested. This module covers two critical components for achieving this: the Scoreboard and the Functional Coverage collector.

## 1. The UVM Scoreboard: Your Automated Test Checker

The scoreboard is the brain of a self-checking testbench. Its primary role is to verify the functional correctness of the DUT.

**Purpose of the Scoreboard:**

1.  **Receive Inputs**: It collects transaction data observed by the input monitor(s).
2.  **Predict Behavior**: It uses a functional model (often called a reference model) to predict the expected output of the DUT based on the inputs it received.
3.  **Receive Actual Outputs**: It collects the actual output transactions observed by the output monitor(s).
4.  **Compare and Verify**: It compares the predicted output with the actual output and flags an error if there is a mismatch.

### Connecting the Scoreboard

A scoreboard uses `uvm_analysis_imp` ports to receive data from monitors. An `imp` port is a standard TLM port designed to be implemented by the component that receives the data.

In the environment's `connect_phase`, you connect the monitor's analysis port to the scoreboard's analysis export.

```systemverilog
// In the environment's connect_phase
// Connect input monitor to scoreboard
m_agent.m_monitor.item_collected_port.connect(m_scoreboard.input_analysis_export);

// Connect output monitor to scoreboard
m_output_monitor.item_collected_port.connect(m_scoreboard.output_analysis_export);
```

### Data Structures for Synchronization

A key challenge is that the input transaction and its corresponding output transaction may not arrive at the scoreboard at the same time. There is often latency through the DUT. The scoreboard needs a way to store incoming transactions until it has all the pieces needed for a comparison.

Common data structures for this include:

-   **`uvm_tlm_analysis_fifo`**: A specialized FIFO provided by UVM that has a `uvm_analysis_export` for receiving data. It's a simple, convenient way to queue up transactions.
-   **Queues (`$`)**: A standard SystemVerilog queue can be used to store transactions.
-   **Associative Arrays**: Useful when you need to match specific transactions, for example, by using a transaction ID as the key.

### Implementation Logic

Let's build a scoreboard for our ALU testbench.

1.  **Class Definition**: Create a `scoreboard` class that extends `uvm_scoreboard`.

    ```systemverilog
    class scoreboard extends uvm_scoreboard;
      `uvm_component_utils(scoreboard)

      // Analysis exports to receive transactions from monitors
      uvm_analysis_imp #(alu_transaction, scoreboard) input_analysis_export;
      uvm_analysis_imp #(alu_transaction, scoreboard) output_analysis_export;

      // Internal FIFOs to store the transactions
      uvm_tlm_analysis_fifo #(alu_transaction) input_fifo;
      uvm_tlm_analysis_fifo #(alu_transaction) output_fifo;

      // ...
    endclass
    ```

2.  **`build_phase`**: In the `build_phase`, create the analysis exports and the internal FIFOs.

    ```systemverilog
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      input_analysis_export = new("input_analysis_export", this);
      output_analysis_export = new("output_analysis_export", this);
      input_fifo = new("input_fifo", this);
      output_fifo = new("output_fifo", this);
    endfunction
    ```

3.  **`connect_phase`**: In the scoreboard's `connect_phase`, connect the `imp` ports to the FIFOs. This is a common pattern: the scoreboard's public-facing port simply passes the transaction to an internal component (the FIFO).

    ```systemverilog
    function void connect_phase(uvm_phase phase);
      input_analysis_export.connect(input_fifo.analysis_export);
      output_analysis_export.connect(output_fifo.analysis_export);
    endfunction
    ```

4.  **`run_phase`**: This is where the checking logic resides. The task will run forever, pulling transactions from both FIFOs, predicting the result, and comparing.

    ```systemverilog
    task run_phase(uvm_phase phase);
      alu_transaction input_tx, output_tx;
      alu_transaction expected_tx;

      forever begin
        // Block until one transaction is available from both input and output
        input_fifo.get(input_tx);
        output_fifo.get(output_tx);

        `uvm_info("SCOREBOARD", $sformatf("Checking transaction: op=%s, a=%0h, b=%0h",
                  input_tx.op.name(), input_tx.a, input_tx.b), UVM_HIGH)

        // 1. Predict
        expected_tx = new();
        predict_result(input_tx, expected_tx);

        // 2. Compare
        if (!expected_tx.compare(output_tx)) begin
          `uvm_error("SCOREBOARD_MISMATCH", $sformatf("Scoreboard check FAILED. Expected: %s, Actual: %s",
                     expected_tx.convert2string(), output_tx.convert2string()))
        end else begin
          `uvm_info("SCOREBOARD_MATCH", "Scoreboard check PASSED.", UVM_HIGH)
        end
      end
    endtask

    // The reference model
    function void predict_result(alu_transaction in_tx, ref alu_transaction out_tx);
      out_tx.op = in_tx.op;
      case (in_tx.op)
        ADD: out_tx.result = in_tx.a + in_tx.b;
        SUB: out_tx.result = in_tx.a - in_tx.b;
        MUL: out_tx.result = in_tx.a * in_tx.b;
        // Assume DIV is not supported for simplicity
        default: out_tx.result = 'x;
      endcase
    endfunction
    ```

## 2. UVM Functional Coverage

Functional coverage answers the question, "Have I tested all the interesting scenarios and corner cases?" It's a user-defined metric that measures how well the verification plan has been exercised.

### Integrating `covergroup`

The best place to sample coverage is in a component that *observes* the behavior of the DUT and the testbench—typically a **monitor** or a dedicated **coverage collector**. This component has access to the transactions that represent the actual stimulus applied and the results produced.

### `uvm_subscriber`: A Component for Analysis

While you can place a `covergroup` directly in a monitor or scoreboard, a cleaner approach is to create a dedicated component for coverage collection. UVM provides `uvm_subscriber` for this exact purpose.

A `uvm_subscriber` is a `uvm_component` that comes pre-packaged with a `uvm_analysis_imp` port called `analysis_export`. Its sole purpose is to receive transactions and perform some analysis on them, like sampling a `covergroup`.

### Implementation

1.  **Create `coverage_collector.sv`**: Define a class that extends `uvm_subscriber` and is parameterized with the transaction type.

    ```systemverilog
    class coverage_collector extends uvm_subscriber #(alu_transaction);
      `uvm_component_utils(coverage_collector)

      // The covergroup definition
      covergroup alu_op_cg;
        option.per_instance = 1;
        OP_CP: coverpoint trans.op;
      endgroup

      function new(string name = "coverage_collector", uvm_component parent = null);
        super.new(name, parent);
        alu_op_cg = new();
      endfunction

      // This function is automatically called when a transaction is written to the subscriber
      function void write(alu_transaction t);
        `uvm_info("COVERAGE", "Sampling transaction in covergroup", UVM_HIGH)
        alu_op_cg.sample();
      endfunction
    endclass
    ```

2.  **Instantiate and Connect**: In the environment, create an instance of the `coverage_collector` and connect the monitor's analysis port to it.

    ```systemverilog
    // In alu_env.sv build_phase
    m_coverage = coverage_collector::type_id::create("m_coverage", this);

    // In alu_env.sv connect_phase
    m_agent.m_monitor.item_collected_port.connect(m_coverage.analysis_export);
    ```

### Controlling and Checking Coverage

-   **Instance vs. Type Coverage**: By default (`option.per_instance = 1`), each instance of your coverage collector will have its own coverage statistics. This is usually what you want.
-   **Checking Coverage Goals**: In the `report_phase` of your test, you can check if your coverage goals have been met.

    ```systemverilog
    // In the test's report_phase
    function void report_phase(uvm_phase phase);
      super.report_phase(phase);
      real cvg = m_env.m_coverage.alu_op_cg.get_inst_coverage();
      `uvm_info("COVERAGE_REPORT", $sformatf("ALU Operations coverage is: %2.2f%%", cvg), UVM_LOW)
      if (cvg < 100.0) begin
        `uvm_warning("LOW_COVERAGE", "ALU Operations coverage goal not met!")
      end
    endfunction
    ```

## 3. Putting It Together: Updating the ALU Testbench

Now, let's update the testbench from `tests/I4_alu_uvm_testbench/` to incorporate these new components.

**(The full code for each updated file will be shown in collapsible sections).**

### Case Study: How a Scoreboard Catches a Bug

Imagine a subtle bug is introduced into the ALU's RTL:

```systemverilog
// Buggy RTL for subtraction
assign result = (op == SUB) ? (a - b - 1) : (a - b); // Off-by-one error
```

Without a scoreboard, this bug might go unnoticed. A test might run to completion, waves might look "reasonable" at a glance, and no errors would be reported.

**How the scoreboard finds it:**

1.  **Stimulus**: A sequence sends a transaction: `op=SUB, a=10, b=5`.
2.  **Monitor**: The input monitor captures this transaction and sends it to the scoreboard.
3.  **Scoreboard Prediction**: The scoreboard's `predict_result` function calculates the expected result: `10 - 5 = 5`.
4.  **DUT Execution**: The buggy DUT calculates `10 - 5 - 1 = 4`.
5.  **Monitor**: The output monitor captures the actual result: `result=4`.
6.  **Scoreboard Comparison**: The scoreboard's `run_phase` pulls the input transaction (a=10, b=5) and the output transaction (result=4). It compares its predicted result (5) with the actual result (4).
7.  **ERROR!**: The `compare()` function fails. The scoreboard reports a `UVM_ERROR`, pinpointing the exact transaction that failed and showing the difference between the expected and actual values. The test now fails, immediately alerting the engineer to the bug.

This case study highlights the power of a self-checking testbench. By automating the verification process, scoreboards can catch bugs that are difficult to spot with manual inspection, leading to more robust and reliable designs.
