# 6a author log: lab dma-1

Owner module: I-UVM-3B (Advanced Sequencing and Layering), as the brief says. Lab prerequisite changed from `arbiter-1` (coming soon) to `uvm-mini-capstone` (I-UVM-3C, the runnable single-agent env); `modulePrerequisites` changed from `[]` to `["I-UVM-3A"]` (I-UVM-3B's manifest prerequisite on the spine card).

## What I built

The old lab was a stub: `lab.json` v1 `coming_soon` with no steps, and a non-UVM `lab1_simple_tb/test_dma.sv` against `labs/common/rtl/dma_ctrl.sv` (a toy whose read and write happen in one cycle with `mem_addr` assigned twice). I replaced it with a new lab in `content/curriculum/labs/dma/`:

- `rtl/dma_copy.sv`: a new one-channel copy DUT. Registers SRC/DST/LEN/CTRL/STATUS on a no-wait-state register port; a request/grant memory port with read data returned later on `mem_rvalid`; a `done_o` pulse. Two planted bugs chosen at run time with `+DMA_BUG=<n>` so one build covers every run: 1 = the copy ends one word early when LEN >= 2 (breaks R5); 2 = a DST write while BUSY is accepted and redirects the copy (breaks R3).
- `tb/dma_ifs.sv`, `tb/tb_top.sv`: two interfaces (one per agent), clock, reset, `run_test("dma_smoke_test")`, `$timeformat` so UVM prints ns.
- `work/dma_tb_pkg.sv` (starter) and `solution/dma_tb_pkg.sv` (worked solution): register agent, memory agent with a reactive responder serving from a shared `dma_mem_model`, a driverless upper sequencer `xfer_sqr`, a virtual sequencer with `` `uvm_declare_p_sequencer ``, a scoreboard with a programming-model shadow (predicts destination writes and register reads; done pulse closes each transfer; empty-run and mid-transfer checks in `check_phase`), and two tests. Learner TODOs: the translation sequence (step 2), `start_background` and the smoke virtual sequence with the ordering rule (step 3), `predict_transfer`/`end_of_transfer` (step 4), the reprogram-while-busy virtual sequence that shares `cfg_sqr` with the translation sequence (step 5).
- `README.md`: specification (R1-R6, M1-M3), bench diagram, Verilator build and run commands, six steps with captured logs, five questions with answers, the planted-bug table, a bench bug for "prove it fails" (responder never started, caught by the translation sequence's poll limit), push-further items and a checklist.
- `lab.json`: v2, `available`, six self-attested steps (no grader, so no `graderId` and no new grader id), assets README (guide), RTL and tb files (reference), `work/dma_tb_pkg.sv` (starter, editable), `solution/dma_tb_pkg.sv` (solution).
- Deleted `lab1_simple_tb/test_dma.sv` (inside my folder).

Stimulus uses `$urandom_range`, not `rand`/constraints: Verilator 5.052 needs an external SMT solver (z3 or cvc5) for constraint solving and none is installed here. The README says why.

Terminology follows I-UVM-3B: "translation sequence", "upper sequencer with no driver", `p_sequencer`.

## Sources verified (read in place)

IEEE 1800.2-2020 (`uvm_lrm.txt`):
- §14.2.3.1 `start`; §14.2.6.2 `start_item`; §14.2.6.3 `finish_item` (calls `wait_for_item_done`).
- §15.5.2.3 `uvm_sequencer::get_next_item`, §15.5.2.5 `item_done`.
- §15.3.2.18 `get_arbitration`: returns `UVM_SEQ_ARB_FIFO` if never set.
- §14.2.5.5 `lock` (arbitrated like any request), §14.2.5.6 `grab` (put in front of the arbitration queue), §14.2.5.7 `unlock`.
- §B.3.3 `` `uvm_declare_p_sequencer ``.

IEEE 1800-2023 (`t1_lrm_clean.txt`):
- §9.3.2 parallel blocks: `join_none` parent continues; "processes spawned by a fork-join block shall not start executing until the parent process is blocked or terminates" (quoted in Question 3, page 228).
- §18.13.2 `$urandom_range(maxval, minval = 0)`.

No AMBA source is used (the memory port is the lab's own request/grant protocol, not an Arm one). No external URLs or dates are cited.

## Verilator results (Verilator 5.052 2026-09-05, uvm-core 2020.3.1 at /Users/Rakesh/Downloads/1800.2-2020.3.1)

Lint (no errors in any):

- `verilator --lint-only -Wall rtl/dma_copy.sv`: clean, no warnings.
- `verilator --lint-only -Wall --timing -Wno-fatal --timescale 1ns/1ps -I$UVM_HOME/src $UVM_HOME/src/uvm_pkg.sv rtl/dma_copy.sv tb/dma_ifs.sv {work|solution}/dma_tb_pkg.sv tb/tb_top.sv --top-module tb_top`: 0 errors for both. Warnings only: DECLFILENAME, PROCASSINIT (`clk` initial value), UNDRIVEN/UNUSEDSIGNAL on interface signals and class members (lint false positives for signals driven through virtual interfaces and class fields), and in the starter UNUSEDPARAM `DST_ALT` / UNUSEDSIGNAL `poll_limit`, `status` (used once the TODOs are filled).

Build: `verilator --binary --timing -Wno-fatal -Wno-lint -Wno-style --timescale 1ns/1ps +define+UVM_NO_DPI -I$UVM_HOME/src $UVM_HOME/src/uvm_pkg.sv rtl/dma_copy.sv tb/dma_ifs.sv <pkg> tb/tb_top.sv --top-module tb_top -j 4 -Mdir obj_<n>` (rc 0, about 1.5 min wall, about 235 MB). Run `./obj_<n>/Vtb_top [plusargs]`. Every run prints the expected `[NO_DPI_USED]` and `[NO_VISIT_CHECK]` warnings.

| Build / run | Captured result | README |
|---|---|---|
| starter, no plusarg | 45 ns `no transfer was checked`; `[RESULT] FAIL: 1 errors` | Step 1 |
| starter, `+UVM_TESTNAME=dma_busy_test` | same, FAIL: 1 errors | Step 1 |
| solution with step 4 left as the starter's stubs | 74 `unexpected write` + empty-run error; `transfers started 9, checked 0 ... reads checked 679`; `FAIL: 75 errors` at 7235 ns | Step 3 |
| solution, no plusarg | `transfers started 9, checked 9; words matched 74; register reads checked 679`; `[RESULT] PASS` at 7235 ns | Step 4 |
| solution, `+UVM_TESTNAME=dma_busy_test` | VSEQ redirect at 405 ns; `started 3, checked 3; words matched 17; reads 164`; PASS at 1855 ns | Step 5 |
| solution, `+DMA_BUG=1` | transfers 3-9 each `ended with 1 of its words not written`; `checked 2; words matched 67`; `FAIL: 7 errors` | Step 6 table |
| solution, `+DMA_BUG=2` | PASS (bug escapes the smoke test) | Step 6 table |
| solution, `+UVM_TESTNAME=dma_busy_test +DMA_BUG=1` | transfer 3 `first missing: 0x000087e4`; `FAIL: 1 errors` | Step 6 table |
| solution, `+UVM_TESTNAME=dma_busy_test +DMA_BUG=2` | 16 writes to 0x9000-0x903C instead of 0x87A8-0x87E4, `read 0x04 returned 0x00009000, expected 0x000087a8`; `FAIL: 17 errors` | Step 6 table |
| solution with `rsp_seq.start` commented out | `UVM_FATAL ... [LAYER] DONE not set after 200 polls of STATUS` at 2135 ns; no RESULT line; `UVM_FATAL : 1` | Step 6 bench bug |

The final versions of the solution and starter files were rebuilt and rerun after the last (comment-only) edits; results identical.

Not run: any commercial simulator. The README says so and gives the route in words only (no invented flags).

## Validation

- `node scripts/generate-lab-registry.mjs --stdout` currently fails on another agent's in-progress lab (`multi-agent-vseq: missing asset: README.md`), not on dma-1. A copy of the script restricted to `dma/lab.json` (same zod schema, asset existence, owning module, grader rules) parses dma-1 cleanly. Lab prerequisite `uvm-mini-capstone` exists.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/lab-graders.test.ts tests/lib/lab-registry.test.ts tests/lib/lab-assets.test.ts tests/lib/learning-paths.test.ts tests/components/LabLink.test.tsx`: 5 files, 76 tests passed (against the not-yet-regenerated registry).
- `npx tsc --noEmit -p .`: rc 0. No TS/MDX files touched, so eslint and check-mdx have nothing of mine to check.
- Asset sizes are within `src/lib/lab-assets.ts` caps (largest file 29 KB; lab total 93 KB).

## Shared-file requests (for Integrate)

1. `content/curriculum/labs/compile-units.json`: replace the `"dma"` entry (it points at the deleted `lab1_simple_tb/test_dma.sv` and `../common/rtl/dma_ctrl.sv`) with two UVM units: `solution` = `rtl/dma_copy.sv`, `tb/dma_ifs.sv`, `solution/dma_tb_pkg.sv`, `tb/tb_top.sv`, `"uvm": true`; `starter` = the same with `work/dma_tb_pkg.sv`. Then `UVM_HOME=... node scripts/compile-sv.mjs --only dma`.
2. Tests that pin dma-1 as `coming_soon` must move to another coming-soon lab (for example `arbiter-1` or `fifo-1`): `tests/lib/learning-paths.test.ts` lines 100, 111, 198, 202; `tests/components/LabLink.test.tsx` lines 109-110.
3. Regenerate `src/generated/lab-registry.ts` (lead).
4. `src/lib/practice-links.ts`: optional entry so the lab is launched from the M5 pre-lab and linked from the layering lessons, for example `'dma-1': ['I-UVM-3B_Advanced_Sequencing_and_Layering/coordinated-attack-lab', 'I-UVM-3B_Advanced_Sequencing_and_Layering/layered-sequences', 'I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences']`. Without it the lab defaults to the I-UVM-3B index.
5. `docs/curriculum-quality/curriculum-spine.md`: the lab table row says dma-1's target owner is E-SOC-1 as the LAB-M8 DMA capstone, and the E-SOC-1 card says "re-own dma-1 here". This build follows the brief instead: a few-hours I-UVM-3B lab towards M5. Update the row (owner I-UVM-3B, available, M5-prep, `lab.json` v2, prerequisites above) and the E-SOC-1 card; LAB-M8 needs a separate lab (it could extend this DUT and bench).
6. `content/curriculum/labs/soc_level/lab2_soc_strategy_capstone/README.md` line 3 calls dma-1 the planned M8 code capstone; reword when item 5 is decided.
7. `content/curriculum/labs/common/rtl/dma_ctrl.sv` is no longer used by dma-1 (still listed in the `common` reference unit); left untouched.
