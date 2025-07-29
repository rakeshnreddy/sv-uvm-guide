---
sidebar_position: 3
---

# E3: Advanced Debugging Techniques

A passing test tells you one thing; a failing test can mean a million different things. As verification environments grow in complexity, so does the challenge of debugging them. Simple `uvm_info` messages are not enough. This module equips you with a professional-grade workflow for tackling the most difficult bugs, moving from high-level log file analysis to low-level, transaction-aware waveform investigation.

## 1. The Debug Workflow: From Macro to Micro

Effective debugging follows a funnel-like process:
1.  **High-Level Summary:** Is the test failing? How many errors? (Log file parsing).
2.  **Component-Level Analysis:** Why is the test hanging? Which component is responsible? (UVM phase/objection tracing).
3.  **Transaction-Level Analysis:** Is the component receiving the wrong data? Is it sending the right data? (UVM-aware waveform viewing).
4.  **Signal-Level Analysis:** Why is the transaction data wrong? Is there a bug in the signal-level driving? (Traditional waveform signal tracing).

Don't start by looking at signals. Start at the highest level of abstraction and drill down.

## 2. Effective Waveform Debugging: Beyond the Wires

Staring at individual signals (`clk`, `req`, `gnt`, `addr`, `data`) and trying to mentally reconstruct a transaction is slow, tedious, and error-prone. The single most important skill for advanced UVM debugging is leveraging a **UVM-aware waveform viewer**.

### Transaction Viewing

Modern debug tools like Synopsys Verdi, Cadence Visualizer/SimVision, or Siemens Questa Visualizer can be configured to understand UVM objects. Instead of just showing signals, they display UVM transactions as high-level blocks on a timeline.

**Conceptual Waveform View:**

Imagine a waveform where, in addition to your HDL signals, you see these "virtual" streams:

```
/top/dut/axi_if/clk      ---_--_--_--_--_--_--_--_--_--_--_--_--_--_--_
/top/dut/axi_if/awvalid  ---________----____________________________
/top/dut/axi_if/awaddr   ---[0x1000]----____________________________
/top/dut/axi_if/wvalid   -----------____----________________________
/top/dut/axi_if/wdata    -----------[32'hDEAFBEEF]----______________

// The Magic: Transaction-level view
/uvm_root/env/agent/sequencer  --[ WRITE_TX ]--[ WRITE_TX ]----------
/uvm_root/env/agent/monitor    --------[ WRITE_TX ]--[ READ_TX ]-----
```

This view allows you to instantly see:
-   When a sequence sent a transaction (`WRITE_TX`).
-   When the monitor observed it on the bus.
-   The contents (address, data, etc.) of the transaction object itself.
-   How the transaction timing aligns with the underlying physical signals.

### UVM-Aware GUI

These tools are more than just transaction viewers. They are "UVM-aware" and provide dedicated windows to explore the testbench structure:
-   **UVM Hierarchy:** Browse your `uvm_component` tree, just like in the log file.
-   **Phase Execution:** See a timeline of when each phase (`build`, `connect`, `run`, etc.) starts and ends for each component.
-   **Objection Status:** Visualize the objection history, seeing which components raised and dropped objections and when.

This lets you correlate a `UVM_FATAL` message in the log directly to the component that issued it, and jump to the exact simulation time in the waveform where the failure occurred.

### How to Enable It: Transaction Recording

To make this work, you must instruct the simulator to record the necessary data. This is usually done in two parts:
1.  **Simulator Plusarg:** Enable transaction database recording (e.g., `-ucli -do "log -r *"`, or specific commands for your tool like `-fsdb` or `-shm`).
2.  **UVM Recording:** Enable UVM's built-in transaction recording feature. You can do this globally or on a per-component basis.

```systemverilog
// In your base test or environment
function void base_test::build_phase(uvm_phase phase);
  // Enable recording for all components and all transactions
  uvm_top.set_config_int("*", "recording_detail", UVM_FULL);
endfunction
```
Check your simulator's documentation for the precise commands and plusargs (e.g., `+UVM_TR_RECORD`, `+UVM_CONFIG_DB_TRACE`). Enabling transaction recording adds some simulation overhead, so it's typically only used for debug sessions, not for full regressions.

## 3. Log File Automation: Taming the Transcript

A typical regression run can produce log files that are hundreds of megabytes or even gigabytes long. Manually opening and searching (`Ctrl+F`) for "UVM_ERROR" is not a scalable solution. The first step in any debug session should be to get a quick, automated summary of the log file.

### Scripting is Non-Negotiable

You must have a simple script (usually Python or Perl) to parse log files. This is a standard part of every verification engineer's toolkit. The script's goal is to rapidly answer:
-   Did any errors occur?
-   How many?
-   What were the error messages and what components reported them?

### Example Python Log Parser

Here is a simple but powerful Python script that parses a log file for UVM errors and generates a clean summary.

```python
#!/usr/bin/env python3
import re
import argparse

def parse_uvm_log(logfile):
    """
    Parses a UVM log file to find error messages and summarize them.
    """
    # Regex to capture UVM errors. Example:
    # UVM_ERROR: 0: uvm_test_top.env.agent [ERR_ID] The error message
    # This regex captures the time, component path, ID, and message.
    error_pattern = re.compile(
        r"UVM_ERROR:\s+(?P<time>\d+):\s+"
        r"(?P<component>\S+)\s+"
        r"\[(?P<id>\w+)\]\s+"
        r"(?P<message>.*)"
    )

    errors = []
    try:
        with open(logfile, 'r') as f:
            for line in f:
                match = error_pattern.search(line)
                if match:
                    errors.append(match.groupdict())
    except FileNotFoundError:
        print(f"Error: Log file not found at '{logfile}'")
        return

    # --- Print Summary ---
    print("-" * 80)
    if not errors:
        print("✅ Log Parse Summary: No UVM_ERROR messages found.")
    else:
        print(f"❌ Log Parse Summary: Found {len(errors)} UVM_ERROR messages.")
        print("-" * 80)
        for i, error in enumerate(errors, 1):
            print(f"Error #{i}:")
            print(f"  Time:      {error['time']}")
            print(f"  Component: {error['component']}")
            print(f"  ID:        {error['id']}")
            print(f"  Message:   {error['message'].strip()}")
            print("-" * 80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse a UVM log file for errors.")
    parser.add_argument("logfile", help="The path to the log file to parse.")
    args = parser.parse_args()

    parse_uvm_log(args.logfile)

```
**How to Use:**
1. Save the script as `parse_log.py`.
2. Make it executable: `chmod +x parse_log.py`.
3. Run it on your simulation log: `./parse_log.py /path/to/your/simulation.log`.

This simple script turns a million-line log file into a concise, readable summary, allowing you to see the critical failures in seconds. You can easily extend it to search for `UVM_FATAL`, specific warnings, or any other pattern of interest.

## 4. UVM's Built-in Debug Hooks

UVM provides a wealth of command-line plusargs and programmatic hooks to help with debugging.

### Phase and Objection Debugging

These are your primary tools for debugging tests that hang or end prematurely.
-   `+UVM_PHASE_TRACE`: Prints a message every time a phase starts or ends for a component. This shows you exactly where phasing is currently stuck.
-   `+UVM_OBJECTION_TRACE`: Prints a message every time an objection is raised or dropped, by which component, and what the total objection count is. This is the #1 tool for finding which component forgot to `drop_objection`.
-   **`uvm_objection::display_objections()`**: This is a programmatic way to get a snapshot of the objection status. If your test is hanging in a `forever` loop, you can't wait for the end of the test to see the objection trace. You can call this method from any component to print a detailed tree of all current objections.

    ```systemverilog
    // In a component's run_phase, for example
    fork
      begin
        // This thread will periodically print the objection status
        forever begin
          #10000; // Wait for some amount of simulation time
          `uvm_info("OBJ_DEBUG", "Dumping current objections...", UVM_MEDIUM)
          uvm_root.get().m_objection.display_objections();
        end
      end
    join_none
    ```

### Factory and Configuration Debugging

-   **`factory.print()`**: When you have a complex system of factory overrides, it can be hard to know which component is *actually* being created. Calling `factory.print()` programmatically (e.g., at the end of the `end_of_elaboration_phase`) shows you the final state of the factory, including all type and instance overrides.
-   **`uvm_config_db::dump()`**: Similarly, this static method dumps the entire contents of the configuration database, showing every value that was set and where it applies. This is crucial for debugging `uvm_config_db` issues.
-   **`+UVM_DUMP_CMDLINE_ARGS`**: This simple plusarg prints a list of how the UVM command-line processor interpreted all `+uvm_...` and `+UVM_...` arguments. It is invaluable for debugging issues where you think you've set a plusarg, but it's not having the desired effect.

### TLM Debug

A common bug is a transaction getting "stuck" in a TLM FIFO, often in a scoreboard. The `uvm_tlm_fifo::size()` method is your best friend here. If you suspect a component is not processing transactions, add a check to see if its input FIFO is growing indefinitely.

```systemverilog
// In a scoreboard's run_phase
forever begin
  #50000; // Check periodically
  if (expected_fifo.size() > 1000) { // A reasonable threshold
    `uvm_warning("SCB_BACKPRESSURE",
      $sformatf("Scoreboard expected_fifo is growing large (%0d entries). Transactions may be stuck!",
      expected_fifo.size()))
  }
end
```

By combining these techniques into a systematic workflow, you can move from a state of confusion to a clear diagnosis, turning even the most challenging bugs into solvable problems.
