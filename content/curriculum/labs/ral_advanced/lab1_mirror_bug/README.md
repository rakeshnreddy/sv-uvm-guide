# RAL Mirror Bug Lab

Owning module: A-UVM-4B (Advanced RAL Techniques). Before you start, finish A-UVM-4A (RAL Fundamentals) and read the "Debugging a mirror mismatch" section of A-UVM-4B.

## The situation

You have inherited a UVM environment for a small codec register block. It compiles and runs, but the run ends with `UVM_ERROR` reports from the register model. Your job is to find out why **from the log**, fix the environment, and repeat until the run is clean. The DUT is correct: every fault is in the testbench.

The environment has more than one fault. Fixing one can expose the next, so rerun after every change.

## The design and the test

The DUT sits on a simple bus: one transfer in each clock cycle in which `valid` is 1, and the DUT is always ready.

| Address | Register | Fields | Behaviour |
| --- | --- | --- | --- |
| `'h00` | CFG | GAIN[31:0] RW | Plain read-write |
| `'h04` | CTRL | EN[0] RW, LED[1] W1T | Writing 1 to LED toggles it |
| `'h08` | IRQ | ERR[0] W1C | The hardware sets ERR when a write hits an address with no register; writing 1 clears it |

The test (`codec_test`) does this, in order:
1. writes CTRL = `'h3` and CFG = `'h55` through the register model;
2. runs `fw_write_seq`, which stands in for the CPU's boot firmware: it writes CFG = `'hA5` over the same bus, then writes to `'hFC`, an address with no register, which makes the DUT set IRQ.ERR;
3. reads IRQ through the register model, checks that it returned 1, and calls `irq.mirror(status, UVM_CHECK)`;
4. clears IRQ by writing 1, then calls `mirror(status, UVM_CHECK)` on CFG, CTRL and IRQ.

`mirror(status, UVM_CHECK)` reads the register and compares the value read with the mirror the model held **before** the read.

## How to run it

Compile `testbench_buggy.sv` with the Accellera uvm-core 2020.3.1 library on a simulator with UVM support, with `tb_top` as the top module. The test name is built in (`run_test("codec_test")`).
- Add `+UVM_VERBOSITY=UVM_HIGH` to see one `REG_PREDICT` line each time the register predictor updates the mirror.
- Add `+UVM_VERBOSITY=UVM_FULL` to also see `REG_PREDICT_NOT_FOR_ME` for transfers that target no register (the probe to `'hFC` is one).

The clock period is 10 ns, reset is released at 20 ns, and each register access takes two clock edges: the transfer edge, then one idle edge before the driver calls `item_done()`. So the times in the log are predictable. The accesses in the test transfer at 35, 55, 75, 95, 115, 135, 155, 175, 195 and 215 ns, in the order listed above.

## What the register model prints

When `mirror(UVM_CHECK)` finds a difference, uvm-core 2020.3.1 prints one error for the register and one line per field that differs. For example (illustrative values; the formats are from `uvm_reg.svh`, and the file, line and component fields are shortened to `…`):

```text
UVM_ERROR … @ 205: … [RegModel] Register "ral.ctrl" value read from DUT (0x0000000000000003) does not match mirrored value (0x0000000000000000) (valid bit mask = 0x0000000000000003)
UVM_INFO … @ 205: … [RegModel] Field en (ral.ctrl[0:0]) mismatch read=1'h1 mirrored=1'h0
UVM_INFO … @ 205: … [RegModel] Field led (ral.ctrl[1:1]) mismatch read=1'h1 mirrored=1'h0
```

Read it as: "the DUT holds `'h3`; the model believed `'h0`; fields EN and LED differ". The time tells you *which* check failed.

## Your mission

Work through the steps in the lab page. For every failure:
1. **Read the symptom.** Which register and fields differ? What does the DUT hold, and what did the model believe?
2. **List the accesses** that changed that register during the test, and which component started each one: the register model, or the firmware sequence.
3. **Walk the checklist** from the lesson, in the order a prediction travels:
   1. Is the monitor's analysis port connected to `predictor.bus_in`?
   2. Does the monitor publish every transfer, with the read data for reads?
   3. Does the adapter's `bus2reg()` set kind, address, data and status correctly?
   4. Is `predictor.map` the root map of a locked model, and do the addresses match?
   5. Do the field's access policy and `volatile` setting match the hardware, and was the access status OK?
   6. Is the access predicted twice (auto-predict on next to a connected predictor)?
   7. Does the adapter's `provides_responses` match how the driver returns read data?
4. **Fix one thing, rerun, and confirm** that the symptom you were chasing is gone before you look at the next one.

**Done means:** the run ends with `UVM_ERROR :    0` and `UVM_FATAL :    0` in the report summary, the last message is `[TEST] register checks complete`, and you can name, for each fix, the checklist question it answers.

## Hint ladder

Use these only when you are stuck, one at a time.

**First failure (CFG).**
- Hint 1: CFG was written twice. Which write does the mirror hold, and which component started each write?
- Hint 2: Which prediction set-up predicts only the accesses the register model starts? Which component would have seen the firmware write, and does it ever receive anything?

**Second failure (one field of CTRL).**
- Hint 1: Only the W1T field is wrong, and by exactly one toggle. How many times must the CTRL write have been predicted?
- Hint 2: List everything in the environment that can predict a register-model access.

**Third failure (IRQ, right after a read that returned 1).**
- Hint 1: The test's own check says `read()` returned 1, so the DUT, the driver and the adapter's read path are fine. Who else reports a value for that read?
- Hint 2: Rerun with `+UVM_VERBOSITY=UVM_HIGH` and compare the `REG_PREDICT` line for the IRQ read at 115 ns with what `read()` returned. Which component produced the value the predictor used?

## Going further

When the run is clean, re-break each fix on its own and confirm that its original symptom returns. Then answer:
- Why did the first fault produce no message of its own?
- Why did the second fault leave CFG, EN and ERR correct?
- Why did the third fault not break CFG's checks, even though CFG's reads were mispredicted too?

The solution (`testbench_solution.sv`) marks each fix with a comment.
