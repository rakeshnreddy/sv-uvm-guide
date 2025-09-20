# Lab: Build Your First Self-Checking Testbench

*Last updated: 2025-09-23*

This lab revisits the Tier-1 `F4: Your First Testbench` content and walks you through crafting a minimal, self-checking SystemVerilog bench without UVM. You will:

1. Instantiate a simple DUT (the provided `and_gate`).
2. Drive stimulus by wrapping transactions in reusable tasks.
3. Check results automatically and flag mismatches.

## Prerequisites
- Finish the Tier-1 modules `F1: Why Verification?` and `F2: SystemVerilog Basics`.
- A simulator such as VCS, Questa, or Xcelium.

## Step-by-Step Instructions
1. **Review the DUT** – open `labs/simple_dut/lab1_first_tb/work/and_gate.sv`.
2. **Create the testbench skeleton** – start from `tb_and_gate.sv` in the same directory. Instantiate the DUT and declare stimulus signals.
3. **Add stimulus & checker tasks**
   ```systemverilog
   task drive_transaction(input logic i_a, i_b);
     @(posedge clk);
     tb_a = i_a;
     tb_b = i_b;
   endtask

   task check_response(input logic expected_y);
     @(posedge clk);
     if (tb_y !== expected_y) $error("FAIL: a=%0b b=%0b y=%0b expected=%0b", tb_a, tb_b, tb_y, expected_y);
     else $display("PASS: a=%0b b=%0b y=%0b", tb_a, tb_b, tb_y);
   endtask
   ```
4. **Script the scenario** – call the tasks for each truth-table entry inside the main `initial` block.
5. **Run simulations** – compile both DUT and bench. Example with VCS:
   ```bash
   vcs -sverilog tb_and_gate.sv and_gate.sv -o simv
   ./simv
   ```
6. **Experiment** – insert a deliberate bug or extend the DUT (e.g., make it an OR gate) and update the checker. Practice turning failures into passing runs.

## Going Further
- Extend the bench to a small ALU and mirror the structure in `content/curriculum/T1_Foundational/F2_SystemVerilog_Basics`.
- Convert the procedural tasks into a class-based driver and scoreboard once you reach `I-SV-1`.

> When you're comfortable, graduate to the Tier-2 UVM agent labs—the same instantiate → drive → check pattern shows up there too.
