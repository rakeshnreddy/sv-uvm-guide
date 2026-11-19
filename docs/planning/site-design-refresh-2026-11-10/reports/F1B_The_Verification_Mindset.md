# F1B — The Verification Mindset

The lesson contains 19 visual instances. Three are hand-drawn, five come from the kit, and eleven embeds use seven distinct visual interactives. The four additional interview prompts are ordinary quiz controls. All four are included in the default-state and height inventories.

## Visual inventory and teaching intent

| MDX line | Visual | What the learner should see |
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

## Status

Captured both themes before redesign. Artwork and the after sheets are pending.

## Test expectations

None changed.

## Gate output

```text
FAIL G1 23 source instances, 23 rendered; 15 old — Reading same-edge and next-edge implication, disable iff and cover on the counter @129, FirstBugHuntGame @228, CounterBenchLab @248, What directed, random and formal verification explore on the same bug @306, VerificationMethodsExplorer @521, VerificationMethodologiesDiagram @525, CounterBenchLab @599, Expected coverage against the number of random samples, for 16 common bins and one rare bin @657, ClosureBudgetLab @699, ScenarioSorter @741, Inject the bug hunt's bug, then remove it: with the bug injected, so the counter wraps at 6, the test must report FAIL, and with the bug removed, so it wraps at 7, it must report PASS again. Below, the four ways a check never fails: the compare is missing or disabled, the antecedent never matches, the check is a tautology or only a cover, and a != compare is blind to X. Coverage counts; it never decides. @758, CounterBenchLab @932, OperatorExplorer @967, VerificationMethodsExplorer @996, CounterBenchLab @1016
PASS G2 23 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 10 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
FAIL G5 1580 texts (min 3.45:1), 1396 marks (min 1.00:1), 575 below floor, 0 unmeasured
FAIL G6 170 phone text samples under 11 px; smallest 7.60 px (ClosureBudgetLab)
FAIL G7 10 literal paints in lesson visuals and 0 changed component files
PASS G8 0 changed interactives, 0 affected embeds
PASS G9 tsc 0, Vitest 0 (26 files), ESLint 0/0 (7 files)
PASS G10 4 theme/width pairs, 0 page errors or overflows
FAIL — 4 of 10 gates failed
```
