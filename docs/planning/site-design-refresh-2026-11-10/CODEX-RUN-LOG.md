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

## Task 1 — F1B queued after calibration

The base capture at `ccac0347` covers 15 default embed states and 19 visual crops per theme. The shared info-highlight band at MDX line 129 is a Kit request. The F1B redesign follows the Task 0 calibration commit. The earlier F1C capture is retained for Task 2.
