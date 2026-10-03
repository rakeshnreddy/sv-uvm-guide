> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# SV-Language Interactives: Teaching-Instrument Audit

Audit date: 2026-10-03. Repo: `main @ 488f7f43`. Read-only; no repo files modified.
Scope: SystemVerilog-language, foundational, and verification-basics interactives, reached through `src/components/mdx/lazy-mdx-interactives.ts` and `src/components/mdx/LazyMdxInteractive.tsx`. Also covered: practice-route visualizations under `src/app/(learning)/practice/visualizations/*`. Excluded: UVM, AMBA, and RAL interactives. `src/components/exercises/*` holds only UVM exercises (ScoreboardConnector, SequencerArbitration, UvmAgentBuilder, UvmPhaseSorter), so it is also out of scope.

Standard used: IEEE 1800-2023. Clause numbers are written "clause unverified" unless I am confident of them. I did not have the PDF, so the normative claims below rest on expert knowledge, with a confidence level on each.

How I verified things:
- Read every in-scope component source.
- Grepped all 105 curriculum MDX files.
- Simulated the MDX-to-`InteractiveCode` children path with the repo's own `@mdx-js/mdx@2.3.0` and react (script at `scratchpad/audit/mdxcheck.mjs`).
- Checked the Tailwind config and the built CSS in `.next/static/css`.
- No browser run. No dev server was running, and starting one would regenerate Prisma.

---

## 0. Headline

Not one SV interactive executes real SystemVerilog semantics in general.
- The best ones are small conceptual models with correct rules, where the learner can vary inputs: `ConstraintSolverHeatmapVisualizer`, `TemporalLogicExplorer`, `SvaSequenceWaveformVisualizer`, `CoverageCrossExplorerVisualizer`, `SignednessVisualizer`.
- Most of the rest are scripted animations or illustrations.

Five failures block learning outright, all with High confidence:
1. **`InteractiveCode` (55 MDX uses) renders no code.**
   - In 32 places it shows the literal text `[object Object]`.
   - In the other 23 it shows an empty editor, because MDX passes `code=`, a prop the component ignores.
   - Under every instance it also shows fabricated "Performance / Timing / Security Warnings / Generated Tests" analytics.
2. **`InterviewQuestionPlayground` (21 MDX uses) cannot be answered.** The MDX passes `{text, feedback}` but the component reads `{id, label, explanation}`. Option buttons are blank and Submit never enables. One of the 21 also marks a wrong answer as correct.
3. **`FirstBugHuntGame`, the learner's first verification exercise, teaches a bug that is not there.** The RTL shown counts 0 to 7 correctly. The game claims it stops at 6 because of `<` versus `<=`. Every click, including on correct samples, counts as "Success!".
4. **`EventRegionGame` gets core scheduling wrong.** It places concurrent assertions and `final` in the Postponed region, and its answer choices leave out Observed and Reactive.
5. **The dynamic-array and randomization models contradict the LRM.**
   - Dynamic arrays are given `push_back`, `pop_back` and "capacity".
   - `new[N]` keeps the old values.
   - `soft` is modelled as a 90% probability.
   - `try_put` on a full mailbox still inserts.
   - The SVA evaluator treats a bare sequence as passing vacuously.

---

## 1. Registry vs. curriculum usage

Registered: 93 names. In-scope SV/foundational names: 51, plus 2 unregistered practice-only components.

**Registered but not used in any curriculum MDX**:

| Component | Reachable elsewhere? |
|---|---|
| AssertionBuilder | `/practice/visualizations/assertion-builder` |
| BlockingSimulator | **Orphan.** The lazy loader is its only reference. |
| Coverage3D | **Orphan** |
| CoverageAnalyzer | `/practice/visualizations/coverage-analyzer`, also linked from placement quiz |
| CovergroupBuilder | **Orphan** |
| DataTypeComparisonChart | `/practice/visualizations/data-type-comparison` |
| DataTypeExplorer (animations/) | **Orphan** |
| InterfaceSignalFlow | `/practice/visualizations/interface-signal-flow` |
| OperatorDrill | **Orphan** (only re-exported from `curriculum/f2/index.ts`) |
| OperatorVisualizer | **Orphan** |
| RandomizationExplorer | `/practice/visualizations/randomization-explorer` |
| SystemVerilogDataTypesAnimation | `/practice/visualizations/systemverilog-data-types` |

Out-of-scope UVM names that are also unused: UvmComponentRelationshipVisualizer, UvmFactoryWorkflowVisualizer, UvmHierarchySunburstChart, UvmPhasingInteractiveTimeline, UvmTestbenchVisualizer, RALHierarchy.

**Used in MDX but not lazy-registered**: none that are interactive. These tags are all base MDX components from `src/generated/mdx-component-registry.tsx`: Alert, Card, CardContent, CardHeader, CardTitle, Image, InfoPage, InteractiveWrapper, LabLink, Link, QuickTake, Quiz, QuizQuestion.

**Practice-only, unregistered**: `ConcurrencyVisualizer` (`/practice/visualizations/concurrency`) and `StateMachineDesigner`.

**Props passed from MDX that the component ignores**:
- `InteractiveCode code={...}`: 23 instances.
- `InterviewQuestionPlayground options={[{text, feedback}]}`: 21 instances, with the wrong shape.
- `DebuggingSimulator scenario="hang"`: the component takes no props.

**Usage map of the in-scope interactives, by lesson**:
- **F1A**: DesignGapChart, InteractiveCostOfBugGraph, HallOfShameCarousel
- **F1B**: VerificationMethodologiesDiagram, FirstBugHuntGame
- **F1C**: VerilogVsSystemVerilog
- **F2A**: LogicStateDiagram, SignednessVisualizer, StringMethodExplorer, EnumMethodVisualizer, CurriculumDataTypeExplorer, CurriculumDataTypeQuiz
- **F2B**: DynamicStructureVisualizer, QueueOperationLab, PackedUnpackedPlayground, SystemVerilog3DVisualizer, ArrayMethodExplorer, PacketSorterGame
- **F2C**: ProceduralBlocksSimulator, EventRegionGame, InteractiveCode ×3
- **F2D/ipc**: MailboxSemaphoreGame, Mailbox3D
- **F3B**: SVSchedulerRegionVisualizer
- **F4B**: ModportExplorer
- **I-SV-2A**: ConstraintSolverHeatmapVisualizer, ConstraintSolverVisualizer, Constraint3D
- **I-SV-2B**: ConstraintSolverExplorer
- **I-SV-3A**: CoverageCrossExplorerVisualizer
- **I-SV-4A**: SvaSequenceWaveformVisualizer
- **I-SV-4B**: TemporalLogicExplorer
- **I-SV-4C**: BindDirectiveVisualizer
- **I-SV-5**: MailboxSemaphoreGame
- **I-SV-6**: GenerateElaborationVisualizer
- **I-SV-7**: DPIBoundaryInspector
- **E-INT-1**: FormalVsSimulationVisualizer
- **E-PERF-1**: EventSchedulerVisualizer
- **E-PWR-1**: PowerDomainVisualizer
- **E-DBG-1/hang-lab**: DebuggingSimulator
- **Spread across many lessons**: InteractiveCode in 35 files, InterviewQuestionPlayground in 21 files (listed in §2.30 and §2.31).

---

## 2. Per-interactive evaluation

Legend:
- **Class.** RS = real simulator; CM = conceptual model; SC = static checker; SA = scripted animation or illustration; QZ = quiz or drill.
- **Pred.** Can the learner commit a prediction before seeing the answer?
- **Inputs.** Can the learner vary meaningful inputs?
- **Why.** Does it explain the cause?
- **Code.** Is SV code shown that matches the visual state?
- **Diag.** Does feedback diagnose specific misconceptions?
- **Xfer.** Does the understanding transfer beyond the example?

### Foundations (F1)

**2.1 DesignGapChart** (`src/components/visuals/DesignGapChart.tsx`; F1A)
- Class: SA (static SVG).
- Semantics: no axes, no units, no source. The two curves are hand-drawn polylines.
- Pred / Inputs / Why / Code / Diag / Xfer: No / No / partly (verification vs validation prose) / n/a / n/a / low.
- A11y: the SVG has no `role` or `<title>`, and the chart meaning sits only in two text labels.
- Verdict: **Keep as illustration.** Add a source citation and an accessible title, or remove it.

**2.2 InteractiveCostOfBugGraph** (`src/components/curriculum/f1/InteractiveCostOfBugGraph.tsx`; F1A)
- Class: SA. A draggable marker over a fixed log curve.
- Data defects:
  - `formatCost` (lines ~52-55) renders $100,000,000 as "$1.0B+": `value / 100_000_000` is labelled "B".
  - The costs ($1, $10, $100, $1M, $100M) have no source.
- A11y:
  - The marker is a `motion.div drag="x"` (line ~182) with no keyboard alternative and no ARIA slider role.
  - Milestone descriptions show on hover only (`group-hover`, line ~175).
- Verdict: **Fix** the number formatting and keyboard access, or replace it with a plain table plus a "guess the multiplier" prediction prompt.

**2.3 HallOfShameCarousel** (`f1/HallOfShameCarousel.tsx`; F1A; items come from MDX at `F1A/index.mdx:65`)
- Class: SA.
- Content is broadly accurate (FDIV, Ariane 5, Spectre).
- A11y is good: prev/next buttons carry `aria-label` and slides have `aria-roledescription`.
- Verdict: **Keep.**

**2.4 VerificationMethodologiesDiagram** (`f1/VerificationMethodologiesDiagram.tsx`; F1B)
- Class: SA. It autoplays on scroll with timers, 2 s per step (lines ~66-72).
- Semantics: Emulation/FPGA is mapped to the "Netlist" stage (`stageIndex: 2`). Emulation runs RTL (internally synthesized), so placing it at the netlist stage misleads. S3.
- A11y: autoplay with no pause control, and no reduced-motion handling.
- Verdict: **Keep with fixes:** correct the stage mapping and add a pause button.

**2.5 FirstBugHuntGame** (`f1/FirstBugHuntGame.tsx`; F1B:115)
- Class: QZ, but non-functional as a quiz.
- **Semantic defect (S1):** the DUT code `else if (count < 3'd7) count <= count + 3'd1; else count <= 3'd0;` (lines 17-21) correctly counts 0→7→0. The game's waveform shows 0..6 then 0, and the success message (lines 142-144) says the counter "stops at 6 because the condition uses `<` instead of `<=`". Both are false.
  - On a 3-bit counter, `count <= 3'd7` is always true and simply wraps.
  - The shown code does not produce the shown waveform.
- **No wrong answers exist:**
  - Every waveform sample button calls `triggerSuccess("waveform")` (line 77), including correct samples.
  - The spec button also succeeds (line 57).
- Pred: No. Diag: None.
- A11y: the modal (lines ~124-161) has no `role="dialog"` and no focus management. The layout is `grid-cols-7` holding 8 items, so it wraps.
- Verdict: **Replace.**
  - Use a real seeded bug, for example an `if (count == 3'd6)` wrap or a missing reset branch, whose code and waveform agree.
  - Require the learner to pick the failing cycle and the offending line.
  - Give specific feedback for wrong picks.
  - Then progress to an independent task: "write the assertion that catches it".

**2.6 VerilogVsSystemVerilog** (`visuals/VerilogVsSystemVerilog.tsx`; F1C)
- Class: SA (tabbed comparison).
- Semantics:
  - Line 106 says "All Verilog code is valid SystemVerilog". This is false, because SV reserves new keywords (`logic`, `bit`, `int`, `class`, ...). Legacy identifiers break without `` `begin_keywords``. S3.
  - The OOP snippet `function void print();` has no `endfunction` (line 30).
- Verdict: **Keep with text fixes.**

### Data types (F2A)

**2.7 LogicStateDiagram** (`visuals/LogicStateDiagram.tsx`; F2A:22)
- Class: SA (two static SVG cards).
- Semantics: line 15 says X on contention is resolved "exactly how silicon would behave until one driver wins".
  - Silicon has no X. X is the simulator's representation of "unknown".
  - Contention between equal-strength drivers resolves to X only for **nets**. Multiple procedural writes to a `logic` variable are last-write-wins, and multiple continuous drivers on a variable are illegal.
  - Missing: X in `if`/`case` (an X condition takes the else branch), X→0 on assignment to 2-state, and `===` vs `==`. S2.
- Pred / Inputs: No / No.
- Verdict: **Upgrade to prediction-first.** For example: "`logic a = 'x; if (a) y=1; else y=0;` — what is y? `bit b = a;` — what is b?" Add a net-vs-variable driver toggle.

**2.8 SignednessVisualizer** (`visuals/SignednessVisualizer.tsx`; F2A:105)
- Class: CM. Bit-pattern to signed/unsigned, plus zero- and sign-extension.
- Semantics: the arithmetic is correct for a single operand (lines 23-36).
- Missing (S2): the rule that actually causes the classic bugs.
  - Expression signedness is determined by **all** operands, so any unsigned operand makes the whole expression unsigned.
  - Extension follows the context width, before evaluation.
  - Examples worth adding: `logic signed [3:0] a = -4; logic [7:0] u; ... a + u`, `a > 4'd0`, `$signed()`.
- Also: the Signed/Unsigned switch only dims a card; both results always show (lines 91-101).
- Pred: No. Inputs: yes (width, value). Code: none, since no declaration or assignment is shown.
- A11y: the range input (lines 75-82) has no associated label or `aria-label`, because `<Label>` has no `htmlFor`.
- Verdict: **Upgrade to prediction-first.**
  - Show the actual SV expression.
  - Ask the learner to predict the result before revealing it.
  - Add mixed signed/unsigned operand cases.

**2.9 StringMethodExplorer** (`visuals/StringMethodExplorer.tsx`; F2A:134)
- Class: CM, implemented with JS string methods.
- Semantics:
  - For an empty string, `putc`/`getc` show "Error: String is empty" (lines 36-37, 45-46). In SV, `getc(i)` out of range returns 0, and `putc` out of range leaves the string unchanged; there is no error. S3.
  - `substr(0,2)` inclusive semantics are handled correctly (line 51 comment).
  - Missing: `compare`, `icompare`, `atoi`, `itoa`, `$sformatf`, and string comparison operators.
- Code: yes, a snippet is generated (good).
- A11y: the `<label>` at line 73 is not associated with its input.
- Verdict: **Fix semantics.** Low priority.

**2.10 EnumMethodVisualizer** (`visuals/EnumMethodVisualizer.tsx`; F2A:138)
- Class: CM.
- Semantics: wraparound for `next`/`prev` is correct (lines 31-41).
- Missing:
  - `next(N)` and `num()`.
  - The key traps: `next()` on a value that is not a member, illegal assignment of an int to an enum without a cast, and `name()` returning "" for an invalid value.
- A11y: the result panel is not `aria-live`.
- Verdict: **Upgrade.** Add an "invalid value" case and a cast drill.

**2.11 CurriculumDataTypeExplorer** (`curriculum/f2/DataTypeExplorer.tsx`; F2A:198)
- Class: CM/SA.
- Semantics:
  - `int` is drawn with `bitWidth: 8` (line 74) for a 32-bit type.
  - The `int` description "Simulator promotes operands to int for most math" (line 79) is wrong. Operand sizing follows the expression's context width, not promotion to int.
  - The `logic` hardware label "Flip-flop driven inside procedural code" (line 43) conflates a data type with the inferred hardware. `logic` can be combinational or continuously assigned.
  - "From the LRM" snippets (lines 47-133) are paraphrases presented as quotes. Some carry likely-wrong clause numbers, for example `reg` → "§6.6" and `int` → "§6.10" (clause unverified). The `int` "quote" invents behavior: "used by default in expressions unless context dictates otherwise". S2.
- A11y:
  - Bit buttons are keyed with their value (`key={`${descriptor.id}-${index}-${value}`}`, line 279), so each click remounts the button and **keyboard focus is lost**.
  - No `aria-label` beyond `title`.
- Pred: No. Code: none, since no assignment shows what happens when X is written to `bit`.
- Verdict: **Fix semantics**, then **upgrade**. For example: "assign 4'b1x0z to bit [3:0] — predict the value."

**2.12 CurriculumDataTypeQuiz** (`curriculum/f2/CurriculumDataTypeQuiz.tsx` → `DataTypeQuiz.tsx` + `src/content/f2/dataTypeQuizQuestions.ts`; F2A:207)
- Class: QZ.
- Semantic defects:
  - **Q3 (lines 25-35, S1):** "stuck at X after reset" → the "correct" answer is "Two **procedural blocks** driving the same signal with different values", with the explanation "Concurrent drivers ... resolve to X (§6.1)". Procedural writes to a variable do **not** resolve. The last write wins, and nothing produces X. Resolution to X applies to nets with multiple continuous drivers. The clause cite is unverified and likely wrong.
  - **Q2 (lines 17-24, S2):** recommends `bit` for a synthesizable counter "to avoid X-propagation". This contradicts Q5 and industry practice: 2-state RTL hides missing resets and creates sim/silicon mismatch.
- Feedback: one explanation per question, shown for any choice. There is no diagnosis of the specific wrong option.
- A11y: the reward overlay (`role="dialog"`, lines 206-243) has no focus trap and no initial focus.
- Verdict: **Fix semantics**, then add per-option feedback.

### Arrays and structures (F2B)

**2.13 DynamicStructureVisualizer** (`curriculum/f2/DynamicStructureVisualizer.tsx`, 1398 lines; F2B:61)
- Class: CM with 4 tabs and a quiz.
- Semantic defects:
  - **(S1) The Dynamic Array tab offers `push_back(value)` / `pop_back()`** (lines 572-604, 652-656). Dynamic arrays have no such methods; those are queue methods. The learner will write code that does not compile.
  - It also models C++-vector **capacity doubling** (`getNextCapacity`, `"Auto-resized to capacity ..."`, line 583). SV has no such concept.
  - **(S1) `new[size]` keeps the old values and pads with 0** (lines 625-633: "packed values were trimmed or padded"). In SV, `arr = new[N]` discards the old contents and default-initializes. Preserving them requires `arr = new[N](arr)`.
  - Associative tab:
    - Entries are appended in insertion order.
    - A fake hash slot is shown: "Associative arrays use hashing" (line 1124). The LRM mandates no hashing.
    - `foreach`/`first`/`next` iterate in **index order**.
    - Missing: `exists()` and read-of-missing-key (default value plus warning). S2.
  - Packed tab: the "walks memory"/"next in memory" framing for unpacked dimensions treats a simulator-implementation layout as language semantics. Iteration and assignment order are defined; memory layout is not. S3.
- Queue tab: the optional bounded queue matches `q[$:N]` (lines 927-939). Good.
- Pred: only the packed-tab quick recall, which has an explanation per scenario but nothing per option.
- Verdict: **Fix semantics (urgent).**
  - Remove push/pop and capacity from the dynamic array.
  - Implement `new[N]` vs `new[N](arr)`.
  - Add `size()`, `exists()`, and key-ordered iteration.

**2.14 QueueOperationLab** (`curriculum/f2/QueueOperationLab.tsx`; F2B:67)
- Class: CM.
- Semantics:
  - It hard-codes `hardLimit = 6` (line 7) with "Push blocked — FIFO at max depth". SV queues are unbounded unless declared `[$:N]`, and no bound declaration is shown. Writes past a declared bound are ignored with a warning, not "blocked". S2.
  - Out-of-range `insert` indexes are silently clamped (line 53). In SV an invalid index produces a warning and no change.
- A11y: good. Labels wrap the inputs, and real `<button>`s are used.
- Verdict: **Fix semantics:** show `int q[$]` vs `int q[$:5]`. Consider merging it into 2.13.

**2.15 PackedUnpackedPlayground** (`curriculum/f2/PackedUnpackedPlayground.tsx`; F2B:73)
- Class: SA (a text slideshow).
- Semantics: line 78 says "Right-most dimensions — packed or unpacked — always toggle fastest". This contradicts its own `payload` example, where the right-most declared dimension `[0:3]` is unpacked but the packed bits toggle fastest. The correct rule is unpacked dimensions first, then packed, each left to right. S2.
- A11y: `role="tab"` without tabpanel or arrow-key handling.
- Verdict: **Remove** (it duplicates 2.13's packed tab and SV3D), or fix the rule text.

**2.16 SystemVerilog3DVisualizer** (`curriculum/f2/SystemVerilog3DVisualizer.tsx` + `src/lib/systemverilog-array-model.ts`; F2B:79)
- Class: CM (3D).
- Semantics:
  - `new[size]` fills the array with 1..N (line ~265). New elements should be default-initialized to 0. S3.
  - Assoc keys are sorted with `localeCompare` (line ~236), not by byte order. Mixed-case ordering differs from SV string-index ordering. S4.
  - The good part: `exists`, `first`/`next`/`prev`/`last` in key order, and a packed/unpacked coordinate encoder.
- A11y / small screens:
  - The control panel is `absolute ... w-[360px]` over the canvas (line 374). At 375px it covers the entire 3D view.
  - Pointer-only hover tooltips.
  - The WebGL fallback is a text error only (`WebGLFallbackBoundary`), with no equivalent non-3D view.
- Verdict: **Keep** as the array sandbox, after fixing init values and responsive layout and adding a 2D fallback. Consider retiring 2.13's dynamic and assoc tabs in its favour.

**2.17 ArrayMethodExplorer** (`visuals/ArrayMethodExplorer.tsx`; F2B:231)
- Class: CM.
- Semantics:
  - `max()`/`min()` are shown as scalars (lines 62-76). In SV they return a **queue**, which is a common compile error (`int m = q.max();`). S3.
  - The result width of `sum()` (it overflows at the element width unless `with (int'(item))`) is not shown, and that is the main trap.
  - The `with` expressions are fixed.
- Verdict: **Upgrade.** Make the `with` clause editable from a small menu, show return types, and add a byte-array `sum()` overflow case.

**2.18 PacketSorterGame** (`curriculum/f2/PacketSorterGame.tsx`; F2B:236)
- Class: QZ.
- Semantics:
  - Challenge "dynamic" (lines 41-47): "collecting all packet lengths ... don't know how many" → Dynamic Array is marked correct and Queue wrong. The idiomatic answer is a queue (`push_back`). A dynamic array needs a reallocate-and-copy per item. S2.
  - Challenge "queue_replay" has a muddled premise.
- Feedback: the correct option is not highlighted when the learner is wrong (lines 143-156). The modal always says "Success! You earned +150 XP" regardless of score (lines 209-210) and has no `role="dialog"`.
- Verdict: **Fix** the answers and feedback.

### Procedural code and scheduling (F2C, F3B, E-PERF)

**2.19 ProceduralBlocksSimulator** (`animations/ProceduralBlocksSimulator.tsx` + `procedural-blocks-data.ts`; F2C:22, also `/practice/visualizations/procedural-blocks`)
- Class: SA (fixed step text and fixed waveforms).
- Semantics:
  - The "Blocking vs Non-blocking" code puts an `initial` block and an `always @(posedge clk)` block on the same variables (data line 10). The waveform implies the NBA update happens at a later time (`t1`/`t2`, data lines 12-14; waveform lines 11-22). NBA updates occur in the same time slot (NBA region), not a later time unit. S2.
  - The editor is `isEditable`, but edits have no effect on the visualization (line 340). This misleads learners into thinking it simulates.
- A11y: controls are buttons with aria-labels. Good.
- Verdict: **Replace** with BlockingSimulator (2.20), upgraded to prediction-first.

**2.20 BlockingSimulator** (`animations/BlockingSimulator.tsx`; **orphan**)
- Class: SA. Three steps per mode.
- Semantics: largely correct. It shows the cross-block blocking race and NBA sampling of old values (lines 19-111).
- Minor: "Waveforms may flicker" overstates. Simulators are deterministic per tool and run; the order is unspecified by the LRM.
- Verdict: **Promote and upgrade:**
  - Have the learner predict `out`, `temp` before stepping.
  - Add an ordering toggle (A first / B first).
  - Show the region per step.

**2.21 EventRegionGame** (`visuals/EventRegionGame.tsx`; F2C:35)
- Class: QZ (6 items, 4 region choices).
- Semantic defects:
  - **(S1)** Q6 `assert property (@(posedge clk) ...)` → "Postponed" (lines 49-54). Concurrent assertions sample in Preponed, evaluate in **Observed**, and schedule pass/fail action blocks in **Reactive**. The option set (Active/Inactive/NBA/Postponed, lines 57-62) does not even contain the right answer.
  - **(S2)** Q5 `final` → "Postponed" (lines 44-48). A `final` procedure runs once at the end of simulation. It is not a per-time-slot region.
  - **(S3)** Q2 `q <= d` → "NBA" with no mention that the RHS is evaluated in Active.
- The F2C lesson table repeats the error: `content/.../F2C_Procedural_Code_and_Flow_Control/index.mdx` lines ~31-34 list "Postponed | `final`, `$strobe`, assertions". This contradicts F3B's correct table.
- Feedback: one explanation per item, plus "It belongs in X".
- Verdict: **Fix semantics:**
  - Offer all scheduling regions (Preponed, Active, Inactive, NBA, Observed, Reactive, Re-Inactive, Re-NBA, Postponed).
  - Split "RHS evaluation" from "LHS update".
  - Add `$strobe`/`$monitor` → Postponed and `program` → Reactive.

**2.22 SVSchedulerRegionVisualizer** (`visualizers/SVSchedulerRegionVisualizer.tsx`; F3B:40)
- Class: SA (two scripted timelines).
- Semantics:
  - Linear one-pass token (lines 19-27). There is no iteration back to Active after NBA updates, which is the defining property of the scheduler. Re-Inactive and Re-NBA are omitted. S2.
  - Race scenario, Observed step (line 52): "Assertions evaluated. Race condition may cause failures depending on execution order". Wrong: concurrent assertions use Preponed-sampled values precisely so they are immune to this Active-region race. S2.
  - Only one execution order (A then B) is animated. B-first appears only as text (line 49).
  - Postponed is described as "Final cleanup" (line 40). It is the read-only region for `$strobe`/`$monitor`.
- A11y: good. Buttons have aria-labels and `aria-pressed`, and there is a mobile fallback that shows the region name. No reduced motion.
- Verdict: **Fix semantics** and **upgrade:**
  - Add an order toggle.
  - Add a loop-back arrow (NBA → Active when the NBA triggers combinational logic).
  - Show the Preponed sample value the assertion uses.
  - Ask the learner to predict `q2`.

**2.23 EventSchedulerVisualizer** (`visualizers/EventSchedulerVisualizer.tsx`, export `SVEventScheduler`; E-PERF-1:35)
- Class: SA (four region boxes lighting up in turn).
- Semantics:
  - Postponed is listed as executing "Coverage sampling" (line 38) and "preventing race conditions" (line 37). Covergroups sample when their sampling event fires or on `sample()`. Only `type_option.strobe=1` defers to Postponed. S2.
  - Line 159: mixing `=` and `<=` "can cause infinite delta-cycle loops". That overstates it: mixing causes races and sim/synth mismatch. S3.
  - Preponed, Observed and Reactive are omitted. The `speed` state has no control.
  - It is placed in an Expert performance module, where it adds nothing beyond F3B.
- Verdict: **Remove**, or replace with a link to the fixed 2.22.

### IPC (F2D, I-SV-5)

**2.24 MailboxSemaphoreGame** (`visuals/MailboxSemaphoreGame.tsx`; F2D/ipc:22, I-SV-5:20)
- Class: CM.
- Semantics:
  - A blocked `get()` (semaphore or mailbox) never resumes on its own. The learner must click again: the waiting process stays "Waiting..." after a key is returned (lines 29-49). The same applies to a blocked producer or consumer (lines 52-74). This teaches **polling** instead of blocking with wake-up. S2.
  - Missing: `try_get`/`try_put`/`peek`, multi-key `get(n)`, unbounded `new()`.
- A11y: buttons are fine. The log is not `aria-live`.
- Verdict: **Fix semantics:**
  - Auto-wake waiters in FIFO order.
  - Add try/peek variants.
  - Show the matching SV call line per action.

**2.25 Mailbox3D** (`curriculum/interactives/3d/Mailbox3D.tsx`; F2D/ipc:24)
- Class: CM (3D).
- **Semantic defect (S1):** the `try_put()` button runs `setMessages(Math.min(messages + 1, Math.min(messages + capacity, messages + 1)))` (line 78), which always adds 1. On a full mailbox it overflows past the bound ("Used: 6 / 5"). The correct behavior is to return 0 and leave the mailbox unchanged.
- Other gaps:
  - No `try_get`.
  - "Arbitration" appears in the title but nothing is shown.
  - The file is `@ts-nocheck`.
- Verdict: **Remove.** 2.24 covers this once fixed, and the 3D view adds nothing.

### Randomization (I-SV-2A/2B, practice)

**2.26 ConstraintSolverHeatmapVisualizer** (`visualizers/ConstraintSolverHeatmapVisualizer.tsx`; I-SV-2A:74)
- Class: CM. It enumerates all 4096 (addr, data) pairs exactly.
- Semantics: correct. It is uniform over the solution space, shows a marginal skew under `addr + data < 100`, and reports a contradiction when the space is empty (lines 35-55, 124-128). This is the most honest solver model in the repo.
- **Rendering defect (S2, High):** the grid uses `grid-cols-16` (line 146). Tailwind 3.4's defaults stop at 12, and `tailwind.config.ts` does not extend it. The built CSS (`.next/static/css/66d2139a9b515452.css`) contains `grid-cols-12` but not `grid-cols-16`. The 256 cells therefore render as **one column**, and the heatmap is unreadable.
- A11y:
  - Cell counts are reachable only through `group-hover` tooltips (lines 172-176). Keyboard and touch users cannot reach them.
  - Density is encoded only by opacity.
  - Constraint toggles are buttons but have no `aria-pressed`.
  - At 375px, a 16×20px grid plus the `-left-12` label overflows.
- Pred: No.
- Verdict: **Flagship candidate.** Fix the grid class, then add:
  - `dist` with `:=` vs `:/`,
  - `solve...before`,
  - a "predict P(addr=0)" step before the toggle,
  - a sampled histogram from N `randomize()` calls next to the exact distribution.

**2.27 ConstraintSolverVisualizer** (`curriculum/interactives/ConstraintSolverVisualizer.tsx`; I-SV-2A:76)
- Class: SA plus an embedded QZ.
- Semantics:
  - The probabilities are correct: 1/13 vs 1/4 for `solve A before B` (lines 46-48), and 1/3 in the embedded question (lines 237-249).
  - Step-wise "evaluate constraint 1, then 2" pruning (lines 26-31) suggests sequential solving, but constraints are solved simultaneously. S3.
  - The soft scenario comments `// From inline randomize with` on a class-level constraint (line 64).
- A11y: the scenario `<select>` (line 111) has no label.
- Verdict: **Keep.** Merge it into the heatmap flagship.

**2.28 Constraint3D** (`curriculum/interactives/3d/Constraint3D.tsx`; I-SV-2A:78)
- Class: SA (3D decision tree).
- Semantics:
  - It draws the solver as a sequential branch-and-prune tree that ends in one "Solution" node (lines 101-108).
  - With `addr < 100 && data == 0` there are 100 solutions, chosen at random. Showing a single solution teaches determinism and sequential order. S2.
- Small screens: three non-wrapping buttons at the bottom (lines 62-81) overflow at 375px. The file is `@ts-nocheck`.
- Verdict: **Remove.**

**2.29 ConstraintSolverExplorer** (`visuals/ConstraintSolverExplorer.tsx`, named export; I-SV-2B:15)
- Class: SA (precomputed dots).
- Semantic defects:
  - **(S1)** `soft length == 16;` is modelled as a 90% preference (lines 47-51), and the text says "treats length=16 as a strong preference" (line 161). With no conflicting hard constraint, a soft constraint is **always** satisfied (P=1). Soft is priority-based satisfaction, not a probability weight.
  - **(S2)** The `solve...before` mode is identical to "none" (both 1/13; lines 53-62). With an array whose size is constrained, size constraints are already solved first (LRM array-size rule, clause unverified). The text "forcing independent flat distribution" (line 162) therefore misattributes the effect.
  - The dist line `8 := 80, [4:16] :/ 20` puts 8 in both items. The model ignores 8's share of the `:/` weight (lines 41-45, 133). S4.
  - The clause cites are likely swapped: "18.5.10: Soft" and "18.5.11: solve before" (lines 161-162). In 1800-2017 numbering, solve-before is 18.5.10 and soft is 18.5.13 (clause unverified for 2023).
- A11y: dots are colour-only, red vs blue (line 201), with no text alternative.
- Verdict: **Replace** with the heatmap flagship.

**2.30 RandomizationExplorer** (`animations/RandomizationExplorer.tsx` + `randomization-data.ts`; practice `/practice/visualizations/randomization-explorer`)
- Class: CM using rejection sampling with `MAX_ATTEMPTS = 20` (line 24).
- **Semantic defect (S1):**
  - Values are drawn from 0..255 even for `bit [3:0] len` (line 250).
  - For the "Multiple Constraints" example (`len < 5; data < len*10`), each attempt succeeds with probability ≈ 5/256 · 20/256 ≈ 0.0015. So the UI reports **"Solver exhausted 20 attempts"** about 97% of the time on a satisfiable problem.
  - This teaches that `randomize()` fails nondeterministically. In SV, `randomize()` fails only when the constraints are unsatisfiable.
- Data text (line 85): "The solver will first pick a value for `len` ... and then pick data". Without `solve...before` this is false: the solution is joint-uniform, which biases toward `len=4`. S2.
- The "solve time" chart measures JS `performance.now()`, which is meaningless.
- Verdict: **Remove** from practice, or replace it with the exact-enumeration engine from 2.26.

### Coverage (I-SV-3A, practice)

**2.31 CoverageCrossExplorerVisualizer** (`visualizers/CoverageCrossExplorerVisualizer.tsx`; I-SV-3A:71)
- Class: CM. Uniform random stimulus with a 3×3 cross and ignore toggles.
- Semantics: the percentage math is correct: hit / (total − ignored), at_least = 1 (lines 35-39).
- **Code-connection defect (S2):** the generated code emits `ignore_bins low_READ = binsof(cp_addr) intersect {low} && binsof(cp_op) intersect {READ};` (lines 184-189).
  - `intersect` takes **value** ranges, not bin names. The correct form is `binsof(cp_addr.low) && binsof(cp_op.READ)`.
  - The coverpoints are declared without the `low/mid/high` bins the grid relies on (lines 181-182).
  - The learner copies invalid code.
- A11y / small screens:
  - Grid cells are `<div onClick>` (lines 227-231) with no role, tabindex or key handling, so they cannot be used from a keyboard.
  - The fixed `w-16 + 3×(w-24 + mx-1)` ≈ 376px plus padding overflows 375px.
- Pred: No. A good opportunity is coupon-collector intuition ("how many transactions to close 9 bins?").
- Verdict: **Flagship candidate.**
  - Fix the code generation.
  - Add biased stimulus and constraint holes so 100% is not guaranteed.
  - Add a predict-N step.
  - Distinguish `illegal_bins` from `ignore_bins`.
  - Make cells buttons.

**2.32 CovergroupBuilder** (`visuals/CovergroupBuilder.tsx`; **orphan**)
- Class: CM.
- Semantics:
  - A value outside every explicit bin is reported as "Covered by default (no explicit bin)" (line 114). That is wrong: the value is simply not counted unless a `default` bin exists. S2.
  - An illegal bin hit is labelled "FATAL ... Simulation terminated" (line 86). An illegal bin hit is a run-time error; termination depends on tool and settings. S3.
- Verdict: **Fix and promote.** Merge it into the coverage flagship as the bins editor.

**2.33 Coverage3D** (`3d/Coverage3D.tsx`; **orphan**)
- Class: SA. Bar heights are `Math.random()` on every mount (line 51), and it auto-rotates.
- Verdict: **Remove.**

**2.34 CoverageAnalyzer** (`animations/CoverageAnalyzer.tsx` + `coverage-data.ts`; practice)
- Class: SA. Bins flip to "covered" by step index (lines 37-50), with no stimulus.
- Verdict: **Remove**, or fold it into the coverage flagship.

### Assertions (I-SV-4A/4B, practice)

**2.35 SvaSequenceWaveformVisualizer** (`visualizers/SvaSequenceWaveformVisualizer.tsx`; I-SV-4A:49)
- Class: CM. A mini evaluator over a user-editable 16-cycle trace.
- Semantics:
  - `|->`, `|=>`, `##N`, `##[m:n]`, `[*N]`, `$rose`/`$fell` are correct for single-attempt evaluation (lines 46-117).
  - **(S1)** A bare sequence used as a property (`req ##2 ack`, preset 1) returns **VACUOUS** when `req` is 0 (lines 131-136). In SV, `assert property (req ##2 ack)` **fails** every clock that `req` is low. Vacuity exists only for implications and some other operators. This reinforces the most common SVA beginner bug: omitting `|->`.
  - **(S2) Sampling semantics are hidden.** Signal transitions are drawn exactly on the clock edge (`x = c*40` aligns with the rising edge, lines 228-240), and the evaluator uses the value of the segment *after* the edge. Concurrent assertions sample the Preponed (pre-edge) value. A learner who toggles `ack` "at" edge N learns the opposite of real sampling.
  - **(S2)** In custom mode, anything outside `req|ack|data_valid|$rose|$fell|!` silently evaluates false (line 43). For example, `req && ack |-> ...` reports VACUOUS instead of a parse error.
  - `$rose` at cycle 0 returns false (line 31). In SV it compares against the default pre-time-0 value. S4.
- A11y:
  - Trace cells are `<div onClick>` (lines 248-256), not keyboard operable.
  - Result reasons are in `title` only (line 319).
  - VACUOUS and "not evaluated" share the same "-" glyph.
  - The `<label>` (line 336) is not associated with its select.
  - The `min-w-[700px]` scroll container works on mobile.
- Pred: the learner sets a trace but sees results only on Evaluate. There is no forced prediction.
- Verdict: **Flagship candidate:**
  - Fix sequence-as-property failure.
  - Draw signal changes between edges, with a "sampled value" marker per edge.
  - Return parse errors for unsupported syntax.
  - Make cells buttons or checkboxes.
  - Add a "mark expected PASS/FAIL per attempt, then Evaluate" mode with per-cycle diff feedback.

**2.36 TemporalLogicExplorer** (`curriculum/interactives/TemporalLogicExplorer.tsx`; I-SV-4B:14)
- Class: CM plus an embedded QZ.
- Semantics:
  - Correct for `|->`, `|=>`, `|-> ##[1:2]` (lines 31-56).
  - **Syntax display defect (S3):** the `<select>` options render `req |--> gnt` and `req |==> gnt` (lines 94-96, `|--{">"}`), which are invalid operators.
  - The status updates live while the learner toggles, so there is no prediction moment.
- A11y: REQ/GNT cells are `<div onClick>` (lines 130, 145). The select has no label.
- Verdict: **Merge into 2.35.** Keep the embedded |=> timing question.

**2.37 AssertionBuilder** (`animations/AssertionBuilder.tsx`; practice)
- Class: CM. It parses only `a |-> ##N b` (lines 89-120).
- Semantics: an attempt whose consequent falls beyond the 5-cycle trace is counted as FAIL rather than pending (lines ~105-114). S3.
- Verdict: **Remove**, or replace with 2.35.

### Interfaces, bind, generate, DPI

**2.38 ModportExplorer** (`visuals/ModportExplorer.tsx`; F4B:22)
- Class: SA (three-way toggle).
- Semantics: the directions are correct, but **no modport code is shown**. Both input and output use the same right-pointing arrow (lines 72-100), so inputs appear to flow away from the component. S3.
- Small screens: fixed `w-48 + gap-12 + w-64 + arrows` ≈ 576px with no wrap (lines 51-81) overflows 375px. Mode buttons have no `aria-pressed`.
- Verdict: **Upgrade.**
  - Show `modport master (output addr, ...)`.
  - Add a "try to drive `ready` from master" action that shows the compile error.
  - Add a clocking-block modport.

**2.39 InterfaceSignalFlow** (`animations/InterfaceSignalFlow.tsx` + `interface-data.ts`; practice)
- Class: SA.
- Semantics: `logic [7:0] data` is exported as `inout data` in modports (interface-data lines ~40-41). Variables cannot be `inout` ports; that needs a net. S3, Medium confidence.
- Verdict: **Fix** the data, or remove it.

**2.40 BindDirectiveVisualizer** (`visuals/BindDirectiveVisualizer.tsx`; I-SV-4C:63)
- Class: SA (module vs instance toggle).
- Semantics: largely correct. Both `bind ahb_slave ...` and `bind tb_top.u_slave_0 ...` are legal forms.
- Labelled "Compile-time Directive Syntax" (line 163) and driven by an "Execute Bind" button. `bind` is not a compiler directive; it is processed at elaboration. S4.
- A11y: 10px code text.
- Verdict: **Keep**, with label fixes. Add a "predict the hierarchical path of the bound instance" question.

**2.41 GenerateElaborationVisualizer** (`visuals/GenerateElaborationVisualizer.tsx`; I-SV-6:154)
- Class: CM. A NUM_CH stepper updates both code and instances.
- Semantics: the code uses block label `gen_chk` and instance `chk_inst`, but the elaborated instances are shown as `chan_chk[i]` (line ~13). The real path is `tb_top.gen_chk[i].chk_inst`. Learners will use wrong paths in `config_db`, `bind`, and waveforms. S3.
- Verdict: **Fix** the names. Add an "unlabeled generate block → genblkN" case.

**2.42 DPIBoundaryInspector** (`visuals/DPIBoundaryInspector.tsx`; I-SV-7:87)
- Class: SA (timed).
- Semantics:
  - A hazard appears randomly 30% of the time for non-pure functions (`Math.random() > 0.7`, line 22). The text says it happens "Because it is **not exported as an SV task**" (hazard text). That confuses import with export: a slow imported function blocks the simulator regardless of pure or context. S2.
  - The `c_add(a,b)` → `int` example animates `svLogicVecVal a, b`. `int` arguments map to C `int`; `svLogicVecVal*` is for 4-state vectors. S3.
  - "Context function: C code can call back into SV tasks/functions". A context **function** may call exported functions only, not tasks. S3.
- Small screens: three `w-1/3` boxes with `p-6` inside `px-8` are cramped below about 600px.
- Verdict: **Replace** with a deterministic type-mapping table explorer (SV type → C type → `svdpi.h` accessor) plus a "pure/context legality" quiz.

### Debug, formal, power, operators

**2.43 DebuggingSimulator** (`ui/DebuggingSimulator.tsx`; E-DBG-1/hang-lab:21)
- Class: SC/SA. Regex highlighting of canned logs.
- Semantics: it ignores `scenario="hang"`. The scenarios are generic software ("Null Pointer Dereference at address 0x00", heap "memory leak ... ensure proper deallocation", setup/hold "timing violation", lines 16-61). The hang lab promises objection traces, heartbeat, and `get_next_item`/`item_done` pairing (MDX lines 19-30); none of it exists. SV has garbage collection and no explicit free. S1 for that lab.
- Verdict: **Replace** with a real hang-triage scenario: an objection trace log, a `+UVM_OBJECTION_TRACE` excerpt, and a "which component holds the objection?" diagnosis with per-option feedback.

**2.44 FormalVsSimulationVisualizer** (`visuals/FormalVsSimulationVisualizer.tsx`; E-INT-1:72)
- Class: SA.
- Semantics:
  - Disabling `p_no_overflow` produces a CEX on `p_full_is_correct: (count == DEPTH) |-> full` (lines ~160-165, 352-356). Overflow (push when full) does not by itself violate that implication.
  - The simulation model saturates the counter (lines ~64-66), so the story is internally inconsistent.
  - The "CEX replay" replays the same deterministic fill/drain trace (`handleReplayCex`).
  - The assert column is a hard-coded ✓ (line ~297). S2.
- Verdict: **Fix:**
  - Pair the dropped assumption with an assertion it actually protects, for example `!(count > DEPTH)` or a data-integrity check.
  - Make the replay show the CEX trace.

**2.45 PowerDomainVisualizer** (`curriculum/interactives/visuals/PowerDomainVisualizer.tsx`; E-PWR-1:53)
- Class: SA (linear click-through).
- Semantics: `RESTORE_CONTEXT` keeps `isIsolated = true` (line 42) while its description says "isolation removed" (line 37). There is no UPF or SV code connection.
- A11y: infinite animations (lines 121-125, 141-147) with no reduced-motion handling.
- Verdict: **Keep** as an illustration. Fix the inconsistency and add the UPF snippet per state.

**2.46 OperatorVisualizer** (`visuals/OperatorVisualizer.tsx`; **orphan**)
- Class: CM, 2-state only.
- Semantics: offers a binary "~&" (bitwise NAND) between A and B (lines 40-43, 111). SV has no binary `~&`; `~&` is unary reduction NAND only. There are no X/Z operands. S2.
- Verdict: **Remove**, or rebuild as the 4-state operator flagship.

**2.47 OperatorDrill** (`curriculum/f2/OperatorDrill.tsx`; **orphan**)
- Class: SA.
- Semantics:
  - `{<<{16'hA55A}} → 0b1010_0101_0101_1010` (line 57) is wrong. Bit-reversal of A55A is 5AA5 (`0101_1010_1010_0101`); the value shown is just the input. S2.
  - "`inside` uses case equality semantics" (line 115) is wrong: `inside` uses wildcard equality (`==?`) for integral set members, so X/Z in the set are wildcards.
  - The inside scenario's operands (`a=X`) do not match its evaluation text.
- Verdict: **Remove.** Its content must not reach learners as-is.

**2.48 DataTypeExplorer (animations/)** (`animations/DataTypeExplorer.tsx`; **orphan**)
- Same dynamic-array `arr.push_back`/`pop_back` defect (lines 55-79).
- Verdict: **Remove.**

**2.49 SystemVerilogDataTypesAnimation** (`animations/SystemVerilogDataTypesAnimation.tsx`; practice)
- The 4-state AND table is correct (lines 80-84).
- The "Dynamic Array" Push/Pop buttons (lines ~548-566) have the same defect as 2.13.
- The fabricated perf data (`logic memory 2 speed 1`) is meaningless.
- Verdict: **Fix** the dynamic-array section, or remove it.

**2.50 DataTypeComparisonChart** (`charts/DataTypeComparisonChart.tsx`; practice)
- Class: SA. Data is accurate (lines 14-43).
- Verdict: **Keep.**

**2.51 ConcurrencyVisualizer** (`animations/ConcurrencyVisualizer.tsx`; practice, unregistered)
- Semantics: models SV processes with **user-adjustable priorities**, where only the highest-priority process "runs" (lines 46-71, 402-434). SV has no process priorities; ready processes in a region run in unspecified order. S2.
- Verdict: **Remove**, or rebuild around fork/join variants and `wait fork`/`disable fork`.

### Code viewer and quiz framework (cross-cutting)

**2.52 InteractiveCode** (`ui/InteractiveCode.tsx`; 55 instances in 35 MDX files across F2C, F2D, F4A–F4C, I-SV-1…5, I-UVM-1B/1C/3A/3B, E-INT-1, E-PERF-1)
- Class: viewer plus a pseudo static checker.
- **Defect A (S1, High):** the children extraction (lines 318-334) relies on `child.props.mdxType === 'pre'` (line 324). MDX v2 (`next-mdx-remote@4.4.1`, `@mdx-js/mdx@2.3.0`) does not set `mdxType`, so the else branch runs `React.Children.toArray(<code/>).join('')` (line 330), which produces the string `"[object Object]"`.
  - Simulated with the repo's own MDX compiler: a fenced child extracts `"[object Object]"`.
  - This affects **32 instances**, for example `I-SV-1_OOP/constructors.mdx:22`.
- **Defect B (S1, High):** 23 instances pass `code={\`...\`}` (for example `I-SV-2A/constraint-blocks.mdx:25,32,49` and `F2C/index.mdx:67,163`). The component has no `code` prop, so these render an **empty editor**. Simulated: extracts `""`.
- **Defect C (S2):** every instance shows fabricated analytics under the code. Examples:
  - "Timing: N ns estimated latency" computed as `alwaysBlocks*10+complexity` (line 280).
  - "Memory estimate: N bytes".
  - "**Security Warnings**: Avoid using # delays for synthesizable code" on testbench code (lines 270, 592).
  - "fork...join detected; ensure this is safe".
  - "Generated Tests" stubs (line 599).
  - These are noise at best and false authority at worst.
- Editability: no compile or run. `isEditable` only lets the learner type.
- A11y / small screens:
  - A fixed 400px Monaco editor with the minimap enabled (lines 534, 554) on phones.
  - The theme check uses `theme === 'dark'`, which ignores `system`.
  - Monaco Tab-trapping behavior is unverified (Low).
- Verdict: **Fix (P0):**
  - Accept a `code` prop and extract text recursively from `pre > code`.
  - Delete the analysis panel.
  - Default to read-only, without minimap, with height fitted to the code.
  - Add a regression test that renders real MDX through `MDXRemote`.

**2.53 InterviewQuestionPlayground** (`curriculum/interactives/InterviewQuestionPlayground.tsx`; 21 MDX instances in I-SV-1, 2A, 2B, 3A, 3B, 4A, 4B, 5)
- Class: QZ with commit-then-submit and per-option explanations. The design is good.
- **Defect (S1, High):** the MDX passes options as `{ text, isCorrect, feedback }` (for example `I-SV-1_OOP/parameterized-classes.mdx:95-98`). The component reads `{ id, label, explanation }` (lines 7-12). The result:
  - Option buttons are blank.
  - Every `option.id` is `undefined`, so `handleSelect(undefined)` leaves `selectedId` falsy, and **Submit stays disabled forever** (lines 29-35, 145).
  - Duplicate `undefined` keys.
  - Only the two embedded uses (inside 2.27 and 2.36) work.
- **Content defect (S1, Medium-High):** `parameterized-classes.mdx:95-98` marks "`storage s;` is a syntax error; you must write `storage #() s;`" as correct. A declaration using the unadorned name of a parameterized class with all-default parameters is legal and denotes the default specialization. The LRM's parameterized-class examples use `stack is; // default: a stack of ints` (clause unverified). `#()` is required for class-scope resolution (`C#()::`), not for declarations.
- Other content notes:
  - `polymorphism-pitfalls.mdx`: which default argument applies on a virtual call through a base handle (base vs derived) is not settled by my knowledge of the LRM. Treat as an Unverified concern (Low) and confirm before shipping.
  - `local-variables.mdx`: a distractor says "`static` is the keyword used if you actually want them shared". SVA local variables have no static form. S3.
  - `semaphores.mdx`: the correct option says "throws an unhandled exception". SV has no exceptions. S4.
- A11y: options lack `role="radio"`/`aria-pressed`, and feedback is not `aria-live`.
- Verdict: **Fix (P0):**
  - Accept `{text, feedback}` aliases, or migrate the 21 MDX blocks.
  - Generate ids.
  - Add a schema validation test over all MDX props.
  - Fix the parameterized-class item.
  - This is the right primitive for guided prediction and should be kept.

---

## 3. Findings (brief format)

| ID | Category | Evidence | Learner consequence | Sev | Conf | Correction | Acceptance criteria and validation |
|---|---|---|---|---|---|---|---|
| IX-01 | Confirmed defect | `ui/InteractiveCode.tsx:318-334`; 32 fenced uses | Code examples show `[object Object]` in about 20 lessons | S1 | High (simulated with repo MDX 2.3.0) | Recursive text extraction from `pre>code` | Playwright: every lesson with InteractiveCode shows editor text equal to the MDX source (no `[object Object]`, not empty) |
| IX-02 | Confirmed defect | 23 `<InteractiveCode code={...}>` (constraint-blocks.mdx:25…, F2C/index.mdx:67…) | Empty editors in randomization, F2C, F4, E-INT lessons | S1 | High | Support a `code` prop | Same test as IX-01 |
| IX-03 | Confirmed defect | `InteractiveCode.tsx:255-283, 570-600` | Fake latency, memory, "security" warnings presented as analysis | S2 | High | Delete the analysis panel | Snapshot shows no "Performance", "Security Warnings" or "Generated Tests" text |
| IX-04 | Confirmed defect | `InterviewQuestionPlayground.tsx:7-12,29-35` vs MDX `{text,feedback}` in 21 files | 21 checkpoints unusable (blank, cannot submit) | S1 | High | Prop alias or migration; zod schema | Unit test parses all MDX IQP props against the schema; e2e selects an option, submits, sees feedback |
| IX-05 | Confirmed defect | `parameterized-classes.mdx:95-98` | Learner taught that a legal declaration is illegal | S1 | Med-High | Mark "compiles; `storage#(int)`" as correct | SME review against the LRM clause on parameterized classes (record the clause) |
| IX-06 | Confirmed defect | `f1/FirstBugHuntGame.tsx:17-21,77,142-144` | First exercise teaches a non-bug; no wrong answers possible | S1 | High | Rebuild with a consistent seeded bug and graded choice | Simulating the shown RTL (any simulator) reproduces the shown waveform; wrong picks give specific feedback |
| IX-07 | Confirmed defect | `visuals/EventRegionGame.tsx:44-62`; `F2C/index.mdx` table | Assertions and `final` mapped to Postponed; Observed and Reactive absent | S1 | High | Full region set; fix answers | Each item's answer reviewed against the LRM scheduling clause (clause 4); game offers all regions |
| IX-08 | Confirmed defect | `f2/DynamicStructureVisualizer.tsx:572-633`; `animations/DataTypeExplorer.tsx:55-79`; `SystemVerilogDataTypesAnimation.tsx:~548` | Dynamic arrays taught with push/pop and capacity; `new[N]` taught to preserve data | S1 | High | Dynamic tab: `new[N]`, `new[N](arr)`, `size()`, `delete()` only | Unit tests: `new[3]` after [8,16] yields [0,0,0]; `new[3](arr)` yields [8,16,0]; no push/pop buttons |
| IX-09 | Confirmed defect | `3d/Mailbox3D.tsx:78` | `try_put` on a full mailbox inserts | S1 | High | Remove, or return 0 when full | Unit test: try_put at capacity leaves count unchanged and reports 0 |
| IX-10 | Confirmed defect | `visuals/ConstraintSolverExplorer.tsx:47-62,161-162` | `soft` taught as a probability; solve-before mis-explained | S1 | High | Replace with the exact-enumeration engine | With only `soft len==16`, P(len=16)=1.0 in the model |
| IX-11 | Confirmed defect | `animations/RandomizationExplorer.tsx:24,250`; `randomization-data.ts:85` | Satisfiable constraints reported as solver failure about 97% of the time | S1 | High | Exact enumeration or a proper solver | Satisfiable examples never report failure across 1000 runs |
| IX-12 | Confirmed defect | `visualizers/SvaSequenceWaveformVisualizer.tsx:131-136` | `assert property(req ##2 ack)` shown as vacuous instead of failing | S1 | High | Non-implication properties fail when the first element mismatches | Golden traces checked against a commercial or open simulator (e.g. Verilator/SymbiYosys `--sva`) for 10 property/trace pairs |
| IX-13 | Interaction/design weakness | `SvaSequenceWaveformVisualizer.tsx:228-256` | Value at edge = post-edge value; teaches the opposite of Preponed sampling | S2 | High | Draw transitions mid-cycle with sampled markers | Same golden trace set, including a signal changing at the edge |
| IX-14 | Confirmed defect | `ConstraintSolverHeatmapVisualizer.tsx:146`; `tailwind.config.ts`; built CSS lacks `grid-cols-16` | Best solver model renders as one column | S2 | High | `grid-cols-[repeat(16,minmax(0,1fr))]` | Screenshot at 1280px and 375px shows a 16×16 grid |
| IX-15 | Confirmed defect | `f2/dataTypeQuizQuestions.ts:17-35` | Procedural multi-driver taught to produce X; `bit` recommended for RTL counters | S1/S2 | High | Rewrite Q2 and Q3 | SME review; per-option feedback present |
| IX-16 | Confirmed defect | `CoverageCrossExplorerVisualizer.tsx:181-189` | Generated `ignore_bins` code is invalid | S2 | High | `binsof(cp.bin)` form; declare the bins | Generated text compiles in a simulator (a lint test with Verilator or slang) |
| IX-17 | Confirmed defect | `visualizers/SVSchedulerRegionVisualizer.tsx:19-27,52` | No NBA→Active iteration; claims assertions see the Active race | S2 | High | Loop-back plus order toggle; fix the Observed text | SME review; visual shows a second Active pass when an NBA triggers combinational logic |
| IX-18 | Confirmed defect | `EventSchedulerVisualizer.tsx:38,159` | Coverage sampled in Postponed; "infinite delta loops" | S2 | High | Remove or fix | n/a if removed |
| IX-19 | Confirmed defect | `OperatorDrill.tsx:57,115`; `OperatorVisualizer.tsx:40-43` (orphans) | Wrong streaming result, wrong `inside` semantics, nonexistent binary `~&` | S2 (latent) | High | Delete, or fix before any use | Unit test: `{<<{16'hA55A}}` gives 16'h5AA5 |
| IX-20 | Interaction/design weakness | `MailboxSemaphoreGame.tsx:29-74` | Blocking modelled as polling | S2 | High | Auto-wake FIFO | e2e: put key back, waiting process becomes "working" with no click |
| IX-21 | Confirmed defect | `DebuggingSimulator.tsx:16-61`; hang-lab.mdx:21-30 | Hang lab content missing; generic SW bugs | S1 (for E-DBG lab) | High | Replace with an objection-trace triage | Scenario includes an objection trace; wrong component choice gets specific feedback |
| IX-22 | Interaction/design weakness | `div onClick`: CoverageCross:227, SvaWaveform:248, TemporalLogic:130/145; drag-only CostOfBug:182; hover-only Heatmap:172 | Keyboard and touch users cannot operate the core interactions | S2 | High | Buttons or checkboxes with labels | axe-core plus a keyboard-only Playwright pass on each flagship |
| IX-23 | Interaction/design weakness | No `useReducedMotion`, `MotionConfig` or `prefers-reduced-motion` anywhere in `src/` | Vestibular and attention issues (Coverage3D autorotate, PowerDomain infinite loops, Methodologies autoplay) | S3 | High | Global `<MotionConfig reducedMotion="user">` | Emulated reduced motion: no infinite animations |
| IX-24 | Interaction/design weakness | Overflow at 375px: ModportExplorer (≈576px fixed), CoverageCross (≈470px), SV3D panel `w-[360px]` over canvas, Constraint3D buttons, Heatmap | Mobile learners cannot use them | S3 | Med-High (inferred from fixed widths; not browser-verified) | Responsive wraps | Playwright 375×812 screenshots: no horizontal page scroll |
| IX-25 | Confirmed defect | `ConcurrencyVisualizer.tsx:46-71` (practice) | Process priorities do not exist in SV | S2 | High | Remove or rebuild | n/a |
| IX-26 | Confirmed defect | `PacketSorterGame.tsx:41-47,209` | Queue marked wrong for an unknown-count collection; always "Success" | S2 | High | Fix answer and modal | e2e |
| IX-27 | Confirmed defect | `TemporalLogicExplorer.tsx:94-96` | Shows `|-->` / `|==>` | S3 | High | Fix the strings | Snapshot |
| IX-28 | Confirmed defect | `GenerateElaborationVisualizer.tsx:~13` | Wrong elaborated hierarchical names | S3 | High | `gen_chk[i].chk_inst` | Snapshot |
| IX-29 | Confirmed defect | `DPIBoundaryInspector.tsx:22` + hazard text | Random hazard; import/export confusion; context function calling tasks | S2 | High | Replace | n/a |
| IX-30 | Confirmed defect | `FormalVsSimulationVisualizer.tsx` (CEX story, replay, hard-coded ✓) | Formal CEX reasoning taught inconsistently | S2 | Med-High | Fix the property/assumption pairing | SME review |
| IX-31 | Confirmed defect | `LogicStateDiagram.tsx:15`; `CurriculumDataTypeExplorer` 43/74/79 | "Silicon resolves to X"; int drawn 8-bit; "promotes to int" | S2 | High | Text and data fixes | SME review |
| IX-32 | Confirmed defect | `QueueOperationLab.tsx:7,53` | Implies queues have an intrinsic max depth | S2 | High | Show the `[$:N]` declaration | Snapshot |

---

## 4. Summary

### Counts by classification

In-scope units evaluated: 53. That is the 51 registered SV/foundational names, plus the 2 unregistered practice components (ConcurrencyVisualizer, StateMachineDesigner); StateMachineDesigner was not deeply reviewed.

| Class | Count | Members |
|---|---|---|
| Real simulator (general SV semantics) | **0** | — |
| Conceptual model (hand-coded rules, user inputs) | 19 | Signedness, StringMethod, EnumMethod, CurriculumDataTypeExplorer, ArrayMethod, DynamicStructure, QueueOperationLab, SV3D, MailboxSemaphoreGame, Mailbox3D, Heatmap, CoverageCross, CovergroupBuilder, SvaSequenceWaveform, TemporalLogic, GenerateElaboration, OperatorVisualizer, RandomizationExplorer, AssertionBuilder |
| Static checker | 2 (both pseudo) | InteractiveCode analysis panel, DebuggingSimulator |
| Scripted animation / illustration | 24 | DesignGap, CostOfBug, HallOfShame, Methodologies, VerilogVsSV, LogicStateDiagram, PackedUnpackedPlayground, ProceduralBlocks, BlockingSimulator, SVScheduler, EventScheduler, ConstraintSolverVisualizer, Constraint3D, ConstraintSolverExplorer, Coverage3D, CoverageAnalyzer, ModportExplorer, InterfaceSignalFlow, Bind, DPI, PowerDomain, FormalVsSim, DataTypeComparisonChart, SystemVerilogDataTypesAnimation, OperatorDrill, ConcurrencyVisualizer, animations/DataTypeExplorer |
| Quiz / drill | 6 | CurriculumDataTypeQuiz, PacketSorterGame, EventRegionGame, FirstBugHuntGame, InterviewQuestionPlayground (×21 MDX), plus the embedded quizzes in ConstraintSolverVisualizer and TemporalLogicExplorer |

(Some members appear in more than one category, so the totals overlap.)

Other tallies:
- **Prediction before answer**: only InterviewQuestionPlayground (broken in MDX), the two embedded IQPs, and the four quizzes. No visualizer forces a prediction.
- **Misconception-specific feedback**: only InterviewQuestionPlayground. The other quizzes show the same explanation for every option.
- **Semantic defects**: S1 in 12 components; S2 in 17.
- **Accessibility**: `div onClick` or drag-only core interactions in 5; reduced-motion support in 0 of 53.

### Top 10 issues (ranked by learner harm × reach)

1. **IX-01/02:** InteractiveCode shows `[object Object]` or an empty editor in all 55 instances across about 35 lessons, the most-used code-reading surface on the site.
2. **IX-04:** All 21 InterviewQuestionPlayground checkpoints are blank and cannot be submitted, so the site's only misconception-diagnosing primitive is dead in MDX. IX-05 adds a wrong answer key.
3. **IX-07:** EventRegionGame and the F2C table teach that assertions and `final` run in Postponed. Observed and Reactive are missing, and this contradicts F3B.
4. **IX-12/13:** The SVA evaluator treats a bare sequence as vacuous and samples post-edge values, inverting two core SVA beginner lessons.
5. **IX-08:** Dynamic arrays are given push_back, pop_back and capacity, and `new[N]` preserves data. Repeated in three components.
6. **IX-10/11:** `soft` is taught as a 90% weight. The practice randomizer "fails" about 97% of the time on satisfiable constraints, and solve-before semantics are misstated.
7. **IX-06:** The first verification exercise (FirstBugHunt) teaches a non-existent off-by-one, and every click succeeds.
8. **IX-15/31:** Data-type foundations are wrong: procedural double-drive taught to produce X, `bit` recommended for RTL, "silicon resolves to X", `int` drawn as 8-bit, operands "promoted to int".
9. **IX-03:** Fabricated latency, memory and "security" analytics sit under every code sample and undermine trust and accuracy.
10. **IX-22/24/14:** The core interactions of the best models (cross grid, SVA trace, temporal cells, heatmap tooltips) cannot be operated by keyboard or touch, overflow at 375px, and the heatmap renders as one column.

### Recommended flagships (invest here; retire the rest)

1. **Scheduler Lab.** Merge SVSchedulerRegionVisualizer and BlockingSimulator; replace EventRegionGame and EventSchedulerVisualizer.
   - Small editable scenarios (blocking/NBA/`#0`/`$display`/`$strobe`/assertion/program) with an **order toggle** for same-region processes.
   - Full region set with NBA→Active loop-back.
   - The learner predicts the printed values and the region per statement, then steps.
   - Feedback is specific per wrong region.
   - Independent practice: given a racy snippet, choose the minimal fix.
2. **SVA Trace Lab.** Merge SvaSequenceWaveformVisualizer, TemporalLogicExplorer and AssertionBuilder.
   - A correct evaluator for a defined subset: implication, `##`, ranges, `[*]`, `[->]`, `$rose`/`$past`, `disable iff`, bare-sequence failure.
   - Explicit Preponed-sampling rendering.
   - Keyboard-editable trace.
   - "Mark expected per attempt → Evaluate → diff" flow.
   - Validated against golden traces from a real tool.
   - Independent practice: write a property for a spec; the tool checks it against hidden traces.
3. **Constraint Distribution Lab.** Merge the Heatmap, ConstraintSolverVisualizer and ConstraintSolverExplorer; replace RandomizationExplorer and Constraint3D.
   - Exact enumeration over a small domain.
   - Toggles for `dist :=` vs `:/`, `soft` (priority semantics), `solve before`, and array size.
   - The learner predicts a marginal probability, then sees the exact distribution and a sampled histogram.
   - Independent practice: hit a target distribution by writing constraints.
4. **Coverage Closure Lab.** Merge CoverageCrossExplorerVisualizer and CovergroupBuilder; retire Coverage3D and CoverageAnalyzer.
   - Bins editor (explicit, ignore, illegal, default) generating **compilable** covergroup code.
   - Biased stimulus that leaves holes.
   - The learner predicts the transactions needed to close coverage, then diagnoses why a bin is unreachable.
   - Independent practice: given a constraint set and holes, change the constraints to close them.
5. **Data-type and Operator Lab.** Rebuild Signedness, the data-type explorer and operators into one 4-state expression evaluator.
   - Covers 4-state truth tables, `==` vs `===` vs `==?`, `inside`, X in `if`/`case`, signed/unsigned and width-context rules, 2-state conversion, and streaming.
   - Prediction-first with SV expression text.
   - Plus the array sandbox (fixed SystemVerilog3DVisualizer with a 2D fallback) for queue, dynamic and associative semantics.

Platform prerequisites for all flagships:
- Fix InteractiveCode and InterviewQuestionPlayground first. They are the shared scaffolding for "guided prediction → explanation".
- Add a global `MotionConfig reducedMotion="user"`.
- Add keyboard-operable controls.
- Add an MDX-props schema test so prop-shape drift like IX-02 and IX-04 cannot recur.

### Where guided practice should progress to independent practice

- **F2A/F2B**: guided prediction in the Data-type/Operator Lab and array sandbox. Then independent work in a graded lab writing a scoreboard data structure (queue + associative array), checked by a real compile and run. Today only the sv-basics-v1 token-sequence grader exists.
- **F2C/F3B**: the Scheduler Lab's prediction mode, then "fix the race" items graded by running the snippet.
- **I-SV-2**: the Constraint Lab's prediction mode, then "write constraints to achieve this histogram", auto-checked by enumeration.
- **I-SV-3**: the Coverage Lab, then "close these holes" on a provided constraint set.
- **I-SV-4**: the SVA Trace Lab's mark-and-diff mode, then "write the property"; hidden pass/fail traces grade it.
- **I-SV-5**: a fixed mailbox/semaphore model with auto-wake, then a debugging item: "find why the testbench hangs (lost key / unbounded mailbox)".
