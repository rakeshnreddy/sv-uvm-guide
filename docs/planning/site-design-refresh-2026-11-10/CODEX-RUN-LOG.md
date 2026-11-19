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
