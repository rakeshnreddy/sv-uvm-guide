# Lab: Memory Read/Write Portable Intent

## Scenario

You are verifying a memory subsystem that must run the same read-after-write test in RTL simulation and on a bare-metal validation target. The team already has hand-written UVM and C versions, but every change to the address constraints or data range must be duplicated.

This lab asks you to capture the intent once in PSS: write a value to an aligned address, read the same address back, and verify the data.

## Objective

1. Open `starter/mem_test.pss`.
2. Complete the TODOs so the PSS model expresses:
   - A write action whose `output` is a `mem_buf_s` buffer, and a read-verify action whose `input` is a `mem_buf_s` buffer.
   - A 4-byte aligned address constraint and a write-data range of `0x0000` through `0xFFFF`.
   - An activity that traverses the write and then the read, and binds the read's input to the write's output so the read checks exactly the address and data that write chose.
3. Compare the two generated targets below. They show how one PSS model becomes UVM and C code.

## Files

| File | Purpose |
|---|---|
| `starter/mem_test.pss` | PSS skeleton with TODOs |
| `solution/mem_test.pss` | Complete reference PSS intent (unlocks when you finish the lab) |
| `solution/generated_uvm_sequence.sv` | Simplified UVM sequence generated from the PSS intent |
| `solution/generated_baremetal_test.c` | Simplified C bare-metal test generated from the same PSS intent |

## Three PSS rules this lab relies on

- **Data passes through flow objects.** An action's `input` and `output` fields are `buffer`, `stream` or `state` objects, never other actions. A `buffer` producer completes before its consumer starts.
- **Traversals are labelled, not aliased.** Write `wr_a: do write_mem;`. PSS has no `do write_mem as wr` form.
- **`bind` connects one producer to one consumer.** `bind wr_a.wr rd_a.rd;` makes the read consume this write's buffer. Without it, the tool may bind the input to any suitable output, or infer a new write.

## Mapping Guide

| PSS construct | Generated UVM target | Generated C target |
|---|---|---|
| `action write_mem` with `output mem_buf_s wr` | `mem_write_seq` started with the solved `wr.addr`/`wr.data` | `mem_write32(addr, data)` |
| `action read_verify` with `input mem_buf_s rd` | `mem_read_seq`, then `uvm_error` on mismatch | `mem_read32(addr)`, then `test_fail()` on mismatch |
| `wr.addr % 4 == 0` | A solved address such as `32'h0000_1040` | The same address, `0x00001040u` |
| `wr.data in [0x0000..0xFFFF]` | A solved data value such as `32'h0000_BEEF` | The same data, `0x0000BEEFu` |
| `bind wr_a.wr rd_a.rd` | The read uses the write's address and expected data | The readback compares against the same data |

## Side-by-Side Diff

```diff
 activity {
-  // TODO 4: traverse write_mem with the label wr_a.
-  // TODO 5: traverse read_verify with the label rd_a, after wr_a.
-  // TODO 6: bind wr_a.wr to rd_a.rd so the read checks this write's buffer.
+  wr_a: do write_mem;
+  rd_a: do read_verify;
+  bind wr_a.wr rd_a.rd;
 }
```

## Generated targets (excerpts)

In this example the tool solved `addr = 0x1040` and `data = 0xBEEF`, then pasted each action's `exec body` template with the `{{...}}` references filled in. Some tools instead emit code that solves on the target at run time.

UVM (`exec body SV` templates):

```systemverilog
// wr_a: do write_mem
mem_write_seq wr_seq = mem_write_seq::type_id::create("wr_seq");
wr_seq.addr = 32'h0000_1040;
wr_seq.data = 32'h0000_BEEF;
wr_seq.start(p_sequencer.mem_sqr);

// rd_a: do read_verify (bound to wr_a.wr)
mem_read_seq rd_seq = mem_read_seq::type_id::create("rd_seq");
rd_seq.addr = 32'h0000_1040;
rd_seq.start(p_sequencer.mem_sqr);
if (rd_seq.data !== 32'h0000_BEEF) `uvm_error("PSS_MEM_VERIFY", ...)
```

C (`exec body C` templates):

```c
mem_write32(0x00001040u, 0x0000BEEFu);                 /* wr_a */
if (mem_read32(0x00001040u) != 0x0000BEEFu)            /* rd_a */
    test_fail("read-after-write mismatch");
```

## Expected Outcome

Your PSS model is complete when every TODO is filled and it matches the solution's structure: the constraints live on `wr`, the read takes `rd` as an `input`, and the activity binds `wr_a.wr` to `rd_a.rd`. Running either generated target against a correct memory writes `0x0000BEEF` to `0x00001040`, reads the same value back, and reports no `PSS_MEM_VERIFY` error (UVM) and no `test_fail()` (C).

## Need Help?

Review [E-PSS-1: Portable Stimulus Standard](../../../T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index.mdx), especially the sections on actions and flow objects, activities, and compiling PSS to each target.
