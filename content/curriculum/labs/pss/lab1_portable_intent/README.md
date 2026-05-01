# Lab: Memory Read/Write Portable Intent

## Scenario

You are verifying a memory subsystem that must run the same read-after-write test in RTL simulation and on a bare-metal validation target. The team already has hand-written UVM and C versions, but every change to the address constraints or data range must be duplicated.

This lab asks you to capture the intent once in PSS: write a value to an aligned address, read the same address back, and verify the data.

## Objective

1. Open `starter/mem_test.pss`.
2. Complete the TODOs so the PSS model expresses:
   - A write action followed by a read-verify action.
   - A 4-byte aligned address constraint.
   - A write-data constraint from `0x0000` through `0xffff`.
   - A cross-action data dependency so the read verifies the exact address/data chosen by the write.
3. Compare your work with `solution/mem_test.pss`.
4. Review the generated target examples:
   - `solution/generated_uvm_sequence.sv`
   - `solution/generated_baremetal_test.c`

## Files

| File | Purpose |
|---|---|
| `starter/mem_test.pss` | PSS skeleton with TODOs |
| `solution/mem_test.pss` | Complete reference PSS intent |
| `solution/generated_uvm_sequence.sv` | Simplified UVM sequence generated from the PSS intent |
| `solution/generated_baremetal_test.c` | Simplified C bare-metal test generated from the same PSS intent |

## Mapping Guide

| PSS construct | Generated UVM target | Generated C target |
|---|---|---|
| `action write_mem` | Randomized write sequence item and `mem_agent.write()` call | `mem_write32(addr, data)` |
| `action read_verify` | `mem_agent.read()` followed by `uvm_error` on mismatch | `mem_read32()` followed by `test_fail()` on mismatch |
| `constraint addr[1:0] == 0` | `addr % 4 == 0` randomization constraint | `rand_aligned_addr(..., 4)` helper |
| `constraint data <= 32'h0000ffff` | `data inside {[0:32'hffff]}` randomization constraint | `rand32() & 0xffffu` |
| `rd.wr == wr` | Read sequence copies the write action's address and expected data | Readback compares against the same write data |

## Side-by-Side Diff

```diff
 activity {
-  // TODO: instantiate write and read_verify actions
-  // TODO: bind the read_verify action to the write action
+  do write_mem as wr;
+  do read_verify as rd with {
+    rd.wr == wr;
+  };
 }
```

## Expected Outcome

The completed PSS solution describes one portable test intent. A PSS compiler can lower that intent into target-specific code while preserving the same scenario contract:

```text
WRITE addr=0x00001040 data=0x0000beef
READ  addr=0x00001040 data=0x0000beef
PASS  read-after-write data matched
```

## Need Help?

Review [E-PSS-1: Portable Stimulus Standard](../../../T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index.mdx), especially the sections on actions, activity graphs, and target compilation.
