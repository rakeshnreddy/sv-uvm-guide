# Lab: Memory Read/Write Portable Intent

This lab belongs to E-PSS-1: Portable Stimulus Standard. It uses Accellera PSS 3.0 syntax.

## Scenario

You are verifying a memory subsystem that must run the same read-after-write test in RTL simulation and on a bare-metal validation target. The team already has hand-written UVM and C versions, but every change to the address constraints or data range must be duplicated.

This lab asks you to capture the intent once in PSS: write a value to an aligned address, read the same address back, and verify the data.

## Objective

1. Open `starter/mem_test.pss`.
2. Complete the TODOs so the PSS model expresses:
   - A write action whose `output` is a `mem_buf_s` buffer, and a read-verify action whose `input` is a `mem_buf_s` buffer.
   - A 4-byte aligned address and a write-data range of `0x0000` through `0xFFFF`.
   - An activity that traverses the write and then the read, and binds the read's input to the write's output so the read checks exactly the address and data that write chose.
   - The two realization packages at the end of the file, each extending `write_mem` and `read_verify`: `mem_real_sv`, whose SV templates start `mem_write_seq` and `mem_read_seq` on `p_sequencer.mem_sqr`, and `mem_real_c`, whose C templates call `mem_write32()` and `mem_read32()`.
3. Before you open the solution, predict: if you delete the `bind`, what may the tool do?
4. Compare the two generated targets below. They show how one scenario becomes UVM code with `mem_real_sv` active and C code with `mem_real_c` active.

## Files

| File | Purpose |
|---|---|
| `starter/mem_test.pss` | PSS skeleton with TODOs |
| `solution/mem_test.pss` | Complete reference model: the scenario and its two realization packages (unlocks when you finish the lab) |
| `solution/generated_uvm_sequence.sv` | Simplified UVM virtual sequence generated from the scenario with `mem_real_sv` active |
| `solution/generated_baremetal_test.c` | Simplified C bare-metal test generated from the same scenario with `mem_real_c` active |

## PSS rules this lab relies on

- **Data passes through flow objects.** An action's `input` and `output` fields are `buffer`, `stream` or `state` objects, never other actions and never resources. A `buffer` producer completes before its consumer starts.
- **Traversals are labelled, not aliased.** Write `wr_a: do write_mem;`. PSS has no `do write_mem as wr` form.
- **`bind` pins which object an action consumes.** Here, `bind wr_a.wr rd_a.rd;` makes the read consume this write's buffer. (A buffer may feed any number of readers, and one `bind` may list several fields.) Without it, the tool may bind the input to any suitable earlier output, or infer a new write.
- **Templates are pasted verbatim.** The tool inserts each `exec body` text into the generated test with every `{{...}}` reference replaced by its solved value. Wrap each SV template in `begin ... end` so its declaration is legal wherever it lands.
- **One realization package per generated test.** A single exec block maps to at most one language, and same-kind exec blocks in one scope merge into one (PSS 3.0 §22.1.1 b, e). So the standard gives an action a C and an SV realization through different packages that are not used for the same test (§22.5.1): here `mem_real_sv` and `mem_real_c`, each an `extend action` of `write_mem` and `read_verify`. Each generated test, UVM or C, uses one of them. How you tell the tool which package is active is tool-dependent (§21.1). Some tools also accept SV and C bodies side by side in one action; that is tool behaviour, not the standard.
- **The root component.** The tool must be told the root action and root component. The standard's default root component is `pss_top`; this lab's model is in `mem_portability_lab`, so designate it as the root (or wrap it in a `component pss_top`).

## Where checking lives

This lab's SV `read_verify` template checks the read data itself and reports `PSS_MEM_VERIFY` with `` `uvm_error ``: a self-checking sequence, which suits a bench without a scoreboard. The E-PSS-1 lesson shows the other pattern, where the SV template only reads and the UVM scoreboard checks every monitored read. Both are legitimate; choose one per environment so a read is not checked twice by different rules. The C template always checks inline, because bare metal has no scoreboard.

## Mapping Guide

| PSS construct | Generated UVM target | Generated C target |
|---|---|---|
| `action write_mem` with `output mem_buf_s wr` | `mem_write_seq` started with the solved `wr.addr`/`wr.data` | `mem_write32(addr, data)` |
| `action read_verify` with `input mem_buf_s rd` | `mem_read_seq`, then `uvm_error` on mismatch | `mem_read32(addr)`, then `test_fail()` on mismatch |
| `wr.addr % 4 == 0` | A solved address such as 4160 (`0x1040`) | The same address |
| `wr.data in [0x0000..0xFFFF]` | A solved data value such as 48879 (`0xBEEF`) | The same data |
| `bind wr_a.wr rd_a.rd` | The read uses the write's address and expected data | The readback compares against the same data |
| Active realization package | `mem_real_sv` | `mem_real_c` |

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

In this example the tool solved `addr = 0x1040` and `data = 0xBEEF`, then pasted each action's `exec body` template from the active package with the `{{...}}` references filled in. A `bit` field is printed as unsigned decimal, so the generated code really contains `4160` and `48879`; the listings below and the files in `solution/` show the values in hex for readability. Some tools instead emit code that solves on the target at run time.

UVM (generated with `mem_real_sv` active; its `exec body SV` templates land inside the generated virtual sequence's `body()`):

```systemverilog
// excerpt: each template is wrapped in begin ... end
begin  // wr_a: do write_mem
  mem_write_seq wr_seq = mem_write_seq::type_id::create("wr_seq");
  wr_seq.addr = 32'h0000_1040;
  wr_seq.data = 32'h0000_BEEF;
  wr_seq.start(p_sequencer.mem_sqr);
end
begin  // rd_a: do read_verify (bound to wr_a.wr)
  mem_read_seq rd_seq = mem_read_seq::type_id::create("rd_seq");
  rd_seq.addr = 32'h0000_1040;
  rd_seq.start(p_sequencer.mem_sqr);
  if (rd_seq.data !== 32'h0000_BEEF) `uvm_error("PSS_MEM_VERIFY", ...)
end
```

The generated sequence runs on a virtual sequencer and reaches the real memory sequencer through `p_sequencer`, as taught in [I-UVM-3B: virtual sequences and the virtual sequencer](/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences).

C (generated with `mem_real_c` active, from its `exec body C` templates):

```c
mem_write32(0x00001040u, 0x0000BEEFu);                 /* wr_a */
if (mem_read32(0x00001040u) != 0x0000BEEFu)            /* rd_a */
    test_fail("read-after-write mismatch");
```

## Expected Outcome

Your PSS model is complete when every TODO is filled and it matches the solution's structure: the constraints live on `wr`, the read takes `rd` as an `input`, the activity binds `wr_a.wr` to `rd_a.rd`, the SV templates live in `mem_real_sv` and the C templates in `mem_real_c`, and each SV template is wrapped in `begin ... end`. Generate the UVM test with `mem_real_sv` active and the C test with `mem_real_c` active. Running either generated target against a correct memory writes `0x0000BEEF` to `0x00001040`, reads the same value back, and reports no `PSS_MEM_VERIFY` error (UVM) and no `test_fail()` (C).

Your Step 3 prediction: without the `bind`, the read's input is unbound. The tool must still complete the scenario, so it may bind the input to this write's buffer or to another legal producer, including a write it infers (PSS 3.0 §17.1). In this tiny model the traversed write is the only candidate that completes first, but nothing in the model guarantees it once other writes are added.

An open-source parser, PSSTools `pssparser`, can check PSS syntax. Its command line and the PSS version it tracks are not verified by this course; follow its README if you try it.

## Extend it (optional)

Add what the three steps do not exercise, and predict before you reason it through:

1. Declare `resource mem_region_r { }` and `pool [2] mem_region_r region_p; bind region_p *;` in the component.
2. Give `write_mem` a `lock mem_region_r region;` and `read_verify` a `share mem_region_r region;`.
3. Write a new root action whose activity runs two write-then-read pairs in `parallel`, each pair in a `sequence { }` with its own `bind`.
4. Predict: is the scenario legal with `pool [2]`? With `pool [1]`? With `pool [1]` and `schedule` instead of `parallel`? (Answers: legal; no legal scenario, because the two locks would have to wait for each other; legal, because `schedule` lets the tool serialize them. The lesson's Make It Work section has the full model.)

## Need Help?

Review [E-PSS-1: Portable Stimulus Standard](/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index), especially the sections on actions and their exec templates, activities, flow objects and resources, and generation into UVM and C.
