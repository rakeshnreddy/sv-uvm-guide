# G29-B-SV author log: `content/interview-questions/systemverilog.json`

Author: G29-B-SV. Date: 2026-10-11. Verdict carried in: **major** (analysis G29, confirmed by G29-V).

Scope: `content/interview-questions/systemverilog.json` only. The bank's top-level `id`, `topic` and `title` ("SystemVerilog Interview Question Bank") are unchanged; the description was rewritten to match the new coverage.

## Result in one paragraph

The bank grew from 17 to **46** questions: 15 junior, 20 mid, 7 senior, 3 staff, 1 senior-staff. All 17 original ids survive; each was rewritten. 29 questions are new and close the SV coverage gaps the analysis and verifier assigned to this bank. Every question has `modules` (lesson refs that resolve), `follow_ups` (2-3) and `common_mistakes` (2-3). 39 questions carry code: 33 have a `code` field shown with the prompt (predict-the-output, find-the-bug, or the one waveform cycle table), and the other 6 (including the three write-the-code items) carry it only in the model answer. Every "coding" question contains code, and the single "waveform-debug" question shows a text cycle table. Every clause number cited was checked against the IEEE 1800-2023 text (`t1_lrm_clean.txt`). The 170 distinct clause numbers in the bank were also machine-checked to exist as headings. UVM clause numbers (8.3, 9.8.1.7) were checked against the IEEE 1800.2-2020 text and the uvm-core 2020.3.1 annotations. Tool-dependent or unverifiable claims are cited as `{doc, verified:false}`.

How the text renders: the page's `RichText` renders only inline code, fenced blocks and blank-line paragraphs. It does not render `**bold**`, single-newline lists collapse into one paragraph, and inline code cannot contain a backtick. The build script therefore strips bold, gives each list item its own paragraph, and words compiler directives as "the `include` directive" rather than the double-backtick form. A check confirms that no prose field has an unpaired backtick or a `**`.

## Findings and how each was resolved

| ID | Sev | Question | Resolution |
|---|---|---|---|
| G29-SV-01 | S1 | sv-packed-unpacked | Rewritten. `w` is the whole word; `w[3]` is a byte; `w[3:2]` is two bytes (§7.4.4 `joe[7][3:2]`); `w[31:0]` is named as a wrong select along the byte dimension (may be rejected at compile time; otherwise reads x, §11.5.1). Rewrite follows the verifier's note. |
| G29-SV-02 | S1 | sv-packed-unpacked | Rubric fixed: unpacked arrays can be sliced one dimension at a time (`b[1:2]`, §7.4.5), but cannot be used as a bit vector; conversion through streaming or a bit-stream cast (§11.4.14, §6.24.3). |
| G29-SV-03 | S2 | sv-packed-unpacked | The C "garbage from adjacent memory" model was removed. The bug is now the real one: `{>>{b}}` vs `{<<8{b}}` byte order, or `[0:3]` vs `[3:0]`. Out-of-range reads return the Table 7-1 default. |
| G29-SV-04 | S2 (adjusted) | sv-randomize-failure | Recast as a coding/find-the-bug item with code: an inherited constraint conflict. A failed `randomize()` keeps the prior values and skips `post_randomize()` (§18.6.3), worded as "keeps its values" rather than "all zero means never succeeded", per the verifier. The `solve...before` step was removed, with §18.5.9 explaining why. Bisection uses `constraint_mode`/`rand_mode` (§18.8, §18.9). The answer also lists hidden constraints: inline, member objects (§18.5.8) and `randc` solved first (§18.4.2). Override by constraint name (§18.5.2). |
| G29-SV-05 | S2 | sv-fork-join-variants | Rewritten as a code-reading item. `disable fork` kills all descendants (§9.6.3), so a long-lived monitor dies as collateral. The fix is the isolation wrapper. `join_any` leaves the other children running, `join_none` children start only when the parent blocks, and fork-in-loop capture is fixed with an `automatic` copy (§9.3.2 example). `wait fork` and the `process` handle are covered. |
| G29-SV-06 | S3 | sv-scheduling-regions | All nine regions, including Re-Inactive, now appear in both the rubric and the answer. Iteration back to Active and Observed running more than once (§4.5, §14.13), and the PLI regions (§4.4.3), were added. |
| G29-SV-07 | S3 | sv-constraint-bidirectional | The solver technology is labelled tool-dependent. The three ordering exceptions are covered: randc first (§18.4.2), function arguments solved first (§18.5.11), and solve...before as distribution only (§18.5.9). The wrong §18.5.12 citation was removed. A worked probability example (1/(2^32+1) vs 1/2) was added. |
| G29-SV-08 | S3 | sv-array-manipulation-methods | Recast as a predict-the-output item. `sum()` on bytes wraps to 54, while `sum() with (int'(item))` gives 310 (§7.12.3). Locator methods return queues, and `sort()` needs a `with` key for class handles (§7.12.2). |
| G29-SV-09 | S3 | sv-queue-performance | Moved to mid. The answer states only what §7.10 guarantees; the cost of inserting in the middle is labelled as implementation behaviour. It reframes the real cost (a linear search) and gives the associative-array-of-queues fix. |
| G29-SV-10 | S3 | sv-logic-wire-reg | Cites §6.5 for the driver rule and §6.11.2 for `logic` == `reg`. Adds the port defaults (`input logic` is a net, `output logic` a variable, §23.2.2.3) and the `always_comb` single-writer rule (§9.2.2.2), with a three-case compile-or-error code item. |
| G29-SV-11 | S4 | sv-clocking-block-race | Citations narrowed to §4.7, §4.4.2.1, §14.3, §14.10, §14.13 and §14.16. Recast as a waveform-debug item with a two-simulator cycle table. |
| G29-SV-12 | S4 | sv-randomize-failure | The vendor switch was removed; the answer now says "your simulator's constraint-debug report (tool-dependent)", cited as unverified. Added why not `assert(obj.randomize())` (§20.11: with assertions off, no new attempts start). |
| G29-SV-13 | S3 | sv-senior-staff-constraint-perf | Rewritten with concrete causes in a code example: large-array `sum`/`unique`/`size`, non-linear `*`/`%`, a `rand` object handle (§18.5.8), and constraints left enabled. Fixes: procedural fill in `post_randomize`, partitioning, reformulated arithmetic, `constraint_mode`/`rand_mode`, layering. Says "profile first", labels solver-dependent effects, states solve...before is distribution only, and closes with a before/after coverage check. |
| G29-SV-14 | S3 | sv-virtual-interface | Adds the failure modes: null use is a fatal run-time error, the type includes parameters and modport, the `config_db` set/get type must match (§25.9), and access goes through `vif.cb` (§25.9.1). |
| G29-SV-15 | S4 | sv-associative-array-leak | Recategorized as "coding" (the schema has no "debug" category) with scoreboard code to debug. Adds the unbounded `uvm_tlm_analysis_fifo` (uvm-core source) and the leftover check in `check_phase` (1800.2 9.8.1.7, verified in the 1800.2 text). |
| G29-SV-16 | S3 | sv-blocking-vs-nonblocking | Adds the 3-flop shift register written both ways with predicted values, the race reason (§4.7), the program/checker Reactive/Re-NBA nuance (§4.4.2.6, §4.4.2.8), and a "do not mix on one variable" rule labelled as style. |
| G29-SV-17 | S4 | sv-class-vs-module | Adds handle semantics with a predict item (§8.12), garbage collection (§8.29), and what a class cannot contain, which is why virtual interfaces exist. |
| G29-SV-18 | S2 | (bank) | Closed. 29 new questions; 39 of 46 contain code (33 with code shown in the prompt); 11 are senior or above (was 4). Topics added: OOP polymorphism, copy semantics, IPC, coverage, DPI, interfaces/modports, program blocks, unique/priority, parameterized classes, and randc/dist/soft (see the question map). |
| G29-SV-19 | S3 | sv-staff-methodology-reuse | Adds the include-into-two-packages type-identity failure (§6.22.1(d)), compile order (§26.3), wildcard collisions (§26.5), and per-specialization types. Notes that `uvm_component_param_utils` registers without a type name, so overrides must be by type (verified in `uvm_object_defines.svh`). Covers constraint layering, config objects and governance. The wrong "1800.2 §3" citation was replaced with 8.3. |
| G29-SV-20 | S4 | sv-x-propagation | Recast as a predict item covering both ways X hides: conversion to 2-state (§6.11.2) and `if (x)` taking the else branch (§12.4). Cites §11.4.5 and §20.9. |
| G29-SV-V01 | S3 | sv-array-types-comparison | Bounded queues discard extra elements with a warning (§7.10.5), shown with a size prediction. For back-pressure, the answer points to a bounded mailbox (§15.4.1, §15.4.3). "Coverage bins" replaced by a payload sized at run time (edit-list item 9). |
| G29-SV-V02 | S4 | sv-clocking-block-race | `#1step` worded as "the value from the previous time step's Postponed region (equal to the Preponed value)" (§14.13, §4.4.2.1). |
| Edit list 4 | — | relabels | sv-queue-performance moved to mid. sv-randomize-failure and sv-associative-array-leak moved from "waveform-debug" to "coding", since the schema has no debug category. |
| Edit list 7 | — | all | Every answer now explains the why, has code where it helps, and has 2-3 follow-ups and common mistakes. |
| Verifier gap 2 | — | new items | Tasks/functions and lifetime (`sv-static-automatic-lifetime`); `$display`/`$strobe`/`$monitor` (`sv-display-strobe-monitor`); `timescale` and `$time` rounding (`sv-timescale-time-rounding`); expression width and signedness (`sv-expression-width-signedness`); streaming (inside `sv-packed-unpacked`); bounded queue vs bounded mailbox (`sv-array-types-comparison`, `sv-mailbox-semaphore`). |
| Verifier gap 1 | — | F1A, F1B, F1C, F3A | `sv-why-systemverilog` (F1C/F1A/F1B; cost figures labelled unverifiable) and `sv-timescale-time-rounding` (F3A). |
| Verifier gap 4 | — | assert(randomize) | Covered in `sv-randomize-failure` (§20.11). |

### Coverage-gap rows assigned to this bank (analysis "Coverage gaps", SV rows)

| Gap | Question(s) |
|---|---|
| Virtual methods, polymorphism, upcast/downcast, `$cast` | sv-virtual-methods-cast |
| Shallow vs deep copy | sv-shallow-deep-copy |
| Constructors, `super.new`, static members, local/protected | sv-virtual-methods-cast (follow-ups), sv-parameterized-class-statics, sv-abstract-vs-interface-class (`protected`) |
| Abstract classes, pure virtual, interface classes | sv-abstract-vs-interface-class |
| Parameterized classes, `typedef class` | sv-parameterized-class-statics (`typedef class` not given its own item) |
| Default arguments on virtual methods | sv-virtual-default-argument-trap (matches the lesson: unspecified by §8.20/§13.5.3) |
| Static vs automatic lifetime; argument passing | sv-static-automatic-lifetime |
| `always_comb` / `@*` / `always_latch` / `always_ff` | sv-always-procedures |
| `==`, `===`, `==?`, `inside` with X/Z | sv-equality-operators-x |
| enum, struct, union, typedef | sv-structs-enums-typedef |
| Interfaces and modports | sv-interface-modport, sv-virtual-interface |
| Program blocks and final blocks | sv-program-block-and-final |
| unique / unique0 / priority | sv-unique-priority-case |
| Mailbox, semaphore, event; `@ev` vs `triggered` | sv-event-triggered-race, sv-mailbox-semaphore |
| `process` class | sv-process-control |
| rand/randc, `dist :=` vs `:/`, soft | sv-rand-randc-dist-soft |
| Inline constraints, `local::`, `std::randomize`, `$urandom` vs `$random`, seeding | sv-inline-constraints-random-stability |
| Covergroups; options | sv-covergroup-design, sv-coverage-options-instances |
| Functional vs code coverage | sv-functional-vs-code-coverage |
| DPI-C | sv-dpi-c-basics, sv-staff-dpi-reference-model |
| Parameters, generate, macros | sv-generate-and-macros |
| Packages vs include, `$unit`, import/export | sv-package-include-type-identity |
| Predict-the-output items | 33 items show code with the prompt to predict, debug or read (see the "Code" column) |

## Question map

| # | Question id | Status | Level | Category | Code | Modules (lessons) | Sources |
|---|---|---|---|---|---|---|---|
| 1 | `sv-why-systemverilog` | new | junior | concept | no | F1C_Why_SystemVerilog/index<br>F1A_The_Cost_of_Bugs/index<br>F1B_The_Verification_Mindset/index | 6 verified, 1 labelled unverified/tool-dependent |
| 2 | `sv-logic-wire-reg` | kept, rewritten | junior | concept | yes | F2A_Core_Data_Types/index<br>F4A_Modules_and_Packages/index | 4 verified |
| 3 | `sv-structs-enums-typedef` | new | junior | coding | yes | F2A_Core_Data_Types/structs-unions-enums<br>F2A_Core_Data_Types/index | 5 verified |
| 4 | `sv-equality-operators-x` | new | junior | trick | yes | F2A_Core_Data_Types/operators-and-expressions<br>F2A_Core_Data_Types/index | 5 verified |
| 5 | `sv-x-propagation` | kept, rewritten | mid | trick | yes | F2A_Core_Data_Types/index<br>F2A_Core_Data_Types/operators-and-expressions<br>F2C_Procedural_Code_and_Flow_Control/flow-control | 4 verified |
| 6 | `sv-expression-width-signedness` | new | mid | trick | yes | F2A_Core_Data_Types/operators-and-expressions<br>F2A_Core_Data_Types/index | 4 verified |
| 7 | `sv-packed-unpacked` | kept, rewritten | mid | coding | yes | F2A_Core_Data_Types/index<br>F2A_Core_Data_Types/operators-and-expressions<br>F2B_Dynamic_Structures/index | 6 verified |
| 8 | `sv-array-manipulation-methods` | kept, rewritten | junior | trick | yes | F2B_Dynamic_Structures/index | 3 verified |
| 9 | `sv-array-types-comparison` | kept, rewritten | mid | concept | yes | F2B_Dynamic_Structures/index<br>I-SV-5_Synchronization_and_IPC/mailboxes | 8 verified |
| 10 | `sv-queue-performance` | kept, rewritten | mid | concept | yes | F2B_Dynamic_Structures/index<br>A-UVM-6_Scoreboards_and_Reference_Models/index | 4 verified |
| 11 | `sv-associative-array-leak` | kept, rewritten | mid | coding | yes | F2B_Dynamic_Structures/index<br>A-UVM-6_Scoreboards_and_Reference_Models/index | 4 verified |
| 12 | `sv-blocking-vs-nonblocking` | kept, rewritten | junior | concept | yes | F2C_Procedural_Code_and_Flow_Control/index<br>F3B_Scheduling_Regions/index<br>F3C_Delta_Cycles_and_Race_Conditions/index | 6 verified |
| 13 | `sv-always-procedures` | new | junior | concept | yes | F2C_Procedural_Code_and_Flow_Control/index<br>F2C_Procedural_Code_and_Flow_Control/flow-control | 5 verified |
| 14 | `sv-unique-priority-case` | new | mid | trick | yes | F2C_Procedural_Code_and_Flow_Control/flow-control | 4 verified |
| 15 | `sv-fork-join-variants` | kept, rewritten | mid | coding | yes | F2C_Procedural_Code_and_Flow_Control/index<br>I-SV-5_Synchronization_and_IPC/index | 5 verified |
| 16 | `sv-static-automatic-lifetime` | new | mid | coding | yes | F2D_Reusable_Code_and_Parallelism/tasks-functions | 5 verified |
| 17 | `sv-display-strobe-monitor` | new | junior | trick | yes | F2D_Reusable_Code_and_Parallelism/index<br>F3B_Scheduling_Regions/index | 5 verified |
| 18 | `sv-timescale-time-rounding` | new | junior | trick | yes | F3A_Simulation_Semantics/index | 5 verified |
| 19 | `sv-scheduling-regions` | kept, rewritten | mid | concept | no | F3B_Scheduling_Regions/index<br>F3A_Simulation_Semantics/index<br>I-SV-4A_SVA_Fundamentals/index | 8 verified |
| 20 | `sv-clocking-block-race` | kept, rewritten | senior | waveform-debug | yes | F4C_Clocking_Blocks/index<br>F3C_Delta_Cycles_and_Race_Conditions/index | 6 verified |
| 21 | `sv-program-block-and-final` | new | mid | concept | no | F4C_Clocking_Blocks/index<br>F3B_Scheduling_Regions/index | 5 verified |
| 22 | `sv-package-include-type-identity` | new | mid | trick | yes | F4A_Modules_and_Packages/index | 5 verified |
| 23 | `sv-interface-modport` | new | junior | coding | yes | F4B_Interfaces_and_Modports/index | 4 verified |
| 24 | `sv-virtual-interface` | kept, rewritten | junior | concept | yes | F4B_Interfaces_and_Modports/index<br>I-UVM-2C_Configuration_and_Resources/index | 3 verified |
| 25 | `sv-class-vs-module` | kept, rewritten | junior | concept | yes | I-SV-1_OOP/index<br>F4A_Modules_and_Packages/index<br>F4B_Interfaces_and_Modports/index | 4 verified |
| 26 | `sv-virtual-methods-cast` | new | junior | trick | yes | I-SV-1_OOP/polymorphism-pitfalls<br>I-SV-1_OOP/index | 4 verified |
| 27 | `sv-shallow-deep-copy` | new | mid | coding | yes | I-SV-1_OOP/copying-and-cloning<br>A-UVM-6_Scoreboards_and_Reference_Models/index | 3 verified |
| 28 | `sv-virtual-default-argument-trap` | new | senior | trick | yes | I-SV-1_OOP/polymorphism-pitfalls | 3 verified |
| 29 | `sv-parameterized-class-statics` | new | senior | trick | yes | I-SV-1_OOP/parameterized-classes<br>I-UVM-1B_The_UVM_Factory/index | 3 verified |
| 30 | `sv-abstract-vs-interface-class` | new | senior | concept | yes | I-SV-1_OOP/parameterized-classes<br>I-SV-1_OOP/polymorphism-pitfalls<br>I-SV-1_OOP/index | 4 verified |
| 31 | `sv-rand-randc-dist-soft` | new | junior | trick | yes | I-SV-2A_Constrained_Randomization_Fundamentals/index<br>I-SV-2A_Constrained_Randomization_Fundamentals/constraint-blocks | 4 verified |
| 32 | `sv-constraint-bidirectional` | kept, rewritten | mid | concept | yes | I-SV-2A_Constrained_Randomization_Fundamentals/constraint-blocks<br>I-SV-2B_Advanced_Constrained_Randomization/advanced-constraints | 4 verified |
| 33 | `sv-randomize-failure` | kept, rewritten | mid | coding | yes | I-SV-2B_Advanced_Constrained_Randomization/solver-debug<br>I-SV-2B_Advanced_Constrained_Randomization/controlling-randomization<br>I-SV-2A_Constrained_Randomization_Fundamentals/constraint-blocks | 8 verified, 1 labelled unverified/tool-dependent |
| 34 | `sv-inline-constraints-random-stability` | new | senior | trick | yes | I-SV-2A_Constrained_Randomization_Fundamentals/constraint-blocks<br>I-SV-2B_Advanced_Constrained_Randomization/randomization-methods | 7 verified |
| 35 | `sv-functional-vs-code-coverage` | new | junior | concept | no | I-SV-3A_Functional_Coverage_Fundamentals/index<br>F1B_The_Verification_Mindset/index | 2 verified, 1 labelled unverified/tool-dependent |
| 36 | `sv-covergroup-design` | new | mid | coding | yes | I-SV-3A_Functional_Coverage_Fundamentals/index<br>I-SV-3A_Functional_Coverage_Fundamentals/coverage-options | 8 verified |
| 37 | `sv-coverage-options-instances` | new | senior | concept | no | I-SV-3A_Functional_Coverage_Fundamentals/coverage-options<br>I-SV-3B_Advanced_Functional_Coverage/coverage-apis | 5 verified |
| 38 | `sv-event-triggered-race` | new | mid | trick | yes | I-SV-5_Synchronization_and_IPC/events<br>F2D_Reusable_Code_and_Parallelism/ipc | 4 verified |
| 39 | `sv-mailbox-semaphore` | new | mid | coding | yes | I-SV-5_Synchronization_and_IPC/mailboxes<br>I-SV-5_Synchronization_and_IPC/semaphores | 8 verified |
| 40 | `sv-process-control` | new | senior | coding | yes | I-SV-5_Synchronization_and_IPC/index<br>F2C_Procedural_Code_and_Flow_Control/index | 5 verified |
| 41 | `sv-generate-and-macros` | new | mid | concept | yes | I-SV-6_Compiler_Directives_and_Generates/index<br>F4A_Modules_and_Packages/index | 8 verified |
| 42 | `sv-dpi-c-basics` | new | mid | concept | yes | I-SV-7_DPI_and_Foreign_Language_Interfaces/index | 8 verified |
| 43 | `sv-staff-methodology-reuse` | kept, rewritten | staff | staff-system-design | no | F4A_Modules_and_Packages/index<br>I-SV-1_OOP/parameterized-classes<br>I-UVM-1B_The_UVM_Factory/index<br>E-CUST-1_UVM_Methodology_Customization/index | 8 verified |
| 44 | `sv-staff-cross-simulator-portability` | new | staff | staff-system-design | no | F3C_Delta_Cycles_and_Race_Conditions/index<br>F4C_Clocking_Blocks/index<br>I-SV-2B_Advanced_Constrained_Randomization/randomization-methods<br>F2A_Core_Data_Types/index | 11 verified |
| 45 | `sv-staff-dpi-reference-model` | new | staff | staff-system-design | yes | I-SV-7_DPI_and_Foreign_Language_Interfaces/index<br>A-UVM-6_Scoreboards_and_Reference_Models/index<br>E-UVM-ML-1_Multi_Language_Verification/index | 6 verified, 1 labelled unverified/tool-dependent |
| 46 | `sv-senior-staff-constraint-perf` | kept, rewritten | senior-staff | staff-system-design | yes | I-SV-2B_Advanced_Constrained_Randomization/advanced-constraints<br>I-SV-2B_Advanced_Constrained_Randomization/solver-debug<br>I-SV-2B_Advanced_Constrained_Randomization/controlling-randomization<br>E-PERF-1_UVM_Performance/index | 7 verified, 1 labelled unverified/tool-dependent |

"Verified" sources are plain strings whose clause number I checked in the IEEE 1800-2023 text (or the 1800.2-2020 text and uvm-core 2020.3.1 source for UVM items). Sources marked unverified are `{doc, verified:false}` objects and cover only tool-dependent behaviour: simulator constraint debug, profilers, code-coverage metrics, DPI build flow, and cost-of-bug figures.

## Ids removed or renamed

None. All 17 original ids are kept, so `INTERVIEW_QUESTION_LESSONS` in `src/lib/practice-links.ts` stays valid. Each question's `modules` list now takes precedence over that map.

## Deferred items

| Item | Reason |
|---|---|
| `typedef class` (forward declaration, §8.27) as its own question | Low interview value; mentioned only in the gap row. A good follow-up for a later round. |
| `std::randomize()`, randcase/randsequence as separate items | Touched on in follow-ups; the bank is already at 46. |
| Covergroup transition bins and `binsof ... intersect` | Left as follow-ups to `sv-covergroup-design`. |
| A `visual` field linking model-backed visualizers (verifier gap 7) | The schema and page have no such field; this needs `src/` (see lead requests). |
| WaveJSON waveforms | The schema has no waveform field. The waveform item uses a text cycle table in `code`, as the brief specifies. |
| I-SV-4A/4B/4C (SVA), I-SV-8 (UPF), I-SV-9 (why UVM) | Owned by the SVA, SoC and UVM banks per the analysis gap table. |
| Compiling every snippet | No simulator is available in this session. Snippets were checked by hand against the LRM rules, including the explicit-`static` rule for initializers in procedural blocks (§6.21): initial blocks declare variables without initializers. Two snippets are deliberately incomplete sketches (the DPI wrapper and the scoreboard's `write_actual` hook-up) and say so. |

## Requests for the lead

1. **RichText rendering (affects every bank).** `src/app/(learning)/interview-prep/page.tsx` renders only inline code, fenced blocks and blank-line paragraphs. Other banks (amba, debug, soc, sva) use `**bold**` and single-newline `- ` lists, which appear as literal asterisks and run-on paragraphs. Either support `**bold**` and line-based lists in `toRichBlocks`/`splitInlineCode`, or ask bank authors to avoid them. Inline code also cannot contain a backtick, so compiler directives and UVM macros cannot be shown with their leading grave accent outside fenced blocks. Consider accepting double-backtick spans.
2. **Schema categories.** `tests/interview-questions/bank-schema.test.ts` allows only six categories, while `interview-banks.ts` already labels `debug` and `predict-output`. Allowing both would let find-the-bug items stop borrowing "coding" and let predict-the-output items stop borrowing "trick". This bank would then relabel sv-randomize-failure and sv-associative-array-leak to `debug`, and the predict items to `predict-output`.
3. **Optional map cleanup.** `INTERVIEW_QUESTION_LESSONS` entries for the 17 SV ids are now shadowed by each question's `modules`. They can stay as a fallback or be removed. If removed, the "every mapped id exists" test is unaffected.
4. **Visualizer links (verifier gap 7).** If a `visual` field is added, link `SVSchedulerRegionVisualizer` (sv-scheduling-regions), `ClockingBlockSkewVisualizer` (sv-clocking-block-race) and `ForkJoinVisualizer` (sv-fork-join-variants) after checking each model against the corrected answer.

## Validation

- `python3 -c "import json;json.load(open('content/interview-questions/systemverilog.json'))"`: OK.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 863 tests passed. That includes schema, module-ref resolution, fence rendering and the scheduling-misconception lint.
- Extra checks: all 170 distinct clause numbers exist as headings in the 1800-2023 text; no prose field has an unpaired backtick or `**`; every `code` field has exactly one fenced block.

## Fix round 1

Author: G29-B-SV. Date: 2026-10-18. Inputs: `G29-B-SV.accuracy.r1.md` (verdict: does not pass, one S2) and `G29-B-SV.completeness.r1.md` (verdict: pass, four S3 and nine S4). Scope unchanged: only `content/interview-questions/systemverilog.json` and this log were edited. The bank's top-level `id`, `topic` and `title` are unchanged.

Result: the S2 and all eleven accuracy findings are fixed. All four completeness S3s are fixed (S3-3 is the same defect as the accuracy S2), and seven of the nine completeness S4s are fixed. Two of those fixes are new questions: `sv-task-vs-function` and `sv-constructor-chaining-access`. The bank now has **48** questions: 16 junior, 21 mid, 7 senior, 3 staff and 1 senior-staff. No id was removed or renamed.

Each new or changed claim was checked against the IEEE 1800-2023 text (`t1_lrm_clean.txt`). The quoted rules are §15.4.1 (a bound of 0 means "a put() operation shall never block"), §15.4.3, §15.4.5, §4.7 (interleaving), §6.19.4 ("without checking the validity of the value"), §6.24.1 Syntax 6-7, §7.4.1, §11.6.1 Table 11-21, §11.8.1, §18.5.3 (total weight of zero), §18.5.4, §18.5.7.1, §18.5.12, §35.5.1.3, §35.5.3 (the export error and the H.9.5 pointer), §25.7, §25.9, §3.14.2.3, §22.7, §8.7, §8.15, §8.17 (including NOTE 1 and NOTE 2), §8.18, §8.27, §9.3.2, §13.2, §13.4 (rules a to c and Syntax 13-2's implicit return type), §13.4.1, §13.4.4 and §13.5.2/§13.5.3. UVM claims were checked in the IEEE 1800.2-2020 text (C.4.2 `uvm_config_db#(T)`) and in uvm-core 2020.3.1: `uvm_tlm_fifos.svh:102` (`used()`) and `:281` (unbounded analysis FIFO), `uvm_config_db_implementation.svh:210` (`get` calls `lookup_name` with `uvm_resource#(T)::get_type()`), and `uvm_component.svh:221,230,266` (`build_phase` and `connect_phase` are functions; `run_phase` is a task).

### Accuracy findings (`G29-B-SV.accuracy.r1.md`)

| # | Sev | Question | Resolution |
|---|---|---|---|
| 1 | S2 | sv-mailbox-semaphore | Took the reviewer's option 1. The mailbox is now unbounded (`new()`), and an `initial fork producer(); consumer(); join` was added so the trace has a defined start. The prompt now says the consumer prints the same address three times on every run. The answer traces why: all three `put` calls finish at time 0 with one handle, so the output is A3, A3, A3. It also asks for and traces the `new(1)` variant (A2, A3, A3: A1 is overwritten before it is read, and three distinct values never appear). The answer notes that this trace assumes no interleaving between `get` and `$display`, which §4.7 permits. The rubric now grades the trace and treats "bound the mailbox" as a weak fix. A matching common mistake was added. The fix-code comment now says `put` blocks only "with new(N)". §4.7 was added to the sources. |
| 2 | S3 | sv-packed-unpacked | Removed `logic [31:0]'(w)`. The answer now says plain `w` is the flat word (§7.4.1). An explicit cast is `32'(w)` or `word_t'(w)` through a typedef. It explains that `logic [31:0]'(...)` is not legal casting syntax (§6.24.1 Syntax 6-7). §6.24.1 was added to the sources. |
| 3 | S3 | sv-structs-enums-typedef | Prediction 1 now cites §6.24.1 for the static-cast syntax and §6.19.4 for "converts without checking". It keeps §6.24.2 for "a coercion that always succeeds at run time". §6.19.4 and §6.24.1 were added to the sources. |
| 4 | S3 | sv-associative-array-leak | "Leak 2" became "a latent risk, not a leak in this code". `run_phase` drains the FIFO forever, so expectations for traffic that never happens pile up in `pending`. The FIFO grows only if the draining thread blocks, stalls or is killed, and the `used()` check catches that. The prompt now asks for "the leak and any latent risk". The rubric grades the FIFO as a latent risk plus the `used()` check, and lists "claims the FIFO itself grows in this code" as weak. The LRM-unbacked claim "lookups slow as the table grows" was also dropped. The uvm-core `used()` source was added. |
| 5 | S4 | sv-rand-randc-dist-soft | Now says "nonzero weights" cannot make randomize() fail, and that a value with a total weight of zero is excluded like an unlisted value (§18.5.3). |
| 6 | S4 | sv-expression-width-signedness | Split the garbled bullet in two. The first lists the operands that are always self-determined (concatenation, shift amount, `?:` condition, `&&`/`||`/`!`/reduction). The second says relational and equality operands are sized to the larger of the two, independent of the outer context, with a 1-bit unsigned result (Table 11-21, §11.8.1). |
| 7 | S4 | sv-virtual-methods-cast | Now says "the call runs the most-derived override for the object's actual class, here `derived`" (§8.20). |
| 8 | S4 | sv-dpi-c-basics | Separates the two cases. Calling an export from a noncontext import is an error. Calling VPI from one is unpredictable and can crash, except for the functions H.9.5 lists (§35.5.3). The answer also says a plain import may still have C-side effects such as file I/O (§35.5.1.3). The duplicated sentence in the `context` bullet was removed. §35.5.1.3 and H.9.5 were added to the sources. |
| 9 | S4 | sv-virtual-interface | §25.9 is now cited only for type identity. The config_db miss is labelled UVM behaviour: `uvm_config_db#(T)` is parameterized by type (1800.2-2020 C.4.2), and its `get` looks the entry up by `uvm_resource#(T)` type (uvm-core source). The common mistake now names the two config_db types explicitly. |
| 10 | S4 | sv-senior-staff-constraint-perf | Change 3 now says `(addr * len) % 4096 == 0` is not an alignment rule (`addr = 1, len = 4096` satisfies it). It advises using `addr[11:0] == 0` only if the spec means 4 KB alignment, warns that this is a different, smaller solution space, and says to confirm with the spec owner and compare coverage. |
| 11 | S4 | sv-timescale-time-rounding, sv-staff-cross-simulator-portability | Both now add the §3.14.2.3 rule: mixing design elements that have a time unit and precision with elements that have none is an error. The tool-specific default applies only when nothing in the compilation sets a time unit (§22.7). §3.14.2.3 was added to the portability sources. |

### Completeness findings (`G29-B-SV.completeness.r1.md`)

| # | Sev | Question | Resolution |
|---|---|---|---|
| S3-1 | S3 | new `sv-task-vs-function` | New junior question that asks the reader to predict which functions compile. The four functions are: one with `@` (error, §13.4 a); one calling a task (error, §13.4 b); one with an NBA, `->` and `fork...join_none` (legal, §13.4.4); and one with no return type (a 1-bit `logic` return, so `f4(2, 3)` is 1). It predicts a two-line output and covers when to choose a task or a function, `void'()` (§13.4.1) and the UVM phase split. It maps to `F2D_Reusable_Code_and_Parallelism/tasks-functions`, the lesson whose spine misconception it targets. This closes verifier gap 2's "tasks vs functions" row, which the original log wrongly marked as covered by `sv-static-automatic-lifetime`. |
| S3-2 | S3 | new `sv-constructor-chaining-access` | New mid question that asks for the output and which lines compile. It covers construction order (base initializers, then the base body, then the derived initializers, then the derived body; predicts `len=4`, `size=12 tag=2`; §8.7, §8.17). It covers `local` being invisible in subclasses and `protected` being invisible outside the hierarchy (§8.18). It shows that the inserted `super.new()` fails when the base argument has no default (§8.15, §8.17, §13.5.3), with the fixes, including `extends base(0)` and 2023's `new(default)`. It also covers `super.new` arguments evaluated before the derived initializers (§8.7), and NOTE 1 and NOTE 2 of §8.17. It maps to `I-SV-1_OOP/constructors` and `I-SV-1_OOP/index`. |
| S3-3 | S3 | sv-mailbox-semaphore | Same defect as accuracy finding 1; fixed there. |
| S3-4 | S3 | sv-x-propagation, sv-equality-operators-x | Added `F2E_First_Self_Checking_Testbench/index` to both `modules` lists. The lesson's `!=` vs `!==` and X-in-control-signal material matches both items. F2E now has bank coverage. The extra junior "prove the bench can fail" item is deferred (see below). |
| S4-5 | S4 | sv-parameterized-class-statics | Added a `typedef class` follow-up with a short answer (§8.27). |
| S4-6 | S4 | sv-interface-modport | Added a bullet on tasks and functions in interfaces, made available through a modport `import` (§25.7). |
| S4-7 | S4 | sv-rand-randc-dist-soft | Added a follow-up with a one-line answer. It covers a `foreach` ascending constraint with an index guard (§18.5.7.1, §18.5.12), and when `unique {data}` is needed (§18.5.4). |
| S4-9 | S4 | sv-static-automatic-lifetime | The `fork...join_none`/`ref` follow-up now carries its answer: §9.3.2 forbids it, and 2023's `ref static` lifts the restriction for static actuals (§13.5.2). |
| S4-10 | S4 | sv-virtual-methods-cast | Line (3) is now `$display("%0d", b.x)`. |
| S4-11 | S4 | sv-clocking-block-race | The prompt now says "The trace below shows what each simulator captured." |
| S4-12 | S4 | sv-staff-cross-simulator-portability | Added `F3A_Simulation_Semantics/index` to `modules`. |
| S4-8 | S4 | (bank) F2D system tasks | Deferred. The reviewer marked it optional, and G29 did not assign it. |
| S4-13 | S4 | (bank) follow-up answers | Partly addressed: four more follow-ups now carry short answers. A `follow_up_answers` field needs `src/`, so it is added to the lead requests below. |

### Corrections to the tables above

- Verifier gap 2, "Tasks/functions and lifetime": tasks vs functions is now covered by `sv-task-vs-function`, and lifetime remains in `sv-static-automatic-lifetime`.
- Coverage-gap row "Constructors, `super.new`, static members, local/protected": constructors, chaining and `local`/`protected` are now covered by `sv-constructor-chaining-access`. Static members remain in `sv-parameterized-class-statics`.
- Coverage-gap row "Parameterized classes, `typedef class`": `typedef class` is now a follow-up with an answer in `sv-parameterized-class-statics`. It is no longer deferred.
- The "Deferred items" row for `typedef class` is closed by the follow-up above.

### Question map additions

| # | Question id | Status | Level | Category | Code | Modules (lessons) | Sources |
|---|---|---|---|---|---|---|---|
| 47 | `sv-task-vs-function` | new (fix round 1) | junior | trick | yes | F2D_Reusable_Code_and_Parallelism/tasks-functions | 4 verified (§13.2, §13.4, §13.4.1, §13.4.4), 1 uvm-core source |
| 48 | `sv-constructor-chaining-access` | new (fix round 1) | mid | trick | yes | I-SV-1_OOP/constructors<br>I-SV-1_OOP/index | 5 verified (§8.7, §8.15, §8.17, §8.18, §13.5.3) |

In the file, `sv-task-vs-function` follows `sv-static-automatic-lifetime`, and `sv-constructor-chaining-access` follows `sv-virtual-methods-cast`. The numbers 47 and 48 continue this log's table only.

After this round the bank has 48 questions; 35 show code with the prompt and 41 contain code anywhere. Eleven are senior or above, and the questions carry 105 module refs, all of which resolve.

### Ids removed or renamed

None. Two ids were added: `sv-task-vs-function` and `sv-constructor-chaining-access`. Both carry their own `modules`, so `INTERVIEW_QUESTION_LESSONS` needs no change.

### Deferred in this round

| Item | Reason |
|---|---|
| Completeness S3-4, second half: a junior "prove the bench can fail" item (mutant injection, `$error` vs `$fatal`, timeout, PASS/FAIL summary) | The cheap fix (mapping F2E onto two X items) is done. A dedicated F2E item fits better in a later round with the F2D system-task item (S4-8). |
| Completeness S4-8: `$error`/`$fatal`, `$fscanf` returns, plusargs | Marked optional by the reviewer, and not assigned by G29. |
| Completeness S4-13: answers for every staff follow-up | Needs a schema field (lead request 5). |
| Compiling the new snippets | No simulator is available in this session. The snippets were hand-checked against the LRM rules, including the explicit-`static` rule for procedural initializers (§6.21), which is why `child c;` is declared and then assigned. |

### Lead request added

5. **Follow-up answers.** Add an optional `follow_up_answers` field (or `{q, a}` objects in `follow_ups`) to the loader and page, so self-study readers can check the follow-ups. This extends request 2.

### Validation (fix round 1)

- `python3 -c "import json;json.load(open('content/interview-questions/systemverilog.json'))"`: OK.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 873 tests passed. The count rose from 863 because the schema test runs once per question.
- Extra checks:
  - No prose field, follow-up or common mistake has an unpaired backtick, a `**` or a single-newline list.
  - Every `code` field has exactly one fenced block, and every model-answer fence is paired.
  - All 105 module refs resolve to exactly one lesson file.
  - All 184 distinct clause numbers in the bank exist as headings in the 1800-2023 text.
