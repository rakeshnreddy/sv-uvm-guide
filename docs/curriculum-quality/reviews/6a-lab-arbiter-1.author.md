# 6a author log: lab `arbiter-1`

## What I built

Lab `arbiter-1` v2, status `available`. It is a small UVM environment for a synchronous round-robin arbiter, written from a specification (R1 to R5 plus a fairness bound). Files are under `content/curriculum/labs/arbiter/`:

- `lab.json`: v2 with six self-attested steps: run the starter (a vacuous pass), agent, scoreboard, plan sequences and coverage, the clean regression, and prove it fails. It has no grader. The lab needs no new grader id, so `src/lib/lab-graders.ts` and `knownGraders` are unchanged.
- `README.md`: specification, a cycle diagram of the clocking-block timing, steps, a plan table, a coverage table, expected logs captured from Verilator, a bug table (two planted bugs, a learner-made bug, and a fairness-only run), a stretch section, run notes, a PASS/FAIL section, a checklist and references.
- `work/rr_arbiter.sv`: the DUT. It is new and self-contained: synchronous reset, combinational grant, registered last-winner pointer. `BUG=1` stops the pointer when requester 3 wins (requester 3 hogs, the others starve). `BUG=2` never moves the pointer (fixed priority).
- `work/arb_if.sv`: the interface, with `drv_cb` (output skew 0) and `mon_cb` (input skew #1step). Complete.
- `work/tb_top.sv`: clock, reset, DUT with ``.BUG(`ARB_BUG)``, the `uvm_config_db` set, and `run_test("arb_regress_test")`. Complete.
- `work/arb_pkg.sv`: the starter package. It compiles and runs, and has `TODO step N` markers in the driver, monitor, agent, scoreboard, coverage, env connect and the two sequence bodies.
- `solution/arb_pkg.sv`: the full worked solution. The scoreboard has two parts. A grant predictor follows its own predictions. A fairness bound counts waits from the DUT's grants and reports `ARB_STARVED` at a wait of N. Accounting reports `ARB_NO_TRAFFIC`. A `uvm_subscriber` covergroup covers the winner, the load (one, some, all), the winner's wait (0 to 3) and the cross of winner and load. The package also has smoke, load, regress and random tests.

The old `lab1_simple_tb/test_arbiter.sv` is no longer an asset. I left the file on disk because `compile-units.json` still lists it and `tests/curriculum/compile-sv.test.ts` checks that listed files exist (see the requests below).

## Sources verified

These were checked in the local copies with Python search.
- IEEE 1800.2-2020: 12.2.10, 12.2.10.1, 12.2.10.2 (analysis port and imp); 13.4.2.2 `get_is_active`; 13.5, 13.6, 13.7, 13.9 (monitor, scoreboard, driver, subscriber); 15.2.1.2.1 `get_next_item`, 15.2.1.2.3 `item_done`; 10.5.1.3.3 and 10.5.1.3.4 (raise and drop objection), 10.5.1.3.7 `set_drain_time`; F.7.3.1 `run_test`. The APIs used (`phase.get_objection()`, `uvm_root::get().set_timeout`) are in the uvm-core 2020.3.1 sources at `~/Downloads/1800.2-2020.3.1/src`.
- IEEE 1800-2023: 3.14.2.3; 14.3 (quoted: "the default input skew is 1step and the default output skew is 0"); 14.4, 14.13, 14.16; 19.5, 19.6; 19.11 (the weighted-average formula, which I used to compute the 47.92% and 83.33% values); 20.9 (`$countones`, `$onehot`, `$onehot0`); 20.4.3 Table 20-3 (default `%t` units).
- No external URLs, dates or history claims were added.

## Verilator results (Verilator 5.052, uvm-core 2020.3.1 from the local Accellera kit)

Lint, starter and solution:
`verilator --lint-only -Wall --timing -Wno-fatal +define+UVM_NO_DPI -I$U $U/uvm_pkg.sv work/arb_if.sv {work|solution}/arb_pkg.sv work/rr_arbiter.sv work/tb_top.sv --top-module tb_top`
The result was 0 errors. The warnings are DECLFILENAME, PROCASSINIT (`clk` initializer plus toggle), WIDTHTRUNC (`!it.randomize()`), and UNUSED or UNDRIVEN warnings on class fields, clocking-block members and the covergroup's generated members. The DUT alone under `-Wall` gives one UNUSEDSIGNAL (the upper bits of the `int idx`).

Binary (U = the kit's `src`):
`verilator --binary --timing -Wno-fatal -Wno-lint -Wno-style --timescale 1ns/1ps +define+UVM_NO_DPI [+define+ARB_BUG=n] -I$U $U/uvm_pkg.sv work/arb_if.sv <pkg> <dut> work/tb_top.sv --top-module tb_top -j 4`, then `./obj_dir/Vtb_top +UVM_TESTNAME=<test> [+ARB_FAIRNESS_ONLY]`.

| Build | Test | ARB_SUMMARY (cycles, grants, mismatches, protocol, starved) | Coverage printed | UVM_ERROR |
|---|---|---|---|---|
| starter | regress | 0, 0, 0, 0, 0 (ends at 5 ns) | 0.00% | 0 |
| solution, BUG 0 | regress | 30, 24, 0, 0, 0 (ends at 330 ns) | 100.00% | 0 |
| solution, BUG 0 | smoke | 11, 8, 0, 0, 0 | 43.48% | 0 |
| solution, BUG 0 | load | 20, 16, 0, 0, 0 | 78.26% | 0 |
| BUG 1 | smoke / load / regress | 11,8,0,0,0 / 20,16,5,0,4 / 30,24,8,0,4 | 43.48 / 73.91 / 73.91% | 0 / 9 / 12 |
| BUG 1 | regress `+ARB_FAIRNESS_ONLY` | 30, 24, 0, 0, 4 | | 4 |
| BUG 2 | smoke / load / regress | 11,8,0,0,0 / 20,16,10,0,5 / 30,24,10,0,5 | 43.48 / 34.78 / 65.22% | 0 / 15 / 15 |
| BUG 2 | regress `+ARB_FAIRNESS_ONLY` | 30, 24, 0, 0, 5 | | 5 |
| own bug (`k = 0 .. N-1`) | smoke / load / regress | 11,8,0,0,0 / 20,16,10,0,5 / 30,24,10,0,5 | | 0 / 15 / 15 |

The BUG 0 regress row above is from the final solution build (5 ns drain). An earlier build with a 10 ns drain gave the same summary at 335 ns. I changed the drain to 5 ns so that the run ends between edges and the sample count cannot depend on scheduling order.

UVM-on-Verilator limitations, stated in the README:
- Without `UVM_NO_DPI` the link fails on `uvm_hdl_*` and `uvm_re_*`. With it, UVM prints the `NO_DPI_USED` and `NO_VISIT_CHECK` warnings.
- Constrained `randomize()` calls an external SMT solver. Neither z3 nor cvc5 is installed here, so `arb_random_test` was not run successfully: every `randomize()` failed. The sequence now ends the run with `uvm_fatal("ARB_RAND")` instead of sending unrandomized items, and the README gives no numbers for it.
- Verilator 5.052 prints partial coverage as covered bins over all bins, not the §19.11 weighted average. The README gives both columns.
- Verilator is 2-state.
- Each UVM build takes about 2.5 minutes. Object files were deleted after each build because disk space is low.

No commercial simulator was available. The vendor run commands are described generically, not given as flags.

## Decisions to confirm

- **owningModule I-UVM-3C, not I-UVM-2A.** The brief said I-UVM-2A (today's manifest value). Spine Appendix B and the I-UVM-2A and I-UVM-3C cards recommend I-UVM-3C ("independent variant"). The lab needs sequences (I-UVM-3A), analysis imps (I-UVM-2B) and covergroups (I-SV-3A), all of which come before I-UVM-3C. If the lead prefers I-UVM-2A, change `owningModule` and the README's first paragraph.
- **labPrerequisites `uvm-mini-capstone`** (was `simple-dut-1`). **modulePrerequisites** `I-UVM-2A`, `I-UVM-2B`, `I-UVM-3A`, `I-SV-3A`.
- The spine says the independent variant is "built from spec without TODOs". The brief asked for TODO markers, so the starter keeps short TODO markers that state what to write, not how.

## Shared-file requests (Integrate step)

1. `content/curriculum/labs/compile-units.json`: replace the `"arbiter"` entry with these units: `solution` = `["work/arb_if.sv","solution/arb_pkg.sv","work/rr_arbiter.sv","work/tb_top.sv"]`; `solution_bug1` (same files, defines `["ARB_BUG=1"]`); `solution_bug2` (defines `["ARB_BUG=2"]`); `starter` = `["work/arb_if.sv","work/arb_pkg.sv","work/rr_arbiter.sv","work/tb_top.sv"]`. Then delete `content/curriculum/labs/arbiter/lab1_simple_tb/` (it is no longer an asset, and it compiled `../common/rtl/arbiter.sv`).
2. `src/lib/practice-links.ts`: link `arbiter-1` from I-UVM-3C (as the independent variant) and optionally from I-UVM-2A. Nothing links it today.
3. `docs/curriculum-quality/curriculum-spine.md`: in Appendix B, set the `arbiter-1` row to available, owner I-UVM-3C, lab prerequisite `uvm-mini-capstone`. Update the "coming soon" mentions on the I-UVM-2A and I-UVM-3C cards and in the `simple-dut-1` row notes (line 2099 and Appendix B), which say only `arbiter-1` lists `simple-dut-1`. It no longer does.
4. Regenerate `src/generated/lab-registry.ts`. My manifest passes the per-manifest checks of `scripts/generate-lab-registry.mjs`, tested with a filtered copy. The full run currently fails on other agents' in-progress labs (`dma-1`, `multi-agent-vseq` missing README.md).
5. No test pins `arbiter-1` as coming soon (I searched `src` and `tests`).
