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

## Task 2 — Task A gate calibration underway

Fetched origin and checked out `codex/figures-t1`. Merging `origin/curriculum-quality-program` reported “Already up to date.” The reviewed checkpoint is `669f7d7b`. The dev server started on port 3000. The four reviewed lessons were inspected at their released source.

The nine focused figure-gate tests and ESLint passed. The refusal test against port 1 printed “Figure gate server is unavailable at http://localhost:1. Start it or pass a reachable --url.” and produced no report. The first `--only` check selected one drawing and printed only its eleven gates. Focused results now go to the lesson’s preview directory. A full failed or interrupted result goes to the lesson’s `.partial.json`.

Standalone Chromium scratch control and mutations, from `node scripts/figure-gates/mutation-proofs.cjs`:

```text
PASS G11–G17 clean scratch figure
FAIL G11 push an axis label past the SVG viewport — 1 visual views checked, 1 findings — Scratch chart @1: Second label (64.0 px past SVG viewport)
FAIL G12 place two labels on the same baseline — 1 visual views checked, 1 findings — Scratch chart @1: First label / Second label (58.7 × 10.4 px text overlap)
FAIL G13 change the swatch dash pattern only — 1 visual views checked, 1 findings — Scratch chart @1: Threshold (no matching mark for 0,107,94 / none)
FAIL G14 keep the old drawing inside a different frame — 1 visual views checked, 1 findings — Scratch chart @1: default drawing pixels (0.00% changed (floor 5.5%))
FAIL G15 paint a selected button exactly like its peer — 1 visual views checked, 1 findings — Scratch chart @1: First (1.00:1 against an inactive sibling)
FAIL G16 reverse the ordered luminance — 1 visual views checked, 1 findings — Scratch chart @1: ramp 2 → 3 (luminance 0.058 → 0.723)
FAIL G17 lower the focal rim against its background — 1 visual views checked, 1 findings — Scratch chart @1: rect (1.30:1 revealed focal outline)
```

The default-state drawing crops were captured from temporary clean Git archives at `cb80965f`, `ccac0347`, `8ca1bdba` and `f671ae67`. The capture found artwork for the stages that render in the default state. The original text and revealed-state evidence is retained. The five released lessons are being rerun. Operators and Expressions remains at the saved Task 1 patch.

The final scratch control passes all seven new gates. The G15 mutation removes paint from a selected button’s nested indicator while keeping its outer style unchanged. The unavailable-server proof returned exit 2 and left the accepted report byte-identical. The first released-lesson results are in the queue while the rendered ramp and state calibration runs finish. The live F1A reference loaded with HTTP 200, and its opening figure was inspected.

The focused coverage-chart repeat verified G2, G5–G7, G11–G13 and G15–G17 at the required widths. G16 now keeps the dashed reference separate from the solid curve and samples the stroke’s painted segments. G14 still flags the flat chart. The browser audits inspect the default and revealed states. G14 compares normalized drawing pixels before prediction. Its focal declaration can be tied to a visual by source key and line. G15 compares rendered state indicators inside their parent controls as well as the controls’ own paint.

All five released lessons completed full runs. The first F1A run passed G9. While rerunning F1A alongside other Chromium captures, one existing expert-index test hit its 120 s timeout. The isolated expert-index retry passed all nine tests, with the formerly timed-out anchor assertion taking 62.2 s. The complete Core Data Types run is retained. A redundant second full run was stopped after the visual-only repeat started, and its interrupted output is separate from the complete result.

Task A calibration is recorded in `REVIEW-QUEUE.md`. All five full reruns completed, and each retains its measured findings and links. F1A, F1B and Structs had full repeats during calibration. The final G11–G17 repeats on F1C and Core Data Types are linked separately. The remaining optional repeats were stopped. The focused retest of F1A’s opening stages recognized their layered bodies and passed legend and ramp checks. Its missing focal declaration still fails G14 in both themes. No released lesson source was edited. Task B starts with the saved Operators and Expressions patch.

## Task 2 — Task B: F2A Operators and Expressions

Task A was pushed as `11cc5cc6`. The saved patch applied cleanly with `git apply --3way` in a temporary detached worktree. The main worktree remains at the released source while the visual plan is prepared. The new baseline at `11cc5cc6a036` captured 23 default interactive states and all 28 before crops in both themes.

The opening bowl’s first focused gate passed wording, contrast, phone font size, palette, legend, depth, states, ramp and focal outline. G11 and G12 identified a clipped equation box and crowding near the bowl rims. The spacing is being revised with the small bowl on the right at all widths, as required by its description.

The opening bowl passed all eleven focused gates on attempt two. Across the eight views there were zero G11 or G12 findings, zero small phone labels, at least 5.96:1 for measured text and 4.47:1 for measured marks. Both themes and all widths were inspected against the before design. The caption contract and checklist are recorded. The lesson is still in progress.

The side-by-side tree comparison passed all eleven focused gates on attempt two. Widening the right flags leaf fixed the label contact. The repeat found zero G11 and G12 issues, with text at 5.74:1 or above and marks at 3.99:1 or above. Its caption contract and eight manually inspected crops are retained. The precedence explorer is next.

The first precedence and power-chain checks passed all focused gates except G5. Both found the light-theme Predict badge at 4.49–4.50:1 before rounding. The badge now uses the amber figure text token. The height check sampled 69 instances with zero above 4 px and zero failed pages. All 63 ExpressionTreeExplorer component and model tests passed. The corrected contrast is being rechecked in both presets.

Both precedence presets passed all eleven focused gates after the badge contrast fix. Minimum text readings were 5.94:1 for the first instance and 5.93:1 for power-chain. Their measured marks were at least 4.30:1 and 4.32:1. The default and revealed first preset was checked at all eight reading settings. The new version declares the prediction expression as its focal part; the revealed root stays the strongest node. The kit’s three-lane diagram follows.

“One vector, three families” passed its focused gate with 68 kit notes. The lesson sets the common operand as focus. Kit notes cover 8.55–10.35 px phone labels, 1.00:1 readings on three flow marks, and edge labels over flow lines at the four review widths. The rightmost column is reachable by horizontal scrolling at 390 px. The report records the request and caption mapping. Next is the reduction preset of OperatorExplorer.

The reduction preset passed its first focused run. The default operand is now a connected strip with a body sized to the bits. The cyan final row is the focal part after reveal. The connected-strip repeat is running. The first re-gate of F1B reproduced its existing G14 and G15 findings on the bit-count preset. The other OperatorExplorer routes and heights are being checked.

The connected reduction strip and the revealed fold passed all eleven focused gates at the required widths and themes, with measured text at 5.55:1 and marks at 3.68:1 or above. The shared retests reproduced G14 on the F2A index and F2E and the recorded F1B G14/G15 findings. The 234 height measurements had zero above 4 px and zero failed pages. All 123 OperatorExplorer tests passed. The equality preset is next.

The first equality run passed ten of the eleven focused gates, including geometry, depth and focal outline. G5 measured the x cell against its indigo operand body at 4.13:1 in light mode on the main lesson and the released F2A index. The hatch now has a neutral base under it. The two presets are being rechecked before moving on.

Equality passed all eleven focused checks on this lesson, the released F2A index and F2E. The initial fix covered the editable bit. The successful third run used the same neutral base under the revealed ValueChip hatch, raising the measured minimum text to 4.94:1. The two themes and all widths were reviewed. The equality height sweep measured 234 instances across four routes, none over 4 px. The next visual is the opcode decoder comparison.

The first opcode decoder gate passed ten checks and exposed two literal paint classes on a reformatted catch-all row (G7). The phone measurement also found a new row in the selector, adding 48 px on both pages that embed compare mode. The catch-all row now uses figure tokens and the selector keeps its original available width inside the new rim. The repeat checks both routes and the main lesson’s second prediction reveal.

The decoder passed its focused gate after the selector-width fix, and the height check found zero outliers across 108 instances on six pages. A separate two-reveal Chromium audit confirmed both expected branches and zero clipping or overlap, then measured low contrast in the revealed wildcard badges, unknown chips and muted row text. Those labels now use the figure text tokens over more readable surfaces. The complete reveal and shared presets are being rechecked.

The opcode decoder passed all eleven focused gates. The final two-reveal audit opened the chip details at 2× device scale and found zero geometry, text contrast or mark contrast violations in all eight settings. The two branch results were confirmed. The Flow Control compare embed passed; its qualifiers embed still has the earlier G14 art and stage findings. TypeScript and the MDX pipeline passed, and all 215 DecisionLab and model tests passed before the final paint-only corrections. The default and both revealed columns have current crops.

The first set-membership run passed ten focused checks. G2 reported a two-theme mismatch in the revealed accessibility snapshot. An isolated comparison of the rendered instance produced identical figure strings and all 45 aria entries against the base. The first phone height was 8 px over reserve; the phone-only padding correction is now being rechecked in the lesson and the shared routes.

Set membership passed all eleven gates after compacting the phone padding. The repeat had zero G2 differences, verified both themes at all four widths and measured text at 5.28:1 or above and marks at 3.67:1 or above. The F2A index equality repeat also passed. Across four routes, all 234 measured heights were within 4 px. The expression-width presets are now being checked.

Both expression-width presets passed their focused gates. The eight-bit shift’s second reveal confirmed the eight-bit context bowl and separate 32-bit self-determined amount. Its expanded geometry and contrast audit passed at all eight settings. The height check measured 69 instances on three pages, all within 4 px. The signedness shift scenario is next.

The first shift-fill run passed all eleven gates with 26 kit observations on BitStrip. Chromium confirmed the three stored results in both themes: 7, −1, and 2147483647. A separate control check found the light selected label below its contrast floor and verified the corrected text at 6.76:1 in light and 13.62:1 in dark. The final focused capture is running. All 186 height readings across four routes were within 4 px. One shared retest was interrupted by hot reload and is being repeated.

The final shift-fill gate passed all eleven checks with no authored findings. The exact results and all eight before/after screen settings are retained. The selected label measured 6.76:1 in light and 13.62:1 in dark. The kit request records its 9 px sign label and the 1.66:1 and 1.83:1 readings. The shared route rechecks continue while the next kit figure is inspected.

The signedness decision diagram passed all eleven focused gates with 64 kit notes. The existing dashed paths still lead to signed and unsigned outcomes. The lesson supplies the unsigned branch as focus. The report records phone labels from 8.55 to 10.36 px, low-contrast marks, edge-pill intersections and the arrowhead swatch mismatch. Both themes were inspected at all four widths. Signed comparison is next.

Signed comparison now uses the verified two-theme variant treatment. The revealed ACT plate is cyan and the existing EXP plate keeps a dashed teal rim. The comparison gate, shared route rechecks and height measurements are running.

Signed comparison passed all eleven focused gates. The measured text floor was 5.07:1, and the mark floor was 3.96:1. Chromium confirmed results 1, 0, and 0 at the three variants in both themes. The height check stayed within 4 px across 186 readings. All 427 signedness and expression-model tests passed. The next variant is part-select.

Part-select passed all eleven focused gates. Chromium confirmed −8, 248 and −8 in the three original variants in both themes. Minimum authored text and mark contrast were 5.03:1 and 3.96:1. All 186 height readings across the four routes were within 4 px. Concatenation is next.

Concatenation passed every focused gate in both themes at all four widths. Its connected inputs and joined output were reviewed, including the high and low four-bit groups. Authored text measured at least 4.59:1 and marks at least 3.02:1. Shared route checks are running. The shift operator is next.

The initial operator shift run passed all eleven focused checks. Direct browser tests confirmed the marked high bit is S for the signed 1100 result and 0 for the unsigned 0100 result in both themes. The first phone height check exceeded its reserve, so the shift’s phone padding has been compacted. Its focused gate and four-route height recheck are running.

The shift diagram passed all eleven focused gates. The final phone adjustment kept all 234 height measurements across four routes within 4 px. The shift amount remains distinct from the operand, and the marked high bit matched the original signed and unsigned shift examples in both themes. The byte reversal is next.

The byte reversal passed all eleven focused checks after the crossing adjustment. Eight before and after views show 12, 34, 56, 78 reversing to 78, 56, 34, 12 with the original digits intact. Minimum text and mark contrast were 11.75:1 and 3.58:1. The stream-target diagram is next.

The five stream-target cases passed all eleven focused gates after retaining a dashed missing-field slot. Both themes at all four widths show the left-aligned 32-bit stream, four queue elements, ignored low bits, and both size errors. Text and marks measured at least 6.56:1 and 3.76:1. The streaming lab is next.

The first streaming lab passed all eleven focused checks with eight informational G7 kit lines. Both themes and all four widths were compared before and after reveal. Chromium confirmed eight zeros on the right of the 40-bit target, the 24-bit fit error, the three MSB-first unpacked fields, the 24-bit source error, and the remainder order. All 21 component tests passed. All 69 reserved heights were within 4 px. The streaming operator explorer is next.

The streaming operator explorer passed all eleven focused gates after strengthening its cyan output rims. Chromium reproduced the six caption results in both themes. All 123 existing operator component tests passed. The F2E phone repeat resolved one live-reload mount error and confirmed all 234 heights across the four routes within 4 px. The released F2A equality recheck passed. F1B reproduced its existing G14 and G15 findings. The F2E equality recheck is running. The cast lab is next.

The released F2E equality recheck passed after the streaming explorer changes. The bit-stream cast lab passed all eleven focused gates and the two-reveal geometry and authored contrast audit in eight views. Chromium confirmed the unchanged normal, zero-converted and equal-size values and both invalid casts. All 94 component and stream-model tests passed, and all 69 heights were within 4 px. The conditional explorer is next.

### Clean handoff · 2026-11-20

Paused at the owner's request after the cast lab. The first 20 of 28 visuals passed their focused gates. The remaining eight start with the conditional explorer. Its unchanged default and revealed captures already cover both themes at all four widths. The full G1–G17 run, review sheets and lesson commit remain pending. Task A is pushed at `11cc5cc6` and ready for independent review.

The reversible patch holds all six edited source files. The draft report, seven fresh base captures, and gate logs are saved under `test-results/design-previews/codex/F2A_Core_Data_Types--operators-and-expressions/wip/`. Before and after crops and height measurements remain in the enclosing lesson directory. The original Task 1 patch is still available there under its original name. The Task 2 patch was checked in reverse before restoring the source and in the forward direction afterwards.

Restore the Operators and Expressions work from this checkpoint before editing the conditional visual.

```bash
docs=docs/planning/site-design-refresh-2026-11-10
slug=F2A_Core_Data_Types--operators-and-expressions
wip=test-results/design-previews/codex/$slug/wip
lesson=content/curriculum/T1_Foundational/F2A_Core_Data_Types/operators-and-expressions.mdx
git apply --check "$wip/task-2-operators-and-expressions.patch"
git apply "$wip/task-2-operators-and-expressions.patch"
cp "$wip/task-2-report-draft.md" "$docs/reports/$slug.md"
cp "$wip/task-2-baselines/"*.base.json "$docs/reports/"
```

After editing the conditional explorer, run `node scripts/figure-gates.cjs "$lesson" --base 11cc5cc6 --only OperatorExplorer@863`. Continue through the checklist in the draft report. After the last visual, run `node scripts/figure-gates.cjs "$lesson" --base 11cc5cc6` before committing the lesson.

### Addendum 3 calibration · 2026-11-21

The requested fetch, checkout and fast-forward pull completed on `codex/figures-t1`. Calibration began at approximately 04:14 Pacific. Commit `66fe2d08` contains the gate corrections, focal records and historical first-reveal captures. The five released lesson sources were untouched.

Chromium passed the clean scratch fixture. Its nine mutations all failed their intended gates, including missing stage depth, flat selected row cells and a clipped label. The 12 gate tests, standalone type check, ESLint and commit hooks passed. Initial full runs exposed a type error in the new test fixture and screenshot timeouts under load. The corrected runs are the source of the new baseline files.

Four visual baselines are recorded. F1B passed with 21 baseline findings and zero new, with one test file passing on its serial retry. F1C passed with eight baseline findings and zero new. F1A recorded 25 visual findings and Structs recorded six. Their full runs measured all eight views. F1A's expert-index test timed out at 120 seconds and Structs' root-metadata test timed out at five seconds on their serial retries. Those G9 failures stay visible outside the visual baselines. F1A's G14 depth and focal checks found zero issues with the historical pixel comparison skipped.

The released-baseline mutation proof clipped `timing reveal?` in a scratch copy of F1A. It added one SVG clip with a right edge at 242 units, activated only in light mode at 390 px, and ran the focused gate against that scratch server. The gate exited 1 with exactly one new finding:

```text
NEW G11 100% coverage of an incomplete plan@1359 light 390 timing reveal?: extends past SVG clip #released-proof-clip
```

The owner requested handoff at approximately 05:00 Pacific, within the calibration time box. The active Core Data Types full rerun was stopped before writing a baseline. Its next command is recorded in the review queue. The scratch server was stopped after the proof. The five released lesson source files match checkpoint 32.

Operators and Expressions remains at 20 focused passes out of 28 visuals. The source patch still applies cleanly. Restore it, the draft report and the saved baselines with the commands in the 2026-11-20 handoff above. Start at the conditional explorer, then complete the remaining checklist and run the full gate. No lesson finished in this window.
