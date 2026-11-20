# Tier 1 figure refresh run

## Task 0 — gate and acceptance evidence

Started from `curriculum-quality-program` at `ccac0347` on `codex/figures-t1`. Inspected the live F1A lesson and its first drawing. The reference base is `cb80965f`. The checker will keep measured exceptions visible, including the documented cost-axis text-size failure. No lesson redesign has started.

F1A source word comparison passed against `cb80965f`. Independent height measurement found 0 of 39 embeds outside 4 px. The reference files contain 49 literal paints, including the dark-mode border on BoundaryProbe’s signal lane. The owner instructed this run to keep G7 strict and to continue with documented reference failures. The unfinished F1B inventory also exposed an info highlight with literal sky classes in the shared waveform kit. Scratch testing uses a detached checkout and a separate loopback server.

### Scratch mutation proof

Temporary detached copy of F1A at `ccac0347`, served from its own checkout. Changed the phone tape-out label, its fill, and its font size together.

```text
FAIL G2 23 source instances, 1 differences
FAIL G7 1 literal paints in lesson visuals and 0 changed component files
FAIL G6 28 phone text samples under 11 px; smallest 4.19 px (Where a bug can be found: five stages, with tape-out between the third and the fourth)
  Where a bug can be found: five stages, with tape-out between the third and the fourth composition 2: words[0] differs ("tape-out" → "scratch-mutated-label")
  G7 #f0a at line 124
  G6 scratch-mutated-label at 390 px, dark and light: 4.19 px
```

### Task 0 acceptance

Implemented the ten gates, the base-capture mode and five pure unit tests. The reference run completed all four browser configurations and checked 1,385 tests in 60 files. The measurements below are from the local dev server.

```text
FAIL G1 23 source instances, 23 rendered; 6 old — FixPathDecisionLab @452, HallOfShameCarousel @460, BoundaryProbe @1262, FixPathDecisionLab @1310, FixPathDecisionLab @1631, ShiftLeftTimeline @886
PASS G2 23 source instances, 0 differences
SKIPPED G3 Historical F1A interactive base capture unavailable (--skip G3)
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
FAIL G5 2670 texts (min 1.11:1), 1704 marks (min 1.00:1), 252 below floor, 0 unmeasured
FAIL G6 26 phone text samples under 11 px; smallest 8.50 px (InteractiveCostOfBugGraph)
FAIL G7 49 literal paints in lesson visuals and 7 changed component files
PASS G8 39 embeds across 3 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (60 files), ESLint 0/0 (14 files)
PASS G10 4 theme/width pairs, 0 page errors or overflows
FAIL — 4 of 10 gates failed
```

The size exceptions include the cost chart’s 8.50 px labels and the carousel picture’s 8.80 px error glyph. G1 and G7 also found existing palette classes. G5 measured the painted visuals against the text and mark floors. The JSON records each failing label or mark with the theme, width and ratio. The reference lesson and its component files were left at their starting revisions.

F1B negative control at `--base HEAD` before capturing the base:

```text
FAIL G1 23 source instances, 23 rendered; 15 old — Reading same-edge and next-edge implication, disable iff and cover on the counter @129, FirstBugHuntGame @228, CounterBenchLab @248, What directed, random and formal verification explore on the same bug @306, VerificationMethodsExplorer @521, VerificationMethodologiesDiagram @525, CounterBenchLab @599, Expected coverage against the number of random samples, for 16 common bins and one rare bin @657, ClosureBudgetLab @699, ScenarioSorter @741, Inject the bug hunt's bug, then remove it: with the bug injected, so the counter wraps at 6, the test must report FAIL, and with the bug removed, so it wraps at 7, it must report PASS again. Below, the four ways a check never fails: the compare is missing or disabled, the antecedent never matches, the check is a tautology or only a cover, and a != compare is blind to X. Coverage counts; it never decides. @758, CounterBenchLab @932, OperatorExplorer @967, VerificationMethodsExplorer @996, CounterBenchLab @1016
```

The unmodified F1B G9 run also recorded a five-second timeout in ClosureBudgetLab while two acceptance suites were running. No test expectation or timeout was changed.

The scratch checkout was removed after saving its report. Task 0 is implemented. The reference failures above remain visible under the owner’s instruction to keep the gate strict.

## Task 0 calibration — accepted

Addendum 1 routes findings from the shared diagram kit to the reviewer. Addendum 2 scopes the floors to the artwork and G7 to changed lines. The recalibrated F1A inventory found zero old visuals. The changed-line scan found four existing reference issues. The final acceptance command passed all required gates with the explicit G3 skip. The JSON preserves every measured note.

The isolated F1A mutation run returned all four intended failures.

```text
FAIL G2 composition 2 changed “tape-out” to “scratch-mutated-label”
FAIL G7 added #f0a at MDX line 124
FAIL G6 scratch-mutated-label measured 4.19 px at 390 in both themes
FAIL G5 tape-out with foreground at 9% opacity measured 1.28:1 dark and 1.20:1 light at 1440
```

### Acceptance after both addenda

The command printed 48 KNOWN readings and 163 KIT NOTE readings. The output below includes one line of each kind and every gate line.

```text
KNOWN G7 src/components/curriculum/f1/FixPathDecisionLab.tsx 282   border-cyan-500: border-cyan-500 (reviewer)
KIT NOTE G5 One bug, two loops: who hands what to whom @666 dark 1440 the change: a test fails: 3.5426831112438983
PASS G1 23 source instances, 23 rendered; 0 old
PASS G2 23 source instances, 0 differences
SKIPPED G3 Historical F1A interactive base capture unavailable (--skip G3)
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 1798 texts (min 1.11:1), 1378 marks (min 2.30:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 7 changed component files
PASS G8 39 embeds across 3 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (60 files), ESLint 0/0 (14 files)
PASS G10 4 theme/width pairs, 0 page errors or overflows
PASS — every required gate passed; docs/planning/site-design-refresh-2026-11-10/reports/F1A_The_Cost_of_Bugs.json
```

### Reference findings for the reviewer

The recalibrated sampler uses the rendered glyph pixels and retains background paint under the glyph. For the lifecycle, shift-left, career ladder and coverage figures, the smallest word contrast is 5.65:1. The light-mode shift-left ✕ reproduces the original 4.81:1 glyph reading. The new mark minima include the career ladder’s exterior contour at 3.58:1 and the light-mode coverage outline at 3.89:1. The original check sampled individual faces and the top cap, and hid several strokes together. The paired crops preserve neighboring paint and isolate the exterior contour.

An isolated timeline chip appeared to pass. In the complete lesson, the lower pixels of both descenders blend into their colored chip borders. The table records the actual painted readings in that state.

| Gate | Visual or file | Element | Rendered view | Reading |
| --- | --- | --- | --- | --- |
| G5 | InteractiveCostOfBugGraph | Selected RTL bar outline | dark 1440 | 2.67:1 |
| G5 | BoundaryProbe | Emerald match cell border | light 1440 | 2.30:1 |
| G5 | InteractiveCostOfBugGraph | Selected RTL bar outline | dark 390 | 2.68:1 |
| G5 | BoundaryProbe | Emerald match cell border | light 390 | 2.30:1 |
| G6 | InteractiveCostOfBugGraph | ×1 | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | Spec | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×10 | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | RTL | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×100 | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | System | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×1,000 | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | Silicon | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×10,000 | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | Field | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | Relative cost to fix (log scale, illustrative) | dark 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×1 | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | Spec | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×10 | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | RTL | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×100 | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | System | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×1,000 | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | Silicon | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | ×10,000 | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | Field | light 390 | 8.50 px |
| G6 | InteractiveCostOfBugGraph | Relative cost to fix (log scale, illustrative) | light 390 | 8.50 px |
| G7 | FixPathDecisionLab.tsx:282 | border-cyan-500 | source | border-cyan-500 |
| G7 | FixPathDecisionLab.tsx:282 | bg-cyan-500 | source | bg-cyan-500 |
| G7 | BoundaryProbe.tsx:230 | border-slate-400 | source | border-slate-400 |
| G7 | BoundaryProbe.tsx:233 | border-cyan-500 | source | border-cyan-500 |
| G5 | ShiftLeftTimeline | moved right (dashed) | dark 1440 | 1.11:1 |
| G5 | ShiftLeftTimeline | passed tape-out | dark 1440 | 1.45:1 |
| G5 | ShiftLeftTimeline | moved right (dashed) | light 1440 | 1.47:1 |
| G5 | ShiftLeftTimeline | passed tape-out | light 1440 | 1.36:1 |
| G5 | ShiftLeftTimeline | moved right (dashed) | dark 390 | 1.11:1 |
| G5 | ShiftLeftTimeline | passed tape-out | dark 390 | 1.45:1 |
| G5 | ShiftLeftTimeline | moved right (dashed) | light 390 | 1.47:1 |
| G5 | ShiftLeftTimeline | passed tape-out | light 390 | 1.36:1 |

All entries belong to the reviewer. The JSON preserves the exact selectors, source coordinates and measured values.

## Task 1 — F1B passed

The base capture at `ccac0347` covers 15 default embed states and 19 visual crops per theme. The shared info-highlight band at MDX line 129 is a Kit request. The F1B redesign follows the Task 0 calibration commit. The earlier F1C capture is retained for Task 2.

The first drawing pass is in the working tree. It covers the three SVGs, seven distinct visual interactives, and the compare focus in the shared diagram. Verification and after sheets are pending.

The first redesign gate passed G2, G3, G4, G7, G9 and G10. The follow-up puts the mutation matrix on the same visual stage, separates overlapping plot marks, and increases the closure chart labels. Updated the reserved heights and the height test from 342 embeds across 21 pages. The follow-up gate is running. The independent viewport review found zero page overflow at 1440, 1280, 768 and 390 px, and the keyboard check found a visible focus ring.

The second gate passed inventory, words, model and data, rendering, phone text size, literal color, all 342 height checks and page errors. The remaining contrast findings were the closure callout crossing the rare-bin line and the directed-grid bug cross on an overly bright neutral fill. Moved the callout and corrected the neutral fill. An existing ClosureBudgetLab test timed out during concurrent browser work and passed in 1.7 seconds in isolation. Its expectation and timeout are unchanged.

The final F1B gate passed G1–G10. It measured 1,336 texts at 4.98:1 or higher and 876 marks at 3.60:1 or higher. All 342 embed measurements were within 4 px. The 32 Vitest files passed all 1,275 tests. The independent review passed all seven configurations, and both 19-visual comparison sheets are in `test-results/design-previews/codex/F1B_The_Verification_Mindset/`. F1C follows.

## Task 2 — F1C passed

F1B was committed as `515cb383`. F1C resumes from the stored `8ca1bdba` baseline and 17 before crops in each theme. The reordered work starts with the recap stack, then the language comparison, assertion trace, keyword explorer and procedural simulator. The sorter stage shipped with F1B.

The first F1C drawing pass is in the working tree. The source word proof is clean. The 390 px recap review found the verification label crossing its plate edge, so the plate was widened and the label recentered. The full gate then measured the shared-route heights and rendered colors.

The first complete F1C run passed nine gates. G5 reported 44 readings below the floors and four clipped phone samples. The follow-up uses opaque layered plates and stronger labels in the keyword rings, clears the recap label from the rim, and gives the procedural timeline and process lanes readable semantic strokes and measurable scroll stages. The full repeat is running. No reserve or test expectation changed in the first run.

The second F1C run cleared every text and clipped sample. It still found two light-theme readings where the cyan process cursor sat directly on its neutral tick (2.19:1 at 1440 px and 1.91:1 at 390 px). The cursor now replaces the gridline at the same time coordinate. Both comparison sheets are refreshed, and a supplementary baseline comparison confirmed identical text and aria across 13 fully revealed interactive instances in each theme.

The final F1C gate passed G1–G10 against `8ca1bdba`. All 17 visuals are in the new look. The final matrix measured at least 5.77:1 text and 3.37:1 marks, with all 411 reserved-height measurements within 4 px. All 1,066 targeted tests passed without updated expectations. The independent browser pass verified the keyboard path and all seven viewport and media configurations. Both final sheets include the fully revealed keyword timeline. The kit findings and container-focus request are in the lesson report. F2A Core Data Types is next.

## Task 3 — F2A Core Data Types passed

F1C was committed as `f671ae67`. The Task 3 inventory and teaching intent are in `reports/F2A_Core_Data_Types.md`. Baseline capture is running at `f671ae67` for the nine hand-drawn figures, eight kit diagrams and 23 visual embeds. No F2A source has changed.

The baseline capture finished at `f671ae67` with 27 default states and 40 before crops per theme. The nine hand-drawn figures now use the figure panel and role tokens, and the source word proof is clean. The first browser geometry pass found several labels to reposition. Work on the visual embeds is in progress.

The first F2A gate is running against `f671ae67`. The initial static contrast pass was used to separate overlapping outlines in the packed-vector drawing, clear the memory selection label from its lane and retain the dashed absent-carry cue with a legible figure. The shared visuals use the existing figure tokens, including the memory cube’s CSS-backed colors. No source changes for a later lesson have started.

The first F2A height sweep measured 372 embeds. Its only outlier was the already-existing PacketSorterGame on a shared F2B route. The separate visual is unchanged. Its measured desktop, mid and phone height reserves and test pin were updated from 364/364/552 to 380/380/568. The full gate is still collecting browser evidence.

The first full F2A run passed G2, G3, G4, G7 and G10. A dev-server refresh interrupted every pixel capture. The frame inventory fixes are applied, and the per-bit net resolution result keeps its amber tool-dependent cue as required by its existing test. The second full run is measuring a stable code snapshot.

The repeat height sweep passed all 372 measurements, and both focused test files passed all 36 tests. The before crops were regenerated from the same archived baseline with sticky site navigation hidden for screenshots. The second full contrast matrix and a static-only confirmation are running.

The stable F2A run passed eight gates. G5 reported 64 text readings below 4.5:1 and G6 reported 266 undersized labels from the shared BitStrip. The standalone static-figure repeat had zero contrast or size findings. The authored table tags and labels have been corrected, and the existing shared BitStrip and ValueChip render sites are marked as kit regions without changing the kit. The table reserve is being remeasured before the next full gate.

The four-state badge now has room for its label inside the double outline. Chromium measured its widths chart at 1354/1370/2189 px, so its mid reserve and test pin now use 1370 px. The final full gate and matching after crops are running. No F2A commit has been made.

Both 40-visual comparison sheets are saved. A separate software-WebGL browser pass rendered the memory scene at 365 × 418 px in each theme, revealed the selected drawer, and logged no page errors. The standard screenshots show the 2D fallback, which preserves the same state. The latest full pixel sweep is still running.

The complete pixel sweep passed G5 and G6. It measured 3,784 authored texts at 4.98:1 or above and 1,760 authored marks at 3.51:1 or above. The only failed gate was G9, where ESLint required the existing list key to move to the new kit wrapper in PackedLayoutExplorer’s union view. The key is fixed and the acceptance rerun is underway.

The acceptance run passed G1–G10 at `f671ae67`. All 40 visuals are in the new look. The confirmed floor is 4.98:1 for authored text and 3.51:1 for marks. All 372 shared-route height measurements fell within 4 px, and all 1,335 targeted Vitest tests passed. The independent review passed seven viewport and media configurations with visible keyboard focus and zero errors. The report records both changed reserve expectations and all Kit requests. Structs, Unions, and Enums is next.

## Task 4 — F2A Structs, Unions, and Enums passed

Core Data Types was committed as `815e425e`. The Task 4 before capture is running at that commit. The report lists all 21 visuals and their teaching intent before drawing changes. The three interview prompts are included in the embed baseline.

The initial baseline capture found the packet-header PackedLayoutExplorer slot with zero visible characters inside the closed “Worked solution” disclosure. Both themes still rendered all 13 slot containers. Opening only the enclosing disclosure exposed 1,426 visible characters and left the interactive’s internal disclosure count unchanged. The gate now opens closed ancestors only for initially empty slots, before recording their default state. Its ordinary model and word comparisons still apply. A focused regression and the complete before capture are running.

The capture correction is committed as `72d3385d`. The six gate unit tests and focused ESLint check passed. Capture succeeded with 13 default states and 21 clean before crops per theme. The baseline ref remains `815e425e`. The first pass on the seven drawings is in the working tree.

The first full Structs gate passed nine checks, including all 120 reserve measurements and the source and interactive word comparisons. G5 found four low-contrast readings on one generic outline in the opening drawing, between 1.63:1 and 1.74:1. I’m isolating the outline before the repeat. No test expectations changed.

The low reading came from the middle enum row, whose top and bottom strokes lay directly over neighboring strokes. The three named members now have one outer frame and two shared dividers. The dotted extra row sits below the frame. On phones, the “bit 0” label also clears the nearby x glyph. The full repeat and comparison captures are running.

The repeat passed all visual checks, with 812 authored text readings at or above 5.84:1 and 468 authored marks at or above 3.42:1. The completed 21-visual sheets are saved in both themes. G9 reported one 5-second PackedLayoutExplorer test timeout while the captures ran alongside Vitest. The same test passed on the first full run. The full gate is retrying without concurrent screenshot work.

The final Structs gate passed G1–G10 against `815e425e`. The isolated test ran in 557 ms and all 1,004 targeted tests passed on the full retry. All 21 visuals are accounted for. The final G5 floors were 5.84:1 for text and 3.42:1 for marks. G8 verified all 120 reserves across six routes with no expectation changes. The independent review passed all seven configurations with visible keyboard focus, no label collisions or page overflow, and 11.85 px minimum static phone text. The report and both sheets are ready for review. Operators and Expressions is next.

## Task 5 — F2A Operators and Expressions paused before acceptance

Structs, Unions, and Enums was committed as `6cec83ff`. That commit is the current reviewer checkpoint. The Operators and Expressions report lists 28 visuals and their teaching intent. The before capture is running against `6cec83ff`. The lesson and its five shared components are untouched.

The baseline contains 23 default states and 28 clean before crops in each theme. The first pass on the five hand drawings is in place. Source comparison found no word or aria differences. Both expression trees and the two dense context diagrams have phone compositions. The first browser geometry and contrast pass is running while the shared interactive treatments are prepared.

The first drawing probe found 14 contrast readings where a label met hatching, a vessel rim, a tree edge or a cropped right boundary. The labels now have clear space and the hatch sits beside the x glyph. The shared expression, decision, operator, signedness and streaming visuals are styled. Source wording and aria checks passed again. The first full gate is running against `6cec83ff`.

The first height sweep covered 309 embeds across seven routes, all within 4 px, with no failed pages or console errors. A separate four-width geometry check found overlapping label bounds in the bowl and byte-slice diagrams and a clipped desktop footer in the bowl. The spacing corrections are ready to apply after the active pixel capture. No reserve or test expectation changes are indicated.

The first full run passed G2–G10, including 2,472 authored text readings at or above 4.71:1 and 1,174 marks at or above 3.31:1. G1 still saw four locked embeds without a styled stage: the decision comparison, both expression-width instances and the stream cast. Their always-visible code demonstrations now sit on styled stages. The bowl footer and streaming labels have the measured spacing adjustments. A short inventory and geometry check is running before the full repeat.

The short rendered inventory found all 31 slots and zero old visuals in both themes. The four-width geometry repeat cleared the previous collisions and found one new overlap between the opening equation and its bowl headings. The equation moved up four SVG units. All other figures were clear, with the smallest phone labels at 12.57 px. The full repeat is running on the corrected layout.

At the owner's request, review stops at `6cec83ff`, the last accepted lesson commit. Automatic approval review declined the additional geometry check after the stop instruction. The active acceptance repeat and queued browser review were stopped. Task 5 has no acceptance result or commit. Its six source files were restored to the checkpoint. The reversible patch, report draft, baseline and first gate output are saved in `test-results/design-previews/codex/F2A_Core_Data_Types--operators-and-expressions/wip/`. The earlier before crops are one directory up. The next work after review is to reapply the Task 5 patch and continue its acceptance. Task 6 and later remain pending.
