# Figure review queue

- Last finished lesson · F2A Structs, Unions, and Enums, released in checkpoint 32
- Lesson in progress · F2A Operators and Expressions paused after the first 20 of 28 visuals passed their focused gates
- Working tree · Clean at handoff, with the lesson patch and evidence saved locally

Checkpoint 32 is in `origin/curriculum-quality-program` at `669f7d7b`.

## Ready for review

Task A is in `11cc5cc6`. The run log records the seven mutation proofs, the clean fixture, the refused-server and report-isolation checks, and the full reruns of the five released lessons. Findings from those reruns are below.

The Operators and Expressions patch is available for an interim review in `test-results/design-previews/codex/F2A_Core_Data_Types--operators-and-expressions/wip/task-2-operators-and-expressions.patch`. The same folder has `task-2-report-draft.md`, `task-2-baselines/` and `task-2-gate-logs/`. The adjacent before and after folders contain the captures. The full lesson gate and commit remain pending. The conditional operator is the next visual.

## Found in released lessons

The findings below come from both themes and widths 390, 768, 1280 and 1440. Existing acceptance reports are preserved. Failed full runs are stored separately. Kit observations are measured and listed under `kitNotes` in each gate report.

### F1A The Cost of Bugs

FAIL — 4 of 17 gates failed. 269 kit observations. [Gate measurements](reports/F1A_The_Cost_of_Bugs.partial.json)

The first full run passed G9. The later parallel run reached the existing expert-index test’s 120 s limit. All nine expert-index tests passed in isolation, with the anchor check taking 62.2 s.
The final focused recheck of the opening stages passed G13 and detected its layered bodies. G14 still found two missing focal declarations, one per theme.

- G9 · tsc 0, Vitest 1 (60 files), ESLint 0/0 (16 files)
| Gate | MDX line | Visual and reading | Width, theme and finding |
| --- | ---: | --- | --- |
| G13 | 23 | Where a bug can be found: five stages, with tape-out between the third and the fourth · 253,155,220 / none | 1440 dark meaningful mark has no matching swatch or direct label · 1280 dark meaningful mark has no matching swatch or direct label · 768 dark meaningful mark has no matching swatch or direct label · 390 dark meaningful mark has no matching swatch or direct label |
| G13 | 905 | The DV career ladder: four rungs and what each one owns · 241,131,208 / none | 1440 dark meaningful mark has no matching swatch or direct label · 1280 dark meaningful mark has no matching swatch or direct label · 768 dark meaningful mark has no matching swatch or direct label |
| G13 | 905 | The DV career ladder: four rungs and what each one owns · 223,119,195 / none | 1440 dark meaningful mark has no matching swatch or direct label · 1280 dark meaningful mark has no matching swatch or direct label · 768 dark meaningful mark has no matching swatch or direct label |
| G13 | 905 | The DV career ladder: four rungs and what each one owns · 198,108,177 / none | 1440 dark meaningful mark has no matching swatch or direct label · 1280 dark meaningful mark has no matching swatch or direct label · 768 dark meaningful mark has no matching swatch or direct label |
| G13 | 905 | The DV career ladder: four rungs and what each one owns · 173,103,159 / none | 1440 dark meaningful mark has no matching swatch or direct label · 1280 dark meaningful mark has no matching swatch or direct label · 768 dark meaningful mark has no matching swatch or direct label |
| G13 | 23 | Where a bug can be found: five stages, with tape-out between the third and the fourth · 127,11,88 / none | 1440 light meaningful mark has no matching swatch or direct label · 1280 light meaningful mark has no matching swatch or direct label · 768 light meaningful mark has no matching swatch or direct label · 390 light meaningful mark has no matching swatch or direct label |
| G13 | 905 | The DV career ladder: four rungs and what each one owns · 149,24,112 / none | 1440 light meaningful mark has no matching swatch or direct label · 1280 light meaningful mark has no matching swatch or direct label · 768 light meaningful mark has no matching swatch or direct label |
| G13 | 905 | The DV career ladder: four rungs and what each one owns · 161,43,130 / none | 1440 light meaningful mark has no matching swatch or direct label · 1280 light meaningful mark has no matching swatch or direct label · 768 light meaningful mark has no matching swatch or direct label |
| G13 | 905 | The DV career ladder: four rungs and what each one owns · 171,63,146 / none | 1440 light meaningful mark has no matching swatch or direct label · 1280 light meaningful mark has no matching swatch or direct label · 768 light meaningful mark has no matching swatch or direct label |
| G13 | 905 | The DV career ladder: four rungs and what each one owns · 174,91,158 / none | 1440 light meaningful mark has no matching swatch or direct label · 1280 light meaningful mark has no matching swatch or direct label · 768 light meaningful mark has no matching swatch or direct label |
| G14 | 23 | Where a bug can be found: five stages, with tape-out between the third and the fourth · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 254 | DesignGapChart · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 265 | InteractiveCostOfBugGraph · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 265 | InteractiveCostOfBugGraph · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 287 | Which mask layers change for each kind of fix · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 452 | FixPathDecisionLab · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 452 | FixPathDecisionLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 460 | HallOfShameCarousel · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 484 | The verification lifecycle and who owns each step · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 700 | Shift left: the same activities, moved earlier in the schedule · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 886 | ShiftLeftTimeline · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 886 | ShiftLeftTimeline · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 905 | The DV career ladder: four rungs and what each one owns · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 993 | The cost ladder with the three fix routes after tape-out · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1085 | Which masks change for each of the four decisions · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1262 | BoundaryProbe · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1262 | BoundaryProbe · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1310 | FixPathDecisionLab · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1310 | FixPathDecisionLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1359 | 100% coverage of an incomplete plan · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1631 | FixPathDecisionLab · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1631 | FixPathDecisionLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G15 | 265 | InteractiveCostOfBugGraph · ▶ RTL simulation | 390 light 2.45:1 against an inactive sibling |

<details><summary>Final gate lines</summary>

```text
PASS G1 23 source instances, 23 rendered; 0 old
PASS G2 23 source instances, 0 differences
SKIPPED G3 Historical F1A interactive base capture unavailable (--skip G3)
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 1798 texts (min 1.11:1), 1378 marks (min 2.30:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 7 changed component files
PASS G8 39 embeds across 3 pages, 0 outside ±4 px, 0 missing/failed
FAIL G9 tsc 0, Vitest 1 (60 files), ESLint 0/0 (16 files)
PASS G10 8 theme/width pairs, 0 page errors or overflows
PASS G11 144 visual views checked, 0 findings
PASS G12 144 visual views checked, 0 findings
FAIL G13 144 visual views checked, 32 findings — Where a bug can be found: five stages, with tape-out between the third and the fourth @23: 253,155,220 / none (meaningful mark has no matching swatch or direct label)
FAIL G14 36 visual views checked, 44 findings — Where a bug can be found: five stages, with tape-out between the third and the fourth @23: design declaration (missing a stage with depth)
FAIL G15 144 visual views checked, 1 findings — InteractiveCostOfBugGraph @265: ▶ RTL simulation (2.45:1 against an inactive sibling)
PASS G16 144 visual views checked, 0 findings
PASS G17 16 visual views checked, 0 findings
```

</details>

Reproduce with `node scripts/figure-gates.cjs content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx --base cb80965f --skip G3`.

### F1B The Verification Mindset

FAIL — 2 of 17 gates failed. 540 kit observations. [Gate measurements](reports/F1B_The_Verification_Mindset.partial.json)

| Gate | MDX line | Visual and reading | Width, theme and finding |
| --- | ---: | --- | --- |
| G14 | 249 | CounterBenchLab · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 249 | CounterBenchLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 307 | What directed, random and formal verification explore on the same bug · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 528 | VerificationMethodsExplorer · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 532 | VerificationMethodologiesDiagram · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 606 | CounterBenchLab · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 606 | CounterBenchLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 664 | Expected coverage against the number of random samples, for 16 common bins and one rare bin · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 712 | ClosureBudgetLab · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 712 | ClosureBudgetLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 754 | ScenarioSorter · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 771 | Inject the bug hunt's bug, then remove it: with the bug injected, so the counter wraps at 6, the test must report FAIL, and with the bug removed, so it wraps at 7, it must report PASS again. Below, the four ways a check never fails: the compare is missing or disabled, the antecedent never matches, the check is a tautology or only a cover, and a != compare is blind to X. Coverage counts; it never decides. · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 949 | CounterBenchLab · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 949 | CounterBenchLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 984 | OperatorExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 984 | OperatorExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1013 | VerificationMethodsExplorer · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1033 | CounterBenchLab · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1033 | CounterBenchLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G15 | 532 | VerificationMethodologiesDiagram · 2.RTLThe synthesizable SystemVerilog model of the design.▶ Formal property verif | 1440 dark 1.48:1 against an inactive sibling · 1440 light 1.67:1 against an inactive sibling · 1280 dark 1.48:1 against an inactive sibling · 1280 light 1.67:1 against an inactive sibling · 768 dark 1.48:1 against an inactive sibling · 768 light 1.67:1 against an inactive sibling · 390 dark 1.48:1 against an inactive sibling · 390 light 1.67:1 against an inactive sibling |
| G15 | 984 | OperatorExplorer · 0100 (legal one-hot) | 1280 light 1.97:1 against an inactive sibling · 768 light 1.97:1 against an inactive sibling · 390 light 1.97:1 against an inactive sibling |
| G15 | 532 | VerificationMethodologiesDiagram · ▶ Formal property verification | 390 light 2.45:1 against an inactive sibling |

<details><summary>Final gate lines</summary>

```text
PASS G1 23 source instances, 23 rendered; 0 old
PASS G2 23 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 10 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 1380 texts (min 4.83:1), 888 marks (min 3.60:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 7 changed component files
PASS G8 342 embeds across 21 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (32 files), ESLint 0/0 (16 files)
PASS G10 8 theme/width pairs, 0 page errors or overflows
PASS G11 152 visual views checked, 0 findings
PASS G12 152 visual views checked, 0 findings
PASS G13 152 visual views checked, 0 findings
FAIL G14 38 visual views checked, 38 findings — CounterBenchLab @249: design declaration (missing a stage with depth)
FAIL G15 152 visual views checked, 12 findings — VerificationMethodologiesDiagram @532: 2.RTLThe synthesizable SystemVerilog model of the design.▶ Formal property verif (1.48:1 against an inactive sibling)
PASS G16 152 visual views checked, 0 findings
PASS G17 16 visual views checked, 0 findings
```

</details>

Reproduce with `node scripts/figure-gates.cjs content/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index.mdx --base ccac0347`.

### F1C Why SystemVerilog

FAIL — 1 of 17 gates failed. 668 kit observations. [Gate measurements](reports/F1C_Why_SystemVerilog.partial.json)

The G11–G17 repeat uses the final layout and paint sampler. [Visual repeat](reports/F1C_Why_SystemVerilog.visual-audit.json)

| Gate | MDX line | Visual and reading | Width, theme and finding |
| --- | ---: | --- | --- |
| G14 | 268 | VerilogVsSystemVerilog · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 345 | ScenarioSorter · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 357 | ScenarioSorter · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 379 | uvm_pkg, the UVM library whose API IEEE 1800.2-2020 defines, sits on top of IEEE 1800-2023 SystemVerilog. The SystemVerilog box contains a design half, a verification half and the whole Verilog base, IEEE 1364-2005, merged in 2009. · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 510 | KeywordSetExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 592 | KeywordSetExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 592 | KeywordSetExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 608 | ProceduralBlocksSimulator · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 608 | ProceduralBlocksSimulator · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 805 | ScenarioSorter · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 854 | KeywordSetExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 854 | KeywordSetExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |

<details><summary>Final gate lines</summary>

```text
PASS G1 21 source instances, 21 rendered; 0 old
PASS G2 21 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 8 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 348 texts (min 5.77:1), 172 marks (min 3.37:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 6 changed component files
PASS G8 411 embeds across 33 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (19 files), ESLint 0/0 (15 files)
PASS G10 8 theme/width pairs, 0 page errors or overflows
PASS G11 136 visual views checked, 0 findings
PASS G12 136 visual views checked, 0 findings
PASS G13 136 visual views checked, 0 findings
FAIL G14 34 visual views checked, 24 findings — VerilogVsSystemVerilog @268: design declaration (missing a declared focal part or a report reason)
PASS G15 136 visual views checked, 0 findings
PASS G16 136 visual views checked, 0 findings
PASS G17 64 visual views checked, 0 findings
```

</details>

<details><summary>Updated G11–G17 lines</summary>

```text
PASS G11 136 visual views checked, 0 findings
PASS G12 136 visual views checked, 0 findings
PASS G13 136 visual views checked, 0 findings
FAIL G14 34 visual views checked, 24 findings — VerilogVsSystemVerilog @268: design declaration (missing a declared focal part or a report reason)
PASS G15 136 visual views checked, 0 findings
PASS G16 136 visual views checked, 0 findings
PASS G17 64 visual views checked, 0 findings
```

</details>

Reproduce with `node scripts/figure-gates.cjs content/curriculum/T1_Foundational/F1C_Why_SystemVerilog/index.mdx --base 8ca1bdba`.

### F2A Core Data Types

FAIL — 5 of 17 gates failed. 802 kit observations. [Gate measurements](reports/F2A_Core_Data_Types.partial.json)

The G11–G17 repeat uses the final layout and paint sampler. [Visual repeat](reports/F2A_Core_Data_Types.visual-audit.json)

| Gate | MDX line | Visual and reading | Width, theme and finding |
| --- | ---: | --- | --- |
| G12 | 759 | The five width-and-sign steps for s9 = a + b, as bit strips · 1 / line | 1440 dark label intersects a painted mark · 1440 light label intersects a painted mark · 1280 dark label intersects a painted mark · 1280 light label intersects a painted mark · 768 dark label intersects a painted mark · 768 light label intersects a painted mark · 390 dark label intersects a painted mark · 390 light label intersects a painted mark |
| G14 | 24 | Anatomy of two declarations: wire logic signed [7:0] y, and logic [7:0] v · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 186 | The four values, and how this curriculum draws them · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 225 | LogicStateDiagram · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 251 | DataTypeComparisonChart · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 251 | DataTypeComparisonChart · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 280 | Anatomy of the literal 8'shFF, and how an x digit expands · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 448 | LiteralDecoder · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 469 | OperatorExplorer · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 469 | OperatorExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 496 | Two roads for one x: X-optimistic constructs hide it, X-pessimistic operators keep it · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 640 | NetResolutionSimulator · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 640 | NetResolutionSimulator · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 663 | An x bit meets three places: an operator passes it on unless a controlling value decides, an if statement treats it as false and runs else, and a 2-state variable turns it into 0. · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 728 | DataTypeComparisonChart · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 745 | CurriculumDataTypeExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 745 | CurriculumDataTypeExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 759 | The five width-and-sign steps for s9 = a + b, as bit strips · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 935 | SignednessVisualizer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 935 | SignednessVisualizer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 959 | figure · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1043 | mem[5][2][3]: the unpacked index first, then the packed ones · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1128 | SystemVerilog3DVisualizer · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1134 | ArraySelectExplorer · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1134 | ArraySelectExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1191 | EnumMethodVisualizer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1211 | cmd_t as one 32-bit vector: op, then addr, then data · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1279 | StringMethodExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1279 | StringMethodExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1298 | SignednessVisualizer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1298 | SignednessVisualizer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1664 | NetResolutionSimulator · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1664 | NetResolutionSimulator · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1695 | NetResolutionSimulator · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1695 | NetResolutionSimulator · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1736 | NetResolutionSimulator · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1736 | NetResolutionSimulator · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1803 | LiteralDecoder · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1812 | LogicStateDiagram · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1905 | CurriculumDataTypeQuiz · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1905 | CurriculumDataTypeQuiz · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 2112 | XCheckLab · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 2112 | XCheckLab · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G15 | 1128 | SystemVerilog3DVisualizer · tr | 1440 dark 1.00:1 against an inactive sibling · 1440 light 1.00:1 against an inactive sibling · 1280 dark 1.00:1 against an inactive sibling · 1280 light 1.00:1 against an inactive sibling · 768 dark 1.00:1 against an inactive sibling · 768 light 1.00:1 against an inactive sibling · 390 dark 1.00:1 against an inactive sibling · 390 light 1.00:1 against an inactive sibling |
| G15 | 1134 | ArraySelectExplorer · tr | 1440 dark 1.00:1 against an inactive sibling · 1440 light 1.00:1 against an inactive sibling · 1280 dark 1.00:1 against an inactive sibling · 1280 light 1.00:1 against an inactive sibling · 768 dark 1.00:1 against an inactive sibling · 768 light 1.00:1 against an inactive sibling · 390 dark 1.00:1 against an inactive sibling · 390 light 1.00:1 against an inactive sibling |
| G15 | 1736 | NetResolutionSimulator · Open-drain on tri1 | 1440 light 2.45:1 against an inactive sibling |
| G16 | 24 | Anatomy of two declarations: wire logic signed [7:0] y, and logic [7:0] v · ramp 1 → 2 | 390 light luminance 0.189 → 0.237 |

<details><summary>Final gate lines</summary>

```text
PASS G1 44 source instances, 44 rendered; 0 old
PASS G2 44 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 13 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 3784 texts (min 4.98:1), 1840 marks (min 3.51:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 14 changed component files
PASS G8 372 embeds across 27 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (36 files), ESLint 0/0 (23 files)
PASS G10 8 theme/width pairs, 0 page errors or overflows
PASS G11 320 visual views checked, 0 findings
FAIL G12 320 visual views checked, 8 findings — The five width-and-sign steps for s9 = a + b, as bit strips @759: 1 / line (label intersects a painted mark)
FAIL G13 320 visual views checked, 72 findings — Anatomy of two declarations: wire logic signed [7:0] y, and logic [7:0] v @24: 173,103,159 / none (meaningful mark has no matching swatch or direct label)
FAIL G14 80 visual views checked, 92 findings — Anatomy of two declarations: wire logic signed [7:0] y, and logic [7:0] v @24: design declaration (missing a stage with depth)
FAIL G15 320 visual views checked, 18 findings — SystemVerilog3DVisualizer @1128: tr (1.00:1 against an inactive sibling)
FAIL G16 320 visual views checked, 9 findings — Anatomy of two declarations: wire logic signed [7:0] y, and logic [7:0] v @24: ramp 1 → 2 (luminance 0.211 → 0.172)
PASS G17 48 visual views checked, 0 findings
```

</details>

<details><summary>Updated G11–G17 lines</summary>

```text
PASS G11 320 visual views checked, 0 findings
FAIL G12 320 visual views checked, 8 findings — The five width-and-sign steps for s9 = a + b, as bit strips @759: 1 / line (label intersects a painted mark)
PASS G13 320 visual views checked, 0 findings
FAIL G14 80 visual views checked, 84 findings — Anatomy of two declarations: wire logic signed [7:0] y, and logic [7:0] v @24: design declaration (missing a declared focal part or a report reason)
FAIL G15 320 visual views checked, 17 findings — SystemVerilog3DVisualizer @1128: tr (1.00:1 against an inactive sibling)
FAIL G16 320 visual views checked, 1 findings — Anatomy of two declarations: wire logic signed [7:0] y, and logic [7:0] v @24: ramp 1 → 2 (luminance 0.189 → 0.237)
PASS G17 48 visual views checked, 0 findings
```

</details>

Reproduce with `node scripts/figure-gates.cjs content/curriculum/T1_Foundational/F2A_Core_Data_Types/index.mdx --base f671ae67`.

### F2A Structs, Unions, and Enums

FAIL — 1 of 17 gates failed. 536 kit observations. [Gate measurements](reports/F2A_Core_Data_Types--structs-unions-enums.partial.json)

The G11–G17 repeat uses the final layout and paint sampler. [Visual repeat](reports/F2A_Core_Data_Types--structs-unions-enums.visual-audit.json)

| Gate | MDX line | Visual and reading | Width, theme and finding |
| --- | ---: | --- | --- |
| G14 | 17 | The three shapes this lesson reuses: a struct strip, union templates over one strip, and an enum list · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 241 | A packed struct is one vector; an unpacked struct is separate members · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 406 | cmd_t layout: op in bits 31 to 28, addr in 27 to 16, data in 15 to 0 · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 567 | cmd_u: three names for the same 32 bits; word_u: members right-justified · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 673 | PackedLayoutExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 856 | next() follows the declaration ring, not the number line · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 941 | EnumMethodVisualizer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 941 | EnumMethodVisualizer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 957 | EnumMethodVisualizer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1016 | EnumMethodVisualizer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1090 | PackedLayoutExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1090 | PackedLayoutExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |
| G14 | 1106 | Positions, views and names in one picture · design declaration | 1440 dark missing a stage with depth · 1440 light missing a stage with depth |
| G14 | 1302 | PackedLayoutExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1396 | Packed tagged union layouts: tag at the MSB end, member right-justified · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1491 | PackedLayoutExplorer · design declaration | 1440 dark missing a declared focal part or a report reason · 1440 light missing a declared focal part or a report reason |
| G14 | 1491 | PackedLayoutExplorer · default drawing pixels | 1440 dark no drawing detected in the default state · 1440 light no drawing detected in the default state |

<details><summary>Final gate lines</summary>

```text
PASS G1 24 source instances, 24 rendered; 0 old
PASS G2 24 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 5 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 812 texts (min 5.84:1), 508 marks (min 3.34:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 2 changed component files
PASS G8 120 embeds across 6 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (25 files), ESLint 0/0 (11 files)
PASS G10 8 theme/width pairs, 0 page errors or overflows
PASS G11 168 visual views checked, 0 findings
PASS G12 168 visual views checked, 0 findings
PASS G13 168 visual views checked, 0 findings
FAIL G14 42 visual views checked, 34 findings — The three shapes this lesson reuses: a struct strip, union templates over one strip, and an enum list @17: design declaration (missing a declared focal part or a report reason)
PASS G15 168 visual views checked, 0 findings
PASS G16 168 visual views checked, 0 findings
PASS G17 16 visual views checked, 0 findings
```

</details>

<details><summary>Updated G11–G17 lines</summary>

```text
PASS G11 168 visual views checked, 0 findings
PASS G12 168 visual views checked, 0 findings
PASS G13 168 visual views checked, 0 findings
FAIL G14 42 visual views checked, 34 findings — The three shapes this lesson reuses: a struct strip, union templates over one strip, and an enum list @17: design declaration (missing a declared focal part or a report reason)
PASS G15 168 visual views checked, 0 findings
PASS G16 168 visual views checked, 0 findings
PASS G17 16 visual views checked, 0 findings
```

</details>

Reproduce with `node scripts/figure-gates.cjs content/curriculum/T1_Foundational/F2A_Core_Data_Types/structs-unions-enums.mdx --base ccac0347`.

## Kit requests

The released lesson reports retain their existing requests. The new measurements above include kit-specific findings with the visual, source line, viewport, theme and measured value. The shared kit was unchanged.

## Needs a reviewer decision

G14 separates missing focal declarations from default artwork that could not be isolated by the drawing selectors. Those rows request inspection of the named visual and its default-state evidence.

## Finished lessons

Task B has reached 20 focused passes in Operators and Expressions. The [run log](CODEX-RUN-LOG.md) contains the resume commands and the full acceptance command.
