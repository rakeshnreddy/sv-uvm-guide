# Lab: The Refactoring Challenge

*Last updated: 2025-10-08*

This Tier-1 lab reinforces the "F2D: Reusable Code and Parallelism" lesson. You receive a short testbench with copy-pasted stimulus in a single `initial` block. Your mission is to refactor the repetitive code into a reusable task that accepts arguments—exactly the workflow recommended by IEEE 1800-2023 §13.4.

## Learning Objectives
- Apply the rules for `task automatic` and argument passing (IEEE 1800-2023 §13.4.2–§13.4.3).
- Keep simulation time control inside tasks (`@`, `#`, `wait`) while functions remain side-effect free (§13.5.1).
- Demonstrate how refactoring removes duplication and clarifies intent for future regressions.

## Files Provided
- `work/dut_counter.sv` – a trivial DUT that increments a counter when `enable` is high.
- `work/tb_counter_unrefactored.sv` – the starting testbench with the repetitive stimulus.
- `solution/` – a reference solution showing one clean way to extract the task.

## Your Task
1. Open `work/tb_counter_unrefactored.sv`. Notice how the `initial` block drives three sequences that all follow the same pattern.
2. Create a `task automatic drive_sequence(input byte start_value, input int repeat_count);` that:
   - Waits for the positive edge of the clock before driving `enable` and `data`.
   - Pulses `enable` high for `repeat_count` cycles while incrementing the payload.
   - Clears `enable` and prints the final counter value with `$display`.
3. Replace the copy-pasted blocks with calls to your task. Keep the existing comments—they help the grader confirm you covered each scenario.
4. Run the simulation using your preferred simulator (examples below). The reference logs should still show three sequences completing successfully.

## Example Simulator Commands
```bash
# Synopsys VCS
vcs -sverilog work/dut_counter.sv work/tb_counter_unrefactored.sv -o simv
./simv

# Siemens Questa
vlog work/dut_counter.sv work/tb_counter_unrefactored.sv
vsim -c tb_counter_unrefactored -do "run -all; quit"

# Cadence Xcelium
xrun work/dut_counter.sv work/tb_counter_unrefactored.sv
```

## Completion Checklist
- [ ] The `initial` block no longer contains repeated stimulus; it calls a parameterized task instead.
- [ ] The task is declared `automatic` and uses `input` arguments.
- [ ] Each stimulus sequence still completes and reports the counter value.

> **Ready to compare?** Inspect `solution/tb_counter_refactored.sv` after attempting the lab. It demonstrates one idiomatic use of tasks, loops, and `$display` to keep benches tidy.
