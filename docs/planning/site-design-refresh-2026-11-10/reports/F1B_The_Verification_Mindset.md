# F1B — The Verification Mindset

The lesson contains 19 visual instances. Three are hand-drawn, five come from the kit, and eleven embeds use seven distinct visual interactives. The four additional interview prompts are ordinary quiz controls. All four are included in the default-state and height inventories.

## Visual inventory and teaching intent

| Base MDX line | Visual | What the learner should see |
| --- | --- | --- |
| 38 | Self-checking testbench | The compare decides PASS or FAIL, while coverage records what happened. The compare is the focal node. |
| 129 | Implication, disable and cover | Follow one rising edge to distinguish the same-edge check, the next-edge check, a disabled attempt and a coverage hit. |
| 228 | FirstBugHuntGame | The failing assertion distinguishes a counter that wraps at six from the corrected counter. |
| 248 | CounterBenchLab, X-blind compare | An unknown output can escape a weak compare. Follow the unknown result to the bench verdict. |
| 266 | Load-priority timing | The simultaneous load and enable precede the first difference between RTL and expected count. |
| 306 | Verification methods grids | The same outlined cell holds the bug on all three grids. What changes is how each method reaches it. |
| 521 | VerificationMethodsExplorer | Change the stimulus distribution or assumptions and see whether the bug cell is reached. |
| 525 | VerificationMethodologiesDiagram | The current method operates on a particular representation of the design. |
| 599 | CounterBenchLab, coverage | Executing every branch can still leave the reset-during-counting scenario untested. |
| 615 | Two-hot timing | Read the failing one-hot check at the edge on which the illegal two-hot state appears. |
| 657 | Coverage against random samples | The rare bin dominates the cost of closing coverage after the common bins fill. |
| 699 | ClosureBudgetLab | Compare the sample budget for a rare reachable bin with a directed test or a waiver. |
| 741 | ScenarioSorter | Each verification job calls for a method that answers its specific question. |
| 758 | Bug-injection recap | A qualified check fails on the injected bug and passes after its removal. |
| 892 | Wrap mutant over twelve checks | Check seven is where the mutant first diverges from the independent expected count. |
| 932 | CounterBenchLab, matrix | The compare form determines which of the three mutants the bench can catch. |
| 967 | OperatorExplorer | Setting an input bit to X distinguishes a bit-counting result from an unknown-value check. |
| 996 | VerificationMethodsExplorer, assumptions | Excluding simultaneous load and enable can make the proof pass while making the bug unreachable. |
| 1016 | CounterBenchLab, self-copy | A model that copies the DUT output agrees with the mutant at every check. |

The existing trace conventions identify expected values in teal, one-bit levels in slate and cyan, unknowns and mismatches in rose, and matches in emerald. A redesign must retain the edge labels, glyphs and trace shapes that carry those distinctions.

## Kit requests

The shared CycleWaveform renderer maps the existing `info` highlight to `fill-sky-500/[0.13] stroke-sky-500/40`. The first timing figure uses that highlight to designate sampled edges. At MDX line 129 it measured 1.49:1 in light mode. Use figure tokens for the existing info highlight and recheck it in both themes. Addendum 1 retains the measurement as a kit note while the lesson redesign proceeds.

The final run recorded 434 measurements below the shared kit floors or palette findings. The table groups repeated labels at the same location. Each row refers to the current lesson `content/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index.mdx`. The [gate JSON](F1B_The_Verification_Mindset.json) retains the unrounded measurements.

<details>
<summary>Kit measurement details</summary>

| Gate | MDX line | Figure and element | Measurements |
| --- | --- | --- | --- |
| G7 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter | dark 1440 fill-sky-500, stroke-sky-500, light 1440 fill-sky-500, stroke-sky-500, dark 390 fill-sky-500, stroke-sky-500, light 390 fill-sky-500, stroke-sky-500 |
| G5 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · line stroke-border/70 | dark 1440 1.26:1, dark 1440 1.28:1, dark 1440 1.27:1, light 1440 1.16:1, dark 390 1.27:1, light 390 1.16:1 |
| G5 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · rect fig-band fill-sky-500/[0.13] stroke-sky-500/40 | dark 1440 2.05:1, light 1440 1.47:1, dark 390 2.05:1, light 390 1.47:1 |
| G5 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · rect fig-band fill-fig-cyan-fill stroke-fig-cyan/40 | dark 1440 2.53:1, light 1440 1.69:1, dark 390 2.53:1, light 390 1.68:1 |
| G5 | 229 | FirstBugHuntGame · line stroke-border/70 | dark 1440 1.25:1, light 1440 1.16:1, dark 390 1.27:1, light 390 1.17:1 |
| G5 | 229 | FirstBugHuntGame · line stroke-muted-foreground/25 | dark 1440 1.61:1, dark 1440 1.60:1, dark 1440 1.59:1, light 1440 1.46:1, dark 390 1.61:1, dark 390 1.62:1, light 390 1.46:1 |
| G5 | 267 | The load-priority bug: ld and en together at count 7 · line stroke-border/70 | dark 1440 1.25:1, light 1440 1.16:1, dark 390 1.25:1, light 390 1.16:1 |
| G5 | 267 | The load-priority bug: ld and en together at count 7 · rect fig-band fill-fig-rose-fill stroke-fig-rose/40 | dark 1440 1.84:1, light 1440 1.93:1, dark 390 1.84:1, light 390 1.94:1 |
| G5 | 622 | An illegal two-hot state, flagged at the edge it appears · line stroke-border/70 | dark 1440 1.25:1, light 1440 1.16:1, dark 390 1.25:1, light 390 1.16:1 |
| G5 | 622 | An illegal two-hot state, flagged at the edge it appears · rect fig-band fill-fig-rose-fill stroke-fig-rose/40 | dark 1440 1.84:1, light 1440 1.94:1, dark 390 1.84:1, light 390 1.93:1 |
| G5 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · line stroke-border/70 | dark 1440 1.25:1, light 1440 1.16:1, dark 390 1.25:1, light 390 1.16:1 |
| G5 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · rect fig-band fill-fig-rose-fill stroke-fig-rose/40 | dark 1440 1.85:1, light 1440 1.91:1, dark 390 1.85:1, light 390 1.91:1 |
| G5 | 622 | An illegal two-hot state, flagged at the edge it appears · 0110 | light 1440 3.45:1, light 390 3.45:1 |
| G5 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 0 | light 1440 3.57:1, light 390 3.57:1 |
| G5 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 7 | light 1440 3.57:1, light 390 3.53:1 |
| G6 | 38 | Anatomy of a self-checking testbench · tb_top | dark 390 9.91 px, light 390 9.91 px |
| G6 | 38 | Anatomy of a self-checking testbench · clk, rst | dark 390 10.37 px, dark 390 9.01 px, light 390 10.37 px, light 390 9.01 px |
| G6 | 38 | Anatomy of a self-checking testbench · always #5 and the initial block | dark 390 8.56 px, light 390 8.56 px |
| G6 | 38 | Anatomy of a self-checking testbench · REF | dark 390 8.11 px, light 390 8.11 px |
| G6 | 38 | Anatomy of a self-checking testbench · expected | dark 390 10.37 px, dark 390 9.01 px, light 390 10.37 px, light 390 9.01 px |
| G6 | 38 | Anatomy of a self-checking testbench · reference model | dark 390 8.56 px, light 390 8.56 px |
| G6 | 38 | Anatomy of a self-checking testbench · DUT | dark 390 8.11 px, light 390 8.11 px |
| G6 | 38 | Anatomy of a self-checking testbench · dut | dark 390 10.37 px, light 390 10.37 px |
| G6 | 38 | Anatomy of a self-checking testbench · up_counter | dark 390 8.56 px, light 390 8.56 px |
| G6 | 38 | Anatomy of a self-checking testbench · SCB | dark 390 8.11 px, light 390 8.11 px |
| G6 | 38 | Anatomy of a self-checking testbench · count !== expected | dark 390 10.37 px, light 390 10.37 px |
| G6 | 38 | Anatomy of a self-checking testbench · the compare | dark 390 8.56 px, light 390 8.56 px |
| G6 | 38 | Anatomy of a self-checking testbench · seen_max | dark 390 10.37 px, dark 390 9.01 px, light 390 10.37 px, light 390 9.01 px |
| G6 | 38 | Anatomy of a self-checking testbench · coverage counter | dark 390 8.56 px, light 390 8.56 px |
| G6 | 38 | Anatomy of a self-checking testbench · $display | dark 390 10.37 px, light 390 10.37 px |
| G6 | 38 | Anatomy of a self-checking testbench · PASS=n FAIL=m | dark 390 8.56 px, light 390 8.56 px |
| G6 | 38 | Anatomy of a self-checking testbench · steps it | dark 390 9.01 px, light 390 9.01 px |
| G6 | 38 | Anatomy of a self-checking testbench · count | dark 390 9.01 px, light 390 9.01 px |
| G6 | 38 | Anatomy of a self-checking testbench · pass_cnt, fail_cnt | dark 390 9.01 px, light 390 9.01 px |
| G6 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · 0 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · 1 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · 2 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · 3 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · 4 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 130 | Reading same-edge and next-edge implication, disable iff and cover on the counter · 5 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 0 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 1 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 2 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 3 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 4 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 5 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 6 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 7 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 8 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 9 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 10 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 229 | FirstBugHuntGame · 11 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 249 | CounterBenchLab · tb_top | dark 390 9.78 px, light 390 9.78 px |
| G6 | 249 | CounterBenchLab · clk, rst | dark 390 10.22 px, light 390 10.22 px |
| G6 | 249 | CounterBenchLab · rst tied to 0 at the DUT | dark 390 8.44 px, light 390 8.44 px |
| G6 | 249 | CounterBenchLab · broken | dark 390 8.00 px, light 390 8.00 px |
| G6 | 249 | CounterBenchLab · REF | dark 390 8.00 px, light 390 8.00 px |
| G6 | 249 | CounterBenchLab · expected | dark 390 10.22 px, light 390 10.22 px |
| G6 | 249 | CounterBenchLab · reference model | dark 390 8.44 px, light 390 8.44 px |
| G6 | 249 | CounterBenchLab · DUT | dark 390 8.00 px, light 390 8.00 px |
| G6 | 249 | CounterBenchLab · dut | dark 390 10.22 px, light 390 10.22 px |
| G6 | 249 | CounterBenchLab · rst never asserted | dark 390 8.44 px, light 390 8.44 px |
| G6 | 249 | CounterBenchLab · SCB | dark 390 8.00 px, light 390 8.00 px |
| G6 | 249 | CounterBenchLab · count != expected | dark 390 10.22 px, light 390 10.22 px |
| G6 | 249 | CounterBenchLab · the compare | dark 390 8.44 px, light 390 8.44 px |
| G6 | 249 | CounterBenchLab · seen_max | dark 390 10.22 px, light 390 10.22 px |
| G6 | 249 | CounterBenchLab · coverage counter | dark 390 8.44 px, light 390 8.44 px |
| G6 | 249 | CounterBenchLab · $display | dark 390 10.22 px, light 390 10.22 px |
| G6 | 249 | CounterBenchLab · PASS=n FAIL=m | dark 390 8.44 px, light 390 8.44 px |
| G6 | 267 | The load-priority bug: ld and en together at count 7 · 0 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 267 | The load-priority bug: ld and en together at count 7 · 7 | dark 390 10.50 px, light 390 10.50 px |
| G6 | 267 | The load-priority bug: ld and en together at count 7 · 3 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 267 | The load-priority bug: ld and en together at count 7 · 1 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 267 | The load-priority bug: ld and en together at count 7 · 2 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 267 | The load-priority bug: ld and en together at count 7 · 4 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 622 | An illegal two-hot state, flagged at the edge it appears · 0001 | dark 390 10.50 px, light 390 10.50 px |
| G6 | 622 | An illegal two-hot state, flagged at the edge it appears · 0010 | dark 390 10.50 px, light 390 10.50 px |
| G6 | 622 | An illegal two-hot state, flagged at the edge it appears · 0110 | dark 390 10.50 px, light 390 10.50 px |
| G6 | 622 | An illegal two-hot state, flagged at the edge it appears · 0 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 622 | An illegal two-hot state, flagged at the edge it appears · 1 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 622 | An illegal two-hot state, flagged at the edge it appears · 2 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 622 | An illegal two-hot state, flagged at the edge it appears · 3 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 0 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 1 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 2 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 3 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 4 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 5 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 6 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 7 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 8 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 9 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 10 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 908 | Checks 0 to 11: the WRAP_AT(6) mutant against the model, check by check · 11 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 1032 | CounterBenchLab · tb_top | dark 390 9.78 px, light 390 9.78 px |
| G6 | 1032 | CounterBenchLab · clk, rst | dark 390 10.22 px, light 390 10.22 px |
| G6 | 1032 | CounterBenchLab · rst high at edge 0 | dark 390 8.44 px, light 390 8.44 px |
| G6 | 1032 | CounterBenchLab · REF | dark 390 8.00 px, light 390 8.00 px |
| G6 | 1032 | CounterBenchLab · expected | dark 390 10.22 px, light 390 10.22 px |
| G6 | 1032 | CounterBenchLab · a copy of count | dark 390 8.44 px, light 390 8.44 px |
| G6 | 1032 | CounterBenchLab · broken | dark 390 8.00 px, light 390 8.00 px |
| G6 | 1032 | CounterBenchLab · DUT | dark 390 8.00 px, light 390 8.00 px |
| G6 | 1032 | CounterBenchLab · dut | dark 390 10.22 px, light 390 10.22 px |
| G6 | 1032 | CounterBenchLab · WRAP_AT(6) | dark 390 8.44 px, light 390 8.44 px |
| G6 | 1032 | CounterBenchLab · SCB | dark 390 8.00 px, light 390 8.00 px |
| G6 | 1032 | CounterBenchLab · count !== expected | dark 390 10.22 px, light 390 10.22 px |
| G6 | 1032 | CounterBenchLab · the compare | dark 390 8.44 px, light 390 8.44 px |
| G6 | 1032 | CounterBenchLab · seen_max | dark 390 10.22 px, light 390 10.22 px |
| G6 | 1032 | CounterBenchLab · coverage counter | dark 390 8.44 px, light 390 8.44 px |
| G6 | 1032 | CounterBenchLab · $display | dark 390 10.22 px, light 390 10.22 px |
| G6 | 1032 | CounterBenchLab · PASS=n FAIL=m | dark 390 8.44 px, light 390 8.44 px |

</details>

## Status

The redesign covers all 19 visual instances. Both comparison sheets include the 1440 px before and after crops.

## Test expectations

Replaced the registry reservations with the measured rendered heights in pixels. The new test pins the same values by variant.

| Interactive | Desktop | Mid | Phone |
| --- | ---: | ---: | ---: |
| FirstBugHuntGame | 732 → 796 | 732 → 796 | 908 → 972 |
| VerificationMethodsExplorer | 1092 → 1108 | 1092 → 1108 | 1383 → 1415 |
| VerificationMethodologiesDiagram | 1082 → 1162 | 1082 → 1162 | 1723 → 1803 |
| ScenarioSorter (verification-methods) | 530 → 546 | 530 → 546 | 810 → 826 |
| VerificationMethodsExplorer (f1b-assumptions) | 936 → 952 | 936 → 952 | 1299 → 1331 |
| ScenarioSorter (uvm-name-layers) | 424 → 440 | 424 → 440 | 564 → 580 |
| ScenarioSorter (uvm-compile-triage) | 566 → 582 | 566 → 600 | 798 → 814 |
| ScenarioSorter (sv-features) | 510 → 526 | 510 → 526 | 818 → 834 |
| ScenarioSorter (ipc-tools) | 462 → 478 | 462 → 478 | 694 → 710 |
| ScenarioSorter (function-body) | 474 → 490 | 474 → 490 | 566 → 582 |
| ScenarioSorter (task-or-function) | 306 → 322 | 306 → 322 | 508 → 524 |
| ScenarioSorter (regression-log) | 588 → 604 | 588 → 604 | 688 → 704 |


## Gate output

```text
PASS G1 23 source instances, 23 rendered; 0 old
PASS G2 23 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 10 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 1336 texts (min 4.98:1), 876 marks (min 3.60:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 7 changed component files
PASS G8 342 embeds across 21 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (32 files), ESLint 0/0 (16 files)
PASS G10 4 theme/width pairs, 0 page errors or overflows
PASS — every required gate passed
```

## Visual direction

The lesson trains verification engineers to find a faulty check and qualify the bench. The drawings should feel precise and readable at a glance, like the counter’s own waveform instruments. Keep the surrounding controls quiet. Concentrate the strongest paint on the simultaneous-input bug cell, the rare-bin marker, and the FAIL/PASS checks. Reuse the pin and cursor marks so the same evidence remains recognizable across the diagrams and interactives.

- **Three methods.** The last cell in the simultaneous-load row is the shared focus. Rose marks the defect and its existing ✕. Cyan marks a visited cell and the fuchsia heat steps preserve the darker-is-more-often key. The formal assumption retains its dashed cue.
- **Closure curve.** The vertical rare-bin leader and its dot locate the sample count. The curve uses the fuchsia ramp for its ordered progression. The interactive retains a separate teal expected curve and dashed seeded trace.
- **Recap.** The two counter cases sit on violet plates. Rose FAIL and emerald PASS carry the learner’s expected verdict and retain the ✕ and ✓. A rose hatch marks the unknown value in the X-blind compare.
- **Self-checking bench.** The caption says “only the compare decides PASS or FAIL,” so the compare node takes focus. The existing node roles are unchanged.
- **First bug hunt and counter bench.** The waveform cursor identifies the current check. Indigo carries the sampled bus, teal the dashed expected trace, and rose the unknown lane and failing verdicts. The coverage readout keeps the missed scenario distinct.
- **Verification methods and sorters.** The bug cell retains its rose outline. The flow’s fuchsia caps encode order, with cyan on the selected stage. Sorter bins sit on neutral plates, so their categories get no new color meaning.
- **Operator explorer.** The selected calculation and its result stay prominent. Input and result bits retain slate for 0, cyan for 1, a rose unknown and a dashed amber high-impedance bit.

## Independent review

- **Design.** The methods drawing keeps the eye on the outlined bug cell. The earlier neutral gradient was too bright in dark mode and is now the kit’s quiet glass gradient. The closure callout is clear of the rare-bin leader and the recap’s X is beside the hatch, where it stays legible.
- **What it teaches.** The rate shading remains darker for higher probability in both themes. The same counter coordinates hold in all three methods panels. Indivisible counter values follow the solid indigo trace and the dashed teal expected trace shares its exact coordinates wherever they agree. The neutral separator leaves both visible.
- **Robustness.** Chromium passed at 1440, 1280, 768 and 390 px. Forced colors, print and reduced motion each rendered without page overflow or errors. Keyboard traversal showed the method control’s focus ring and Enter activated it. The saved forced-colors and print crops retain the original labels, glyphs and disabled or dashed cues.

The final gate passed 1275 Vitest tests, including the measured height pins. The earlier ClosureBudgetLab timeout cleared without changing the test or its timeout.
